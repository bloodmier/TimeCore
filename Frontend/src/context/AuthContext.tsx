import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { AxiosError } from "axios";
import { AuthService } from "../services/authService";
import type { ApiUser } from "../models/common";

type AuthContextType = {
  user: ApiUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  setUser: (user: ApiUser | null) => void;
  login: (
    email: string,
    password: string
  ) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const res = await AuthService.me();
        setUser({
          id: res.user.id,
          name: res.user.name, 
          email: res.user.email,
          tenant_id: res.user.tenantId,
          tenantName:res.user.tenantName,
          role: res.user.role,
          is_active: 1,
          avatarUrl: res.user.avatarUrl ?? null,
        });
      } catch (err) {
        console.error("Failed to load current user", err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    void init();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const res = await AuthService.login({ email, password });
      console.log(res);
      
      setUser(res.user);
      return { ok: true };
    } catch (error) {
      const err = error as AxiosError;
      const status = err.response?.status;

      let message = "Login failed";
      if (status === 400) message = "Missing or invalid fields";
      if (status === 401) message = "Invalid email or password";
      if (status === 403) message = "Your account is disabled";

      return { ok: false, error: message };
    }
  };

  const logout = async () => {
    try {
      await AuthService.logout();
    } catch (err) {
      console.error("Logout error", err);
    } finally {
      setUser(null);
    }
  };

  const refreshMe = async () => {
    try {
      const res = await AuthService.me();
       setUser({
          id: res.user.id,
          name: res.user.name, 
          email: res.user.email,
          tenant_id: res.user.tenantId,
          tenantName:res.user.tenantName,
          role: res.user.role,
          is_active: 1,
          avatarUrl: res.user.avatarUrl ?? null,
        });
    } catch (err) {
      console.error("refreshMe error", err);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        loading,
        login,
        logout,
        refreshMe,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
