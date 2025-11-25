
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  getDoc, 
  doc, 
  updateDoc,
  deleteDoc,
  Timestamp,
  orderBy
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '@/integrations/firebase/config';
import { CapsuleEncryption, FileEncryption } from './encryption';
import { aiService, type SearchResult } from './ai-service';
import JSZip from 'jszip';

export interface EncryptedCapsule {
  id: string;
  user_id: string;
  title_encrypted: string;
  title_iv: string;
  content_encrypted: string;
  content_iv: string;
  unlock_date: string;
  created_at: string;
  is_unlocked: boolean;
  capsule_type: 'text' | 'image' | 'mixed';
}

export interface DecryptedCapsule {
  id: string;
  title: string;
  content: string;
  unlockDate: Date;
  createdAt: Date;
  isUnlocked: boolean;
  type: 'text' | 'image' | 'mixed';
  sentiment?: 'positive' | 'neutral' | 'negative';
  sentimentScore?: number;
  themes?: string[];
  summary?: string;
  files?: Array<{
    id: string;
    name: string;
    type: string;
    url: string;
    filePath: string;
    fileIv: string;
  }>;
}

export interface SearchFilters {
  dateRange?: { start: Date; end: Date };
  sentiment?: 'positive' | 'neutral' | 'negative';
  type?: 'text' | 'image' | 'mixed';
  isUnlocked?: boolean;
}

export class SecureCapsuleDB {
  static async createCapsule(
    title: string,
    content: string,
    unlockDate: Date,
    type: 'text' | 'image' | 'mixed',
    userKey: CryptoKey,
    userId: string,
    files?: File[]
  ): Promise<string> {
    // Encrypt title and content
    const encryptedTitle = await CapsuleEncryption.encryptData(title, userKey);
    const encryptedContent = await CapsuleEncryption.encryptData(content, userKey);

    // Insert encrypted capsule into Firestore
    const capsuleRef = await addDoc(collection(db, 'capsules'), {
      user_id: userId,
      title_encrypted: encryptedTitle.encryptedData,
      title_iv: encryptedTitle.iv,
      content_encrypted: encryptedContent.encryptedData,
      content_iv: encryptedContent.iv,
      unlock_date: Timestamp.fromDate(unlockDate),
      capsule_type: type,
      is_unlocked: false,
      created_at: Timestamp.now(),
    });

    // Handle file uploads if any
    if (files && files.length > 0) {
      await this.uploadCapsuleFiles(capsuleRef.id, files, userKey, userId);
    }

    return capsuleRef.id;
  }

