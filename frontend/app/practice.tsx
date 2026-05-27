import { View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert, AppState, AppStateStatus } from 'react-native';
import { useState, useEffect, useRef } from 'react';

import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import { useSpeechRecognitionEvent, ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { useFonts, PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans';
import Constants from 'expo-constants';

import { SessionManager } from '../utils/sessionManager';
import { PatternEngine } from '../utils/patternEngine';
import { analyzeError } from '../utils/errorAnalyzer';
import { LocalStorageManager, Student, StudentAttempt } from '../utils/localStorageManager';


const getApiUrl = () => {
  if (Platform.OS === 'web') {
    return 'http://localhost:8000';
  }
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    return `http://${ip}:8000`;
  }
  return 'http://10.0.2.2:8000';
};

const API_URL = getApiUrl();

const OFFLINE_WORD_POOL: { [key: number]: string[] } = {
  1: [
    "cat", "dog", "bat", "rat", "mat", "hat", "fat", "pat", "sat", "vat",
    "pen", "hen", "men", "ten", "den", "zen", "net", "pet", "set", "wet",
    "pig", "dig", "fig", "wig", "rig", "big", "jig", "zip", "lip", "tip",
    "hop", "mop", "pop", "top", "cop", "box", "fox", "pox", "boy", "toy",
    "sun", "run", "bun", "fun", "gun", "nut", "cut", "hut", "gut", "but"
  ],
  2: [
    "ship", "shop", "shot", "shut", "shed", "shell", "shock", "shin", "chin", "chop",
    "chat", "chip", "chill", "chug", "chum", "thin", "thick", "that", "this", "them",
    "then", "path", "math", "bath", "moth", "fish", "dish", "wish", "rush", "dash",
    "mash", "cash", "gash", "hash", "lash", "rash", "sash", "bash", "bell", "fell"
  ],
  3: [
    "tell", "sell", "well", "yell", "hill", "mill", "pill", "will", "fill", "bill",
    "train", "brain", "chain", "plain", "rain", "boat", "goat", "coat", "float", "road",
    "soap", "toad", "blue", "clue", "glue", "true", "play", "clay", "gray", "stay",
    "help", "held", "melt", "belt", "hand", "band", "sand", "land", "wind", "find"
  ]
};

const cleanWord = (str: string) => {
  return str
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "")
    .replace(/\s+/g, " ")
    .trim();
};


