# API Documentation

This document provides comprehensive API documentation for all services in the Memory Capsule AI application.

## Table of Contents

- [SecureCapsuleDB](#securecapsuledb)
- [FileService](#fileservice)
- [AIService](#aiservice)
- [AudioService](#audioservice)
- [NotificationService](#notificationservice)
- [CapsuleEncryption](#capsuleencryption)
- [FileEncryption](#fileencryption)

---

## SecureCapsuleDB

The main database service for managing encrypted capsules in Firebase Firestore.

### Methods

#### `createCapsule()`

Create a new encrypted capsule with optional file attachments.

```typescript
static async createCapsule(
  title: string,
  content: string,
  unlockDate: Date,
  type: 'text' | 'image' | 'mixed',
  userKey: CryptoKey,
  userId: string,
  files?: File[]
): Promise<string>
```

**Parameters:**
- `title` - Capsule title (will be encrypted)
- `content` - Capsule content (will be encrypted)
- `unlockDate` - Date when capsule should unlock
- `type` - Type of capsule content
- `userKey` - User's encryption key
- `userId` - Firebase Auth user ID
- `files` - Optional array of files to attach

**Returns:** Promise resolving to the created capsule ID

**Example:**
```typescript
const capsuleId = await SecureCapsuleDB.createCapsule(
  'My First Memory',
  'This is a special moment...',
  new Date('2025-12-31'),
  'text',
  userKey,
  userId,
  [imageFile, documentFile]
);
```

---

#### `getUserCapsules()`

Fetch all capsules for a user, decrypted and ready to display.

```typescript
static async getUserCapsules(
  userId: string,
  userKey: CryptoKey
): Promise<DecryptedCapsule[]>
```

**Parameters:**
- `userId` - Firebase Auth user ID
- `userKey` - User's encryption key for decryption

**Returns:** Promise resolving to array of decrypted capsules

**Note:** Automatically checks and updates unlock status for capsules past their unlock date.

---

#### `getCapsuleById()`

Fetch a specific capsule by ID with all associated files.

```typescript
static async getCapsuleById(
  capsuleId: string,
  userId: string,
  userKey: CryptoKey
): Promise<DecryptedCapsule | null>
```

**Parameters:**
- `capsuleId` - ID of the capsule to fetch
- `userId` - Firebase Auth user ID (for ownership verification)
- `userKey` - User's encryption key for decryption

**Returns:** Promise resolving to decrypted capsule or null if not found

---

#### `updateCapsule()`

Update an existing unlocked capsule with new content.

```typescript
static async updateCapsule(
  capsuleId: string,
  userId: string,
  userKey: CryptoKey,
  updates: Partial<{
    title: string;
    content: string;
    unlockDate: Date;
  }>
): Promise<void>
```

**Parameters:**
- `capsuleId` - ID of the capsule to update
- `userId` - Firebase Auth user ID (for ownership verification)
- `userKey` - User's encryption key for re-encryption
- `updates` - Partial object with fields to update

**Throws:** Error if capsule is locked or user doesn't own it

---

#### `deleteCapsule()`

Delete a capsule and all associated files from storage.

```typescript
static async deleteCapsule(
  capsuleId: string,
  userId: string
): Promise<void>
```

**Parameters:**
- `capsuleId` - ID of the capsule to delete
- `userId` - Firebase Auth user ID (for ownership verification)

**Note:** Deletes capsule document, file metadata, and all files from Firebase Storage.

---

#### `searchCapsules()`

Search capsules with semantic understanding and filters.

```typescript
static async searchCapsules(
  query: string,
  userId: string,
  userKey: CryptoKey,
  filters?: SearchFilters
): Promise<SearchResult[]>
```

**Parameters:**
- `query` - Natural language search query
- `userId` - Firebase Auth user ID
- `userKey` - User's encryption key for decryption
- `filters` - Optional filters (date range, sentiment, type, unlock status)

**Returns:** Promise resolving to array of search results with relevance scores

**Example:**
```typescript
const results = await SecureCapsuleDB.searchCapsules(
  'happy birthday memories',
  userId,
  userKey,
  {
    dateRange: { start: new Date('2024-01-01'), end: new Date('2024-12-31') },
    sentiment: 'positive',
    isUnlocked: true
  }
);
```

---

#### `exportCapsule()`

Export a single capsule with all decrypted content and metadata.

```typescript
static async exportCapsule(
  capsuleId: string,
  userId: string,
  userKey: CryptoKey,
  format: 'json' | 'text' = 'json'
): Promise<Blob>
```

**Parameters:**
- `capsuleId` - ID of the capsule to export
- `userId` - Firebase Auth user ID
- `userKey` - User's encryption key for decryption
- `format` - Export format ('json' or 'text')

**Returns:** Promise resolving to Blob containing exported data

---

#### `bulkExportCapsules()`

Export multiple capsules as a ZIP archive.

```typescript
static async bulkExportCapsules(
  capsuleIds: string[],
  userId: string,
  userKey: CryptoKey,
  onProgress?: (progress: number) => void
): Promise<Blob>
```

**Parameters:**
- `capsuleIds` - Array of capsule IDs to export
- `userId` - Firebase Auth user ID
- `userKey` - User's encryption key for decryption
- `onProgress` - Optional callback for progress updates (0-100)

**Returns:** Promise resolving to Blob containing ZIP archive

---

#### `generateShareLink()`

Generate a unique, time-limited sharing link for a capsule.

```typescript
static async generateShareLink(
  capsuleId: string,
  userId: string,
  expirationDays: number = 7
): Promise<{ token: string; expiresAt: Date }>
```

**Parameters:**
- `capsuleId` - ID of the capsule to share
- `userId` - Firebase Auth user ID (for ownership verification)
- `expirationDays` - Number of days until link expires (default: 7)

**Returns:** Promise resolving to object with share token and expiration date

---

#### `getSharedCapsule()`

Retrieve a capsule using a share token (no authentication required).

```typescript
static async getSharedCapsule(
  shareToken: string
): Promise<{ capsule: DecryptedCapsule; isExpired: boolean } | null>
```

**Parameters:**
- `shareToken` - The unique share token from the sharing link

**Returns:** Promise resolving to capsule and expiration status, or null if not found

---

## FileService

Service for handling file uploads, downloads, validation, and encryption.

### Methods

#### `validateFile()`

Validate a file before upload (type and size checks).

```typescript
static validateFile(file: File): ValidationResult
```

**Parameters:**
- `file` - File object to validate

**Returns:** Validation result with `isValid` boolean and optional `error` message

**Supported File Types:**
- Images: JPEG, PNG, GIF, WebP, SVG (max 10MB)
- Videos: MP4, WebM, OGG, MOV (max 100MB)
- Documents: PDF, TXT, MD, DOC, DOCX (max 25MB)
- Audio: MP3, WAV, OGG, WebM (max 50MB)

---

#### `uploadFiles()`

Upload multiple files with encryption and progress tracking.

```typescript
static async uploadFiles(
  capsuleId: string,
  files: File[],
  userKey: CryptoKey,
  userId: string,
  onProgress?: (fileIndex: number, progress: number) => void
): Promise<void>
```

**Parameters:**
- `capsuleId` - ID of the capsule to attach files to
- `files` - Array of files to upload
- `userKey` - User's encryption key
- `userId` - Firebase Auth user ID
- `onProgress` - Optional callback for progress updates (0-100 per file)

**Features:**
- Automatic retry on failure (up to 3 attempts)
- Exponential backoff between retries
- Progress tracking for each file
- Automatic validation before upload

---

#### `downloadFile()`

Download and decrypt a file from storage.

```typescript
static async downloadFile(
  fileId: string,
  fileName: string,
  filePath: string,
  fileIv: string,
  userKey: CryptoKey,
  originalType: string
): Promise<void>
```

**Parameters:**
- `fileId` - Firestore document ID of the file
- `fileName` - Original file name for download
- `filePath` - Firebase Storage path
- `fileIv` - Initialization vector for decryption
- `userKey` - User's encryption key
- `originalType` - Original MIME type

**Note:** Automatically triggers browser download after decryption.

---

#### `deleteFile()`

Delete a file from both Storage and Firestore.

```typescript
static async deleteFile(
  fileId: string,
  filePath: string
): Promise<void>
```

**Parameters:**
- `fileId` - Firestore document ID of the file
- `filePath` - Firebase Storage path

---

## AIService

Service for AI-powered features using Google Gemini API.

### Methods

#### `analyzeCapsuleContent()`

Analyze capsule content for sentiment, themes, and key phrases.

```typescript
async analyzeCapsuleContent(content: string): Promise<AIAnalysis>
```

**Parameters:**
- `content` - Text content to analyze

**Returns:** Promise resolving to AI analysis with sentiment, score, themes, and key phrases

---

#### `generateSummary()`

Generate a concise summary of capsule content.

```typescript
async generateSummary(content: string): Promise<string>
```

**Parameters:**
- `content` - Text content to summarize

**Returns:** Promise resolving to summary string

---

#### `generateReflection()`

Generate insights and patterns across multiple capsules.

```typescript
async generateReflection(capsules: DecryptedCapsule[]): Promise<AIReflection>
```

**Parameters:**
- `capsules` - Array of capsules to analyze

**Returns:** Promise resolving to reflection with overall sentiment, patterns, insights, and recommendations

---

#### `transcribeAudio()`

Transcribe audio recording to text.

```typescript
async transcribeAudio(audioBlob: Blob): Promise<string>
```

**Parameters:**
- `audioBlob` - Audio blob to transcribe

**Returns:** Promise resolving to transcribed text

---

#### `semanticSearch()`

Perform semantic search across capsules using AI embeddings.

```typescript
async semanticSearch(
  query: string,
  capsules: DecryptedCapsule[]
): Promise<SearchResult[]>
```

**Parameters:**
- `query` - Natural language search query
- `capsules` - Array of capsules to search

**Returns:** Promise resolving to array of search results with relevance scores

---

## AudioService

Service for audio recording and playback.

### Methods

#### `requestPermissions()`

Request microphone permissions from the browser.

```typescript
async requestPermissions(): Promise<boolean>
```

**Returns:** Promise resolving to true if permission granted

---

#### `startRecording()`

Start recording audio from the microphone.

```typescript
async startRecording(): Promise<void>
```

**Throws:** Error if permissions not granted or recording fails

---

#### `stopRecording()`

Stop recording and return the audio blob.

```typescript
async stopRecording(): Promise<Blob>
```

**Returns:** Promise resolving to audio blob

---

#### `getRecordingDuration()`

Get current recording duration in seconds.

```typescript
getRecordingDuration(): number
```

**Returns:** Duration in seconds

---

#### `getAudioLevel()`

Get current audio level for visualization (0-100).

```typescript
getAudioLevel(): number
```

**Returns:** Audio level from 0 to 100

---

#### `playAudio()`

Play an audio blob.

```typescript
async playAudio(blob: Blob): Promise<void>
```

**Parameters:**
- `blob` - Audio blob to play

---

#### `stopAudio()`

Stop audio playback.

```typescript
stopAudio(): void
```

---

## NotificationService

Service for browser and in-app notifications.

### Methods

#### `requestPermissions()`

Request browser notification permissions.

```typescript
static async requestPermissions(): Promise<boolean>
```

**Returns:** Promise resolving to true if permission granted

---

#### `sendBrowserNotification()`

Send a browser notification (if permissions granted).

```typescript
static sendBrowserNotification(
  title: string,
  body: string,
  data?: any
): void
```

**Parameters:**
- `title` - Notification title
- `body` - Notification body text
- `data` - Optional data to attach

---

#### `checkAndNotifyUnlocks()`

Check for newly unlocked capsules and send notifications.

```typescript
static async checkAndNotifyUnlocks(
  userId: string,
  capsules: Array<{
    id: string;
    title: string;
    unlockDate: Date;
    isUnlocked: boolean;
  }>
): Promise<string[]>
```

**Parameters:**
- `userId` - Firebase Auth user ID
- `capsules` - Array of user's capsules to check

**Returns:** Promise resolving to array of newly unlocked capsule IDs

---

#### `getPendingNotifications()`

Get all unread notifications for a user.

```typescript
static async getPendingNotifications(
  userId: string
): Promise<NotificationData[]>
```

**Parameters:**
- `userId` - Firebase Auth user ID

**Returns:** Promise resolving to array of notifications

---

#### `markAsRead()`

Mark a notification as read.

```typescript
static async markAsRead(notificationId: string): Promise<void>
```

**Parameters:**
- `notificationId` - ID of the notification to mark as read

---

#### `createInAppNotification()`

Create an in-app notification in Firestore.

```typescript
static async createInAppNotification(
  userId: string,
  type: 'unlock' | 'reminder' | 'system',
  title: string,
  message: string,
  capsuleId?: string
): Promise<void>
```

**Parameters:**
- `userId` - Firebase Auth user ID
- `type` - Type of notification
- `title` - Notification title
- `message` - Notification message
- `capsuleId` - Optional capsule ID to link to

---

## CapsuleEncryption

Static utility class for encrypting and decrypting text data.

### Methods

#### `encryptData()`

Encrypt text data using AES-GCM.

```typescript
static async encryptData(
  data: string,
  key: CryptoKey
): Promise<{ encryptedData: string; iv: string }>
```

**Parameters:**
- `data` - Text to encrypt
- `key` - Encryption key

**Returns:** Promise resolving to encrypted data and IV (both base64 encoded)

---

#### `decryptData()`

Decrypt text data using AES-GCM.

```typescript
static async decryptData(
  encryptedData: string,
  iv: string,
  key: CryptoKey
): Promise<string>
```

**Parameters:**
- `encryptedData` - Base64 encoded encrypted data
- `iv` - Base64 encoded initialization vector
- `key` - Decryption key

**Returns:** Promise resolving to decrypted text

---

## FileEncryption

Static utility class for encrypting and decrypting files.

### Methods

#### `encryptFile()`

Encrypt a file using AES-GCM.

```typescript
static async encryptFile(
  file: File,
  key: CryptoKey
): Promise<{
  encryptedFile: Blob;
  iv: string;
  originalName: string;
  originalType: string;
}>
```

**Parameters:**
- `file` - File to encrypt
- `key` - Encryption key

**Returns:** Promise resolving to encrypted file blob, IV, and original metadata

---

#### `decryptFile()`

Decrypt a file using AES-GCM.

```typescript
static async decryptFile(
  encryptedBlob: Blob,
  iv: string,
  key: CryptoKey,
  originalType: string
): Promise<Blob>
```

**Parameters:**
- `encryptedBlob` - Encrypted file blob
- `iv` - Base64 encoded initialization vector
- `key` - Decryption key
- `originalType` - Original MIME type

**Returns:** Promise resolving to decrypted file blob

---

## Type Definitions

### DecryptedCapsule

```typescript
interface DecryptedCapsule {
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
```

### SearchFilters

```typescript
interface SearchFilters {
  dateRange?: { start: Date; end: Date };
  sentiment?: 'positive' | 'neutral' | 'negative';
  type?: 'text' | 'image' | 'mixed';
  isUnlocked?: boolean;
}
```

### SearchResult

```typescript
interface SearchResult {
  capsule: DecryptedCapsule;
  relevanceScore: number;
  matchedContent: string;
}
```

### AIAnalysis

```typescript
interface AIAnalysis {
  sentiment: 'positive' | 'neutral' | 'negative';
  sentimentScore: number; // 0-1
  themes: string[];
  keyPhrases: string[];
  summary: string;
}
```

### AIReflection

```typescript
interface AIReflection {
  overallSentiment: string;
  patterns: string[];
  insights: string[];
  recommendations: string[];
}
```

---

## Error Handling

All service methods may throw errors. Always wrap calls in try-catch blocks:

```typescript
try {
  const capsules = await SecureCapsuleDB.getUserCapsules(userId, userKey);
} catch (error) {
  console.error('Failed to fetch capsules:', error);
  // Handle error appropriately
}
```

Common error scenarios:
- **Network errors**: Firebase connection issues
- **Permission errors**: User doesn't own the resource
- **Encryption errors**: Invalid key or corrupted data
- **Validation errors**: Invalid input data
- **Not found errors**: Resource doesn't exist

---

## Best Practices

1. **Always validate user input** before calling service methods
2. **Handle errors gracefully** with user-friendly messages
3. **Use progress callbacks** for long-running operations
4. **Cache encryption keys** securely in memory (never in localStorage)
5. **Clean up resources** (e.g., stop audio recording when component unmounts)
6. **Test with real Firebase emulators** during development
7. **Monitor API usage** for AI services to avoid quota issues

---

For more information, see the [main README](../README.md) or [Environment Configuration Guide](../ENVIRONMENT.md).
