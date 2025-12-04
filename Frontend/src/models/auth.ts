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
  name:string;
  role: string;
  email: string;
}

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
