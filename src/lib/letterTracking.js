// src/lib/letterTracking.js

import AsyncStorage from '@react-native-async-storage/async-storage';
import { calculateDistance } from '../utils/mapUtils';

/**
 * Letter status enumeration
 */
export const LETTER_STATUS = {
  DRAFT: 'DRAFT',
  SCHEDULED: 'SCHEDULED',
  IN_TRANSIT: 'IN_TRANSIT',
  DELIVERED: 'DELIVERED',
  READ: 'READ',
  FAILED: 'FAILED'
};

/**
 * Letter priority levels
 */
export const LETTER_PRIORITY = {
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  URGENT: 'URGENT'
};

/**
 * Letter tracking and management system
 */
class LetterTrackingSystem {
  constructor() {
    this.letters = new Map();
    this.listeners = new Set();
    this.trackingInterval = null;
    this.storageKey = 'flight_letters_data';
  }

  /**
   * Initialize the system by loading stored data
   */
  async initialize() {
    try {
      await this.loadFromStorage();
      this.startTracking();
    } catch (error) {
      console.error('Failed to initialize letter tracking system:', error);
    }
  }

  /**
   * Create a new letter
   * @param {Object} letterData - Letter data
   * @returns {string} Letter ID
   */
  async createLetter(letterData) {
    const letterId = this.generateId();
    const letter = {
      id: letterId,
      text: letterData.text || '',
      recipientFlight: letterData.recipientFlight,
      senderFlight: letterData.senderFlight,
      priority: letterData.priority || LETTER_PRIORITY.NORMAL,
      status: LETTER_STATUS.DRAFT,
      createdAt: new Date().toISOString(),
      scheduledAt: letterData.scheduledAt,
      deliveredAt: null,
      readAt: null,
      progress: 0,
      currentPosition: null,
      estimatedDelivery: null,
      trackingHistory: [],
      metadata: {
        attachments: letterData.attachments || [],
        tags: letterData.tags || [],
        isEncrypted: letterData.isEncrypted || false,
        deliveryConfirmation: letterData.deliveryConfirmation || false
      }
    };

    this.letters.set(letterId, letter);
    await this.saveToStorage();
    this.notifyListeners('letterCreated', letter);

    return letterId;
  }

  /**
   * Schedule letter for delivery
   * @param {string} letterId - Letter ID
   * @param {Date} scheduledTime - Scheduled delivery time
   */
  async scheduleLetter(letterId, scheduledTime) {
    const letter = this.letters.get(letterId);
    if (!letter) throw new Error('Letter not found');

    letter.status = LETTER_STATUS.SCHEDULED;
    letter.scheduledAt = scheduledTime.toISOString();
    letter.estimatedDelivery = this.calculateEstimatedDelivery(letter);

    this.addTrackingEntry(letter, 'Letter scheduled for delivery');
    
    await this.saveToStorage();
    this.notifyListeners('letterScheduled', letter);
  }

  /**
   * Start letter transit
   * @param {string} letterId - Letter ID
   */
  async startTransit(letterId) {
    const letter = this.letters.get(letterId);
    if (!letter) throw new Error('Letter not found');

    letter.status = LETTER_STATUS.IN_TRANSIT;
    letter.progress = 0;
    letter.currentPosition = this.getFlightPosition(letter.senderFlight);

    this.addTrackingEntry(letter, 'Letter departed with flight');
    
    await this.saveToStorage();
    this.notifyListeners('letterInTransit', letter);
  }

  /**
   * Update letter progress during transit
   * @param {string} letterId - Letter ID
   * @param {number} progress - Progress (0-1)
   * @param {Object} position - Current position
   */
  async updateLetterProgress(letterId, progress, position) {
    const letter = this.letters.get(letterId);
    if (!letter || letter.status !== LETTER_STATUS.IN_TRANSIT) return;

    const oldProgress = letter.progress;
    letter.progress = Math.max(0, Math.min(1, progress));
    letter.currentPosition = position;

    // Add tracking entries for significant progress milestones
    if (this.shouldAddTrackingEntry(oldProgress, letter.progress)) {
      const milestone = this.getProgressMilestone(letter.progress);
      this.addTrackingEntry(letter, `Letter ${milestone}`);
    }

    // Check if letter should be delivered
    if (letter.progress >= 1) {
      await this.deliverLetter(letterId);
    } else {
      await this.saveToStorage();
      this.notifyListeners('letterProgressUpdated', letter);
    }
  }

