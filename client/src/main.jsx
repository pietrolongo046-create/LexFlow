import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom' 
import './index.css'
import App from './App.jsx'

/**
 * HashRouter è essenziale per Electron perché i file vengono caricati 
 * tramite protocollo file:// invece di http://.
 */
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)