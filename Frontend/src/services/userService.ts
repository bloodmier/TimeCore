
import { postData } from "./basicservice";
import type {
  ApiUserRegisterRequest,
  ApiUserRegisterResponse,
} from "../models/users";

export const UserService = {
  register: (payload: ApiUserRegisterRequest) =>
    postData<ApiUserRegisterResponse>("/users", payload),
};