  /**
   * Deliver letter
   * @param {string} letterId - Letter ID
   */
  async deliverLetter(letterId) {
    const letter = this.letters.get(letterId);
    if (!letter) throw new Error('Letter not found');

    letter.status = LETTER_STATUS.DELIVERED;
    letter.deliveredAt = new Date().toISOString();
    letter.progress = 1;
    letter.currentPosition = this.getFlightPosition(letter.recipientFlight);

    this.addTrackingEntry(letter, 'Letter delivered successfully');
    
    await this.saveToStorage();
    this.notifyListeners('letterDelivered', letter);
  }

  /**
   * Mark letter as read
   * @param {string} letterId - Letter ID
   */
  async markLetterAsRead(letterId) {
    const letter = this.letters.get(letterId);
    if (!letter) throw new Error('Letter not found');

    letter.status = LETTER_STATUS.READ;
    letter.readAt = new Date().toISOString();

    this.addTrackingEntry(letter, 'Letter opened by recipient');
    
    await this.saveToStorage();
    this.notifyListeners('letterRead', letter);
  }

  /**
   * Delete letter
   * @param {string} letterId - Letter ID
   */
  async deleteLetter(letterId) {
    const letter = this.letters.get(letterId);
    if (!letter) throw new Error('Letter not found');

    this.letters.delete(letterId);
    await this.saveToStorage();
    this.notifyListeners('letterDeleted', letter);
  }

  /**
   * Get letter by ID
   * @param {string} letterId - Letter ID
   * @returns {Object|null} Letter object
   */
  getLetter(letterId) {
    return this.letters.get(letterId) || null;
  }

  /**
   * Get all letters
   * @returns {Array} Array of letter objects
   */
  getAllLetters() {
    return Array.from(this.letters.values());
  }

  /**
   * Get letters by status
   * @param {string} status - Letter status
   * @returns {Array} Array of letter objects
   */
  getLettersByStatus(status) {
    return this.getAllLetters().filter(letter => letter.status === status);
  }

  /**
   * Get letters by flight
   * @param {string} flightId - Flight ID
   * @returns {Array} Array of letter objects
   */
  getLettersByFlight(flightId) {
    return this.getAllLetters().filter(letter => 
      letter.senderFlight === flightId || letter.recipientFlight === flightId
    );
  }

  /**
   * Search letters
   * @param {string} query - Search query
   * @returns {Array} Array of matching letters
   */
  searchLetters(query) {
    const searchTerm = query.toLowerCase().trim();
    if (!searchTerm) return this.getAllLetters();

    return this.getAllLetters().filter(letter => {
      return letter.text.toLowerCase().includes(searchTerm) ||
             letter.metadata.tags.some(tag => 
               tag.toLowerCase().includes(searchTerm)
             );
    });
  }

  /**
   * Process letter statuses and update accordingly
   * @returns {Array} Updated letters array
   */
  async processLetterStatuses() {
    const letters = this.getAllLetters();
    const now = new Date();

    for (const letter of letters) {
      try {
        // Check if scheduled letters should start transit
        if (letter.status === LETTER_STATUS.SCHEDULED) {
          const scheduledTime = new Date(letter.scheduledAt);
          if (now >= scheduledTime) {
            await this.startTransit(letter.id);
          }
        }

        // Update in-transit letters
        if (letter.status === LETTER_STATUS.IN_TRANSIT) {
          const flightProgress = this.getFlightProgress(letter.senderFlight, letter.recipientFlight);
          if (flightProgress !== null) {
            const position = this.interpolateLetterPosition(letter, flightProgress);
            await this.updateLetterProgress(letter.id, flightProgress, position);
          }
        }
      } catch (error) {
        console.error(`Error processing letter ${letter.id}:`, error);
        // Mark letter as failed if too many errors
        if (letter.errorCount > 3) {
          letter.status = LETTER_STATUS.FAILED;
          this.addTrackingEntry(letter, 'Delivery failed due to system errors');
        }
        letter.errorCount = (letter.errorCount || 0) + 1;
      }
    }

    await this.saveToStorage();
    return this.getAllLetters();
  }

