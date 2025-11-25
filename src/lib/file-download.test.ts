import { describe, it, expect, beforeAll, vi } from 'vitest';
import { FileService } from './file-service';
import { FileEncryption, CapsuleEncryption } from './encryption';

describe('FileService Download', () => {
  let testUserKey: CryptoKey;

  beforeAll(async () => {
    // Generate a test encryption key
    const testUserId = 'test-user-123';
    const testPassword = 'test-password-secure-123';
    testUserKey = await CapsuleEncryption.getUserEncryptionKey(testUserId, testPassword);
  });

  describe('downloadFile', () => {
    it('should decrypt file correctly during download simulation', async () => {
      // Create a test file
      const testContent = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      const testFile = new File([testContent], 'test-document.pdf', { 
        type: 'application/pdf' 
      });

      // Encrypt the file (simulating what happens during upload)
      const encrypted = await FileEncryption.encryptFile(testFile, testUserKey);

      // Simulate download by decrypting
      const decryptedBlob = await FileEncryption.decryptFile(
        encrypted.encryptedFile,
        encrypted.iv,
        testUserKey,
        encrypted.originalType
      );

      // Verify the decrypted content matches original
      const decryptedBuffer = await decryptedBlob.arrayBuffer();
      const decryptedArray = new Uint8Array(decryptedBuffer);

      expect(decryptedArray).toEqual(testContent);
      expect(decryptedBlob.type).toBe('application/pdf');
    });

    it('should handle different file types correctly', async () => {
      const fileTypes = [
        { type: 'image/jpeg', name: 'photo.jpg' },
        { type: 'video/mp4', name: 'video.mp4' },
        { type: 'text/plain', name: 'note.txt' },
        { type: 'audio/mpeg', name: 'audio.mp3' }
      ];

      for (const fileType of fileTypes) {
        const testContent = new Uint8Array([1, 2, 3, 4, 5]);
        const testFile = new File([testContent], fileType.name, { 
          type: fileType.type 
        });

        // Encrypt
        const encrypted = await FileEncryption.encryptFile(testFile, testUserKey);

        // Decrypt (simulating download)
        const decryptedBlob = await FileEncryption.decryptFile(
          encrypted.encryptedFile,
          encrypted.iv,
          testUserKey,
          encrypted.originalType
        );

        // Verify
        const decryptedBuffer = await decryptedBlob.arrayBuffer();
        const decryptedArray = new Uint8Array(decryptedBuffer);

        expect(decryptedArray).toEqual(testContent);
        expect(decryptedBlob.type).toBe(fileType.type);
      }
    });

    it('should fail with incorrect IV', async () => {
      const testContent = new Uint8Array([1, 2, 3, 4, 5]);
      const testFile = new File([testContent], 'test.txt', { 
        type: 'text/plain' 
      });

      // Encrypt
      const encrypted = await FileEncryption.encryptFile(testFile, testUserKey);

      // Try to decrypt with wrong IV
      const wrongIv = btoa(String.fromCharCode(...new Uint8Array(12).fill(0)));

      await expect(
        FileEncryption.decryptFile(
          encrypted.encryptedFile,
          wrongIv,
          testUserKey,
          encrypted.originalType
        )
      ).rejects.toThrow();
    });

    it('should fail with incorrect key', async () => {
      const testContent = new Uint8Array([1, 2, 3, 4, 5]);
      const testFile = new File([testContent], 'test.txt', { 
        type: 'text/plain' 
      });

      // Encrypt with one key
      const encrypted = await FileEncryption.encryptFile(testFile, testUserKey);

      // Try to decrypt with different key
      const wrongKey = await CapsuleEncryption.getUserEncryptionKey(
        'different-user',
        'different-password'
      );

      await expect(
        FileEncryption.decryptFile(
          encrypted.encryptedFile,
          encrypted.iv,
          wrongKey,
          encrypted.originalType
        )
      ).rejects.toThrow();
    });
  });
});
