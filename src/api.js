import axios from 'axios';

export const API_ORIGIN = import.meta.env.VITE_API_URL || '';
export const api = axios.create({ baseURL: `${API_ORIGIN}/api` });

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const url = (err.config && err.config.url) || '';
    if (err.response && err.response.status === 401 && !url.includes('/auth/login')) {
      localStorage.removeItem('token');
      window.dispatchEvent(new Event('auth:logout'));
    }
    return Promise.reject(err);
  }
);

export const errMsg = (e) =>
  (e && e.response && e.response.data && e.response.data.message) ||
  (e && e.request && !e.response ? 'Cannot reach the server. Check your connection and try again.' : (e && e.message) || 'Something went wrong');
