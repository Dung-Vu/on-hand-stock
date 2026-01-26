import './style.css'
import './config.js'
import { initSentry, setupGlobalErrorHandlers } from './utils/sentry.js'
import { initAnalytics } from './utils/analytics.js'
import App from './App.js'

// Initialize Sentry error tracking (configure DSN in window.SENTRY_CONFIG or src/utils/sentry.js)
initSentry();
setupGlobalErrorHandlers();

// Initialize performance monitoring
initAnalytics();

const app = document.getElementById('app')
app.appendChild(App())
