import './style.css'
import './config.js'
import { initSentry, setupGlobalErrorHandlers } from './utils/sentry.js'
import App from './App.js'

// Initialize Sentry error tracking (configure DSN in window.SENTRY_CONFIG or src/utils/sentry.js)
initSentry();
setupGlobalErrorHandlers();

const app = document.getElementById('app')
app.appendChild(App())
