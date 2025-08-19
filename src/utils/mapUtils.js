// src/utils/mapUtils.js

import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {Object} coord1 - {latitude, longitude}
 * @param {Object} coord2 - {latitude, longitude}
 * @returns {number} Distance in kilometers
 */
export const calculateDistance = (coord1, coord2) => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(coord2.latitude - coord1.latitude);
  const dLon = toRadians(coord2.longitude - coord1.longitude);
  
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRadians(coord1.latitude)) * Math.cos(toRadians(coord2.latitude)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

/**
 * Convert degrees to radians
 * @param {number} degrees 
 * @returns {number} Radians
 */
const toRadians = (degrees) => {
  return degrees * (Math.PI / 180);
};

/**
 * Calculate bearing between two coordinates
 * @param {Object} coord1 - {latitude, longitude}
 * @param {Object} coord2 - {latitude, longitude}
 * @returns {number} Bearing in degrees
 */
export const calculateBearing = (coord1, coord2) => {
  const dLon = toRadians(coord2.longitude - coord1.longitude);
  const lat1 = toRadians(coord1.latitude);
  const lat2 = toRadians(coord2.latitude);
  
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  
  let bearing = Math.atan2(y, x);
  bearing = (bearing * 180 / Math.PI + 360) % 360;
  
  return bearing;
};

/**
 * Generate smooth flight path with realistic waypoints
 * @param {Object} start - Starting coordinate
 * @param {Object} end - Ending coordinate
 * @param {number} waypoints - Number of intermediate waypoints
 * @returns {Array} Array of coordinates
 */
export const generateFlightPath = (start, end, waypoints = 3) => {
  const path = [start];
  
  for (let i = 1; i <= waypoints; i++) {
    const ratio = i / (waypoints + 1);
    const lat = start.latitude + (end.latitude - start.latitude) * ratio;
    const lon = start.longitude + (end.longitude - start.longitude) * ratio;
    
    // Add slight curve for realistic flight path
    const curvature = Math.sin(ratio * Math.PI) * 0.5;
    
    path.push({
      latitude: lat + curvature,
      longitude: lon,
      name: `Waypoint ${i}`,
      type: 'waypoint'
    });
  }
  
  path.push(end);
  return path;
};

/**
 * Calculate optimal map region to fit all coordinates
 * @param {Array} coordinates - Array of coordinate objects
 * @param {number} padding - Padding factor (default: 0.1)
 * @returns {Object} Map region object
 */
export const getOptimalMapRegion = (coordinates, padding = 0.1) => {
  if (!coordinates || coordinates.length === 0) {
    return {
      latitude: 0,
      longitude: 0,
      latitudeDelta: 10,
      longitudeDelta: 10,
    };
  }

  let minLat = coordinates[0].latitude;
  let maxLat = coordinates[0].latitude;
  let minLon = coordinates[0].longitude;
  let maxLon = coordinates[0].longitude;

  coordinates.forEach(coord => {
    minLat = Math.min(minLat, coord.latitude);
    maxLat = Math.max(maxLat, coord.latitude);
    minLon = Math.min(minLon, coord.longitude);
    maxLon = Math.max(maxLon, coord.longitude);
  });

  const latDelta = (maxLat - minLat) * (1 + padding);
  const lonDelta = (maxLon - minLon) * (1 + padding);

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLon + maxLon) / 2,
    latitudeDelta: Math.max(latDelta, 0.1),
    longitudeDelta: Math.max(lonDelta, 0.1),
  };
};

/**
 * Validate coordinate object
 * @param {Object} coord - Coordinate to validate
 * @returns {boolean} True if valid
 */
export const isValidCoordinate = (coord) => {
  return coord && 
         typeof coord.latitude === 'number' && 
         typeof coord.longitude === 'number' &&
         coord.latitude >= -90 && coord.latitude <= 90 &&
         coord.longitude >= -180 && coord.longitude <= 180;
};

/**
 * Format coordinate for display
 * @param {Object} coord - Coordinate object
 * @returns {string} Formatted coordinate string
 */
