import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { accountService } from "../services/accountService";
import { AuthService } from "../services/authService";
import type { ApiUser } from "../models/common";

export const useAccount = () => {
  const { user, setUser, refreshMe } = useAuth();

  const [updatingAvatar, setUpdatingAvatar] = useState(false);

  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);


  const updateAvatar = async (file: File): Promise<ApiUser> => {
    setUpdatingAvatar(true);
    setError(null);
    try {
      const updatedUser = await accountService.updateAvatar(file);

      setUser(updatedUser);
      await refreshMe();

      return updatedUser;
    } catch (err: any) {
      setError(err?.message ?? "Failed to update avatar");
      throw err;
    } finally {
      setUpdatingAvatar(false);
    }
  };


  const changePassword = async (
    currentPassword: string,
    newPassword: string
  ) => {
    setChangingPassword(true);
    setPasswordMessage(null);

    try {
      await AuthService.changePassword({
        currentPassword,
        newPassword,
      });

      setPasswordMessage("Password changed successfully.");
      return true;
    } catch (err: any) {
      setPasswordMessage(
        err?.response?.data?.message ??
          err?.message ??
          "Failed to change password."
      );
      return false;
    } finally {
      setChangingPassword(false);
    }
  };

  return {
    user,
    updatingAvatar,
    updateAvatar,
    changingPassword,
    passwordMessage,
    changePassword,
    error,
  };
};
