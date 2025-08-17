// src/screens/MovieTimeScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Dimensions,
  StatusBar,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import * as ScreenOrientation from 'expo-screen-orientation';
import { DateTime } from 'luxon';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import theme from '../theme';
import defaultFlights from '../lib/defaultFlights';
import { getCurrentUser } from '../lib/storage';
import {
  MOVIE_LIBRARY,
  calculateMovieStartTime,
  getCurrentMoviePosition,
  scheduleMovieStartNotification,
  requestNotificationPermissions,
  formatFileSize,
  checkMovieStartReminder
} from '../lib/movieService';

const { width, height } = Dimensions.get('window');

const MOVIE_START_DELAY = 45; // 45 minutes after departure
const STORAGE_KEY = '@airletters_movie_data';

export default function MovieTimeScreen({ navigation }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [movieStatus, setMovieStatus] = useState('waiting'); // waiting, playing, ended, not_started
  const [timeUntilStart, setTimeUntilStart] = useState(0);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false); // kept for future but unused for UI branching
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoKey, setVideoKey] = useState(0); // Force re-render when switching modes

  // Single movie reference
  const movie = MOVIE_LIBRARY[0];

  const videoRef = useRef(null);
  const timerRef = useRef(null);
  const lastSyncTimeRef = useRef(0);
  const orientationLockRef = useRef(false);

  // Create video player instance - using your local movie.mp4
  const player = useVideoPlayer(movie.localPath, (player) => {
    if (player) {
      player.loop = false;
      player.muted = false;
      
      // Add player event listeners with debouncing
      let playingChangeTimeout;
      player.addListener('playingChange', (newIsPlaying) => {
        clearTimeout(playingChangeTimeout);
        playingChangeTimeout = setTimeout(() => {
          console.log('🎬 Player state changed (debounced):', newIsPlaying);
          setIsPlaying(newIsPlaying);
        }, 100); // 100ms debounce
      });

      player.addListener('statusChange', (status) => {
        console.log('🎬 Player status changed:', status);
      });

      // Force player to load the video immediately
      console.log('🎬 Player initialized with source:', movie.localPath);
    }
  });

  // No header toggling; rely on native fullscreen overlay
  useEffect(() => {
    if (navigation && navigation.setOptions) {
      navigation.setOptions({});
    }
  }, [navigation]);

  useFocusEffect(
    React.useCallback(() => {
      initializeScreen();
      startTimer();

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };
    }, [])
  );

  // No back handler for fullscreen; native controls handle it

  const restorePortraitOrientation = async () => {
    try {
      if (orientationLockRef.current) {
        await ScreenOrientation.unlockAsync();
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        orientationLockRef.current = false;
        console.log('🎬 Orientation restored to portrait');
      }
    } catch (error) {
      console.log('🎬 Orientation restoration failed (silent):', error.message);
    }
  };

  const initializeScreen = async () => {
    try {
      setIsLoading(true);
      await Promise.all([
        loadCurrentUser(),
        loadMovieData()
      ]);
    } catch (error) {
      console.error('Failed to initialize movie screen:', error);
      Alert.alert('Error', 'Failed to load movie data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadCurrentUser = async () => {
    try {
      const userType = await getCurrentUser();
      setCurrentUser(userType);
    } catch (error) {
      console.error('Failed to load current user:', error);
      setCurrentUser('A');
    }
  };

  const loadMovieData = async () => {
    try {
      // Single movie setup - log setup success
      console.log('🎬 Movie loaded successfully:', movie.title);
    } catch (error) {
      console.error('Failed to load movie data:', error);
    }
  };

  const startTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    timerRef.current = setInterval(() => {
      updateMovieStatus();
    }, 1000);
  };

  const updateMovieStatus = async () => {
    if (!currentUser) return;
    
    const userFlight = currentUser === 'A' ? defaultFlights.flightA : defaultFlights.flightB;
    const movieStartTime = calculateMovieStartTime(userFlight.departureUTC);
    const moviePosition = getCurrentMoviePosition(movieStartTime, movie.duration);
    
    setMovieStatus(moviePosition.status);
    setTimeUntilStart(moviePosition.timeUntilStart);
    setCurrentPosition(moviePosition.position);
    
    // Auto-seek video to current position if it's playing and enough time has passed since last sync
    if (moviePosition.status === 'playing' && player) {
      const now = Date.now();
      if (now - lastSyncTimeRef.current > 5000) { // Sync every 5 seconds maximum
        await syncVideoPosition(moviePosition.position);
        lastSyncTimeRef.current = now;
      }
    }
    
    // Check for manual reminders (fallback when notifications aren't available)
    try {
      const reminder = await checkMovieStartReminder();
      if (reminder && reminder.shouldShow) {
        if (reminder.isPreparation) {
          Alert.alert(
            '🎬 Movie Starting Soon!',
            `"${reminder.movieTitle}" starts in about 2 minutes. Get ready!`,
            [{ text: 'Got it!' }]
          );
        } else {
          Alert.alert(
            '🎬 Movie Time!',
            `"${reminder.movieTitle}" is starting now!`,
            [
              { text: 'Later', style: 'cancel' },
              { text: 'Watch Now', onPress: () => {/* already on movie screen */} }
            ]
          );
        }
      }
    } catch (error) {
      // Silent fail to avoid console spam
    }
  };

  const syncVideoPosition = async (targetPosition) => {
    try {
      if (player && player.status === 'readyToPlay') {
        const currentTime = (player.currentTime || 0) * 1000; // Convert to milliseconds
        const targetTime = Math.max(0, targetPosition / 1000); // Convert to seconds
        
        // Only sync if there's a significant difference (more than 3 seconds)
        if (Math.abs(currentTime - targetPosition) > 3000) {
          player.currentTime = targetTime;
          console.log(`🎬 Synced video to ${targetTime.toFixed(1)}s`);
        }
        
        // Auto-play if movie should be playing but isn't
        if (movieStatus === 'playing' && !player.playing) {
          await player.play();
        }
      }
    } catch (error) {
      console.error('Failed to sync video position:', error);
    }
  };

  const formatTime = (milliseconds) => {
    if (milliseconds <= 0) return '00:00:00';
    
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Much simpler fullscreen entry
  // Rely on native VideoView fullscreen; no manual state/orientation changes needed
  const enterFullscreen = async () => {
    console.log('🎬 Native fullscreen should be triggered via controls');
  };

  const exitFullscreen = async () => {
    console.log('🎬 Native fullscreen exit handled by controls');
  };

  const togglePlayPause = async () => {
    try {
      console.log('🎬 Toggle play/pause requested. Current playing state:', isPlaying);
      console.log('🎬 Player status:', player?.status);
      
      if (!player) {
        console.error('🎬 No player available');
        Alert.alert('Error', 'Video player not ready');
        return;
      }

  if (player.status !== 'readyToPlay') {
        console.warn('🎬 Player not ready to play. Status:', player.status);
        Alert.alert('Wait', 'Video is still loading...');
        return;
      }

      // Simple toggle without checking current state to avoid race conditions
      if (isPlaying) {
        console.log('🎬 Pausing video...');
        await player.pause();
      } else {
        console.log('🎬 Playing video...');
        await player.play();
      }
  // Don't manually update state - let the listener handle it
      
    } catch (error) {
      console.error('🎬 Failed to toggle play/pause:', error);
      Alert.alert('Error', `Failed to control video: ${error.message}`);
    }
  };

  const getStatusMessage = () => {
    if (!currentUser) return 'Loading...';
    
    const userFlight = currentUser === 'A' ? defaultFlights.flightA : defaultFlights.flightB;
    
    switch (movieStatus) {
      case 'waiting':
        return `🕐 Movie starts ${MOVIE_START_DELAY} minutes after ${userFlight.flightNumber} departure`;
      case 'playing':
        return `🎬 "${movie.title}" is playing - synced to real-time`;
      case 'ended':
        return `✅ "${movie.title}" has ended`;
      default:
        return 'Checking movie status...';
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading Movie Time...</Text>
      </View>
    );
  }


  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Movie Time 🎬</Text>
          <Text style={styles.subtitle}>Your synchronized movie experience</Text>
        </View>

        {/* User Info */}
        {currentUser && (
          <View style={styles.userCard}>
            <Text style={styles.userText}>
              User {currentUser} • {currentUser === 'A' ? defaultFlights.flightA.flightNumber : defaultFlights.flightB.flightNumber}
            </Text>
          </View>
        )}

        {/* Movie Status */}
        <View style={styles.statusCard}>
          <Text style={styles.statusTitle}>Movie Status</Text>
          <Text style={styles.statusMessage}>{getStatusMessage()}</Text>
          
          {movieStatus === 'waiting' && (
            <View style={styles.countdownContainer}>
              <Text style={styles.countdownLabel}>Time until movie starts:</Text>
              <Text style={styles.countdownTime}>{formatTime(timeUntilStart * 60 * 1000)}</Text>
            </View>
          )}

          {movieStatus === 'playing' && (
            <View style={styles.progressContainer}>
              <Text style={styles.progressLabel}>Movie Progress:</Text>
              <Text style={styles.progressTime}>
                {formatTime(currentPosition)} / {formatTime(movie.duration * 60 * 1000)}
              </Text>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { width: `${Math.max(0, Math.min(100, (currentPosition / (movie.duration * 60 * 1000)) * 100))}%` }
                  ]} 
                />
              </View>
            </View>
          )}
        </View>

        {/* Movie Card */}
        <View style={styles.movieCard}>
          <Text style={styles.sectionTitle}>Featured Movie</Text>
          
          <View style={styles.movieInfo}>
            <Text style={styles.movieTitle}>{movie.title}</Text>
            <Text style={styles.movieDuration}>Duration: {formatTime(movie.duration * 60 * 1000)}</Text>
            <Text style={styles.movieSize}>Size: {movie.size}</Text>
            <Text style={styles.movieDescription}>{movie.description}</Text>
            
            <View style={styles.readyContainer}>
              <Text style={styles.readyText}>✅ Ready to play offline</Text>
              
              {/* Video Player with default controls */}
              <View style={styles.videoContainer}>
                <VideoView
                  key={`normal-video-${videoKey}`}
                  ref={videoRef}
                  style={styles.video}
                  player={player}
                  allowsFullscreen={true}
                  allowsPictureInPicture={false}
                  contentFit="contain"
                  showsTimecodes={true}
                  nativeControls={true}
                />
              </View>
            </View>
          </View>
        </View>

        {/* Instructions */}
        <View style={styles.instructionsCard}>
          <Text style={styles.instructionsTitle}>How it works:</Text>
          <Text style={styles.instructionText}>
            • Movie automatically syncs to real-time playback{'\n'}
            • Starts exactly 45 minutes after flight departure{'\n'}
            • Use built-in video controls for play/pause/seek{'\n'}
            • Tap fullscreen button for immersive viewing{'\n'}
            • Works completely offline - no internet needed
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: theme.spacing.xl * 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: 16,
    color: theme.colors.textMuted,
    fontWeight: '500',
  },
  
  // (No custom fullscreen styles; using native fullscreen controls)
  
  // Regular View Styles
  header: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.page,
    paddingTop: (StatusBar.currentHeight || 0) + theme.spacing.lg,
    paddingBottom: theme.spacing.xl * 1.5,
    borderBottomLeftRadius: theme.radius.xl,
    borderBottomRightRadius: theme.radius.xl,
    ...theme.shadows.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    fontWeight: '400',
  },
  userCard: {
    backgroundColor: theme.colors.card,
    margin: theme.spacing.page,
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.xl,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
    ...theme.shadows.sm,
  },
  userText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    textAlign: 'center',
  },
  statusCard: {
    backgroundColor: theme.colors.card,
    marginHorizontal: theme.spacing.page,
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.xl,
    borderRadius: theme.radius.xl,
    ...theme.shadows.md,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  statusMessage: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    lineHeight: 22,
    marginBottom: theme.spacing.lg,
  },
  countdownContainer: {
    alignItems: 'center',
    backgroundColor: theme.colors.backgroundSecondary,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
  },
  countdownLabel: {
    fontSize: 14,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.sm,
    fontWeight: '500',
  },
  countdownTime: {
    fontSize: 32,
    fontWeight: '800',
    color: theme.colors.primary,
    fontVariant: ['tabular-nums'],
  },
  progressContainer: {
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 14,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.xs,
    fontWeight: '500',
  },
  progressTime: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    fontVariant: ['tabular-nums'],
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: theme.colors.borderLight,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 4,
  },
  movieCard: {
    backgroundColor: theme.colors.card,
    marginHorizontal: theme.spacing.page,
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.xl,
    borderRadius: theme.radius.xl,
    ...theme.shadows.md,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
  },
  movieInfo: {
    backgroundColor: theme.colors.backgroundSecondary,
    padding: theme.spacing.xl,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  movieTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  movieDuration: {
    fontSize: 15,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.xs,
    fontWeight: '500',
  },
  movieSize: {
    fontSize: 15,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.lg,
    fontWeight: '500',
  },
  movieDescription: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xl,
    lineHeight: 22,
  },
  readyContainer: {
    alignItems: 'center',
  },
  readyText: {
    fontSize: 16,
    color: theme.colors.success,
    fontWeight: '600',
    marginBottom: theme.spacing.xl,
  },
  videoContainer: {
    width: '100%',
    alignItems: 'center',
  },
  video: {
    width: '100%',
    height: 220,
    backgroundColor: '#000',
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
  },
  // Removed custom video controls; using native controls
  instructionsCard: {
    backgroundColor: theme.colors.cardElevated,
    marginHorizontal: theme.spacing.page,
    marginBottom: theme.spacing.page,
    padding: theme.spacing.xl,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    ...theme.shadows.sm,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  instructionText: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    lineHeight: 24,
  },
});