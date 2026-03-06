import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'

// Register service worker with auto-update
const updateSW = registerSW({
  onNeedRefresh() {
    // Show a prompt to reload when new version is available
    if (confirm('New version available! Reload to update?')) {
      updateSW(true)
    }
  },
  onOfflineReady() {
    console.log('App ready to work offline')
  },
  onRegisteredSW(swUrl, r) {
    console.log('Service Worker registered:', swUrl)

    // Check for updates every hour
    r && setInterval(() => {
      r.update()
    }, 60 * 60 * 1000)
  },
  onRegisterError(error) {
    console.error('Service Worker registration failed:', error)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
