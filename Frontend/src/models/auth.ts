import type { ApiMessageResponse, ApiUser } from "./common";

export interface ApiLoginRequest {
  email: string;
  password: string;
}

export interface ApiLoginResponse {
  message: string;
  user: ApiUser;
}

export interface ApiMeUser {
  id: number;
  tenantId: number;
  tenantName: string;
  name: string;
  role: string;
  email: string;
  avatarUrl?: string | null;
}

export type CurrentUser = ApiMeUser;

export interface ApiMeResponse {
  user: ApiMeUser;
}

export interface ApiForgotPasswordRequest {
  email: string;
}

export type ApiForgotPasswordResponse = ApiMessageResponse;

export interface ApiResetPasswordRequest {
  token: string;
  password: string;
}

export interface ApiResetPasswordResponse {
  message: string;
  user: ApiUser;
}

export type ApiLogoutResponse = ApiMessageResponse;

export interface ApiChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export type ApiChangePasswordResponse = ApiMessageResponse;
