import { NavLink, Outlet } from "react-router";

export const TimeRegisterLayoutpage = () => {
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
            to="/account/timeregister/labor"
            className={({ isActive }) =>
              `${base} ${isActive ? active : idle}`
            }
          >
            Labor
          </NavLink>
        </li>
        <li>
          <NavLink
            to="/account/timeregister/sick"
            className={({ isActive }) =>
              `${base} ${isActive ? active : idle}`
            }
          >
            sick
          </NavLink>
        </li>
        <li>
          <NavLink
            to="/account/timeregister/vacation"
            className={({ isActive }) =>
              `${base} ${isActive ? active : idle}`
            }
          >
            vacation
          </NavLink>
        </li>
        <li>
          <NavLink
            to="/account/timeregister/templates"
            className={({ isActive }) =>
              `${base} ${isActive ? active : idle}`
            }
          >
            Templates
          </NavLink>
        </li>
      </ul>

      <div className="border border-[var(--color-border)] rounded-[var(--radius-lg)] p-4 " >
        <Outlet />
      </div>
    </div>
  );
};
