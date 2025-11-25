import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { collection, addDoc, query, where, getDocs, doc, deleteDoc, Timestamp } from 'firebase/firestore';
import { storage, db } from '@/integrations/firebase/config';
import { FileEncryption, CapsuleEncryption } from './encryption';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export interface FileMetadata {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: Date;
}

export interface UploadProgress {
  fileIndex: number;
  progress: number;
}

export class FileService {
  // Supported file types
  private static readonly SUPPORTED_IMAGE_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml'
  ];

  private static readonly SUPPORTED_VIDEO_TYPES = [
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime'
  ];

  private static readonly SUPPORTED_DOCUMENT_TYPES = [
    'application/pdf',
    'text/plain',
    'text/markdown',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  private static readonly SUPPORTED_AUDIO_TYPES = [
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/ogg',
    'audio/webm'
  ];

  // File size limits (in bytes)
  private static readonly MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
  private static readonly MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
  private static readonly MAX_DOCUMENT_SIZE = 25 * 1024 * 1024; // 25MB
  private static readonly MAX_AUDIO_SIZE = 50 * 1024 * 1024; // 50MB
  private static readonly MAX_DEFAULT_SIZE = 10 * 1024 * 1024; // 10MB

  /**
   * Get all supported file types
   */
  private static getAllSupportedTypes(): string[] {
    return [
      ...this.SUPPORTED_IMAGE_TYPES,
      ...this.SUPPORTED_VIDEO_TYPES,
      ...this.SUPPORTED_DOCUMENT_TYPES,
      ...this.SUPPORTED_AUDIO_TYPES
    ];
  }

  /**
   * Get human-readable list of supported formats
   */
  private static getSupportedFormatsMessage(): string {
    return 'Supported formats: Images (JPEG, PNG, GIF, WebP, SVG), Videos (MP4, WebM, OGG, MOV), Documents (PDF, TXT, MD, DOC, DOCX), Audio (MP3, WAV, OGG, WebM)';
  }

  /**
   * Get maximum file size for a given file type
   */
  private static getMaxSizeForType(fileType: string): number {
    if (this.SUPPORTED_IMAGE_TYPES.includes(fileType)) {
      return this.MAX_IMAGE_SIZE;
    }
    if (this.SUPPORTED_VIDEO_TYPES.includes(fileType)) {
      return this.MAX_VIDEO_SIZE;
    }
    if (this.SUPPORTED_DOCUMENT_TYPES.includes(fileType)) {
      return this.MAX_DOCUMENT_SIZE;
    }
    if (this.SUPPORTED_AUDIO_TYPES.includes(fileType)) {
      return this.MAX_AUDIO_SIZE;
    }
    return this.MAX_DEFAULT_SIZE;
  }

  /**
   * Format bytes to human-readable size
   */
  private static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Validate a file before upload
   * Checks file type and size against configured limits
   */
  static validateFile(file: File): ValidationResult {
    // Check if file type is supported
    const supportedTypes = this.getAllSupportedTypes();
    if (!supportedTypes.includes(file.type)) {
      return {
        isValid: false,
        error: `Unsupported file type: ${file.type}. ${this.getSupportedFormatsMessage()}`
      };
    }

    // Check file size
    const maxSize = this.getMaxSizeForType(file.type);
    if (file.size > maxSize) {
      return {
        isValid: false,
        error: `File size exceeds maximum allowed size of ${this.formatBytes(maxSize)}. Your file is ${this.formatBytes(file.size)}.`
      };
    }

    return { isValid: true };
  }

  /**
   * Upload files with encryption and progress tracking
   * Includes retry capability for failed uploads
   */
  static async uploadFiles(
    capsuleId: string,
    files: File[],
    userKey: CryptoKey,
    userId: string,
    onProgress?: (fileIndex: number, progress: number) => void
  ): Promise<void> {
    for (let i = 0; i < files.length; i++) {
      await this.uploadSingleFileWithRetry(
        capsuleId,
        files[i],
        userKey,
        userId,
        i,
        onProgress
      );
    }
  }

  /**
   * Upload a single file with retry capability
   */
  private static async uploadSingleFileWithRetry(
    capsuleId: string,
    file: File,
    userKey: CryptoKey,
    userId: string,
    fileIndex: number,
    onProgress?: (fileIndex: number, progress: number) => void,
    maxRetries: number = 3
  ): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await this.uploadSingleFile(
          capsuleId,
          file,
          userKey,
          userId,
          fileIndex,
          onProgress
        );
        return; // Success, exit retry loop
      } catch (error) {
        lastError = error as Error;
        console.error(`Upload attempt ${attempt + 1} failed for file ${file.name}:`, error);
        
        // If this is not the last attempt, wait before retrying
        if (attempt < maxRetries - 1) {
          // Exponential backoff: 1s, 2s, 4s
          const delayMs = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }

    // All retries failed
    throw new Error(`Failed to upload file ${file.name} after ${maxRetries} attempts: ${lastError?.message}`);
  }

  /**
   * Upload a single file (internal method)
   */
  private static async uploadSingleFile(
    capsuleId: string,
    file: File,
    userKey: CryptoKey,
    userId: string,
    fileIndex: number,
    onProgress?: (fileIndex: number, progress: number) => void
  ): Promise<void> {
    // Validate file before upload
    const validation = this.validateFile(file);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    // Report initial progress
    if (onProgress) {
      onProgress(fileIndex, 0);
    }

    // Encrypt file
    const encryptedFile = await FileEncryption.encryptFile(file, userKey);

    // Report encryption complete (25% progress)
    if (onProgress) {
      onProgress(fileIndex, 25);
    }

    // Upload to Firebase Storage
    const fileName = `${userId}/${capsuleId}/${crypto.randomUUID()}`;
    const storageRef = ref(storage, `capsule-files/${fileName}`);
    
    await uploadBytes(storageRef, encryptedFile.encryptedFile);

    // Report upload complete (75% progress)
    if (onProgress) {
      onProgress(fileIndex, 75);
    }

    // Store file metadata in Firestore
    const encryptedName = await CapsuleEncryption.encryptData(
      encryptedFile.originalName,
      userKey
    );
    const encryptedType = await CapsuleEncryption.encryptData(
      encryptedFile.originalType,
      userKey
    );

    await addDoc(collection(db, 'capsule_files'), {
      capsule_id: capsuleId,
      user_id: userId,
      file_path: fileName,
      name_encrypted: encryptedName.encryptedData,
      name_iv: encryptedName.iv,
      type_encrypted: encryptedType.encryptedData,
      type_iv: encryptedType.iv,
      file_iv: encryptedFile.iv,
      size: file.size,
      created_at: Timestamp.now(),
    });

    // Report complete (100% progress)
    if (onProgress) {
      onProgress(fileIndex, 100);
    }
  }

  /**
   * Download and decrypt a file
   */
  static async downloadFile(
    fileId: string,
    fileName: string,
    filePath: string,
    fileIv: string,
    userKey: CryptoKey,
    originalType: string
  ): Promise<void> {
    try {
      // Get download URL from Firebase Storage
      const storageRef = ref(storage, `capsule-files/${filePath}`);
      const downloadUrl = await getDownloadURL(storageRef);

      // Download encrypted file
      const response = await fetch(downloadUrl);
      const encryptedBlob = await response.blob();

      // Decrypt file
      const decryptedBlob = await FileEncryption.decryptFile(
        encryptedBlob,
        fileIv,
        userKey,
        originalType
      );

      // Trigger browser download
      const url = URL.createObjectURL(decryptedBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download file:', error);
      throw new Error('Failed to download file. Please try again.');
    }
  }

  /**
   * Delete a file from storage and Firestore
   */
  static async deleteFile(fileId: string, filePath: string): Promise<void> {
    try {
      // Delete from Firebase Storage
      const storageRef = ref(storage, `capsule-files/${filePath}`);
      await deleteObject(storageRef);

      // Delete metadata from Firestore
      const fileDocRef = doc(db, 'capsule_files', fileId);
      await deleteDoc(fileDocRef);
    } catch (error) {
      console.error('Failed to delete file:', error);
      throw new Error('Failed to delete file. Please try again.');
    }
  }

  /**
   * Get file metadata by ID
   */
  static async getFileMetadata(
    fileId: string,
    userKey: CryptoKey
  ): Promise<FileMetadata | null> {
    try {
      const fileDocRef = doc(db, 'capsule_files', fileId);
      const fileDoc = await getDocs(query(collection(db, 'capsule_files'), where('__name__', '==', fileId)));

      if (fileDoc.empty) return null;

      const fileData = fileDoc.docs[0].data();

      // Decrypt file name and type
      const name = await CapsuleEncryption.decryptData(
        fileData.name_encrypted,
        fileData.name_iv,
        userKey
      );
      const type = await CapsuleEncryption.decryptData(
        fileData.type_encrypted,
        fileData.type_iv,
        userKey
      );

      return {
        id: fileDoc.docs[0].id,
        name,
        type,
        size: fileData.size,
        uploadedAt: (fileData.created_at as Timestamp).toDate(),
      };
    } catch (error) {
      console.error('Failed to get file metadata:', error);
      return null;
    }
  }
}
