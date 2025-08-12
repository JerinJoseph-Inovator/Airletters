// src/screens/HomeScreen.js
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import theme from '../theme';
import { generateTestFlights, getMidFlightTest } from '../lib/testFlights';

export default function HomeScreen({ navigation }) {
  
  const startTestSimulation = (testType) => {
    let testFlights;
    let message;
    
    if (testType === 'mid-flight') {
      testFlights = getMidFlightTest();
      message = 'Starting mid-flight simulation (both flights 50% complete)';
    } else {
      testFlights = generateTestFlights();
      message = 'Starting test simulation (Flight A started 30min ago, Flight B started 20min ago)';
    }
    
    Alert.alert(
      'Test Mode Activated! 🧪',
      message,
      [
        {
          text: 'Go to Map',
          onPress: () => navigation.navigate('Map', testFlights)
        }
      ]
    );
  };

  return (
    <View style={styles.page}>
      <Text style={styles.title}>AirLetters ✈️</Text>
      <Text style={styles.subtitle}>Share mid-flight letters — simulated offline</Text>

      {/* Test Mode Section */}
      {/* <View style={styles.testSection}>
        <Text style={styles.testTitle}>🧪 Test Mode</Text>
        <TouchableOpacity 
          style={[styles.card, styles.testCard]} 
          onPress={() => startTestSimulation('beginning')}
        >
          <Text style={styles.cardTitle}>🚀 Start Fresh Test</Text>
          <Text style={styles.cardSubtitle}>Flight A: 30min in progress, Flight B: 20min in progress</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.card, styles.testCard]} 
          onPress={() => startTestSimulation('mid-flight')}
        >
          <Text style={styles.cardTitle}>⚡ Mid-Flight Test</Text>
          <Text style={styles.cardSubtitle}>Both flights 50% complete - perfect for letter testing</Text>
        </TouchableOpacity>
      </View> */}

      {/* Regular Navigation */}
      <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('FlightSetup')}>
        <Text style={styles.cardTitle}>✈️ Flight Setup</Text>
        <Text style={styles.cardSubtitle}>Enter both flights to simulate</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Compose')}>
        <Text style={styles.cardTitle}>✉️ Compose Letter</Text>
        <Text style={styles.cardSubtitle}>Write a timed message</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Letters')}>
        <Text style={styles.cardTitle}>📬 Letter History</Text>
        <Text style={styles.cardSubtitle}>View all sent & received letters</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Map')}>
        <Text style={styles.cardTitle}>🗺️ Simulation Map</Text>
        <Text style={styles.cardSubtitle}>View flight progress & in-transit letters</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Vault')}>
        <Text style={styles.cardTitle}>💼 Boarding Pass Vault</Text>
        <Text style={styles.cardSubtitle}>Store PDFs & images offline</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('SyncStatus')}>
  <Text style={styles.cardTitle}>🔄 Sync Status</Text>
  <Text style={styles.cardSubtitle}>Monitor offline/online sync</Text>
</TouchableOpacity>

    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    padding: theme.spacing.page,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: 8,
  },
  subtitle: {
    color: theme.colors.muted,
    marginBottom: 16,
  },
  testSection: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#FEF3C7',
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  testTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 12,
  },
  testCard: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#F59E0B',
    marginBottom: 8,
  },
  card: {
    backgroundColor: theme.colors.card,
    padding: 16,
    borderRadius: theme.radius.card,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
  },
  cardSubtitle: {
    color: theme.colors.muted,
    marginTop: 4,
    fontSize: 13,
  },
});