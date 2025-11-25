import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { validatePasswordStrength, getPasswordRequirements } from './password-validation';

describe('Password Validation', () => {
  describe('Unit Tests', () => {
    it('should reject password shorter than 8 characters', () => {
      const result = validatePasswordStrength('Abc1!');
      expect(result.isValid).toBe(false);
      expect(result.checks.minLength).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    it('should reject password without uppercase letter', () => {
      const result = validatePasswordStrength('abcdefgh1!');
      expect(result.isValid).toBe(false);
      expect(result.checks.hasUppercase).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should reject password without lowercase letter', () => {
      const result = validatePasswordStrength('ABCDEFGH1!');
      expect(result.isValid).toBe(false);
      expect(result.checks.hasLowercase).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('should reject password without number', () => {
      const result = validatePasswordStrength('Abcdefgh!');
      expect(result.isValid).toBe(false);
      expect(result.checks.hasNumber).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('should reject password without special character', () => {
      const result = validatePasswordStrength('Abcdefgh1');
      expect(result.isValid).toBe(false);
      expect(result.checks.hasSpecialChar).toBe(false);
      expect(result.errors).toContain('Password must contain at least one special character');
    });

    it('should accept valid strong password', () => {
      const result = validatePasswordStrength('Abcdefgh1!');
      expect(result.isValid).toBe(true);
      expect(result.strength).toBe('strong');
      expect(result.errors).toHaveLength(0);
      expect(result.checks.minLength).toBe(true);
      expect(result.checks.hasUppercase).toBe(true);
      expect(result.checks.hasLowercase).toBe(true);
      expect(result.checks.hasNumber).toBe(true);
      expect(result.checks.hasSpecialChar).toBe(true);
    });

    it('should classify password with 3-4 checks as medium', () => {
      const result = validatePasswordStrength('abcdefgh1!'); // missing uppercase
      expect(result.strength).toBe('medium');
      expect(result.isValid).toBe(false);
    });

    it('should classify password with less than 3 checks as weak', () => {
      const result = validatePasswordStrength('abcdefgh'); // only lowercase and length
      expect(result.strength).toBe('weak');
      expect(result.isValid).toBe(false);
    });

    it('should return password requirements list', () => {
      const requirements = getPasswordRequirements();
      expect(requirements).toHaveLength(5);
      expect(requirements[0]).toContain('8 characters');
      expect(requirements[1]).toContain('uppercase');
      expect(requirements[2]).toContain('lowercase');
      expect(requirements[3]).toContain('number');
      expect(requirements[4]).toContain('special character');
    });
  });

  describe('Property-Based Tests', () => {
    // **Feature: memory-capsule-completion, Property 29: Password Strength Validation**
    // **Validates: Requirements 11.1**
    it('Property 29: Password Strength Validation - For any password, validation should check strength requirements and display appropriate feedback', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 50 }),
          (password) => {
            const result = validatePasswordStrength(password);

            // Property 1: Result should always have all required fields
            expect(result).toHaveProperty('isValid');
            expect(result).toHaveProperty('strength');
            expect(result).toHaveProperty('errors');
            expect(result).toHaveProperty('checks');

            // Property 2: Checks should be consistent with password content
            const hasMinLength = password.length >= 8;
            const hasUppercase = /[A-Z]/.test(password);
            const hasLowercase = /[a-z]/.test(password);
            const hasNumber = /[0-9]/.test(password);
            const hasSpecialChar = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);

            expect(result.checks.minLength).toBe(hasMinLength);
            expect(result.checks.hasUppercase).toBe(hasUppercase);
            expect(result.checks.hasLowercase).toBe(hasLowercase);
            expect(result.checks.hasNumber).toBe(hasNumber);
            expect(result.checks.hasSpecialChar).toBe(hasSpecialChar);

            // Property 3: isValid should be true only when all checks pass
            const allChecksPassed = hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecialChar;
            expect(result.isValid).toBe(allChecksPassed);

            // Property 4: Errors array should contain exactly one error per failed check
            const checksPassedCount = [hasMinLength, hasUppercase, hasLowercase, hasNumber, hasSpecialChar].filter(Boolean).length;
            const expectedErrorCount = 5 - checksPassedCount;
            expect(result.errors).toHaveLength(expectedErrorCount);

            // Property 5: Strength should be consistent with number of checks passed
            if (checksPassedCount === 5) {
              expect(result.strength).toBe('strong');
            } else if (checksPassedCount >= 3) {
              expect(result.strength).toBe('medium');
            } else {
              expect(result.strength).toBe('weak');
            }

            // Property 6: If password is valid, there should be no errors
            if (result.isValid) {
              expect(result.errors).toHaveLength(0);
            }

            // Property 7: If password is invalid, there should be at least one error
            if (!result.isValid) {
              expect(result.errors.length).toBeGreaterThan(0);
            }

            // Property 8: Each failed check should have a corresponding error message
            if (!hasMinLength) {
              expect(result.errors.some(e => e.includes('8 characters'))).toBe(true);
            }
            if (!hasUppercase) {
              expect(result.errors.some(e => e.includes('uppercase'))).toBe(true);
            }
            if (!hasLowercase) {
              expect(result.errors.some(e => e.includes('lowercase'))).toBe(true);
            }
            if (!hasNumber) {
              expect(result.errors.some(e => e.includes('number'))).toBe(true);
            }
            if (!hasSpecialChar) {
              expect(result.errors.some(e => e.includes('special character'))).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property: Valid passwords always pass all checks', () => {
      // Generator for valid passwords
      const validPasswordArbitrary = fc.tuple(
        fc.array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), { minLength: 1, maxLength: 10 }),
        fc.array(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')), { minLength: 1, maxLength: 10 }),
        fc.array(fc.constantFrom(...'0123456789'.split('')), { minLength: 1, maxLength: 10 }),
        fc.array(fc.constantFrom(...'!@#$%^&*()_+-=[]{};\':"|,.<>/?'.split('')), { minLength: 1, maxLength: 10 }),
        fc.string({ minLength: 0, maxLength: 10 }) // padding to ensure min length
      ).map(([lower, upper, number, special, padding]) => {
        const combined = lower.join('') + upper.join('') + number.join('') + special.join('') + padding;
        // Ensure at least 8 characters
        return combined.length >= 8 ? combined : combined + 'Aa1!0000';
      });

      fc.assert(
        fc.property(validPasswordArbitrary, (password) => {
          const result = validatePasswordStrength(password);

          // All valid passwords should pass validation
          expect(result.isValid).toBe(true);
          expect(result.strength).toBe('strong');
          expect(result.errors).toHaveLength(0);
          expect(result.checks.minLength).toBe(true);
          expect(result.checks.hasUppercase).toBe(true);
          expect(result.checks.hasLowercase).toBe(true);
          expect(result.checks.hasNumber).toBe(true);
          expect(result.checks.hasSpecialChar).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('Property: Passwords missing any requirement should be invalid', () => {
      // Generator for passwords missing at least one requirement
      const invalidPasswordArbitrary = fc.oneof(
        // Too short
        fc.string({ minLength: 0, maxLength: 7 }),
        // No uppercase
        fc.array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'.split('')), { minLength: 8, maxLength: 20 }).map(arr => arr.join('')),
        // No lowercase
        fc.array(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'.split('')), { minLength: 8, maxLength: 20 }).map(arr => arr.join('')),
        // No number
        fc.array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%^&*'.split('')), { minLength: 8, maxLength: 20 }).map(arr => arr.join('')),
        // No special character
        fc.array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')), { minLength: 8, maxLength: 20 }).map(arr => arr.join(''))
      );

      fc.assert(
        fc.property(invalidPasswordArbitrary, (password) => {
          const result = validatePasswordStrength(password);

          // All invalid passwords should fail validation
          expect(result.isValid).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });
  });
});
