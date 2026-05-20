export interface WordStats {
  word: string;
  correctInARow: number;
  isMastered: boolean;
  attempts: number;
}

export class SessionManager {
  private wordsStats: Map<string, WordStats> = new Map();
  private wordQueue: string[] = [];
  private totalQuestionsLimit = 50;
  private currentQuestionCount = 0;

  constructor(initialWords: string[]) {
    // Initialize stats
    initialWords.forEach(word => {
      this.wordsStats.set(word.toLowerCase(), {
        word,
        correctInARow: 0,
        isMastered: false,
        attempts: 0
      });
      this.wordQueue.push(word);
    });
  }

  getNextWord(): string | null {
    if (this.currentQuestionCount >= this.totalQuestionsLimit) {
      return null; // Session complete
    }

    // Find the first unmastered word in the queue
    while (this.wordQueue.length > 0) {
      const nextWord = this.wordQueue[0];
      const stats = this.wordsStats.get(nextWord.toLowerCase());
      
      if (stats && !stats.isMastered) {
        return stats.word;
      } else {
        // If mastered or not found, remove from queue
        this.wordQueue.shift();
      }
    }

    // If queue is empty but session not complete, we might need to recycle unmastered words
    const unmastered = Array.from(this.wordsStats.values()).filter(w => !w.isMastered);
    if (unmastered.length > 0) {
      // Re-populate queue with unmastered words (shuffled or prioritized)
      unmastered.sort((a, b) => a.correctInARow - b.correctInARow); // Prioritize those with fewest correct
      this.wordQueue = unmastered.map(w => w.word);
      return this.wordQueue[0];
    }

    return null; // All words mastered before 50 limit!
  }

  recordAttempt(word: string, isCorrect: boolean) {
    const key = word.toLowerCase();
    const stats = this.wordsStats.get(key);
    
    if (stats) {
      stats.attempts++;
      if (isCorrect) {
        stats.correctInARow++;
        if (stats.correctInARow >= 3) {
          stats.isMastered = true;
          // Word is mastered, will be removed from queue on next getNextWord
        } else {
          // Correct, but not mastered. Move to back of queue to space out practice
          this.wordQueue.shift(); // Remove from front
          this.wordQueue.push(word); // Add to back
        }
      } else {
        stats.correctInARow = 0;
        // Incorrect. Keep near the front to practice again soon (e.g., after 2 words)
        this.wordQueue.shift();
        this.wordQueue.splice(Math.min(2, this.wordQueue.length), 0, word);
      }
      this.wordsStats.set(key, stats);
    }
    
    this.currentQuestionCount++;
  }

  getProgress() {
    return {
      current: this.currentQuestionCount,
      total: this.totalQuestionsLimit
    };
  }
}
