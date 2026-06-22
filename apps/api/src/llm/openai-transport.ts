/**
 * Robust transport for the OpenAI SDK.
 *
 * On some cloud hosts (observed on Node 22 / Ubuntu behind a NAT), undici's
 * default HTTP/1.1 keep-alive connection pool intermittently reuses a socket the
 * upstream has already half-closed, surfacing as:
 *
 *   "Invalid response body while trying to fetch
 *    https://api.openai.com/v1/chat/completions: Premature close"
 *
 * The same code path works fine on a developer laptop, so this is purely a
 * connection-reuse artefact rather than a key/network/API problem. We harden it
 * two ways:
 *
 *   1) A custom undici Agent with keep-alive effectively disabled (very short
 *      keep-alive timeouts, a single connection, no pipelining) so the SDK opens
 *      a fresh socket per request instead of trusting a stale pooled one.
 *   2) SDK-level retries (maxRetries) plus an explicit retry wrapper around the
 *      create() call that catches connection-class errors ("Premature close",
 *      ECONNRESET, socket hang up, APIConnectionError) and retries with backoff.
 *
 * Provider-neutral wording is kept in user-facing strings elsewhere; this module
 * is internal transport plumbing.
 */

type OpenAICtor = typeof import('openai').default;
type OpenAIInstance = import('openai').default;

let fetchPromise: Promise<typeof globalThis.fetch | undefined> | null = null;

/**
 * Build a custom fetch backed by undici with keep-alive effectively disabled.
 *
 * IMPORTANT: the OpenAI SDK (v4) does NOT honour `fetchOptions.dispatcher`, and
 * it does not use undici's *global* dispatcher either — it calls its own fetch.
 * Both of those were verified to still throw "Premature close" on the affected
 * host. Injecting a custom `fetch` that routes every request through undici's
 * `fetch` with our connection-fresh Agent is the approach that actually works
 * (verified live: 200 OK on the same host that was failing).
 *
 * Returns undefined if undici cannot be imported (older Node), in which case the
 * SDK falls back to its built-in fetch and still benefits from the retry wrapper.
 */
async function buildUndiciFetch(): Promise<typeof globalThis.fetch | undefined> {
  if (!fetchPromise) {
    fetchPromise = (async () => {
      try {
        const undici = (await import('undici')) as typeof import('undici');
        const dispatcher = new undici.Agent({
          // Effectively disable keep-alive: drop sockets almost immediately so a
          // stale pooled connection can never be reused for the next request.
          keepAliveTimeout: 10,
          keepAliveMaxTimeout: 10,
          connections: 1,
          pipelining: 0,
          // Generous header/body timeouts — extraction responses can be large.
          headersTimeout: 120_000,
          bodyTimeout: 120_000,
        });
        const undiciFetch = undici.fetch as unknown as typeof globalThis.fetch;
        return ((input: Parameters<typeof globalThis.fetch>[0], init?: Parameters<typeof globalThis.fetch>[1]) =>
          undiciFetch(input as never, {
            ...(init as object),
            dispatcher,
          } as never)) as typeof globalThis.fetch;
      } catch {
        return undefined;
      }
    })();
  }
  return fetchPromise;
}

/**
 * Construct a hardened OpenAI client: SDK retries + a custom undici-backed fetch
 * with keep-alive disabled (defeats the "Premature close" socket-reuse bug).
 */
export async function createOpenAIClient(apiKey: string): Promise<OpenAIInstance> {
  const mod = await import('openai');
  const OpenAI = mod.default as OpenAICtor;
  const customFetch = await buildUndiciFetch();
  return new OpenAI({
    apiKey,
    maxRetries: 4,
    ...(customFetch ? { fetch: customFetch } : {}),
  });
}

/** True for transient connection-class failures worth retrying. */
function isConnectionError(err: unknown): boolean {
  const name = (err as { name?: string })?.name ?? '';
  const code = (err as { code?: string })?.code ?? '';
  const msg = (err instanceof Error ? err.message : String(err ?? '')).toLowerCase();
  if (name === 'APIConnectionError' || name === 'APIConnectionTimeoutError') return true;
  if (['ECONNRESET', 'ECONNREFUSED', 'EPIPE', 'ETIMEDOUT', 'UND_ERR_SOCKET'].includes(code)) {
    return true;
  }
  return (
    msg.includes('premature close') ||
    msg.includes('socket hang up') ||
    msg.includes('other side closed') ||
    msg.includes('terminated') ||
    msg.includes('econnreset') ||
    msg.includes('fetch failed')
  );
}

/**
 * Run an OpenAI request with retry/backoff for connection-class errors. The
 * caller's own status-based logic (400 → json_object fallback, 429 → backoff) is
 * preserved by re-throwing anything that is not a connection error.
 */
export async function withConnectionRetry<T>(
  fn: () => Promise<T>,
  { retries = 4, baseDelayMs = 500 }: { retries?: number; baseDelayMs?: number } = {},
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < retries && isConnectionError(err)) {
        const delay = baseDelayMs * 2 ** attempt;
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('OpenAI request failed');
}

export const __testing = { isConnectionError };
