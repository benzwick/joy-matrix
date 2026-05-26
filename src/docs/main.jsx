import React from 'react'
import ReactDOM from 'react-dom/client'
import { ThemeProvider } from '../ui/theme.jsx'
import DocsApp from './DocsApp.jsx'
import DocsChat from './DocsChat.jsx'
import '../index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <DocsApp />
      <DocsChat />
    </ThemeProvider>
  </React.StrictMode>,
)
