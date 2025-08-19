// src/lib/flightSimulation.js

import { calculateDistance, calculateBearing } from '../utils/mapUtils';

/**
 * Flight simulation engine for realistic flight tracking
 */
class FlightSimulation {
  constructor() {
    this.flights = new Map();
    this.updateInterval = null;
    this.listeners = new Set();
  }

  /**
   * Add flight to simulation
   * @param {Object} flight - Flight object
   */
  addFlight(flight) {
    const flightData = {
      ...flight,
      currentPosition: null,
      progress: 0,
      altitude: 0,
      speed: 0,
      bearing: 0,
      status: 'SCHEDULED',
      lastUpdate: Date.now()
    };

    this.flights.set(flight.id, flightData);
    this.notifyListeners('flightAdded', flightData);
  }

  /**
   * Remove flight from simulation
   * @param {string} flightId - Flight ID
   */
  removeFlight(flightId) {
    const flight = this.flights.get(flightId);
    if (flight) {
      this.flights.delete(flightId);
      this.notifyListeners('flightRemoved', flight);
    }
  }

  /**
   * Start simulation
   */
  start() {
    if (this.updateInterval) return;

    this.updateInterval = setInterval(() => {
      this.updateFlights();
    }, 1000); // Update every second

    this.notifyListeners('simulationStarted');
  }

