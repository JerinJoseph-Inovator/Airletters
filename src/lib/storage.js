// src/lib/storage.js
import AsyncStorage from '@react-native-async-storage/async-storage';

const LETTERS_KEY = '@airletters_letters';
const FLIGHTS_KEY = '@airletters_flights';
const USER_SELECTION_KEY = '@airletters_user_selection';

// Letter status progression: scheduled -> in_transit -> delivered -> read
export const LETTER_STATUS = {
  SCHEDULED: 'scheduled',
  IN_TRANSIT: 'in_transit', 
  DELIVERED: 'delivered',
  READ: 'read'
};

// Get current user selection
export async function getCurrentUser() {
  try {
    const userType = await AsyncStorage.getItem(USER_SELECTION_KEY);
    return userType || 'A'; // Default to A if not set
  } catch (error) {
    console.warn('Failed to get current user:', error);
    return 'A';
  }
}

// Save letter with enhanced metadata - creates both letters to simulate simultaneous sending
export async function saveLetter(text, sendDelayMinutes = 45) {
  const now = new Date();
  const transitTime = new Date(now.getTime() + parseInt(sendDelayMinutes, 10) * 60000);
  
  // Get current user to determine letter direction
  const currentUser = await getCurrentUser();
  const fromFlight = currentUser;
  const toFlight = currentUser === 'A' ? 'B' : 'A';
  
  // Create the user's letter
  const userLetter = {
    id: Math.random().toString(36).slice(2),
    text: text.trim(),
    createdAt: now.toISOString(),
    scheduledSendUTC: transitTime.toISOString(), 
    deliveredAt: null,
    readAt: null,
    status: LETTER_STATUS.IN_TRANSIT, // Start in transit immediately for simulation
    // Animation metadata with proper user direction
    fromFlight,
    toFlight,
    animationProgress: 0, // 0 to 1 for map animation
    senderUser: currentUser, // Track who sent this letter
  };
  
  // Create the other user's letter (dummy content for simulation)
  const otherUserLetter = {
    id: Math.random().toString(36).slice(2),
    text: `Letter from User ${toFlight}`, // Dummy content for the other user
    createdAt: now.toISOString(),
    scheduledSendUTC: transitTime.toISOString(), 
    deliveredAt: null,
    readAt: null,
    status: LETTER_STATUS.IN_TRANSIT, // Start in transit immediately for simulation
    // Animation metadata with opposite direction
    fromFlight: toFlight,
    toFlight: fromFlight,
    animationProgress: 0, // 0 to 1 for map animation
    senderUser: toFlight, // Track who sent this letter
  };

  try {
    const existing = await getLetters();
    // Clear any existing letters to avoid duplicates
    const newLetters = [userLetter, otherUserLetter];
    await AsyncStorage.setItem(LETTERS_KEY, JSON.stringify(newLetters));
    return userLetter;
  } catch (error) {
    console.warn('Failed to save letter:', error);
    throw error;
  }
}

// Get all letters
export async function getLetters() {
  try {
    const raw = await AsyncStorage.getItem(LETTERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.warn('Failed to get letters:', error);
    return [];
  }
}

// Update letter status and metadata
export async function updateLetter(letterId, updates) {
  try {
    const letters = await getLetters();
    const index = letters.findIndex(l => l.id === letterId);
    if (index >= 0) {
      letters[index] = { ...letters[index], ...updates };
      await AsyncStorage.setItem(LETTERS_KEY, JSON.stringify(letters));
      return letters[index];
    }
  } catch (error) {
    console.warn('Failed to update letter:', error);
  }
  return null;
}

// Mark letter as read
export async function markLetterAsRead(letterId) {
  return updateLetter(letterId, {
    status: LETTER_STATUS.READ,
    readAt: new Date().toISOString()
  });
}

// Process letter status changes based on time
export async function processLetterStatuses() {
  const letters = await getLetters();
  const now = new Date();
  let hasUpdates = false;

  for (let letter of letters) {
    const scheduledTime = new Date(letter.scheduledSendUTC);
    
    // Check if scheduled letter should start transit
    if (letter.status === LETTER_STATUS.SCHEDULED && now >= scheduledTime) {
      letter.status = LETTER_STATUS.IN_TRANSIT;
      letter.animationProgress = 0;
      hasUpdates = true;
    }
    
    // Check if in-transit letter should be delivered (shortened to 30s for testing)
    if (letter.status === LETTER_STATUS.IN_TRANSIT) {
      const transitDuration = 30 * 1000; // 30 seconds in milliseconds (testing)
      const elapsed = now.getTime() - scheduledTime.getTime();
      const progress = Math.min(elapsed / transitDuration, 1);
      
      if (progress >= 1) {
        letter.status = LETTER_STATUS.DELIVERED;
        letter.deliveredAt = now.toISOString();
        letter.animationProgress = 1;
        hasUpdates = true;
      } else {
        letter.animationProgress = progress;
        hasUpdates = true;
      }
    }
  }

  if (hasUpdates) {
    await AsyncStorage.setItem(LETTERS_KEY, JSON.stringify(letters));
  }
  
  return letters;
}

// Flight data storage
export async function saveFlights(flightA, flightB) {
  try {
    const data = { flightA, flightB, savedAt: new Date().toISOString() };
    await AsyncStorage.setItem(FLIGHTS_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn('Failed to save flights:', error);
  }
}

export async function getFlights() {
  try {
    const raw = await AsyncStorage.getItem(FLIGHTS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn('Failed to get flights:', error);
    return null;
  }
}

// Clear all letter data
export async function clearAllLetters() {
  try {
    await AsyncStorage.removeItem(LETTERS_KEY);
    console.log('All letter data cleared successfully');
    return true;
  } catch (error) {
    console.warn('Failed to clear letter data:', error);
    return false;
  }
}

// Clear old delivered/read letters (optional cleanup)
export async function clearOldLetters(olderThanDays = 7) {
  try {
    const letters = await getLetters();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    const filteredLetters = letters.filter(letter => {
      if (letter.status === LETTER_STATUS.READ || letter.status === LETTER_STATUS.DELIVERED) {
        const letterDate = new Date(letter.deliveredAt || letter.createdAt);
        return letterDate >= cutoffDate;
      }
      return true; // Keep non-delivered letters
    });
    
    await AsyncStorage.setItem(LETTERS_KEY, JSON.stringify(filteredLetters));
    console.log(`Cleared ${letters.length - filteredLetters.length} old letters`);
    return true;
  } catch (error) {
    console.warn('Failed to clear old letters:', error);
    return false;
  }
}