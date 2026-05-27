import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useFonts, PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans';
import { LocalStorageManager, Student } from '../utils/localStorageManager';

export default function LoginScreen() {
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);

  // Login Form States
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [pinInput, setPinInput] = useState('');

  // Registration Form States
  const [regName, setRegName] = useState('');
  const [regPin, setRegPin] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(LocalStorageManager.AVATARS[0].emoji);

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    setIsLoading(true);
    const list = await LocalStorageManager.getStudents();
    setStudents(list);
    setIsLoading(false);
  };

  const handleRegister = async () => {
    if (!regName.trim() || !regPin.trim()) {
      Alert.alert('Details Needed', 'Please enter a name and a PIN/Password.');
      return;
    }

    if (regPin.trim().length < 4) {
      Alert.alert('Weak Password', 'PIN/Password must be at least 4 digits/characters.');
      return;
    }

    setIsLoading(true);
    const newStudent = await LocalStorageManager.registerStudent(regName, regPin, selectedAvatar);
    setIsLoading(false);

    if (newStudent) {
      Alert.alert('Registration Successful 🎉', `Welcome to your learning room, ${newStudent.name}!`);
      // Reset forms
      setRegName('');
      setRegPin('');
      setIsRegistering(false);
      loadStudents();
    } else {
      Alert.alert('Name Taken', 'A student profile with this name already exists. Please choose a different name.');
    }
  };

  const handleLoginSubmit = async () => {
    if (!selectedStudent) return;

    if (pinInput.trim() === selectedStudent.pin) {
      await LocalStorageManager.setActiveStudentId(selectedStudent.id);
      setPinInput('');
      setSelectedStudent(null);
      router.replace('/(tabs)');
    } else {
      Alert.alert('Incorrect PIN ⚠️', 'The PIN/Password entered is incorrect. Please try again.');
      setPinInput('');
    }
  };

  if (!fontsLoaded || isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Branding header */}
        <View style={styles.header}>
          <Text style={styles.appEmoji}>🦉</Text>
          <Text style={styles.appName}>Adaptive Literacy</Text>
          <Text style={styles.appSubtitle}>Your personal reading & writing tutor</Text>
        </View>

        {/* 1. Normal State: List of Students / Select Profile */}
        {!isRegistering && !selectedStudent && (
          <View style={styles.content}>
            <Text style={styles.title}>Who is learning today?</Text>
            
            {students.length > 0 ? (
              <View style={styles.grid}>
                {students.map((student) => {
                  const avatarConfig = LocalStorageManager.AVATARS.find(a => a.emoji === student.avatar) || LocalStorageManager.AVATARS[0];
                  return (
                    <TouchableOpacity 
                      key={student.id} 
                      style={[styles.profileCard, { backgroundColor: avatarConfig.bg }]}
                      onPress={() => setSelectedStudent(student)}
                    >
                      <Text style={styles.profileEmoji}>{student.avatar}</Text>
                      <Text style={styles.profileName}>{student.name}</Text>
                      <Text style={styles.profileLevel}>Level {student.level}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No student profiles registered yet.</Text>
                <Text style={styles.emptySubtitle}>Tap the button below to register a profile and get started!</Text>
              </View>
            )}

            <TouchableOpacity 
              style={styles.registerToggle}
              onPress={() => setIsRegistering(true)}
            >
              <Text style={styles.registerToggleText}>+ Register New Student</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 2. State: Student Selected (Enter Password/PIN) */}
        {selectedStudent && (
          <View style={styles.content}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => {
                setSelectedStudent(null);
                setPinInput('');
              }}
            >
              <Text style={styles.backButtonText}>← Change Profile</Text>
            </TouchableOpacity>

            <Text style={styles.title}>Welcome back, {selectedStudent.name}!</Text>
            <Text style={styles.subtitle}>Please enter your PIN / Password to enter:</Text>

            <View style={styles.cardContainer}>
              <Text style={styles.avatarBig}>{selectedStudent.avatar}</Text>
              
              <TextInput
                style={styles.input}
                value={pinInput}
                onChangeText={setPinInput}
                placeholder="Enter 4-digit PIN"
                placeholderTextColor="#94A3B8"
                secureTextEntry={true}
                keyboardType="numeric"
                maxLength={8}
              />

              <TouchableOpacity 
                style={styles.submitButton}
                onPress={handleLoginSubmit}
              >
                <Text style={styles.submitButtonText}>Enter Study Room →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 3. State: Registration Form */}
        {isRegistering && (
          <View style={styles.content}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => setIsRegistering(false)}
            >
              <Text style={styles.backButtonText}>← Back to Profile Picker</Text>
            </TouchableOpacity>

            <Text style={styles.title}>Register a New Student</Text>
            <Text style={styles.subtitle}>Create a personal workspace for spelling & reading progress</Text>

            <View style={styles.cardContainer}>
              
              {/* Select Avatar emoji */}
              <Text style={styles.formLabel}>Choose your Avatar:</Text>
              <View style={styles.avatarRow}>
                {LocalStorageManager.AVATARS.map((av) => (
                  <TouchableOpacity
                    key={av.emoji}
                    style={[
                      styles.avatarSelectionCard,
                      { backgroundColor: av.bg },
                      selectedAvatar === av.emoji && styles.avatarSelectedBorder
                    ]}
                    onPress={() => setSelectedAvatar(av.emoji)}
                  >
                    <Text style={styles.avatarSelectionEmoji}>{av.emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.formLabel}>Student Name:</Text>
              <TextInput
                style={[styles.input, { textAlign: 'left', paddingHorizontal: 16 }]}
                value={regName}
                onChangeText={setRegName}
                placeholder="Enter Student Name"
                placeholderTextColor="#94A3B8"
                autoCapitalize="words"
              />

              <Text style={styles.formLabel}>Set PIN/Password (4 digits):</Text>
              <TextInput
                style={[styles.input, { textAlign: 'left', paddingHorizontal: 16 }]}
                value={regPin}
                onChangeText={setRegPin}
                placeholder="Enter 4-digit PIN"
                placeholderTextColor="#94A3B8"
                secureTextEntry={true}
                keyboardType="numeric"
                maxLength={8}
              />

              <TouchableOpacity 
                style={[styles.submitButton, { backgroundColor: '#22C55E' }]}
                onPress={handleRegister}
              >
                <Text style={styles.submitButtonText}>Create Profile 🎉</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { flexGrow: 1, padding: 24, paddingTop: 60, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 40 },
  appEmoji: { fontSize: 64, marginBottom: 8 },
  appName: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 32, color: '#1E293B', textAlign: 'center' },
  appSubtitle: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 16, color: '#64748B', textAlign: 'center', marginTop: 4 },
  
  content: { width: '100%' },
  title: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 24, color: '#1E293B', textAlign: 'center', marginBottom: 24 },
  subtitle: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 16, color: '#64748B', textAlign: 'center', marginBottom: 24 },
  
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16, width: '100%', marginBottom: 32 },
  profileCard: { width: 140, padding: 20, borderRadius: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: '#FFF' },
  profileEmoji: { fontSize: 48, marginBottom: 12 },
  profileName: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: '#1E293B', textAlign: 'center', marginBottom: 4 },
  profileLevel: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: '#64748B', backgroundColor: '#FFF', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 100, overflow: 'hidden' },
  
  emptyContainer: { alignItems: 'center', padding: 24, backgroundColor: '#FFF', borderRadius: 24, borderStyle: 'dashed', borderWidth: 2, borderColor: '#CBD5E1', marginBottom: 32 },
  emptyText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: '#64748B', textAlign: 'center', marginBottom: 8 },
  emptySubtitle: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, color: '#94A3B8', textAlign: 'center' },
  
  registerToggle: { alignSelf: 'center', padding: 12 },
  registerToggleText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: '#3B82F6' },
  
  backButton: { alignSelf: 'flex-start', padding: 12, marginBottom: 16 },
  backButtonText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: '#3B82F6' },
  
  cardContainer: { backgroundColor: '#FFF', borderRadius: 28, padding: 28, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.05, shadowRadius: 16, elevation: 3, width: '100%' },
  avatarBig: { fontSize: 72, textAlign: 'center', marginBottom: 24 },
  input: { backgroundColor: '#F8FAFC', borderWidth: 2, borderColor: '#E2E8F0', borderRadius: 16, padding: 18, fontSize: 18, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#1E293B', textAlign: 'center', marginBottom: 20 },
  submitButton: { backgroundColor: '#3B82F6', padding: 18, borderRadius: 16, alignItems: 'center', shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 3 },
  submitButtonText: { color: '#FFF', fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 18 },
  
  formLabel: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: '#475569', marginBottom: 10, marginTop: 8 },
  avatarRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 },
  avatarSelectionCard: { width: 64, height: 64, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  avatarSelectedBorder: { borderColor: '#3B82F6' },
  avatarSelectionEmoji: { fontSize: 32 }
});
