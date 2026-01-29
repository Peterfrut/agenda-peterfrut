"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"


export function ToggleTheme() {
  const { theme, setTheme } = useTheme()

  // Esta função irá alternar o tema com base no tema atual.
  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light"
    setTheme(newTheme)
  }

  return (

    <div 
      onClick={toggleTheme}
      className="flex items-center justify-center"
    >
      {/*
        - Se o tema atual for 'light', mostramos o ícone da 'Moon' para indicar que o clique irá para 'dark'.
        - Se o tema atual for 'dark', mostramos o ícone do 'Sun' para indicar que o clique irá para 'light'.
      */}
      {theme === "light" ? (
        <Moon className="h-4 w-4 text-muted-foreground hover:text-primary cursor-pointer transition-colors duration-150" />
      ) : (
        <Sun className="h-4 w-4 text-muted-foreground hover:text-primary cursor-pointer transition-colors duration-150" />
      )}
      
      <span className="sr-only">Toggle theme</span>
    </div>
  )
}