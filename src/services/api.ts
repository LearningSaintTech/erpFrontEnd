import axios from 'axios';
import { getApiErrorMessage } from '../utils/errors';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

export function getDeviceId(): string {
  const key = 'erp-device-id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  const factoryId = localStorage.getItem('factoryId');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (factoryId) config.headers['X-Factory-Id'] = factoryId;
  config.headers['x-device-id'] = getDeviceId();
  return config;
});

/**
 * Access tokens are short-lived (15m). On a 401 we try ONE silent refresh using the httpOnly
 * refresh-token cookie, then replay the request — instead of bouncing the user to /login mid-task.
 * Concurrent 401s share one refresh call.
 */
let refreshing: Promise<string | null> | null = null;
function refreshAccessToken(): Promise<string | null> {
  if (!refreshing) {
    refreshing = axios
      .post(`${API_URL}/auth/refresh`, {}, { withCredentials: true, headers: { 'x-device-id': getDeviceId() } })
      .then((r) => {
        const token = r.data?.data?.accessToken as string | undefined;
        if (!token) return null;
        localStorage.setItem('accessToken', token);
        return token;
      })
      .catch(() => null)
      .finally(() => { setTimeout(() => { refreshing = null; }, 0); });
  }
  return refreshing;
}

apiClient.interceptors.response.use(
  (res) => res,
  async (err) => {
    const cfg = err.config as (typeof err.config & { _retried?: boolean }) | undefined;
    const url = String(cfg?.url || '');
    if (
      err.response?.status === 401
      && cfg
      && !cfg._retried
      && !/\/auth\//.test(url)
      && localStorage.getItem('accessToken')
    ) {
      cfg._retried = true;
      const token = await refreshAccessToken();
      if (token) {
        cfg.headers = cfg.headers || {};
        cfg.headers.Authorization = `Bearer ${token}`;
        return apiClient(cfg);
      }
    }
    if (err.response?.status === 401) {
      localStorage.removeItem('accessToken');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    err.message = getApiErrorMessage(err);
    return Promise.reject(err);
  }
);

export default apiClient;
export { API_URL };
