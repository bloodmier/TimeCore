
import { NavLink, Outlet } from "react-router-dom";

export const AdminLayout = () => {
  const base =
  "px-4 py-2 border border-b-0 rounded-t-md transition-colors duration-200 -mb-px";
const active =
  "bg-[var(--color-border)] border-[var(--color-border)] text-[var(--color-foreground)]";
const idle =
  "border-[var(--color-border)] text-muted-foreground hover:bg-[var(--color-accent)] hover:text-[var(--color-accent-foreground)]";


  return (
    <div>
      <ul className="flex gap-2 mb-4 border-b pb-2">
        <li>
          <NavLink
            to="/account/admin/summary"
            className={({ isActive }) =>
              `${base} ${isActive ? active : idle}`
            }
          >
            summary
          </NavLink>
        </li>
        <li>
          <NavLink
            to="/account/admin/statistics"
            className={({ isActive }) =>
              `${base} ${isActive ? active : idle}`
            }
          >
            Statistics
          </NavLink>
        </li>
        <li>
          <NavLink
            to="/account/admin/invoice"
            className={({ isActive }) =>
              `${base} ${isActive ? active : idle}`
            }
          >
            Invoice
          </NavLink>
        </li>
      </ul>

      <div className="border border-(--color-border) rounded-(--radius-lg) p-4 " >
        <Outlet />
      </div>
    </div>
  );
};
