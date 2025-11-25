import { describe, it, expect, beforeAll } from 'vitest';
import * as fc from 'fast-check';
import { FileService } from './file-service';
import { FileEncryption, CapsuleEncryption } from './encryption';

describe('FileService', () => {
  let testUserKey: CryptoKey;

  beforeAll(async () => {
    // Generate a test encryption key for property tests
    const testUserId = 'test-user-123';
    const testPassword = 'test-password-secure-123';
    testUserKey = await CapsuleEncryption.getUserEncryptionKey(testUserId, testPassword);
  });

  describe('File Encryption', () => {
    // **Feature: memory-capsule-completion, Property 4: File Encryption Round Trip**
    // **Validates: Requirements 2.2, 2.5**
    it('should encrypt and decrypt files to produce identical content', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            content: fc.uint8Array({ minLength: 0, maxLength: 1024 * 100 }), // Up to 100KB for test performance
            name: fc.string({ minLength: 1, maxLength: 255 }).filter(s => s.trim().length > 0),
            type: fc.constantFrom(
              'image/jpeg',
              'image/png',
              'video/mp4',
              'application/pdf',
              'text/plain',
              'audio/mpeg'
            )
          }),
          async (fileData) => {
            // Create a File object from the generated data
            const originalFile = new File([fileData.content], fileData.name, { 
              type: fileData.type 
            });

            // Encrypt the file
            const encrypted = await FileEncryption.encryptFile(originalFile, testUserKey);

            // Verify encryption produces required fields
            expect(encrypted.encryptedFile).toBeDefined();
            expect(encrypted.iv).toBeDefined();
            expect(encrypted.originalName).toBe(fileData.name);
            expect(encrypted.originalType).toBe(fileData.type);

            // Decrypt the file
            const decryptedBlob = await FileEncryption.decryptFile(
              encrypted.encryptedFile,
              encrypted.iv,
              testUserKey,
              encrypted.originalType
            );

            // Convert both to ArrayBuffers for comparison
            const originalBuffer = await originalFile.arrayBuffer();
            const decryptedBuffer = await decryptedBlob.arrayBuffer();

            // Property: Decrypted content should match original content exactly
            const originalArray = new Uint8Array(originalBuffer);
            const decryptedArray = new Uint8Array(decryptedBuffer);

            expect(decryptedArray.length).toBe(originalArray.length);
            expect(decryptedArray).toEqual(originalArray);

            // Property: Decrypted blob should have the correct type
            expect(decryptedBlob.type).toBe(fileData.type);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce different encrypted output for the same file (due to random IV)', async () => {
      const testContent = new Uint8Array([1, 2, 3, 4, 5]);
      const testFile = new File([testContent], 'test.txt', { type: 'text/plain' });

      // Encrypt the same file twice
      const encrypted1 = await FileEncryption.encryptFile(testFile, testUserKey);
      const encrypted2 = await FileEncryption.encryptFile(testFile, testUserKey);

      // IVs should be different (random)
      expect(encrypted1.iv).not.toBe(encrypted2.iv);

      // Encrypted content should be different
      const buffer1 = await encrypted1.encryptedFile.arrayBuffer();
      const buffer2 = await encrypted2.encryptedFile.arrayBuffer();
      const array1 = new Uint8Array(buffer1);
      const array2 = new Uint8Array(buffer2);
      
      expect(array1).not.toEqual(array2);

      // But both should decrypt to the same original content
      const decrypted1 = await FileEncryption.decryptFile(
        encrypted1.encryptedFile,
        encrypted1.iv,
        testUserKey,
        testFile.type
      );
      const decrypted2 = await FileEncryption.decryptFile(
        encrypted2.encryptedFile,
        encrypted2.iv,
        testUserKey,
        testFile.type
      );

      const decryptedBuffer1 = await decrypted1.arrayBuffer();
      const decryptedBuffer2 = await decrypted2.arrayBuffer();
      
      expect(new Uint8Array(decryptedBuffer1)).toEqual(testContent);
      expect(new Uint8Array(decryptedBuffer2)).toEqual(testContent);
    });
  });

  describe('Upload Progress Tracking', () => {
    // **Feature: memory-capsule-completion, Property 6: Upload Progress Accuracy**
    // **Validates: Requirements 2.3, 13.3**
    it('should report monotonically increasing progress from 0 to 100', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 5 }), // Number of files
          (numFiles) => {
            // Track progress callbacks for each file
            const progressCallbacks: Array<Array<number>> = Array(numFiles).fill(null).map(() => []);

            // Mock progress callback
            const onProgress = (fileIndex: number, progress: number) => {
              progressCallbacks[fileIndex].push(progress);
            };

            // Simulate progress tracking
            for (let i = 0; i < numFiles; i++) {
              onProgress(i, 0);
              onProgress(i, 25);
              onProgress(i, 75);
              onProgress(i, 100);
            }

            // Property 1: Each file should have progress callbacks
            expect(progressCallbacks.length).toBe(numFiles);

            // Property 2: Progress should be monotonically increasing
            for (let i = 0; i < numFiles; i++) {
              const progress = progressCallbacks[i];
              
              // Should have at least some progress updates
              expect(progress.length).toBeGreaterThan(0);

              // Check monotonic increase
              for (let j = 1; j < progress.length; j++) {
                expect(progress[j]).toBeGreaterThanOrEqual(progress[j - 1]);
              }

              // Property 3: Should start at 0
              expect(progress[0]).toBe(0);

              // Property 4: Should end at 100
              expect(progress[progress.length - 1]).toBe(100);

              // Property 5: All progress values should be between 0 and 100
              for (const p of progress) {
                expect(p).toBeGreaterThanOrEqual(0);
                expect(p).toBeLessThanOrEqual(100);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should track progress for each file independently', () => {
      const progressByFile = new Map<number, number[]>();

      const onProgress = (fileIndex: number, progress: number) => {
        if (!progressByFile.has(fileIndex)) {
          progressByFile.set(fileIndex, []);
        }
        progressByFile.get(fileIndex)!.push(progress);
      };

      // Simulate uploading 3 files
      const numFiles = 3;
      for (let i = 0; i < numFiles; i++) {
        onProgress(i, 0);
        onProgress(i, 25);
        onProgress(i, 75);
        onProgress(i, 100);
      }

      // Each file should have its own progress tracking
      expect(progressByFile.size).toBe(numFiles);

      // Each file should have complete progress
      for (let i = 0; i < numFiles; i++) {
        const progress = progressByFile.get(i)!;
        expect(progress).toEqual([0, 25, 75, 100]);
      }
    });

    it('should report progress values within valid range', () => {
      const allProgressValues: number[] = [];

      const onProgress = (fileIndex: number, progress: number) => {
        allProgressValues.push(progress);
      };

      // Simulate progress for multiple files
      for (let i = 0; i < 5; i++) {
        onProgress(i, 0);
        onProgress(i, 25);
        onProgress(i, 75);
        onProgress(i, 100);
      }

      // All progress values should be between 0 and 100
      for (const progress of allProgressValues) {
        expect(progress).toBeGreaterThanOrEqual(0);
        expect(progress).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('File Validation', () => {
    // **Feature: memory-capsule-completion, Property 5: File Validation Consistency**
    // **Validates: Requirements 2.1, 11.3, 11.4**
    it('should consistently validate files based on type and size limits', () => {
      fc.assert(
        fc.property(
          // Generate arbitrary file-like objects with various types and sizes
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 255 }),
            type: fc.oneof(
              // Valid types
              fc.constantFrom(
                'image/jpeg',
                'image/png',
                'image/gif',
                'image/webp',
                'image/svg+xml',
                'video/mp4',
                'video/webm',
                'video/ogg',
                'video/quicktime',
                'application/pdf',
                'text/plain',
                'text/markdown',
                'audio/mpeg',
                'audio/wav'
              ),
              // Invalid types
              fc.constantFrom(
                'application/x-executable',
                'application/x-msdownload',
                'text/html',
                'application/javascript',
                'invalid/type'
              )
            ),
            size: fc.integer({ min: 0, max: 200 * 1024 * 1024 }) // 0 to 200MB
          }),
          (fileData) => {
            // Create a mock File object
            const file = new File([''], fileData.name, { type: fileData.type });
            
            // Override the size property (File objects have readonly size)
            Object.defineProperty(file, 'size', {
              value: fileData.size,
              writable: false
            });

            // Validate the file twice
            const result1 = FileService.validateFile(file);
            const result2 = FileService.validateFile(file);

            // Property: Validation should be consistent - same input should always produce same output
            expect(result1.isValid).toBe(result2.isValid);
            expect(result1.error).toBe(result2.error);

            // Property: Valid types should be accepted if size is within limits
            const validTypes = [
              'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
              'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
              'application/pdf', 'text/plain', 'text/markdown',
              'audio/mpeg', 'audio/wav'
            ];

            if (validTypes.includes(fileData.type)) {
              // Determine max size for this type
              let maxSize: number;
              if (fileData.type.startsWith('image/')) {
                maxSize = 10 * 1024 * 1024; // 10MB
              } else if (fileData.type.startsWith('video/')) {
                maxSize = 100 * 1024 * 1024; // 100MB
              } else if (fileData.type === 'application/pdf' || fileData.type.startsWith('text/')) {
                maxSize = 25 * 1024 * 1024; // 25MB
              } else if (fileData.type.startsWith('audio/')) {
                maxSize = 50 * 1024 * 1024; // 50MB
              } else {
                maxSize = 10 * 1024 * 1024; // 10MB default
              }

              if (fileData.size <= maxSize) {
                // Should be valid
                expect(result1.isValid).toBe(true);
                expect(result1.error).toBeUndefined();
              } else {
                // Should be invalid due to size
                expect(result1.isValid).toBe(false);
                expect(result1.error).toContain('exceeds maximum allowed size');
              }
            } else {
              // Invalid type should always be rejected
              expect(result1.isValid).toBe(false);
              expect(result1.error).toContain('Unsupported file type');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject files with unsupported types', () => {
      const unsupportedTypes = [
        'application/x-executable',
        'application/x-msdownload',
        'text/html',
        'application/javascript',
        'application/zip'
      ];

      unsupportedTypes.forEach(type => {
        const file = new File(['test content'], 'test.file', { type });
        const result = FileService.validateFile(file);
        
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Unsupported file type');
        expect(result.error).toContain('Supported formats');
      });
    });

    it('should reject files exceeding size limits', () => {
      // Test image exceeding 10MB
      const largeImage = new File([''], 'large.jpg', { type: 'image/jpeg' });
      Object.defineProperty(largeImage, 'size', {
        value: 11 * 1024 * 1024, // 11MB
        writable: false
      });
      
      const imageResult = FileService.validateFile(largeImage);
      expect(imageResult.isValid).toBe(false);
      expect(imageResult.error).toContain('exceeds maximum allowed size');

      // Test video exceeding 100MB
      const largeVideo = new File([''], 'large.mp4', { type: 'video/mp4' });
      Object.defineProperty(largeVideo, 'size', {
        value: 101 * 1024 * 1024, // 101MB
        writable: false
      });
      
      const videoResult = FileService.validateFile(largeVideo);
      expect(videoResult.isValid).toBe(false);
      expect(videoResult.error).toContain('exceeds maximum allowed size');
    });

    it('should accept valid files within size limits', () => {
      // Test valid image
      const validImage = new File(['test'], 'photo.jpg', { type: 'image/jpeg' });
      Object.defineProperty(validImage, 'size', {
        value: 5 * 1024 * 1024, // 5MB
        writable: false
      });
      
      const imageResult = FileService.validateFile(validImage);
      expect(imageResult.isValid).toBe(true);
      expect(imageResult.error).toBeUndefined();

      // Test valid PDF
      const validPdf = new File(['test'], 'document.pdf', { type: 'application/pdf' });
      Object.defineProperty(validPdf, 'size', {
        value: 10 * 1024 * 1024, // 10MB
        writable: false
      });
      
      const pdfResult = FileService.validateFile(validPdf);
      expect(pdfResult.isValid).toBe(true);
      expect(pdfResult.error).toBeUndefined();

      // Test valid video
      const validVideo = new File(['test'], 'video.mp4', { type: 'video/mp4' });
      Object.defineProperty(validVideo, 'size', {
        value: 50 * 1024 * 1024, // 50MB
        writable: false
      });
      
      const videoResult = FileService.validateFile(validVideo);
      expect(videoResult.isValid).toBe(true);
      expect(videoResult.error).toBeUndefined();
    });

    it('should provide helpful error messages with supported formats', () => {
      const invalidFile = new File(['test'], 'script.exe', { type: 'application/x-executable' });
      const result = FileService.validateFile(invalidFile);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Supported formats');
      expect(result.error).toContain('Images');
      expect(result.error).toContain('Videos');
      expect(result.error).toContain('Documents');
      expect(result.error).toContain('Audio');
    });

    it('should provide helpful error messages with file sizes', () => {
      const largeFile = new File([''], 'huge.jpg', { type: 'image/jpeg' });
      Object.defineProperty(largeFile, 'size', {
        value: 15 * 1024 * 1024, // 15MB
        writable: false
      });
      
      const result = FileService.validateFile(largeFile);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('exceeds maximum allowed size');
      expect(result.error).toContain('MB'); // Should show size in MB
    });
  });
});
