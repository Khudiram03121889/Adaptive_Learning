import { View, Text, StyleSheet, ScrollView, SafeAreaView, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { useFonts, PlusJakartaSans_400Regular, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold, PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans';

const API_URL = 'http://192.168.31.220:8000'; // Make sure this matches your network IP

export default function ExploreScreen() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  const [exploreData, setExploreData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchExploreData();
  }, []);

  const fetchExploreData = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_URL}/explore-data`);
      const data = await response.json();
      setExploreData(data);
    } catch (error) {
      console.log('Error fetching explore data:', error);
    } finally {
      setIsLoading(false);
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
  const masteredWords: string[] = exploreData?.mastered_words || [];
  const patternsToPractice: any[] = exploreData?.patterns_to_practice || [];
  const recentErrors: any[] = exploreData?.recent_errors || [];

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
          {recentErrors.length > 0 ? (
            recentErrors.map((err: any, idx: number) => (
              <View key={idx} style={styles.errorRow}>
                <Text style={styles.errorTypeLabel}>
                  {err.type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                </Text>
                <View style={styles.errorCountBadge}>
                  <Text style={styles.errorCountText}>{err.count}</Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No recent local error data available.</Text>
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
