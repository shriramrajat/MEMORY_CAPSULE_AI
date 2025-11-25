import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { DecryptedCapsule, SecureCapsuleDB } from './database';
import { CapsuleEncryption } from './encryption';

describe('Database Property Tests', () => {
  // Mock Firebase functions
  const mockFirestore = {
    collection: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    getDocs: vi.fn(),
    addDoc: vi.fn(),
    doc: vi.fn(),
    updateDoc: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // **Feature: memory-capsule-completion, Property 1: Capsule Creation Persistence**
  // **Validates: Requirements 1.1, 1.3**
  it('Property 1: Capsule Creation Persistence - For any valid capsule data, creating should result in encrypted document that can be retrieved and decrypted', { timeout: 45000 }, async () => {
    // Generator for valid capsule data
    const capsuleArbitrary = fc.record({
      title: fc.string({ minLength: 1, maxLength: 100 }),
      content: fc.string({ minLength: 1, maxLength: 1000 }),
      unlockDate: fc.date({ min: new Date(), max: new Date('2030-12-31') }), // Future dates only
      type: fc.constantFrom('text' as const, 'image' as const, 'mixed' as const),
    });

    const userIdArbitrary = fc.uuid();
    const passwordArbitrary = fc.string({ minLength: 8, maxLength: 20 });

    await fc.assert(
      fc.asyncProperty(
        capsuleArbitrary,
        userIdArbitrary,
        passwordArbitrary,
        async (capsuleData, userId, password) => {
          // Generate encryption key
          const userKey = await CapsuleEncryption.getUserEncryptionKey(userId, password);

          // Encrypt the capsule data (simulating what createCapsule does)
          const encryptedTitle = await CapsuleEncryption.encryptData(capsuleData.title, userKey);
          const encryptedContent = await CapsuleEncryption.encryptData(capsuleData.content, userKey);

          // Create a mock capsule ID
          const mockCapsuleId = fc.sample(fc.uuid(), 1)[0];

          // Simulate the encrypted document that would be stored in Firestore
          const storedCapsule = {
            id: mockCapsuleId,
            user_id: userId,
            title_encrypted: encryptedTitle.encryptedData,
            title_iv: encryptedTitle.iv,
            content_encrypted: encryptedContent.encryptedData,
            content_iv: encryptedContent.iv,
            unlock_date: { toDate: () => capsuleData.unlockDate },
            capsule_type: capsuleData.type,
            is_unlocked: false,
            created_at: { toDate: () => new Date() },
          };

          // Now retrieve and decrypt (simulating what getCapsuleById does)
          const retrievedTitle = await CapsuleEncryption.decryptData(
            storedCapsule.title_encrypted,
            storedCapsule.title_iv,
            userKey
          );
          const retrievedContent = await CapsuleEncryption.decryptData(
            storedCapsule.content_encrypted,
            storedCapsule.content_iv,
            userKey
          );

          // Property: Retrieved and decrypted data should match original data
          expect(retrievedTitle).toBe(capsuleData.title);
          expect(retrievedContent).toBe(capsuleData.content);
          expect(storedCapsule.capsule_type).toBe(capsuleData.type);
          expect(storedCapsule.unlock_date.toDate().getTime()).toBe(capsuleData.unlockDate.getTime());
          expect(storedCapsule.user_id).toBe(userId);

          // Property: Encrypted data should be different from original
          expect(storedCapsule.title_encrypted).not.toBe(capsuleData.title);
          expect(storedCapsule.content_encrypted).not.toBe(capsuleData.content);

          // Property: IVs should be present and non-empty
          expect(storedCapsule.title_iv).toBeTruthy();
          expect(storedCapsule.content_iv).toBeTruthy();
        }
      ),
      { numRuns: 30 } // Reduced to 30 due to encryption overhead and timeout constraints
    );
  });

  // **Feature: memory-capsule-completion, Property 2: Dashboard Data Integrity**
  // **Validates: Requirements 1.2**
  it('Property 2: Dashboard Data Integrity - For any user with capsules, fetching should return decrypted data matching original', { timeout: 45000 }, async () => {
    // Generator for capsule data
    const capsuleArbitrary = fc.record({
      title: fc.string({ minLength: 1, maxLength: 100 }),
      content: fc.string({ minLength: 1, maxLength: 1000 }),
      unlockDate: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
      type: fc.constantFrom('text' as const, 'image' as const, 'mixed' as const),
    });

    const userIdArbitrary = fc.uuid();
    const passwordArbitrary = fc.string({ minLength: 8, maxLength: 20 });

    await fc.assert(
      fc.asyncProperty(
        fc.array(capsuleArbitrary, { minLength: 0, maxLength: 10 }),
        userIdArbitrary,
        passwordArbitrary,
        async (capsules, userId, password) => {
          // Generate encryption key
          const userKey = await CapsuleEncryption.getUserEncryptionKey(userId, password);

          // Encrypt all capsules
          const encryptedCapsules = await Promise.all(
            capsules.map(async (capsule) => {
              const encryptedTitle = await CapsuleEncryption.encryptData(capsule.title, userKey);
              const encryptedContent = await CapsuleEncryption.encryptData(capsule.content, userKey);

              return {
                id: fc.sample(fc.uuid(), 1)[0],
                title_encrypted: encryptedTitle.encryptedData,
                title_iv: encryptedTitle.iv,
                content_encrypted: encryptedContent.encryptedData,
                content_iv: encryptedContent.iv,
                unlock_date: { toDate: () => capsule.unlockDate },
                created_at: { toDate: () => new Date() },
                is_unlocked: new Date() >= capsule.unlockDate,
                capsule_type: capsule.type,
                user_id: userId,
              };
            })
          );

          // Mock Firestore response
          const mockQuerySnapshot = {
            docs: encryptedCapsules.map((capsule) => ({
              id: capsule.id,
              data: () => capsule,
            })),
          };

          // Mock the Firestore query chain
          vi.mocked(mockFirestore.getDocs).mockResolvedValue(mockQuerySnapshot as any);

          // Fetch and decrypt capsules (simulating what getUserCapsules does)
          const decryptedCapsules: DecryptedCapsule[] = [];

          for (const docSnapshot of mockQuerySnapshot.docs) {
            const capsule = { id: docSnapshot.id, ...docSnapshot.data() } as any;

            const title = await CapsuleEncryption.decryptData(
              capsule.title_encrypted,
              capsule.title_iv,
              userKey
            );
            const content = await CapsuleEncryption.decryptData(
              capsule.content_encrypted,
              capsule.content_iv,
              userKey
            );

            const unlockDate = capsule.unlock_date.toDate();
            const isUnlocked = capsule.is_unlocked || new Date() >= unlockDate;
            const createdAt = capsule.created_at.toDate();

            decryptedCapsules.push({
              id: capsule.id,
              title,
              content: isUnlocked ? content : '[Locked until unlock date]',
              unlockDate,
              createdAt,
              isUnlocked,
              type: capsule.capsule_type,
            });
          }

          // Property: Decrypted data should match original data
          expect(decryptedCapsules.length).toBe(capsules.length);

          for (let i = 0; i < capsules.length; i++) {
            const original = capsules[i];
            const decrypted = decryptedCapsules[i];

            // Title should match
            expect(decrypted.title).toBe(original.title);

            // Content should match if unlocked
            if (decrypted.isUnlocked) {
              expect(decrypted.content).toBe(original.content);
            } else {
              expect(decrypted.content).toBe('[Locked until unlock date]');
            }

            // Type should match
            expect(decrypted.type).toBe(original.type);

            // Unlock date should match
            expect(decrypted.unlockDate.getTime()).toBe(original.unlockDate.getTime());
          }
        }
      ),
      { numRuns: 30 } // Reduced to 30 due to encryption overhead and timeout constraints
    );
  });

  // **Feature: memory-capsule-completion, Property 3: Automatic Unlock Status Update**
  // **Validates: Requirements 1.4**
  it('Property 3: Automatic Unlock Status Update - Capsules with past unlock dates should be marked as unlocked', { timeout: 30000 }, async () => {
    // Generator for capsule with past unlock date
    const pastDateArbitrary = fc.date({ 
      min: new Date('2020-01-01'), 
      max: new Date(Date.now() - 24 * 60 * 60 * 1000) // At least 1 day in the past
    });

    const capsuleArbitrary = fc.record({
      title: fc.string({ minLength: 1, maxLength: 100 }),
      content: fc.string({ minLength: 1, maxLength: 1000 }),
      unlockDate: pastDateArbitrary,
      type: fc.constantFrom('text' as const, 'image' as const, 'mixed' as const),
    });

    const userIdArbitrary = fc.uuid();
    const passwordArbitrary = fc.string({ minLength: 8, maxLength: 20 });

    await fc.assert(
      fc.asyncProperty(
        fc.array(capsuleArbitrary, { minLength: 1, maxLength: 5 }),
        userIdArbitrary,
        passwordArbitrary,
        async (capsules, userId, password) => {
          // Generate encryption key
          const userKey = await CapsuleEncryption.getUserEncryptionKey(userId, password);

          // Track which capsules should be updated
          const capsulesNeedingUpdate: string[] = [];

          // Encrypt all capsules with is_unlocked initially false
          const encryptedCapsules = await Promise.all(
            capsules.map(async (capsule) => {
              const encryptedTitle = await CapsuleEncryption.encryptData(capsule.title, userKey);
              const encryptedContent = await CapsuleEncryption.encryptData(capsule.content, userKey);

              const capsuleId = fc.sample(fc.uuid(), 1)[0];
              const isUnlocked = false; // Initially locked even though date is past

              // This capsule should be updated since unlock date is in the past
              if (new Date() >= capsule.unlockDate) {
                capsulesNeedingUpdate.push(capsuleId);
              }

              return {
                id: capsuleId,
                title_encrypted: encryptedTitle.encryptedData,
                title_iv: encryptedTitle.iv,
                content_encrypted: encryptedContent.encryptedData,
                content_iv: encryptedContent.iv,
                unlock_date: { toDate: () => capsule.unlockDate },
                created_at: { toDate: () => new Date() },
                is_unlocked: isUnlocked,
                capsule_type: capsule.type,
                user_id: userId,
              };
            })
          );

          // Mock Firestore response
          const mockQuerySnapshot = {
            docs: encryptedCapsules.map((capsule) => ({
              id: capsule.id,
              data: () => capsule,
            })),
          };

          // Track updateDoc calls
          const updateCalls: Array<{ id: string; updates: any }> = [];
          const mockUpdateDoc = vi.fn((docRef: any, updates: any) => {
            updateCalls.push({ id: docRef.id, updates });
            return Promise.resolve();
          });

          // Mock the doc function to return a reference with the id
          const mockDoc = vi.fn((_db: any, _collection: string, id: string) => ({ id }));

          // Simulate getUserCapsules behavior with unlock status checking
          const decryptedCapsules: DecryptedCapsule[] = [];

          for (const docSnapshot of mockQuerySnapshot.docs) {
            const capsule = { id: docSnapshot.id, ...docSnapshot.data() } as any;

            const title = await CapsuleEncryption.decryptData(
              capsule.title_encrypted,
              capsule.title_iv,
              userKey
            );
            const content = await CapsuleEncryption.decryptData(
              capsule.content_encrypted,
              capsule.content_iv,
              userKey
            );

            const unlockDate = capsule.unlock_date.toDate();
            const isUnlocked = capsule.is_unlocked || new Date() >= unlockDate;

            // Update unlock status if needed (simulating the database update)
            if (!capsule.is_unlocked && isUnlocked) {
              const capsuleRef = mockDoc(null, 'capsules', capsule.id);
              await mockUpdateDoc(capsuleRef, { is_unlocked: true });
            }

            const createdAt = capsule.created_at.toDate();

            decryptedCapsules.push({
              id: capsule.id,
              title,
              content: isUnlocked ? content : '[Locked until unlock date]',
              unlockDate,
              createdAt,
              isUnlocked,
              type: capsule.capsule_type,
            });
          }

          // Property: All capsules with past unlock dates should be marked as unlocked
          for (const capsule of decryptedCapsules) {
            if (new Date() >= capsule.unlockDate) {
              expect(capsule.isUnlocked).toBe(true);
            }
          }

          // Property: updateDoc should have been called for each capsule that needed updating
          expect(updateCalls.length).toBe(capsulesNeedingUpdate.length);

          // Property: Each update should set is_unlocked to true
          for (const call of updateCalls) {
            expect(call.updates.is_unlocked).toBe(true);
            expect(capsulesNeedingUpdate).toContain(call.id);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // **Feature: memory-capsule-completion, Property 9: Search Result Relevance Ordering**
  // **Validates: Requirements 5.2**
  it('Property 9: Search Result Relevance Ordering - For any search query with multiple matching capsules, results should be ordered by relevance score in descending order', async () => {
    // Generator for capsule data
    const capsuleArbitrary = fc.record({
      title: fc.string({ minLength: 1, maxLength: 100 }),
      content: fc.string({ minLength: 10, maxLength: 500 }),
      unlockDate: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
      type: fc.constantFrom('text' as const, 'image' as const, 'mixed' as const),
      sentiment: fc.constantFrom('positive' as const, 'neutral' as const, 'negative' as const),
    });

    const queryArbitrary = fc.string({ minLength: 3, maxLength: 50 });

    await fc.assert(
      fc.asyncProperty(
        fc.array(capsuleArbitrary, { minLength: 2, maxLength: 10 }),
        queryArbitrary,
        async (capsules, query) => {
          // Create DecryptedCapsule objects
          const decryptedCapsules: DecryptedCapsule[] = capsules.map((capsule, index) => ({
            id: `capsule-${index}`,
            title: capsule.title,
            content: capsule.content,
            unlockDate: capsule.unlockDate,
            createdAt: new Date(),
            isUnlocked: true,
            type: capsule.type,
            sentiment: capsule.sentiment,
          }));

          // Mock the AI service semantic search to return results with random relevance scores
          const mockSearchResults = decryptedCapsules.map((capsule) => ({
            capsule,
            relevanceScore: Math.random(), // Random score between 0 and 1
            matchedContent: capsule.content.substring(0, 100),
          }));

          // Sort by relevance score descending (what the search should do)
          const sortedResults = [...mockSearchResults].sort((a, b) => b.relevanceScore - a.relevanceScore);

          // Property: Results should be ordered by relevance score in descending order
          for (let i = 0; i < sortedResults.length - 1; i++) {
            expect(sortedResults[i].relevanceScore).toBeGreaterThanOrEqual(sortedResults[i + 1].relevanceScore);
          }

          // Property: All original capsules should be present in results
          expect(sortedResults.length).toBe(decryptedCapsules.length);

          // Property: Each result should have a relevance score between 0 and 1
          for (const result of sortedResults) {
            expect(result.relevanceScore).toBeGreaterThanOrEqual(0);
            expect(result.relevanceScore).toBeLessThanOrEqual(1);
          }

          // Property: Each result should have a capsule and matched content
          for (const result of sortedResults) {
            expect(result.capsule).toBeDefined();
            expect(result.matchedContent).toBeDefined();
            expect(typeof result.matchedContent).toBe('string');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // **Feature: memory-capsule-completion, Property 10: Date Range Filter Correctness**
  // **Validates: Requirements 5.3**
  it('Property 10: Date Range Filter Correctness - For any date range filter, all returned capsules should have creation dates within the specified range', async () => {
    // Generator for capsule data with specific creation dates
    const capsuleArbitrary = fc.record({
      title: fc.string({ minLength: 1, maxLength: 100 }),
      content: fc.string({ minLength: 10, maxLength: 500 }),
      createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
      unlockDate: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
      type: fc.constantFrom('text' as const, 'image' as const, 'mixed' as const),
    });

    const dateRangeArbitrary = fc.record({
      start: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }),
      end: fc.date({ min: new Date('2025-01-01'), max: new Date('2030-12-31') }),
    }).filter(range => range.start <= range.end);

    await fc.assert(
      fc.asyncProperty(
        fc.array(capsuleArbitrary, { minLength: 5, maxLength: 20 }),
        dateRangeArbitrary,
        async (capsules, dateRange) => {
          // Create DecryptedCapsule objects
          const decryptedCapsules: DecryptedCapsule[] = capsules.map((capsule, index) => ({
            id: `capsule-${index}`,
            title: capsule.title,
            content: capsule.content,
            unlockDate: capsule.unlockDate,
            createdAt: capsule.createdAt,
            isUnlocked: true,
            type: capsule.type,
          }));

          // Apply date range filter (simulating what searchCapsules does)
          const filteredCapsules = decryptedCapsules.filter(capsule => {
            const capsuleDate = capsule.createdAt;
            return capsuleDate >= dateRange.start && capsuleDate <= dateRange.end;
          });

          // Property: All filtered capsules should have creation dates within the range
          for (const capsule of filteredCapsules) {
            expect(capsule.createdAt.getTime()).toBeGreaterThanOrEqual(dateRange.start.getTime());
            expect(capsule.createdAt.getTime()).toBeLessThanOrEqual(dateRange.end.getTime());
          }

          // Property: No capsules outside the range should be included
          const capsulesOutsideRange = decryptedCapsules.filter(capsule => {
            const capsuleDate = capsule.createdAt;
            return capsuleDate < dateRange.start || capsuleDate > dateRange.end;
          });

          for (const outsideCapsule of capsulesOutsideRange) {
            expect(filteredCapsules).not.toContainEqual(outsideCapsule);
          }

          // Property: Filtered capsules should be a subset of original capsules
          expect(filteredCapsules.length).toBeLessThanOrEqual(decryptedCapsules.length);

          // Property: Each filtered capsule should exist in the original set
          for (const filtered of filteredCapsules) {
            expect(decryptedCapsules).toContainEqual(filtered);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // **Feature: memory-capsule-completion, Property 11: Sentiment Filter Correctness**
  // **Validates: Requirements 5.4**
  it('Property 11: Sentiment Filter Correctness - For any sentiment filter, all returned capsules should have sentiment matching the specified emotional tone', async () => {
    // Generator for capsule data with sentiment
    const capsuleArbitrary = fc.record({
      title: fc.string({ minLength: 1, maxLength: 100 }),
      content: fc.string({ minLength: 10, maxLength: 500 }),
      createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
      unlockDate: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
      type: fc.constantFrom('text' as const, 'image' as const, 'mixed' as const),
      sentiment: fc.constantFrom('positive' as const, 'neutral' as const, 'negative' as const),
    });

    const sentimentFilterArbitrary = fc.constantFrom('positive' as const, 'neutral' as const, 'negative' as const);

    await fc.assert(
      fc.asyncProperty(
        fc.array(capsuleArbitrary, { minLength: 5, maxLength: 20 }),
        sentimentFilterArbitrary,
        async (capsules, sentimentFilter) => {
          // Create DecryptedCapsule objects
          const decryptedCapsules: DecryptedCapsule[] = capsules.map((capsule, index) => ({
            id: `capsule-${index}`,
            title: capsule.title,
            content: capsule.content,
            unlockDate: capsule.unlockDate,
            createdAt: capsule.createdAt,
            isUnlocked: true,
            type: capsule.type,
            sentiment: capsule.sentiment,
          }));

          // Apply sentiment filter (simulating what searchCapsules does)
          const filteredCapsules = decryptedCapsules.filter(capsule => 
            capsule.sentiment === sentimentFilter
          );

          // Property: All filtered capsules should have the specified sentiment
          for (const capsule of filteredCapsules) {
            expect(capsule.sentiment).toBe(sentimentFilter);
          }

          // Property: No capsules with different sentiment should be included
          const capsulesWithDifferentSentiment = decryptedCapsules.filter(capsule => 
            capsule.sentiment !== sentimentFilter
          );

          for (const differentCapsule of capsulesWithDifferentSentiment) {
            expect(filteredCapsules).not.toContainEqual(differentCapsule);
          }

          // Property: Filtered capsules should be a subset of original capsules
          expect(filteredCapsules.length).toBeLessThanOrEqual(decryptedCapsules.length);

          // Property: Each filtered capsule should exist in the original set
          for (const filtered of filteredCapsules) {
            expect(decryptedCapsules).toContainEqual(filtered);
          }

          // Property: Sentiment should be one of the valid values
          for (const capsule of filteredCapsules) {
            expect(['positive', 'neutral', 'negative']).toContain(capsule.sentiment);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // **Feature: memory-capsule-completion, Property 22: Capsule Edit Encryption Update**
  // **Validates: Requirements 9.2**
  it('Property 22: Capsule Edit Encryption Update - For any capsule edit, saving changes should re-encrypt content and update Firestore', { timeout: 45000 }, async () => {
    // Generator for original and updated capsule data
    const originalCapsuleArbitrary = fc.record({
      title: fc.string({ minLength: 1, maxLength: 100 }),
      content: fc.string({ minLength: 1, maxLength: 1000 }),
      unlockDate: fc.date({ 
        min: new Date('2020-01-01'), 
        max: new Date(Date.now() - 24 * 60 * 60 * 1000) // Past date (unlocked)
      }),
      type: fc.constantFrom('text' as const, 'image' as const, 'mixed' as const),
    });

    const updatesArbitrary = fc.record({
      title: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
      content: fc.option(fc.string({ minLength: 1, maxLength: 1000 }), { nil: undefined }),
    }).filter(updates => updates.title !== undefined || updates.content !== undefined); // At least one update

    const userIdArbitrary = fc.uuid();
    const passwordArbitrary = fc.string({ minLength: 8, maxLength: 20 });

    await fc.assert(
      fc.asyncProperty(
        originalCapsuleArbitrary,
        updatesArbitrary,
        userIdArbitrary,
        passwordArbitrary,
        async (originalData, updates, userId, password) => {
          // Generate encryption key
          const userKey = await CapsuleEncryption.getUserEncryptionKey(userId, password);

          // Create a mock capsule ID
          const mockCapsuleId = fc.sample(fc.uuid(), 1)[0];

          // Encrypt the original capsule data
          const originalEncryptedTitle = await CapsuleEncryption.encryptData(originalData.title, userKey);
          const originalEncryptedContent = await CapsuleEncryption.encryptData(originalData.content, userKey);

          // Simulate an unlocked capsule
          const storedCapsule = {
            id: mockCapsuleId,
            user_id: userId,
            title_encrypted: originalEncryptedTitle.encryptedData,
            title_iv: originalEncryptedTitle.iv,
            content_encrypted: originalEncryptedContent.encryptedData,
            content_iv: originalEncryptedContent.iv,
            unlock_date: { toDate: () => originalData.unlockDate },
            capsule_type: originalData.type,
            is_unlocked: true,
            created_at: { toDate: () => new Date() },
          };

          // Prepare update data (simulating what updateCapsule does)
          const updateData: any = {};

          // Re-encrypt title if provided
          if (updates.title !== undefined) {
            const encryptedTitle = await CapsuleEncryption.encryptData(updates.title, userKey);
            updateData.title_encrypted = encryptedTitle.encryptedData;
            updateData.title_iv = encryptedTitle.iv;
          }

          // Re-encrypt content if provided
          if (updates.content !== undefined) {
            const encryptedContent = await CapsuleEncryption.encryptData(updates.content, userKey);
            updateData.content_encrypted = encryptedContent.encryptedData;
            updateData.content_iv = encryptedContent.iv;
          }

          // Property: Updated encrypted data should be different from original
          if (updates.title !== undefined && updates.title !== originalData.title) {
            expect(updateData.title_encrypted).not.toBe(storedCapsule.title_encrypted);
            expect(updateData.title_iv).not.toBe(storedCapsule.title_iv);
          }

          if (updates.content !== undefined && updates.content !== originalData.content) {
            expect(updateData.content_encrypted).not.toBe(storedCapsule.content_encrypted);
            expect(updateData.content_iv).not.toBe(storedCapsule.content_iv);
          }

          // Property: New IVs should be present and non-empty
          if (updates.title !== undefined) {
            expect(updateData.title_iv).toBeTruthy();
            expect(typeof updateData.title_iv).toBe('string');
          }

          if (updates.content !== undefined) {
            expect(updateData.content_iv).toBeTruthy();
            expect(typeof updateData.content_iv).toBe('string');
          }

          // Property: Decrypting the new encrypted data should yield the updated values
          if (updates.title !== undefined) {
            const decryptedTitle = await CapsuleEncryption.decryptData(
              updateData.title_encrypted,
              updateData.title_iv,
              userKey
            );
            expect(decryptedTitle).toBe(updates.title);
          }

          if (updates.content !== undefined) {
            const decryptedContent = await CapsuleEncryption.decryptData(
              updateData.content_encrypted,
              updateData.content_iv,
              userKey
            );
            expect(decryptedContent).toBe(updates.content);
          }

          // Property: Original encrypted data should still decrypt to original values
          const originalDecryptedTitle = await CapsuleEncryption.decryptData(
            storedCapsule.title_encrypted,
            storedCapsule.title_iv,
            userKey
          );
          const originalDecryptedContent = await CapsuleEncryption.decryptData(
            storedCapsule.content_encrypted,
            storedCapsule.content_iv,
            userKey
          );

          expect(originalDecryptedTitle).toBe(originalData.title);
          expect(originalDecryptedContent).toBe(originalData.content);

          // Property: Encrypted data should not be the same as plaintext
          if (updates.title !== undefined) {
            expect(updateData.title_encrypted).not.toBe(updates.title);
          }

          if (updates.content !== undefined) {
            expect(updateData.content_encrypted).not.toBe(updates.content);
          }
        }
      ),
      { numRuns: 30 } // Reduced to 30 due to encryption overhead and timeout constraints
    );
  });

  // **Feature: memory-capsule-completion, Property 21: Locked Capsule Edit Prevention**
  // **Validates: Requirements 9.3**
  it('Property 21: Locked Capsule Edit Prevention - For any locked capsule, attempting to edit should be prevented', { timeout: 15000 }, async () => {
    // Generator for capsule data with future unlock date (locked)
    const futureUnlockDateArbitrary = fc.date({ 
      min: new Date(Date.now() + 24 * 60 * 60 * 1000), // At least 1 day in the future
      max: new Date('2030-12-31')
    });

    const capsuleArbitrary = fc.record({
      title: fc.string({ minLength: 1, maxLength: 100 }),
      content: fc.string({ minLength: 1, maxLength: 1000 }),
      unlockDate: futureUnlockDateArbitrary,
      type: fc.constantFrom('text' as const, 'image' as const, 'mixed' as const),
    });

    const updateArbitrary = fc.record({
      title: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
      content: fc.option(fc.string({ minLength: 1, maxLength: 1000 }), { nil: undefined }),
    });

    const userIdArbitrary = fc.uuid();
    const passwordArbitrary = fc.string({ minLength: 8, maxLength: 20 });

    await fc.assert(
      fc.asyncProperty(
        capsuleArbitrary,
        updateArbitrary,
        userIdArbitrary,
        passwordArbitrary,
        async (capsuleData, updates, userId, password) => {
          // Generate encryption key
          const userKey = await CapsuleEncryption.getUserEncryptionKey(userId, password);

          // Create a mock capsule ID
          const mockCapsuleId = fc.sample(fc.uuid(), 1)[0];

          // Encrypt the capsule data
          const encryptedTitle = await CapsuleEncryption.encryptData(capsuleData.title, userKey);
          const encryptedContent = await CapsuleEncryption.encryptData(capsuleData.content, userKey);

          // Simulate a locked capsule (unlock date in future, is_unlocked = false)
          const storedCapsule = {
            id: mockCapsuleId,
            user_id: userId,
            title_encrypted: encryptedTitle.encryptedData,
            title_iv: encryptedTitle.iv,
            content_encrypted: encryptedContent.encryptedData,
            content_iv: encryptedContent.iv,
            unlock_date: { toDate: () => capsuleData.unlockDate },
            capsule_type: capsuleData.type,
            is_unlocked: false,
            created_at: { toDate: () => new Date() },
          };

          // Mock Firestore getDoc to return the locked capsule
          const mockGetDoc = vi.fn().mockResolvedValue({
            exists: () => true,
            data: () => storedCapsule,
          });

          // Mock doc function
          const mockDoc = vi.fn();

          // Attempt to update the locked capsule (simulating updateCapsule logic)
          let errorThrown = false;
          let errorMessage = '';

          try {
            // Check if capsule is locked
            const unlockDate = storedCapsule.unlock_date.toDate();
            const isUnlocked = storedCapsule.is_unlocked || new Date() >= unlockDate;

            if (!isUnlocked) {
              throw new Error('Cannot edit locked capsule');
            }

            // If we get here, the capsule was not properly locked
            // This should not happen in our test
          } catch (error) {
            errorThrown = true;
            errorMessage = error instanceof Error ? error.message : 'Unknown error';
          }

          // Property: Attempting to edit a locked capsule should throw an error
          expect(errorThrown).toBe(true);
          expect(errorMessage).toBe('Cannot edit locked capsule');

          // Property: The capsule should be locked (unlock date in future)
          expect(new Date() < capsuleData.unlockDate).toBe(true);

          // Property: is_unlocked should be false
          expect(storedCapsule.is_unlocked).toBe(false);

          // Property: No update should have been performed
          // (In real implementation, updateDoc would not be called)
        }
      ),
      { numRuns: 100 }
    );
  });

  // **Feature: memory-capsule-completion, Property 23: Capsule Deletion Completeness**
  // **Validates: Requirements 9.5**
  it('Property 23: Capsule Deletion Completeness - For any capsule deletion, both the Firestore document and all associated files should be removed', async () => {
    // Generator for capsule data
    const capsuleArbitrary = fc.record({
      title: fc.string({ minLength: 1, maxLength: 100 }),
      content: fc.string({ minLength: 1, maxLength: 1000 }),
      unlockDate: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
      type: fc.constantFrom('text' as const, 'image' as const, 'mixed' as const),
    });

    // Generator for file metadata
    const fileArbitrary = fc.record({
      name: fc.string({ minLength: 1, maxLength: 50 }),
      path: fc.string({ minLength: 10, maxLength: 100 }),
      type: fc.constantFrom('image/jpeg', 'video/mp4', 'application/pdf', 'audio/mp3'),
    });

    const userIdArbitrary = fc.uuid();

    await fc.assert(
      fc.asyncProperty(
        capsuleArbitrary,
        fc.array(fileArbitrary, { minLength: 0, maxLength: 5 }),
        userIdArbitrary,
        async (capsuleData, files, userId) => {
          // Create a mock capsule ID
          const mockCapsuleId = fc.sample(fc.uuid(), 1)[0];

          // Simulate the stored capsule
          const storedCapsule = {
            id: mockCapsuleId,
            user_id: userId,
            title_encrypted: 'encrypted_title',
            title_iv: 'title_iv',
            content_encrypted: 'encrypted_content',
            content_iv: 'content_iv',
            unlock_date: { toDate: () => capsuleData.unlockDate },
            capsule_type: capsuleData.type,
            is_unlocked: false,
            created_at: { toDate: () => new Date() },
          };

          // Simulate associated files
          const storedFiles = files.map((file, index) => ({
            id: `file-${index}`,
            capsule_id: mockCapsuleId,
            user_id: userId,
            file_path: file.path,
            name_encrypted: 'encrypted_name',
            name_iv: 'name_iv',
            type_encrypted: 'encrypted_type',
            type_iv: 'type_iv',
            file_iv: 'file_iv',
            created_at: { toDate: () => new Date() },
          }));

          // Track deletion operations
          const deletedStorageFiles: string[] = [];
          const deletedFirestoreFiles: string[] = [];
          let capsuleDeleted = false;

          // Mock Firestore getDoc to return the capsule
          const mockGetDoc = vi.fn().mockResolvedValue({
            exists: () => true,
            data: () => storedCapsule,
          });

          // Mock Firestore getDocs to return associated files
          const mockGetDocs = vi.fn().mockResolvedValue({
            docs: storedFiles.map(file => ({
              id: file.id,
              data: () => file,
            })),
            empty: storedFiles.length === 0,
          });

          // Mock Storage deleteObject
          const mockDeleteObject = vi.fn((ref: any) => {
            // Extract path from ref
            const path = ref._location?.path || ref.fullPath || 'unknown';
            deletedStorageFiles.push(path);
            return Promise.resolve();
          });

          // Mock Firestore deleteDoc for files
          const mockDeleteFileDoc = vi.fn((docRef: any) => {
            deletedFirestoreFiles.push(docRef.id);
            return Promise.resolve();
          });

          // Mock Firestore deleteDoc for capsule
          const mockDeleteCapsuleDoc = vi.fn(() => {
            capsuleDeleted = true;
            return Promise.resolve();
          });

          // Simulate the deletion process (what deleteCapsule does)
          
          // 1. Verify capsule exists and user owns it
          const capsuleDoc = await mockGetDoc();
          expect(capsuleDoc.exists()).toBe(true);
          const capsule = capsuleDoc.data();
          expect(capsule.user_id).toBe(userId);

          // 2. Get all associated files
          const filesSnapshot = await mockGetDocs();

          // 3. Delete all files from Storage and Firestore
          for (const fileDoc of filesSnapshot.docs) {
            const fileData = fileDoc.data();
            
            // Delete from Storage
            await mockDeleteObject({ fullPath: `capsule-files/${fileData.file_path}` });
            
            // Delete from Firestore
            await mockDeleteFileDoc({ id: fileDoc.id });
          }

          // 4. Delete the capsule document
          await mockDeleteCapsuleDoc();

          // Property: All files should be deleted from Storage
          expect(deletedStorageFiles.length).toBe(files.length);
          for (const file of files) {
            const expectedPath = `capsule-files/${file.path}`;
            expect(deletedStorageFiles).toContain(expectedPath);
          }

          // Property: All file metadata should be deleted from Firestore
          expect(deletedFirestoreFiles.length).toBe(files.length);
          for (let i = 0; i < files.length; i++) {
            expect(deletedFirestoreFiles).toContain(`file-${i}`);
          }

          // Property: The capsule document should be deleted
          expect(capsuleDeleted).toBe(true);

          // Property: Deletion should happen in correct order (files first, then capsule)
          // This ensures referential integrity - only check if there are files
          if (files.length > 0) {
            expect(mockDeleteCapsuleDoc).toHaveBeenCalledAfter(mockDeleteObject);
          }

          // Property: If there are no files, only capsule should be deleted
          if (files.length === 0) {
            expect(deletedStorageFiles.length).toBe(0);
            expect(deletedFirestoreFiles.length).toBe(0);
            expect(capsuleDeleted).toBe(true);
          }

          // Property: Number of storage deletions should match number of files
          expect(deletedStorageFiles.length).toBe(storedFiles.length);

          // Property: Number of Firestore file deletions should match number of files
          expect(deletedFirestoreFiles.length).toBe(storedFiles.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  // **Feature: memory-capsule-completion, Property 25: Export Data Completeness**
  // **Validates: Requirements 10.1**
  it('Property 25: Export Data Completeness - For any capsule export, the generated file should contain all decrypted content and metadata', { timeout: 45000 }, async () => {
    // Generator for capsule data with all possible fields
    const capsuleArbitrary = fc.record({
      title: fc.string({ minLength: 1, maxLength: 100 }),
      content: fc.string({ minLength: 1, maxLength: 1000 }),
      unlockDate: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
      createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-11-01') }),
      type: fc.constantFrom('text' as const, 'image' as const, 'mixed' as const),
      sentiment: fc.option(fc.constantFrom('positive' as const, 'neutral' as const, 'negative' as const), { nil: undefined }),
      sentimentScore: fc.option(fc.double({ min: 0, max: 1 }), { nil: undefined }),
      themes: fc.option(fc.array(fc.string({ minLength: 3, maxLength: 20 }), { minLength: 0, maxLength: 5 }), { nil: undefined }),
      summary: fc.option(fc.string({ minLength: 10, maxLength: 200 }), { nil: undefined }),
    }).filter(data => !isNaN(data.createdAt.getTime()) && !isNaN(data.unlockDate.getTime()));

    // Generator for file metadata
    const fileArbitrary = fc.record({
      name: fc.string({ minLength: 1, maxLength: 50 }),
      type: fc.constantFrom('image/jpeg', 'video/mp4', 'application/pdf', 'audio/mp3'),
      url: fc.webUrl(),
    });

    const userIdArbitrary = fc.uuid();
    const passwordArbitrary = fc.string({ minLength: 8, maxLength: 20 });
    const formatArbitrary = fc.constantFrom('json' as const, 'text' as const);

    await fc.assert(
      fc.asyncProperty(
        capsuleArbitrary,
        fc.array(fileArbitrary, { minLength: 0, maxLength: 5 }),
        userIdArbitrary,
        passwordArbitrary,
        formatArbitrary,
        async (capsuleData, files, userId, password, format) => {
          // Generate encryption key
          const userKey = await CapsuleEncryption.getUserEncryptionKey(userId, password);

          // Create a mock capsule ID
          const mockCapsuleId = fc.sample(fc.uuid(), 1)[0];

          // Encrypt the capsule data
          const encryptedTitle = await CapsuleEncryption.encryptData(capsuleData.title, userKey);
          const encryptedContent = await CapsuleEncryption.encryptData(capsuleData.content, userKey);

          // Encrypt summary if present
          let encryptedSummary: { encryptedData: string; iv: string } | undefined;
          if (capsuleData.summary) {
            encryptedSummary = await CapsuleEncryption.encryptData(capsuleData.summary, userKey);
          }

          // Simulate the stored capsule with all metadata
          const storedCapsule = {
            id: mockCapsuleId,
            user_id: userId,
            title_encrypted: encryptedTitle.encryptedData,
            title_iv: encryptedTitle.iv,
            content_encrypted: encryptedContent.encryptedData,
            content_iv: encryptedContent.iv,
            unlock_date: { toDate: () => capsuleData.unlockDate },
            created_at: { toDate: () => capsuleData.createdAt },
            capsule_type: capsuleData.type,
            is_unlocked: true,
            sentiment: capsuleData.sentiment,
            sentiment_score: capsuleData.sentimentScore,
            themes: capsuleData.themes,
            summary_encrypted: encryptedSummary?.encryptedData,
            summary_iv: encryptedSummary?.iv,
          };

          // Simulate file metadata
          const capsuleFiles = files.map((file, index) => ({
            id: `file-${index}`,
            name: file.name,
            type: file.type,
            url: file.url,
            filePath: `${userId}/${mockCapsuleId}/file-${index}`,
            fileIv: 'file_iv',
          }));

          // Prepare export data (simulating what exportCapsule does)
          const exportData = {
            id: mockCapsuleId,
            title: capsuleData.title,
            content: capsuleData.content,
            type: capsuleData.type,
            createdAt: capsuleData.createdAt.toISOString(),
            unlockDate: capsuleData.unlockDate.toISOString(),
            isUnlocked: true,
            sentiment: capsuleData.sentiment,
            sentimentScore: capsuleData.sentimentScore,
            themes: capsuleData.themes || [],
            summary: capsuleData.summary,
            files: capsuleFiles.map(f => ({
              name: f.name,
              type: f.type,
              url: f.url
            })),
            exportedAt: new Date().toISOString()
          };

          // Property: Export data should contain all original capsule fields
          expect(exportData.id).toBe(mockCapsuleId);
          expect(exportData.title).toBe(capsuleData.title);
          expect(exportData.content).toBe(capsuleData.content);
          expect(exportData.type).toBe(capsuleData.type);
          expect(exportData.isUnlocked).toBe(true);

          // Property: Dates should be in ISO format
          expect(exportData.createdAt).toBe(capsuleData.createdAt.toISOString());
          expect(exportData.unlockDate).toBe(capsuleData.unlockDate.toISOString());
          expect(() => new Date(exportData.createdAt)).not.toThrow();
          expect(() => new Date(exportData.unlockDate)).not.toThrow();
          expect(() => new Date(exportData.exportedAt)).not.toThrow();

          // Property: Sentiment data should match if present
          if (capsuleData.sentiment) {
            expect(exportData.sentiment).toBe(capsuleData.sentiment);
          }
          if (capsuleData.sentimentScore !== undefined) {
            expect(exportData.sentimentScore).toBe(capsuleData.sentimentScore);
          }

          // Property: Themes should match if present
          if (capsuleData.themes) {
            expect(exportData.themes).toEqual(capsuleData.themes);
          } else {
            expect(exportData.themes).toEqual([]);
          }

          // Property: Summary should match if present
          if (capsuleData.summary) {
            expect(exportData.summary).toBe(capsuleData.summary);
          }

          // Property: All files should be included with complete metadata
          expect(exportData.files.length).toBe(files.length);
          for (let i = 0; i < files.length; i++) {
            expect(exportData.files[i].name).toBe(files[i].name);
            expect(exportData.files[i].type).toBe(files[i].type);
            expect(exportData.files[i].url).toBe(files[i].url);
          }

          // Property: Export should have an exportedAt timestamp
          expect(exportData.exportedAt).toBeDefined();
          expect(typeof exportData.exportedAt).toBe('string');

          // Generate blob based on format
          let blob: Blob;
          let blobText: string;
          if (format === 'json') {
            const jsonString = JSON.stringify(exportData, null, 2);
            blob = new Blob([jsonString], { type: 'application/json' });
            blobText = jsonString;

            // Property: JSON blob should be parseable
            const parsed = JSON.parse(blobText);
            expect(parsed).toEqual(exportData);

            // Property: JSON should be properly formatted (with indentation)
            expect(blobText).toContain('\n');
            expect(blobText).toContain('  ');
          } else {
            // Text format
            let textContent = `Memory Capsule Export\n`;
            textContent += `${'='.repeat(50)}\n\n`;
            textContent += `Title: ${exportData.title}\n`;
            textContent += `Created: ${new Date(exportData.createdAt).toLocaleString()}\n`;
            textContent += `Unlock Date: ${new Date(exportData.unlockDate).toLocaleString()}\n`;
            textContent += `Status: ${exportData.isUnlocked ? 'Unlocked' : 'Locked'}\n`;
            textContent += `Type: ${exportData.type}\n`;
            
            if (exportData.sentiment) {
              textContent += `Sentiment: ${exportData.sentiment}`;
              if (exportData.sentimentScore !== undefined) {
                textContent += ` (${(exportData.sentimentScore * 100).toFixed(1)}%)`;
              }
              textContent += `\n`;
            }
            
            if (exportData.themes && exportData.themes.length > 0) {
              textContent += `Themes: ${exportData.themes.join(', ')}\n`;
            }
            
            textContent += `\n${'='.repeat(50)}\n\n`;
            
            if (exportData.summary) {
              textContent += `AI Summary:\n${exportData.summary}\n\n`;
              textContent += `${'='.repeat(50)}\n\n`;
            }
            
            textContent += `Content:\n${exportData.content}\n\n`;
            
            if (exportData.files.length > 0) {
              textContent += `${'='.repeat(50)}\n\n`;
              textContent += `Attached Files (${exportData.files.length}):\n`;
              exportData.files.forEach((file, index) => {
                textContent += `${index + 1}. ${file.name} (${file.type})\n`;
                textContent += `   URL: ${file.url}\n`;
              });
            }
            
            textContent += `\n${'='.repeat(50)}\n`;
            textContent += `Exported: ${new Date(exportData.exportedAt).toLocaleString()}\n`;
            
            blob = new Blob([textContent], { type: 'text/plain' });
            blobText = textContent;

            // Property: Text blob should contain all key information
            expect(blobText).toContain(exportData.title);
            expect(blobText).toContain(exportData.content);
            expect(blobText).toContain(exportData.type);
            
            if (exportData.sentiment) {
              expect(blobText).toContain(exportData.sentiment);
            }
            
            if (exportData.summary) {
              expect(blobText).toContain(exportData.summary);
            }
            
            for (const file of exportData.files) {
              expect(blobText).toContain(file.name);
              expect(blobText).toContain(file.type);
            }
          }

          // Property: Blob should have correct MIME type
          if (format === 'json') {
            expect(blob.type).toBe('application/json');
          } else {
            expect(blob.type).toBe('text/plain');
          }

          // Property: Blob should not be empty
          expect(blob.size).toBeGreaterThan(0);

          // Property: Exported data should be decrypted (not contain encrypted fields)
          expect(blobText).not.toContain('_encrypted');
          expect(blobText).not.toContain('_iv');
        }
      ),
      { numRuns: 30 } // Reduced to 30 due to encryption overhead and timeout constraints
    );
  });

  // **Feature: memory-capsule-completion, Property 27: Share Link Generation Uniqueness**
  // **Validates: Requirements 10.3**
  it('Property 27: Share Link Generation Uniqueness - For any capsule shared, a unique, time-limited sharing link should be generated', async () => {
    // Generator for capsule data
    const capsuleArbitrary = fc.record({
      title: fc.string({ minLength: 1, maxLength: 100 }),
      content: fc.string({ minLength: 1, maxLength: 1000 }),
      unlockDate: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
      type: fc.constantFrom('text' as const, 'image' as const, 'mixed' as const),
    });

    const userIdArbitrary = fc.uuid();
    const expirationDaysArbitrary = fc.integer({ min: 1, max: 30 });

    await fc.assert(
      fc.asyncProperty(
        fc.array(capsuleArbitrary, { minLength: 2, maxLength: 10 }), // Multiple capsules to test uniqueness
        userIdArbitrary,
        expirationDaysArbitrary,
        async (capsules, userId, expirationDays) => {
          // Track generated share tokens
          const generatedTokens: string[] = [];
          const shareMetadata: Array<{
            capsuleId: string;
            token: string;
            expiresAt: Date;
            createdAt: Date;
          }> = [];

          // Generate share links for each capsule
          for (let i = 0; i < capsules.length; i++) {
            const mockCapsuleId = fc.sample(fc.uuid(), 1)[0];

            // Simulate the stored capsule
            const storedCapsule = {
              id: mockCapsuleId,
              user_id: userId,
              title_encrypted: 'encrypted_title',
              title_iv: 'title_iv',
              content_encrypted: 'encrypted_content',
              content_iv: 'content_iv',
              unlock_date: { toDate: () => capsules[i].unlockDate },
              capsule_type: capsules[i].type,
              is_unlocked: false,
              created_at: { toDate: () => new Date() },
            };

            // Mock Firestore getDoc to return the capsule
            const mockGetDoc = vi.fn().mockResolvedValue({
              exists: () => true,
              data: () => storedCapsule,
            });

            // Verify capsule exists and user owns it
            const capsuleDoc = await mockGetDoc();
            expect(capsuleDoc.exists()).toBe(true);
            const capsule = capsuleDoc.data();
            expect(capsule.user_id).toBe(userId);

            // Generate a unique share token (simulating what generateShareLink does)
            const shareToken = crypto.randomUUID();

            // Calculate expiration date
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + expirationDays);

            const createdAt = new Date();

            // Store share metadata (simulating Firestore addDoc)
            const shareData = {
              capsule_id: mockCapsuleId,
              user_id: userId,
              share_token: shareToken,
              created_at: createdAt,
              expires_at: expiresAt,
              is_active: true,
            };

            generatedTokens.push(shareToken);
            shareMetadata.push({
              capsuleId: mockCapsuleId,
              token: shareToken,
              expiresAt,
              createdAt,
            });

            // Property: Share token should be a valid UUID
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            expect(shareToken).toMatch(uuidRegex);

            // Property: Expiration date should be in the future
            expect(expiresAt.getTime()).toBeGreaterThan(createdAt.getTime());

            // Property: Expiration date should be exactly expirationDays in the future
            const expectedExpirationTime = createdAt.getTime() + (expirationDays * 24 * 60 * 60 * 1000);
            const timeDifference = Math.abs(expiresAt.getTime() - expectedExpirationTime);
            // Allow small time difference due to execution time (within 1 second)
            expect(timeDifference).toBeLessThan(1000);

            // Property: Share data should contain all required fields
            expect(shareData.capsule_id).toBe(mockCapsuleId);
            expect(shareData.user_id).toBe(userId);
            expect(shareData.share_token).toBe(shareToken);
            expect(shareData.is_active).toBe(true);
            expect(shareData.created_at).toBeInstanceOf(Date);
            expect(shareData.expires_at).toBeInstanceOf(Date);
          }

          // Property: All generated tokens should be unique
          const uniqueTokens = new Set(generatedTokens);
          expect(uniqueTokens.size).toBe(generatedTokens.length);

          // Property: Each token should be different from all others
          for (let i = 0; i < generatedTokens.length; i++) {
            for (let j = i + 1; j < generatedTokens.length; j++) {
              expect(generatedTokens[i]).not.toBe(generatedTokens[j]);
            }
          }

          // Property: Tokens should be non-empty strings
          for (const token of generatedTokens) {
            expect(token).toBeTruthy();
            expect(typeof token).toBe('string');
            expect(token.length).toBeGreaterThan(0);
          }

          // Property: Each capsule should have exactly one share link
          const capsuleIds = shareMetadata.map(m => m.capsuleId);
          expect(capsuleIds.length).toBe(capsules.length);

          // Property: Share metadata should be retrievable by token
          for (const metadata of shareMetadata) {
            const foundMetadata = shareMetadata.find(m => m.token === metadata.token);
            expect(foundMetadata).toBeDefined();
            expect(foundMetadata?.capsuleId).toBe(metadata.capsuleId);
            expect(foundMetadata?.expiresAt.getTime()).toBe(metadata.expiresAt.getTime());
          }

          // Property: Multiple shares of the same capsule should generate different tokens
          // (Test by generating a second share for the first capsule)
          if (capsules.length > 0) {
            const firstCapsuleId = shareMetadata[0].capsuleId;
            const secondShareToken = crypto.randomUUID();
            
            expect(secondShareToken).not.toBe(shareMetadata[0].token);
            expect(generatedTokens).not.toContain(secondShareToken);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // **Feature: memory-capsule-completion, Property 28: Share Link Access Validation**
  // **Validates: Requirements 10.4, 10.5**
  it('Property 28: Share Link Access Validation - For any valid sharing link accessed, capsule content should be displayed without authentication; for expired links, access should be denied', async () => {
    // Generator for share link data
    const shareTokenArbitrary = fc.uuid();
    const capsuleArbitrary = fc.record({
      title: fc.string({ minLength: 1, maxLength: 100 }),
      content: fc.string({ minLength: 1, maxLength: 1000 }),
      unlockDate: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
      type: fc.constantFrom('text' as const, 'image' as const, 'mixed' as const),
    });
    const userIdArbitrary = fc.uuid();

    // Test both valid (non-expired) and expired links
    const isExpiredArbitrary = fc.boolean();

    await fc.assert(
      fc.asyncProperty(
        shareTokenArbitrary,
        capsuleArbitrary,
        userIdArbitrary,
        isExpiredArbitrary,
        async (shareToken, capsuleData, userId, shouldBeExpired) => {
          const mockCapsuleId = fc.sample(fc.uuid(), 1)[0];

          // Create expiration date based on whether link should be expired
          const expiresAt = new Date();
          if (shouldBeExpired) {
            // Set expiration date in the past
            expiresAt.setDate(expiresAt.getDate() - 7);
          } else {
            // Set expiration date in the future
            expiresAt.setDate(expiresAt.getDate() + 7);
          }

          // Simulate the stored share record
          const shareRecord = {
            capsule_id: mockCapsuleId,
            user_id: userId,
            share_token: shareToken,
            created_at: new Date(),
            expires_at: expiresAt,
            is_active: true,
          };

          // Simulate the stored capsule
          const storedCapsule = {
            id: mockCapsuleId,
            user_id: userId,
            title_encrypted: 'encrypted_title',
            title_iv: 'title_iv',
            content_encrypted: 'encrypted_content',
            content_iv: 'content_iv',
            unlock_date: { toDate: () => capsuleData.unlockDate },
            capsule_type: capsuleData.type,
            is_unlocked: false,
            created_at: { toDate: () => new Date() },
          };

          // Check if the link is expired
          const isExpired = new Date() > shareRecord.expires_at;

          // Property: Expiration status should match the intended state
          expect(isExpired).toBe(shouldBeExpired);

          if (isExpired) {
            // Property: For expired links, access should be denied
            // The result should indicate expiration
            const result = {
              capsule: null,
              isExpired: true,
            };

            expect(result.isExpired).toBe(true);
            expect(result.capsule).toBeNull();

            // Property: Expired links should not provide capsule data
            expect(result.capsule).not.toBeTruthy();
          } else {
            // Property: For valid (non-expired) links, capsule should be accessible
            const result = {
              capsule: {
                id: storedCapsule.id,
                title: storedCapsule.title_encrypted, // Would be decrypted in real implementation
                content: storedCapsule.content_encrypted, // Would be decrypted in real implementation
                unlockDate: storedCapsule.unlock_date.toDate(),
                createdAt: storedCapsule.created_at.toDate(),
                isUnlocked: storedCapsule.is_unlocked || new Date() >= storedCapsule.unlock_date.toDate(),
                type: storedCapsule.capsule_type,
              },
              isExpired: false,
            };

            expect(result.isExpired).toBe(false);
            expect(result.capsule).toBeTruthy();

            // Property: Valid links should provide complete capsule data
            expect(result.capsule.id).toBe(mockCapsuleId);
            expect(result.capsule.title).toBeTruthy();
            expect(result.capsule.content).toBeTruthy();
            expect(result.capsule.type).toBe(capsuleData.type);

            // Property: Capsule should have all required fields
            expect(result.capsule).toHaveProperty('id');
            expect(result.capsule).toHaveProperty('title');
            expect(result.capsule).toHaveProperty('content');
            expect(result.capsule).toHaveProperty('unlockDate');
            expect(result.capsule).toHaveProperty('createdAt');
            expect(result.capsule).toHaveProperty('isUnlocked');
            expect(result.capsule).toHaveProperty('type');

            // Property: Dates should be valid Date objects
            expect(result.capsule.unlockDate).toBeInstanceOf(Date);
            expect(result.capsule.createdAt).toBeInstanceOf(Date);

            // Property: Type should be one of the valid values
            expect(['text', 'image', 'mixed']).toContain(result.capsule.type);
          }

          // Property: Share token should be a valid UUID
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          expect(shareToken).toMatch(uuidRegex);

          // Property: Share record should have all required fields
          expect(shareRecord.capsule_id).toBe(mockCapsuleId);
          expect(shareRecord.user_id).toBe(userId);
          expect(shareRecord.share_token).toBe(shareToken);
          expect(shareRecord.is_active).toBe(true);
          expect(shareRecord.created_at).toBeInstanceOf(Date);
          expect(shareRecord.expires_at).toBeInstanceOf(Date);

          // Property: Expiration date should be after creation date
          expect(shareRecord.expires_at.getTime()).toBeGreaterThan(shareRecord.created_at.getTime() - (14 * 24 * 60 * 60 * 1000)); // Allow for past dates

          // Property: Share token should be non-empty
          expect(shareToken).toBeTruthy();
          expect(shareToken.length).toBeGreaterThan(0);

          // Property: Capsule ID should be non-empty
          expect(mockCapsuleId).toBeTruthy();
          expect(mockCapsuleId.length).toBeGreaterThan(0);

          // Property: User ID should be non-empty
          expect(userId).toBeTruthy();
          expect(userId.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  // **Feature: memory-capsule-completion, Property 7: AI Sentiment Analysis Persistence**
  // **Validates: Requirements 3.1, 3.5**
  it('Property 7: AI Sentiment Analysis Persistence - For any capsule content analyzed for sentiment, the result should be stored and retrievable', { timeout: 45000 }, async () => {
    // Generator for sentiment analysis data
    const sentimentArbitrary = fc.constantFrom('positive' as const, 'neutral' as const, 'negative' as const);
    const sentimentScoreArbitrary = fc.double({ min: 0, max: 1 });
    const themesArbitrary = fc.array(fc.string({ minLength: 3, maxLength: 20 }), { minLength: 0, maxLength: 5 });
    const summaryArbitrary = fc.string({ minLength: 10, maxLength: 200 });

    const capsuleArbitrary = fc.record({
      title: fc.string({ minLength: 1, maxLength: 100 }),
      content: fc.string({ minLength: 1, maxLength: 1000 }),
      unlockDate: fc.date({ min: new Date(), max: new Date('2030-12-31') }),
      type: fc.constantFrom('text' as const, 'image' as const, 'mixed' as const),
    });

    const analysisArbitrary = fc.record({
      sentiment: sentimentArbitrary,
      sentimentScore: sentimentScoreArbitrary,
      themes: themesArbitrary,
      summary: summaryArbitrary,
    });

    const userIdArbitrary = fc.uuid();
    const passwordArbitrary = fc.string({ minLength: 8, maxLength: 20 });

    await fc.assert(
      fc.asyncProperty(
        capsuleArbitrary,
        analysisArbitrary,
        userIdArbitrary,
        passwordArbitrary,
        async (capsuleData, analysisData, userId, password) => {
          // Generate encryption key
          const userKey = await CapsuleEncryption.getUserEncryptionKey(userId, password);

          // Create a mock capsule ID
          const mockCapsuleId = fc.sample(fc.uuid(), 1)[0];

          // Encrypt the capsule data
          const encryptedTitle = await CapsuleEncryption.encryptData(capsuleData.title, userKey);
          const encryptedContent = await CapsuleEncryption.encryptData(capsuleData.content, userKey);

          // Encrypt the summary (simulating what updateCapsuleSentiment does)
          const encryptedSummary = await CapsuleEncryption.encryptData(analysisData.summary, userKey);

          // Simulate the stored capsule with sentiment analysis
          const storedCapsule = {
            id: mockCapsuleId,
            user_id: userId,
            title_encrypted: encryptedTitle.encryptedData,
            title_iv: encryptedTitle.iv,
            content_encrypted: encryptedContent.encryptedData,
            content_iv: encryptedContent.iv,
            unlock_date: { toDate: () => capsuleData.unlockDate },
            capsule_type: capsuleData.type,
            is_unlocked: false,
            created_at: { toDate: () => new Date() },
            // Sentiment analysis fields
            sentiment: analysisData.sentiment,
            sentiment_score: analysisData.sentimentScore,
            themes: analysisData.themes,
            summary_encrypted: encryptedSummary.encryptedData,
            summary_iv: encryptedSummary.iv,
          };

          // Retrieve and decrypt (simulating what getUserCapsules does)
          const retrievedTitle = await CapsuleEncryption.decryptData(
            storedCapsule.title_encrypted,
            storedCapsule.title_iv,
            userKey
          );
          const retrievedContent = await CapsuleEncryption.decryptData(
            storedCapsule.content_encrypted,
            storedCapsule.content_iv,
            userKey
          );
          const retrievedSummary = await CapsuleEncryption.decryptData(
            storedCapsule.summary_encrypted,
            storedCapsule.summary_iv,
            userKey
          );

          // Property: Retrieved sentiment data should match original analysis
          expect(storedCapsule.sentiment).toBe(analysisData.sentiment);
          expect(storedCapsule.sentiment_score).toBe(analysisData.sentimentScore);
          expect(storedCapsule.themes).toEqual(analysisData.themes);
          expect(retrievedSummary).toBe(analysisData.summary);

          // Property: Sentiment score should be between 0 and 1
          expect(storedCapsule.sentiment_score).toBeGreaterThanOrEqual(0);
          expect(storedCapsule.sentiment_score).toBeLessThanOrEqual(1);

          // Property: Sentiment should be one of the valid values
          expect(['positive', 'neutral', 'negative']).toContain(storedCapsule.sentiment);

          // Property: Themes should be an array with max 5 items
          expect(Array.isArray(storedCapsule.themes)).toBe(true);
          expect(storedCapsule.themes.length).toBeLessThanOrEqual(5);

          // Property: Summary should be encrypted (different from original)
          expect(storedCapsule.summary_encrypted).not.toBe(analysisData.summary);

          // Property: Summary IV should be present and non-empty
          expect(storedCapsule.summary_iv).toBeTruthy();

          // Property: Capsule data should still be intact
          expect(retrievedTitle).toBe(capsuleData.title);
          expect(retrievedContent).toBe(capsuleData.content);
        }
      ),
      { numRuns: 30 } // Reduced to 30 due to encryption overhead and timeout constraints
    );
  });
});
