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
  Platform,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { DateTime } from 'luxon';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import theme from '../theme';
import defaultFlights from '../lib/defaultFlights';
import { getCurrentUser } from '../lib/storage';
import {
  requestAllPermissions,
  getMovieSource,
  canPlayMovie,
  getTimeUntilMovieAvailable,
  requestNotificationPermissions,
  formatFileSize,
  checkMovieStartReminder
} from '../lib/movieService';

const { width, height } = Dimensions.get('window');

const STORAGE_KEY = '@airletters_movie_data';

export default function MovieTimeScreen({ navigation }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [movieStatus, setMovieStatus] = useState('checking'); // checking, waiting, ready, playing, ended
  const [timeUntilStart, setTimeUntilStart] = useState(0);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoKey, setVideoKey] = useState(0); // Force re-render when switching modes
  const [movieSource, setMovieSource] = useState(null);
  const [permissions, setPermissions] = useState({
    media: false,
    storage: false,
    notifications: false
  });
  const [errorMessage, setErrorMessage] = useState('');

  const videoRef = useRef(null);
  const timerRef = useRef(null);
  const lastSyncTimeRef = useRef(0);
  const orientationLockRef = useRef(false);

  // Create video player instance - will be updated when movie source is found
  const player = useVideoPlayer(movieSource?.uri || null, (player) => {
    if (player && movieSource) {
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
        if (status.error) {
          console.error('🎬 Player error:', status.error);
          setErrorMessage(`Video playback error: ${status.error}`);
        }
      });

      // Force player to load the video immediately
      console.log('🎬 Player initialized with source:', movieSource.uri);
    }
  });

  // Initialize screen with permissions and movie source
  useEffect(() => {
    initializeScreen();
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Start timer when movie source is available
  useEffect(() => {
    if (movieSource) {
      startTimer();
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [movieSource]);

  // Simplified navigation header management
  useEffect(() => {
    if (navigation && navigation.setOptions) {
      navigation.setOptions({
        headerShown: !isFullScreen,
        gestureEnabled: !isFullScreen,
      });
    }
  }, [isFullScreen, navigation]);

  // Simplified back handler
  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = async () => {
        if (isFullScreen) {
          await exitFullscreen();
          return true;
        }
        return false;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      
      return () => {
        subscription.remove();
        // Only restore orientation if we actually locked it
        if (orientationLockRef.current) {
          restorePortraitOrientation();
        }
      };
    }, [isFullScreen])
  );

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
      setErrorMessage('');
      
      console.log('🎬 Initializing MovieTimeScreen...');
      
      // Step 1: Request all necessary permissions
      console.log('🎬 Requesting permissions...');
      const perms = await requestAllPermissions();
      setPermissions(perms);
      
      if (!perms.media) {
        setErrorMessage('⚠️ EXPO GO LIMITATION: Media library access is restricted in Expo Go. For full movie functionality, create a development build with: npx expo run:android');
      }
      
      // Step 2: Load current user and movie source
      await Promise.all([
        loadCurrentUser(),
        loadMovieSource()
      ]);
      
    } catch (error) {
      console.error('🎬 Failed to initialize movie screen:', error);
      setErrorMessage(`Initialization failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMovieSource = async () => {
    try {
      console.log('🎬 Loading movie source...');
      const source = await getMovieSource();
      setMovieSource(source);
      
      console.log('🎬 Movie source loaded:', {
        source: source.source,
        filename: source.filename,
        uri: source.uri?.length > 50 ? source.uri.substring(0, 50) + '...' : source.uri
      });
      
    } catch (error) {
      console.error('🎬 Failed to load movie source:', error);
      setErrorMessage(`Failed to find movie file: ${error.message}`);
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

  const startTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    timerRef.current = setInterval(() => {
      updateMovieStatus();
    }, 1000);
  };

  const updateMovieStatus = async () => {
    if (!currentUser || !movieSource) return;
    
    try {
      // Check if movie can be played (letter window has expired)
      const canPlay = await canPlayMovie();
      const timeUntil = await getTimeUntilMovieAvailable();
      
      setTimeUntilStart(timeUntil);
      
      if (!canPlay) {
        setMovieStatus('waiting');
        return;
      }
      
      // Movie is available to play
      setMovieStatus('ready');
      
    } catch (error) {
      console.error('🎬 Failed to update movie status:', error);
      setErrorMessage(`Status update failed: ${error.message}`);
    }
  };

  const handlePlayMovie = async () => {
    try {
      if (!movieSource) {
        Alert.alert('Error', 'Movie source not available. Please check if movie.mp4 exists in your Downloads/Movie folder.');
        return;
      }

      const canPlay = await canPlayMovie();
      if (!canPlay) {
        const timeRemaining = await getTimeUntilMovieAvailable();
        const minutes = Math.ceil(timeRemaining / 60000);
        Alert.alert(
          'Movie Not Available Yet',
          `You can watch the movie after the letter writing window expires.\nTime remaining: ${minutes} minute${minutes !== 1 ? 's' : ''}`
        );
        return;
      }

      setMovieStatus('playing');
      
      if (player) {
        await player.play();
        console.log('🎬 Movie playback started');
      }
    } catch (error) {
      console.error('🎬 Failed to play movie:', error);
      Alert.alert('Playback Error', `Failed to start movie: ${error.message}`);
    }
  };

  const handlePauseMovie = async () => {
    try {
      if (player) {
        await player.pause();
        console.log('🎬 Movie playback paused');
      }
    } catch (error) {
      console.error('🎬 Failed to pause movie:', error);
    }
  };

  const testFileAccess = async () => {
    try {
      console.log('🔍 Testing file access...');
      
      // Show current media library status
      const mediaAssets = await MediaLibrary.getAssetsAsync({
        mediaType: 'video',
        first: 10,
      });
      
      console.log(`📱 Media library contains ${mediaAssets.assets.length} video files:`);
      mediaAssets.assets.forEach((asset, index) => {
        console.log(`  ${index + 1}. ${asset.filename} (${asset.duration}s)`);
      });
      
      // Try to find Downloads directory
      let downloadsPath = null;
      const commonDownloadPaths = [
        '/storage/emulated/0/Download',
        '/storage/emulated/0/Downloads',
        '/sdcard/Download',
        '/sdcard/Downloads',
      ];
      
      console.log('📁 Looking for Downloads directory...');
      for (const path of commonDownloadPaths) {
        try {
          const dirInfo = await FileSystem.getInfoAsync(path);
          if (dirInfo.exists && dirInfo.isDirectory) {
            downloadsPath = path;
            console.log(`📁 Found Downloads directory: ${path}`);
            break;
          }
        } catch (error) {
          continue;
        }
      }
      
      // Test Movie folders for any MP4 files
      const movieFolders = [
        '/storage/emulated/0/Downloads/Movie',
        '/storage/emulated/0/Download/Movie',
      ];
      
      console.log('📁 Testing Movie folders for MP4 files:');
      let foundFiles = [];
      
      for (const folderPath of movieFolders) {
        try {
          const folderInfo = await FileSystem.getInfoAsync(folderPath);
          if (folderInfo.exists && folderInfo.isDirectory) {
            const files = await FileSystem.readDirectoryAsync(folderPath);
            const mp4Files = files.filter(f => f.toLowerCase().endsWith('.mp4'));
            console.log(`  ${folderPath}: ${mp4Files.length} MP4 files found`);
            if (mp4Files.length > 0) {
              foundFiles.push(`${folderPath}: ${mp4Files.join(', ')}`);
            }
          } else {
            console.log(`  ${folderPath}: Folder does not exist`);
          }
        } catch (error) {
          console.log(`  ${folderPath}: Error - ${error.message}`);
        }
      }
      
      // Show results
      const filesFoundMessage = foundFiles.length > 0 
        ? `MP4 files found:\n${foundFiles.join('\n')}\n\n`
        : 'No MP4 files found in Movie folders.\n\n';
      
      const message = downloadsPath 
        ? `⚠️ EXPO GO LIMITATION DETECTED!\n\nExpo Go has limited media library access. Your MP4 file might be present but not accessible through Expo Go.\n\nDownloads directory: ${downloadsPath}\n\n${filesFoundMessage}SOLUTIONS:\n1. Build a development build instead of using Expo Go\n2. Or try placing MP4 directly in Downloads folder (not Movie subfolder)\n\nMedia Library: ${mediaAssets.assets.length} videos accessible via Expo Go`
        : `⚠️ EXPO GO LIMITATION!\n\nExpo Go has restricted media access. For full functionality, use:\n• Development build instead of Expo Go\n• Or EAS Build for production\n\n${filesFoundMessage}Media Library: ${mediaAssets.assets.length} videos accessible`;
      
      Alert.alert(
        '🔍 File Access Test Results',
        message,
        [
          { text: 'Refresh App', onPress: initializeScreen },
          { text: 'OK' }
        ]
      );
      
    } catch (error) {
      console.error('🔍 Test failed:', error);
      Alert.alert('Test Failed', `Error: ${error.message}\n\nCheck if all permissions are granted.`);
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
  const enterFullscreen = async () => {
    try {
      console.log('🎬 Entering fullscreen mode...');
      
      // Store current playback position and state
      const currentPosition = player?.currentTime || 0;
      const wasPlaying = isPlaying;
      
      console.log('🎬 Storing state - Position:', currentPosition, 'Playing:', wasPlaying);
      
      // Set fullscreen state first
      setIsFullScreen(true);
      setVideoKey(prev => prev + 1); // Force video re-render
      
      // Hide status bar
      StatusBar.setHidden(true, 'fade');
      
      // Handle orientation change with a delay
      setTimeout(async () => {
        try {
          await ScreenOrientation.unlockAsync();
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_LEFT);
          orientationLockRef.current = true;
          console.log('🎬 Orientation changed to landscape');
          
          // Restore playback state after orientation change
          if (player && currentPosition > 0) {
            setTimeout(() => {
              player.currentTime = currentPosition;
              if (wasPlaying) {
                player.play();
              }
              console.log('🎬 Restored playback state in fullscreen');
            }, 200);
          }
        } catch (orientationError) {
          console.log('🎬 Orientation change failed, continuing with portrait fullscreen:', orientationError);
        }
      }, 100);
      
      console.log('🎬 Fullscreen mode activated');
      
    } catch (error) {
      console.error('🎬 Failed to enter fullscreen:', error);
      // Revert state if failed
      setIsFullScreen(false);
      StatusBar.setHidden(false, 'fade');
    }
  };

  // Simplified fullscreen exit
  const exitFullscreen = async () => {
    try {
      console.log('🎬 Exiting fullscreen mode...');
      
      // Store current playback position and state
      const currentPosition = player?.currentTime || 0;
      const wasPlaying = isPlaying;
      
      console.log('🎬 Storing state before exit - Position:', currentPosition, 'Playing:', wasPlaying);
      
      // Set state first
      setIsFullScreen(false);
      setVideoKey(prev => prev + 1); // Force video re-render
      
      // Show status bar
      StatusBar.setHidden(false, 'fade');
      
      // Restore orientation
      if (orientationLockRef.current) {
        setTimeout(async () => {
          try {
            await ScreenOrientation.unlockAsync();
            await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
            orientationLockRef.current = false;
            console.log('🎬 Orientation restored to portrait');
            
            // Restore playback state after orientation change
            if (player && currentPosition > 0) {
              setTimeout(() => {
                player.currentTime = currentPosition;
                if (wasPlaying) {
                  player.play();
                }
                console.log('🎬 Restored playback state in normal view');
              }, 200);
            }
          } catch (orientationError) {
            console.log('🎬 Orientation restoration failed:', orientationError);
          }
        }, 100);
      }
      
      console.log('🎬 Fullscreen mode deactivated');
      
    } catch (error) {
      console.error('🎬 Failed to exit fullscreen:', error);
      // Force state change even if other operations fail
      setIsFullScreen(false);
      StatusBar.setHidden(false, 'fade');
    }
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
    switch (movieStatus) {
      case 'checking':
        return 'Checking movie availability...';
      case 'waiting':
        const minutes = Math.ceil(timeUntilStart / 60000);
        return `Movie will be available in ${minutes} minute${minutes !== 1 ? 's' : ''}`;
      case 'ready':
        return 'Movie is ready to play! 🎬';
      case 'playing':
        return 'Movie is now playing';
      case 'ended':
        return 'Movie has ended';
      default:
        return 'Checking movie status...';
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading Movie Time...</Text>
        <Text style={styles.loadingSubtext}>Checking for movie file and permissions...</Text>
      </View>
    );
  }

  if (errorMessage) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorIcon}>📁</Text>
        <Text style={styles.errorTitle}>Movie File Not Found</Text>
        <Text style={styles.errorMessage}>{errorMessage}</Text>
        
        <View style={styles.stepGuide}>
          <Text style={styles.stepTitle}>📋 Step-by-Step Setup:</Text>
          <Text style={styles.stepText}>
            1️⃣ Open your device's file manager{'\n'}
            2️⃣ Navigate to: Downloads folder{'\n'}
            3️⃣ Create new folder called: "Movie"{'\n'}
            4️⃣ Place ANY MP4 video file in Movie folder{'\n'}
            5️⃣ File can have any name (e.g., myvideo.mp4){'\n'}
            6️⃣ Tap "Refresh" below to try again
          </Text>
        </View>
        
        <TouchableOpacity style={styles.retryButton} onPress={initializeScreen}>
          <Text style={styles.retryButtonText}>🔄 Refresh & Search Again</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.testButton} onPress={testFileAccess}>
          <Text style={styles.testButtonText}>🔍 Test File Access</Text>
        </TouchableOpacity>
        
        <View style={styles.helpContainer}>
          <Text style={styles.helpTitle}>Setup Instructions:</Text>
          <Text style={styles.helpText}>
            📁 Create folder path: Downloads/Movie/{'\n'}
            🎬 Place ANY MP4 video file in that folder{'\n'}
            📱 Grant media library permissions{'\n'}
            ♻️ Return to this screen to watch{'\n'}
            {'\n'}
            Note: The app doesn't include any bundled movies.{'\n'}
            You can use any MP4 file with any filename.{'\n'}
            {'\n'}
            📍 Internal storage paths:{'\n'}
            • /storage/emulated/0/Downloads/Movie/{'\n'}
            • /storage/emulated/0/Download/Movie/
          </Text>
          
          <TouchableOpacity style={styles.testButton} onPress={testFileAccess}>
            <Text style={styles.testButtonText}>🔍 Test File Access</Text>
          </TouchableOpacity>
        </View>
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
          <Text style={styles.subtitle}>Your personal movie experience</Text>
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
          
          {movieStatus === 'waiting' && timeUntilStart > 0 && (
            <View style={styles.countdownContainer}>
              <Text style={styles.countdownLabel}>Letter writing window active</Text>
              <Text style={styles.countdownTime}>{formatTime(timeUntilStart)}</Text>
              <Text style={styles.countdownSubtext}>Movie available after timer ends</Text>
            </View>
          )}
        </View>

        {/* Movie Source Info */}
        {movieSource && (
          <View style={styles.sourceCard}>
            <Text style={styles.sourceTitle}>Movie Source</Text>
            <Text style={styles.sourceInfo}>
              📁 {movieSource.filename}{'\n'}
              📍 {movieSource.source === 'media_library' ? 'Found in device media' : 
                  movieSource.source === 'file_system' ? 'Found in Downloads/Movie' : 
                  'External source'}
            </Text>
          </View>
        )}

        {/* Movie Player */}
        {movieSource && (
          <View style={styles.movieCard}>
            <Text style={styles.sectionTitle}>Movie Player</Text>
            
            {/* Play Button or Video Player */}
            {movieStatus === 'waiting' ? (
              <View style={styles.waitingState}>
                <Text style={styles.waitingIcon}>⏰</Text>
                <Text style={styles.waitingTitle}>Movie Locked</Text>
                <Text style={styles.waitingText}>
                  Complete your letter writing first!{'\n'}
                  Movie will unlock when the timer expires.
                </Text>
              </View>
            ) : (
              <View style={styles.playerContainer}>
                {movieStatus === 'ready' && !isPlaying && (
                  <TouchableOpacity style={styles.playButton} onPress={handlePlayMovie}>
                    <Text style={styles.playButtonIcon}>▶️</Text>
                    <Text style={styles.playButtonText}>Start Movie</Text>
                  </TouchableOpacity>
                )}
                
                {/* Video Player */}
                <View style={styles.videoContainer}>
                  <VideoView
                    key={`movie-video-${videoKey}`}
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
                
                {isPlaying && (
                  <TouchableOpacity style={styles.pauseButton} onPress={handlePauseMovie}>
                    <Text style={styles.pauseButtonText}>⏸️ Pause</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}

        {/* Permissions Status */}
        <View style={styles.permissionsCard}>
          <Text style={styles.permissionsTitle}>Permissions Status</Text>
          <Text style={[styles.permissionItem, { color: permissions.media ? theme.colors.success : theme.colors.danger }]}>
            📱 Media Library: {permissions.media ? '✅ Granted' : '❌ Required'}
          </Text>
          <Text style={[styles.permissionItem, { color: permissions.storage ? theme.colors.success : theme.colors.warning }]}>
            💾 Storage: {permissions.storage ? '✅ Granted' : '⚠️ Limited'}
          </Text>
          <Text style={[styles.permissionItem, { color: permissions.notifications ? theme.colors.success : theme.colors.primary }]}>
            🔔 Notifications: {permissions.notifications ? '✅ Granted' : 'ℹ️ Optional'}
          </Text>
        </View>

        {/* Instructions */}
        <View style={styles.instructionsCard}>
          <Text style={styles.instructionsTitle}>How to use:</Text>
          <Text style={styles.instructionText}>
            📁 Place ANY MP4 file in Downloads/Movie/ folder{'\n'}
            📱 Grant necessary permissions when prompted{'\n'}
            ✍️ Complete letter writing to unlock movie{'\n'}
            ▶️ Tap "Start Movie" when timer expires{'\n'}
            🎮 Use built-in controls for playback{'\n'}
            📴 Works completely offline{'\n'}
            {'\n'}
            💡 Tip: Any MP4 file will work - no naming required!
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
  
  // Simple Fullscreen Styles
  fullScreenContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  fullScreenVideo: {
    flex: 1,
    backgroundColor: '#000',
  },
  exitButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 10,
  },
  exitButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  debugInfo: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255,0,0,0.8)',
    padding: 10,
    borderRadius: 5,
    zIndex: 10,
  },
  debugText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
  },
  
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
  videoControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.sm,
  },
  playButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    flex: 1,
    marginRight: theme.spacing.sm,
    ...theme.shadows.sm,
  },
  playButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  fullScreenButton: {
    backgroundColor: theme.colors.accent,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    flex: 1,
    marginLeft: theme.spacing.sm,
    ...theme.shadows.sm,
  },
  fullScreenButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
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
  
  // New styles for enhanced functionality
  loadingSubtext: {
    marginTop: theme.spacing.sm,
    fontSize: 14,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    padding: theme.spacing.xl,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: theme.spacing.lg,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.danger,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  errorMessage: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
    lineHeight: 24,
  },
  retryButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    marginBottom: theme.spacing.xl,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  helpContainer: {
    backgroundColor: theme.colors.card,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    width: '100%',
  },
  helpTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  helpText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 22,
  },
  sourceCard: {
    backgroundColor: theme.colors.card,
    marginHorizontal: theme.spacing.page,
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.xl,
    ...theme.shadows.sm,
  },
  sourceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  sourceInfo: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  waitingState: {
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  waitingIcon: {
    fontSize: 48,
    marginBottom: theme.spacing.lg,
  },
  waitingTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  waitingText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  playerContainer: {
    alignItems: 'center',
  },
  playButton: {
    backgroundColor: theme.colors.success,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    marginBottom: theme.spacing.lg,
    alignItems: 'center',
    ...theme.shadows.md,
  },
  playButtonIcon: {
    fontSize: 24,
    marginBottom: theme.spacing.xs,
  },
  playButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  pauseButton: {
    backgroundColor: theme.colors.warning,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    marginTop: theme.spacing.lg,
  },
  pauseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  permissionsCard: {
    backgroundColor: theme.colors.card,
    marginHorizontal: theme.spacing.page,
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.xl,
    ...theme.shadows.sm,
  },
  permissionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  permissionItem: {
    fontSize: 14,
    marginBottom: theme.spacing.xs,
    fontWeight: '500',
  },
  countdownSubtext: {
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: theme.spacing.xs,
  },
  testButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    marginTop: theme.spacing.lg,
    alignItems: 'center',
  },
  testButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  stepGuide: {
    backgroundColor: theme.colors.backgroundSecondary,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    marginBottom: theme.spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  stepText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 22,
  },
});