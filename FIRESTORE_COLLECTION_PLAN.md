# Firestore Database Collection Plan

## Overview
This document outlines the Firestore database structure for the Memory Capsule application. All data is encrypted client-side before being stored in Firestore, ensuring maximum security and privacy.

---

## Collections

### 1. `capsules`
**Description**: Stores encrypted time capsule data for users.

**Document Structure**:
```typescript
{
  user_id: string,              // Firebase Auth UID
  title_encrypted: string,      // Base64 encoded encrypted title
  title_iv: string,             // Base64 encoded IV for title decryption
  content_encrypted: string,    // Base64 encoded encrypted content
  content_iv: string,           // Base64 encoded IV for content decryption
  unlock_date: Timestamp,       // When the capsule should be unlocked
  capsule_type: 'text' | 'image' | 'mixed',  // Type of capsule
  is_unlocked: boolean,         // Whether the capsule has been unlocked
  created_at: Timestamp         // When the capsule was created
}
```

**Indexes Required**:
- `user_id` (ascending) + `created_at` (descending) - for user's capsule list
- `user_id` (ascending) + `unlock_date` (ascending) - for upcoming unlocks
- `is_unlocked` (ascending) + `unlock_date` (ascending) - for unlock queries

**Security Rules**:
```javascript
match /capsules/{capsuleId} {
  allow read: if request.auth != null && request.auth.uid == resource.data.user_id;
  allow create: if request.auth != null && request.auth.uid == request.resource.data.user_id;
  allow update: if request.auth != null && request.auth.uid == resource.data.user_id;
  allow delete: if request.auth != null && request.auth.uid == resource.data.user_id;
}
```

---

### 2. `capsule_files`
**Description**: Stores metadata for files attached to capsules. Actual encrypted files are stored in Firebase Storage.

**Document Structure**:
```typescript
{
  capsule_id: string,           // Reference to capsule document ID
  user_id: string,              // Firebase Auth UID
  file_path: string,            // Storage path: userId/capsuleId/uuid
  name_encrypted: string,       // Base64 encoded encrypted file name
  name_iv: string,             // Base64 encoded IV for name decryption
  type_encrypted: string,       // Base64 encoded encrypted file MIME type
  type_iv: string,              // Base64 encoded IV for type decryption
  file_iv: string,              // Base64 encoded IV for file decryption
  created_at: Timestamp         // When the file was uploaded
}
```

**Indexes Required**:
- `capsule_id` (ascending) + `user_id` (ascending) - for capsule file queries
- `user_id` (ascending) + `created_at` (descending) - for user's file list

**Security Rules**:
```javascript
match /capsule_files/{fileId} {
  allow read: if request.auth != null && request.auth.uid == resource.data.user_id;
  allow create: if request.auth != null && request.auth.uid == request.resource.data.user_id;
  allow update: if request.auth != null && request.auth.uid == resource.data.user_id;
  allow delete: if request.auth != null && request.auth.uid == resource.data.user_id;
}
```

---

### 3. `users` (Optional - for extended user profiles)
**Description**: Optional collection for storing additional user profile information.

**Document Structure**:
```typescript
{
  user_id: string,              // Firebase Auth UID (document ID)
  email: string,                // User's email (from Auth)
  display_name: string,         // User's display name
  created_at: Timestamp,        // Account creation date
  last_login: Timestamp,        // Last login timestamp
  preferences: {
    theme: 'light' | 'dark' | 'auto',
    notifications_enabled: boolean,
    // ... other preferences
  }
}
```

**Security Rules**:
```javascript
match /users/{userId} {
  allow read: if request.auth != null && request.auth.uid == userId;
  allow create: if request.auth != null && request.auth.uid == userId;
  allow update: if request.auth != null && request.auth.uid == userId;
  allow delete: if request.auth != null && request.auth.uid == userId;
}
```

---

## Firebase Storage Structure

### Storage Bucket: `capsule-files/`

**Path Structure**:
```
capsule-files/
  └── {userId}/
      └── {capsuleId}/
          └── {uuid}  (encrypted file)
```

