// src/services/baseService.ts
import type { AxiosRequestConfig } from "axios";
import axios from "axios";


const api = axios.create({
  baseURL: "http://localhost:5000/api", 
  withCredentials: true,                
  headers: {
    "Content-Type": "application/json",
  },
});

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
