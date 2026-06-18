import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Student {
  id: string;
  username: string;
  name: string;
  avatar: string;
  level: number;
}

export interface StudentAttempt {
  studentId: string;
  word: string;
  input: string;
  correct: boolean;
  timeTaken: number;
  pattern: string | null;
  mode: 'spelling' | 'pronunciation';
  timestamp: string;
}

export interface TestSession {
  id: string;
  timestamp: string;
  level: number;
  mode: 'spelling' | 'pronunciation';
  totalWords: number;
  correctCount: number;
  wrongCount: number;
  masteryPercentage: number;
  attempts: StudentAttempt[];
}

const KEYS = {
  ACTIVE_STUDENT: 'adaptive_literacy_active_student_v2',
  ATTEMPTS: 'adaptive_literacy_attempts_v1',
  CACHED_WORDS: 'adaptive_literacy_cached_words_v1',
  SESSIONS: 'adaptive_literacy_sessions_v2',
};

export class LocalStorageManager {
  // Avatars List
  static AVATARS = [
    { emoji: '🦊', name: 'Fox', bg: '#FEE2E2' },
    { emoji: '🐨', name: 'Koala', bg: '#F1F5F9' },
    { emoji: '🐯', name: 'Tiger', bg: '#FEF3C7' },
    { emoji: '🐼', name: 'Panda', bg: '#ECFDF5' },
    { emoji: '🦁', name: 'Lion', bg: '#FFFBEB' },
    { emoji: '🐸', name: 'Frog', bg: '#DCFCE7' },
  ];

  // 1. Set Active Student (Save profile returned from backend)
  static async setActiveStudent(student: Student): Promise<void> {
    await AsyncStorage.setItem(KEYS.ACTIVE_STUDENT, JSON.stringify(student));
  }

  // 2. Get Active Student profile
  static async getActiveStudent(): Promise<Student | null> {
    try {
      const data = await AsyncStorage.getItem(KEYS.ACTIVE_STUDENT);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.log('Error getting active student:', e);
      return null;
    }
  }

  // 3. Logout
  static async logout(): Promise<void> {
    await AsyncStorage.removeItem(KEYS.ACTIVE_STUDENT);
  }

  // 4. Update Student Level Locally
  static async updateStudentLevel(studentId: string, level: number): Promise<void> {
    try {
      const student = await this.getActiveStudent();
      if (student && student.id === studentId) {
        student.level = level;
        await this.setActiveStudent(student);
      }
    } catch (e) {
      console.log('Error updating student level:', e);
    }
  }

  // 8. Save session attempts locally
  static async saveAttempts(studentId: string, newAttempts: StudentAttempt[]): Promise<void> {
    try {
      const current = await this.getAttempts(studentId);
      const combined = [...current, ...newAttempts];
      
      const allData = await AsyncStorage.getItem(KEYS.ATTEMPTS);
      const db = allData ? JSON.parse(allData) : {};
      
      db[studentId] = combined;
      await AsyncStorage.setItem(KEYS.ATTEMPTS, JSON.stringify(db));
    } catch (e) {
      console.log('Error saving attempts:', e);
    }
  }

  // 9. Get student attempts
  static async getAttempts(studentId: string): Promise<StudentAttempt[]> {
    try {
      const allData = await AsyncStorage.getItem(KEYS.ATTEMPTS);
      const db = allData ? JSON.parse(allData) : {};
      return db[studentId] || [];
    } catch (e) {
      console.log('Error getting attempts:', e);
      return [];
    }
  }

  // 10. Cache child's custom AI words list
  static async cacheStudentWords(studentId: string, words: string[]): Promise<void> {
    try {
      const allData = await AsyncStorage.getItem(KEYS.CACHED_WORDS);
      const db = allData ? JSON.parse(allData) : {};
      db[studentId] = words;
      await AsyncStorage.setItem(KEYS.CACHED_WORDS, JSON.stringify(db));
    } catch (e) {
      console.log('Error caching words:', e);
    }
  }

