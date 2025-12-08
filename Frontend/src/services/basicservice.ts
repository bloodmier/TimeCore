// src/services/baseService.ts
import type {AxiosError, AxiosRequestConfig, AxiosResponse} from "axios";
import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_BACKEND_URL ?? "http://localhost:5000/api";

// ---- REFRESH TOKEN HANDLING ----------------------------------------------

type RetriableConfig = AxiosRequestConfig & { _retry?: boolean };

let isRefreshing = false;
let subscribers: Array<(success: boolean) => void> = [];

function subscribe(cb: (success: boolean) => void) {
  subscribers.push(cb);
}

function notifySubscribers(success: boolean) {
  subscribers.forEach((cb) => cb(success));
  subscribers = [];
}

// ---- AXIOS INSTANCE -------------------------------------------------------

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// ---- RESPONSE INTERCEPTOR -------------------------------------------------

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const status = error.response?.status;
    const originalRequest = error.config as RetriableConfig;

    if (originalRequest?.url?.includes("/auth/refresh")) {
      return Promise.reject(error);
    }

    if (status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      if (!isRefreshing) {
        isRefreshing = true;

        try {
          await api.post("/auth/refresh");

          isRefreshing = false;
          notifySubscribers(true);

          return api(originalRequest);
        } catch (err) {
          console.error("→ Refresh FAILED", err);
          isRefreshing = false;
          notifySubscribers(false);
          return Promise.reject(err);
        }
      }

      return new Promise((resolve, reject) => {
        subscribe((success) => {
          if (success) {
            resolve(api(originalRequest));
          } else {
            reject(error);
          }
        });
      });
    }

    return Promise.reject(error);
  }
);

// ---- BASIC CRUD HELPERS ---------------------------------------------------

// GET
export const getData = async <T>(
  url: string,
  config?: AxiosRequestConfig
): Promise<T> => {
  const response = await api.get<T>(url, {
    ...(config ?? {}),
  });
  return response.data;
};

// POST
export const postData = async <T>(
  url: string,
  payload?: any,
  config?: AxiosRequestConfig
): Promise<T> => {
  const response = await api.post<T>(url, payload, {
    ...(config ?? {}),
  });
  return response.data;
};

// PUT
export const putData = async <T>(
  url: string,
  payload?: any,
  config?: AxiosRequestConfig
): Promise<T> => {
  const response = await api.put<T>(url, payload, {
    ...(config ?? {}),
  });
  return response.data;
};

// DELETE
export const deleteData = async <T>(
  url: string,
  config?: AxiosRequestConfig
): Promise<T> => {
  const response = await api.delete<T>(url, {
    ...(config ?? {}),
  });
  return response.data;
};
