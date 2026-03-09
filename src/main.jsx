import React from 'react'
import ReactDOM from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { AuthProvider } from './context/AuthContext.jsx'

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

const root = (
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        {clientId ? (
          <GoogleOAuthProvider clientId={clientId}>
            <App />
          </GoogleOAuthProvider>
        ) : (
          <App />
        )}
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
)

ReactDOM.createRoot(document.getElementById('root')).render(root)
