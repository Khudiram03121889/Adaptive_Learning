import { View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { useSpeechRecognitionEvent, ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { useFonts, PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans';

import { SessionManager } from '../utils/sessionManager';
import { PatternEngine } from '../utils/patternEngine';
import { analyzeError } from '../utils/errorAnalyzer';

const API_URL = 'http://10.0.2.2:8000'; // Standard Android Emulator/BlueStacks host IP

export default function PracticeScreen() {
  const router = useRouter();
  const { mode } = useLocalSearchParams(); // 'spelling' | 'pronunciation'
  
  const [word, setWord] = useState<string>('');
  const [attempts, setAttempts] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [startTime, setStartTime] = useState(Date.now());
  const [testComplete, setTestComplete] = useState(false);
  
  const [progress, setProgress] = useState({ current: 0, total: 50 });

  const sessionManager = useRef<SessionManager | null>(null);
  const patternEngine = useRef(new PatternEngine());

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  // Speech Recognition Hooks
  useSpeechRecognitionEvent("start", () => setIsRecording(true));
  useSpeechRecognitionEvent("end", () => setIsRecording(false));
  useSpeechRecognitionEvent("result", (event) => {
    const transcript = event.results[0]?.transcript || "";
    setInput(transcript);
  });
  useSpeechRecognitionEvent("error", (event) => {
    console.log("Speech recognition error:", event.error, event.message);
    setIsRecording(false);
    Alert.alert("Speech Error", "Could not recognize speech. Please try again.");
  });

  useEffect(() => {
    fetchWords();
    return () => {
      ExpoSpeechRecognitionModule.stop();
    };
  }, []);

  const fetchWords = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_URL}/words?level=1`);
      const data = await response.json();
      let initialWords = data.words && data.words.length > 0 ? data.words : ['Apple', 'Banana', 'Cat'];
      
      sessionManager.current = new SessionManager(initialWords);
      nextWord();
      
    } catch (error) {
      console.log('Error fetching words:', error);
      sessionManager.current = new SessionManager(['Apple', 'Banana', 'Cat']);
      nextWord();
    } finally {
      setIsLoading(false);
    }
  };

  const nextWord = () => {
    if (!sessionManager.current) return;
    
    const next = sessionManager.current.getNextWord();
    setProgress(sessionManager.current.getProgress());
    
    if (next) {
      setWord(next);
      setStartTime(Date.now());
      setInput('');
      setFeedback(null);
    } else {
      finishTest(attempts);
    }
  };

  const playWord = (slow = false) => {
    if (!word) return;
    Speech.speak(word, {
      rate: slow ? 0.4 : 0.9,
      pitch: 1.0,
    });
  };

  const handleSpeakPress = async () => {
    if (isRecording) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Microphone access is required to use speech recognition.");
      return;
    }

    setInput('');
    
    ExpoSpeechRecognitionModule.start({
      lang: 'en-US',
      interimResults: true,
      maxAlternatives: 1,
    });
  };

  const processAttempt = async (userInput: string, isCorrect: boolean) => {
    if (!sessionManager.current) return;

    const timeTaken = Date.now() - startTime;
    setFeedback(isCorrect ? 'correct' : 'incorrect');

    const errorType = analyzeError(word, userInput);
    if (!isCorrect) {
      patternEngine.current.updatePattern(errorType);
    }

    const newAttempt = {
      user_id: 'test-user-123',
      word: word,
      input: userInput.trim(),
      correct: isCorrect,
      time_taken: timeTaken,
      pattern: errorType === 'none' ? null : errorType
    };

    const newAttemptsArray = [...attempts, newAttempt];
    setAttempts(newAttemptsArray);

    sessionManager.current.recordAttempt(word, isCorrect);

    if (isCorrect) {
      setTimeout(() => {
        nextWord();
      }, 1500);
    } else {
      setTimeout(() => {
        nextWord();
      }, 2500);
    }
  };

  const submitAttempt = () => {
    if (isRecording) {
      ExpoSpeechRecognitionModule.stop();
    }
    
    const isCorrect = input.toLowerCase().trim() === word.toLowerCase();
    processAttempt(input, isCorrect);
  };

  const finishTest = async (finalAttempts: any[]) => {
    setTestComplete(true);
    try {
      await fetch(`${API_URL}/submit-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: 'test-user-123',
          attempts: finalAttempts
        })
      });
    } catch (error) {
      console.log('Error submitting test:', error);
    }
  };

  if (!fontsLoaded || isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#22C55E" />
      </View>
    );
  }

  if (testComplete) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 24, textAlign: 'center', marginBottom: 16 }}>Test Complete! 🎉</Text>
        <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 16, textAlign: 'center', color: '#64748B', marginBottom: 32 }}>
          Your session has been submitted to the AI for analysis. The next batch of words will target your specific weaknesses!
        </Text>
        <TouchableOpacity 
          style={styles.submitButton} 
          onPress={() => router.push('/(tabs)/explore')}
        >
          <Text style={styles.submitButtonText}>See AI Analysis</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isPronunciationMode = mode === 'pronunciation';

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.modeTitle}>
            {mode === 'spelling' ? 'Spelling Mode' : 'Pronunciation Mode'}
          </Text>
          <Text style={styles.progressCounter}>{progress.current}/{progress.total}</Text>
        </View>

        {feedback === 'correct' && (
          <View style={[styles.toast, styles.toastSuccess]}>
            <Text style={styles.toastText}>Great job! 🎉</Text>
          </View>
        )}
        {feedback === 'incorrect' && (
          <View style={[styles.toast, styles.toastError]}>
            <Text style={styles.toastText}>Not quite! The correct word was "{word}".</Text>
          </View>
        )}

        <View style={styles.wordContainer}>
          <Text style={styles.wordText}>
            {isPronunciationMode ? word : (feedback === 'incorrect' || input.length > 0 ? word : '_____')}
          </Text>
          {isPronunciationMode && <Text style={styles.wordSubtitle}>Read this word out loud</Text>}
          {!isPronunciationMode && <Text style={styles.wordSubtitle}>Listen and type</Text>}
          {isPronunciationMode && input.length > 0 && (
            <Text style={{marginTop: 8, color: '#3B82F6', fontFamily: 'PlusJakartaSans_600SemiBold'}}>
              Heard: "{input}"
            </Text>
          )}
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity 
            style={[styles.iconButton, styles.buttonSecondary]} 
            onPress={() => playWord(false)}
            onLongPress={() => playWord(true)}
          >
            <Text style={styles.iconText}>🔊</Text>
            <Text style={styles.iconLabel}>Play (Hold for Slow)</Text>
          </TouchableOpacity>

          {isPronunciationMode && (
            <TouchableOpacity 
              style={[styles.iconButton, isRecording ? styles.buttonRecording : styles.buttonSecondary]}
              onPress={handleSpeakPress}
            >
              <Text style={styles.iconText}>🎤</Text>
              <Text style={[styles.iconLabel, isRecording && styles.iconLabelRecording]}>
                {isRecording ? 'Stop' : 'Speak'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {!isPronunciationMode && (
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Type the word here"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
              autoCorrect={false}
              editable={feedback === null}
            />
          </View>
        )}

        <TouchableOpacity 
          style={[styles.submitButton, (!input || feedback !== null) && styles.submitButtonDisabled]} 
          onPress={submitAttempt}
          disabled={!input || feedback !== null}
        >
          <Text style={styles.submitButtonText}>
            {isPronunciationMode ? 'Check Pronunciation' : 'Submit'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { flexGrow: 1, padding: 24, paddingTop: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40 },
  backButton: { padding: 8 },
  backButtonText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: '#3B82F6' },
  modeTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 18, color: '#1E293B', flex: 1, textAlign: 'center' },
  progressCounter: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 16, color: '#64748B' },
  toast: { position: 'absolute', top: 80, left: 24, right: 24, padding: 16, borderRadius: 16, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4, zIndex: 10 },
  toastSuccess: { backgroundColor: '#22C55E' },
  toastError: { backgroundColor: '#F97316' },
  toastText: { color: '#FFF', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16 },
  wordContainer: { marginBottom: 48, alignItems: 'center', justifyContent: 'center', minHeight: 160, width: '100%', backgroundColor: '#FFF', borderRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 2, padding: 20 },
  wordText: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 48, color: '#1E293B', letterSpacing: 2, textAlign: 'center' },
  wordSubtitle: { marginTop: 12, fontFamily: 'PlusJakartaSans_500Medium', fontSize: 16, color: '#64748B', textAlign: 'center' },
  actionRow: { flexDirection: 'row', justifyContent: 'center', gap: 24, marginBottom: 48, width: '100%' },
  iconButton: { alignItems: 'center', justifyContent: 'center', width: 110, height: 110, borderRadius: 24, backgroundColor: '#FFF', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  buttonSecondary: { borderWidth: 2, borderColor: '#E2E8F0' },
  buttonRecording: { borderWidth: 2, borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  iconText: { fontSize: 32, marginBottom: 8 },
  iconLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B', fontSize: 12, textAlign: 'center' },
  iconLabelRecording: { color: '#EF4444' },
  inputContainer: { width: '100%', marginBottom: 32 },
  input: { backgroundColor: '#FFF', borderWidth: 2, borderColor: '#3B82F6', borderRadius: 16, padding: 20, fontSize: 24, fontFamily: 'PlusJakartaSans_700Bold', color: '#1E293B', textAlign: 'center', shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  submitButton: { backgroundColor: '#22C55E', width: '100%', padding: 20, borderRadius: 16, alignItems: 'center', shadowColor: '#22C55E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4, marginBottom: 40 },
  submitButtonDisabled: { backgroundColor: '#94A3B8', shadowOpacity: 0, elevation: 0 },
  submitButtonText: { color: '#FFF', fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 20 },
});
