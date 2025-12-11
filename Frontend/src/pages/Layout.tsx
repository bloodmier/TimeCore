import { Link, NavLink, Outlet } from "react-router-dom";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { ThemeToggleButton } from "../components/ui/ThemeToggleButton";
import Logo from "../assets/logo.png";
import { useAuth } from "../context/AuthContext";

export function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isAuthenticated, logout } = useAuth();

  const theme = (localStorage.getItem("theme") as "light" | "dark") || "light";

  const NavLinks = ({ onClick }: { onClick?: () => void }) => (
    <>
      {isAuthenticated ? (
        <NavLink
          to="/login"
          onClick={logout}
          className={({ isActive }) =>
            `text-sm font-medium md:text-center ${
              isActive ? "text-primary" : "text-muted-foreground"
            } hover:text-primary transition-colors`
          }
        >
          Logout
        </NavLink>
      ) : (
        <NavLink
          to="/login"
          onClick={onClick}
          className={({ isActive }) =>
            `text-sm font-medium md:text-center ${
              isActive ? "text-primary" : "text-muted-foreground"
            } hover:text-primary transition-colors`
          }
        >
          Login
        </NavLink>
      )}

      {isAuthenticated && (
        <NavLink
          to="/account"
          onClick={onClick}
          className={({ isActive }) =>
            `text-sm font-medium md:text-center ${
              isActive ? "text-primary" : "text-muted-foreground"
            } hover:text-primary transition-colors`
          }
        >
          Account
        </NavLink>
      )}
    </>
  );

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header
        className={`fixed w-full top-0 left-0 z-50 border-b border-border px-6 py-4 shadow-sm ${
          theme === "light" ? "bg-background/80" : "bg-background/60"
        } backdrop-blur`}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center"
            aria-label="Home page"
            title="Home page"
          >
           <div className="relative inline-block w-15 h-15">
  {/* Grå logga – bakgrund, statisk */}
  <img
    src={Logo}
    alt="TimeCore logo"
    className="absolute h-15 inset-0  object-contain tc-logo-gray"
  />

  {/* Färg-logga – ligger ovanpå och fylls från höger */}
  <img
    src={Logo}
    alt=""
    aria-hidden="true"
    className="absolute inset-0  h-15 object-contain tc-logo-fill"
  />
</div>
            <h1
              className="tc-logo text-4xl font-extrabold tracking-tight"
              data-text="TimeCore"
            >
              TimeCore
            </h1>
          </Link>
          <div className="flex items-center gap-6">
            <nav className="flex max-md:hidden gap-6  items-center">
              <NavLinks />
            </nav>
            <div className="flex items-center gap-2">
              <button
                className="inline-flex items-center justify-center rounded-md p-2 md:hidden border border-border"
                onClick={() => setMobileOpen((prev) => !prev)}
                aria-label={mobileOpen ? "Close main menu" : "Open main menu"}
                aria-expanded={mobileOpen}
                aria-controls="main-nav"
              >
                {mobileOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </button>
              <ThemeToggleButton />
            </div>
          </div>
        </div>
        {mobileOpen && (
          <div className="md:hidden mt-2 border border-border bg-background rounded-lg shadow-lg">
            <div className="flex flex-col gap-3 px-6 py-4">
              <NavLinks
                onClick={() => setMobileOpen(false)}
                aria-label="Open main menu"
              />
            </div>
          </div>
        )}
      </header>
      <main className="flex-1 w-full max-w-6xl mx-auto mt-24 px-4">
        <Outlet />
      </main>
    </div>
  );
}
