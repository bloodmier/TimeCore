import { Outlet } from "react-router-dom";
import { AccountMenu } from "../components/AccountMenu";


export const AccountLayout = () => {



  return (
    <div className="rounded-(--radius-xl) w-full min-h-0 bg-(--color-background-lighter) text-(--color-foreground) md:mx-auto ">
      <div className="mx-auto w-full flex min-h-0">
        <aside className="rounded-bl-xl rounded-br-xl hidden md:flex w-64 shrink-0 flex-col border border-(--color-sidebar-border) p-4 gap-2 sticky top-0  bg-(--color-sidebar) text-(--color-sidebar-foreground)">
          <div className="mb-6 min-w-0">
            <div className="font-semibold truncate">User</div>
            <div className="text-sm opacity-70 truncate">
              Test
            </div>
          </div>
          <AccountMenu />
        </aside>
        <main className="flex-1 min-w-0 p-4 md:p-8">

          <div className="md:hidden mb-4">
            <div className="mb-3">
              <div className="font-semibold">User</div>
              <div className="opacity-70">ID</div>
            </div>
            <AccountMenu className="rounded-(--radius-lg) border border-(--color-border) bg-(--color-card) text-(--color-card-foreground) shadow-sm" />
          </div>
          <div className="flex-1 w-full min-w-0">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
