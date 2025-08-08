// src/screens/HomeScreen.js
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import theme from '../theme';

export default function HomeScreen({ navigation }) {
  return (
    <View style={styles.page}>
      <Text style={styles.title}>AirLetters ✈️</Text>
      <Text style={styles.subtitle}>Share mid-flight letters — simulated offline</Text>

      <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('FlightSetup')}>
        <Text style={styles.cardTitle}>✈️ Flight Setup</Text>
        <Text style={styles.cardSubtitle}>Enter both flights to simulate</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Compose')}>
        <Text style={styles.cardTitle}>✉️ Compose Letter</Text>
        <Text style={styles.cardSubtitle}>Write a timed message</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Map')}>
        <Text style={styles.cardTitle}>🗺️ Simulation Map</Text>
        <Text style={styles.cardSubtitle}>View flight progress & in-transit letters</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Vault')}>
        <Text style={styles.cardTitle}>💼 Boarding Pass Vault</Text>
        <Text style={styles.cardSubtitle}>Store PDFs & images offline</Text>
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
    marginBottom: 20,
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
