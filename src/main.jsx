import React from 'react'
import ReactDOM from 'react-dom/client'
import ErrorBoundary from '@/components/ui/ErrorBoundary'
import App from '@/App.jsx'
import '@/index.css'

// Global error handlers — show errors on screen for mobile debugging
const errorLog = [];
function showError(msg) {
  errorLog.push(msg);
  let el = document.getElementById('__mobile_errors');
  if (!el) {
    el = document.createElement('div');
    el.id = '__mobile_errors';
    el.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#1a0000;border-bottom:2px solid #ef4444;padding:8px 12px;max-height:40vh;overflow:auto;font-family:monospace;font-size:11px;color:#fbbf24;white-space:pre-wrap;word-break:break-all;';
    document.body.prepend(el);
  }
  el.textContent = errorLog.join('\n---\n');
}

window.onerror = function(msg, src, line, col, err) {
  showError(`[onerror] ${msg}\nat ${src}:${line}:${col}\n${err?.stack || ''}`);
};

window.onunhandledrejection = function(e) {
  showError(`[unhandled promise] ${e.reason?.message || e.reason}\n${e.reason?.stack || ''}`);
};

try {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
} catch (e) {
  showError(`[render crash] ${e.message}\n${e.stack}`);
}
