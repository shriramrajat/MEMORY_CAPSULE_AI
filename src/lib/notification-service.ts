import { collection, addDoc, query, where, getDocs, updateDoc, doc, Timestamp, orderBy, getDoc } from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';

export interface NotificationData {
  id: string;
  type: 'unlock' | 'reminder' | 'system';
  title: string;
  message: string;
  capsuleId?: string;
  createdAt: Date;
  isRead: boolean;
}

export class NotificationService {
  /**
   * Request browser notification permissions
   * @returns Promise<boolean> - true if permission granted, false otherwise
   */
  static async requestPermissions(): Promise<boolean> {
    // Check if Notification API is supported
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return false;
    }

    // If already granted, return true
    if (Notification.permission === 'granted') {
      return true;
    }

    // If already denied, return false
    if (Notification.permission === 'denied') {
      return false;
    }

    // Request permission
    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }

  /**
   * Check if browser notifications are denied and fallback is needed
   * @returns boolean - true if permissions are denied and fallback should be used
   */
  static isPermissionDenied(): boolean {
    if (!('Notification' in window)) {
      return true; // Treat unsupported as denied
    }
    return Notification.permission === 'denied';
  }

  /**
   * Store notification fallback preference in Firestore
   * @param userId - User ID to store preference for
   * @param useFallback - Whether to use in-app notifications only
   */
  static async storeFallbackPreference(userId: string, useFallback: boolean): Promise<void> {
    try {
      const userDocRef = doc(db, 'users', userId);
      await updateDoc(userDocRef, {
        'preferences.notification_fallback': useFallback,
      });
    } catch (error) {
      console.error('Error storing fallback preference:', error);
      throw error;
    }
  }

  /**
   * Get notification fallback preference from Firestore
   * @param userId - User ID to get preference for
   * @returns Promise<boolean> - true if using in-app notifications only
   */
  static async getFallbackPreference(userId: string): Promise<boolean> {
    try {
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        return userData.preferences?.notification_fallback || false;
      }
      
      return false;
    } catch (error) {
      console.error('Error getting fallback preference:', error);
      return false;
    }
  }

  /**
   * Send a browser notification
   * @param title - Notification title
   * @param body - Notification body text
   * @param data - Optional data to attach to notification
   */
  static sendBrowserNotification(title: string, body: string, data?: Record<string, unknown>): void {
    // Check if notifications are supported and permitted
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return;
    }

    if (Notification.permission !== 'granted') {
      console.warn('Notification permission not granted - falling back to in-app notifications only');
      return;
    }

    try {
      const notification = new Notification(title, {
        body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        data,
      });

      // Optional: Handle notification click
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } catch (error) {
      console.error('Error sending browser notification:', error);
    }
  }

  /**
   * Check for unlocked capsules and send notifications
   * This would typically be called on login or periodically
   * @param userId - User ID to check capsules for
   * @param capsules - Array of user's capsules to check
   * @returns Array of capsule IDs that were newly unlocked
   */
  static async checkAndNotifyUnlocks(
    userId: string,
    capsules: Array<{ id: string; title: string; unlockDate: Date; isUnlocked: boolean }>
  ): Promise<string[]> {
    const newlyUnlockedIds: string[] = [];
    const now = new Date();

    for (const capsule of capsules) {
      // Check if capsule should be unlocked but isn't marked as such
      const shouldBeUnlocked = now >= capsule.unlockDate;
      
      if (shouldBeUnlocked && !capsule.isUnlocked) {
        newlyUnlockedIds.push(capsule.id);

        // Create in-app notification
        try {
          await this.createInAppNotification(
            userId,
            'unlock',
            'Memory Unlocked! 🎉',
            `Your capsule "${capsule.title}" is now ready to read`,
            capsule.id
          );

          // Send browser notification if permitted
          this.sendBrowserNotification(
            'Memory Unlocked! 🎉',
            `Your capsule "${capsule.title}" is now ready to read`,
            { capsuleId: capsule.id, type: 'unlock' }
          );
        } catch (error) {
          console.error(`Failed to create notification for capsule ${capsule.id}:`, error);
          // Continue with other capsules even if one fails
        }
      }
    }

    return newlyUnlockedIds;
  }

  /**
   * Get pending notifications for a user
   * @param userId - User ID to fetch notifications for
   * @returns Promise<NotificationData[]> - Array of notifications
   */
  static async getPendingNotifications(userId: string): Promise<NotificationData[]> {
    try {
      const notificationsQuery = query(
        collection(db, 'notifications'),
        where('user_id', '==', userId),
        where('is_read', '==', false),
        orderBy('created_at', 'desc')
      );

      const querySnapshot = await getDocs(notificationsQuery);
      
      const notifications: NotificationData[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        notifications.push({
          id: doc.id,
          type: data.type,
          title: data.title,
          message: data.message,
          capsuleId: data.capsule_id,
          createdAt: (data.created_at as Timestamp).toDate(),
          isRead: data.is_read,
        });
      });

      return notifications;
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }
  }

  /**
   * Mark a notification as read
   * @param notificationId - ID of the notification to mark as read
   */
  static async markAsRead(notificationId: string): Promise<void> {
    try {
      const notificationRef = doc(db, 'notifications', notificationId);
      await updateDoc(notificationRef, {
        is_read: true,
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * Create an in-app notification in Firestore
   * @param userId - User ID to create notification for
   * @param type - Type of notification
   * @param title - Notification title
   * @param message - Notification message
   * @param capsuleId - Optional capsule ID
   */
  static async createInAppNotification(
    userId: string,
    type: 'unlock' | 'reminder' | 'system',
    title: string,
    message: string,
    capsuleId?: string
  ): Promise<void> {
    try {
      await addDoc(collection(db, 'notifications'), {
        user_id: userId,
        type,
        title,
        message,
        capsule_id: capsuleId || null,
        is_read: false,
        created_at: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error creating in-app notification:', error);
      throw error;
    }
  }
}
