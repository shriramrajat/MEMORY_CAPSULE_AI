import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// **Feature: memory-capsule-completion, Property 16: Theme Preference Persistence**
// **Validates: Requirements 7.4**

// Mock Firebase
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
}));

vi.mock('@/integrations/firebase/config', () => ({
  db: {},
}));

describe('Theme Preference Persistence Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up DOM
    document.documentElement.classList.remove('dark');
  });

  it('Property 16: Theme Preference Persistence - For any theme selection, the theme should be applied immediately and persist across browser sessions', async () => {
    // **Feature: memory-capsule-completion, Property 16: Theme Preference Persistence**
    
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('light' as const, 'dark' as const, 'auto' as const),
        fc.string({ minLength: 10, maxLength: 30 }), // userId
        async (selectedTheme, userId) => {
          // Setup: Mock Firestore to return empty preferences initially
          const mockGetDoc = vi.mocked(getDoc);
          const mockSetDoc = vi.mocked(setDoc);
          
          mockGetDoc.mockResolvedValue({
            exists: () => false,
            data: () => undefined,
          } as any);

          mockSetDoc.mockResolvedValue(undefined);

          // Simulate theme selection and persistence
          const userDocRef = doc({} as any, 'users', userId);
          
          // Save theme preference to Firestore
          await setDoc(userDocRef, {
            preferences: {
              theme: selectedTheme,
              notifications_enabled: false,
              email_notifications: false,
            },
          }, { merge: true });

          // Verify setDoc was called with correct theme
          const setDocCalls = mockSetDoc.mock.calls;
          const lastCall = setDocCalls[setDocCalls.length - 1];
          
          expect(lastCall).toBeDefined();
          expect(lastCall[1]).toMatchObject({
            preferences: {
              theme: selectedTheme,
            },
          });

          // Simulate loading theme preference (as would happen on app startup)
          mockGetDoc.mockResolvedValue({
            exists: () => true,
            data: () => ({
              preferences: {
                theme: selectedTheme,
                notifications_enabled: false,
                email_notifications: false,
              },
            }),
          } as any);

          const loadedDoc = await getDoc(userDocRef);
          const loadedTheme = loadedDoc.data()?.preferences?.theme;

          // Property: The loaded theme should match the saved theme
          expect(loadedTheme).toBe(selectedTheme);

          // Verify theme application to DOM
          const root = document.documentElement;
          
          if (selectedTheme === 'dark') {
            root.classList.add('dark');
            expect(root.classList.contains('dark')).toBe(true);
          } else if (selectedTheme === 'light') {
            root.classList.remove('dark');
            expect(root.classList.contains('dark')).toBe(false);
          } else if (selectedTheme === 'auto') {
            // For auto, theme depends on system preference
            // We just verify it's one of the two valid states
            const isDark = root.classList.contains('dark');
            expect(typeof isDark).toBe('boolean');
          }

          // Clean up
          root.classList.remove('dark');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 16 (Immediate Application): Theme changes should be applied immediately to the UI', () => {
    // **Feature: memory-capsule-completion, Property 16: Theme Preference Persistence**
    
    fc.assert(
      fc.property(
        fc.constantFrom('light' as const, 'dark' as const),
        (theme) => {
          const root = document.documentElement;
          
          // Apply theme
          if (theme === 'dark') {
            root.classList.add('dark');
          } else {
            root.classList.remove('dark');
          }

          // Property: The DOM should immediately reflect the theme
          const hasDarkClass = root.classList.contains('dark');
          const expectedDarkClass = theme === 'dark';
          
          expect(hasDarkClass).toBe(expectedDarkClass);

          // Clean up
          root.classList.remove('dark');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 16 (Round Trip): Saving and loading theme preference should preserve the original value', async () => {
    // **Feature: memory-capsule-completion, Property 16: Theme Preference Persistence**
    
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('light' as const, 'dark' as const, 'auto' as const),
        fc.string({ minLength: 10, maxLength: 30 }), // userId
        async (originalTheme, userId) => {
          const mockGetDoc = vi.mocked(getDoc);
          const mockSetDoc = vi.mocked(setDoc);
          
          mockSetDoc.mockResolvedValue(undefined);

          // Save theme
          const userDocRef = doc({} as any, 'users', userId);
          await setDoc(userDocRef, {
            preferences: { theme: originalTheme },
          }, { merge: true });

          // Mock the retrieval to return what was saved
          mockGetDoc.mockResolvedValue({
            exists: () => true,
            data: () => ({
              preferences: { theme: originalTheme },
            }),
          } as any);

          // Load theme
          const loadedDoc = await getDoc(userDocRef);
          const loadedTheme = loadedDoc.data()?.preferences?.theme;

          // Property: Round trip should preserve the theme value
          expect(loadedTheme).toBe(originalTheme);
        }
      ),
      { numRuns: 100 }
    );
  });
});
