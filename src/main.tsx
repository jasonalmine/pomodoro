import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { crumb, installErrorCrumbs } from './lib/breadcrumb'

installErrorCrumbs()
crumb('boot', 'main')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
