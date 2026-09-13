import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './app/router'
import { db, ensureAppDefaults } from './data/appDatabase'
import { initCatalogSeeding } from './catalog/catalogReadiness'
import './styles/tokens.css'
import './styles/global.css'

initCatalogSeeding(db)
void ensureAppDefaults()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
