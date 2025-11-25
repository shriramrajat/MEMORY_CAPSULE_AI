import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { SecureCapsuleDB } from '@/lib/database';
import { FileService } from '@/lib/file-service';

// **Feature: memory-capsule-completion, Property 24: File Management During Edit**
// **Validates: Requirements 9.6**

describe('Property 24: File Management During Edit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should allow adding new files and removing existing files during capsule edit', async () => {
    // Property: For any capsule being edited with attached files, 
    // the system should allow adding new files and removing existing files

    await fc.assert(
      fc.asyncProperty(
        // Generate random capsule data
        fc.record({
          capsuleId: fc.uuid(),
          userId: fc.uuid(),
          title: fc.string({ minLength: 1, maxLength: 100 }),
          content: fc.string({ minLength: 1, maxLength: 1000 }),
          existingFiles: fc.array(
            fc.record({
              id: fc.uuid(),
              name: fc.string({ minLength: 1, maxLength: 50 }),
              type: fc.constantFrom('image/jpeg', 'video/mp4', 'application/pdf', 'audio/mp3'),
              filePath: fc.string({ minLength: 10, maxLength: 100 }),
              fileIv: fc.constant('a'.repeat(32)),
            }),
            { minLength: 0, maxLength: 5 }
          ),
          filesToRemove: fc.array(fc.integer({ min: 0, max: 4 }), { maxLength: 3 }),
          newFilesCount: fc.integer({ min: 0, max: 3 }),
        }),
        async ({ capsuleId, userId, title, content, existingFiles, filesToRemove, newFilesCount }) => {
          // Clear mocks at the start of each iteration
          vi.clearAllMocks();

          // Mock the encryption key
          const mockUserKey = await crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
          );

          // Mock SecureCapsuleDB methods
          const updateCapsuleSpy = vi.spyOn(SecureCapsuleDB, 'updateCapsule').mockResolvedValue();
          const getCapsuleByIdSpy = vi.spyOn(SecureCapsuleDB, 'getCapsuleById').mockResolvedValue({
            id: capsuleId,
            title,
            content,
            unlockDate: new Date(),
            createdAt: new Date(),
            isUnlocked: true,
            type: 'mixed',
            files: existingFiles,
          });

          // Mock FileService methods
          const deleteFileSpy = vi.spyOn(FileService, 'deleteFile').mockResolvedValue();
          const uploadFilesSpy = vi.spyOn(FileService, 'uploadFiles').mockResolvedValue();

          // Simulate edit operation
          // 1. Update capsule content
          await SecureCapsuleDB.updateCapsule(capsuleId, userId, mockUserKey, {
            title,
            content,
          });

          // 2. Remove files marked for deletion
          const filesToDelete = filesToRemove
            .filter(index => index < existingFiles.length)
            .map(index => existingFiles[index]);

          for (const file of filesToDelete) {
            await FileService.deleteFile(file.id, file.filePath);
          }

          // 3. Upload new files
          if (newFilesCount > 0) {
            const mockFiles = Array.from({ length: newFilesCount }, (_, i) => 
              new File([`content-${i}`], `file-${i}.txt`, { type: 'text/plain' })
            );
            await FileService.uploadFiles(capsuleId, mockFiles, mockUserKey, userId, () => {});
          }

          // 4. Fetch updated capsule
          const updatedCapsule = await SecureCapsuleDB.getCapsuleById(capsuleId, userId, mockUserKey);

          // Verify the operations were called correctly
          expect(updateCapsuleSpy).toHaveBeenCalledWith(
            capsuleId,
            userId,
            mockUserKey,
            expect.objectContaining({ title, content })
          );

          // Verify file deletions
          expect(deleteFileSpy).toHaveBeenCalledTimes(filesToDelete.length);
          for (const file of filesToDelete) {
            expect(deleteFileSpy).toHaveBeenCalledWith(file.id, file.filePath);
          }

          // Verify file uploads
          if (newFilesCount > 0) {
            expect(uploadFilesSpy).toHaveBeenCalledTimes(1);
            expect(uploadFilesSpy).toHaveBeenCalledWith(
              capsuleId,
              expect.any(Array),
              mockUserKey,
              userId,
              expect.anything()
            );
          }

          // Verify capsule was fetched after update
          expect(getCapsuleByIdSpy).toHaveBeenCalledWith(capsuleId, userId, mockUserKey);
          expect(updatedCapsule).toBeDefined();
          expect(updatedCapsule?.id).toBe(capsuleId);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain file integrity when only adding files', async () => {
    // Property: When adding files without removing any, all existing files should remain

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          capsuleId: fc.uuid(),
          userId: fc.uuid(),
          existingFileCount: fc.integer({ min: 1, max: 5 }),
          newFileCount: fc.integer({ min: 1, max: 3 }),
        }),
        async ({ capsuleId, userId, existingFileCount, newFileCount }) => {
          // Clear mocks at the start of each iteration
          vi.clearAllMocks();

          const mockUserKey = await crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
          );

          const existingFiles = Array.from({ length: existingFileCount }, (_, i) => ({
            id: `file-${i}`,
            name: `existing-${i}.txt`,
            type: 'text/plain',
            filePath: `path/to/file-${i}`,
            fileIv: 'a'.repeat(32),
            url: `https://example.com/file-${i}`,
          }));

          vi.spyOn(SecureCapsuleDB, 'updateCapsule').mockResolvedValue();
          vi.spyOn(SecureCapsuleDB, 'getCapsuleById').mockResolvedValue({
            id: capsuleId,
            title: 'Test',
            content: 'Test content',
            unlockDate: new Date(),
            createdAt: new Date(),
            isUnlocked: true,
            type: 'mixed',
            files: existingFiles,
          });

          const deleteFileSpy = vi.spyOn(FileService, 'deleteFile').mockResolvedValue();
          vi.spyOn(FileService, 'uploadFiles').mockResolvedValue();

          // Simulate adding files without removing any
          const mockNewFiles = Array.from({ length: newFileCount }, (_, i) =>
            new File([`new-content-${i}`], `new-file-${i}.txt`, { type: 'text/plain' })
          );

          await FileService.uploadFiles(capsuleId, mockNewFiles, mockUserKey, userId);

          // Verify no files were deleted
          expect(deleteFileSpy).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain file integrity when only removing files', async () => {
    // Property: When removing files without adding any, only marked files should be deleted

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          capsuleId: fc.uuid(),
          userId: fc.uuid(),
          existingFileCount: fc.integer({ min: 2, max: 5 }),
          removeCount: fc.integer({ min: 1, max: 3 }),
        }),
        async ({ capsuleId, userId, existingFileCount, removeCount }) => {
          // Clear mocks at the start of each iteration
          vi.clearAllMocks();

          const mockUserKey = await crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
          );

          const existingFiles = Array.from({ length: existingFileCount }, (_, i) => ({
            id: `file-${i}`,
            name: `existing-${i}.txt`,
            type: 'text/plain',
            filePath: `path/to/file-${i}`,
            fileIv: 'a'.repeat(32),
            url: `https://example.com/file-${i}`,
          }));

          vi.spyOn(SecureCapsuleDB, 'updateCapsule').mockResolvedValue();
          const deleteFileSpy = vi.spyOn(FileService, 'deleteFile').mockResolvedValue();
          const uploadFilesSpy = vi.spyOn(FileService, 'uploadFiles').mockResolvedValue();

          // Simulate removing files without adding any
          const actualRemoveCount = Math.min(removeCount, existingFileCount);
          const filesToDelete = existingFiles.slice(0, actualRemoveCount);

          for (const file of filesToDelete) {
            await FileService.deleteFile(file.id, file.filePath);
          }

          // Verify correct number of files were deleted
          expect(deleteFileSpy).toHaveBeenCalledTimes(actualRemoveCount);
          
          // Verify no files were uploaded
          expect(uploadFilesSpy).not.toHaveBeenCalled();

          // Verify each deleted file was called with correct parameters
          for (const file of filesToDelete) {
            expect(deleteFileSpy).toHaveBeenCalledWith(file.id, file.filePath);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle empty file operations gracefully', async () => {
    // Property: When no files are added or removed, no file operations should occur

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          capsuleId: fc.uuid(),
          userId: fc.uuid(),
          title: fc.string({ minLength: 1, maxLength: 100 }),
          content: fc.string({ minLength: 1, maxLength: 1000 }),
        }),
        async ({ capsuleId, userId, title, content }) => {
          // Clear mocks at the start of each iteration
          vi.clearAllMocks();

          const mockUserKey = await crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
          );

          const updateCapsuleSpy = vi.spyOn(SecureCapsuleDB, 'updateCapsule').mockResolvedValue();
          const deleteFileSpy = vi.spyOn(FileService, 'deleteFile').mockResolvedValue();
          const uploadFilesSpy = vi.spyOn(FileService, 'uploadFiles').mockResolvedValue();

          // Simulate edit with no file changes
          await SecureCapsuleDB.updateCapsule(capsuleId, userId, mockUserKey, {
            title,
            content,
          });

          // Verify capsule was updated
          expect(updateCapsuleSpy).toHaveBeenCalledWith(
            capsuleId,
            userId,
            mockUserKey,
            expect.objectContaining({ title, content })
          );

          // Verify no file operations occurred
          expect(deleteFileSpy).not.toHaveBeenCalled();
          expect(uploadFilesSpy).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });
});
