// src/lib/movieService.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DateTime } from 'luxon';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';

// Safely import notifications and constants with fallback
let Notifications = null;
let Constants = null;
try {
  Notifications = require('expo-notifications');
  Constants = require('expo-constants');
  
  // Configure notification handler with enhanced settings
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    }),
  });
} catch (error) {
  console.warn('📱 Expo Notifications/Constants not available:', error.message);
}

// Movie file search paths (Android and iOS)
const MOVIE_SEARCH_PATHS = {
  android: [
    '/storage/emulated/0/Download/Movie/movie.mp4',
    '/storage/emulated/0/Downloads/Movie/movie.mp4',
    '/sdcard/Download/Movie/movie.mp4',
    '/sdcard/Downloads/Movie/movie.mp4',
  ],
  ios: [
    // iOS doesn't allow direct file system access, we'll use MediaLibrary
  ]
};

// Request all necessary permissions for production app
export async function requestAllPermissions() {
  const permissions = {
    media: false,
    storage: false,
    notifications: false
  };

  try {
    // Request Media Library permissions
    const mediaPermission = await MediaLibrary.requestPermissionsAsync();
    permissions.media = mediaPermission.status === 'granted';
    console.log('📱 Media Library permission:', mediaPermission.status);

    // Request Storage permissions (Android)
    if (Platform.OS === 'android') {
      try {
        const storagePermission = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        permissions.storage = storagePermission.granted;
        console.log('📱 Storage permission:', storagePermission.granted ? 'granted' : 'denied');
      } catch (error) {
        console.warn('📱 Storage permission request failed:', error.message);
      }
    }

    // Request Notification permissions
    permissions.notifications = await requestNotificationPermissions();

    return permissions;
  } catch (error) {
    console.error('📱 Permission request failed:', error);
    return permissions;
  }
}

// Get device's actual Downloads directory
export async function getDownloadsDirectory() {
  try {
    if (Platform.OS === 'android') {
      // Try to get the external storage directory
      const externalDir = FileSystem.StorageAccessFramework.getUriForDirectoryInRoot('Download');
      if (externalDir) {
        console.log('📁 Found external downloads directory:', externalDir);
        return externalDir;
      }
      
      // Fallback to common paths
      const commonDownloadPaths = [
        '/storage/emulated/0/Download',
        '/storage/emulated/0/Downloads',
        '/sdcard/Download',
        '/sdcard/Downloads',
      ];
      
      for (const path of commonDownloadPaths) {
        try {
          const dirInfo = await FileSystem.getInfoAsync(path);
          if (dirInfo.exists && dirInfo.isDirectory) {
            console.log('📁 Found downloads directory:', path);
            return path;
          }
        } catch (error) {
          continue;
        }
      }
    }
    
    console.log('📁 Could not determine downloads directory');
    return null;
  } catch (error) {
    console.error('📁 Error getting downloads directory:', error);
    return null;
  }
}

