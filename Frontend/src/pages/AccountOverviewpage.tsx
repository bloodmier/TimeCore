import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ChangeEvent,
} from "react";

import { useAuth } from "../context/AuthContext";
import { useAccount } from "../hooks/useAccount";

import { AccountAvatarSection } from "../components/account/AccountAvatarSection";
import { ProfileCard } from "../components/account/ProfileCard";
import { SecurityCard } from "../components/account/SecurityCard";

const API_BASE_URL =
  import.meta.env.VITE_BACKEND_URL ?? "http://localhost:5000/api";

const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

const resolveAvatarUrl = (relative?: string | null) => {
  if (!relative) return null;
  if (relative.startsWith("http://") || relative.startsWith("https://")) {
    return relative;
  }
  return `${API_ORIGIN}${relative}`;
};

export const AccountOverviewPage = () => {
  const { user, loading } = useAuth();
  const {
    updateAvatar,
    updatingAvatar,
    changePassword,
    changingPassword,
    passwordMessage,
  } = useAccount();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);


  useEffect(() => {
    if (user?.avatarUrl && !selectedFile) {
      setPreviewUrl(resolveAvatarUrl(user.avatarUrl));
    }
  }, [user, selectedFile]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setSaveMessage(null);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleAvatarClick = () => fileInputRef.current?.click();

  const handleSaveAvatar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedFile) return;

    try {
      setSavingAvatar(true);
      await updateAvatar(selectedFile);
      setSaveMessage("Profile picture updated successfully.");
      setSelectedFile(null);
    } catch (err: any) {
      setSaveMessage(err.message ?? "Failed to update image");
    } finally {
      setSavingAvatar(false);
    }
  };

  const handleChangePassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPasswordError(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("Please fill all password fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    const ok = await changePassword(currentPassword, newPassword);
    if (ok) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  const getInitials = () => {
    if (!user?.name) return "U";
    const parts = user.name.split(" ");
    return parts.length === 1
      ? parts[0][0].toUpperCase()
      : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <main className="mx-auto max-w-4xl w-full px-4 py-6 space-y-4">
      <AccountAvatarSection
        user={user}
        previewUrl={previewUrl}
        selectedFile={selectedFile}
        saveMessage={saveMessage}
        updating={savingAvatar || updatingAvatar}
        loading={loading}
        getInitials={getInitials}
        onAvatarClick={handleAvatarClick}
        onSave={handleSaveAvatar}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <ProfileCard user={user} />
      <SecurityCard
        showPasswordForm={showPasswordForm}
        togglePasswordForm={() => setShowPasswordForm((p) => !p)}
        currentPassword={currentPassword}
        newPassword={newPassword}
        confirmPassword={confirmPassword}
        onCurrentPasswordChange={setCurrentPassword}
        onNewPasswordChange={setNewPassword}
        onConfirmPasswordChange={setConfirmPassword}
        onSubmit={handleChangePassword}
        loading={changingPassword || loading}
        error={passwordError}
        message={passwordMessage}
      />
    </main>
  );
};
