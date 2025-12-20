import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import './lib/fix-profile' // Expose fixProfile to window
import { initViewportHeight } from './lib/viewport'

// Initialize viewport height tracking for iOS Safari
initViewportHeight();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