// Find movie file in device storage
export async function findMovieFile() {
  try {
    console.log('🎬 Searching for movie file...');
    
    // First, try to find ANY MP4 file using MediaLibrary (works on both iOS and Android)
    const mediaPermission = await MediaLibrary.getPermissionsAsync();
    if (mediaPermission.status === 'granted') {
      console.log('🎬 Searching media library...');
      const assets = await MediaLibrary.getAssetsAsync({
        mediaType: 'video',
        first: 200, // Get first 200 videos to increase chances of finding it
      });

      console.log(`🎬 Found ${assets.assets.length} video files in media library`);

      // Look for ANY MP4 file (remove restrictive path filtering)
      for (const asset of assets.assets) {
        const filename = asset.filename.toLowerCase();
        const uri = asset.uri.toLowerCase();
        
        console.log(`🎬 Checking: ${asset.filename}`);
        console.log(`   URI: ${asset.uri}`);
        
        if (filename.endsWith('.mp4')) {
          console.log(`🎬 ✅ Found MP4 file: ${asset.filename} - using this one!`);
          const assetInfo = await MediaLibrary.getAssetInfoAsync(asset);
          return {
            uri: assetInfo.localUri || assetInfo.uri,
            source: 'media_library',
            filename: asset.filename,
            duration: asset.duration
          };
        }
      }
    } else {
      console.log('🎬 Media library permission not granted');
    }

    // For Android, try direct file system access to multiple possible locations
    if (Platform.OS === 'android') {
      console.log('🎬 Trying direct file system access on Android...');
      
      // Check multiple possible locations for Movie folders
      const movieFolders = [
        '/storage/emulated/0/Downloads/Movie',
        '/storage/emulated/0/Download/Movie',
        '/storage/emulated/0/Downloads',  // Also check directly in Downloads
        '/storage/emulated/0/Download',   // Also check directly in Download
        '/sdcard/Downloads/Movie',
        '/sdcard/Download/Movie',
        '/sdcard/Downloads',
        '/sdcard/Download',
      ];

      console.log(`🎬 Checking ${movieFolders.length} possible locations:`);
      for (const folderPath of movieFolders) {
        try {
          console.log(`🎬 Checking folder: ${folderPath}`);
          const folderInfo = await FileSystem.getInfoAsync(folderPath);
          
          if (folderInfo.exists && folderInfo.isDirectory) {
            console.log(`🎬 Folder exists! Scanning for MP4 files...`);
            
            // Read directory contents
            const files = await FileSystem.readDirectoryAsync(folderPath);
            console.log(`🎬 Found ${files.length} files in ${folderPath}:`, files);
            
            // Look for any MP4 file
            const mp4Files = files.filter(filename => 
              filename.toLowerCase().endsWith('.mp4')
            );
            
            if (mp4Files.length > 0) {
              const selectedFile = mp4Files[0]; // Take the first MP4 found
              const filePath = `${folderPath}/${selectedFile}`;
              
              console.log(`🎬 ✅ Found MP4 file: ${selectedFile} at ${filePath}`);
              
              // Verify the file exists and get its info
              const fileInfo = await FileSystem.getInfoAsync(filePath);
              if (fileInfo.exists) {
                console.log(`🎬 File confirmed! Size: ${(fileInfo.size / 1024 / 1024).toFixed(2)} MB`);
                return {
                  uri: `file://${filePath}`,
                  source: 'file_system',
                  filename: selectedFile,
                  path: filePath,
                  size: fileInfo.size
                };
              }
            } else {
              console.log(`🎬 No MP4 files found in ${folderPath}`);
            }
          } else {
            console.log(`🎬 Folder does not exist: ${folderPath}`);
          }
        } catch (error) {
          console.log(`🎬 Error accessing ${folderPath}: ${error.message}`);
          continue;
        }
      }
      
      console.log('🎬 No MP4 files found in any Movie folders');
    }

    console.log('🎬 Movie file not found in any location');
    return null;
  } catch (error) {
    console.error('🎬 Error searching for movie file:', error);
    return null;
  }
}

// Fallback to bundled asset if no external movie found
export async function getMovieSource() {
  try {
    // Only try to find external movie file - no bundled fallback
    const externalMovie = await findMovieFile();
    if (externalMovie) {
      return externalMovie;
    }

    // No bundled asset fallback - user must provide their own movie
    console.log('🎬 No MP4 files found - user must place any MP4 file in Downloads/Movie/');
    throw new Error('🎬 Expo Go Limitation: Media library access is restricted in Expo Go starting with SDK 53. Your MP4 file might be present but not accessible. For full functionality, create a development build with: npx expo run:android');
  } catch (error) {
    console.error('🎬 Error getting movie source:', error);
    throw error;
  }
}

// Check if letter sending window has expired (movie can be played)
export async function canPlayMovie() {
  try {
    // Get current flight data
    const currentUser = await AsyncStorage.getItem('@airletters_current_user');
    const flightData = await AsyncStorage.getItem('@airletters_flight_data');
    
    if (!flightData) {
      // No flight data, allow movie playback
      return true;
    }

    const flights = JSON.parse(flightData);
    const userFlight = currentUser === 'B' ? flights.flightB : flights.flightA;
    
    if (!userFlight || !userFlight.departureUTC) {
      return true;
    }

    const now = DateTime.utc();
    const flightStart = DateTime.fromISO(userFlight.departureUTC, { zone: 'utc' });
    const letterWindowEnd = flightStart.plus({ minutes: 1 }); // 1 minute window for testing
    
    // Movie can be played after letter window expires
    return now > letterWindowEnd;
  } catch (error) {
    console.warn('🎬 Error checking movie availability:', error);
    // Default to allowing movie playback if there's an error
    return true;
  }
}

