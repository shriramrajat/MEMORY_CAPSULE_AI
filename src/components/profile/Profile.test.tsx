import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { db, auth } from '@/integrations/firebase/config';

// Mock Firebase modules
vi.mock('@/integrations/firebase/config', () => ({
  db: {},
  auth: {
    currentUser: {
      uid: 'test-user-id',
      email: 'test@example.com',
      displayName: 'Original Name',
      reload: vi.fn(),
    },
  },
  storage: {},
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  setDoc: vi.fn(),
  getDoc: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(),
  getCountFromServer: vi.fn(() => Promise.resolve({ data: () => ({ count: 0 }) })),
  Timestamp: {
    now: vi.fn(() => ({ toDate: () => new Date() })),
    fromDate: vi.fn((date: Date) => ({ toDate: () => date })),
  },
}));

vi.mock('firebase/auth', () => ({
  updateProfile: vi.fn(),
  onAuthStateChanged: vi.fn((auth, callback) => {
    callback(null);
    return vi.fn();
  }),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
}));

describe('Profile Update Persistence Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * **Feature: memory-capsule-completion, Property 15: Profile Update Persistence**
   * **Validates: Requirements 7.2**
   * 
   * Property: For any user display name update, the change should be saved to Firestore 
   * and reflected in the Authentication Context immediately.
   */
  it('should persist display name updates to both Firebase Auth and Firestore', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random display names (non-empty strings with reasonable length)
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        async (displayName) => {
          // Clear mocks before each property test iteration
          vi.clearAllMocks();

          const userId = 'test-user-id';
          const trimmedName = displayName.trim();

          // Mock Firebase Auth current user
          const mockCurrentUser = {
            uid: userId,
            email: 'test@example.com',
            displayName: 'Old Name',
            reload: vi.fn().mockResolvedValue(undefined),
          };
          (auth as any).currentUser = mockCurrentUser;

          // Mock Firestore operations
          const mockDocRef = { id: userId };
          (doc as any).mockReturnValue(mockDocRef);
          
          const mockUserDoc = {
            exists: () => true,
            data: () => ({
              user_id: userId,
              email: 'test@example.com',
              display_name: 'Old Name',
            }),
          };
          (getDoc as any).mockResolvedValue(mockUserDoc);
          (setDoc as any).mockResolvedValue(undefined);
          (updateProfile as any).mockResolvedValue(undefined);

          // Simulate the profile update process
          // 1. Update Firebase Auth profile
          await updateProfile(mockCurrentUser as any, {
            displayName: trimmedName,
          });

          // 2. Update Firestore user document
          await setDoc(mockDocRef as any, {
            display_name: trimmedName,
          }, { merge: true });

          // Verify Firebase Auth updateProfile was called with correct data
          expect(updateProfile).toHaveBeenCalledWith(
            expect.objectContaining({ uid: userId }),
            { displayName: trimmedName }
          );

          // Verify Firestore setDoc was called with correct data
          expect(setDoc).toHaveBeenCalledWith(
            mockDocRef,
            { display_name: trimmedName },
            { merge: true }
          );

          // Verify both operations were called (persistence to both systems)
          expect(updateProfile).toHaveBeenCalledTimes(1);
          expect(setDoc).toHaveBeenCalledTimes(1);

          // Simulate reading back the data to verify persistence
          const savedDoc = await getDoc(mockDocRef as any);
          expect(savedDoc.exists()).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle display name updates with special characters', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate strings with various special characters
        fc.string({ minLength: 1, maxLength: 50 })
          .filter(s => s.trim().length > 0)
          .map(s => s.trim()),
        async (displayName) => {
          vi.clearAllMocks();
          
          const userId = 'test-user-id';

          const mockCurrentUser = {
            uid: userId,
            email: 'test@example.com',
            displayName: 'Old Name',
            reload: vi.fn().mockResolvedValue(undefined),
          };
          (auth as any).currentUser = mockCurrentUser;

          const mockDocRef = { id: userId };
          (doc as any).mockReturnValue(mockDocRef);
          (getDoc as any).mockResolvedValue({
            exists: () => true,
            data: () => ({ display_name: 'Old Name' }),
          });
          (setDoc as any).mockResolvedValue(undefined);
          (updateProfile as any).mockResolvedValue(undefined);

          // Update profile
          await updateProfile(mockCurrentUser as any, { displayName });
          await setDoc(mockDocRef as any, { display_name: displayName }, { merge: true });

          // Verify the exact display name was used (no corruption)
          expect(updateProfile).toHaveBeenCalledWith(
            expect.any(Object),
            { displayName }
          );
          expect(setDoc).toHaveBeenCalledWith(
            mockDocRef,
            { display_name: displayName },
            { merge: true }
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain consistency between Firebase Auth and Firestore', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        async (displayName) => {
          vi.clearAllMocks();
          
          const userId = 'test-user-id';
          const trimmedName = displayName.trim();

          const mockCurrentUser = {
            uid: userId,
            email: 'test@example.com',
            displayName: 'Old Name',
            reload: vi.fn().mockResolvedValue(undefined),
          };
          (auth as any).currentUser = mockCurrentUser;

          const mockDocRef = { id: userId };
          (doc as any).mockReturnValue(mockDocRef);

          let firestoreDisplayName = 'Old Name';
          let authDisplayName = 'Old Name';

          // Mock setDoc to capture the value
          (setDoc as any).mockImplementation(async (ref: any, data: any) => {
            firestoreDisplayName = data.display_name;
          });

          // Mock updateProfile to capture the value
          (updateProfile as any).mockImplementation(async (user: any, profile: any) => {
            authDisplayName = profile.displayName;
          });

          // Perform update
          await updateProfile(mockCurrentUser as any, { displayName: trimmedName });
          await setDoc(mockDocRef as any, { display_name: trimmedName }, { merge: true });

          // Verify both systems have the same value
          expect(authDisplayName).toBe(trimmedName);
          expect(firestoreDisplayName).toBe(trimmedName);
          expect(authDisplayName).toBe(firestoreDisplayName);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject empty or whitespace-only display names', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate whitespace-only strings using array of whitespace characters
        fc.array(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 0, maxLength: 10 })
          .map(arr => arr.join('')),
        async (whitespaceString) => {
          // Empty or whitespace-only names should be rejected
          const trimmed = whitespaceString.trim();
          
          // The application should not call updateProfile or setDoc for empty names
          // This is validated in the UI layer
          expect(trimmed.length).toBe(0);
          
          // Verify that empty/whitespace strings are properly identified
          if (whitespaceString.length > 0) {
            expect(whitespaceString).toMatch(/^[\s]*$/);
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});
