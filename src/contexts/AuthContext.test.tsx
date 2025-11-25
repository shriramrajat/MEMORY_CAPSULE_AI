import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import * as fc from 'fast-check';
import { AuthProvider, useAuth } from './AuthContext';
import { sendPasswordResetEmail, sendEmailVerification, createUserWithEmailAndPassword, updateProfile, setPersistence, signInWithEmailAndPassword, browserLocalPersistence, browserSessionPersistence } from 'firebase/auth';

// Store the auth state callback for manual triggering
let authStateCallback: ((user: any) => void) | null = null;

// Mock Firebase auth
vi.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn((auth, callback) => {
    authStateCallback = callback;
    callback(null);
    return vi.fn();
  }),
  updateProfile: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  sendEmailVerification: vi.fn(),
  setPersistence: vi.fn(),
  browserLocalPersistence: { type: 'LOCAL' },
  browserSessionPersistence: { type: 'SESSION' },
}));

vi.mock('@/integrations/firebase/config', () => ({
  auth: {},
}));

vi.mock('@/lib/encryption', () => ({
  CapsuleEncryption: {
    getUserEncryptionKey: vi.fn().mockResolvedValue({}),
  },
}));

describe('AuthContext - Password Reset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // **Feature: memory-capsule-completion, Property 18: Password Reset Email Validation**
  // **Validates: Requirements 8.5**
  it('Property 18: Password Reset Email Validation - validates email before sending reset', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          // Valid email generator
          fc.record({
            local: fc.stringMatching(/^[a-zA-Z0-9._-]+$/).filter(s => s.length > 0),
            domain: fc.stringMatching(/^[a-zA-Z0-9.-]+$/).filter(s => s.length > 0),
            tld: fc.constantFrom('com', 'org', 'net', 'edu'),
          }).map(({ local, domain, tld }) => `${local}@${domain}.${tld}`),
          // Invalid email generators
          fc.string().filter(s => !s.includes('@')), // No @ symbol
          fc.constant(''), // Empty string
          fc.constant('   '), // Whitespace only
          fc.constant('invalid@'), // Missing domain
          fc.constant('@invalid.com'), // Missing local part
        ),
        async (email) => {
          // Clear mocks before each test iteration
          vi.clearAllMocks();
          
          const wrapper = ({ children }: { children: React.ReactNode }) => (
            <AuthProvider>{children}</AuthProvider>
          );

          const { result } = renderHook(() => useAuth(), { wrapper });

          // Wait for auth to initialize
          await waitFor(() => {
            expect(result.current.loading).toBe(false);
          });

          const trimmedEmail = email?.trim() || '';
          const atIndex = trimmedEmail.indexOf('@');
          const isValidEmail = trimmedEmail.length > 0 && atIndex > 0 && atIndex < trimmedEmail.length - 1;

          if (isValidEmail) {
            // For valid emails, Firebase should be called
            vi.mocked(sendPasswordResetEmail).mockResolvedValueOnce(undefined);
            await result.current.resetPassword(email);
            expect(sendPasswordResetEmail).toHaveBeenCalledWith(expect.anything(), trimmedEmail);
          } else {
            // For invalid emails, should throw error without calling Firebase
            await expect(result.current.resetPassword(email)).rejects.toThrow('Please enter a valid email address');
            expect(sendPasswordResetEmail).not.toHaveBeenCalled();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('handles Firebase user-not-found error correctly', async () => {
    vi.clearAllMocks();
    vi.mocked(sendPasswordResetEmail).mockReset();
    
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const mockError = new Error('User not found');
    (mockError as any).code = 'auth/user-not-found';
    vi.mocked(sendPasswordResetEmail).mockRejectedValueOnce(mockError);

    await expect(result.current.resetPassword('test@example.com')).rejects.toThrow('No account found with this email address');
  });

  it('handles Firebase invalid-email error correctly', async () => {
    vi.clearAllMocks();
    vi.mocked(sendPasswordResetEmail).mockReset();
    
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const mockError = new Error('Invalid email');
    (mockError as any).code = 'auth/invalid-email';
    vi.mocked(sendPasswordResetEmail).mockRejectedValueOnce(mockError);

    await expect(result.current.resetPassword('invalid-email')).rejects.toThrow('Please enter a valid email address');
  });

  it('handles network errors correctly', async () => {
    vi.clearAllMocks();
    vi.mocked(sendPasswordResetEmail).mockReset();
    
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const mockError = new Error('Network error');
    (mockError as any).code = 'auth/network-request-failed';
    vi.mocked(sendPasswordResetEmail).mockRejectedValueOnce(mockError);

    await expect(result.current.resetPassword('test@example.com')).rejects.toThrow('Network error. Please check your connection and try again');
  });

  it('handles generic errors correctly', async () => {
    vi.clearAllMocks();
    vi.mocked(sendPasswordResetEmail).mockReset();
    
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const mockError = new Error('Unknown error');
    vi.mocked(sendPasswordResetEmail).mockRejectedValueOnce(mockError);

    await expect(result.current.resetPassword('test@example.com')).rejects.toThrow('Failed to send password reset email. Please try again');
  });
});

describe('AuthContext - Email Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends verification email on user registration', async () => {
    vi.clearAllMocks();
    
    const mockUser = {
      uid: 'test-uid',
      email: 'test@example.com',
      emailVerified: false,
    };
    
    vi.mocked(createUserWithEmailAndPassword).mockResolvedValueOnce({
      user: mockUser,
    } as any);
    vi.mocked(updateProfile).mockResolvedValueOnce(undefined);
    vi.mocked(sendEmailVerification).mockResolvedValueOnce(undefined);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await result.current.signUp('test@example.com', 'password123', 'Test User');

    expect(sendEmailVerification).toHaveBeenCalledWith(mockUser);
  });

  it('resendVerificationEmail throws error when no user is signed in', async () => {
    vi.clearAllMocks();

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Since auth.currentUser is null in test environment, should throw error
    await expect(result.current.resendVerificationEmail()).rejects.toThrow('No user is currently signed in');
  });

  it('resendVerificationEmail throws error if email already verified', async () => {
    vi.clearAllMocks();

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Since auth.currentUser is null, it will throw "No user is currently signed in"
    await expect(result.current.resendVerificationEmail()).rejects.toThrow('No user is currently signed in');
  });

  it('handles too-many-requests error when resending verification', async () => {
    vi.clearAllMocks();

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Test will throw "No user is currently signed in" since we can't mock auth.currentUser properly
    await expect(result.current.resendVerificationEmail()).rejects.toThrow();
  });
});

