import axios, { InternalAxiosRequestConfig } from "axios";

const ISO_DATETIME_NO_TZ =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?$/;

function normalizeBackendDateString(value: string): string {
  return ISO_DATETIME_NO_TZ.test(value) ? `${value}Z` : value;
}

function normalizeBackendDates<T>(data: T): T {
  if (data == null) return data;

  if (typeof data === "string") {
    return normalizeBackendDateString(data) as T;
  }

  if (Array.isArray(data)) {
    return data.map((item) => normalizeBackendDates(item)) as T;
  }

  if (typeof data === "object" && data.constructor === Object) {
    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      normalized[key] = normalizeBackendDates(value);
    }
    return normalized as T;
  }

  return data;
}

// Create Axios Instance
// In Docker (behind Nginx): VITE_API_BASE_URL="/api/v1"
// In local dev and Docker: defaults to "/api/v1" so Vite/Nginx can proxy it.
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api/v1",
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor to inject Token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

const PUBLIC_PATHS = ["/", "/recuperar-contrasena", "/restablecer-contrasena"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) =>
    path === "/" ? pathname === "/" : pathname.startsWith(path)
  );
}

function clearSessionAndRedirect() {
  localStorage.removeItem("token");
  localStorage.removeItem("refreshToken");
  window.location.href = "/";
}

// Interceptor to handle 401 Unauthorized
api.interceptors.response.use(
  (response) => {
    if (response && response.data !== undefined) {
      response.data = normalizeBackendDates(response.data);
    }
    return response;
  },
  async (error) => {
    if (error.response?.status !== 401 || typeof window === "undefined") {
      return Promise.reject(error);
    }

    // Public pages (login, password recovery) handle their own errors.
    if (isPublicPath(window.location.pathname)) {
      return Promise.reject(error);
    }

    const originalRequest = error.config as RetryableRequestConfig | undefined;

    // Try to renew the access token once, then retry the original request.
    const refreshToken = localStorage.getItem("refreshToken");
    if (refreshToken && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshRes = await api.post<{ access_token: string }>(
          "/auth/refresh",
          { refresh_token: refreshToken },
          { _retry: true } as RetryableRequestConfig
        );
        const newAccessToken = refreshRes.data.access_token;

        localStorage.setItem("token", newAccessToken);
        window.dispatchEvent(
          new CustomEvent("auth:token-refreshed", {
            detail: { accessToken: newAccessToken },
          })
        );

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed; fall through to session cleanup.
      }
    }

    clearSessionAndRedirect();
    return Promise.reject(error);
  }
);