import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { validateEnvironment, logEnvironmentInfo } from './lib/env-validation'

// Validate environment variables before starting the application
try {
  validateEnvironment();
  logEnvironmentInfo();
} catch (error) {
  console.error('Environment validation failed:', error);
  // Display error to user
  document.getElementById('root')!.innerHTML = `
    <div style="padding: 2rem; font-family: system-ui, -apple-system, sans-serif;">
      <h1 style="color: #dc2626; margin-bottom: 1rem;">⚠️ Configuration Error</h1>
      <pre style="background: #fee; padding: 1rem; border-radius: 0.5rem; overflow-x: auto;">${error instanceof Error ? error.message : String(error)}</pre>
    </div>
  `;
  throw error;
}

createRoot(document.getElementById("root")!).render(<App />);
