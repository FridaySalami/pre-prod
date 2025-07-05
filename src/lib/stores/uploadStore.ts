import { writable } from 'svelte/store';

export interface UploadProgress {
  sessionId: string;
  status: 'pending' | 'processing' | 'completed' | 'error' | 'cancelled';
  totalRecords: number;
  processedRecords: number;
  importedRecords: number;
  updatedRecords: number;
  errorCount: number;
  percentage: number;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
  fileName?: string;
  fileSize?: number;
}

export interface UploadSession {
  sessionId: string;
  progress: UploadProgress;
  eventSource?: EventSource;
  canCancel: boolean;
}

// Store for managing active upload sessions
export const uploadSessions = writable<Map<string, UploadSession>>(new Map());

// Store for upload history
export const uploadHistory = writable<UploadProgress[]>([]);

// Utility functions
export const uploadStore = {
  // Start tracking an upload session
  startSession: (sessionId: string, fileName: string, fileSize: number) => {
    const progress: UploadProgress = {
      sessionId,
      status: 'pending',
      totalRecords: 0,
      processedRecords: 0,
      importedRecords: 0,
      updatedRecords: 0,
      errorCount: 0,
      percentage: 0,
      fileName,
      fileSize
    };

    const eventSource = new EventSource(`/api/upload/progress/${sessionId}`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'progress') {
        uploadSessions.update(sessions => {
          const session = sessions.get(sessionId);
          if (session) {
            session.progress = { ...session.progress, ...data };
            sessions.set(sessionId, session);
          }
          return sessions;
        });
      }
    };

    eventSource.onerror = () => {
      uploadSessions.update(sessions => {
        const session = sessions.get(sessionId);
        if (session) {
          session.progress.status = 'error';
          session.progress.errorMessage = 'Connection lost';
          session.eventSource?.close();
          sessions.set(sessionId, session);
        }
        return sessions;
      });
    };

    const session: UploadSession = {
      sessionId,
      progress,
      eventSource,
      canCancel: true
    };

    uploadSessions.update(sessions => {
      sessions.set(sessionId, session);
      return sessions;
    });

    return session;
  },

  // Cancel an upload session
  cancelSession: async (sessionId: string) => {
    try {
      const response = await fetch(`/api/upload/cancel/${sessionId}`, {
        method: 'POST'
      });

      if (response.ok) {
        uploadSessions.update(sessions => {
          const session = sessions.get(sessionId);
          if (session) {
            session.progress.status = 'cancelled';
            session.canCancel = false;
            session.eventSource?.close();
            sessions.set(sessionId, session);
          }
          return sessions;
        });
      }
    } catch (error) {
      console.error('Failed to cancel upload:', error);
    }
  },

  // Close a session (removes from active sessions)
  closeSession: (sessionId: string) => {
    uploadSessions.update(sessions => {
      const session = sessions.get(sessionId);
      if (session) {
        session.eventSource?.close();

        // Move to history if completed
        if (session.progress.status === 'completed' || session.progress.status === 'error') {
          uploadHistory.update(history => {
            history.unshift(session.progress);
            return history.slice(0, 50); // Keep last 50 uploads
          });
        }

        sessions.delete(sessionId);
      }
      return sessions;
    });
  },

  // Get upload history
  loadHistory: async () => {
    try {
      const response = await fetch('/api/upload/history');
      if (response.ok) {
        const history = await response.json();
        uploadHistory.set(history);
      }
    } catch (error) {
      console.error('Failed to load upload history:', error);
    }
  }
};
