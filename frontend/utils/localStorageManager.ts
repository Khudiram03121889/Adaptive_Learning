import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Student {
  id: string;
  name: string;
  pin: string;
  avatar: string;
  level: number;
  createdAt: string;
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

const KEYS = {
  STUDENTS: 'adaptive_literacy_students_v1',
  ACTIVE_STUDENT_ID: 'adaptive_literacy_active_id_v1',
  ATTEMPTS: 'adaptive_literacy_attempts_v1',
  CACHED_WORDS: 'adaptive_literacy_cached_words_v1',
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

  // 1. Fetch all students
  static async getStudents(): Promise<Student[]> {
    try {
      const data = await AsyncStorage.getItem(KEYS.STUDENTS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.log('Error getting students:', e);
      return [];
    }
  }

  // 2. Register a new student
  static async registerStudent(name: string, pin: string, avatar: string): Promise<Student | null> {
    try {
      const students = await this.getStudents();
      
      // Check if student name already exists
      const exists = students.some(s => s.name.toLowerCase() === name.toLowerCase().trim());
      if (exists) {
        return null; // Username already exists
      }

      const newStudent: Student = {
        id: `student_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: name.trim(),
        pin: pin.trim(),
        avatar,
        level: 1,
        createdAt: new Date().toISOString(),
      };

      students.push(newStudent);
      await AsyncStorage.setItem(KEYS.STUDENTS, JSON.stringify(students));
      return newStudent;
    } catch (e) {
      console.log('Error registering student:', e);
      return null;
    }
  }

  // 3. Authenticate / Login Student
  static async login(name: string, pin: string): Promise<Student | null> {
    try {
      const students = await this.getStudents();
      const student = students.find(
        s => s.name.toLowerCase() === name.toLowerCase().trim() && s.pin === pin.trim()
      );

      if (student) {
        await AsyncStorage.setItem(KEYS.ACTIVE_STUDENT_ID, student.id);
        return student;
      }
      return null;
    } catch (e) {
      console.log('Error during student login:', e);
      return null;
    }
  }

  // 4. Set Active Student directly (e.g. from profile picker)
  static async setActiveStudentId(studentId: string): Promise<void> {
    await AsyncStorage.setItem(KEYS.ACTIVE_STUDENT_ID, studentId);
  }

  // 5. Get Active Student profile
  static async getActiveStudent(): Promise<Student | null> {
    try {
      const id = await AsyncStorage.getItem(KEYS.ACTIVE_STUDENT_ID);
      if (!id) return null;

      const students = await this.getStudents();
      return students.find(s => s.id === id) || null;
    } catch (e) {
      console.log('Error getting active student:', e);
      return null;
    }
  }

  // 6. Logout
  static async logout(): Promise<void> {
    await AsyncStorage.removeItem(KEYS.ACTIVE_STUDENT_ID);
  }

  // 7. Update Student Level
  static async updateStudentLevel(studentId: string, level: number): Promise<void> {
    try {
      const students = await this.getStudents();
      const idx = students.findIndex(s => s.id === studentId);
      if (idx !== -1) {
        students[idx].level = level;
        await AsyncStorage.setItem(KEYS.STUDENTS, JSON.stringify(students));
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
}
