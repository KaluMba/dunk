import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import RivalsApp from './RivalsApp.jsx'

function Root() {
  const [page, setPage] = useState(() =>
    window.location.hash === '#rivals' ? 'rivals' : 'main'
  )

  useEffect(() => {
    const onHash = () => setPage(window.location.hash === '#rivals' ? 'rivals' : 'main')
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  return page === 'rivals' ? <RivalsApp /> : <App />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
