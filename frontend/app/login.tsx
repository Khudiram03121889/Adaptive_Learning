import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useFonts, PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans';
import { LocalStorageManager, Student } from '../utils/localStorageManager';

const getApiUrl = () => {
  return 'https://adaptive-literacy-backend.onrender.com';
};

const API_URL = getApiUrl();
const SERVER_WAKE_TIMEOUT_MS = 70000;
const REQUEST_TIMEOUT_MS = 45000;

let serverWarmPromise: Promise<void> | null = null;

const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs = REQUEST_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
};

const ensureServerAwake = async () => {
  if (!serverWarmPromise) {
    serverWarmPromise = fetchWithTimeout(`${API_URL}/`, {}, SERVER_WAKE_TIMEOUT_MS)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Backend health check failed with status ${response.status}`);
        }
      })
      .catch((error) => {
        serverWarmPromise = null;
        throw error;
      });
  }

  return serverWarmPromise;
};

export default function LoginScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  // Login Form States
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Registration Form States
  const [regName, setRegName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(LocalStorageManager.AVATARS[0].emoji);

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    // No longer calling ensureServerAwake here to prevent blocking on slow Render backend startup
    // The server will be woken up by the first API call (login/register)
  }, []);

  const handleRegister = async () => {
    if (!regName.trim() || !regUsername.trim() || !regPassword.trim()) {
      Alert.alert('Details Needed', 'Please fill in all fields.');
      return;
    }

    setIsLoading(true);
    try {
      // await ensureServerAwake(); // Removed to prevent blocking
      const response = await fetchWithTimeout(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: regUsername.trim().toLowerCase(),
          name: regName.trim(),
          password: regPassword,
          avatar: selectedAvatar
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        Alert.alert('Registration Failed', data.detail || 'Something went wrong.');
      } else {
        Alert.alert('Registration Successful 🎉', `Welcome, ${data.name}!`);
        await LocalStorageManager.setActiveStudent(data);
        router.replace('/(tabs)');
      }
    } catch (e) {
      console.log('Registration network error:', e);
      Alert.alert('Network Error', 'Could not reach the Render backend. Please check your internet connection or try again after a minute.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSubmit = async () => {
    if (!loginUsername.trim() || !loginPassword.trim()) {
      Alert.alert('Details Needed', 'Please enter both username and password.');
      return;
    }

    setIsLoading(true);
    try {
      // await ensureServerAwake(); // Removed to prevent blocking
      const response = await fetchWithTimeout(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loginUsername.trim().toLowerCase(),
          password: loginPassword
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        Alert.alert('Login Failed', data.detail || 'Incorrect username or password.');
      } else {
        await LocalStorageManager.setActiveStudent(data);
        router.replace('/(tabs)');
      }
    } catch (e) {
      console.log('Login network error:', e);
      Alert.alert('Network Error', 'Could not reach the Render backend. Please check your internet connection or try again after a minute.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!fontsLoaded) {
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

        {/* 1. Normal State: Login */}
        {!isRegistering && (
          <View style={styles.content}>
            <Text style={styles.title}>Welcome Back!</Text>
            
            <View style={styles.cardContainer}>
              <Text style={styles.formLabel}>Username:</Text>
              <TextInput
                style={[styles.input, { textAlign: 'left', paddingHorizontal: 16 }]}
                value={loginUsername}
                onChangeText={setLoginUsername}
                placeholder="Enter username"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
              />

              <Text style={styles.formLabel}>Password:</Text>
              <TextInput
                style={[styles.input, { textAlign: 'left', paddingHorizontal: 16 }]}
                value={loginPassword}
                onChangeText={setLoginPassword}
                placeholder="Enter password"
                placeholderTextColor="#94A3B8"
                secureTextEntry={true}
              />

              {isLoading ? (
                <ActivityIndicator size="large" color="#3B82F6" style={{ marginVertical: 20 }} />
              ) : (
                <TouchableOpacity 
                  style={styles.submitButton}
                  onPress={handleLoginSubmit}
                >
                  <Text style={styles.submitButtonText}>Enter Study Room →</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity 
              style={styles.registerToggle}
              onPress={() => setIsRegistering(true)}
            >
              <Text style={styles.registerToggleText}>+ Register New Account</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 2. State: Registration Form */}
        {isRegistering && (
          <View style={styles.content}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => setIsRegistering(false)}
            >
              <Text style={styles.backButtonText}>← Back to Login</Text>
            </TouchableOpacity>

            <Text style={styles.title}>Register a New Account</Text>
            <Text style={styles.subtitle}>Create your cloud-synced profile!</Text>

            <View style={styles.cardContainer}>
              
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

              <Text style={styles.formLabel}>Display Name:</Text>
              <TextInput
                style={[styles.input, { textAlign: 'left', paddingHorizontal: 16 }]}
                value={regName}
                onChangeText={setRegName}
                placeholder="e.g. John"
                placeholderTextColor="#94A3B8"
                autoCapitalize="words"
              />

              <Text style={styles.formLabel}>Username:</Text>
              <TextInput
                style={[styles.input, { textAlign: 'left', paddingHorizontal: 16 }]}
                value={regUsername}
                onChangeText={setRegUsername}
                placeholder="e.g. john123"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
              />

              <Text style={styles.formLabel}>Password:</Text>
              <TextInput
                style={[styles.input, { textAlign: 'left', paddingHorizontal: 16 }]}
                value={regPassword}
                onChangeText={setRegPassword}
                placeholder="Enter password"
                placeholderTextColor="#94A3B8"
                secureTextEntry={true}
              />

              {isLoading ? (
                <ActivityIndicator size="large" color="#22C55E" style={{ marginVertical: 20 }} />
              ) : (
                <TouchableOpacity 
                  style={[styles.submitButton, { backgroundColor: '#22C55E' }]}
                  onPress={handleRegister}
                >
                  <Text style={styles.submitButtonText}>Create Cloud Profile 🎉</Text>
                </TouchableOpacity>
              )}
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
  
  registerToggle: { alignSelf: 'center', padding: 12, marginTop: 24 },
  registerToggleText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: '#3B82F6' },
  
  backButton: { alignSelf: 'flex-start', padding: 12, marginBottom: 16 },
  backButtonText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: '#3B82F6' },
  
  cardContainer: { backgroundColor: '#FFF', borderRadius: 28, padding: 28, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.05, shadowRadius: 16, elevation: 3, width: '100%' },
  input: { backgroundColor: '#F8FAFC', borderWidth: 2, borderColor: '#E2E8F0', borderRadius: 16, padding: 18, fontSize: 18, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#1E293B', textAlign: 'center', marginBottom: 20 },
  submitButton: { backgroundColor: '#3B82F6', padding: 18, borderRadius: 16, alignItems: 'center', shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 3 },
  submitButtonText: { color: '#FFF', fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 18 },
  
  formLabel: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: '#475569', marginBottom: 10, marginTop: 8 },
  avatarRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 },
  avatarSelectionCard: { width: 64, height: 64, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  avatarSelectedBorder: { borderColor: '#3B82F6' },
  avatarSelectionEmoji: { fontSize: 32 }
});
