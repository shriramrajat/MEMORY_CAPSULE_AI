/**
 * Password strength validation utilities
 */

export type PasswordStrength = 'weak' | 'medium' | 'strong';

export interface PasswordValidationResult {
  isValid: boolean;
  strength: PasswordStrength;
  errors: string[];
  checks: {
    minLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumber: boolean;
    hasSpecialChar: boolean;
  };
}

/**
 * Validates password strength according to security requirements
 * Requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
export function validatePasswordStrength(password: string): PasswordValidationResult {
  const errors: string[] = [];
  
  // Check minimum length
  const minLength = password.length >= 8;
  if (!minLength) {
    errors.push('Password must be at least 8 characters long');
  }

  // Check for uppercase letter
  const hasUppercase = /[A-Z]/.test(password);
  if (!hasUppercase) {
    errors.push('Password must contain at least one uppercase letter');
  }

  // Check for lowercase letter
  const hasLowercase = /[a-z]/.test(password);
  if (!hasLowercase) {
    errors.push('Password must contain at least one lowercase letter');
  }

  // Check for number
  const hasNumber = /[0-9]/.test(password);
  if (!hasNumber) {
    errors.push('Password must contain at least one number');
  }

  // Check for special character
  const hasSpecialChar = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);
  if (!hasSpecialChar) {
    errors.push('Password must contain at least one special character');
  }

  const checks = {
    minLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
    hasSpecialChar,
  };

  // Determine strength based on number of checks passed
  const checksPassedCount = Object.values(checks).filter(Boolean).length;
  let strength: PasswordStrength;
  
  if (checksPassedCount === 5) {
    strength = 'strong';
  } else if (checksPassedCount >= 3) {
    strength = 'medium';
  } else {
    strength = 'weak';
  }

  const isValid = checksPassedCount === 5;

  return {
    isValid,
    strength,
    errors,
    checks,
  };
}

/**
 * Get password requirements as a list of strings
 */
export function getPasswordRequirements(): string[] {
  return [
    'At least 8 characters long',
    'Contains at least one uppercase letter (A-Z)',
    'Contains at least one lowercase letter (a-z)',
    'Contains at least one number (0-9)',
    'Contains at least one special character (!@#$%^&*...)',
  ];
}
