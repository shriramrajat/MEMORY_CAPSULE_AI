
// Encryption utilities for secure time capsule data
export class CapsuleEncryption {
  /**
   * Derives a cryptographic key from a password using PBKDF2
   * Uses 100,000 iterations for strong key derivation
   * @param password - User's master password
   * @param salt - Random salt for key derivation
   * @returns AES-GCM 256-bit encryption key
   */
  private static async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    // Import password as key material for PBKDF2
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    // Derive AES-GCM key using PBKDF2 with 100k iterations
    return window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }

  static async generateSalt(): Promise<Uint8Array> {
    return window.crypto.getRandomValues(new Uint8Array(16));
  }

  static async encryptData(data: string, userKey: CryptoKey): Promise<{
    encryptedData: string;
    iv: string;
  }> {
    const encoder = new TextEncoder();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    
    const encryptedBuffer = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      userKey,
      encoder.encode(data)
    );

    return {
      encryptedData: btoa(String.fromCharCode(...new Uint8Array(encryptedBuffer))),
      iv: btoa(String.fromCharCode(...iv)),
    };
  }

  static async decryptData(encryptedData: string, iv: string, userKey: CryptoKey): Promise<string> {
    const decoder = new TextDecoder();
    
    const encryptedBuffer = new Uint8Array(
      atob(encryptedData).split('').map(char => char.charCodeAt(0))
    );
    const ivBuffer = new Uint8Array(
      atob(iv).split('').map(char => char.charCodeAt(0))
    );

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivBuffer,
      },
      userKey,
      encryptedBuffer
    );

    return decoder.decode(decryptedBuffer);
  }

  /**
   * Generates a user-specific encryption key from their password
   * Uses deterministic salt based on user ID for consistent key generation
   * This allows the same password to always generate the same key for a user
   * @param userId - Firebase user ID
   * @param masterPassword - User's master password
   * @returns User-specific encryption key
   */
  static async getUserEncryptionKey(userId: string, masterPassword: string): Promise<CryptoKey> {
    // Create deterministic salt from user ID to ensure same key is generated each time
    const userSalt = new TextEncoder().encode(userId + 'capsule_salt_2024');
    const salt = await window.crypto.subtle.digest('SHA-256', userSalt);
    
    return this.deriveKey(masterPassword, new Uint8Array(salt));
  }
}

// File encryption utilities
export class FileEncryption {
  static async encryptFile(file: File, userKey: CryptoKey): Promise<{
    encryptedFile: Blob;
    iv: string;
    originalName: string;
    originalType: string;
  }> {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const fileBuffer = await file.arrayBuffer();
    
    const encryptedBuffer = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      userKey,
      fileBuffer
    );

    return {
      encryptedFile: new Blob([encryptedBuffer]),
      iv: btoa(String.fromCharCode(...iv)),
      originalName: file.name,
      originalType: file.type,
    };
  }

  static async decryptFile(
    encryptedBlob: Blob, 
    iv: string, 
    userKey: CryptoKey,
    originalType: string
  ): Promise<Blob> {
    const encryptedBuffer = await encryptedBlob.arrayBuffer();
    const ivBuffer = new Uint8Array(
      atob(iv).split('').map(char => char.charCodeAt(0))
    );

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivBuffer,
      },
      userKey,
      encryptedBuffer
    );

    return new Blob([decryptedBuffer], { type: originalType });
  }
}
