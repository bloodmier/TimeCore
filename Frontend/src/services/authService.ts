import { getData, postData } from "./basicservice";

import type {
  ApiLoginRequest,
  ApiLoginResponse,
  ApiMeResponse,
  ApiForgotPasswordRequest,
  ApiForgotPasswordResponse,
  ApiResetPasswordRequest,
  ApiResetPasswordResponse,
  ApiLogoutResponse,
} from "../models/auth";

export const AuthService = {
  login: (payload: ApiLoginRequest) =>
    postData<ApiLoginResponse>("/auth/login", payload),

  me: () =>
    getData<ApiMeResponse>("/auth/me"),

  forgotPassword: (payload: ApiForgotPasswordRequest) =>
    postData<ApiForgotPasswordResponse>("/auth/forgot-password", payload),

  resetPassword: (payload: ApiResetPasswordRequest) =>
    postData<ApiResetPasswordResponse>("/auth/reset-password", payload),

  logout: () =>
    postData<ApiLogoutResponse>("/auth/logout"),
};