  static async uploadCapsuleFiles(
    capsuleId: string,
    files: File[],
    userKey: CryptoKey,
    userId: string
  ): Promise<void> {
    for (const file of files) {
      // Encrypt file
      const encryptedFile = await FileEncryption.encryptFile(file, userKey);
      
      // Upload to Firebase Storage
      const fileName = `${userId}/${capsuleId}/${crypto.randomUUID()}`;
      const storageRef = ref(storage, `capsule-files/${fileName}`);
      await uploadBytes(storageRef, encryptedFile.encryptedFile);

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
        created_at: Timestamp.now(),
      });
    }
  }

  static async getUserCapsules(
    userId: string,
    userKey: CryptoKey
  ): Promise<DecryptedCapsule[]> {
    // Fetch user's encrypted capsules from Firestore
    const capsulesQuery = query(
      collection(db, 'capsules'),
      where('user_id', '==', userId),
      orderBy('created_at', 'desc')
    );
    
    const querySnapshot = await getDocs(capsulesQuery);

    // Decrypt and return capsules
    const decryptedCapsules: DecryptedCapsule[] = [];
    
    for (const docSnapshot of querySnapshot.docs) {
      const capsuleData = docSnapshot.data();
      const capsule = { id: docSnapshot.id, ...capsuleData } as EncryptedCapsule & { id: string };
      
      try {
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

        // Check if capsule should be unlocked
        const unlockDate = (capsule.unlock_date as Timestamp).toDate();
        const isUnlocked = capsule.is_unlocked || new Date() >= unlockDate;

        // Update unlock status if needed
        if (!capsule.is_unlocked && isUnlocked) {
          const capsuleRef = doc(db, 'capsules', capsule.id);
          await updateDoc(capsuleRef, { is_unlocked: true });
        }

        const createdAt = (capsule.created_at as Timestamp).toDate();

        // Decrypt summary if it exists
        let summary: string | undefined;
        if (capsule.summary_encrypted && capsule.summary_iv) {
          try {
            summary = await CapsuleEncryption.decryptData(
              capsule.summary_encrypted,
              capsule.summary_iv,
              userKey
            );
          } catch (err) {
            console.error('Failed to decrypt summary:', err);
          }
        }

        decryptedCapsules.push({
          id: capsule.id,
          title,
          content: isUnlocked ? content : '[Locked until unlock date]',
          unlockDate,
          createdAt,
          isUnlocked,
          type: capsule.capsule_type,
          sentiment: capsule.sentiment,
          sentimentScore: capsule.sentiment_score,
          themes: capsule.themes,
          summary,
        });
      } catch (decryptionError) {
        console.error('Failed to decrypt capsule:', capsule.id, decryptionError);
        // Skip corrupted capsules
      }
    }

    return decryptedCapsules;
  }

  static async getCapsuleById(
    capsuleId: string,
    userId: string,
    userKey: CryptoKey
  ): Promise<DecryptedCapsule | null> {
    // Fetch specific capsule from Firestore
    const capsuleRef = doc(db, 'capsules', capsuleId);
    const capsuleSnap = await getDoc(capsuleRef);

    if (!capsuleSnap.exists()) return null;

    const capsuleData = capsuleSnap.data();
    const capsule = { id: capsuleSnap.id, ...capsuleData } as EncryptedCapsule & { id: string };

    // Verify user owns this capsule
    if (capsule.user_id !== userId) return null;

    try {
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

      const unlockDate = (capsule.unlock_date as Timestamp).toDate();
      const isUnlocked = capsule.is_unlocked || new Date() >= unlockDate;

      // Get associated files
      const files = await this.getCapsuleFiles(capsuleId, userId, userKey);

      const createdAt = (capsule.created_at as Timestamp).toDate();

      return {
        id: capsule.id,
        title,
        content: isUnlocked ? content : '[Locked until unlock date]',
        unlockDate,
        createdAt,
        isUnlocked,
        type: capsule.capsule_type,
        files,
      };
    } catch (decryptionError) {
      console.error('Failed to decrypt capsule:', capsuleId, decryptionError);
      return null;
    }
  }

  static async getCapsuleFiles(
    capsuleId: string,
    userId: string,
    userKey: CryptoKey
  ): Promise<Array<{ id: string; name: string; type: string; url: string; filePath: string; fileIv: string }>> {
    const filesQuery = query(
      collection(db, 'capsule_files'),
      where('capsule_id', '==', capsuleId),
      where('user_id', '==', userId)
    );

    const querySnapshot = await getDocs(filesQuery);

    if (querySnapshot.empty) return [];

    const files = [];
    for (const docSnapshot of querySnapshot.docs) {
      const fileData = docSnapshot.data();
      const file = { id: docSnapshot.id, ...fileData } as {
        id: string;
        name_encrypted: string;
        name_iv: string;
        type_encrypted: string;
        type_iv: string;
        file_path: string;
        file_iv: string;
        size: number;
        created_at: { toDate: () => Date };
      };
      
      try {
        const name = await CapsuleEncryption.decryptData(
          file.name_encrypted,
          file.name_iv,
          userKey
        );
        const type = await CapsuleEncryption.decryptData(
          file.type_encrypted,
          file.type_iv,
          userKey
        );

        // Create download URL from Firebase Storage
        const storageRef = ref(storage, `capsule-files/${file.file_path}`);
        const downloadUrl = await getDownloadURL(storageRef);

        files.push({
          id: file.id,
          name,
          type,
          url: downloadUrl,
          filePath: file.file_path,
          fileIv: file.file_iv,
        });
      } catch (decryptionError) {
        console.error('Failed to decrypt file metadata:', file.id, decryptionError);
      }
    }

    return files;
  }

  static async updateCapsuleSentiment(
    capsuleId: string,
    sentiment: 'positive' | 'neutral' | 'negative',
    sentimentScore: number,
    themes: string[],
    summary: string,
    userKey: CryptoKey
  ): Promise<void> {
    // Encrypt summary
    const encryptedSummary = await CapsuleEncryption.encryptData(summary, userKey);

    // Update capsule document with sentiment analysis
    const capsuleRef = doc(db, 'capsules', capsuleId);
    await updateDoc(capsuleRef, {
      sentiment,
      sentiment_score: sentimentScore,
      themes,
      summary_encrypted: encryptedSummary.encryptedData,
      summary_iv: encryptedSummary.iv,
    });
  }

  /**
   * Search capsules with semantic understanding and filters
   * 
   * @param query - Natural language search query
   * @param userId - User ID to search capsules for
   * @param userKey - Encryption key for decryption
   * @param filters - Optional filters for date range, sentiment, type, and unlock status
   * @returns Array of search results with relevance scores
   */
  static async searchCapsules(
    query: string,
    userId: string,
    userKey: CryptoKey,
    filters?: SearchFilters
  ): Promise<SearchResult[]> {
    // First, get all user capsules
    const allCapsules = await this.getUserCapsules(userId, userKey);

    // Apply filters to narrow down the search space
    let filteredCapsules = allCapsules;

    // Apply date range filter
    if (filters?.dateRange) {
      filteredCapsules = filteredCapsules.filter(capsule => {
        const capsuleDate = capsule.createdAt;
        return capsuleDate >= filters.dateRange!.start && 
               capsuleDate <= filters.dateRange!.end;
      });
    }

    // Apply sentiment filter
    if (filters?.sentiment) {
      filteredCapsules = filteredCapsules.filter(capsule => 
        capsule.sentiment === filters.sentiment
      );
    }

    // Apply type filter
    if (filters?.type) {
      filteredCapsules = filteredCapsules.filter(capsule => 
        capsule.type === filters.type
      );
    }

    // Apply unlock status filter
    if (filters?.isUnlocked !== undefined) {
      filteredCapsules = filteredCapsules.filter(capsule => 
        capsule.isUnlocked === filters.isUnlocked
      );
    }

    // If no capsules remain after filtering, return empty results
    if (filteredCapsules.length === 0) {
      return [];
    }

    // Use AI service for semantic search
    const searchResults = await aiService.semanticSearch(query, filteredCapsules);

    // Sort results by relevance score (descending)
    return searchResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Update an existing capsule with new content
   * 
   * @param capsuleId - ID of the capsule to update
   * @param userId - User ID to verify ownership
   * @param userKey - Encryption key for re-encryption
   * @param updates - Partial updates to apply (title, content, unlockDate)
   */
  static async updateCapsule(
    capsuleId: string,
    userId: string,
    userKey: CryptoKey,
    updates: Partial<{
      title: string;
      content: string;
      unlockDate: Date;
    }>
  ): Promise<void> {
    // First verify the capsule exists and user owns it
    const capsuleRef = doc(db, 'capsules', capsuleId);
    const capsuleSnap = await getDoc(capsuleRef);

    if (!capsuleSnap.exists()) {
      throw new Error('Capsule not found');
    }

    const capsule = capsuleSnap.data();
    if (capsule.user_id !== userId) {
      throw new Error('Unauthorized: You do not own this capsule');
    }

    // Check if capsule is locked
    const unlockDate = (capsule.unlock_date as unknown as Timestamp).toDate();
    const isUnlocked = capsule.is_unlocked || new Date() >= unlockDate;

    if (!isUnlocked) {
      throw new Error('Cannot edit locked capsule');
    }

    // Prepare update object
    const updateData: Record<string, unknown> = {
      updated_at: Timestamp.now(),
    };

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

    // Update unlock date if provided
    if (updates.unlockDate !== undefined) {
      updateData.unlock_date = Timestamp.fromDate(updates.unlockDate);
    }

    // Update the capsule document
    await updateDoc(capsuleRef, updateData);
  }

  /**
   * Delete a capsule and all associated files
   * 
   * @param capsuleId - ID of the capsule to delete
   * @param userId - User ID to verify ownership
   */
  static async deleteCapsule(
    capsuleId: string,
    userId: string
  ): Promise<void> {
    // First verify the capsule exists and user owns it
    const capsuleRef = doc(db, 'capsules', capsuleId);
    const capsuleSnap = await getDoc(capsuleRef);

    if (!capsuleSnap.exists()) {
      throw new Error('Capsule not found');
    }

    const capsule = capsuleSnap.data();
    if (capsule.user_id !== userId) {
      throw new Error('Unauthorized: You do not own this capsule');
    }

    // Get all associated files
    const filesQuery = query(
      collection(db, 'capsule_files'),
      where('capsule_id', '==', capsuleId),
      where('user_id', '==', userId)
    );

    const filesSnapshot = await getDocs(filesQuery);

    // Delete all files from Firebase Storage and Firestore
    const deletionPromises: Promise<void>[] = [];

    for (const fileDoc of filesSnapshot.docs) {
      const fileData = fileDoc.data();
      
      // Delete from Firebase Storage
      const storageRef = ref(storage, `capsule-files/${fileData.file_path}`);
      deletionPromises.push(
        deleteObject(storageRef).catch(err => {
          console.error(`Failed to delete file from storage: ${fileData.file_path}`, err);
          // Continue with other deletions even if one fails
        })
      );

      // Delete file metadata from Firestore
      deletionPromises.push(
        deleteDoc(doc(db, 'capsule_files', fileDoc.id)).catch(err => {
          console.error(`Failed to delete file metadata: ${fileDoc.id}`, err);
        })
      );
    }

    // Wait for all file deletions to complete
    await Promise.all(deletionPromises);

    // Finally, delete the capsule document
    await deleteDoc(capsuleRef);
  }

  /**
   * Export a capsule with all its decrypted content and metadata
   * 
   * @param capsuleId - ID of the capsule to export
   * @param userId - User ID to verify ownership
   * @param userKey - Encryption key for decryption
   * @param format - Export format ('json' or 'text')
   * @returns Blob containing the exported data
   */
  static async exportCapsule(
    capsuleId: string,
    userId: string,
    userKey: CryptoKey,
    format: 'json' | 'text' = 'json'
  ): Promise<Blob> {
    // Fetch the capsule with all its data
    const capsule = await this.getCapsuleById(capsuleId, userId, userKey);

    if (!capsule) {
      throw new Error('Capsule not found or access denied');
    }

    // Fetch additional metadata from Firestore for complete export
    const capsuleRef = doc(db, 'capsules', capsuleId);
    const capsuleSnap = await getDoc(capsuleRef);
    const capsuleData = capsuleSnap.data();

    // Decrypt summary if it exists
    let summary: string | undefined;
    if (capsuleData?.summary_encrypted && capsuleData?.summary_iv) {
      try {
        summary = await CapsuleEncryption.decryptData(
          capsuleData.summary_encrypted,
          capsuleData.summary_iv,
          userKey
        );
      } catch (err) {
        console.error('Failed to decrypt summary:', err);
      }
    }

    // Prepare export data with all metadata
    const exportData = {
      id: capsule.id,
      title: capsule.title,
      content: capsule.content,
      type: capsule.type,
      createdAt: capsule.createdAt.toISOString(),
      unlockDate: capsule.unlockDate.toISOString(),
      isUnlocked: capsule.isUnlocked,
      sentiment: capsuleData?.sentiment,
      sentimentScore: capsuleData?.sentiment_score,
      themes: capsuleData?.themes || [],
      summary: summary,
      files: capsule.files?.map(f => ({
        name: f.name,
        type: f.type,
        url: f.url
      })) || [],
      exportedAt: new Date().toISOString()
    };

    if (format === 'json') {
      // Export as JSON
      const jsonString = JSON.stringify(exportData, null, 2);
      return new Blob([jsonString], { type: 'application/json' });
    } else {
      // Export as formatted text
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
      
      return new Blob([textContent], { type: 'text/plain' });
    }
  }

  /**
   * Generate a unique sharing link for a capsule
   * 
   * @param capsuleId - ID of the capsule to share
   * @param userId - User ID to verify ownership
   * @param expirationDays - Number of days until the link expires (default: 7)
   * @returns Object containing the share token and expiration date
   */
  static async generateShareLink(
    capsuleId: string,
    userId: string,
    expirationDays: number = 7
  ): Promise<{ token: string; expiresAt: Date }> {
    // First verify the capsule exists and user owns it
    const capsuleRef = doc(db, 'capsules', capsuleId);
    const capsuleSnap = await getDoc(capsuleRef);

    if (!capsuleSnap.exists()) {
      throw new Error('Capsule not found');
    }

    const capsule = capsuleSnap.data();
    if (capsule.user_id !== userId) {
      throw new Error('Unauthorized: You do not own this capsule');
    }

    // Generate a unique share token using crypto.randomUUID()
    const shareToken = crypto.randomUUID();

    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expirationDays);

    // Store share metadata in Firestore
    await addDoc(collection(db, 'shared_capsules'), {
      capsule_id: capsuleId,
      user_id: userId,
      share_token: shareToken,
      created_at: Timestamp.now(),
      expires_at: Timestamp.fromDate(expiresAt),
      is_active: true,
    });

    return {
      token: shareToken,
      expiresAt,
    };
  }

  /**
   * Get a shared capsule by its share token
   * 
   * @param shareToken - The unique share token
   * @returns Object containing the capsule and expiration status, or null if not found
   */
  static async getSharedCapsule(
    shareToken: string
  ): Promise<{ capsule: DecryptedCapsule; isExpired: boolean } | null> {
    // Query the shared_capsules collection for the token
    const sharedQuery = query(
      collection(db, 'shared_capsules'),
      where('share_token', '==', shareToken),
      where('is_active', '==', true)
    );

    const sharedSnapshot = await getDocs(sharedQuery);

    if (sharedSnapshot.empty) {
      return null;
    }

    // Get the first matching share record
    const shareDoc = sharedSnapshot.docs[0];
    const shareData = shareDoc.data();

    // Check if the link has expired
    const expiresAt = (shareData.expires_at as unknown as Timestamp).toDate();
    const isExpired = new Date() > expiresAt;

    if (isExpired) {
      return { capsule: null, isExpired: true };
    }

    // Fetch the capsule
    const capsuleRef = doc(db, 'capsules', shareData.capsule_id);
    const capsuleSnap = await getDoc(capsuleRef);

    if (!capsuleSnap.exists()) {
      return null;
    }

    const capsuleData = capsuleSnap.data();
    const capsule = { id: capsuleSnap.id, ...capsuleData } as EncryptedCapsule & { id: string };

    // For shared capsules, we need to decrypt without requiring the user's key
    // This means the capsule must be stored in a way that allows public decryption
    // For now, we'll return the encrypted data as-is and handle decryption differently
    // In a real implementation, you might store a separate decryption key with the share
    
    try {
      // Since we don't have the user's key, we need to handle this differently
      // For the purpose of this implementation, we'll assume the share includes
      // a way to decrypt the content (e.g., a temporary key stored with the share)
      
      // For now, we'll fetch the capsule metadata and return what we can
      const unlockDate = (capsule.unlock_date as Timestamp).toDate();
      const createdAt = (capsule.created_at as Timestamp).toDate();

      // Get associated files (without decryption for now)
      const filesQuery = query(
        collection(db, 'capsule_files'),
        where('capsule_id', '==', shareData.capsule_id)
      );

      const filesSnapshot = await getDocs(filesQuery);
      const files = [];

      for (const fileDoc of filesSnapshot.docs) {
        const fileData = fileDoc.data();
        
        try {
          // Create download URL from Firebase Storage
          const storageRef = ref(storage, `capsule-files/${fileData.file_path}`);
          const downloadUrl = await getDownloadURL(storageRef);

          files.push({
            id: fileDoc.id,
            name: fileData.name_encrypted, // Would need decryption in real implementation
            type: fileData.type_encrypted, // Would need decryption in real implementation
            url: downloadUrl,
            filePath: fileData.file_path,
            fileIv: fileData.file_iv,
          });
        } catch (fileError) {
          console.error('Failed to get file URL:', fileError);
        }
      }

      // Return the capsule with encrypted content
      // In a real implementation, you would store decryption info with the share
      const decryptedCapsule: DecryptedCapsule = {
        id: capsule.id,
        title: capsule.title_encrypted, // Would need decryption
        content: capsule.content_encrypted, // Would need decryption
        unlockDate,
        createdAt,
        isUnlocked: capsule.is_unlocked || new Date() >= unlockDate,
        type: capsule.capsule_type,
        sentiment: capsule.sentiment,
        sentimentScore: capsule.sentiment_score,
        themes: capsule.themes,
        summary: capsule.summary_encrypted, // Would need decryption
        files,
      };

      return { capsule: decryptedCapsule, isExpired: false };
    } catch (error) {
      console.error('Failed to fetch shared capsule:', error);
      return null;
    }
  }

  /**
   * Export multiple capsules as a ZIP archive
   * 
   * @param capsuleIds - Array of capsule IDs to export
   * @param userId - User ID to verify ownership
   * @param userKey - Encryption key for decryption
   * @param onProgress - Optional callback for progress updates (0-100)
   * @returns Blob containing the ZIP archive
   */
  static async bulkExportCapsules(
    capsuleIds: string[],
    userId: string,
    userKey: CryptoKey,
    onProgress?: (progress: number) => void
  ): Promise<Blob> {
    if (capsuleIds.length === 0) {
      throw new Error('No capsules selected for export');
    }

    const zip = new JSZip();
    const totalCapsules = capsuleIds.length;
    let processedCapsules = 0;

    // Process each capsule
    for (const capsuleId of capsuleIds) {
      try {
        // Fetch the capsule with all its data
        const capsule = await this.getCapsuleById(capsuleId, userId, userKey);

        if (!capsule) {
          console.warn(`Capsule ${capsuleId} not found or access denied, skipping`);
          processedCapsules++;
          if (onProgress) {
            onProgress(Math.round((processedCapsules / totalCapsules) * 100));
          }
          continue;
        }

        // Fetch additional metadata from Firestore
        const capsuleRef = doc(db, 'capsules', capsuleId);
        const capsuleSnap = await getDoc(capsuleRef);
        const capsuleData = capsuleSnap.data();

        // Decrypt summary if it exists
        let summary: string | undefined;
        if (capsuleData?.summary_encrypted && capsuleData?.summary_iv) {
          try {
            summary = await CapsuleEncryption.decryptData(
              capsuleData.summary_encrypted,
              capsuleData.summary_iv,
              userKey
            );
          } catch (err) {
            console.error('Failed to decrypt summary:', err);
          }
        }

        // Create a folder for this capsule
        const safeFolderName = capsule.title.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
        const capsuleFolder = zip.folder(`${safeFolderName}_${capsule.id.substring(0, 8)}`);

        if (!capsuleFolder) {
          throw new Error('Failed to create capsule folder in ZIP');
        }

        // Prepare export data
        const exportData = {
          id: capsule.id,
          title: capsule.title,
          content: capsule.content,
          type: capsule.type,
          createdAt: capsule.createdAt.toISOString(),
          unlockDate: capsule.unlockDate.toISOString(),
          isUnlocked: capsule.isUnlocked,
          sentiment: capsuleData?.sentiment,
          sentimentScore: capsuleData?.sentiment_score,
          themes: capsuleData?.themes || [],
          summary: summary,
          files: capsule.files?.map(f => ({
            name: f.name,
            type: f.type
          })) || [],
          exportedAt: new Date().toISOString()
        };

        // Add JSON metadata file
        capsuleFolder.file('metadata.json', JSON.stringify(exportData, null, 2));

        // Add text content file
        let textContent = `${capsule.title}\n`;
        textContent += `${'='.repeat(capsule.title.length)}\n\n`;
        textContent += `Created: ${capsule.createdAt.toLocaleString()}\n`;
        textContent += `Unlock Date: ${capsule.unlockDate.toLocaleString()}\n\n`;
        
        if (summary) {
          textContent += `Summary:\n${summary}\n\n`;
        }
        
        textContent += `Content:\n${capsule.content}\n`;
        
        capsuleFolder.file('content.txt', textContent);

        // Download and add all attached files
        if (capsule.files && capsule.files.length > 0) {
          const filesFolder = capsuleFolder.folder('files');
          
          if (filesFolder) {
            for (const file of capsule.files) {
              try {
                // Get download URL from Firebase Storage
                const storageRef = ref(storage, `capsule-files/${file.filePath}`);
                const downloadUrl = await getDownloadURL(storageRef);

                // Download encrypted file
                const response = await fetch(downloadUrl);
                const encryptedBlob = await response.blob();

                // Decrypt file
                const decryptedBlob = await FileEncryption.decryptFile(
                  encryptedBlob,
                  file.fileIv,
                  userKey,
                  file.type
                );

                // Add decrypted file to ZIP
                filesFolder.file(file.name, decryptedBlob);
              } catch (fileError) {
                console.error(`Failed to download file ${file.name}:`, fileError);
                // Continue with other files even if one fails
              }
            }
          }
        }

        processedCapsules++;
        if (onProgress) {
          onProgress(Math.round((processedCapsules / totalCapsules) * 100));
        }
      } catch (capsuleError) {
        console.error(`Failed to export capsule ${capsuleId}:`, capsuleError);
        processedCapsules++;
        if (onProgress) {
          onProgress(Math.round((processedCapsules / totalCapsules) * 100));
        }
        // Continue with other capsules even if one fails
      }
    }

    // Generate ZIP file
    const zipBlob = await zip.generateAsync({ 
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 6
      }
    });

    return zipBlob;
  }
}
