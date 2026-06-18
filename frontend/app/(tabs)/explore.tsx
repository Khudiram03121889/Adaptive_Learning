import { View, Text, StyleSheet, ScrollView, SafeAreaView, ActivityIndicator, TouchableOpacity, Modal } from 'react-native';
import { useState, useCallback } from 'react';
import { useFonts, PlusJakartaSans_400Regular, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold, PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans';
import { useRouter, useFocusEffect } from 'expo-router';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { LocalStorageManager, Student, StudentAttempt, TestSession } from '../../utils/localStorageManager';


const getApiUrl = () => {
  return 'https://adaptive-literacy-backend.onrender.com';
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
  const [allAttempts, setAllAttempts] = useState<StudentAttempt[]>([]);
  
  // Structured historical sessions hooks
  const [sessions, setSessions] = useState<TestSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<TestSession | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [modalTab, setModalTab] = useState<'mistakes' | 'mastered'>('mistakes');
  const [voiceLocale, setVoiceLocale] = useState<'en-US' | 'en-GB' | 'en-IN'>('en-US'); // Default to US Phonics for young readers

  useFocusEffect(
    useCallback(() => {
      const initialize = async () => {
        const student = await LocalStorageManager.getActiveStudent();
        if (!student) {
          router.replace('/login' as any);
          return;
        }
        setActiveStudent(student);
        
        // Load sessions and attempts
        const historicalSessions = await LocalStorageManager.getTestSessions(student.id);
        setSessions(historicalSessions);

        const attempts = await LocalStorageManager.getAttempts(student.id);
        setAllAttempts(attempts);
        
        await fetchExploreData(student);
      };
      initialize();
    }, [])
  );

  const fetchExploreData = async (student: Student) => {
    try {
      setIsLoading(true);
      
      // Keep sessions in sync
      const historicalSessions = await LocalStorageManager.getTestSessions(student.id);
      setSessions(historicalSessions);

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
      const historicalSessions = await LocalStorageManager.getTestSessions(student.id);
      setSessions(historicalSessions);

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

  const playWord = async (wordToPlay: string, slow = false) => {
    if (!wordToPlay) return;
    const clean = wordToPlay.toLowerCase().trim();
    
    // TIER 1: Try local backend TTS synthesis stream (respecting US vs UK)
    try {
      const backendUrl = `${API_URL}/tts?word=${encodeURIComponent(clean)}&lang=${voiceLocale}`;
      const { sound } = await Audio.Sound.createAsync(
        { uri: backendUrl },
        { shouldPlay: true, rate: slow ? 0.55 : 0.82, shouldCorrectPitch: true }
      );
      sound.setOnPlaybackStatusUpdate(status => {
        if (status.isLoaded && status.didJustFinish) sound.unloadAsync();
      });
      return;
    } catch (e) {
      console.log('Tier 1 Backend TTS stream failed, trying Tier 2...');
    }

    // TIER 2: Try Free Dictionary API human speech recording
    try {
      const dictResponse = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(clean)}`);
      if (dictResponse.ok) {
        const data = await dictResponse.json();
        const targetSuffix = voiceLocale === 'en-GB' ? '-uk' : (voiceLocale === 'en-IN' ? '-in' : '-us');
        const audioItem = data[0]?.phonetics?.find((p: any) => p.audio && p.audio.includes(targetSuffix));
        const fallbackAudio = data[0]?.phonetics?.find((p: any) => p.audio && p.audio.length > 0);
        const finalAudioUrl = audioItem?.audio || fallbackAudio?.audio;
        
        if (finalAudioUrl) {
          const { sound } = await Audio.Sound.createAsync(
            { uri: finalAudioUrl },
            { shouldPlay: true, rate: slow ? 0.55 : 0.82 }
          );
          sound.setOnPlaybackStatusUpdate(status => {
            if (status.isLoaded && status.didJustFinish) sound.unloadAsync();
          });
          return;
        }
      }
    } catch (e) {
      console.log('Tier 2 Free Dictionary API failed, trying Tier 3...');
    }

    // TIER 3: Try Direct Google Translate stream CDN
    try {
      const googleUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${voiceLocale}&client=tw-ob&q=${encodeURIComponent(clean)}`;
      const { sound } = await Audio.Sound.createAsync(
        { uri: googleUrl },
        { shouldPlay: true, rate: slow ? 0.55 : 0.82 }
      );
      sound.setOnPlaybackStatusUpdate(status => {
        if (status.isLoaded && status.didJustFinish) sound.unloadAsync();
      });
      return;
    } catch (e) {
      console.log('Tier 3 Google Translate CDN stream failed, trying Tier 4 (Local native engine)...');
    }

    // TIER 4: Try Native Speech synthesis (last fallback)
    try {
      Speech.speak(clean, {
        language: voiceLocale,
        rate: slow ? 0.45 : 0.82,
        pitch: 1.0,
      });
    } catch (e) {
      console.log('All audio tiers failed to synthesize speech.');
    }
  };

  const openSessionReport = (session: TestSession) => {
    setSelectedSession(session);
    setModalTab('mistakes');
    setDetailModalVisible(true);
  };

  const getPhoneticTip = (type: string) => {
    const errorType = type.toLowerCase().trim();
    switch (errorType) {
      case 'vowel_confusion':
        return "💡 Vowels (a, e, i, o, u) can sound and look very similar! Make sure to listen carefully to the vowel team or short vowel sound in the word before answering.";
      case 'phonetic_substitution':
        return "💡 Some consonants sound nearly identical (like 'c'/'k', 's'/'c', or 'f'/'ph'). Tapping the play icon will help you practice linking these spelling patterns to their distinct sounds!";
      case 'missing_letters':
        return "💡 It looks like some letters were left out! Try chunking the word into syllables or slow sounds to catch every single letter.";
      case 'extra_letters':
        return "💡 A few extra letters snuck in! Try reading the word out loud exactly as you wrote it to see if there are any silent or duplicate letters.";
      case 'order_mistakes':
        return "💡 All the letters are correct, but their order got mixed up! Try writing down the word letter-by-letter or visualising the word family.";
      case 'completely_wrong':
        return "💡 This is a great opportunity to learn! Listen to the word several times using the play button, and practice writing it out slowly.";
      default:
        return "💡 Practice makes progress! Tap the sound icon to hear the correct pronunciation, and focus on spelling the base sounds.";
    }
  };

  const renderTrendChart = () => {
    // Take the last 8 sessions and reverse to render chronologically (oldest to newest)
    const recentSessions = [...sessions].slice(0, 8).reverse();
    if (recentSessions.length === 0) {
      return (
        <View style={chartStyles.emptyChart}>
          <Text style={chartStyles.emptyChartText}>No completed tests yet! Complete a 50-word spelling or pronunciation test to begin generating visual analytics reports.</Text>
        </View>
      );
    }

    return (
      <View style={chartStyles.chartContainer}>
        <Text style={chartStyles.chartTitle}>Performance History (Last {recentSessions.length} Tests)</Text>
        <View style={chartStyles.chartRow}>
          {recentSessions.map((sess) => {
            const passed = sess.masteryPercentage >= 85;
            const barHeight = Math.max(15, sess.masteryPercentage); // Ensure at least 15% visible
            
            return (
              <TouchableOpacity 
                key={sess.id}
                style={chartStyles.chartColumn}
                onPress={() => openSessionReport(sess)}
                activeOpacity={0.8}
              >
                <View style={chartStyles.barWrapper}>
                  <Text style={chartStyles.barLabel}>{sess.masteryPercentage}%</Text>
                  
                  <View style={chartStyles.barOuter}>
                    <View 
                      style={[
                        chartStyles.barInner, 
                        { 
                          height: `${barHeight}%`,
                          backgroundColor: passed ? '#22C55E' : '#F97316' 
                        }
                      ]} 
                    />
                  </View>
                </View>
                
                <Text style={chartStyles.columnTag}>
                  {sess.mode === 'spelling' ? '✍️' : '🗣️'}
                </Text>
                <Text style={chartStyles.columnDate}>
                  {new Date(sess.timestamp).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={chartStyles.chartCaption}>👉 Tap any column above to inspect that specific test{"'"}s report!</Text>
      </View>
    );
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

  const totalTests = sessions.length;
  const totalWords = allAttempts.length;
  const overallAvgSpeed = allAttempts.length > 0
    ? (allAttempts.reduce((sum, a) => sum + (a.timeTaken || 0), 0) / allAttempts.length / 1000).toFixed(1)
    : '0.0';

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
                <Text style={styles.progressLabel}>Overall Mastery</Text>
              </View>
            </View>
            <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 18, color: '#1E293B', marginTop: 24, textAlign: 'center' }}>
              {getLevelName(level)}
            </Text>
          </View>

          {/* Accent Selector Toggle */}
          <View style={styles.accentToggleContainer}>
            <TouchableOpacity 
              style={[styles.accentToggleOption, voiceLocale === 'en-US' && styles.accentToggleOptionActive]}
              onPress={() => setVoiceLocale('en-US')}
              activeOpacity={0.7}
            >
              <Text style={[styles.accentToggleText, voiceLocale === 'en-US' && styles.accentToggleTextActive]}>
                🇺🇸 US Phonics (Recommended)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.accentToggleOption, voiceLocale === 'en-GB' && styles.accentToggleOptionActive]}
              onPress={() => setVoiceLocale('en-GB')}
              activeOpacity={0.7}
            >
              <Text style={[styles.accentToggleText, voiceLocale === 'en-GB' && styles.accentToggleTextActive]}>
                🇬🇧 Standard UK
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.accentToggleOption, voiceLocale === 'en-IN' && styles.accentToggleOptionActive]}
              onPress={() => setVoiceLocale('en-IN')}
              activeOpacity={0.7}
            >
              <Text style={[styles.accentToggleText, voiceLocale === 'en-IN' && styles.accentToggleTextActive]}>
                🇮🇳 Indian English
              </Text>
            </TouchableOpacity>
          </View>

          {/* 3-Card Summary Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statCardEmoji}>🏆</Text>
              <Text style={styles.statCardVal}>{totalTests}</Text>
              <Text style={styles.statCardLbl}>Tests Done</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statCardEmoji}>📝</Text>
              <Text style={styles.statCardVal}>{totalWords}</Text>
              <Text style={styles.statCardLbl}>Words Try</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statCardEmoji}>⏱️</Text>
              <Text style={styles.statCardVal}>{overallAvgSpeed}s</Text>
              <Text style={styles.statCardLbl}>Avg Speed</Text>
            </View>
          </View>
        </View>

        {/* Visual Trend Chart */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Visual Analytics</Text>
          {renderTrendChart()}
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

        {/* Completed Test Sessions History List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Test History & Reports</Text>
          {sessions.length > 0 ? (
            sessions.map((sess) => {
              const dateStr = new Date(sess.timestamp).toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });
              const passed = sess.masteryPercentage >= 85;

              return (
                <TouchableOpacity
                  key={sess.id}
                  style={styles.sessionCard}
                  onPress={() => openSessionReport(sess)}
                  activeOpacity={0.8}
                >
                  <View style={styles.sessionCardHeader}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.sessionModeText}>
                        {sess.mode === 'spelling' ? '✍️ Spelling Test' : '🗣️ Pronunciation Test'}
                      </Text>
                      <Text style={styles.sessionDateText}>{dateStr}</Text>
                    </View>
                    
                    <View style={[styles.scoreBadge, { backgroundColor: passed ? '#DCFCE7' : '#FFEDD5' }]}>
                      <Text style={[styles.scoreText, { color: passed ? '#15803D' : '#C2410C' }]}>
                        Score: {sess.correctCount}/{sess.totalWords}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.sessionCardFooter}>
                    <Text style={styles.levelBadgeText}>Level {sess.level}</Text>
                    <Text style={[styles.statusText, { color: passed ? '#22C55E' : '#F97316' }]}>
                      {passed ? '✓ Passed (Mastered)' : '⚠️ Needs Practice'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <Text style={styles.emptyText}>No test sessions logged yet. Complete a spelling or pronunciation test to generate reports!</Text>
          )}
        </View>

        {/* Bottom Section: AI Patterns to Practice */}
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

        {/* Cumulative Mistakes Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cumulative Mistakes By Type</Text>
          
          <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: '#1E293B', marginBottom: 12, marginTop: 8 }}>
            Spelling Mode (Typing)
          </Text>
          {recentErrorsSpelling.length > 0 ? (
            recentErrorsSpelling.map((err: any, idx: number) => {
              const formattedLabel = err.type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
              return (
                <View 
                  key={`spell-${idx}`} 
                  style={styles.errorRow}
                >
                  <Text style={styles.errorTypeLabel}>{formattedLabel}</Text>
                  <View style={styles.errorCountBadge}>
                    <Text style={styles.errorCountText}>{err.count}</Text>
                  </View>
                </View>
              );
            })
          ) : (
            <Text style={[styles.emptyText, { marginBottom: 20 }]}>No recent spelling mistakes.</Text>
          )}

          <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: '#1E293B', marginBottom: 12, marginTop: 16 }}>
            Pronunciation Mode (Speaking)
          </Text>
          {recentErrorsPronunciation.length > 0 ? (
            recentErrorsPronunciation.map((err: any, idx: number) => {
              const formattedLabel = err.type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
              return (
                <View 
                  key={`pron-${idx}`} 
                  style={styles.errorRow}
                >
                  <Text style={styles.errorTypeLabel}>{formattedLabel}</Text>
                  <View style={styles.errorCountBadge}>
                    <Text style={styles.errorCountText}>{err.count}</Text>
                  </View>
                </View>
              );
            })
          ) : (
            <Text style={styles.emptyText}>No recent pronunciation mistakes.</Text>
          )}
        </View>

      </ScrollView>

      {/* Double-Tab Interactive Detailed Report Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={detailModalVisible}
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={modalStyles.modalOverlay}>
          <View style={modalStyles.modalContent}>
            
            {/* Modal Header */}
            <View style={modalStyles.modalHeader}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={modalStyles.modalTitle} numberOfLines={1}>
                  {selectedSession?.mode === 'spelling' ? '✍️ Spelling Test Report' : '🗣️ Pronunciation Test Report'}
                </Text>
                <Text style={modalStyles.modalSubtitle}>
                  {selectedSession ? new Date(selectedSession.timestamp).toLocaleString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                </Text>
              </View>
              <TouchableOpacity 
                style={modalStyles.closeButton}
                onPress={() => setDetailModalVisible(false)}
              >
                <Text style={modalStyles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Premium 4-Stat Metrics Grid inside Modal */}
            {selectedSession && (() => {
              const sessionAvgSpeed = selectedSession.attempts.length > 0 
                ? (selectedSession.attempts.reduce((sum, a) => sum + (a.timeTaken || 0), 0) / selectedSession.attempts.length / 1000).toFixed(1)
                : '0.0';
              const sessionPassed = selectedSession.masteryPercentage >= 85;

              return (
                <View style={modalStyles.metricsGrid}>
                  {/* 1. Accuracy Card */}
                  <View style={[modalStyles.metricCard, { borderLeftColor: sessionPassed ? '#22C55E' : '#F97316' }]}>
                    <Text style={modalStyles.metricVal}>{selectedSession.masteryPercentage}%</Text>
                    <Text style={modalStyles.metricLbl}>Accuracy Rate</Text>
                    <Text style={[modalStyles.metricSub, { color: sessionPassed ? '#16A34A' : '#EA580C' }]}>
                      {sessionPassed ? '⚡ Passed' : '⚠️ Practice'}
                    </Text>
                  </View>
                  {/* 2. Score Badge */}
                  <View style={modalStyles.metricCard}>
                    <Text style={modalStyles.metricVal}>
                      {selectedSession.correctCount}/{selectedSession.totalWords}
                    </Text>
                    <Text style={modalStyles.metricLbl}>Completed Words</Text>
                    <Text style={modalStyles.metricSub}>Words Spelled</Text>
                  </View>
                  {/* 3. Speed Card */}
                  <View style={modalStyles.metricCard}>
                    <Text style={modalStyles.metricVal}>{sessionAvgSpeed}s</Text>
                    <Text style={modalStyles.metricLbl}>Avg Speed</Text>
                    <Text style={modalStyles.metricSub}>Per attempt</Text>
                  </View>
                  {/* 4. Phonetic Gaps Card */}
                  <View style={modalStyles.metricCard}>
                    <Text style={modalStyles.metricVal}>{selectedSession.wrongCount}</Text>
                    <Text style={modalStyles.metricLbl}>Phonetic Gaps</Text>
                    <Text style={[modalStyles.metricSub, { color: selectedSession.wrongCount > 0 ? '#EF4444' : '#16A34A' }]}>
                      {selectedSession.wrongCount > 0 ? 'Need Review' : 'Perfect! 🏆'}
                    </Text>
                  </View>
                </View>
              );
            })()}

            {/* Segmented Tab Bar */}
            <View style={modalStyles.tabBar}>
              <TouchableOpacity
                style={[modalStyles.tabButton, modalTab === 'mistakes' && modalStyles.activeTabButton]}
                onPress={() => setModalTab('mistakes')}
              >
                <Text style={[modalStyles.tabButtonText, modalTab === 'mistakes' && modalStyles.activeTabButtonText]}>
                  ❌ Gaps / Mistakes ({selectedSession?.wrongCount || 0})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[modalStyles.tabButton, modalTab === 'mastered' && modalStyles.activeTabButton]}
                onPress={() => setModalTab('mastered')}
              >
                <Text style={[modalStyles.tabButtonText, modalTab === 'mastered' && modalStyles.activeTabButtonText]}>
                  ✅ Correct Words ({selectedSession?.correctCount || 0})
                </Text>
              </TouchableOpacity>
            </View>

            {/* Scrollable Report Content */}
            <ScrollView contentContainerStyle={modalStyles.mistakesList}>
              {(() => {
                if (!selectedSession) return null;

                if (modalTab === 'mistakes') {
                  const wrongAttempts = selectedSession.attempts.filter(a => !a.correct);

                  if (wrongAttempts.length === 0) {
                    return (
                      <View style={modalStyles.emptyContainer}>
                        <Text style={modalStyles.emptyEmoji}>🏆</Text>
                        <Text style={modalStyles.emptyTitle}>Perfect Score! 🎉</Text>
                        <Text style={modalStyles.emptySubtitle}>No mistakes were made in this session.</Text>
                      </View>
                    );
                  }

                  // Group attempts by pattern/error type
                  const groups: { [key: string]: StudentAttempt[] } = {};
                  wrongAttempts.forEach(a => {
                    const pattern = a.pattern || 'completely_wrong';
                    if (!groups[pattern]) {
                      groups[pattern] = [];
                    }
                    groups[pattern].push(a);
                  });

                  return Object.entries(groups).map(([patternType, items], gIdx) => {
                    const groupLabel = patternType.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
                    return (
                      <View key={gIdx} style={{ marginBottom: 24 }}>
                        <Text style={modalStyles.categoryTitle}>{groupLabel}</Text>
                        <View style={modalStyles.tipCard}>
                          <Text style={modalStyles.tipText}>{getPhoneticTip(patternType)}</Text>
                        </View>

                        {items.map((item, idx) => {
                          const speedSec = ((item.timeTaken || 0) / 1000).toFixed(1);
                          return (
                            <View key={idx} style={modalStyles.mistakeCard}>
                              <View style={modalStyles.mistakeRow}>
                                <View style={{ flex: 1 }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                                    <Text style={modalStyles.targetWord}>{item.word}</Text>
                                    <View style={modalStyles.correctLabelBadge}>
                                      <Text style={modalStyles.correctLabelText}>Target</Text>
                                    </View>
                                  </View>
                                  
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                                    <Text style={modalStyles.mistakeLabel}>Your Entry:</Text>
                                    <View style={modalStyles.errorInputBadge}>
                                      <Text style={modalStyles.errorInputText}>
                                        {item.input || '(empty)'}
                                      </Text>
                                    </View>
                                  </View>
                                  
                                  <Text style={modalStyles.mistakeSpeedText}>
                                    ⏱️ Response Speed: {speedSec} seconds
                                  </Text>
                                </View>
                                
                                <TouchableOpacity 
                                  style={modalStyles.playAudioButton}
                                  onPress={() => playWord(item.word)}
                                  activeOpacity={0.7}
                                >
                                  <Text style={modalStyles.playAudioIcon}>🔊</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    );
                  });
                } else {
                  // Mastered / Correct words
                  const correctAttempts = selectedSession.attempts.filter(a => a.correct);

                  if (correctAttempts.length === 0) {
                    return (
                      <View style={modalStyles.emptyContainer}>
                        <Text style={modalStyles.emptyEmoji}>📚</Text>
                        <Text style={modalStyles.emptyTitle}>Keep practicing!</Text>
                        <Text style={modalStyles.emptySubtitle}>No words were correct in this session.</Text>
                      </View>
                    );
                  }

                  return (
                    <View style={modalStyles.masteredGrid}>
                      {correctAttempts.map((item, idx) => {
                        const speedSec = ((item.timeTaken || 0) / 1000).toFixed(1);
                        const isFluent = parseFloat(speedSec) <= 2.5;

                        return (
                          <TouchableOpacity 
                            key={idx} 
                            style={[modalStyles.correctWordChip, isFluent && modalStyles.fluentWordChip]}
                            onPress={() => playWord(item.word)}
                            activeOpacity={0.7}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Text style={modalStyles.correctWordText}>{item.word}</Text>
                              <Text style={modalStyles.speedTag}>({speedSec}s)</Text>
                              {isFluent && <Text style={modalStyles.fluentBadge}>⚡ Fluent</Text>}
                            </View>
                            <Text style={modalStyles.correctWordSpeaker}>🔊</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  );
                }
              })()}
            </ScrollView>
            
          </View>
        </View>
      </Modal>
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
    lineHeight: 22,
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
  },
  // Structured historical sessions styles
  sessionCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  sessionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sessionModeText: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 16,
    color: '#1E293B',
  },
  sessionDateText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  scoreBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
  },
  scoreText: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 14,
  },
  sessionCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  levelBadgeText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12,
    color: '#64748B',
    backgroundColor: '#F1F5F9',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  statusText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statCardEmoji: {
    fontSize: 20,
    marginBottom: 6,
  },
  statCardVal: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 18,
    color: '#1E293B',
  },
  statCardLbl: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    textAlign: 'center',
  },
  accentToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 14,
    padding: 3,
    marginTop: 20,
    marginBottom: 8,
    width: '100%',
  },
  accentToggleOption: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 11,
  },
  accentToggleOptionActive: {
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  accentToggleText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    color: '#64748B',
  },
  accentToggleTextActive: {
    color: '#1E293B',
  },
});

const chartStyles = StyleSheet.create({
  chartContainer: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  chartTitle: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 16,
    color: '#1E293B',
    marginBottom: 20,
    textAlign: 'center',
  },
  chartRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 160,
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  chartColumn: {
    alignItems: 'center',
    flex: 1,
  },
  barWrapper: {
    height: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    width: '100%',
  },
  barLabel: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10,
    color: '#64748B',
    marginBottom: 4,
  },
  barOuter: {
    width: 14,
    height: 100,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    overflow: 'hidden',
  },
  barInner: {
    width: '100%',
    borderRadius: 10,
    position: 'absolute',
    bottom: 0,
  },
  columnTag: {
    fontSize: 12,
    marginTop: 6,
  },
  columnDate: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 9,
    color: '#94A3B8',
    marginTop: 2,
  },
  chartCaption: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    color: '#3B82F6',
    textAlign: 'center',
    marginTop: 8,
  },
  emptyChart: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minHeight: 120,
  },
  emptyChartText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
});

