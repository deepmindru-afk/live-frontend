/**
 * Recording Storage Utility
 * Uses IndexedDB to store recordings locally until successful upload
 * Auto-deletes after successful upload
 * Provides retry mechanism for failed uploads
 */

interface RecordingMetadata {
  id: string;
  meetingId: string;
  userId: string;
  meetingName: string;
  blob: Blob;
  createdAt: number;
  uploadAttempts: number;
  lastUploadAttempt: number;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
}

const DB_NAME = 'HRDeRecordings';
const DB_VERSION = 1;
const STORE_NAME = 'recordings';

class RecordingStorage {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  private async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB not supported'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error(`IndexedDB error: ${request.error}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('meetingId', 'meetingId', { unique: false });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Save recording to IndexedDB before upload
   */
  async saveRecording(
    blob: Blob,
    meetingId: string,
    userId: string,
    meetingName: string
  ): Promise<string> {
    await this.init();

    const id = `recording_${meetingId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const metadata: RecordingMetadata = {
      id,
      meetingId,
      userId,
      meetingName,
      blob,
      createdAt: Date.now(),
      uploadAttempts: 0,
      lastUploadAttempt: 0,
      status: 'pending',
    };

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(metadata);

      request.onsuccess = () => {
        console.log(`[RecordingStorage] ✅ Saved recording to IndexedDB: ${id}`);
        resolve(id);
      };

      request.onerror = () => {
        reject(new Error(`Failed to save recording: ${request.error}`));
      };
    });
  }

  /**
   * Get recording from IndexedDB
   */
  async getRecording(id: string): Promise<RecordingMetadata | null> {
    await this.init();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(new Error(`Failed to get recording: ${request.error}`));
      };
    });
  }

  /**
   * Update recording status
   */
  async updateRecordingStatus(
    id: string,
    status: RecordingMetadata['status'],
    incrementAttempts = false
  ): Promise<void> {
    await this.init();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const metadata = getRequest.result;
        if (!metadata) {
          reject(new Error('Recording not found'));
          return;
        }

        metadata.status = status;
        if (incrementAttempts) {
          metadata.uploadAttempts += 1;
        }
        metadata.lastUploadAttempt = Date.now();

        const putRequest = store.put(metadata);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(new Error(`Failed to update: ${putRequest.error}`));
      };

      getRequest.onerror = () => {
        reject(new Error(`Failed to get recording: ${getRequest.error}`));
      };
    });
  }

  /**
   * Delete recording from IndexedDB after successful upload
   */
  async deleteRecording(id: string): Promise<void> {
    await this.init();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => {
        console.log(`[RecordingStorage] ✅ Deleted recording from IndexedDB: ${id}`);
        resolve();
      };

      request.onerror = () => {
        reject(new Error(`Failed to delete recording: ${request.error}`));
      };
    });
  }

  /**
   * Get all pending recordings (for retry mechanism)
   */
  async getPendingRecordings(): Promise<RecordingMetadata[]> {
    await this.init();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('status');
      const request = index.getAll('pending');

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(new Error(`Failed to get pending recordings: ${request.error}`));
      };
    });
  }

  /**
   * Get all failed recordings (for retry mechanism)
   */
  async getFailedRecordings(): Promise<RecordingMetadata[]> {
    await this.init();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('status');
      const request = index.getAll('failed');

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(new Error(`Failed to get failed recordings: ${request.error}`));
      };
    });
  }

  /**
   * Clean up old completed recordings (older than 7 days)
   */
  async cleanupOldRecordings(): Promise<void> {
    await this.init();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('status');
      const request = index.getAll('completed');

      request.onsuccess = () => {
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const recordings = request.result || [];
        let deletedCount = 0;

        recordings.forEach((recording: RecordingMetadata) => {
          if (recording.createdAt < sevenDaysAgo) {
            store.delete(recording.id);
            deletedCount++;
          }
        });

        console.log(`[RecordingStorage] 🧹 Cleaned up ${deletedCount} old recordings`);
        resolve();
      };

      request.onerror = () => {
        reject(new Error(`Failed to cleanup: ${request.error}`));
      };
    });
  }

  /**
   * Get storage usage info
   */
  async getStorageInfo(): Promise<{ count: number; totalSize: number }> {
    await this.init();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const recordings = request.result || [];
        let totalSize = 0;
        recordings.forEach((recording: RecordingMetadata) => {
          totalSize += recording.blob.size;
        });

        resolve({
          count: recordings.length,
          totalSize,
        });
      };

      request.onerror = () => {
        reject(new Error(`Failed to get storage info: ${request.error}`));
      };
    });
  }
}

export const recordingStorage = new RecordingStorage();