export default function PracticeScreen() {
  const router = useRouter();
  const { mode } = useLocalSearchParams(); // 'spelling' | 'pronunciation'
  
  const [level, setLevel] = useState<number>(1);
  const [activeStudent, setActiveStudent] = useState<Student | null>(null);
  const [indianVoice, setIndianVoice] = useState<string | undefined>(undefined);
  const [isIndianVoiceAvailable, setIsIndianVoiceAvailable] = useState<boolean>(true);
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
    const initialize = async () => {
      const student = await LocalStorageManager.getActiveStudent();
      if (!student) {
        Alert.alert('Login Required', 'Please choose a profile to begin.', [
          { text: 'OK', onPress: () => router.replace('/login') }
        ]);
        return;
      }
      setActiveStudent(student);
      setLevel(student.level);
      await fetchWords(student.id, student.level);
    };
    initialize();

    // Robust retry voice loader
    const loadVoices = async () => {
      let retryAttempts = 0;
      const tryLoad = async () => {
        try {
          const voices = await Speech.getVoicesAsync();
          if (voices && voices.length > 0) {
            const inVoice = voices.find(v => {
              const lang = v.language.toLowerCase().replace('_', '-');
              return lang === 'en-in' || lang.startsWith('en-in') || v.name.toLowerCase().includes('india') || v.name.toLowerCase().includes('en-in');
            });
            if (inVoice) {
              setIndianVoice(inVoice.identifier);
              setIsIndianVoiceAvailable(true);
              console.log('Selected Indian Voice:', inVoice.name, inVoice.identifier);
              return true;
            }
          }
          return false;
        } catch (err) {
          console.log('Error loading voices:', err);
          return false;
        }
      };

      let success = await tryLoad();
      if (!success) {
        const intervalId = setInterval(async () => {
          retryAttempts++;
          const ok = await tryLoad();
          if (ok) {
            clearInterval(intervalId);
          } else if (retryAttempts >= 5) {
            clearInterval(intervalId);
            setIsIndianVoiceAvailable(false);
            console.log('No Indian English Voice found. Displaying tip banner.');
          }
        }, 800);
      }
    };
    loadVoices();

    return () => {
      ExpoSpeechRecognitionModule.stop();
    };
  }, []);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'inactive' || nextAppState === 'background') {
        Alert.alert(
          "Session Reset ⚠️",
          "Leaving the app during a spelling or pronunciation session is not allowed. Your progress has been reset.",
          [{ text: "Back to Home", onPress: () => router.replace('/(tabs)/index') }]
        );
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, []);

  const fetchWords = async (studentId: string, currentLevel: number) => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_URL}/words?level=${currentLevel}&user_id=${studentId}`);
      const data = await response.json();
      
      let initialWords = data.words && data.words.length > 0 ? data.words : null;
      
      if (!initialWords) {
        const cached = await LocalStorageManager.getCachedStudentWords(studentId);
        if (cached && cached.length > 0) {
          initialWords = cached;
          console.log('Using locally cached next 50 words.');
        }
      }
      
      if (!initialWords) {
        initialWords = OFFLINE_WORD_POOL[currentLevel] || OFFLINE_WORD_POOL[1];
      }
      
      setLevel(data.level || currentLevel);
      sessionManager.current = new SessionManager(initialWords);
      nextWord();
      
    } catch (error) {
      console.log('Error fetching words from server:', error);
      let initialWords = await LocalStorageManager.getCachedStudentWords(studentId);
      if (!initialWords || initialWords.length === 0) {
        initialWords = OFFLINE_WORD_POOL[currentLevel] || OFFLINE_WORD_POOL[1];
      }
      sessionManager.current = new SessionManager(initialWords);
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

  const playWord = async (slow = false) => {
    if (!word) return;
    try {
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=en-IN&client=tw-ob&q=${encodeURIComponent(word)}`;
      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { 
          shouldPlay: true,
          rate: slow ? 0.55 : 0.82, // High-clarity custom speeds
          shouldCorrectPitch: true
        }
      );
      
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
        }
      });
    } catch (error) {
      console.log('Error streaming premium TTS, using native system voice pack:', error);
      Speech.speak(word, {
        language: 'en-IN',
        voice: indianVoice,
        rate: slow ? 0.45 : 0.82,
        pitch: 1.0,
      });
    }
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
      user_id: activeStudent?.id || 'test-user-123',
      word: word,
      input: userInput.trim(),
      correct: isCorrect,
      time_taken: timeTaken,
      pattern: errorType === 'none' ? null : errorType,
      mode: mode || 'spelling'
    };

    const newAttemptsArray = [...attempts, newAttempt];
    setAttempts(newAttemptsArray);

    sessionManager.current.recordAttempt(word, isCorrect);
  };


  const submitAttempt = () => {
    if (isRecording) {
      ExpoSpeechRecognitionModule.stop();
    }
    
    const isCorrect = cleanWord(input) === cleanWord(word);
    processAttempt(input, isCorrect);
  };

  const finishTest = async (finalAttempts: any[]) => {
    setTestComplete(true);
    
    const studentId = activeStudent?.id || 'test-user-123';
    
    // Calculate local offline mastery and progress the student
    const correctAttempts = finalAttempts.filter(a => a.correct).length;
    const totalQuestions = finalAttempts.length || 50;
    const masteryPercentage = Math.round((correctAttempts / totalQuestions) * 100);
    const passed = masteryPercentage >= 85;

    // Save attempts locally to phone
    if (activeStudent) {
      const studentAttempts: StudentAttempt[] = finalAttempts.map(a => ({
        studentId: studentId,
        word: a.word,
        input: a.input,
        correct: a.correct,
        timeTaken: a.time_taken,
        pattern: a.pattern,
        mode: a.mode,
        timestamp: new Date().toISOString()
      }));
      await LocalStorageManager.saveAttempts(studentId, studentAttempts);
      
      if (passed) {
        await LocalStorageManager.updateStudentLevel(studentId, activeStudent.level + 1);
        console.log(`Student ${activeStudent.name} progressed to Level ${activeStudent.level + 1}`);
      }
    }

    try {
      await fetch(`${API_URL}/submit-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: studentId,
          attempts: finalAttempts,
          level: level
        })
      });
    } catch (error) {
      console.log('Error submitting test to server:', error);
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
  const isPlayDisabled = isPronunciationMode && feedback === null;

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
            {isPronunciationMode ? word : (feedback !== null ? word : word.split('').map(() => '_').join(' '))}
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
            style={[
              styles.iconButton, 
              styles.buttonSecondary,
              isPlayDisabled && { opacity: 0.5, borderColor: '#CBD5E1', backgroundColor: '#F1F5F9' }
            ]} 
            onPress={() => playWord(false)}
            onLongPress={() => playWord(true)}
            disabled={isPlayDisabled}
          >
            <Text style={[styles.iconText, isPlayDisabled && { opacity: 0.5 }]}>🔊</Text>
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
              autoComplete="off"
              keyboardType="visible-password"
              editable={feedback === null}
            />
          </View>
        )}

        <TouchableOpacity 
          style={[
            styles.submitButton, 
            feedback === null && !input && styles.submitButtonDisabled,
            feedback !== null && { backgroundColor: '#3B82F6', shadowColor: '#3B82F6' }
          ]} 
          onPress={feedback !== null ? nextWord : submitAttempt}
          disabled={feedback === null && !input}
        >
          <Text style={styles.submitButtonText}>
            {feedback !== null ? 'Next Word →' : (isPronunciationMode ? 'Check Pronunciation' : 'Submit')}
          </Text>
        </TouchableOpacity>

        {!isIndianVoiceAvailable && (
          <View style={styles.voiceWarningCard}>
            <Text style={styles.voiceWarningTitle}>💡 Tip for Parents & Teachers</Text>
            <Text style={styles.voiceWarningText}>
              For a clear, authentic Indian English voice, download the free "English (India)" TTS package in your phone settings:
            </Text>
            <Text style={styles.voiceWarningSteps}>
              Settings ➔ System ➔ Languages ➔ Text-to-speech output ➔ Tap gear icon next to Preferred engine ➔ Install voice data ➔ English (India).
            </Text>
          </View>
        )}
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
  submitButton: { backgroundColor: '#22C55E', width: '100%', padding: 20, borderRadius: 16, alignItems: 'center', shadowColor: '#22C55E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4, marginBottom: 20 },
  submitButtonDisabled: { backgroundColor: '#94A3B8', shadowOpacity: 0, elevation: 0 },
  submitButtonText: { color: '#FFF', fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 20 },
  voiceWarningCard: {
    backgroundColor: '#FEF3C7',
    borderWidth: 2,
    borderColor: '#F59E0B',
    borderRadius: 20,
    padding: 20,
    marginTop: 10,
    marginBottom: 40,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  voiceWarningTitle: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 16,
    color: '#92400E',
    marginBottom: 8,
  },
  voiceWarningText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: '#92400E',
    lineHeight: 20,
    marginBottom: 8,
  },
  voiceWarningSteps: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: '#B45309',
    lineHeight: 18,
  },
});
