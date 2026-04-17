import axios from 'axios';

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:3001/api';

const inflight = new Map();
const ACCESS_TOKEN_STORAGE_KEY = 'salevision:accessToken';

export class ApiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = options.status || 500;
    this.code = options.code || 'REQUEST_FAILED';
    this.errors = options.errors || null;
    this.retryAfterSeconds = options.retryAfterSeconds || 0;
  }
}

let refreshPromise = null;
let unauthorizedHandler = () => {};

export function configureAxiosAuth({ onUnauthorized } = {}) {
  unauthorizedHandler = typeof onUnauthorized === 'function' ? onUnauthorized : () => {};
}

export const axiosClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 15000,
  withCredentials: true,
});

axiosClient.interceptors.request.use((config) => {
  const token = window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
  if (token && !config.headers?.Authorization) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axiosClient.interceptors.response.use(
  (response) => {
    const token = response?.data?.data?.accessToken;
    if (token) {
      window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, String(token));
    }
    return response;
  },
  async (error) => {
    if (error?.code === 'ERR_CANCELED') {
      return Promise.reject(error);
    }

    const originalRequest = error.config || {};
    const status = error.response?.status || 500;
    const isAuthRoute = String(originalRequest.url || '').includes('/v1/auth/');
    const skipRefresh = Boolean(originalRequest.skipAuthRefresh);

    if (status === 401 && !skipRefresh && !isAuthRoute && !originalRequest._retry) {
      originalRequest._retry = true;

      if (!refreshPromise) {
        refreshPromise = axiosClient
          .post('/v1/auth/refresh', {}, { skipAuthRefresh: true })
          .finally(() => {
            refreshPromise = null;
          });
      }

      try {
        await refreshPromise;
        return axiosClient(originalRequest);
      } catch (refreshError) {
        window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
        unauthorizedHandler();
      }
    }

    const payload = error.response?.data || {};
    const retryHeader = error.response?.headers?.['retry-after'];
    const retryAfterFromHeader = retryHeader ? Number(retryHeader) || 0 : 0;
    const retryAfterFromPayload = Number(payload?.errors?.[0]?.details?.retryAfterSeconds || 0) || 0;
    const retryAfterSeconds = retryAfterFromHeader || retryAfterFromPayload;

    const message = payload?.message || error.message || 'Request failed';
    const code = payload?.errors?.[0]?.code || 'REQUEST_FAILED';

    return Promise.reject(
      new ApiError(message, {
        status,
        code,
        errors: payload?.errors || null,
        retryAfterSeconds,
      }),
    );
  },
);

export async function apiRequest({ method = 'get', url, params, data, signal, dedupeKey }) {
  if (dedupeKey && inflight.has(dedupeKey)) {
    return inflight.get(dedupeKey);
  }

  const request = axiosClient({ method, url, params, data, signal })
    .then((response) => response.data)
    .finally(() => {
      if (dedupeKey) {
        inflight.delete(dedupeKey);
      }
    });

  if (dedupeKey) {
    inflight.set(dedupeKey, request);
  }

  const payload = await request;
  if (!payload.success) {
    throw new ApiError(payload.message || 'Request failed', {
      status: 400,
      code: payload?.errors?.[0]?.code || 'REQUEST_FAILED',
      errors: payload?.errors || null,
    });
  }

  return payload;
}

export function ws(path, workspaceId) {
  return `/workspaces/${workspaceId}${path}`;
}

export function wsV1(path, workspaceId) {
  return `/v1/workspaces/${workspaceId}${path}`;
}
