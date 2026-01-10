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
import { db } from '@/integrations/firebase/config';

export interface EncryptedCapsule {
  id: string;
  user_id: string;
  title: string;
  content: string;
  unlock_date: string;
  created_at: string;
  is_unlocked: boolean;
}

export interface DecryptedCapsule {
  id: string;
  title: string;
  content: string;
  unlockDate: Date;
  createdAt: Date;
  isUnlocked: boolean;
}

export interface CreateCapsuleData {
  title: string;
  content: string;
  unlockDate: Date;
}

export class SecureCapsuleDB {
  static async createCapsule(
    userId: string, 
    capsuleData: CreateCapsuleData
  ): Promise<string> {
    const { title, content, unlockDate } = capsuleData;
    
    const capsule = {
      user_id: userId,
      title: title,
      content: content,
      unlock_date: unlockDate.toISOString(),
      created_at: new Date().toISOString(),
      is_unlocked: false
    };

    const docRef = await addDoc(collection(db, 'capsules'), capsule);
    return docRef.id;
  }
  static async getUserCapsules(userId: string): Promise<DecryptedCapsule[]> {
    const q = query(
      collection(db, 'capsules'),
      where('user_id', '==', userId),
      orderBy('created_at', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const capsules: DecryptedCapsule[] = [];
    
    for (const docSnapshot of querySnapshot.docs) {
      const data = docSnapshot.data() as Omit<EncryptedCapsule, 'id'>;
      
      capsules.push({
        id: docSnapshot.id,
        title: data.title,
        content: data.content,
        unlockDate: new Date(data.unlock_date),
        createdAt: new Date(data.created_at),
        isUnlocked: data.is_unlocked
      });
    }
    
    return capsules;
  }

  static async getCapsule(capsuleId: string, userId: string): Promise<DecryptedCapsule | null> {
    const docRef = doc(db, 'capsules', capsuleId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return null;
    }
    
    const data = docSnap.data() as Omit<EncryptedCapsule, 'id'>;
    
    if (data.user_id !== userId) {
      throw new Error('Unauthorized access to capsule');
    }
    
    return {
      id: docSnap.id,
      title: data.title,
      content: data.content,
      unlockDate: new Date(data.unlock_date),
      createdAt: new Date(data.created_at),
      isUnlocked: data.is_unlocked
    };
  }

  static async deleteCapsule(capsuleId: string, userId: string): Promise<void> {
    const capsule = await this.getCapsule(capsuleId, userId);
    if (!capsule) {
      throw new Error('Capsule not found');
    }
    
    await deleteDoc(doc(db, 'capsules', capsuleId));
  }

  static async unlockCapsule(capsuleId: string, userId: string): Promise<void> {
    const capsule = await this.getCapsule(capsuleId, userId);
    if (!capsule) {
      throw new Error('Capsule not found');
    }
    
    await updateDoc(doc(db, 'capsules', capsuleId), {
      is_unlocked: true
    });
  }
}