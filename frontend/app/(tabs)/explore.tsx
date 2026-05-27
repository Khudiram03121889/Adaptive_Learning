import { View, Text, StyleSheet, ScrollView, SafeAreaView, ActivityIndicator, Platform } from 'react-native';
import { useState, useCallback, useEffect } from 'react';
import { useFonts, PlusJakartaSans_400Regular, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold, PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans';
import { useRouter, useFocusEffect } from 'expo-router';
import Constants from 'expo-constants';
import { LocalStorageManager, Student, StudentAttempt } from '../../utils/localStorageManager';


const getApiUrl = () => {
  if (Platform.OS === 'web') return 'http://localhost:8000';
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    return `http://${ip}:8000`;
  }
  return 'http://10.0.2.2:8000';
};

const API_URL = getApiUrl();

const getLevelName = (lvl: number) => {
  if (lvl === 1) return "Level 1: Beginner CVC Words";
  if (lvl === 2) return "Level 2: Simple Blends & Digraphs";
  if (lvl === 3) return "Level 3: Vowel Teams & Multi-Syllabic";
  return `Level ${lvl}: Advanced Words`;
};


export default function ExploreScreen() {
  const router = useRouter();
  const [activeStudent, setActiveStudent] = useState<Student | null>(null);
  
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  const [exploreData, setExploreData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      const initialize = async () => {
        const student = await LocalStorageManager.getActiveStudent();
        if (!student) {
          router.replace('/login');
          return;
        }
        setActiveStudent(student);
        await fetchExploreData(student);
      };
      initialize();
    }, [])
  );

  const fetchExploreData = async (student: Student) => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_URL}/explore-data?user_id=${student.id}`);
      if (!response.ok) {
        throw new Error('Server responded with error');
      }
      const data = await response.json();
      setExploreData({
        ...data,
        level: data.level || student.level
      });
    } catch (error) {
      console.log('Error fetching explore data from server, using local fallback:', error);
      await loadLocalAnalytics(student);
    } finally {
      setIsLoading(false);
    }
  };

  const loadLocalAnalytics = async (student: Student) => {
    try {
      const attempts = await LocalStorageManager.getAttempts(student.id);
      
      if (!attempts || attempts.length === 0) {
        setExploreData({
          mastery_percentage: 0,
          level: student.level,
          mastered_words: [],
          patterns_to_practice: [
            {
              title: "Getting Started",
              description: "Complete your first spelling or pronunciation test to begin analyzing patterns!",
              mastery_progress: 0
            }
          ],
          recent_errors_spelling: [],
          recent_errors_pronunciation: []
        });
        return;
      }

      // Calculate overall mastery of the last 50 attempts
      const recentAttempts = attempts.slice(-50);
      const correctCount = recentAttempts.filter(a => a.correct).length;
      const masteryPercentage = Math.round((correctCount / recentAttempts.length) * 100);

      // Get recently mastered words (last 10 unique correct words)
      const correctWords = attempts
        .filter(a => a.correct)
        .map(a => a.word);
      const masteredWords = Array.from(new Set(correctWords)).slice(-10).reverse();

      // Split spelling and pronunciation errors
      const errorCountsSpelling: { [key: string]: number } = {};
      const errorCountsPronunciation: { [key: string]: number } = {};

      attempts.forEach(a => {
        if (!a.correct && a.pattern && a.pattern !== 'none') {
          const mode = a.mode || 'spelling';
          if (mode === 'pronunciation') {
            errorCountsPronunciation[a.pattern] = (errorCountsPronunciation[a.pattern] || 0) + 1;
          } else {
            errorCountsSpelling[a.pattern] = (errorCountsSpelling[a.pattern] || 0) + 1;
          }
        }
      });

      const recentErrorsSpelling = Object.entries(errorCountsSpelling)
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      const recentErrorsPronunciation = Object.entries(errorCountsPronunciation)
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      const patternsToPractice: any[] = [];
      const allErrorsSorted = [
        ...recentErrorsSpelling.map(e => ({ ...e, mode: 'Spelling' })),
        ...recentErrorsPronunciation.map(e => ({ ...e, mode: 'Pronunciation' }))
      ].sort((a, b) => b.count - a.count);

      if (allErrorsSorted.length > 0) {
        allErrorsSorted.slice(0, 2).forEach(err => {
          const readableType = err.type
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (c: string) => c.toUpperCase());
          
          patternsToPractice.push({
            title: `${readableType} (${err.mode})`,
            description: `You made ${err.count} mistake(s) related to this phonetic pattern. Focus on words containing this pattern.`,
            mastery_progress: Math.max(10, 100 - (err.count * 15))
          });
        });
      } else {
        patternsToPractice.push({
          title: "Pattern Mastery",
          description: "Splendid job! No persistent spelling or pronunciation issues detected so far.",
          mastery_progress: 100
        });
      }

      setExploreData({
        mastery_percentage: masteryPercentage,
        level: student.level,
        mastered_words: masteredWords,
        patterns_to_practice: patternsToPractice,
        recent_errors_spelling: recentErrorsSpelling,
        recent_errors_pronunciation: recentErrorsPronunciation
      });
    } catch (e) {
      console.log('Error calculating local analytics:', e);
    }
  };

  if (!fontsLoaded || isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  const masteryPercentage: number = exploreData?.mastery_percentage || 0;
  const level: number = exploreData?.level || 1;
  const masteredWords: string[] = exploreData?.mastered_words || [];
  const patternsToPractice: any[] = exploreData?.patterns_to_practice || [];
  const recentErrorsSpelling: any[] = exploreData?.recent_errors_spelling || [];
  const recentErrorsPronunciation: any[] = exploreData?.recent_errors_pronunciation || [];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Top Section: Progress */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Progress</Text>
          <View style={styles.progressCard}>
            <View style={styles.ringOuter}>
              <View style={styles.ringInner}>
                <Text style={styles.progressText}>{masteryPercentage}%</Text>
                <Text style={styles.progressLabel}>Mastery</Text>
              </View>
            </View>
            <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 18, color: '#1E293B', marginTop: 24, textAlign: 'center' }}>
              {getLevelName(level)}
            </Text>
          </View>
        </View>

        {/* Middle Section: Mastered Words */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recently Mastered Words</Text>
          {masteredWords.length > 0 ? (
            <View style={styles.wordsContainer}>
              {masteredWords.map((word, idx) => (
                <View key={idx} style={styles.wordChip}>
                  <Text style={styles.checkIcon}>✅</Text>
                  <Text style={styles.wordChipText}>{word}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>Complete a test to see your mastered words!</Text>
          )}
        </View>

        {/* Bottom Section: Patterns to Practice */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AI Analysis: Needs Practice</Text>
          
          {patternsToPractice.length > 0 ? (
            patternsToPractice.map((pattern: any, idx: number) => (
              <View key={idx} style={styles.patternCard}>
                <View style={styles.patternHeader}>
                  <Text style={styles.patternIcon}>🎯</Text>
                  <Text style={styles.patternTitle}>{pattern.title}</Text>
                </View>
                <Text style={styles.patternDesc}>{pattern.description}</Text>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${pattern.mastery_progress}%` }]} />
                </View>
                <Text style={styles.patternProgressText}>{pattern.mastery_progress}% Mastered</Text>
              </View>
            ))
          ) : (
            <View style={[styles.patternCard, { borderColor: '#3B82F6', backgroundColor: '#EBF3FF' }]}>
              <Text style={[styles.patternTitle, { color: '#1E3A8A' }]}>No patterns detected yet!</Text>
              <Text style={[styles.patternDesc, { color: '#1E3A8A', marginTop: 8, marginBottom: 0 }]}>
                Complete a test to let the AI analyze your weak areas.
              </Text>
            </View>
          )}
        </View>

        {/* Local Error Analysis Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Mistakes By Type</Text>
          
          <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: '#1E293B', marginBottom: 12, marginTop: 8 }}>
            Spelling Mode (Typing)
          </Text>
          {recentErrorsSpelling.length > 0 ? (
            recentErrorsSpelling.map((err: any, idx: number) => (
              <View key={`spell-${idx}`} style={styles.errorRow}>
                <Text style={styles.errorTypeLabel}>
                  {err.type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                </Text>
                <View style={styles.errorCountBadge}>
                  <Text style={styles.errorCountText}>{err.count}</Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={[styles.emptyText, { marginBottom: 20 }]}>No recent spelling mistakes.</Text>
          )}

          <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: '#1E293B', marginBottom: 12, marginTop: 16 }}>
            Pronunciation Mode (Speaking)
          </Text>
          {recentErrorsPronunciation.length > 0 ? (
            recentErrorsPronunciation.map((err: any, idx: number) => (
              <View key={`pron-${idx}`} style={styles.errorRow}>
                <Text style={styles.errorTypeLabel}>
                  {err.type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                </Text>
                <View style={styles.errorCountBadge}>
                  <Text style={styles.errorCountText}>{err.count}</Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No recent pronunciation mistakes.</Text>
          )}
        </View>


      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 24,
    paddingTop: 40,
  },
  section: {
    marginBottom: 40,
  },
  sectionTitle: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 24,
    color: '#1E293B',
    marginBottom: 16,
  },
  emptyText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 16,
    color: '#64748B',
  },
  progressCard: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  ringOuter: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#EBF3FF', 
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 16,
    borderColor: '#3B82F6', 
    borderRightColor: '#EBF3FF', 
  },
  ringInner: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressText: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 40,
    color: '#3B82F6',
  },
  progressLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 16,
    color: '#64748B',
  },
  wordsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  wordChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  checkIcon: {
    marginRight: 8,
    fontSize: 16,
  },
  wordChipText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    color: '#1E293B',
  },
  patternCard: {
    backgroundColor: '#E6F4EA', 
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#22C55E',
  },
  patternHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  patternIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  patternTitle: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 20,
    color: '#004B1E',
  },
  patternDesc: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 15,
    color: '#005321',
    marginBottom: 16,
    lineHeight: 22,
  },
  progressBarBg: {
    height: 12,
    backgroundColor: '#BCCBB9', 
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#22C55E',
    borderRadius: 6,
  },
  patternProgressText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    color: '#004B1E',
    textAlign: 'right',
  },
  errorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  errorTypeLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 16,
    color: '#334155',
  },
  errorCountBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 100,
  },
  errorCountText: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 14,
    color: '#EF4444',
  }
});