  /**
   * Start tracking system
   */
  startTracking() {
    if (this.trackingInterval) return;

    this.trackingInterval = setInterval(async () => {
      try {
        await this.processLetterStatuses();
      } catch (error) {
        console.error('Error in letter tracking interval:', error);
      }
    }, 2000); // Update every 2 seconds
  }

  /**
   * Stop tracking system
   */
  stopTracking() {
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = null;
    }
  }

  /**
   * Add tracking entry to letter history
   * @param {Object} letter - Letter object
   * @param {string} message - Tracking message
   */
  addTrackingEntry(letter, message) {
    letter.trackingHistory.push({
      timestamp: new Date().toISOString(),
      message,
      position: letter.currentPosition ? { ...letter.currentPosition } : null,
      progress: letter.progress
    });

    // Keep only last 50 entries to prevent memory bloat
    if (letter.trackingHistory.length > 50) {
      letter.trackingHistory = letter.trackingHistory.slice(-50);
    }
  }

  /**
   * Calculate estimated delivery time
   * @param {Object} letter - Letter object
   * @returns {string} Estimated delivery time
   */
  calculateEstimatedDelivery(letter) {
    // Mock calculation - in real app, use flight data
    const now = new Date();
    const deliveryTime = new Date(now.getTime() + (Math.random() * 3 + 1) * 60 * 60 * 1000);
    return deliveryTime.toISOString();
  }

  /**
   * Get flight position (mock implementation)
   * @param {string} flightId - Flight ID
   * @returns {Object|null} Flight position
   */
  getFlightPosition(flightId) {
    // Mock implementation - in real app, integrate with flight tracking
    return {
      latitude: 12.9716 + Math.random() * 10,
      longitude: 77.5946 + Math.random() * 10
    };
  }

  /**
   * Get flight progress (mock implementation)
   * @param {string} senderFlightId - Sender flight ID
   * @param {string} recipientFlightId - Recipient flight ID
   * @returns {number|null} Flight progress (0-1)
   */
  getFlightProgress(senderFlightId, recipientFlightId) {
    // Mock implementation - return random progress
    return Math.min(1, Math.random() * 1.2);
  }

  /**
   * Interpolate letter position between flights
   * @param {Object} letter - Letter object
   * @param {number} progress - Flight progress
   * @returns {Object} Letter position
   */
  interpolateLetterPosition(letter, progress) {
    const senderPos = this.getFlightPosition(letter.senderFlight);
    const recipientPos = this.getFlightPosition(letter.recipientFlight);

    if (!senderPos || !recipientPos) return null;

    return {
      latitude: senderPos.latitude + (recipientPos.latitude - senderPos.latitude) * progress,
      longitude: senderPos.longitude + (recipientPos.longitude - senderPos.longitude) * progress
    };
  }

  /**
   * Check if tracking entry should be added
   * @param {number} oldProgress - Previous progress
   * @param {number} newProgress - New progress
   * @returns {boolean} Should add entry
   */
  shouldAddTrackingEntry(oldProgress, newProgress) {
    const milestones = [0.25, 0.5, 0.75, 1.0];
    return milestones.some(milestone => 
      oldProgress < milestone && newProgress >= milestone
    );
  }

  /**
   * Get progress milestone description
   * @param {number} progress - Progress value
   * @returns {string} Milestone description
   */
  getProgressMilestone(progress) {
    if (progress >= 1.0) return 'reached destination';
    if (progress >= 0.75) return 'approaching destination';
    if (progress >= 0.5) return 'halfway to destination';
    if (progress >= 0.25) return 'cleared departure area';
    return 'departed';
  }

  /**
   * Generate unique ID
   * @returns {string} Unique identifier
   */
  generateId() {
    return `letter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Save data to storage
   */
  async saveToStorage() {
    try {
      const data = {
        letters: Array.from(this.letters.entries()),
        lastUpdated: new Date().toISOString()
      };
      await AsyncStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save letters to storage:', error);
    }
  }

  /**
   * Load data from storage
   */
  async loadFromStorage() {
    try {
      const data = await AsyncStorage.getItem(this.storageKey);
      if (data) {
        const parsed = JSON.parse(data);
        this.letters = new Map(parsed.letters || []);
      }
    } catch (error) {
      console.error('Failed to load letters from storage:', error);
    }
  }

  /**
   * Add event listener
   * @param {Function} listener - Event listener function
   */
  addListener(listener) {
    this.listeners.add(listener);
  }

  /**
   * Remove event listener
   * @param {Function} listener - Event listener function
   */
  removeListener(listener) {
    this.listeners.delete(listener);
  }

  /**
   * Notify all listeners
   * @param {string} event - Event type
   * @param {*} data - Event data
   */
  notifyListeners(event, data) {
    this.listeners.forEach(listener => {
      try {
        listener(event, data);
      } catch (error) {
        console.error('Error in letter tracking listener:', error);
      }
    });
  }

  /**
   * Get letter statistics
   * @returns {Object} Letter statistics
   */
  getStatistics() {
    const letters = this.getAllLetters();
    
    return {
      total: letters.length,
      byStatus: {
        draft: letters.filter(l => l.status === LETTER_STATUS.DRAFT).length,
        scheduled: letters.filter(l => l.status === LETTER_STATUS.SCHEDULED).length,
        inTransit: letters.filter(l => l.status === LETTER_STATUS.IN_TRANSIT).length,
        delivered: letters.filter(l => l.status === LETTER_STATUS.DELIVERED).length,
        read: letters.filter(l => l.status === LETTER_STATUS.READ).length,
        failed: letters.filter(l => l.status === LETTER_STATUS.FAILED).length
      },
      byPriority: {
        low: letters.filter(l => l.priority === LETTER_PRIORITY.LOW).length,
        normal: letters.filter(l => l.priority === LETTER_PRIORITY.NORMAL).length,
        high: letters.filter(l => l.priority === LETTER_PRIORITY.HIGH).length,
        urgent: letters.filter(l => l.priority === LETTER_PRIORITY.URGENT).length
      },
      averageDeliveryTime: this.calculateAverageDeliveryTime(letters),
      successRate: this.calculateSuccessRate(letters)
    };
  }

  /**
   * Calculate average delivery time
   * @param {Array} letters - Array of letters
   * @returns {number} Average delivery time in minutes
   */
  calculateAverageDeliveryTime(letters) {
    const deliveredLetters = letters.filter(l => l.deliveredAt && l.scheduledAt);
    if (deliveredLetters.length === 0) return 0;

    const totalTime = deliveredLetters.reduce((sum, letter) => {
      const scheduled = new Date(letter.scheduledAt);
      const delivered = new Date(letter.deliveredAt);
      return sum + (delivered - scheduled);
    }, 0);

    return Math.round(totalTime / deliveredLetters.length / 60000); // Convert to minutes
  }

  /**
   * Calculate success rate
   * @param {Array} letters - Array of letters
   * @returns {number} Success rate (0-1)
   */
  calculateSuccessRate(letters) {
    const completedLetters = letters.filter(l => 
      [LETTER_STATUS.DELIVERED, LETTER_STATUS.READ, LETTER_STATUS.FAILED].includes(l.status)
    );
    
    if (completedLetters.length === 0) return 1;

    const successfulLetters = completedLetters.filter(l => l.status !== LETTER_STATUS.FAILED);
    return successfulLetters.length / completedLetters.length;
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.stopTracking();
    this.letters.clear();
    this.listeners.clear();
  }
}

// Singleton instance
const letterTrackingSystem = new LetterTrackingSystem();

// Export functions for compatibility with existing code
export const processLetterStatuses = () => letterTrackingSystem.processLetterStatuses();
export const getLetters = () => letterTrackingSystem.getAllLetters();
export const markLetterAsRead = (letterId) => letterTrackingSystem.markLetterAsRead(letterId);

export default letterTrackingSystem;
export { LetterTrackingSystem };