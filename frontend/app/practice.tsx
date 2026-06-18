import { View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert, AppState, AppStateStatus } from 'react-native';
import { useState, useEffect, useRef } from 'react';

import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import { useSpeechRecognitionEvent, ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { useFonts, PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans';

import { SessionManager } from '../utils/sessionManager';
import { PatternEngine } from '../utils/patternEngine';
import { analyzeError } from '../utils/errorAnalyzer';
import { LocalStorageManager, Student, StudentAttempt, TestSession } from '../utils/localStorageManager';


const getApiUrl = () => {
  return 'https://adaptive-literacy-backend.onrender.com';
};

const API_URL = getApiUrl();

const OFFLINE_WORD_POOL: { [key: number]: string[] } = {
  1: [
    "cat", "dog", "bat", "rat", "mat", "hat", "fat", "pat", "sat", "vat",
    "pen", "hen", "men", "ten", "den", "zen", "net", "pet", "set", "wet",
    "pig", "dig", "fig", "wig", "rig", "big", "jig", "zip", "lip", "tip",
    "hop", "mop", "pop", "top", "cop", "box", "fox", "pox", "boy", "toy",
    "sun", "run", "bun", "fun", "gun", "nut", "cut", "hut", "gut", "but",
    "cab", "dab", "gab", "jab", "lab", "tab", "bag", "rag", "tag", "wag",
    "ham", "jam", "pam", "ram", "cap", "gap", "lap", "map", "nap", "tap",
    "can", "fan", "man", "pan", "ran", "tan", "van", "bad", "dad", "had",
    "lad", "pad", "sad", "bed", "red", "fed", "led", "wed", "beg", "leg",
    "peg", "jet", "met", "let", "bet", "get", "vet", "yet", "rib", "bib",
    "fib", "lid", "kid", "rid", "hid", "did", "pin", "bin", "fin", "tin",
    "win", "sin", "pit", "sit", "fit", "hit", "kit", "lit", "bit", "mix",
    "fix", "six", "cob", "rob", "sob", "job", "mob", "pod", "rod", "nod",
    "cod", "bog", "fog", "hog", "log", "hot", "lot", "not", "got", "pot",
    "rot", "dot", "cot", "cub", "tub", "rub", "sub", "mud", "bud", "hug",
    "jug", "mug", "rug", "tug", "bug", "gum", "hum", "sum", "cup", "pup",
    "sup", "bus"
  ],
  2: [
    "ship", "shop", "shot", "shut", "shed", "shell", "shock", "shin", "chin", "chop",
    "chat", "chip", "chill", "chug", "chum", "thin", "thick", "that", "this", "them",
    "then", "path", "math", "bath", "moth", "fish", "dish", "wish", "rush", "dash",
    "mash", "cash", "gash", "hash", "lash", "rash", "sash", "bash", "bell", "fell",
    "tell", "sell", "well", "yell", "hill", "mill", "pill", "will", "fill", "bill",
    "doll", "roll", "puff", "huff", "cuff", "ruff", "mess", "less", "moss", "boss",
    "pass", "kiss", "miss", "whip", "when", "whim", "rich", "much", "such",
    "skip", "skin", "step", "stop", "spot", "spin", "spit", "stem", "slam", "slip",
    "sled", "flat", "flag", "flap", "flop", "plan", "plug", "plum", "glad", "glass",
    "club", "clap", "clip", "frog", "from", "trap", "trip", "trot", "crab", "crib",
    "crop", "grab", "grin", "grip", "drop", "drag", "drum", "swim", "swam", "swing",
    "sang", "sing", "ring", "wing", "king", "pink", "sink", "wink", "bank", "tank",
    "hand", "band", "sand", "land", "wind", "find", "fast", "best", "dust", "last",
    "rust", "must", "test", "west", "soft", "loft", "gift", "lift", "left", "kept"
  ],
  3: [
    "train", "brain", "chain", "plain", "rain", "boat", "goat", "coat", "float", "road",
    "soap", "toad", "blue", "clue", "glue", "true", "play", "clay", "gray", "stay",
    "help", "held", "melt", "belt", "hand", "band", "sand", "land", "wind", "find",
    "pain", "main", "gain", "tail", "nail", "sail", "mail", "day", "say", "may",
    "way", "pay", "lay", "tree", "free", "see", "bee", "feet", "meet", "sweet",
    "green", "queen", "street", "seed", "feed", "weed", "deep", "keep", "sleep", "sheep",
    "peep", "weep", "leaf", "beef", "neat", "meat", "seat", "heat", "read", "lead",
    "speak", "peach", "beach", "teach", "reach", "dream", "cream", "steam", "team",
    "park", "dark", "mark", "bark", "yard", "card", "hard", "star", "farm", "harm",
    "corn", "horn", "born", "fort", "port", "herd", "verb", "term", "bird", "girl",
    "dirt", "stir", "shirt", "first", "turn", "burn", "hurt", "fur", "curl", "surf",
    "book", "look", "cook", "took", "foot", "wood", "pool", "cool", "tool", "school",
    "spoon", "moon", "noon", "food", "room", "house", "mouse", "mouth", "cloud", "proud",
    "loud", "out", "shout", "owl", "cow", "how", "now", "town", "down", "brown",
    "gown", "coin", "join", "soil", "oil", "boil", "boy", "toy", "joy", "soy"
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
  const [deviceVoice, setDeviceVoice] = useState<string | undefined>(undefined);
  const [isDeviceVoiceAvailable, setIsDeviceVoiceAvailable] = useState<boolean>(true);
  const [word, setWord] = useState<string>('');
  const [voiceLocale, setVoiceLocale] = useState<'en-US' | 'en-GB' | 'en-IN'>('en-US'); // Default to clear US Phonics for young readers


  const [attempts, setAttempts] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [startTime, setStartTime] = useState(Date.now());
  const [testComplete, setTestComplete] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState<'idle' | 'submitting' | 'processing' | 'ai_complete' | 'fallback_complete' | 'unavailable'>('idle');
  const [analysisMessage, setAnalysisMessage] = useState('Submit your test to prepare the next word batch.');
  
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
          { text: 'OK', onPress: () => router.replace('/login' as any) }
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
          const voices = await Speech.getAvailableVoicesAsync();
          if (voices && voices.length > 0) {
            const selectedVoice = voices.find((v: any) => {
              const lang = v.language.toLowerCase().replace('_', '-');
              return lang === 'en-gb' || lang.startsWith('en-gb') || v.name.toLowerCase().includes('kingdom') || v.name.toLowerCase().includes('gb') || v.name.toLowerCase().includes('british');
            });
            if (selectedVoice) {
              setDeviceVoice(selectedVoice.identifier);
              setIsDeviceVoiceAvailable(true);
              console.log('Selected UK Voice:', selectedVoice.name, selectedVoice.identifier);
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
            setIsDeviceVoiceAvailable(false);
            console.log('No UK English Voice found. Displaying tip banner.');
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
          [{ text: "Back to Home", onPress: () => router.replace('/(tabs)/index' as any) }]
        );
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, []);

  const selectAdaptiveWordsLocal = async (studentId: string, currentLevel: number): Promise<string[]> => {
    const fullPool = OFFLINE_WORD_POOL[currentLevel] || OFFLINE_WORD_POOL[1];
    
    try {
      const attempts = await LocalStorageManager.getAttempts(studentId);
      if (!attempts || attempts.length === 0) {
        // No attempts yet, just take a randomized subset of 50 words
        return [...fullPool].sort(() => 0.5 - Math.random()).slice(0, 50);
      }

      // 1. Analyze historical performance
      const wordHistory: { [key: string]: { correct: boolean; count: number; consecutiveCorrect: number } } = {};
      
      // Sort attempts chronologically to calculate consecutive correct counts
      const sortedAttempts = [...attempts].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      sortedAttempts.forEach(att => {
        const w = att.word.toLowerCase().trim();
        if (!wordHistory[w]) {
          wordHistory[w] = { correct: att.correct, count: 0, consecutiveCorrect: 0 };
        }
        wordHistory[w].count += 1;
        wordHistory[w].correct = att.correct;
        if (att.correct) {
          wordHistory[w].consecutiveCorrect += 1;
        } else {
          wordHistory[w].consecutiveCorrect = 0;
        }
      });

      // Mastered words: got correct on last 3 or more consecutive attempts
      const masteredWords = new Set<string>();
      // Mistakes: incorrect on the most recent attempt
      const recentMistakes: string[] = [];

      Object.entries(wordHistory).forEach(([w, stats]) => {
        if (stats.consecutiveCorrect >= 3) {
          masteredWords.add(w);
        } else if (!stats.correct) {
          recentMistakes.push(w);
        }
      });

      // 2. Select words from full pool
      // Exclude mastered words
      const candidates = fullPool.filter(w => !masteredWords.has(w.toLowerCase().trim()));
      
      // Filter recent mistakes that belong to the current level pool
      const poolWordsLower = new Set(fullPool.map(w => w.toLowerCase().trim()));
      const activeMistakesInLevel = recentMistakes.filter(w => poolWordsLower.has(w));

      // Build our list of exactly 50 words
      const selectedWords: string[] = [];

      // A. Include recent mistakes first (up to 15 words to prevent frustration)
      const mistakesToInclude = activeMistakesInLevel.slice(0, 15);
      mistakesToInclude.forEach(w => {
        const originalWord = fullPool.find(ow => ow.toLowerCase().trim() === w);
        if (originalWord) selectedWords.push(originalWord);
      });

      // B. Fill remainder from un-attempted or un-mastered words in the pool
      const remainingCandidates = candidates.filter(w => !selectedWords.some(sw => sw.toLowerCase().trim() === w.toLowerCase().trim()));
      
      // Shuffle candidates
      const shuffledCandidates = [...remainingCandidates].sort(() => 0.5 - Math.random());
      
      const wordsNeeded = 50 - selectedWords.length;
      if (wordsNeeded > 0) {
        const added = shuffledCandidates.slice(0, wordsNeeded);
        selectedWords.push(...added);
      }

      // C. Safe fallback: if we still don't have 50 words (because too many are mastered),
      // add back some mastered words as "confidence builders"
      if (selectedWords.length < 50) {
        const masteredCandidates = fullPool.filter(w => masteredWords.has(w.toLowerCase().trim()) && !selectedWords.some(sw => sw.toLowerCase().trim() === w.toLowerCase().trim()));
        const shuffledMastered = [...masteredCandidates].sort(() => 0.5 - Math.random());
        const extraNeeded = 50 - selectedWords.length;
        selectedWords.push(...shuffledMastered.slice(0, extraNeeded));
      }

      // D. Final safety check: if we somehow still have fewer than 50 (e.g. pool is empty or extremely small)
      if (selectedWords.length < 50) {
        while (selectedWords.length < 50 && fullPool.length > 0) {
          selectedWords.push(fullPool[Math.floor(Math.random() * fullPool.length)]);
        }
      }

      // Shuffle the final list so they are nicely distributed
      const finalWords = selectedWords.slice(0, 50).sort(() => 0.5 - Math.random());
      
      // Cache these locally
      await LocalStorageManager.cacheStudentWords(studentId, finalWords);
      console.log(`Generated smart local adaptive word list of ${finalWords.length} words for Level ${currentLevel}.`);
      return finalWords;
    } catch (e) {
      console.log('Error selecting adaptive words locally:', e);
      return [...fullPool].sort(() => 0.5 - Math.random()).slice(0, 50);
    }
  };

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
        initialWords = await selectAdaptiveWordsLocal(studentId, currentLevel);
      }
      
      setLevel(data.level || currentLevel);
      sessionManager.current = new SessionManager(initialWords);
      nextWord();
      
    } catch (error) {
      console.log('Error fetching words from server:', error);
      let initialWords = await LocalStorageManager.getCachedStudentWords(studentId);
      if (!initialWords || initialWords.length === 0) {
        initialWords = await selectAdaptiveWordsLocal(studentId, currentLevel);
      }
      setLevel(currentLevel);
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
    const clean = word.toLowerCase().trim();
    
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


  const isPronunciationCorrect = (target: string, userInput: string): boolean => {
    const t = cleanWord(target);
    const i = cleanWord(userInput);
    
    // 1. Exact match after cleaning
    if (t === i) return true;
    
    // 2. Substring match: if they said a phrase containing the target word (e.g. "a cat", "the ship", "say ship")
    if (i.includes(t)) return true;
    
    const inputWords = i.split(' ');
    // 3. Exact word match within the phrase
    if (inputWords.includes(t)) return true;
    
    // 4. Fuzzy Levenshtein Distance for minor child speech recognition errors
    const getLevenshteinDistance = (a: string, b: string): number => {
      const matrix = [];
      for (let index = 0; index <= b.length; index++) matrix[index] = [index];
      for (let jndex = 0; jndex <= a.length; jndex++) matrix[0][jndex] = jndex;
      for (let index = 1; index <= b.length; index++) {
        for (let jndex = 1; jndex <= a.length; jndex++) {
          if (b.charAt(index - 1) === a.charAt(jndex - 1)) {
            matrix[index][jndex] = matrix[index - 1][jndex - 1];
          } else {
            matrix[index][jndex] = Math.min(
              matrix[index - 1][jndex - 1] + 1, // substitution
              Math.min(
                matrix[index][jndex - 1] + 1, // insertion
                matrix[index - 1][jndex] + 1  // deletion
              )
            );
          }
        }
      }
      return matrix[b.length][a.length];
    };
    
    // Allow minor typos/slurs (max distance 1 for short words, 2 for longer ones)
    const maxDistance = t.length <= 3 ? 1 : 2;
    for (const wordItem of inputWords) {
      if (getLevenshteinDistance(t, wordItem) <= maxDistance) {
        return true;
      }
    }
    
    // 5. Naive child-phonetic simplified mappings (ignore vowels and map phonetically similar consonants)
    const getPhoneticSimplified = (str: string): string => {
      return str
        .replace(/ee/g, 'i')
        .replace(/ea/g, 'i')
        .replace(/oo/g, 'u')
        .replace(/ph/g, 'f')
        .replace(/sh/g, 's')
        .replace(/ch/g, 't')
        .replace(/ck/g, 'k')
        .replace(/c/g, 'k')
        .replace(/j/g, 'g')
        .replace(/d/g, 't')
        .replace(/th/g, 'f')
        .replace(/[aeiouy]/g, '_');
    };
    
    const tPhonetic = getPhoneticSimplified(t);
    for (const wordItem of inputWords) {
      if (getPhoneticSimplified(wordItem) === tPhonetic) {
        return true;
      }
    }
    
    return false;
  };

  const submitAttempt = () => {
    if (isRecording) {
      ExpoSpeechRecognitionModule.stop();
    }
    
    const isPronunciationMode = mode === 'pronunciation';
    const isCorrect = isPronunciationMode 
      ? isPronunciationCorrect(word, input) 
      : cleanWord(input) === cleanWord(word);
      
    processAttempt(input, isCorrect);
  };

  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const pollAnalysisStatus = async (studentId: string, initialStatus?: string) => {
    let status = initialStatus || 'processing';
    setAnalysisStatus(status === 'processing' ? 'processing' : (status as any));

    if (status !== 'processing') {
      return;
    }

    for (let attempt = 0; attempt < 30; attempt++) {
      await wait(2000);
      try {
        const response = await fetch(`${API_URL}/analysis-status?user_id=${studentId}`);
        if (!response.ok) {
          continue;
        }

        const data = await response.json();
        status = data.status || 'processing';
        setAnalysisStatus(status as any);
        setAnalysisMessage(data.message || 'Preparing the next adaptive word batch.');

        if (status !== 'processing') {
          return;
        }
      } catch (error) {
        console.log('Error polling analysis status:', error);
      }
    }

    setAnalysisStatus('fallback_complete');
    setAnalysisMessage('The local adaptive word batch is ready. AI analysis may still finish on the server.');
  };

  const finishTest = async (finalAttempts: any[]) => {
    setTestComplete(true);
    setAnalysisStatus('submitting');
    setAnalysisMessage('Submitting your test and preparing the next word batch...');
    
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
      
      // Construct and save structured session history
      const newSession: TestSession = {
        id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        level: level,
        mode: (mode as 'spelling' | 'pronunciation') || 'spelling',
        totalWords: totalQuestions,
        correctCount: correctAttempts,
        wrongCount: totalQuestions - correctAttempts,
        masteryPercentage: masteryPercentage,
        attempts: studentAttempts
      };
      await LocalStorageManager.saveTestSession(studentId, newSession);
      console.log(`Saved structured test session with score ${correctAttempts}/${totalQuestions} (${masteryPercentage}%)`);

      if (passed) {
        await LocalStorageManager.updateStudentLevel(studentId, level + 1);
        console.log(`Student ${activeStudent.name} progressed to Level ${level + 1}`);
      }
    }

    try {
      const response = await fetch(`${API_URL}/submit-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: studentId,
          attempts: finalAttempts,
          level: level
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Server rejected the test submission');
      }

      if (typeof data.next_level === 'number') {
        await LocalStorageManager.updateStudentLevel(studentId, data.next_level);
      }

      if (data.words_ready) {
        setAnalysisStatus('fallback_complete');
        setAnalysisMessage(data.message || 'Next word batch is ready.');
      } else {
        setAnalysisStatus((data.analysis_status || 'processing') as any);
        setAnalysisMessage(data.message || 'Preparing the next adaptive word batch.');
        await pollAnalysisStatus(studentId, data.analysis_status);
      }
    } catch (error) {
      console.log('Error submitting test to server:', error);
      setAnalysisStatus('unavailable');
      setAnalysisMessage('The server could not be reached. Local progress was saved on this device.');
    } finally {
      // Clear the local cache of words so we generate or fetch a fresh batch next time
      await LocalStorageManager.cacheStudentWords(studentId, []);
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
    const analysisReady = analysisStatus === 'ai_complete' || analysisStatus === 'fallback_complete';
    const analysisUnavailable = analysisStatus === 'unavailable';
    const canOpenAnalysis = analysisReady || analysisUnavailable;

    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 24, textAlign: 'center', marginBottom: 16 }}>Test Complete! 🎉</Text>
        <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 16, textAlign: 'center', color: '#64748B', marginBottom: 32 }}>
          {analysisMessage}
        </Text>
        {!canOpenAnalysis && <ActivityIndicator size="large" color="#22C55E" style={{ marginBottom: 20 }} />}
        <TouchableOpacity 
          style={[styles.submitButton, !canOpenAnalysis && styles.submitButtonDisabled]} 
          onPress={() => router.push('/(tabs)/explore' as any)}
          disabled={!canOpenAnalysis}
        >
          <Text style={styles.submitButtonText}>{analysisReady ? 'See Analysis' : 'Back to Reports'}</Text>
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

        {feedback === 'correct' && (
          <View style={[styles.toast, styles.toastSuccess]}>
            <Text style={styles.toastText}>Great job! 🎉</Text>
          </View>
        )}
        {feedback === 'incorrect' && (
          <View style={[styles.toast, styles.toastError]}>
            <Text style={styles.toastText}>Not quite! The correct word was {'"'}{word}{'"'}.</Text>
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
              Heard: {'"'}{input}{'"'}
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

        {!isDeviceVoiceAvailable && (
          <View style={styles.voiceWarningCard}>
            <Text style={styles.voiceWarningTitle}>💡 Tip for Parents & Teachers</Text>
            <Text style={styles.voiceWarningText}>
              For a clear, authentic British English voice, download the free {'"'}English (United Kingdom){'"'} TTS package in your phone settings:
            </Text>
            <Text style={styles.voiceWarningSteps}>
              Settings ➔ System ➔ Languages ➔ Text-to-speech output ➔ Tap gear icon next to Preferred engine ➔ Install voice data ➔ English (United Kingdom).
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
  accentToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 14,
    padding: 3,
    marginBottom: 24,
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
