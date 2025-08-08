// src/screens/MapScreen.js
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import theme from '../theme';
import defaultFlights from '../lib/defaultFlights';
import { flightProgressPercent } from '../lib/simulation';

export default function MapScreen({ route }) {
  // Fallback to defaults if no params passed
  const flightA = route?.params?.flightA || defaultFlights.flightA;
  const flightB = route?.params?.flightB || defaultFlights.flightB;

  const [progressA, setProgressA] = useState(0);
  const [progressB, setProgressB] = useState(0);

  // Dummy coordinates for now (replace with geocoded values)
  const coordsA = [
    { latitude: 12.9716, longitude: 77.5946 }, // BLR
    { latitude: 30.7333, longitude: 76.7794 }, // IXC
  ];
  const coordsB = [
    { latitude: 12.9716, longitude: 77.5946 }, // BLR
    { latitude: 19.0760, longitude: 72.8777 }, // BOM
  ];

  useEffect(() => {
    const updateProgress = () => {
      setProgressA(flightProgressPercent(flightA.departureUTC, flightA.arrivalUTC));
      setProgressB(flightProgressPercent(flightB.departureUTC, flightB.arrivalUTC));
    };
    updateProgress(); // run immediately
    const timer = setInterval(updateProgress, 1000);
    return () => clearInterval(timer);
  }, [flightA, flightB]);

  const interpolate = (start, end, fraction) => ({
    latitude: start.latitude + (end.latitude - start.latitude) * fraction,
    longitude: start.longitude + (end.longitude - start.longitude) * fraction,
  });

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
        <Polyline coordinates={coordsA} strokeColor="blue" strokeWidth={2} />
        <Marker coordinate={interpolate(coordsA[0], coordsA[1], progressA)} title={flightA.flightNumber}>
          <Text style={{ fontSize: 24 }}>✈️</Text>
        </Marker>

        {/* Flight B route */}
        <Polyline coordinates={coordsB} strokeColor="red" strokeWidth={2} />
        <Marker coordinate={interpolate(coordsB[0], coordsB[1], progressB)} title={flightB.flightNumber}>
          <Text style={{ fontSize: 24 }}>🛫</Text>
        </Marker>
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
});
