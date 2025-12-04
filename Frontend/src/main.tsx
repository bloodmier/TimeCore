import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { RouterProvider } from 'react-router'
import { Router } from './Router'
import { AuthProvider } from "./context/AuthContext";

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={Router} />
    </AuthProvider>
  </StrictMode>,
)
