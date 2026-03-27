import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiUrl } from '../api';

const AUTH_USER_CACHE_KEY = 'app_user_cache';

function readCachedUser() {
  try {
    const raw = localStorage.getItem(AUTH_USER_CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

function writeCachedUser(user) {
  try {
    if (user && typeof user === 'object') {
      localStorage.setItem(AUTH_USER_CACHE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(AUTH_USER_CACHE_KEY);
    }
  } catch {
    // ignore
  }
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => readCachedUser());
  const [loading, setLoading] = useState(true);

  const setUserAndToken = useCallback((newUser) => {
    const u = newUser || null;
    setUser(u);
    writeCachedUser(u);
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(apiUrl('/api/auth/logout'), { method: 'POST', credentials: 'include' });
    } catch {
      // ignore
    }
    setUser(null);
    writeCachedUser(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiUrl('/api/auth/me'), { credentials: 'include' });
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setUser(data.user);
            writeCachedUser(data.user);
          } else {
            setUser(null);
            writeCachedUser(null);
          }
        } else {
          setUser(null);
          writeCachedUser(null);
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          writeCachedUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, setUserAndToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
