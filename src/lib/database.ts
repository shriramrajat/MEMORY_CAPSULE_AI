
import { createClient } from '@supabase/supabase-js';
import { CapsuleEncryption, FileEncryption } from './encryption';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL!,
  process.env.REACT_APP_SUPABASE_ANON_KEY!
);

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
  files?: Array<{
    id: string;
    name: string;
    type: string;
    url: string;
  }>;
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

    // Insert encrypted capsule
    const { data: capsule, error } = await supabase
      .from('capsules')
      .insert({
        user_id: userId,
        title_encrypted: encryptedTitle.encryptedData,
        title_iv: encryptedTitle.iv,
        content_encrypted: encryptedContent.encryptedData,
        content_iv: encryptedContent.iv,
        unlock_date: unlockDate.toISOString(),
        capsule_type: type,
        is_unlocked: false,
      })
      .select()
      .single();

    if (error) throw error;

    // Handle file uploads if any
    if (files && files.length > 0) {
      await this.uploadCapsuleFiles(capsule.id, files, userKey, userId);
    }

    return capsule.id;
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
      
      // Upload to Supabase Storage
      const fileName = `${userId}/${capsuleId}/${crypto.randomUUID()}`;
      const { error: uploadError } = await supabase.storage
        .from('capsule-files')
        .upload(fileName, encryptedFile.encryptedFile);

      if (uploadError) throw uploadError;

      // Store file metadata
      const encryptedName = await CapsuleEncryption.encryptData(
        encryptedFile.originalName,
        userKey
      );
      const encryptedType = await CapsuleEncryption.encryptData(
        encryptedFile.originalType,
        userKey
      );

      const { error: metadataError } = await supabase
        .from('capsule_files')
        .insert({
          capsule_id: capsuleId,
          user_id: userId,
          file_path: fileName,
          name_encrypted: encryptedName.encryptedData,
          name_iv: encryptedName.iv,
          type_encrypted: encryptedType.encryptedData,
          type_iv: encryptedType.iv,
          file_iv: encryptedFile.iv,
        });

      if (metadataError) throw metadataError;
    }
  }

  static async getUserCapsules(
    userId: string,
    userKey: CryptoKey
  ): Promise<DecryptedCapsule[]> {
    // Fetch user's encrypted capsules
    const { data: capsules, error } = await supabase
      .from('capsules')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Decrypt and return capsules
    const decryptedCapsules: DecryptedCapsule[] = [];
    
    for (const capsule of capsules) {
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
        const unlockDate = new Date(capsule.unlock_date);
        const isUnlocked = capsule.is_unlocked || new Date() >= unlockDate;

        // Update unlock status if needed
        if (!capsule.is_unlocked && isUnlocked) {
          await supabase
            .from('capsules')
            .update({ is_unlocked: true })
            .eq('id', capsule.id);
        }

        decryptedCapsules.push({
          id: capsule.id,
          title,
          content: isUnlocked ? content : '[Locked until unlock date]',
          unlockDate,
          createdAt: new Date(capsule.created_at),
          isUnlocked,
          type: capsule.capsule_type,
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
    // Fetch specific capsule (with RLS ensuring user can only access their own)
    const { data: capsule, error } = await supabase
      .from('capsules')
      .select('*')
      .eq('id', capsuleId)
      .eq('user_id', userId)
      .single();

    if (error || !capsule) return null;

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

      const unlockDate = new Date(capsule.unlock_date);
      const isUnlocked = capsule.is_unlocked || new Date() >= unlockDate;

      // Get associated files
      const files = await this.getCapsuleFiles(capsuleId, userId, userKey);

      return {
        id: capsule.id,
        title,
        content: isUnlocked ? content : '[Locked until unlock date]',
        unlockDate,
        createdAt: new Date(capsule.created_at),
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
  ): Promise<Array<{ id: string; name: string; type: string; url: string }>> {
    const { data: fileMetadata, error } = await supabase
      .from('capsule_files')
      .select('*')
      .eq('capsule_id', capsuleId)
      .eq('user_id', userId);

    if (error || !fileMetadata) return [];

    const files = [];
    for (const file of fileMetadata) {
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

        // Create secure download URL
        const { data: urlData } = await supabase.storage
          .from('capsule-files')
          .createSignedUrl(file.file_path, 3600); // 1 hour expiry

        if (urlData?.signedUrl) {
          files.push({
            id: file.id,
            name,
            type,
            url: urlData.signedUrl,
          });
        }
      } catch (decryptionError) {
        console.error('Failed to decrypt file metadata:', file.id, decryptionError);
      }
    }

    return files;
  }
}