  /**
   * Stop simulation
   */
  stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    this.notifyListeners('simulationStopped');
  }

  /**
   * Update all flights
   */
  updateFlights() {
    const now = Date.now();

    for (const [flightId, flight] of this.flights) {
      const updatedFlight = this.updateFlightData(flight, now);
      this.flights.set(flightId, updatedFlight);
    }

    this.notifyListeners('flightsUpdated', Array.from(this.flights.values()));
  }

  /**
   * Update individual flight data
   * @param {Object} flight - Flight object
   * @param {number} currentTime - Current timestamp
   * @returns {Object} Updated flight object
   */
  updateFlightData(flight, currentTime) {
    const departureTime = new Date(flight.departureUTC).getTime();
    const arrivalTime = new Date(flight.arrivalUTC).getTime();
    const totalFlightTime = arrivalTime - departureTime;
    const elapsedTime = currentTime - departureTime;

    // Calculate progress (0 to 1)
    let progress = Math.max(0, Math.min(1, elapsedTime / totalFlightTime));

    // Determine flight status
    let status = 'SCHEDULED';
    if (currentTime >= departureTime && currentTime <= arrivalTime) {
      status = 'IN_FLIGHT';
    } else if (currentTime > arrivalTime) {
      status = 'ARRIVED';
      progress = 1;
    }

    // Calculate current position
    const currentPosition = this.interpolatePosition(flight.route, progress);

    // Calculate realistic flight parameters
    const altitude = this.calculateAltitude(progress);
    const speed = this.calculateSpeed(progress, flight);
    const bearing = this.calculateFlightBearing(flight.route, progress);

    return {
      ...flight,
      progress,
      currentPosition,
      altitude,
      speed,
      bearing,
      status,
      lastUpdate: currentTime
    };
  }

  /**
   * Interpolate position along flight route
   * @param {Array} route - Array of waypoints
   * @param {number} progress - Flight progress (0-1)
   * @returns {Object} Current position
   */
  interpolatePosition(route, progress) {
    if (!route || route.length === 0) return null;
    if (progress <= 0) return route[0];
    if (progress >= 1) return route[route.length - 1];

    const totalSegments = route.length - 1;
    const segmentIndex = Math.floor(progress * totalSegments);
    const segmentProgress = (progress * totalSegments) - segmentIndex;

    const startPoint = route[segmentIndex];
    const endPoint = route[Math.min(segmentIndex + 1, route.length - 1)];

    // Linear interpolation with smooth curves
    const lat = startPoint.latitude + (endPoint.latitude - startPoint.latitude) * segmentProgress;
    const lon = startPoint.longitude + (endPoint.longitude - startPoint.longitude) * segmentProgress;

    // Add slight curvature for realistic flight path
    const curvature = Math.sin(segmentProgress * Math.PI) * 0.01;

    return {
      latitude: lat + curvature,
      longitude: lon
    };
  }

  /**
   * Calculate realistic altitude based on flight progress
   * @param {number} progress - Flight progress (0-1)
   * @returns {number} Altitude in feet
   */
  calculateAltitude(progress) {
    const maxAltitude = 35000; // Typical cruising altitude
    const takeoffClimbRate = 0.15; // 15% of flight for climb
    const descentRate = 0.15; // 15% of flight for descent

    if (progress <= takeoffClimbRate) {
      // Climbing phase
      return (progress / takeoffClimbRate) * maxAltitude;
    } else if (progress >= (1 - descentRate)) {
      // Descent phase
      const descentProgress = (progress - (1 - descentRate)) / descentRate;
      return maxAltitude * (1 - descentProgress);
    } else {
      // Cruising phase with minor variations
      const variation = Math.sin(progress * Math.PI * 4) * 1000;
      return maxAltitude + variation;
    }
  }

  /**
   * Calculate realistic speed based on flight progress
   * @param {number} progress - Flight progress (0-1)
   * @param {Object} flight - Flight object
   * @returns {number} Speed in km/h
   */
  calculateSpeed(progress, flight) {
    const maxSpeed = 900; // Typical cruising speed
    const takeoffSpeed = 250;
    const landingSpeed = 200;

    if (progress <= 0.1) {
      // Takeoff and initial climb
      return takeoffSpeed + (maxSpeed - takeoffSpeed) * (progress / 0.1);
    } else if (progress >= 0.9) {
      // Descent and landing
      const descentProgress = (progress - 0.9) / 0.1;
      return maxSpeed - (maxSpeed - landingSpeed) * descentProgress;
    } else {
      // Cruising with minor variations
      const variation = Math.sin(progress * Math.PI * 6) * 50;
      return maxSpeed + variation;
    }
  }

  /**
   * Calculate bearing for flight direction
   * @param {Array} route - Flight route
   * @param {number} progress - Flight progress (0-1)
   * @returns {number} Bearing in degrees
   */
  calculateFlightBearing(route, progress) {
    if (!route || route.length < 2) return 0;

    const totalSegments = route.length - 1;
    const segmentIndex = Math.min(Math.floor(progress * totalSegments), totalSegments - 1);

    const startPoint = route[segmentIndex];
    const endPoint = route[segmentIndex + 1] || route[segmentIndex];

    return calculateBearing(startPoint, endPoint);
  }

  /**
   * Get flight by ID
   * @param {string} flightId - Flight ID
   * @returns {Object|null} Flight object or null
   */
  getFlight(flightId) {
    return this.flights.get(flightId) || null;
  }

  /**
   * Get all flights
   * @returns {Array} Array of flight objects
   */
  getAllFlights() {
    return Array.from(this.flights.values());
  }

  /**
   * Get flights by status
   * @param {string} status - Flight status
   * @returns {Array} Array of flight objects
   */
  getFlightsByStatus(status) {
    return this.getAllFlights().filter(flight => flight.status === status);
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
        console.error('Error in flight simulation listener:', error);
      }
    });
  }

  /**
   * Calculate estimated arrival time
   * @param {Object} flight - Flight object
   * @returns {Date} Estimated arrival time
   */
  calculateETA(flight) {
    if (!flight.route || flight.route.length === 0) {
      return new Date(flight.arrivalUTC);
    }

    const currentTime = Date.now();
    const departureTime = new Date(flight.departureUTC).getTime();
    const totalDistance = this.calculateRouteDistance(flight.route);
    const averageSpeed = 800; // km/h

    const estimatedFlightTime = (totalDistance / averageSpeed) * 60 * 60 * 1000; // milliseconds
    return new Date(departureTime + estimatedFlightTime);
  }

  /**
   * Calculate total route distance
   * @param {Array} route - Flight route
   * @returns {number} Total distance in kilometers
   */
  calculateRouteDistance(route) {
    if (!route || route.length < 2) return 0;

    let totalDistance = 0;
    for (let i = 0; i < route.length - 1; i++) {
      totalDistance += calculateDistance(route[i], route[i + 1]);
    }

    return totalDistance;
  }

  /**
   * Generate realistic weather conditions
   * @param {Object} position - Current position
   * @returns {Object} Weather data
   */
  generateWeatherConditions(position) {
    // Mock weather generation - in real app, fetch from weather API
    const conditions = ['Clear', 'Partly Cloudy', 'Cloudy', 'Light Rain', 'Heavy Rain', 'Stormy'];
    const temperatures = [-20, -10, 0, 10, 20, 30];
    const windSpeeds = [5, 10, 15, 20, 25, 30];

    return {
      condition: conditions[Math.floor(Math.random() * conditions.length)],
      temperature: temperatures[Math.floor(Math.random() * temperatures.length)],
      windSpeed: windSpeeds[Math.floor(Math.random() * windSpeeds.length)],
      visibility: Math.random() * 10 + 5, // 5-15 km
      pressure: Math.random() * 100 + 950 // 950-1050 hPa
    };
  }

  /**
   * Check for potential delays
   * @param {Object} flight - Flight object
   * @returns {Object} Delay information
   */
  checkForDelays(flight) {
    const weather = this.generateWeatherConditions(flight.currentPosition);
    let delayMinutes = 0;
    let reason = null;

    // Weather delays
    if (weather.condition === 'Heavy Rain' || weather.condition === 'Stormy') {
      delayMinutes += Math.random() * 30;
      reason = 'Weather conditions';
    }

    // Air traffic delays (random)
    if (Math.random() < 0.1) {
      delayMinutes += Math.random() * 15;
      reason = reason ? `${reason} and air traffic` : 'Air traffic congestion';
    }

    return {
      delayMinutes: Math.round(delayMinutes),
      reason,
      weather
    };
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.stop();
    this.flights.clear();
    this.listeners.clear();
  }
}

// Singleton instance
const flightSimulation = new FlightSimulation();

export default flightSimulation;
export { FlightSimulation };