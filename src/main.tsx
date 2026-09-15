import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './app/router'
import { db, ensureAppDefaults } from './data/appDatabase'
import { initCatalogSeeding } from './catalog/catalogReadiness'
import { I18nProvider } from './i18n/I18nContext'
import './styles/tokens.css'
import './styles/fonts.css'
import './styles/global.css'

initCatalogSeeding(db)
void ensureAppDefaults()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <RouterProvider router={router} />
    </I18nProvider>
  </StrictMode>,
)
