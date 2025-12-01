import type { AxiosRequestConfig } from "axios";
import axios from "axios";


// GET
export const getData = async <T>( url: string,token?: string,config?: AxiosRequestConfig): Promise<T> => {
  const headers: Record<string, string> = {
    ...(config?.headers as Record<string, string> ?? {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await axios.get<T>(url, {
    ...(config ?? {}),
    headers,
  });
  return response.data;
};

// POST
export const postData = async <T>(
  url: string,
  payload: any,
  token?: string,
  config?: AxiosRequestConfig
): Promise<T> => {
  const headers: Record<string, string> = {
    ...(config?.headers as Record<string, string> ?? {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await axios.post<T>(url, payload, {
    ...(config ?? {}),
    headers,
  });
  return response.data;
};

// PATCH
export const putData = async <T>(
  url: string,
  payload: any,
  token?: string,
  config?: AxiosRequestConfig
): Promise<T> => {
  const headers: Record<string, string> = {
    ...(config?.headers as Record<string, string> ?? {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await axios.put<T>(url, payload, {
    ...(config ?? {}),
    headers,
  });
  return response.data;
};

// DELETE
export const deleteData = async <T>(
  url: string,
  token?: string,
  config?: AxiosRequestConfig
): Promise<T> => {
  const headers: Record<string, string> = {
    ...(config?.headers as Record<string, string> ?? {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await axios.delete<T>(url, {
    ...(config ?? {}),
    headers,
  });
  return response.data;
};
