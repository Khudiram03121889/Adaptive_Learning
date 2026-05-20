import { ErrorType } from './errorAnalyzer';

export interface PatternProfile {
  [patternType: string]: number; // Maps ErrorType to count
}

export class PatternEngine {
  private profile: PatternProfile = {};

  updatePattern(errorType: ErrorType) {
    if (errorType === 'none' || errorType === 'completely_wrong') return;
    
    if (!this.profile[errorType]) {
      this.profile[errorType] = 0;
    }
    this.profile[errorType]++;
  }

  getTopPatterns(): string[] {
    // Sort patterns by count descending
    return Object.keys(this.profile)
      .sort((a, b) => this.profile[b] - this.profile[a]);
  }

  getProfile(): PatternProfile {
    return this.profile;
  }
}
