// src/lib/movieService.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DateTime } from 'luxon';

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
    localPath: require('../../assets/movie/movie.mp4'), // Your local movie file
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