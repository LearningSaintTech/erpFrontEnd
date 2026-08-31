import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';

interface User {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  isSuperAdmin?: boolean;
  organizationId?: string;
}

interface Factory {
  _id: string;
  name: string;
  code: string;
}

interface AuthContextType {
  user: User | null;
  factories: Factory[];
  permissions: string[];
  factoryId: string | null;
  setFactoryId: (id: string) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
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

  const setFactoryId = (id: string) => {
    localStorage.setItem('factoryId', id);
    setFactoryIdState(id);
    queryClient.clear();
    loadSession(id).catch(() => {});
  };

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setLoading(false);
      return;
    }
    loadSession(factoryId)
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
    const { accessToken, user, factories, permissions } = res.data.data;
    localStorage.setItem('accessToken', accessToken);
    setUser(user);
    setFactories(factories || []);
    setPermissions(permissions || []);
    if (factories?.length) {
      const fid = factories[0]._id;
      localStorage.setItem('factoryId', fid);
      setFactoryIdState(fid);
      queryClient.clear();
      await loadSession(fid);
    }
  };

  const logout = async () => {
    await api.post('/auth/logout');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('factoryId');
    setUser(null);
    setFactories([]);
    setPermissions([]);
    setFactoryIdState(null);
  };

  return (
    <AuthContext.Provider value={{ user, factories, permissions, factoryId, setFactoryId, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
