import axios from "axios";

// Create Axios Instance
export const api = axios.create({
  baseURL: "http://localhost:5050/api/v1", // Using local backend by default
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
  (response) => response,
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
