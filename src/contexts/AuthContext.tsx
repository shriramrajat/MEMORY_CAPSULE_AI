
import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  updateProfile
} from 'firebase/auth';
import { auth } from '@/integrations/firebase/config';
import { CapsuleEncryption } from '@/lib/encryption';

interface User {
  id: string;
  email: string;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  userKey: CryptoKey | null;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  loading: boolean;
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

  useEffect(() => {
    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        setUser({
          id: firebaseUser.uid,
          email: firebaseUser.email!,
          created_at: firebaseUser.metadata.creationTime || new Date().toISOString(),
        });

        // If we have a stored password, generate the encryption key
        if (storedPassword) {
          const encryptionKey = await CapsuleEncryption.getUserEncryptionKey(
            firebaseUser.uid,
            storedPassword
          );
          setUserKey(encryptionKey);
        }
      } else {
        setUser(null);
        setUserKey(null);
        setStoredPassword(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [storedPassword]);

  const signUp = async (email: string, password: string, name: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    // Update user profile with display name
    if (userCredential.user) {
      await updateProfile(userCredential.user, {
        displayName: name,
      });

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

  const signIn = async (email: string, password: string) => {
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
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setUserKey(null);
    setStoredPassword(null);
  };

  const value = {
    user,
    userKey,
    signUp,
    signIn,
    signOut,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