**Security Rules**:
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /capsule-files/{userId}/{capsuleId}/{fileName} {
      // Users can only access their own files
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && request.auth.uid == userId;
      allow delete: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## Firestore Security Rules (Complete)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Capsules collection
    match /capsules/{capsuleId} {
      allow read: if request.auth != null && request.auth.uid == resource.data.user_id;
      allow create: if request.auth != null && 
                       request.auth.uid == request.resource.data.user_id &&
                       request.resource.data.keys().hasAll(['user_id', 'title_encrypted', 'title_iv', 'content_encrypted', 'content_iv', 'unlock_date', 'capsule_type', 'is_unlocked', 'created_at']);
      allow update: if request.auth != null && 
                       request.auth.uid == resource.data.user_id &&
                       request.resource.data.user_id == resource.data.user_id;
      allow delete: if request.auth != null && request.auth.uid == resource.data.user_id;
    }
    
    // Capsule files collection
    match /capsule_files/{fileId} {
      allow read: if request.auth != null && request.auth.uid == resource.data.user_id;
      allow create: if request.auth != null && 
                       request.auth.uid == request.resource.data.user_id &&
                       request.resource.data.keys().hasAll(['capsule_id', 'user_id', 'file_path', 'name_encrypted', 'name_iv', 'type_encrypted', 'type_iv', 'file_iv', 'created_at']);
      allow update: if request.auth != null && 
                       request.auth.uid == resource.data.user_id &&
                       request.resource.data.user_id == resource.data.user_id;
      allow delete: if request.auth != null && request.auth.uid == resource.data.user_id;
    }
    
    // Users collection (if implemented)
    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow create: if request.auth != null && request.auth.uid == userId;
      allow update: if request.auth != null && request.auth.uid == userId;
      allow delete: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## Data Flow

### Creating a Capsule:
1. User creates capsule with title, content, unlock date
2. Client encrypts title and content using user's encryption key
3. Encrypted data + IVs stored in `capsules` collection
4. If files attached, encrypt and upload to Storage, store metadata in `capsule_files`

### Reading a Capsule:
1. Query `capsules` collection filtered by `user_id`
2. For each capsule, decrypt title and content using user's encryption key
3. Check `unlock_date` to determine if content should be shown
4. If unlocked, fetch associated files from `capsule_files` and decrypt

### Unlocking a Capsule:
1. Background job or client-side check compares current date with `unlock_date`
2. If date reached, update `is_unlocked` field to `true`
3. User can now view full decrypted content

---

## Indexes to Create in Firestore Console

1. **Collection**: `capsules`
   - Fields: `user_id` (Ascending), `created_at` (Descending)

2. **Collection**: `capsules`
   - Fields: `user_id` (Ascending), `unlock_date` (Ascending)

3. **Collection**: `capsule_files`
   - Fields: `capsule_id` (Ascending), `user_id` (Ascending)

4. **Collection**: `capsule_files`
   - Fields: `user_id` (Ascending), `created_at` (Descending)

---

## Migration Notes

- All data is encrypted client-side before storage
- No plaintext sensitive data is stored in Firestore
- User encryption keys are derived from password + user ID (never stored)
- Timestamps use Firestore `Timestamp` type for consistency
- File paths follow hierarchical structure for easy organization

---

## Future Enhancements

1. **Analytics Collection**: Track capsule creation, unlock events
2. **Notifications Collection**: Store notification preferences and scheduled notifications
3. **Sharing Collection**: If sharing features are added, store sharing permissions
4. **AI Reflections Collection**: Store AI-generated reflections on capsules (if implemented)

---

## Setup Instructions

1. **Enable Firestore**: Go to Firebase Console → Firestore Database → Create Database
2. **Set Security Rules**: Copy the security rules above to Firestore Rules tab
3. **Create Indexes**: Create the indexes listed above (Firestore will prompt you if needed)
4. **Enable Storage**: Go to Firebase Console → Storage → Get Started
5. **Set Storage Rules**: Copy the storage rules above to Storage Rules tab
6. **Enable Authentication**: Go to Firebase Console → Authentication → Sign-in method → Enable Email/Password

---

## Testing Checklist

- [ ] Create a capsule with text only
- [ ] Create a capsule with files
- [ ] Retrieve user's capsules list
- [ ] Retrieve specific capsule by ID
- [ ] Verify encryption/decryption works correctly
- [ ] Test unlock date functionality
- [ ] Verify security rules prevent unauthorized access
- [ ] Test file upload and download
- [ ] Test user authentication flow

