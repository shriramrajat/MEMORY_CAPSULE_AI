
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  getDoc, 
  doc, 
  updateDoc,
  Timestamp,
  orderBy
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/integrations/firebase/config';
import { CapsuleEncryption, FileEncryption } from './encryption';

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
      const capsule = { id: docSnapshot.id, ...docSnapshot.data() };
      
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

        decryptedCapsules.push({
          id: capsule.id,
          title,
          content: isUnlocked ? content : '[Locked until unlock date]',
          unlockDate,
          createdAt,
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
    // Fetch specific capsule from Firestore
    const capsuleRef = doc(db, 'capsules', capsuleId);
    const capsuleSnap = await getDoc(capsuleRef);

    if (!capsuleSnap.exists()) return null;

    const capsule = { id: capsuleSnap.id, ...capsuleSnap.data() };

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
  ): Promise<Array<{ id: string; name: string; type: string; url: string }>> {
    const filesQuery = query(
      collection(db, 'capsule_files'),
      where('capsule_id', '==', capsuleId),
      where('user_id', '==', userId)
    );

    const querySnapshot = await getDocs(filesQuery);

    if (querySnapshot.empty) return [];

    const files = [];
    for (const docSnapshot of querySnapshot.docs) {
      const file = { id: docSnapshot.id, ...docSnapshot.data() };
      
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
        });
      } catch (decryptionError) {
        console.error('Failed to decrypt file metadata:', file.id, decryptionError);
      }
    }

    return files;
  }
}
