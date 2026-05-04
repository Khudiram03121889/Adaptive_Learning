import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { useFonts, PlusJakartaSans_400Regular, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans';

export default function HomeScreen() {
  const router = useRouter();

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  if (!fontsLoaded) {
    return <View style={styles.container} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.welcomeText}>Hello, Student!</Text>
          <Text style={styles.subtitleText}>What would you like to learn today?</Text>
        </View>

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
  },
  header: {
    marginTop: 40,
    marginBottom: 40,
  },
  welcomeText: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 32,
    color: '#1E293B',
    marginBottom: 8,
  },
  subtitleText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 18,
    color: '#64748B',
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