// Get time remaining until movie can be played
export async function getTimeUntilMovieAvailable() {
  try {
    const currentUser = await AsyncStorage.getItem('@airletters_current_user');
    const flightData = await AsyncStorage.getItem('@airletters_flight_data');
    
    if (!flightData) {
      return 0; // No flight data, movie available now
    }

    const flights = JSON.parse(flightData);
    const userFlight = currentUser === 'B' ? flights.flightB : flights.flightA;
    
    if (!userFlight || !userFlight.departureUTC) {
      return 0;
    }

    const now = DateTime.utc();
    const flightStart = DateTime.fromISO(userFlight.departureUTC, { zone: 'utc' });
    const letterWindowEnd = flightStart.plus({ minutes: 1 }); // 1 minute window for testing
    
    if (now > letterWindowEnd) {
      return 0; // Movie available now
    }

    return letterWindowEnd.diff(now, 'milliseconds').milliseconds;
  } catch (error) {
    console.warn('🎬 Error calculating time until movie:', error);
    return 0;
  }
}

// Request notification permissions with better error handling
export async function requestNotificationPermissions() {
  try {
    // Check if notifications are available
    if (!Notifications) {
      console.warn('📱 Notifications not available - using manual reminder system');
      return false;
    }

    // Check if we're in Expo Go (notifications don't work in Expo Go for SDK 53+)
    const isExpoGo = __DEV__ && (typeof Constants !== 'undefined' ? Constants.appOwnership === 'expo' : true);
    
    if (isExpoGo) {
      console.warn('📱 Running in Expo Go: Push notifications are not available in SDK 53+. Movie reminders will use manual alerts instead.');
      // Show user-friendly message about development build
      return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: false,
          allowSound: true,
          allowAnnouncements: false,
        },
      });
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.warn('Notification permission not granted - using manual reminder system');
      return false;
    }
    
    console.log('✅ Notification permissions granted');
    return true;
  } catch (error) {
    console.warn('Notifications not available - using manual reminder system:', error.message);
    return false;
  }
}

// Enhanced movie library configuration
export const MOVIE_LIBRARY = [
  {
    id: 'movie1',
    title: 'Your Movie',
    duration: 120, // 2 hours - adjust this to match your movie's actual duration
    description: 'Your custom movie for the AirLetters experience - perfectly synchronized to real-time.',
  // localPath must not be required statically here to avoid Metro inlining very large files.
  // The screen will require the asset at runtime instead.
  localPath: null,
    thumbnail: require('../../assets/movie/movie1-thumb.jpg'),
    size: '1.2 GB', // Adjust this to match your file size
    genre: 'Custom',
    quality: '1080p'
  }
];

// Check if movie is available (always true for local assets)
export function isMovieDownloaded(movieId) {
  return true; // All movies are always "downloaded" since they're local assets
}

// Calculate movie start time (45 minutes after departure) with timezone handling
export function calculateMovieStartTime(flightDepartureUTC) {
  try {
    const departureTime = DateTime.fromISO(flightDepartureUTC, { zone: 'utc' });
    
    if (!departureTime.isValid) {
      console.error('Invalid departure time provided:', flightDepartureUTC);
      // Fallback to current time + 5 minutes for testing
      return DateTime.utc().plus({ minutes: 5 });
    }
    
    const movieStartTime = departureTime.plus({ minutes: 45 });
    console.log(`🎬 Movie start time calculated: ${movieStartTime.toISO()}`);
    
    return movieStartTime;
  } catch (error) {
    console.error('Error calculating movie start time:', error);
    // Fallback to current time + 5 minutes
    return DateTime.utc().plus({ minutes: 5 });
  }
}

