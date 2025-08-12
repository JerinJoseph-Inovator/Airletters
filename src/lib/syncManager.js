// src/lib/syncManager.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLetters, LETTER_STATUS } from './storage';

const SYNC_STATUS_KEY = '@airletters_sync_status';
const DEVICE_ID_KEY = '@airletters_device_id';
const REMOTE_LETTERS_KEY = '@airletters_remote_letters';

// Generate a unique device ID
export async function getOrCreateDeviceId() {
  try {
    let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
      deviceId = 'device_' + Math.random().toString(36).slice(2) + Date.now();
      await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
  } catch (error) {
    console.warn('Failed to get device ID:', error);
    return 'device_unknown_' + Date.now();
  }
}

// Simulate network connectivity check
export function isOnline() {
  // In a real app, you'd use @react-native-netinfo/netinfo
  // For simulation, we'll randomly return true/false or use a flag
  return Math.random() > 0.3; // 70% chance of being "online"
}

// Smart estimation: predict where letters would be based on time
export function estimateLetterProgress(letter, currentTime = new Date()) {
  const scheduledTime = new Date(letter.scheduledSendUTC);
  const now = currentTime;
  
  if (now < scheduledTime) {
    // Still scheduled
    return { ...letter, status: LETTER_STATUS.SCHEDULED, animationProgress: 0 };
  }
  
  const transitDuration = 5 * 60 * 1000; // 5 minutes
  const elapsed = now.getTime() - scheduledTime.getTime();
  
  if (elapsed < transitDuration) {
    // In transit
    const progress = elapsed / transitDuration;
    return {
      ...letter,
      status: LETTER_STATUS.IN_TRANSIT,
      animationProgress: progress
    };
  } else {
    // Should be delivered
    return {
      ...letter,
      status: LETTER_STATUS.DELIVERED,
      animationProgress: 1,
      deliveredAt: letter.deliveredAt || new Date(scheduledTime.getTime() + transitDuration).toISOString()
    };
  }
}

// Merge offline and online data intelligently
export function mergeLetterData(localLetters, remoteLetters) {
  const merged = [...localLetters];
  const localIds = new Set(localLetters.map(l => l.id));
  
  // Add remote letters that don't exist locally
  for (const remoteLetter of remoteLetters) {
    if (!localIds.has(remoteLetter.id)) {
      merged.push(remoteLetter);
    } else {
      // Merge status updates (prefer the more advanced status)
      const localIndex = merged.findIndex(l => l.id === remoteLetter.id);
      const local = merged[localIndex];
      
      // Status progression priority: scheduled < in_transit < delivered < read
      const statusPriority = {
        [LETTER_STATUS.SCHEDULED]: 0,
        [LETTER_STATUS.IN_TRANSIT]: 1,
        [LETTER_STATUS.DELIVERED]: 2,
        [LETTER_STATUS.READ]: 3
      };
      
      if (statusPriority[remoteLetter.status] > statusPriority[local.status]) {
        merged[localIndex] = { ...local, ...remoteLetter };
      }
    }
  }
  
  return merged;
}

// Simulate fetching letters from remote server
export async function fetchRemoteLetters(deviceId) {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (isOnline()) {
        // Simulate remote letters (in reality, this would be an API call)
        const mockRemoteLetters = [
          {
            id: 'remote_letter_1',
            text: 'Hello from the other flight! 👋 Hope your journey is smooth.',
            createdAt: new Date(Date.now() - 10 * 60000).toISOString(), // 10 min ago
            scheduledSendUTC: new Date(Date.now() - 5 * 60000).toISOString(), // 5 min ago
            status: LETTER_STATUS.DELIVERED,
            fromFlight: 'B',
            toFlight: 'A',
            animationProgress: 1,
            deliveredAt: new Date(Date.now() - 1000).toISOString(),
            readAt: null
          }
        ];
        resolve({ success: true, letters: mockRemoteLetters });
      } else {
        resolve({ success: false, error: 'No network connection' });
      }
    }, 1000 + Math.random() * 2000); // 1-3 second delay
  });
}

// Upload local letters to remote server
export async function uploadLocalLetters(letters, deviceId) {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (isOnline()) {
        // Simulate successful upload
        console.log(`Uploaded ${letters.length} letters for device ${deviceId}`);
        resolve({ success: true, uploaded: letters.length });
      } else {
        resolve({ success: false, error: 'No network connection' });
      }
    }, 500 + Math.random() * 1500);
  });
}

// Main sync function
export async function performSync() {
  try {
    const deviceId = await getOrCreateDeviceId();
    const localLetters = await getLetters();
    
    // Try to fetch remote letters
    const remoteResult = await fetchRemoteLetters(deviceId);
    
    if (remoteResult.success) {
      // Merge remote letters with local
      const mergedLetters = mergeLetterData(localLetters, remoteResult.letters);
      
      // Save merged data locally
      await AsyncStorage.setItem('@airletters_letters', JSON.stringify(mergedLetters));
      
      // Upload any new local letters to remote
      const localOnlyLetters = localLetters.filter(local => 
        !remoteResult.letters.find(remote => remote.id === local.id)
      );
      
      if (localOnlyLetters.length > 0) {
        await uploadLocalLetters(localOnlyLetters, deviceId);
      }
      
      // Update sync status
      const syncStatus = {
        lastSyncAt: new Date().toISOString(),
        isOnline: true,
        deviceId,
        letterCount: mergedLetters.length
      };
      
      await AsyncStorage.setItem(SYNC_STATUS_KEY, JSON.stringify(syncStatus));
      
      return {
        success: true,
        merged: mergedLetters.length,
        newFromRemote: remoteResult.letters.length,
        uploadedToRemote: localOnlyLetters.length
      };
    } else {
      // Offline mode - use smart estimation
      const estimatedLetters = localLetters.map(letter => 
        estimateLetterProgress(letter)
      );
      
      await AsyncStorage.setItem('@airletters_letters', JSON.stringify(estimatedLetters));
      
      const syncStatus = {
        lastSyncAt: new Date().toISOString(),
        isOnline: false,
        deviceId,
        letterCount: estimatedLetters.length,
        offlineEstimation: true
      };
      
      await AsyncStorage.setItem(SYNC_STATUS_KEY, JSON.stringify(syncStatus));
      
      return {
        success: true,
        offlineMode: true,
        estimated: estimatedLetters.length
      };
    }
  } catch (error) {
    console.warn('Sync failed:', error);
    return { success: false, error: error.message };
  }
}

// Get current sync status
export async function getSyncStatus() {
  try {
    const raw = await AsyncStorage.getItem(SYNC_STATUS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn('Failed to get sync status:', error);
    return null;
  }
}