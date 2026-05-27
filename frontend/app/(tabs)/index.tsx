import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useState, useCallback } from 'react';
import { useFonts, PlusJakartaSans_400Regular, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans';
import { LocalStorageManager, Student } from '../../utils/localStorageManager';

export default function HomeScreen() {
  const router = useRouter();
  const [activeStudent, setActiveStudent] = useState<Student | null>(null);

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  useFocusEffect(
    useCallback(() => {
      const checkUser = async () => {
        const student = await LocalStorageManager.getActiveStudent();
        if (!student) {
          router.replace('/login');
        } else {
          setActiveStudent(student);
        }
      };
      checkUser();
    }, [])
  );

  const handleSwitchProfile = async () => {
    await LocalStorageManager.logout();
    router.replace('/login');
  };

  const getLevelDesc = (lvl: number) => {
    if (lvl === 1) return 'Level 1: Beginner CVC Words';
    if (lvl === 2) return 'Level 2: Blends & Digraphs';
    if (lvl === 3) return 'Level 3: Vowel Teams';
    return `Level ${lvl}: Advanced Words`;
  };

  if (!fontsLoaded || !activeStudent) {
    return <View style={styles.container} />;
  }

  const avatarConfig = LocalStorageManager.AVATARS.find(a => a.emoji === activeStudent.avatar) || LocalStorageManager.AVATARS[0];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Profile Card Header */}
        <View style={styles.profileHeader}>
          <View style={[styles.avatarBadge, { backgroundColor: avatarConfig.bg }]}>
            <Text style={styles.avatarEmoji}>{activeStudent.avatar}</Text>
          </View>
          <View style={styles.profileMeta}>
            <Text style={styles.welcomeText}>Hello, {activeStudent.name}! 👋</Text>
            <Text style={styles.levelBadge}>{getLevelDesc(activeStudent.level)}</Text>
          </View>
          <TouchableOpacity style={styles.logoutButton} onPress={handleSwitchProfile}>
            <Text style={styles.logoutButtonText}>Switch Profile 🔁</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Select Study Mode</Text>

        <View style={styles.modesContainer}>
          {/* Spelling Mode Card */}
          <TouchableOpacity 
            style={[styles.card, styles.cardGreen]} 
            onPress={() => router.push('/practice?mode=spelling')}
          >
            <View style={styles.iconContainer}>
              <Text style={styles.iconText}>🔊</Text>
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Spelling Mode</Text>
              <Text style={styles.cardSubtitle}>Hear & Type</Text>
            </View>
          </TouchableOpacity>

          {/* Pronunciation Mode Card */}
          <TouchableOpacity 
            style={[styles.card, styles.cardBlue]} 
            onPress={() => router.push('/practice?mode=pronunciation')}
          >
            <View style={styles.iconContainer}>
              <Text style={styles.iconText}>🎤</Text>
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Pronunciation Mode</Text>
              <Text style={styles.cardSubtitle}>Read & Speak</Text>
            </View>
          </TouchableOpacity>
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
    paddingTop: 50,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 28,
    padding: 20,
    marginBottom: 36,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  avatarBadge: {
    width: 60,
    height: 60,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarEmoji: {
    fontSize: 32,
  },
  profileMeta: {
    flex: 1,
  },
  welcomeText: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 20,
    color: '#1E293B',
    marginBottom: 4,
  },
  levelBadge: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    color: '#3B82F6',
  },
  logoutButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  logoutButtonText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11,
    color: '#64748B',
  },
  sectionTitle: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 22,
    color: '#1E293B',
    marginBottom: 20,
  },
  modesContainer: {
    gap: 24,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 24,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  cardGreen: {
    backgroundColor: '#E6F4EA', // Light Growth Green
    borderWidth: 2,
    borderColor: '#22C55E',
  },
  cardBlue: {
    backgroundColor: '#EBF3FF', // Light Focus Blue
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  cardYellow: {
    backgroundColor: '#FFFBEB', // Light Joy Yellow
    borderWidth: 2,
    borderColor: '#FACC15',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  iconText: {
    fontSize: 32,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 20,
    color: '#1E293B',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: '#64748B',
  },
});
