import type { ApiUser } from "./common";

export interface ApiUserRegisterRequest {
  name: string;
  email: string;
  password: string;
  tenantId: number;
}

export interface ApiUserRegisterResponse {
  message: string; 
  user: ApiUser;
}

export type UserOption = {
  id: number;
  name: string;
};