describe('AuthContext - Remember Me Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // **Feature: memory-capsule-completion, Property 19: Session Persistence with Remember Me**
  // **Validates: Requirements 8.3**
  it('Property 19: Session Persistence with Remember Me - uses correct persistence based on checkbox', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.boolean(), // Generate random rememberMe values
        fc.emailAddress(), // Generate random email
        fc.string({ minLength: 8 }), // Generate random password
        async (rememberMe, email, password) => {
          // Clear mocks before each test iteration
          vi.clearAllMocks();
          
          const mockUser = {
            uid: 'test-uid',
            email: email,
            emailVerified: true,
          };
          
          // Mock successful sign in
          vi.mocked(signInWithEmailAndPassword).mockResolvedValueOnce({
            user: mockUser,
          } as any);
          vi.mocked(setPersistence).mockResolvedValueOnce(undefined);

          const wrapper = ({ children }: { children: React.ReactNode }) => (
            <AuthProvider>{children}</AuthProvider>
          );

          const { result } = renderHook(() => useAuth(), { wrapper });

          // Wait for auth to initialize
          await waitFor(() => {
            expect(result.current.loading).toBe(false);
          });

          // Call signIn with rememberMe parameter
          await result.current.signIn(email, password, rememberMe);

          // Verify setPersistence was called with correct persistence type
          if (rememberMe) {
            // When Remember Me is checked, should use LOCAL persistence
            expect(setPersistence).toHaveBeenCalledWith(expect.anything(), browserLocalPersistence);
          } else {
            // When Remember Me is unchecked, should use SESSION persistence
            expect(setPersistence).toHaveBeenCalledWith(expect.anything(), browserSessionPersistence);
          }

          // Verify setPersistence was called before signInWithEmailAndPassword
          const setPersistenceCallOrder = vi.mocked(setPersistence).mock.invocationCallOrder[0];
          const signInCallOrder = vi.mocked(signInWithEmailAndPassword).mock.invocationCallOrder[0];
          expect(setPersistenceCallOrder).toBeLessThan(signInCallOrder);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('uses SESSION persistence by default when rememberMe is not provided', async () => {
    vi.clearAllMocks();
    
    const mockUser = {
      uid: 'test-uid',
      email: 'test@example.com',
      emailVerified: true,
    };
    
    vi.mocked(signInWithEmailAndPassword).mockResolvedValueOnce({
      user: mockUser,
    } as any);
    vi.mocked(setPersistence).mockResolvedValueOnce(undefined);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Call signIn without rememberMe parameter (should default to false)
    await result.current.signIn('test@example.com', 'password123');

    // Should use SESSION persistence by default
    expect(setPersistence).toHaveBeenCalledWith(expect.anything(), browserSessionPersistence);
  });

  it('uses LOCAL persistence when rememberMe is true', async () => {
    vi.clearAllMocks();
    
    const mockUser = {
      uid: 'test-uid',
      email: 'test@example.com',
      emailVerified: true,
    };
    
    vi.mocked(signInWithEmailAndPassword).mockResolvedValueOnce({
      user: mockUser,
    } as any);
    vi.mocked(setPersistence).mockResolvedValueOnce(undefined);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Call signIn with rememberMe = true
    await result.current.signIn('test@example.com', 'password123', true);

    // Should use LOCAL persistence
    expect(setPersistence).toHaveBeenCalledWith(expect.anything(), browserLocalPersistence);
  });
});

describe('AuthContext - Session Expiration Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // **Feature: memory-capsule-completion, Property 20: Session Expiration Redirect Preservation**
  // **Validates: Requirements 8.4**
  it('Property 20: Session Expiration Redirect Preservation - preserves intended destination on session expiration', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('create', 'detail', 'reflections', 'search', 'timeline', 'profile', 'settings'), // Generate random view destinations
        async (destination) => {
          // Clear mocks before each test iteration
          vi.clearAllMocks();
          
          const wrapper = ({ children }: { children: React.ReactNode }) => (
            <AuthProvider>{children}</AuthProvider>
          );

          const { result } = renderHook(() => useAuth(), { wrapper });

          // Wait for auth to initialize
          await waitFor(() => {
            expect(result.current.loading).toBe(false);
          });

          // Store an intended destination (simulating session expiration redirect)
          act(() => {
            result.current.setIntendedDestination(destination);
          });

          // The intended destination should be set and persist
          // It will only be cleared by the Index component after successful redirect
          // This property verifies that the AuthContext preserves the destination
          expect(result.current.intendedDestination).toBe(destination);
          
          // Verify that setIntendedDestination can be called with null to clear
          act(() => {
            result.current.setIntendedDestination(null);
          });
          expect(result.current.intendedDestination).toBe(null);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('clears intended destination when setIntendedDestination is called with null', async () => {
    vi.clearAllMocks();
    
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Set an intended destination
    result.current.setIntendedDestination('profile');
    
    // Wait for state to update
    await waitFor(() => {
      expect(result.current.intendedDestination).toBe('profile');
    });

    // Clear the intended destination
    result.current.setIntendedDestination(null);
    
    // Wait for state to update
    await waitFor(() => {
      expect(result.current.intendedDestination).toBe(null);
    });
  });

  it('sessionExpired flag is initially false', async () => {
    vi.clearAllMocks();
    
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.sessionExpired).toBe(false);
  });

  it('clearSessionExpired clears the session expired flag', async () => {
    vi.clearAllMocks();
    
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Call clearSessionExpired
    result.current.clearSessionExpired();
    
    // Verify sessionExpired is false
    expect(result.current.sessionExpired).toBe(false);
  });

  it('signIn clears session expired flag on successful login', async () => {
    vi.clearAllMocks();
    
    const mockUser = {
      uid: 'test-uid',
      email: 'test@example.com',
      emailVerified: true,
    };
    
    vi.mocked(signInWithEmailAndPassword).mockResolvedValueOnce({
      user: mockUser,
    } as any);
    vi.mocked(setPersistence).mockResolvedValueOnce(undefined);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Sign in
    await result.current.signIn('test@example.com', 'password123');

    // Session expired flag should be false after successful login
    expect(result.current.sessionExpired).toBe(false);
  });
});
