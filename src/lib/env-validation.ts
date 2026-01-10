/**
 * Environment Variable Validation
 * 
 * This module validates that all required environment variables are present
 * and properly configured before the application starts.
 */

interface EnvConfig {
  firebase: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
    measurementId: string;
  };
  app: {
    name: string;
    env: string;
  };
}

/**
 * Required environment variables
 */
const REQUIRED_ENV_VARS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
  'VITE_FIREBASE_MEASUREMENT_ID',
] as const;

/**
 * Optional environment variables with defaults
 */
const OPTIONAL_ENV_VARS = {
  VITE_APP_NAME: 'Memory Capsule',
  VITE_APP_ENV: 'development',
} as const;

/**
 * Validates that all required environment variables are present
 * @throws Error if any required environment variable is missing
 */
export function validateEnvironment(): void {
  const missingVars: string[] = [];

  for (const varName of REQUIRED_ENV_VARS) {
    if (!import.meta.env[varName]) {
      missingVars.push(varName);
    }
  }

  if (missingVars.length > 0) {
    const errorMessage = `
❌ Missing required environment variables:

${missingVars.map(v => `  - ${v}`).join('\n')}

Please ensure you have created a .env file with all required variables.
You can copy .env.example as a starting point:

  cp .env.example .env

Then fill in the required values.
    `.trim();

    throw new Error(errorMessage);
  }
}

/**
 * Gets an environment variable value with optional default
 */
function getEnvVar(key: string, defaultValue?: string): string {
  const value = import.meta.env[key];
  if (value === undefined || value === '') {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Environment variable ${key} is not defined`);
  }
  return value;
}

/**
 * Gets the validated environment configuration
 * @returns Typed environment configuration object
 */
export function getEnvConfig(): EnvConfig {
  validateEnvironment();

  return {
    firebase: {
      apiKey: getEnvVar('VITE_FIREBASE_API_KEY'),
      authDomain: getEnvVar('VITE_FIREBASE_AUTH_DOMAIN'),
      projectId: getEnvVar('VITE_FIREBASE_PROJECT_ID'),
      storageBucket: getEnvVar('VITE_FIREBASE_STORAGE_BUCKET'),
      messagingSenderId: getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID'),
      appId: getEnvVar('VITE_FIREBASE_APP_ID'),
      measurementId: getEnvVar('VITE_FIREBASE_MEASUREMENT_ID'),
    },
    app: {
      name: getEnvVar('VITE_APP_NAME', OPTIONAL_ENV_VARS.VITE_APP_NAME),
      env: getEnvVar('VITE_APP_ENV', OPTIONAL_ENV_VARS.VITE_APP_ENV),
    },
  };
}

/**
 * Checks if the application is running in development mode
 */
export function isDevelopment(): boolean {
  return import.meta.env.DEV || getEnvVar('VITE_APP_ENV', 'development') === 'development';
}

/**
 * Checks if the application is running in production mode
 */
export function isProduction(): boolean {
  return import.meta.env.PROD || getEnvVar('VITE_APP_ENV', 'development') === 'production';
}

/**
 * Logs environment configuration (without sensitive data) for debugging
 */
export function logEnvironmentInfo(): void {
  if (isDevelopment()) {
    console.log('🔧 Environment Configuration:');
    console.log(`  App Name: ${getEnvVar('VITE_APP_NAME', OPTIONAL_ENV_VARS.VITE_APP_NAME)}`);
    console.log(`  Environment: ${getEnvVar('VITE_APP_ENV', OPTIONAL_ENV_VARS.VITE_APP_ENV)}`);
    console.log(`  Firebase Project: ${getEnvVar('VITE_FIREBASE_PROJECT_ID')}`);
  }
}
