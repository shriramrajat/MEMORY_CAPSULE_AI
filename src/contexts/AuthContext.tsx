
import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  updateProfile,
  sendPasswordResetEmail,
  sendEmailVerification,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from 'firebase/auth';
import { auth } from '@/integrations/firebase/config';
import { CapsuleEncryption } from '@/lib/encryption';
import { NotificationService } from '@/lib/notification-service';

interface User {
  id: string;
  email: string;
  created_at: string;
  emailVerified: boolean;
}

interface AuthContextType {
  user: User | null;
  userKey: CryptoKey | null;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  refreshUser: () => Promise<void>;
  loading: boolean;
  sessionExpired: boolean;
  intendedDestination: string | null;
  setIntendedDestination: (destination: string | null) => void;
  clearSessionExpired: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userKey, setUserKey] = useState<CryptoKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [storedPassword, setStoredPassword] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [intendedDestination, setIntendedDestination] = useState<string | null>(null);

  useEffect(() => {
    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      const wasLoggedIn = user !== null;
      
      if (firebaseUser) {
        setUser({
          id: firebaseUser.uid,
          email: firebaseUser.email!,
          created_at: firebaseUser.metadata.creationTime || new Date().toISOString(),
          emailVerified: firebaseUser.emailVerified,
        });

        // If we have a stored password, generate the encryption key
        if (storedPassword) {
          const encryptionKey = await CapsuleEncryption.getUserEncryptionKey(
            firebaseUser.uid,
            storedPassword
          );
          setUserKey(encryptionKey);
        }
        
        // Clear session expired flag on successful authentication
        setSessionExpired(false);
      } else {
        // Detect session expiration: user was logged in but now is not
        if (wasLoggedIn && !loading) {
          setSessionExpired(true);
        }
        
        setUser(null);
        setUserKey(null);
        setStoredPassword(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [storedPassword, user, loading]);

  const signUp = async (email: string, password: string, name: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    // Update user profile with display name
    if (userCredential.user) {
      await updateProfile(userCredential.user, {
        displayName: name,
      });

      // Send email verification link
      await sendEmailVerification(userCredential.user);

      // Store password temporarily to generate encryption key
      setStoredPassword(password);
      
      // Generate encryption key for new user
      const encryptionKey = await CapsuleEncryption.getUserEncryptionKey(
        userCredential.user.uid,
        password
      );
      setUserKey(encryptionKey);
    }
  };

  const signIn = async (email: string, password: string, rememberMe: boolean = false) => {
    // Set persistence based on Remember Me checkbox
    // LOCAL persistence: session persists across browser restarts
    // SESSION persistence: session only lasts until browser/tab is closed
    await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
    
    const userCredential = await signInWithEmailAndPassword(auth, email, password);

    // Store password temporarily to generate encryption key
    setStoredPassword(password);

    // Generate encryption key for existing user
    if (userCredential.user) {
      const encryptionKey = await CapsuleEncryption.getUserEncryptionKey(
        userCredential.user.uid,
        password
      );
      setUserKey(encryptionKey);

      // Request notification permissions on login (non-blocking)
      NotificationService.requestPermissions().catch(err => {
        console.error('Failed to request notification permissions:', err);
      });
    }
    
    // Clear session expired flag on successful login
    setSessionExpired(false);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setUserKey(null);
    setStoredPassword(null);
  };

  const resetPassword = async (email: string) => {
    // Validate email format before sending reset
    const trimmedEmail = email?.trim() || '';
    const atIndex = trimmedEmail.indexOf('@');
    
    // Check for basic email structure: local@domain
    if (!trimmedEmail || atIndex <= 0 || atIndex >= trimmedEmail.length - 1) {
      throw new Error('Please enter a valid email address');
    }

    try {
      await sendPasswordResetEmail(auth, trimmedEmail);
    } catch (error) {
      // Handle specific Firebase errors
      const firebaseError = error as { code?: string; message?: string };
      if (firebaseError.code === 'auth/user-not-found') {
        throw new Error('No account found with this email address');
      } else if (firebaseError.code === 'auth/invalid-email') {
        throw new Error('Please enter a valid email address');
      } else if (firebaseError.code === 'auth/network-request-failed') {
        throw new Error('Network error. Please check your connection and try again');
      } else {
        throw new Error('Failed to send password reset email. Please try again');
      }
    }
  };

  const resendVerificationEmail = async () => {
    if (!auth.currentUser) {
      throw new Error('No user is currently signed in');
    }

    if (auth.currentUser.emailVerified) {
      throw new Error('Email is already verified');
    }

    try {
      await sendEmailVerification(auth.currentUser);
    } catch (error) {
      const firebaseError = error as { code?: string };
      if (firebaseError.code === 'auth/too-many-requests') {
        throw new Error('Too many requests. Please wait a few minutes before trying again');
      } else {
        throw new Error('Failed to send verification email. Please try again');
      }
    }
  };

  const refreshUser = async () => {
    // Force reload the current user from Firebase Auth
    if (auth.currentUser) {
      await auth.currentUser.reload();
      const firebaseUser = auth.currentUser;
      setUser({
        id: firebaseUser.uid,
        email: firebaseUser.email!,
        created_at: firebaseUser.metadata.creationTime || new Date().toISOString(),
        emailVerified: firebaseUser.emailVerified,
      });
    }
  };

  const clearSessionExpired = () => {
    setSessionExpired(false);
  };

  const value = {
    user,
    userKey,
    signUp,
    signIn,
    signOut,
    resetPassword,
    resendVerificationEmail,
    refreshUser,
    loading,
    sessionExpired,
    intendedDestination,
    setIntendedDestination,
    clearSessionExpired,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
