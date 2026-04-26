import axios from "axios";

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

// Interceptor to handle 401 Unauthorized
api.interceptors.response.use(
  (response) => {
    if (response && response.data !== undefined) {
      response.data = normalizeBackendDates(response.data);
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // If token is invalid and we are not in the login page, clear it
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/")) {
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        window.location.href = "/";
      }
    }
    return Promise.reject(error);
  }
);
