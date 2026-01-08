import { Navigate, Outlet } from "react-router-dom";
import { AccountMenu } from "../components/AccountMenu";
import { useAuth } from "../context/AuthContext";
import { LoadingSpinner } from "../components/LoadingSpinner";

export const AccountLayout = () => {
  const { user, loading } = useAuth(); 

  if (loading) {
    return (
        <LoadingSpinner/>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="rounded-(--radius-xl) w-full min-h-0 bg-(--color-background-lighter) text-(--color-foreground) md:mx-auto overflow-x-hidden">
      <div className="mx-auto w-full flex min-h-0">
        <aside className="max-md:hidden          
    w-64 shrink-0 flex flex-col 
    rounded-bl-xl rounded-br-xl
    border border-(--color-sidebar-border)
    p-4 gap-2 sticky top-0
    bg-(--color-sidebar) text-(--color-sidebar-foreground)">
          <div className="mb-6 min-w-0">
            <div className="font-semibold truncate">{user.name}</div>
            <div className="text-sm opacity-70 truncate">
              {user.email}
            </div>
          </div>
          <AccountMenu user={user} />
        </aside>

        <main className="flex-1 min-w-0 p-4 md:p-8">
          <div className="md:hidden mb-4">
            <div className="mb-3">
              <div className="font-semibold">{user.name}</div>
              <div className="opacity-70">{user.email}</div>
            </div>
            <AccountMenu
              user={user}
              className="rounded-(--radius-lg) border border-(--color-border) bg-(--color-card) text-(--color-card-foreground) shadow-sm"
            />
          </div>

          <div className="flex-1 w-full min-w-0">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
