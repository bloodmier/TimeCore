import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";


type RequireAuthProps = {
  children: React.ReactNode;
};

export const RequireAuth = ({ children }: RequireAuthProps) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span>Checking authentication...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  return <>{children}</>;
};
