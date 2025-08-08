// src/screens/MapScreen.js
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Alert } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import theme from '../theme';
import defaultFlights from '../lib/defaultFlights';
import { flightProgressPercent } from '../lib/simulation';
import { processLetterStatuses, getLetters, markLetterAsRead, LETTER_STATUS } from '../lib/storage';

export default function MapScreen({ route, navigation }) {
  const flightA = route?.params?.flightA || defaultFlights.flightA;
  const flightB = route?.params?.flightB || defaultFlights.flightB;

  const [progressA, setProgressA] = useState(0);
  const [progressB, setProgressB] = useState(0);
  const [letters, setLetters] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Dummy coordinates (replace with actual geocoding)
  const coordsA = [
    { latitude: 12.9716, longitude: 77.5946 }, // BLR
    { latitude: 30.7333, longitude: 76.7794 }, // IXC
  ];
  const coordsB = [
    { latitude: 12.9716, longitude: 77.5946 }, // BLR  
    { latitude: 19.0760, longitude: 72.8777 }, // BOM
  ];

  useEffect(() => {
    const updateData = async () => {
      // Update flight progress
      setProgressA(flightProgressPercent(flightA.departureUTC, flightA.arrivalUTC));
      setProgressB(flightProgressPercent(flightB.departureUTC, flightB.arrivalUTC));
      
      // Process and update letter statuses
      const updatedLetters = await processLetterStatuses();
      setLetters(updatedLetters);
      
      // Count unread delivered letters
      const unread = updatedLetters.filter(
        l => l.status === LETTER_STATUS.DELIVERED
      ).length;
      setUnreadCount(unread);
    };

    updateData(); // Run immediately
    const timer = setInterval(updateData, 1000); // Update every second
    return () => clearInterval(timer);
  }, [flightA, flightB]);

  const interpolate = (start, end, fraction) => ({
    latitude: start.latitude + (end.latitude - start.latitude) * fraction,
    longitude: start.longitude + (end.longitude - start.longitude) * fraction,
  });

  const handleLetterPress = async (letter) => {
    if (letter.status === LETTER_STATUS.DELIVERED) {
      Alert.alert(
        'Letter from Fellow Traveler ✉️',
        letter.text,
        [
          {
            text: 'Mark as Read',
            onPress: async () => {
              await markLetterAsRead(letter.id);
              // Refresh letters to update UI
              const updatedLetters = await processLetterStatuses();
              setLetters(updatedLetters);
              const unread = updatedLetters.filter(l => l.status === LETTER_STATUS.DELIVERED).length;
              setUnreadCount(unread);
            }
          }
        ]
      );
    } else if (letter.status === LETTER_STATUS.IN_TRANSIT) {
      Alert.alert('Letter In Transit 📮', 'This letter is still traveling...');
    } else {
      Alert.alert('Letter Scheduled ⏰', 'This letter hasn\'t started its journey yet.');
    }
  };

  const renderLetterMarkers = () => {
    return letters.map(letter => {
      if (letter.status === LETTER_STATUS.SCHEDULED) {
        return null; // Don't show scheduled letters on map
      }

      let letterPosition;
      let emoji = '📮'; // default
      
      if (letter.status === LETTER_STATUS.IN_TRANSIT) {
        // Animate letter between the two flights
        const progress = letter.animationProgress || 0;
        const flightAPos = interpolate(coordsA[0], coordsA[1], progressA);
        const flightBPos = interpolate(coordsB[0], coordsB[1], progressB);
        letterPosition = interpolate(flightAPos, flightBPos, progress);
        emoji = '✉️'; // in transit
      } else if (letter.status === LETTER_STATUS.DELIVERED) {
        // Show at recipient flight position
        letterPosition = interpolate(coordsB[0], coordsB[1], progressB);
        emoji = '📬'; // delivered
      } else if (letter.status === LETTER_STATUS.READ) {
        letterPosition = interpolate(coordsB[0], coordsB[1], progressB);
        emoji = '📭'; // read/empty
      }

      if (!letterPosition) return null;

      return (
        <Marker
          key={letter.id}
          coordinate={letterPosition}
          onPress={() => handleLetterPress(letter)}
        >
          <Text style={{ fontSize: 20 }}>{emoji}</Text>
        </Marker>
      );
    });
  };

  return (
    <View style={styles.container}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={{
          latitude: 19,
          longitude: 78,
          latitudeDelta: 15,
          longitudeDelta: 15,
        }}
      >
        {/* Flight A route */}
        <Polyline coordinates={coordsA} strokeColor="#4F46E5" strokeWidth={3} />
        <Marker 
          coordinate={interpolate(coordsA[0], coordsA[1], progressA)} 
          title={`${flightA.flightNumber} - ${Math.round(progressA * 100)}%`}
        >
          <Text style={{ fontSize: 24 }}>✈️</Text>
        </Marker>

        {/* Flight B route */}
        <Polyline coordinates={coordsB} strokeColor="#F59E0B" strokeWidth={3} />
        <Marker 
          coordinate={interpolate(coordsB[0], coordsB[1], progressB)} 
          title={`${flightB.flightNumber} - ${Math.round(progressB * 100)}%`}
        >
          <Text style={{ fontSize: 24 }}>🛫</Text>
        </Marker>

        {/* Letter markers */}
        {renderLetterMarkers()}
      </MapView>

      {/* Status overlay */}
      <View style={styles.statusOverlay}>
        <View style={styles.flightStatus}>
          <Text style={styles.flightText}>
            {flightA.flightNumber}: {Math.round(progressA * 100)}%
          </Text>
          <Text style={styles.flightText}>
            {flightB.flightNumber}: {Math.round(progressB * 100)}%
          </Text>
        </View>
        
        {letters.length > 0 && (
          <View style={styles.letterStatus}>
            <Text style={styles.letterText}>
              Letters: {letters.length} total
            </Text>
            <Text style={styles.letterCounts}>
              📮 {letters.filter(l => l.status === LETTER_STATUS.IN_TRANSIT).length} traveling
            </Text>
            <Text style={styles.letterCounts}>
              📬 {letters.filter(l => l.status === LETTER_STATUS.DELIVERED).length} delivered
            </Text>
          </View>
        )}
      </View>

      {/* Unread notification */}
      {unreadCount > 0 && (
        <TouchableOpacity style={styles.unreadBadge}>
          <Text style={styles.unreadText}>
            {unreadCount} new letter{unreadCount > 1 ? 's' : ''}! 📬
          </Text>
        </TouchableOpacity>
      )}

      {/* Floating action button */}
      <TouchableOpacity 
        style={styles.fab}
        onPress={() => navigation.navigate('Compose')}
      >
        <Text style={styles.fabText}>✏️</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  statusOverlay: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: theme.radius.card,
    padding: 12,
  },
  flightStatus: {
    marginBottom: 8,
  },
  flightText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  letterStatus: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 8,
  },
  letterText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  letterCounts: {
    fontSize: 12,
    color: theme.colors.muted,
  },
  unreadBadge: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    backgroundColor: theme.colors.accent,
    padding: 12,
    borderRadius: theme.radius.card,
    alignItems: 'center',
  },
  unreadText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabText: {
    fontSize: 24,
  },
});