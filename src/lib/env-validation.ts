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
  ai: {
    geminiApiKey: string;
    timeoutMs: number;
  };
  app: {
    name: string;
    env: string;
  };
  upload: {
    maxFileSizeMB: number;
    maxFilesPerCapsule: number;
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
  VITE_GEMINI_API_KEY: '',
  VITE_APP_NAME: 'Memory Capsule AI',
  VITE_APP_ENV: 'development',
  VITE_MAX_FILE_SIZE_MB: '50',
  VITE_MAX_FILES_PER_CAPSULE: '10',
  VITE_AI_TIMEOUT_MS: '30000',
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
    ai: {
      geminiApiKey: getEnvVar('VITE_GEMINI_API_KEY', OPTIONAL_ENV_VARS.VITE_GEMINI_API_KEY),
      timeoutMs: parseInt(getEnvVar('VITE_AI_TIMEOUT_MS', OPTIONAL_ENV_VARS.VITE_AI_TIMEOUT_MS), 10),
    },
    app: {
      name: getEnvVar('VITE_APP_NAME', OPTIONAL_ENV_VARS.VITE_APP_NAME),
      env: getEnvVar('VITE_APP_ENV', OPTIONAL_ENV_VARS.VITE_APP_ENV),
    },
    upload: {
      maxFileSizeMB: parseInt(getEnvVar('VITE_MAX_FILE_SIZE_MB', OPTIONAL_ENV_VARS.VITE_MAX_FILE_SIZE_MB), 10),
      maxFilesPerCapsule: parseInt(getEnvVar('VITE_MAX_FILES_PER_CAPSULE', OPTIONAL_ENV_VARS.VITE_MAX_FILES_PER_CAPSULE), 10),
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
    console.log(`  Max File Size: ${getEnvVar('VITE_MAX_FILE_SIZE_MB', OPTIONAL_ENV_VARS.VITE_MAX_FILE_SIZE_MB)}MB`);
    console.log(`  AI Timeout: ${getEnvVar('VITE_AI_TIMEOUT_MS', OPTIONAL_ENV_VARS.VITE_AI_TIMEOUT_MS)}ms`);
  }
}