// Enhanced movie position calculation with better precision
export function getCurrentMoviePosition(movieStartTime, movieDurationMinutes) {
  try {
    const now = DateTime.utc();
    const elapsedMinutes = now.diff(movieStartTime, 'minutes').minutes;
    
    // Movie hasn't started yet
    if (elapsedMinutes < 0) {
      return { 
        status: 'waiting', 
        position: 0, 
        timeUntilStart: Math.abs(elapsedMinutes),
        elapsedMinutes: 0
      };
    } 
    // Movie has ended
    else if (elapsedMinutes >= movieDurationMinutes) {
      return { 
        status: 'ended', 
        position: movieDurationMinutes * 60 * 1000, // Convert to milliseconds
        timeUntilStart: 0,
        elapsedMinutes: movieDurationMinutes
      };
    } 
    // Movie is currently playing
    else {
      const positionMs = elapsedMinutes * 60 * 1000; // Convert to milliseconds
      return { 
        status: 'playing', 
        position: positionMs, 
        timeUntilStart: 0,
        elapsedMinutes: elapsedMinutes
      };
    }
  } catch (error) {
    console.error('Error calculating movie position:', error);
    return { 
      status: 'waiting', 
      position: 0, 
      timeUntilStart: 0,
      elapsedMinutes: 0
    };
  }
}

// Enhanced notification scheduling
export async function scheduleMovieStartNotification(movieStartTime, movieTitle) {
  try {
    // Check if notifications are available
    if (!Notifications) {
      console.log('📱 Notifications not available - using manual reminder system');
      await AsyncStorage.setItem('@movie_start_time', movieStartTime.toISO());
      await AsyncStorage.setItem('@movie_title', movieTitle);
      return null;
    }

    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.log('📱 Using manual reminder system for movie notifications');
      // Store the movie start time for manual checking
      await AsyncStorage.setItem('@movie_start_time', movieStartTime.toISO());
      await AsyncStorage.setItem('@movie_title', movieTitle);
      return null;
    }

    // Cancel any existing notifications first
    await cancelMovieNotification();

    // Schedule main notification for movie start
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: '🎬 Movie Time!',
        body: `"${movieTitle}" is starting now. Open AirLetters to watch synchronized playback.`,
        sound: true,
        data: { 
          type: 'movie_start', 
          movieTitle,
          timestamp: movieStartTime.toISO()
        },
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: {
        date: movieStartTime.toJSDate(),
      },
    });

    // Schedule a preparation notification 2 minutes before
    const prepNotificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: '🎬 Get Ready!',
        body: `"${movieTitle}" starts in 2 minutes. Prepare for takeoff entertainment!`,
        sound: false,
        data: { 
          type: 'movie_prep', 
          movieTitle,
          timestamp: movieStartTime.minus({ minutes: 2 }).toISO()
        },
      },
      trigger: {
        date: movieStartTime.minus({ minutes: 2 }).toJSDate(),
      },
    });

    // Store notification IDs for potential cancellation
    await AsyncStorage.setItem('@movie_notification_id', notificationId);
    await AsyncStorage.setItem('@movie_prep_notification_id', prepNotificationId);
    
    console.log(`✅ Scheduled movie notifications for ${movieStartTime.toISO()}`);
    return notificationId;
  } catch (error) {
    console.log('📱 Notification scheduling failed, using manual reminder system:', error.message);
    // Fallback to manual reminder system
    try {
      await AsyncStorage.setItem('@movie_start_time', movieStartTime.toISO());
      await AsyncStorage.setItem('@movie_title', movieTitle);
    } catch (storageError) {
      console.error('Failed to set manual reminder:', storageError);
    }
    return null;
  }
}

// Enhanced notification cancellation
export async function cancelMovieNotification() {
  try {
    if (Notifications) {
      // Cancel main notification
      const notificationId = await AsyncStorage.getItem('@movie_notification_id');
      if (notificationId) {
        await Notifications.cancelScheduledNotificationAsync(notificationId);
        await AsyncStorage.removeItem('@movie_notification_id');
      }
      
      // Cancel preparation notification
      const prepNotificationId = await AsyncStorage.getItem('@movie_prep_notification_id');
      if (prepNotificationId) {
        await Notifications.cancelScheduledNotificationAsync(prepNotificationId);
        await AsyncStorage.removeItem('@movie_prep_notification_id');
      }
    }
    
    // Clear manual reminder data
    await AsyncStorage.multiRemove([
      '@movie_start_time',
      '@movie_title',
      '@movie_last_reminder'
    ]);
    
    console.log('✅ Cancelled all movie notifications');
  } catch (error) {
    console.error('Failed to cancel movie notifications:', error);
  }
}