export const formatCoordinate = (coord) => {
  if (!isValidCoordinate(coord)) return 'Invalid coordinates';
  
  const lat = Math.abs(coord.latitude).toFixed(4);
  const lon = Math.abs(coord.longitude).toFixed(4);
  const latDir = coord.latitude >= 0 ? 'N' : 'S';
  const lonDir = coord.longitude >= 0 ? 'E' : 'W';
  
  return `${lat}°${latDir}, ${lon}°${lonDir}`;
};

/**
 * Calculate estimated flight time based on distance
 * @param {number} distance - Distance in kilometers
 * @param {number} speed - Average speed in km/h (default: 800)
 * @returns {number} Time in minutes
 */
export const calculateFlightTime = (distance, speed = 800) => {
  return Math.round((distance / speed) * 60);
};

/**
 * Get map style configuration
 * @param {string} style - Map style name
 * @returns {Object} Style configuration
 */
export const getMapStyleConfig = (style) => {
  const styles = {
    standard: {
      mapType: 'standard',
      showsBuildings: true,
      showsTraffic: false,
      showsPointsOfInterest: false,
    },
    satellite: {
      mapType: 'satellite',
      showsBuildings: false,
      showsTraffic: false,
      showsPointsOfInterest: false,
    },
    hybrid: {
      mapType: 'hybrid',
      showsBuildings: true,
      showsTraffic: false,
      showsPointsOfInterest: true,
    },
    terrain: {
      mapType: 'terrain',
      showsBuildings: false,
      showsTraffic: false,
      showsPointsOfInterest: true,
    }
  };
  
  return styles[style] || styles.standard;
};

/**
 * Debounce function for performance optimization
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Throttle function for performance optimization
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} Throttled function
 */
export const throttle = (func, limit) => {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

/**
 * Generate random coordinate within bounds
 * @param {Object} bounds - {minLat, maxLat, minLon, maxLon}
 * @returns {Object} Random coordinate
 */
export const generateRandomCoordinate = (bounds) => {
  const { minLat, maxLat, minLon, maxLon } = bounds;
  
  return {
    latitude: minLat + Math.random() * (maxLat - minLat),
    longitude: minLon + Math.random() * (maxLon - minLon)
  };
};

/**
 * Check if coordinate is within bounds
 * @param {Object} coord - Coordinate to check
 * @param {Object} bounds - Boundary object
 * @returns {boolean} True if within bounds
 */
export const isCoordinateInBounds = (coord, bounds) => {
  const { minLat, maxLat, minLon, maxLon } = bounds;
  
  return coord.latitude >= minLat && 
         coord.latitude <= maxLat && 
         coord.longitude >= minLon && 
         coord.longitude <= maxLon;
};

/**
 * Convert screen coordinates to map coordinates
 * @param {Object} screenPoint - {x, y}
 * @param {Object} mapRegion - Current map region
 * @returns {Object} Map coordinate
 */
export const screenToMapCoordinate = (screenPoint, mapRegion) => {
  const { x, y } = screenPoint;
  const { latitude, longitude, latitudeDelta, longitudeDelta } = mapRegion;
  
  const lat = latitude + (0.5 - y / height) * latitudeDelta;
  const lon = longitude + (x / width - 0.5) * longitudeDelta;
  
  return { latitude: lat, longitude: lon };
};

/**
 * Create animation sequence for smooth transitions
 * @param {Array} keyframes - Array of animation keyframes
 * @param {number} duration - Total duration in milliseconds
 * @returns {Object} Animation configuration
 */
export const createAnimationSequence = (keyframes, duration) => {
  const totalFrames = keyframes.length;
  const frameDuration = duration / totalFrames;
  
  return keyframes.map((keyframe, index) => ({
    ...keyframe,
    delay: index * frameDuration,
    duration: frameDuration
  }));
};

export default {
  calculateDistance,
  calculateBearing,
  generateFlightPath,
  getOptimalMapRegion,
  isValidCoordinate,
  formatCoordinate,
  calculateFlightTime,
  getMapStyleConfig,
  debounce,
  throttle,
  generateRandomCoordinate,
  isCoordinateInBounds,
  screenToMapCoordinate,
  createAnimationSequence
};