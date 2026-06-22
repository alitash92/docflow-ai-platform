import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * Demo session — NOT real authentication.
 *
 * This is a client-side showcase gateway: a localStorage flag that lets a
 * visitor "enter" the dashboard demo. There is no auth backend, no password
 * checking, no session security. It exists only so the product reads as a
 * full app (landing → sign-in → dashboard) rather than a lone screen.
 */
const KEY = 'docflow.demo.session';

interface DemoUser {
  name: string;
  email: string;
}

interface AuthValue {
  user: DemoUser | null;
  signedIn: boolean;
  /** Start a demo session and persist it client-side. */
  signIn: (user?: Partial<DemoUser>) => void;
  /** Clear the demo session. */
  signOut: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

function read(): DemoUser | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as DemoUser) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DemoUser | null>(() => read());

  const signIn = useCallback((next?: Partial<DemoUser>) => {
    const u: DemoUser = {
      name: next?.name?.trim() || 'Demo Reviewer',
      email: next?.email?.trim() || 'demo@docflow.ai',
    };
    try {
      localStorage.setItem(KEY, JSON.stringify(u));
    } catch {
      /* private mode / storage disabled — session is in-memory only */
    }
    setUser(u);
  }, []);

  const signOut = useCallback(() => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    setUser(null);
  }, []);

  // Keep tabs in sync if the demo session is cleared elsewhere.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setUser(read());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ user, signedIn: user !== null, signIn, signOut }),
    [user, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
