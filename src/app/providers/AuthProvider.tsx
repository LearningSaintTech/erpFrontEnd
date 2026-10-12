import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';

interface User {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  isSuperAdmin?: boolean;
  organizationId?: string;
}

interface Factory {
  _id: string;
  name: string;
  code: string;
  /** Present for super admins (who see every organization's factories). */
  organizationId?: string;
}

interface AuthSessionPayload {
  accessToken: string;
  user: User;
  factories?: Factory[];
  permissions?: string[];
}

interface AuthContextType {
  user: User | null;
  factories: Factory[];
  permissions: string[];
  factoryId: string | null;
  setFactoryId: (id: string) => void;
  login: (email: string, password: string) => Promise<void>;
  requestOtp: (params: {
    phoneNumber: string;
    countryCode?: string;
    name?: string;
    mode: 'login' | 'register';
  }) => Promise<{ userId: string }>;
  resendOtp: (userId: string) => Promise<void>;
  verifyOtp: (userId: string, otp: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Re-read user, factories and permissions (e.g. after a factory was created). */
  refreshSession: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [factories, setFactories] = useState<Factory[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [factoryId, setFactoryIdState] = useState<string | null>(localStorage.getItem('factoryId'));
  const [loading, setLoading] = useState(true);

  const loadSession = useCallback(async (activeFactoryId?: string | null) => {
    const res = await api.get('/users/me', {
      headers: activeFactoryId ? { 'X-Factory-Id': activeFactoryId } : undefined,
    });
    setUser(res.data.data.user);
    setFactories(res.data.data.factories || []);
    setPermissions(res.data.data.permissions || []);
    return res.data.data;
  }, []);

  const applySession = useCallback(async (payload: AuthSessionPayload) => {
    localStorage.setItem('accessToken', payload.accessToken);
    setUser(payload.user);
    setFactories(payload.factories || []);
    setPermissions(payload.permissions || []);
    if (payload.factories?.length) {
      const fid = payload.factories[0]._id;
      localStorage.setItem('factoryId', fid);
      setFactoryIdState(fid);
      queryClient.clear();
      await loadSession(fid);
    }
  }, [loadSession, queryClient]);

  const setFactoryId = (id: string) => {
    localStorage.setItem('factoryId', id);
    setFactoryIdState(id);
    // clear() alone leaves mounted components showing the previous factory's data (their
    // observers keep the last result and never refetch). Reset instead: every query drops its
    // data, in-flight requests for the old factory are cancelled and active ones refetch with
    // the new X-Factory-Id.
    void queryClient.cancelQueries().then(() => queryClient.resetQueries());
    loadSession(id).catch(() => {});
  };

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setLoading(false);
      return;
    }
    loadSession(factoryId)
      .catch(async (err) => {
        // Stored factory no longer accessible (assignment removed, or tampered storage):
        // fall back to the user's own factories instead of signing them out.
        if (factoryId && err?.response?.status === 403) {
          localStorage.removeItem('factoryId');
          setFactoryIdState(null);
          return loadSession(null);
        }
        throw err;
      })
      .then((data) => {
        if (data.factories?.length && !localStorage.getItem('factoryId')) {
          setFactoryId(data.factories[0]._id);
        }
      })
      .catch(() => {
        localStorage.removeItem('accessToken');
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    await applySession(res.data.data);
  };

  const requestOtp = async ({
    phoneNumber,
    countryCode = '+91',
    name,
    mode,
  }: {
    phoneNumber: string;
    countryCode?: string;
    name?: string;
    mode: 'login' | 'register';
  }) => {
    const path = mode === 'register' ? '/auth/otp/register' : '/auth/otp/login';
    const res = await api.post(path, { phoneNumber, countryCode, name });
    return { userId: res.data.data.userId as string };
  };

  const resendOtp = async (userId: string) => {
    await api.post('/auth/otp/resend', { userId });
  };

  const verifyOtp = async (userId: string, otp: string) => {
    const res = await api.post('/auth/otp/verify', { userId, otp });
    await applySession(res.data.data);
  };

  const logout = async () => {
    // Always clear the local session, even if the server call fails (expired token, offline…);
    // otherwise "Sign out" silently does nothing.
    try {
      await api.post('/auth/logout');
    } catch {
      /* ignore — the local session is dropped below */
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('factoryId');
      setUser(null);
      setFactories([]);
      setPermissions([]);
      setFactoryIdState(null);
      queryClient.clear();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        factories,
        permissions,
        factoryId,
        setFactoryId,
        login,
        requestOtp,
        resendOtp,
        verifyOtp,
        logout,
        refreshSession: async () => { await loadSession(factoryId); },
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
