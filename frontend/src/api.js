import axios from 'axios';

// Use Vite proxy in dev (/api → backend). Override with VITE_API_BASE_URL if needed.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// Track if a refresh is in progress to avoid multiple refresh calls
let isRefreshing = false;
let refreshSubscribers = [];

const subscribeToTokenRefresh = (callback) => {
  refreshSubscribers.push(callback);
};

const onRefreshed = (token) => {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
};

// Create axios instance
const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Include cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

// Automatically refresh the access token
const refreshAccessToken = async () => {
  try {
    const res = await axiosInstance.post('/auth/refresh');
    return res.data.accessToken;
  } catch (err) {
    console.error('Token refresh error:', err);
    return null;
  }
};

// Request interceptor - add token to headers
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    console.log(`[API] ${config.method.toUpperCase()} ${config.baseURL}${config.url}`);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle 401 and refresh token
axiosInstance.interceptors.response.use(
  (response) => {
    console.log(`[API] Response status: ${response.status}`);
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // If 401 and not already retried — skip for the refresh endpoint itself
    // to avoid a deadlock (refresh 401 → interceptor waits for refresh → hangs)
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url.includes('/auth/refresh')
    ) {
      originalRequest._retry = true;

      if (!isRefreshing) {
        isRefreshing = true;
        const newToken = await refreshAccessToken();
        isRefreshing = false;

        if (newToken) {
          localStorage.setItem('accessToken', newToken);
          onRefreshed(newToken);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return axiosInstance(originalRequest);
        } else {
          // Refresh failed - clear tokens and logout
          localStorage.removeItem('accessToken');
          window.dispatchEvent(new CustomEvent('logout'));
          return Promise.reject(new Error('Session expired. Please login again.'));
        }
      } else {
        // Wait for the refresh to complete
        return new Promise((resolve) => {
          subscribeToTokenRefresh((newToken) => {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            resolve(axiosInstance(originalRequest));
          });
        });
      }
    }

    return Promise.reject(error);
  }
);

// Wrapper function for backward compatibility with fetch API
// Converts axios response to fetch-like response
export const apiCall = async (endpoint, options = {}) => {
  try {
    const config = {
      method: options.method || 'GET',
      url: endpoint,
    };

    // Handle body - convert from string to object if needed
    if (options.body) {
      config.data = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
    }

    // Merge additional headers
    if (options.headers) {
      config.headers = { ...axiosInstance.defaults.headers, ...options.headers };
    }

    const response = await axiosInstance(config);

    // Return fetch-like response object
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      statusText: response.statusText,
      data: response.data,
      json: async () => response.data,
    };
  } catch (error) {
    // Handle axios errors
    const status = error.response?.status || 0;
    const data = error.response?.data || { error: error.message };

    return {
      ok: false,
      status,
      statusText: error.response?.statusText || 'Error',
      data,
      json: async () => data,
    };
  }
};

// Export axios instance for advanced usage
export default axiosInstance;
