
// Encryption utilities for secure time capsule data
export class CapsuleEncryption {
  private static async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

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

  static async getUserEncryptionKey(userId: string, masterPassword: string): Promise<CryptoKey> {
    // Use user ID as part of salt for deterministic key derivation
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
