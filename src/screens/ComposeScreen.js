// src/screens/ComposeScreen.js
import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
  StatusBar,
  Modal
} from 'react-native';
import { DateTime } from 'luxon';
import { saveLetter } from '../lib/storage';
import { flightProgressPercent } from '../lib/simulation';
import defaultFlights from '../lib/defaultFlights';
import theme from '../theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';

const { width } = Dimensions.get('window');

export default function ComposeScreen({ navigation, route }) {
  const flightA = route?.params?.flightA || defaultFlights.flightA;
  const flightB = route?.params?.flightB || defaultFlights.flightB;
  
  const [text, setText] = useState('');
  const [isFullScreenMode, setIsFullScreenMode] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isCountdownActive, setIsCountdownActive] = useState(false);
  const [flightStatus, setFlightStatus] = useState('waiting'); // waiting, active, expired
  const [progressA, setProgressA] = useState(0);
  const [progressB, setProgressB] = useState(0);
  const [letterSent, setLetterSent] = useState(false);
  
  // Animation references
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const countdownColorAnim = useRef(new Animated.Value(0)).current;
  const characterCountAnim = useRef(new Animated.Value(1)).current;
  
  // Refs for saving optimization
  const saveTimeoutRef = useRef(null);
  const lastSavedTextRef = useRef('');

  useEffect(() => {
    // Load saved draft when component mounts
    loadDraft();
    
    // Start entrance animation
    Animated.sequence([
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    // Start pulsing animation for countdown
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    const timer = setInterval(updateFlightStatus, 1000);
    updateFlightStatus(); // Initial call
    
    return () => {
      clearInterval(timer);
      // Clear any pending save timeouts
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      // Save draft when component unmounts if text has changed - use timeout to avoid blocking
      if (text.trim() && text !== lastSavedTextRef.current) {
        setTimeout(() => {
          saveDraftSync(text);
        }, 0);
      }
    };
  }, []); // Only run once on mount

  // Save text when screen loses focus (user navigates away)
  useFocusEffect(
    React.useCallback(() => {
      // Only load draft on initial focus, not every time
      if (text === '') {
        loadDraft();
      }
      
      return () => {
        // Save draft when screen loses focus if text has changed
        if (text.trim() && text !== lastSavedTextRef.current) {
          saveDraftSync(text);
        }
      };
    }, []) // Remove text dependency to prevent constant reloading
  );

  // Debounced auto-save effect - only save when user stops typing for 5 seconds
  useEffect(() => {
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Only set up auto-save if text has changed and is not empty
    if (text.trim() && text !== lastSavedTextRef.current) {
      saveTimeoutRef.current = setTimeout(() => {
        saveDraftDebounced(text);
      }, 5000); // Increased to 5 seconds to reduce frequency
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [text]);

  // Load draft from storage
  const loadDraft = async () => {
    try {
      const savedDraft = await AsyncStorage.getItem('letterDraft');
      if (savedDraft && savedDraft !== text && text === '') {
        // Only load if current text is empty to avoid conflicts
        setText(savedDraft);
        lastSavedTextRef.current = savedDraft;
        console.log('Draft loaded:', savedDraft.length, 'characters');
      }
    } catch (error) {
      console.log('Error loading draft:', error);
    }
  };

  // Debounced save function
  const saveDraftDebounced = async (draftText) => {
    try {
      if (draftText && draftText.trim() && draftText !== lastSavedTextRef.current) {
        await AsyncStorage.setItem('letterDraft', draftText);
        lastSavedTextRef.current = draftText;
        console.log('Draft saved (debounced):', draftText.length, 'characters');
      }
    } catch (error) {
      console.log('Error saving draft:', error);
    }
  };

  // Synchronous save for important moments (unmount, navigation, etc.)
  const saveDraftSync = async (draftText) => {
    try {
      if (draftText && draftText.trim() && draftText !== lastSavedTextRef.current) {
        await AsyncStorage.setItem('letterDraft', draftText);
        lastSavedTextRef.current = draftText;
        console.log('Draft saved (sync):', draftText.length, 'characters');
      }
    } catch (error) {
      console.log('Error saving draft:', error);
    }
  };

  // Clear draft after sending
  const clearDraft = async () => {
    try {
      await AsyncStorage.removeItem('letterDraft');
      lastSavedTextRef.current = '';
    } catch (error) {
      console.log('Error clearing draft:', error);
    }
  };

  // Handle text change - removed immediate save
  const handleTextChange = (newText) => {
    setText(newText);
    // No immediate save here - let the debounced effect handle it
  };

  useEffect(() => {
    // Animate character count when text changes
    if (text.length > 0) {
      Animated.sequence([
        Animated.timing(characterCountAnim, {
          toValue: 1.1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(characterCountAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [text.length]);

  const updateFlightStatus = () => {
    const now = DateTime.utc();
    const flightAStart = DateTime.fromISO(flightA.departureUTC, { zone: 'utc' });
    const flightAEnd = DateTime.fromISO(flightA.arrivalUTC, { zone: 'utc' });
    
    // Letter writing window starts exactly at flight departure time and lasts for 1 hour
    const letterWindowEnd = flightAStart.plus({ hours: 1 });
    
    const newProgressA = flightProgressPercent(flightA.departureUTC, flightA.arrivalUTC);
    const newProgressB = flightProgressPercent(flightB.departureUTC, flightB.arrivalUTC);
    
    setProgressA(newProgressA);
    setProgressB(newProgressB);

    if (now < flightAStart) {
      // Flight hasn't started yet - letter window not open
      const timeToFlight = flightAStart.diff(now, 'milliseconds').milliseconds;
      setTimeRemaining(timeToFlight);
      setFlightStatus('waiting');
      setIsCountdownActive(false);
    } else if (now >= flightAStart && now <= letterWindowEnd) {
      // Flight has started - letter window is OPEN (1-hour window from departure)
      const timeLeft = letterWindowEnd.diff(now, 'milliseconds').milliseconds;
      setTimeRemaining(timeLeft);
      setFlightStatus('active');
      setIsCountdownActive(true);
      
      // Animate countdown color as time runs out
      const progress = 1 - (timeLeft / (60 * 60 * 1000)); // 0 to 1 over 1 hour
      Animated.timing(countdownColorAnim, {
        toValue: progress,
        duration: 100,
        useNativeDriver: false,
      }).start();
      
      // Auto-send letter when time expires (if there's content)
      if (timeLeft <= 1000 && text.trim() && !letterSent) {
        handleAutoSendLetter();
      }
    } else {
      // Letter window has expired (1 hour after flight departure)
      setTimeRemaining(0);
      setFlightStatus('expired');
      setIsCountdownActive(false);
    }
  };

  const handleAutoSendLetter = async () => {
    if (letterSent || !text.trim()) return;
    
    setLetterSent(true);
    
    try {
      await saveLetter(text, 0); // Send immediately when auto-sent
      await clearDraft(); // Clear saved draft
      
      Animated.sequence([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      Alert.alert(
        'Letter Auto-Sent! ✈️', 
        'Time\'s up! Your letter has been automatically sent and is now traveling between flights.',
        [{ 
          text: 'Track on Map', 
          onPress: () => navigation.navigate('Map') 
        }]
      );
      setText('');
    } catch (error) {
      Alert.alert('Failed to send', 'Could not send your letter. Please try again.');
      setLetterSent(false);
    }
  };

  const handleManualSendLetter = async () => {
    if (!text.trim()) {
      Alert.alert('Empty Letter', 'Please write something before sending your letter.');
      return;
    }

    if (flightStatus !== 'active') {
      Alert.alert(
        'Cannot Send Now', 
        flightStatus === 'waiting' 
          ? 'The letter window opens exactly at flight departure time. Please wait!'
          : 'The letter window has closed. It was open for 1 hour after flight departure.'
      );
      return;
    }

    try {
      await saveLetter(text, 0); // Send immediately
      await clearDraft(); // Clear saved draft
      setLetterSent(true);
      
      // Success animation
      Animated.sequence([
        Animated.timing(slideAnim, {
          toValue: 1.1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      Alert.alert(
        'Letter Sent! ✉️', 
        'Your letter is now traveling between the flights and will arrive when the destination flight lands.',
        [{ 
          text: 'View Journey', 
          onPress: () => navigation.navigate('Map') 
        }]
      );
      setText('');
      setLetterSent(false);
    } catch (error) {
      Alert.alert('Failed to send', 'Could not send your letter. Please try again.');
    }
  };

  const formatTimeRemaining = (milliseconds) => {
    if (milliseconds <= 0) return '00:00:00';
    
    const totalSeconds = Math.ceil(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const getStatusMessage = () => {
    switch (flightStatus) {
      case 'waiting':
        return `⏰ Flight ${flightA.flightNumber} hasn't departed yet. Letter window opens exactly at departure time!`;
      case 'active':
        return `🟢 Flight ${flightA.flightNumber} has departed! Letter window is OPEN for ${formatTimeRemaining(timeRemaining)}`;
      case 'expired':
        return `🔴 Letter window closed. The 1-hour window ended 1 hour after ${flightA.flightNumber} departure.`;
      default:
        return 'Checking flight status...';
    }
  };

  const getCountdownColor = () => {
    if (!isCountdownActive) return theme.colors.textMuted;
    
    return countdownColorAnim.interpolate({
      inputRange: [0, 0.5, 0.8, 1],
      outputRange: [theme.colors.success, theme.colors.warning, theme.colors.danger, theme.colors.danger],
    });
  };

  const handleTextInputFocus = () => {
    if (flightStatus === 'active') {
      setIsFullScreenMode(true);
    }
  };

  const handleFullScreenClose = () => {
    setIsFullScreenMode(false);
    // Save immediately when closing full screen, but only if text changed
    if (text.trim() && text !== lastSavedTextRef.current) {
      // Use setTimeout to avoid blocking the UI
      setTimeout(() => {
        saveDraftSync(text);
      }, 100);
    }
  };

  const characterLimit = 6000; // Updated character limit
  const characterCount = text.length;
  const isNearLimit = characterCount > characterLimit * 0.8;

  // Full-screen writing modal
  const renderFullScreenEditor = () => (
    <Modal
      visible={isFullScreenMode}
      animationType="slide"
      statusBarTranslucent={true}
    >
      <View style={styles.fullScreenContainer}>
        <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />
        
        {/* Full-screen header */}
        <View style={styles.fullScreenHeader}>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={handleFullScreenClose}
          >
            <Text style={styles.closeButtonText}>← Done</Text>
          </TouchableOpacity>
          
          <View style={styles.fullScreenHeaderCenter}>
            <Text style={styles.fullScreenTitle}>Compose Letter</Text>
            <Text style={styles.fullScreenTimer}>
              {formatTimeRemaining(timeRemaining)}
            </Text>
          </View>

          <View style={styles.fullScreenHeaderRight}>
            <Text style={[
              styles.fullScreenCharCount,
              { color: isNearLimit ? theme.colors.danger : 'rgba(255,255,255,0.8)' }
            ]}>
              {characterCount}/{characterLimit}
            </Text>
          </View>
        </View>

        {/* Full-screen text input */}
        <View style={styles.fullScreenInputContainer}>
          <TextInput
            style={styles.fullScreenTextInput}
            placeholder="Dear fellow traveler,&#10;&#10;I hope your journey is going well..."
            placeholderTextColor={theme.colors.textMuted}
            multiline
            value={text}
            onChangeText={handleTextChange}
            textAlignVertical="top"
            autoFocus={true}
            maxLength={characterLimit}
          />
        </View>

        {/* Full-screen bottom bar */}
        <View style={styles.fullScreenBottomBar}>
          <TouchableOpacity 
            style={[
              styles.fullScreenSendButton,
              !text.trim() && styles.fullScreenSendButtonDisabled
            ]}
            onPress={() => {
              handleFullScreenClose();
              setTimeout(() => handleManualSendLetter(), 100); // Small delay to ensure state updates
            }}
            disabled={!text.trim()}
          >
            <Text style={[
              styles.fullScreenSendButtonText,
              !text.trim() && styles.fullScreenSendButtonTextDisabled
            ]}>
              Send Letter ✉️
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <>
      {renderFullScreenEditor()}
      
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />
      
      <Animated.ScrollView 
        style={[styles.scrollContainer, {
          transform: [{ translateY: slideAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [50, 0]
          }) }],
          opacity: slideAnim,
        }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Section */}
        <View style={styles.header}>
          <Text style={styles.title}>Compose Air Letter</Text>
          <Text style={styles.subtitle}>
            Send a message to your fellow traveler ✈️
          </Text>
        </View>

        {/* Flight Status Card */}
        <Animated.View style={[styles.statusCard, {
          transform: [{ scale: isCountdownActive ? pulseAnim : 1 }]
        }]}>
          <View style={styles.statusHeader}>
            <Text style={styles.statusTitle}>Flight Status</Text>
            {isCountdownActive && (
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>LIVE</Text>
              </View>
            )}
          </View>
          
          <Text style={styles.statusMessage}>
            {getStatusMessage()}
          </Text>

          {/* Countdown Display */}
          <View style={styles.countdownContainer}>
            <Text style={styles.countdownLabel}>
              {flightStatus === 'waiting' ? 'Time until departure (letter window opens):' : 
               flightStatus === 'active' ? 'Letter window closes in:' : 'Window status:'}
            </Text>
            <Animated.Text style={[
              styles.countdownTime,
              { color: getCountdownColor() }
            ]}>
              {flightStatus === 'expired' ? 'CLOSED' : formatTimeRemaining(timeRemaining)}
            </Animated.Text>
          </View>

          {/* Progress Indicators */}
          <View style={styles.progressSection}>
            <View style={styles.flightProgress}>
              <Text style={styles.flightLabel}>
                ✈️ {flightA.flightNumber}: {Math.round(progressA * 100)}%
              </Text>
              <View style={styles.progressBar}>
                <Animated.View 
                  style={[styles.progressFill, { 
                    width: `${progressA * 100}%`,
                    backgroundColor: theme.colors.primary 
                  }]} 
                />
              </View>
            </View>
            
            <View style={styles.flightProgress}>
              <Text style={styles.flightLabel}>
                🛫 {flightB.flightNumber}: {Math.round(progressB * 100)}%
              </Text>
              <View style={styles.progressBar}>
                <Animated.View 
                  style={[styles.progressFill, { 
                    width: `${progressB * 100}%`,
                    backgroundColor: theme.colors.accent 
                  }]} 
                />
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Letter Composition */}
        <View style={styles.compositionSection}>
          <View style={styles.compositionHeader}>
            <Text style={styles.sectionTitle}>Your Letter</Text>
            <Animated.Text style={[
              styles.characterCount,
              { 
                transform: [{ scale: characterCountAnim }],
                color: isNearLimit ? theme.colors.danger : theme.colors.textMuted 
              }
            ]}>
              {characterCount}/{characterLimit}
            </Animated.Text>
          </View>
          
          <View style={styles.textInputContainer}>
            <TouchableOpacity 
              style={styles.textInputTouchable}
              onPress={() => flightStatus === 'active' && setIsFullScreenMode(true)}
              disabled={flightStatus !== 'active' || letterSent}
            >
              <TextInput
                style={[
                  styles.textInput,
                  flightStatus !== 'active' && styles.textInputDisabled
                ]}
                placeholder={
                  flightStatus === 'waiting' 
                    ? 'Letter window opens at flight departure time...'
                    : flightStatus === 'expired'
                    ? 'Letter window is closed (ended 1 hour after departure)'
                    : 'Tap to start writing your letter...'
                }
                placeholderTextColor={theme.colors.textMuted}
                multiline
                numberOfLines={8}
                value={text}
                onChangeText={handleTextChange}
                onFocus={handleTextInputFocus}
                textAlignVertical="top"
                editable={false} // Make it non-editable to force full-screen mode
                maxLength={characterLimit}
              />
              {flightStatus === 'active' && !letterSent && (
                <View style={styles.tapToWriteOverlay}>
                  <Text style={styles.tapToWriteText}>Tap to write ✍️</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Animated.ScrollView>

      {/* Bottom Action Bar */}
      <Animated.View style={[styles.bottomContainer, {
        transform: [{ translateY: slideAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [100, 0]
        }) }],
      }]}>
        <TouchableOpacity 
          style={[
            styles.sendButton,
            (flightStatus !== 'active' || !text.trim() || letterSent) && styles.sendButtonDisabled
          ]} 
          onPress={handleManualSendLetter}
          disabled={flightStatus !== 'active' || !text.trim() || letterSent}
        >
          <Text style={[
            styles.sendButtonText,
            (flightStatus !== 'active' || !text.trim() || letterSent) && styles.sendButtonTextDisabled
          ]}>
            {letterSent ? 'Letter Sent ✅' : 
             flightStatus === 'active' ? 'Send Letter Now ✉️' : 
             flightStatus === 'waiting' ? 'Waiting for Departure...' : 
             'Window Closed'}
          </Text>
        </TouchableOpacity>

        {flightStatus === 'active' && text.trim() && !letterSent && (
          <Text style={styles.autoSendNote}>
            💡 Letter will auto-send when time runs out
          </Text>
        )}
      </Animated.View>
    </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContainer: {
    flex: 1,
  },
  header: {
    padding: theme.spacing.page,
    paddingBottom: theme.spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textMuted,
  },
  statusCard: {
    backgroundColor: theme.colors.card,
    marginHorizontal: theme.spacing.page,
    marginBottom: theme.spacing.xl,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    ...theme.shadows.lg,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
  },
  activeBadge: {
    backgroundColor: theme.colors.danger,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.sm,
  },
  activeBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  statusMessage: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
    marginBottom: theme.spacing.lg,
  },
  countdownContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: theme.radius.lg,
  },
  countdownLabel: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginBottom: 4,
  },
  countdownTime: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 2,
  },
  progressSection: {
    gap: theme.spacing.md,
  },
  flightProgress: {
    gap: theme.spacing.xs,
  },
  flightLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.textSecondary,
  },
  progressBar: {
    height: 6,
    backgroundColor: theme.colors.borderLight,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  compositionSection: {
    padding: theme.spacing.page,
  },
  compositionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text,
  },
  characterCount: {
    fontSize: 14,
    fontWeight: '500',
  },
  textInputContainer: {
    position: 'relative',
    marginBottom: theme.spacing.lg,
  },
  textInputTouchable: {
    position: 'relative',
  },
  textInput: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    minHeight: 200,
    fontSize: 16,
    lineHeight: 24,
    textAlignVertical: 'top',
    borderWidth: 2,
    borderColor: 'transparent',
    ...theme.shadows.md,
  },
  textInputDisabled: {
    backgroundColor: theme.colors.borderLight,
    color: theme.colors.textMuted,
  },
  tapToWriteOverlay: {
    position: 'absolute',
    bottom: theme.spacing.md,
    right: theme.spacing.md,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
  },
  tapToWriteText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  previewCard: {
    backgroundColor: theme.colors.cardElevated,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
    ...theme.shadows.sm,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  previewText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    lineHeight: 22,
    marginBottom: theme.spacing.sm,
  },
  previewMeta: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  bottomContainer: {
    padding: theme.spacing.page,
    backgroundColor: theme.colors.card,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
    ...theme.shadows.lg,
  },
  sendButton: {
    backgroundColor: theme.colors.accent,
    paddingVertical: 18,
    borderRadius: theme.radius.xl,
    alignItems: 'center',
    ...theme.shadows.md,
  },
  sendButtonDisabled: {
    backgroundColor: theme.colors.borderLight,
  },
  sendButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  sendButtonTextDisabled: {
    color: theme.colors.textMuted,
  },
  autoSendNote: {
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
    fontStyle: 'italic',
  },
  // Full-screen editor styles
  fullScreenContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  fullScreenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.page,
    paddingTop: StatusBar.currentHeight + theme.spacing.md,
    paddingBottom: theme.spacing.md,
    backgroundColor: theme.colors.primary,
    ...theme.shadows.md,
  },
  closeButton: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  fullScreenHeaderCenter: {
    alignItems: 'center',
    flex: 1,
  },
  fullScreenTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 2,
  },
  fullScreenTimer: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '500',
  },
  fullScreenHeaderRight: {
    alignItems: 'flex-end',
    minWidth: 60,
  },
  fullScreenCharCount: {
    fontSize: 12,
    fontWeight: '500',
  },
  fullScreenInputContainer: {
    flex: 1,
    padding: theme.spacing.page,
  },
  fullScreenTextInput: {
    flex: 1,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.xl,
    fontSize: 18,
    lineHeight: 26,
    color: theme.colors.text,
    textAlignVertical: 'top',
    ...theme.shadows.sm,
  },
  fullScreenBottomBar: {
    padding: theme.spacing.page,
    backgroundColor: theme.colors.card,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
    ...theme.shadows.lg,
  },
  fullScreenSendButton: {
    backgroundColor: theme.colors.accent,
    paddingVertical: 16,
    borderRadius: theme.radius.xl,
    alignItems: 'center',
    ...theme.shadows.md,
  },
  fullScreenSendButtonDisabled: {
    backgroundColor: theme.colors.borderLight,
  },
  fullScreenSendButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  fullScreenSendButtonTextDisabled: {
    color: theme.colors.textMuted,
  },
});