const modalStyles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)', 
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    height: '85%',
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 16,
  },
  modalTitle: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 20,
    color: '#1E293B',
  },
  modalSubtitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    color: '#64748B',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderLeftWidth: 5,
    borderLeftColor: '#3B82F6',
  },
  metricVal: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 18,
    color: '#1E293B',
  },
  metricLbl: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  metricSub: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  activeTabButton: {
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tabButtonText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    color: '#64748B',
  },
  activeTabButtonText: {
    color: '#1E293B',
  },
  categoryTitle: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 18,
    color: '#1E293B',
    marginBottom: 8,
  },
  tipCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
    marginBottom: 16,
  },
  tipText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: '#1E40AF',
    lineHeight: 18,
  },
  mistakesList: {
    paddingBottom: 40,
  },
  mistakeCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  mistakeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  targetWord: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 20,
    color: '#1E293B',
    letterSpacing: 0.5,
  },
  attemptText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    color: '#EF4444',
    marginTop: 4,
  },
  playAudioButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EBF3FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  playAudioIcon: {
    fontSize: 18,
  },
  masteredGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingBottom: 20,
  },
  correctWordChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  correctWordText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    color: '#15803D',
    marginRight: 6,
  },
  correctWordSpeaker: {
    fontSize: 12,
    color: '#16A34A',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 18,
    color: '#1E293B',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    color: '#64748B',
  },
  fluentWordChip: {
    borderColor: '#86EFAC',
    backgroundColor: '#F0FDF4',
  },
  speedTag: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11,
    color: '#64748B',
    marginLeft: 4,
  },
  fluentBadge: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 9,
    color: '#15803D',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 6,
    overflow: 'hidden',
  },
  correctLabelBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  correctLabelText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10,
    color: '#15803D',
  },
  mistakeLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: '#64748B',
  },
  errorInputBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  errorInputText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12,
    color: '#EF4444',
    textDecorationLine: 'line-through',
  },
  mistakeSpeedText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
  },
});
