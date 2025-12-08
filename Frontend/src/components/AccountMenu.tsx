import { NavLink } from "react-router-dom";

import {
  LayoutDashboard,
  Clock,
  CalendarRange,
  ShieldCheck,
} from "lucide-react";
import type { ApiUser } from "../models/common";


type Props = { 
  className?: string
  user:ApiUser 
};
export const AccountMenu = ({ className,user }: Props) => {

const role = user?.role

  const base = "flex gap-2 px-4 py-2 rounded-[var(--radius-lg)] transition";
  const active =
    "bg-[var(--color-accent)] text-[var(--color-accent-foreground)]";
  const idle =
    "hover:bg-[var(--color-accent)] hover:text-[var(--color-accent-foreground)]";

  return (
    <ul className={`flex flex-col gap-1 ${className ?? ""}`}>
      <li>
        <NavLink
          to="overview"
          end
          className={({ isActive }) => `${base} ${isActive ? active : idle}`}
        >
          
          <LayoutDashboard className="h-6 w-6" />
           Overview
           
        </NavLink>
      </li>
      <li>
        <NavLink
          to="timeregister"
          className={({ isActive }) => `${base} ${isActive ? active : idle} `}
        >
          <Clock className="h-6 w-6" /> Time register
        </NavLink>
      </li>
      <li>
        <NavLink
          to="timeoverveiw"
          className={({ isActive }) => `${base} ${isActive ? active : idle}`}
        >
          <CalendarRange className="h-6 w-6" /> Time overview
        </NavLink>
      </li>
        {role === "admin" &&  
        <li>
        <NavLink
          to="admin"
          className={({ isActive }) => `${base} ${isActive ? active : idle}`}
        >
          <ShieldCheck className="h-6 w-6" /> Admin
        </NavLink>
      </li>
        }
      
    </ul>
  );
};
