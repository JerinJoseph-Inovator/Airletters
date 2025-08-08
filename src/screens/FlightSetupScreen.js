// src/screens/FlightSetupScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, Alert, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import theme from '../theme';
import { DateTime } from 'luxon';
import defaultFlights from '../lib/defaultFlights';

const STORAGE_KEY = '@airletters_flights';

const blankFlight = { flightNumber: '', origin: '', destination: '', departureUTC: '', arrivalUTC: '' };

export default function FlightSetupScreen({ navigation }) {
  const [flightA, setFlightA] = useState({ ...blankFlight });
  const [flightB, setFlightB] = useState({ ...blankFlight });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const obj = JSON.parse(raw);
          if (obj?.flightA && obj?.flightB) {
            setFlightA(obj.flightA);
            setFlightB(obj.flightB);
          } else {
            // No valid saved data → set defaults
            setFlightA(defaultFlights.flightA);
            setFlightB(defaultFlights.flightB);
          }
        } else {
          // First run → set defaults and save
          setFlightA(defaultFlights.flightA);
          setFlightB(defaultFlights.flightB);
          const payload = { flightA: defaultFlights.flightA, flightB: defaultFlights.flightB, updatedAt: new Date().toISOString() };
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        }
      } catch (e) {
        console.warn('Failed to load flights', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const saveAndGo = async () => {
    if (!flightA.departureUTC || !flightA.arrivalUTC || !flightB.departureUTC || !flightB.arrivalUTC) {
      Alert.alert('Please enter departure and arrival times (ISO format)', 'Example: 2025-08-08T10:00:00Z');
      return;
    }

    try {
      const dA = DateTime.fromISO(flightA.departureUTC);
      const aA = DateTime.fromISO(flightA.arrivalUTC);
      if (!dA.isValid || !aA.isValid || aA <= dA) {
        Alert.alert('Flight A times invalid', 'Check departure and arrival times (ISO UTC).');
        return;
      }
      const dB = DateTime.fromISO(flightB.departureUTC);
      const aB = DateTime.fromISO(flightB.arrivalUTC);
      if (!dB.isValid || !aB.isValid || aB <= dB) {
        Alert.alert('Flight B times invalid', 'Check departure and arrival times (ISO UTC).');
        return;
      }
    } catch (e) {
      Alert.alert('Time parse error', e.message);
      return;
    }

    const payload = { flightA, flightB, updatedAt: new Date().toISOString() };
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      navigation.navigate('Map', { flightA, flightB });
    } catch (e) {
      Alert.alert('Save failed', 'Could not save flights locally.');
      console.warn(e);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <Text>Loading…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={{ paddingBottom: 60 }}>
      <Text style={styles.heading}>Flight A</Text>
      <TextInput style={styles.input} placeholder="Flight number" value={flightA.flightNumber} onChangeText={t => setFlightA({ ...flightA, flightNumber: t })} />
      <TextInput style={styles.input} placeholder="Origin" value={flightA.origin} onChangeText={t => setFlightA({ ...flightA, origin: t })} />
      <TextInput style={styles.input} placeholder="Destination" value={flightA.destination} onChangeText={t => setFlightA({ ...flightA, destination: t })} />
      <TextInput style={styles.input} placeholder="Departure UTC (ISO)" value={flightA.departureUTC} onChangeText={t => setFlightA({ ...flightA, departureUTC: t })} />
      <TextInput style={styles.input} placeholder="Arrival UTC (ISO)" value={flightA.arrivalUTC} onChangeText={t => setFlightA({ ...flightA, arrivalUTC: t })} />

      <Text style={styles.heading}>Flight B</Text>
      <TextInput style={styles.input} placeholder="Flight number" value={flightB.flightNumber} onChangeText={t => setFlightB({ ...flightB, flightNumber: t })} />
      <TextInput style={styles.input} placeholder="Origin" value={flightB.origin} onChangeText={t => setFlightB({ ...flightB, origin: t })} />
      <TextInput style={styles.input} placeholder="Destination" value={flightB.destination} onChangeText={t => setFlightB({ ...flightB, destination: t })} />
      <TextInput style={styles.input} placeholder="Departure UTC (ISO)" value={flightB.departureUTC} onChangeText={t => setFlightB({ ...flightB, departureUTC: t })} />
      <TextInput style={styles.input} placeholder="Arrival UTC (ISO)" value={flightB.arrivalUTC} onChangeText={t => setFlightB({ ...flightB, arrivalUTC: t })} />

      <View style={{ marginTop: 16 }}>
        <Button title="Save & Open Map" onPress={saveAndGo} />
      </View>

      <View style={{ marginTop: 12 }}>
        <Button title="Back to Home" color={theme.colors.muted} onPress={() => navigation.goBack()} />
      </View>
    </ScrollView>
  );
}

const styles = {
  page: {
    flex: 1,
    padding: theme.spacing.page,
    backgroundColor: theme.colors.background,
  },
  heading: {
    marginTop: 12,
    marginBottom: 8,
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: theme.colors.card,
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
};
