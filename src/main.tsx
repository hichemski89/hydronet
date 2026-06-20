/*
 * HydroNet — Modélisation et simulation des réseaux d'eau
 * © 2026 NovaSoft — Tous droits réservés. Logiciel propriétaire.
 * Toute copie, distribution ou ingénierie inverse non autorisée est interdite.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
