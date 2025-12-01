import { NavLink, Outlet } from "react-router-dom"
import { useState } from "react"
import { Menu, X } from "lucide-react"
import { ThemeToggleButton } from "../components/ui/ThemeToggleButton"
import reactLogo from "../assets/react.svg"
export function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false)

  const theme =
    (localStorage.getItem("theme") as "light" | "dark") || "light"

  const NavLinks = ({ onClick }: { onClick?: () => void }) => (
    <>
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
    </>
  )

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header
        className={`fixed w-full top-0 left-0 z-50 border-b border-border px-6 py-4 shadow-sm ${
          theme === "light" ? "bg-background/80" : "bg-background/60"
        } backdrop-blur`}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            {theme === "light" ? (
              <img src={reactLogo} className="h-10" />
            ) : (
              <img src={reactLogo} className="h-10" />
            )}
          </a>
          <nav className="hidden md:flex gap-6 items-center">
            <NavLinks />
          </nav>
          <div className="flex items-center gap-2">
            <button
              className="inline-flex items-center justify-center rounded-md p-2 md:hidden border border-border"
              onClick={() => setMobileOpen((prev) => !prev)}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <ThemeToggleButton />
          </div>
        </div>
        {mobileOpen && (
          <div className="md:hidden mt-2 border border-border bg-background rounded-lg shadow-lg">
            <div className="flex flex-col gap-3 px-6 py-4">
              <NavLinks onClick={() => setMobileOpen(false)} />
            </div>
          </div>
        )}
      </header>
      <main className="flex-1 w-full max-w-6xl mx-auto mt-24 px-4">
        <Outlet />
      </main>
    </div>
  )
}
