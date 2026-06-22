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

let dispatcherPromise: Promise<unknown | undefined> | null = null;

/**
 * Build a connection-fresh undici dispatcher. Returns undefined if undici cannot
 * be imported (older Node), in which case the SDK falls back to global fetch and
 * still benefits from the retry wrapper below.
 */
async function buildDispatcher(): Promise<unknown | undefined> {
  if (!dispatcherPromise) {
    dispatcherPromise = (async () => {
      try {
        const { Agent } = (await import('undici')) as typeof import('undici');
        return new Agent({
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
      } catch {
        return undefined;
      }
    })();
  }
  return dispatcherPromise;
}

/** Construct a hardened OpenAI client (SDK retries + connection-fresh dispatcher). */
export async function createOpenAIClient(apiKey: string): Promise<OpenAIInstance> {
  const mod = await import('openai');
  const OpenAI = mod.default as OpenAICtor;
  const dispatcher = await buildDispatcher();
  return new OpenAI({
    apiKey,
    maxRetries: 4,
    ...(dispatcher ? { fetchOptions: { dispatcher } as Record<string, unknown> } : {}),
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
