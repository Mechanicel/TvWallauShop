// frontend/src/services/api.ts

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { store } from '@/store';
import { setAccessToken, clearAuth } from '@/store/slices/authSlice';

const api = axios.create({
  // @ts-ignore
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  withCredentials: true, // wichtig für httpOnly-Refresh-Cookie
});

// === Request Interceptor ===
// Fügt den Bearer-Token aus dem Redux-Store hinzu.
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = store.getState().auth.accessToken;

  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// === Response Interceptor ===
// Handhabt 401-Fehler und automatisches Nachladen des Access-Tokens.

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((p) => {
    if (error) {
      p.reject(error);
    } else {
      p.resolve(token!);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalReq = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    const status = error.response?.status;
    const url = originalReq?.url || '';

    // Nur auf "normale" Requests reagieren, nicht auf die Auth-Endpoints selbst.
    const isAuthEndpoint =
      url.includes('/auth/login') ||
      url.includes('/auth/signup') ||
      url.includes('/auth/refresh') ||
      url.includes('/auth/logout');

    if (status === 401 && !originalReq._retry && !isAuthEndpoint) {
      // Wenn wir gerade schon ein Refresh durchführen, sammeln wir Requests
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalReq.headers = originalReq.headers ?? {};
            originalReq.headers.Authorization = `Bearer ${token}`;
            return api(originalReq);
          })
          .catch((err) => Promise.reject(err));
      }

      originalReq._retry = true;
      isRefreshing = true;

      try {
        // Refresh-Endpoint aufrufen (sendet httpOnly-Cookie automatisch mit)
        const { data } = await api.post<{ accessToken: string }>(
          '/auth/refresh',
        );

        const newToken = data.accessToken;

        // Neuen Token im Store (und damit auch in localStorage über setAccessToken)
        store.dispatch(setAccessToken(newToken));

        // Gesammelte Requests jetzt mit dem neuen Token wiederholen
        processQueue(null, newToken);

        // Ursprünglichen Request erneut senden
        originalReq.headers = originalReq.headers ?? {};
        originalReq.headers.Authorization = `Bearer ${newToken}`;
        return api(originalReq);
      } catch (refreshError) {
        // Alles Fehlgeschlagene ablehnen, Auth-State löschen
        processQueue(refreshError, null);
        store.dispatch(clearAuth());
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default api;
