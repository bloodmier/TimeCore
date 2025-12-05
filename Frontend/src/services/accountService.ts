import type { ApiUser } from "../models/common";
import { putData } from "./basicservice";


interface ApiAvatarUpdateResponse {
  message: string;
  user: ApiUser;
}

export const accountService = {
  async updateAvatar(file: File): Promise<ApiUser> {
    const formData = new FormData();
    formData.append("avatar", file);
     console.log("jag körs");
     
    const data = await putData<ApiAvatarUpdateResponse>(
      "/users/me/avatar",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );

    return data.user;
  },
};