  // 11. Get cached words
  static async getCachedStudentWords(studentId: string): Promise<string[] | null> {
    try {
      const allData = await AsyncStorage.getItem(KEYS.CACHED_WORDS);
      const db = allData ? JSON.parse(allData) : {};
      return db[studentId] || null;
    } catch (e) {
      console.log('Error getting cached words:', e);
      return null;
    }
  }

  // 12. Save structured test session
  static async saveTestSession(studentId: string, session: TestSession): Promise<void> {
    try {
      const current = await this.getTestSessions(studentId);
      const combined = [session, ...current]; // Store newest first
      
      const allData = await AsyncStorage.getItem(KEYS.SESSIONS);
      const db = allData ? JSON.parse(allData) : {};
      
      db[studentId] = combined;
      await AsyncStorage.setItem(KEYS.SESSIONS, JSON.stringify(db));
    } catch (e) {
      console.log('Error saving test session:', e);
    }
  }

  // 13. Get all test sessions for a student
  static async getTestSessions(studentId: string): Promise<TestSession[]> {
    try {
      // First, run migration to ensure any old flat attempts are partitioned into structured sessions
      await this.migrateFlatAttemptsToSessions(studentId);

      const allData = await AsyncStorage.getItem(KEYS.SESSIONS);
      const db = allData ? JSON.parse(allData) : {};
      return db[studentId] || [];
    } catch (e) {
      console.log('Error getting test sessions:', e);
      return [];
    }
  }

  // 14. Schema migration: partition legacy flat attempts into structured sessions
  static async migrateFlatAttemptsToSessions(studentId: string): Promise<void> {
    try {
      const allSessionsData = await AsyncStorage.getItem(KEYS.SESSIONS);
      const sessionsDb = allSessionsData ? JSON.parse(allSessionsData) : {};
      
      // If student already has structured sessions, no need to migrate!
      if (sessionsDb[studentId] && sessionsDb[studentId].length > 0) {
        return;
      }

      // Load flat attempts
      const flatAttempts = await this.getAttempts(studentId);
      if (!flatAttempts || flatAttempts.length === 0) {
        return; // Nothing to migrate!
      }

      console.log(`Migrating ${flatAttempts.length} legacy attempts for student ${studentId}...`);

      // Sort flat attempts chronologically
      const sorted = [...flatAttempts].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      // We will partition the attempts into chunks of 50 (or less for the last batch)
      const migratedSessions: TestSession[] = [];
      const chunkSize = 50;

      for (let i = 0; i < sorted.length; i += chunkSize) {
        const chunk = sorted.slice(i, i + chunkSize);
        if (chunk.length === 0) continue;

        const correctCount = chunk.filter(a => a.correct).length;
        const totalCount = chunk.length;
        const masteryPercentage = Math.round((correctCount / totalCount) * 100);
        
        const inferredLevel = 1; // Default fallback
        const inferredMode = chunk[0].mode || 'spelling';
        const timestamp = chunk[chunk.length - 1].timestamp || new Date().toISOString();

        const newSession: TestSession = {
          id: `migrated_session_${Date.now()}_${i}`,
          timestamp: timestamp,
          level: inferredLevel,
          mode: inferredMode,
          totalWords: totalCount,
          correctCount: correctCount,
          wrongCount: totalCount - correctCount,
          masteryPercentage: masteryPercentage,
          attempts: chunk
        };

        migratedSessions.unshift(newSession); // Newest first
      }

      sessionsDb[studentId] = migratedSessions;
      await AsyncStorage.setItem(KEYS.SESSIONS, JSON.stringify(sessionsDb));
      console.log(`Successfully migrated ${migratedSessions.length} sessions for student ${studentId}.`);
    } catch (e) {
      console.log('Error during flat attempts migration:', e);
    }
  }
}
