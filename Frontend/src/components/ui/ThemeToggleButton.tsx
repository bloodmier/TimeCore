import { useEffect, useState } from "react"
import { Moon, Sun } from "lucide-react"
import { Button } from "./button"


export function ThemeToggleButton() {
  const [isDark, setIsDark] = useState(false)


  useEffect(() => {
    const stored = localStorage.getItem("theme")
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches

    const shouldBeDark = stored === "dark" || (!stored && prefersDark)
    document.documentElement.classList.toggle("dark", shouldBeDark)
    setIsDark(shouldBeDark)
  }, [])

  const toggleTheme = () => {
    const newDark = !isDark
    setIsDark(newDark)
    document.documentElement.classList.toggle("dark", newDark)
    localStorage.setItem("theme", newDark ? "dark" : "light")
  }

  return (
    <Button variant="outline" size="sm" onClick={toggleTheme} className="ml-auto">
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </Button>
  )
}
