import axios from 'axios';

// Local Vite sends /api requests to Express; Render uses the public API service URL.
const apiOrigin = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
const apiBaseUrl = apiOrigin
  ? `${apiOrigin.replace(/\/api$/i, '')}/api`
  : '/api';
const api = axios.create({ baseURL: apiBaseUrl });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('skillswap-token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function messageFrom(error) {
  return error.response?.data?.message || 'Something went wrong. Please try again.';
}

export default api;
