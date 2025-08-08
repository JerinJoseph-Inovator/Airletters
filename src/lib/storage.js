// src/lib/storage.js
import AsyncStorage from '@react-native-async-storage/async-storage';

const LETTERS_KEY = '@airletters_letters';
const FLIGHTS_KEY = '@airletters_flights';

// Letter status progression: scheduled -> in_transit -> delivered -> read
export const LETTER_STATUS = {
  SCHEDULED: 'scheduled',
  IN_TRANSIT: 'in_transit', 
  DELIVERED: 'delivered',
  READ: 'read'
};

// Save letter with enhanced metadata
export async function saveLetter(text, sendDelayMinutes = 45) {
  const now = new Date();
  const transitTime = new Date(now.getTime() + parseInt(sendDelayMinutes, 10) * 60000);
  
  const letter = {
    id: Math.random().toString(36).slice(2),
    text: text.trim(),
    createdAt: now.toISOString(),
    scheduledSendUTC: transitTime.toISOString(), 
    deliveredAt: null,
    readAt: null,
    status: LETTER_STATUS.SCHEDULED,
    // Animation metadata
    fromFlight: 'A', // or 'B' - determine which flight sent it
    toFlight: 'B',   // or 'A' - determine recipient
    animationProgress: 0, // 0 to 1 for map animation
  };

  try {
    const existing = await getLetters();
    existing.push(letter);
    await AsyncStorage.setItem(LETTERS_KEY, JSON.stringify(existing));
    return letter;
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
    
    // Check if in-transit letter should be delivered (after 5 minutes of animation)
    if (letter.status === LETTER_STATUS.IN_TRANSIT) {
      const transitDuration = 5 * 60 * 1000; // 5 minutes in milliseconds
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