// Enhanced manual reminder system
export async function checkMovieStartReminder() {
  try {
    const movieStartTimeStr = await AsyncStorage.getItem('@movie_start_time');
    const movieTitle = await AsyncStorage.getItem('@movie_title');
    const lastReminderStr = await AsyncStorage.getItem('@movie_last_reminder');
    
    if (!movieStartTimeStr || !movieTitle) {
      return null;
    }
    
    const movieStartTime = DateTime.fromISO(movieStartTimeStr);
    const now = DateTime.utc();
    const timeDiff = movieStartTime.diff(now, 'minutes').minutes;
    
    // Prevent showing the same reminder multiple times
    const lastReminder = lastReminderStr ? DateTime.fromISO(lastReminderStr) : null;
    const timeSinceLastReminder = lastReminder ? now.diff(lastReminder, 'minutes').minutes : 10;
    
    // Only show reminders if at least 3 minutes have passed since last reminder
    if (timeSinceLastReminder < 3) {
      return null;
    }
    
    // Movie should have started in the last 5 minutes
    if (timeDiff <= 0 && timeDiff >= -5) {
      await AsyncStorage.setItem('@movie_last_reminder', now.toISO());
      return {
        movieTitle,
        movieStartTime,
        shouldShow: true,
        isPreparation: false,
        message: `"${movieTitle}" started ${Math.abs(Math.round(timeDiff))} minutes ago!`
      };
    }
    
    // Movie starts in the next 2 minutes
    if (timeDiff > 0 && timeDiff <= 2) {
      await AsyncStorage.setItem('@movie_last_reminder', now.toISO());
      return {
        movieTitle,
        movieStartTime,
        shouldShow: true,
        isPreparation: true,
        message: `"${movieTitle}" starts in ${Math.round(timeDiff)} minute(s)!`
      };
    }
    
    return null;
  } catch (error) {
    // Silent fail for reminder checks to avoid console spam
    return null;
  }
}

// Utility: Format file size in human readable format
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Utility: Format duration in human readable format
export function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (hours > 0) {
    return `${hours}h ${remainingMinutes}m`;
  } else {
    return `${remainingMinutes}m`;
  }
}

// Utility: Get movie progress percentage
export function getMovieProgress(currentPosition, totalDuration) {
  if (totalDuration <= 0) return 0;
  return Math.max(0, Math.min(100, (currentPosition / totalDuration) * 100));
}

// Development helpers for testing
export const DEV_HELPERS = {
  // Set movie to start in X minutes from now (for testing)
  setMovieStartInMinutes: async (minutes) => {
    if (__DEV__) {
      const startTime = DateTime.utc().plus({ minutes });
      await AsyncStorage.setItem('@movie_start_time', startTime.toISO());
      await AsyncStorage.setItem('@movie_title', MOVIE_LIBRARY[0].title);
      console.log(`🧪 DEV: Movie set to start in ${minutes} minutes at ${startTime.toISO()}`);
    }
  },
  
  // Clear all movie data (for testing)
  clearMovieData: async () => {
    if (__DEV__) {
      await AsyncStorage.multiRemove([
        '@movie_start_time',
        '@movie_title',
        '@movie_notification_id',
        '@movie_prep_notification_id',
        '@movie_last_reminder'
      ]);
      console.log('🧪 DEV: Cleared all movie data');
    }
  },
  
  // Get current movie status for debugging
  getMovieDebugInfo: async () => {
    if (__DEV__) {
      const movieStartTimeStr = await AsyncStorage.getItem('@movie_start_time');
      const movieTitle = await AsyncStorage.getItem('@movie_title');
      
      if (movieStartTimeStr) {
        const movieStartTime = DateTime.fromISO(movieStartTimeStr);
        const now = DateTime.utc();
        const moviePosition = getCurrentMoviePosition(movieStartTime, MOVIE_LIBRARY[0].duration);
        
        console.log('🧪 DEV Movie Debug Info:', {
          movieTitle,
          startTime: movieStartTime.toISO(),
          currentTime: now.toISO(),
          status: moviePosition.status,
          position: moviePosition.position,
          timeUntilStart: moviePosition.timeUntilStart
        });
        
        return {
          movieTitle,
          startTime: movieStartTime.toISO(),
          currentTime: now.toISO(),
          moviePosition
        };
      }
      
      return null;
    }
  }
};