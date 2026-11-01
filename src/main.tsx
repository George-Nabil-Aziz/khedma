import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { ConfirmHost } from './components/ConfirmDialog'
import { ToastHost } from './components/Toast'
import { I18nProvider } from './lib/i18n'
import { ThemeProvider } from './lib/theme'
import './lib/install' // catch the browser's install offer early, for الإعدادات

// The app always opens on الأولاد, whatever page it was left on — except a birthday
// notification's link to one child (push-sw.js).
if (!/^#\/child\/[\w-]+$/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <I18nProvider>
        <App />
        <ConfirmHost />
        <ToastHost />
      </I18nProvider>
    </ThemeProvider>
  </StrictMode>,
)
