import axios from 'axios';
import { getApiErrorMessage } from '../utils/errors';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  const factoryId = localStorage.getItem('factoryId');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (factoryId) config.headers['X-Factory-Id'] = factoryId;
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
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
