import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { ConfirmHost } from './components/ConfirmDialog'
import { I18nProvider } from './lib/i18n'
import { ThemeProvider } from './lib/theme'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <I18nProvider>
        <App />
        <ConfirmHost />
      </I18nProvider>
    </ThemeProvider>
  </StrictMode>,
)
