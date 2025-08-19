// src/screens/MapScreen.js
import React, { useEffect, useState, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  Text, 
  TouchableOpacity, 
  Alert, 
  Animated, 
  Easing,
  Dimensions,
  Platform
} from 'react-native';
import MapView, { Marker, Polyline, AnimatedRegion, UrlTile } from 'react-native-maps';
import { Svg, Polygon as SvgPolygon, G, Text as SvgText } from 'react-native-svg';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import theme from '../theme';
import defaultFlights from '../lib/defaultFlights';
import { flightProgressPercent } from '../lib/simulation';
import { processLetterStatuses, getLetters, markLetterAsRead, clearAllLetters, clearOldLetters, LETTER_STATUS } from '../lib/storage';
import { citiesData } from '../data/citiesData';
import { statesGeoJsonData } from '../data/statesGeoData';

const { width, height } = Dimensions.get('window');

// Enhanced coordinates with more realistic flight paths
const FLIGHT_ROUTES = {
  BLR_IXC: [
    { latitude: 12.9716, longitude: 77.5946, name: 'Bangalore (BLR)' },
    { latitude: 13.5, longitude: 77.8 }, // Waypoint 1
    { latitude: 14.2, longitude: 78.1 }, // Waypoint 2
    { latitude: 15.8, longitude: 77.9 }, // Waypoint 3
    { latitude: 28.5, longitude: 77.2 }, // Delhi approach
    { latitude: 30.7333, longitude: 76.7794, name: 'Chandigarh (IXC)' },
  ],
  BLR_BOM: [
    { latitude: 12.9716, longitude: 77.5946, name: 'Bangalore (BLR)' },
    { latitude: 13.8, longitude: 76.5 }, // Waypoint 1
    { latitude: 15.2, longitude: 75.8 }, // Waypoint 2
    { latitude: 17.1, longitude: 74.9 }, // Waypoint 3
    { latitude: 18.5, longitude: 73.2 }, // Mumbai approach
    { latitude: 19.0760, longitude: 72.8777, name: 'Mumbai (BOM)' },
  ]
};

// Approximate India bounds for offline renderer (lat, lon)
const INDIA_BOUNDS = {
  latMin: 6.5,
  latMax: 35.5,
  lonMin: 68.0,
  lonMax: 97.5,
};

export default function MapScreen({ route, navigation }) {
  const flightA = route?.params?.flightA || defaultFlights.flightA;
  const flightB = route?.params?.flightB || defaultFlights.flightB;

  const [progressA, setProgressA] = useState(0);
  const [progressB, setProgressB] = useState(0);
  const [letters, setLetters] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showWeatherLayer, setShowWeatherLayer] = useState(false);
  const [mapStyle, setMapStyle] = useState('standard');
  const [mapKey, setMapKey] = useState('map-standard');
  const [mapReady, setMapReady] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);
  const [offlineTilesAvailable, setOfflineTilesAvailable] = useState(false);
  const [stateGeoJson, setStateGeoJson] = useState(null);
  const [cities, setCities] = useState(null);
  const [lettersSim, setLettersSim] = useState([]);
  
  // Animation refs
  const mapRef = useRef();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const letterAnimations = useRef(new Map()).current;
  const trailAnimations = useRef(new Map()).current;
  const altitudeAnim = useRef(new Animated.Value(0)).current;
  
  const coordsA = FLIGHT_ROUTES.BLR_IXC;
  const coordsB = FLIGHT_ROUTES.BLR_BOM;

  useEffect(() => {
    startPulseAnimation();
    startAltitudeAnimation();
    
    // Clean up old letter data on component mount
    (async () => {
      try {
        await clearOldLetters(3); // Clear letters older than 3 days
        console.log('Old letter data cleaned up');
      } catch (err) {
        console.warn('Failed to clear old letters:', err);
      }
    })();
    
    // load optional offline overlays and detect preinstalled tiles
    (async () => {
      try {
        // detect if tiles exist in documentDirectory/offline_tiles
        const tilesDir = `${FileSystem.documentDirectory}offline_tiles`;
        const info = await FileSystem.getInfoAsync(tilesDir);
        if (info.exists) setOfflineTilesAvailable(true);

        // Load offline data using imported JavaScript modules
        try {
          setStateGeoJson(statesGeoJsonData);
          console.log('States GeoJSON loaded successfully');
        } catch (err) {
          console.warn('Could not load states GeoJSON:', err);
        }

        try {
          setCities(citiesData);
          console.log('Cities data loaded successfully');
        } catch (err) {
          console.warn('Could not load cities data:', err);
        }
      } catch (err) {
        console.warn('Offline resources check failed', err);
      }
    })();
  }, []);

  // Force MapView re-render when style changes to avoid blank tiles on some devices
  useEffect(() => {
    setMapKey(`map-${mapStyle}-${Date.now()}`);
    setMapReady(false);
    setOfflineMode(false);
  }, [mapStyle]);

  // If MapView doesn't become ready in time, switch to lightweight offline renderer
  useEffect(() => {
    setOfflineMode(false);
    const t = setTimeout(() => {
      if (!mapReady) {
        console.warn('Map did not become ready in time — using offline fallback');
        setOfflineMode(true);
      }
    }, 2500);
    return () => clearTimeout(t);
  }, [mapKey, mapReady]);

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const startAltitudeAnimation = () => {
    Animated.loop(
      Animated.timing(altitudeAnim, {
        toValue: 1,
        duration: 3000,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      })
    ).start();
  };

  useEffect(() => {
    const updateData = async () => {
      // Update flight progress
      const newProgressA = flightProgressPercent(flightA.departureUTC, flightA.arrivalUTC);
      const newProgressB = flightProgressPercent(flightB.departureUTC, flightB.arrivalUTC);

      setProgressA(newProgressA);
      setProgressB(newProgressB);

      // Get actual letters from storage and update their animation progress
      try {
        const storedLetters = await getLetters();
        const now = Date.now();
        
        let updatedLetters = storedLetters.map(letter => {
          if (letter.status !== LETTER_STATUS.IN_TRANSIT) return letter;
          
          // Letter follows its carrying flight's progress
          const letterProgress = letter.fromFlight === 'A' ? newProgressA : newProgressB;
          
          // Letter can only be delivered when BOTH conditions are met:
          // 1. The carrying flight has reached its destination (letter progress >= 1)
          // 2. The receiving flight has also landed at its destination (both flights completed)
          const carryingFlightLanded = letterProgress >= 1;
          const receivingFlightLanded = letter.toFlight === 'B' ? newProgressB >= 1 : newProgressA >= 1;
          
          const updatedLetter = { ...letter, animationProgress: letterProgress };
          
          // Only mark as delivered when both flights have completed their journeys
          if (carryingFlightLanded && receivingFlightLanded) {
            updatedLetter.status = LETTER_STATUS.DELIVERED;
            updatedLetter.deliveredAt = new Date().toISOString();
          }
          
          return updatedLetter;
        });
        
        // Update letters in storage if any changed
        const hasChanges = updatedLetters.some((letter, index) => 
          !storedLetters[index] || 
          letter.animationProgress !== storedLetters[index].animationProgress ||
          letter.status !== storedLetters[index].status
        );
        
        if (hasChanges) {
          await AsyncStorage.setItem('@airletters_letters', JSON.stringify(updatedLetters));
        }
        
        setLetters(updatedLetters);
        setLettersSim(updatedLetters); // Use the actual letters for simulation
        
        // Count unread delivered letters
        const deliveredCount = updatedLetters.filter(l => 
          l.status === LETTER_STATUS.DELIVERED && !l.readAt
        ).length;
        setUnreadCount(deliveredCount);
        
      } catch (error) {
        console.warn('Failed to update letters:', error);
      }
    };

    updateData();
    const timer = setInterval(updateData, 1000);
    return () => clearInterval(timer);
  }, [flightA, flightB]);

  // Load initial data
  useEffect(() => {
    (async () => {
      try {
        // Load any existing letters
        const existingLetters = await getLetters();
        setLetters(existingLetters);
        setLettersSim(existingLetters);
      } catch (error) {
        console.warn('Failed to load letters:', error);
      }
    })();
  }, []);

  // Custom tasteful map style (light, subtle)
  const MAP_STYLE = [
    { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f5f5' }] },
    { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#eeeeee' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#cfe9ff' }] },
  ];

  const OfflineMapView = ({ w = width, h = height }) => {
    console.log('OfflineMapView rendering with:', { w, h, stateGeoJson: !!stateGeoJson, cities: !!cities });
    console.log('stateGeoJson features:', stateGeoJson?.features?.length || 'none');
    console.log('cities count:', cities?.length || 'none');
    
    const latLngToPointLocal = (lat, lon) => {
      const { latMin, latMax, lonMin, lonMax } = INDIA_BOUNDS;
      const x = ((lon - lonMin) / (lonMax - lonMin)) * w;
      const y = ((latMax - lat) / (latMax - latMin)) * h;
      return { x, y };
    };

    return (
      <View style={[styles.offlineMap, { width: w, height: h }] }>
        <View style={styles.offlineGrid} />
        {/* Flight routes as clean lines */}
        <View style={{ position: 'absolute', left: 0, top: 0, width: w, height: h }}>
          {coordsA.map((c, i) => i > 0 && (
            <View key={`segA-${i}`} style={{ position: 'absolute', left: Math.min(latLngToPointLocal(coordsA[i-1].latitude, coordsA[i-1].longitude).x, latLngToPointLocal(c.latitude, c.longitude).x), top: Math.min(latLngToPointLocal(coordsA[i-1].latitude, coordsA[i-1].longitude).y, latLngToPointLocal(c.latitude, c.longitude).y), width: Math.abs(latLngToPointLocal(c.latitude, c.longitude).x - latLngToPointLocal(coordsA[i-1].latitude, coordsA[i-1].longitude).x) || 2, height: 2, backgroundColor: theme.colors.primary, opacity: 0.9 }} />
          ))}
          {coordsB.map((c, i) => i > 0 && (
            <View key={`segB-${i}`} style={{ position: 'absolute', left: Math.min(latLngToPointLocal(coordsB[i-1].latitude, coordsB[i-1].longitude).x, latLngToPointLocal(c.latitude, c.longitude).x), top: Math.min(latLngToPointLocal(coordsB[i-1].latitude, coordsB[i-1].longitude).y, latLngToPointLocal(c.latitude, c.longitude).y), width: Math.abs(latLngToPointLocal(c.latitude, c.longitude).x - latLngToPointLocal(coordsB[i-1].latitude, coordsB[i-1].longitude).x) || 2, height: 2, backgroundColor: theme.colors.accent, opacity: 0.9 }} />
          ))}
        </View>

        {/* Vector state polygons when available */}
        {(() => {
          console.log('Checking stateGeoJson:', { 
            exists: !!stateGeoJson, 
            hasFeatures: !!(stateGeoJson && stateGeoJson.features), 
            featureCount: stateGeoJson?.features?.length || 0 
          });
          return stateGeoJson && stateGeoJson.features && stateGeoJson.features.length > 0;
        })() && (
          <Svg width={w} height={h} style={{ position: 'absolute', left: 0, top: 0 }}>
            <G>
              {stateGeoJson.features.map((f, idx) => {
                console.log('Rendering state feature:', f.properties?.name);
                const geom = f.geometry;
                if (!geom) return null;
                const polygons = (geom.type === 'Polygon') ? [geom.coordinates] : (geom.type === 'MultiPolygon' ? geom.coordinates : []);
                return polygons.map((rings, rIdx) => {
                  const outer = rings[0] || [];
                  if (!outer.length) return null;
                  const points = outer.map(c => {
                    const p = latLngToPointLocal(c[1], c[0]);
                    console.log(`State ${f.properties?.name} coord [${c[1]}, ${c[0]}] -> [${p.x}, ${p.y}]`);
                    return `${p.x},${p.y}`;
                  }).join(' ');
                  const centroid = outer.reduce((acc, c) => ({ x: acc.x + c[0], y: acc.y + c[1] }), { x: 0, y: 0 });
                  centroid.x /= outer.length; centroid.y /= outer.length;
                  const centroidPt = latLngToPointLocal(centroid.y, centroid.x);
                  console.log(`State ${f.properties?.name} centroid: [${centroidPt.x}, ${centroidPt.y}]`);
                  return (
                    <G key={`state-${idx}-${rIdx}`}>
                      <SvgPolygon 
                        points={points} 
                        fill="rgba(100, 150, 255, 0.3)" 
                        stroke="blue" 
                        strokeWidth={2} 
                        opacity={1} 
                      />
                      <SvgText 
                        x={centroidPt.x} 
                        y={centroidPt.y} 
                        fontSize={14} 
                        fill="darkblue" 
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        {(f.properties && f.properties.name) || f.id}
                      </SvgText>
                    </G>
                  );
                });
              })}
            </G>
          </Svg>
        )}

        {/* City labels */}
        {(() => {
          console.log('Checking cities:', { exists: !!cities, count: cities?.length || 0 });
          return cities && cities.length > 0;
        })() && (
          <Svg width={w} height={h} style={{ position: 'absolute', left: 0, top: 0 }}>
            <G>
              {cities.map((c, i) => {
                const p = latLngToPointLocal(c.lat, c.lon);
                console.log(`City ${c.name} [${c.lat}, ${c.lon}] -> [${p.x}, ${p.y}]`);
                return (
                  <SvgText 
                    key={`city-${i}`} 
                    x={p.x} 
                    y={p.y} 
                    fontSize={13} 
                    fill="red" 
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {c.name}
                  </SvgText>
                );
              })}
            </G>
          </Svg>
        )}

        {/* Letter markers and trails following simulated progress */}
        {lettersSim.map(l => {
          const pos = l.fromFlight === 'A' ? interpolateRoute(coordsA, l.animationProgress || 0) : interpolateRoute(coordsB, l.animationProgress || 0);
          const leftPos = ((pos.longitude - INDIA_BOUNDS.lonMin) / (INDIA_BOUNDS.lonMax - INDIA_BOUNDS.lonMin)) * w - 12;
          const topPos = ((INDIA_BOUNDS.latMax - pos.latitude) / (INDIA_BOUNDS.latMax - INDIA_BOUNDS.latMin)) * h - 12;
          
          return (
            <View key={l.id}>
              {/* Trail effect for in-transit letters */}
              {l.status === LETTER_STATUS.IN_TRANSIT && (
                <>
                  <View style={{ 
                    position: 'absolute', 
                    left: leftPos + 8, 
                    top: topPos + 8, 
                    width: 3, 
                    height: 15, 
                    backgroundColor: theme.colors.primary, 
                    opacity: 0.6, 
                    borderRadius: 2 
                  }} />
                  <View style={{ 
                    position: 'absolute', 
                    left: leftPos + 6, 
                    top: topPos + 6, 
                    width: 2, 
                    height: 10, 
                    backgroundColor: theme.colors.primary, 
                    opacity: 0.3, 
                    borderRadius: 1 
                  }} />
                </>
              )}
              
              {/* Main letter marker */}
              <View style={{ position: 'absolute', left: leftPos, top: topPos }}>
                <View style={{ backgroundColor: theme.colors.primary, padding: 6, borderRadius: 16 }}>
                  <Text style={{ color: '#fff' }}>
                    {l.status === LETTER_STATUS.DELIVERED ? '📬' : '✉️'}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    );
  };
  const interpolateRoute = (route, progress) => {
    if (progress <= 0) return route[0];
    if (progress >= 1) return route[route.length - 1];
    
    const totalSegments = route.length - 1;
    const segment = Math.floor(progress * totalSegments);
    const segmentProgress = (progress * totalSegments) - segment;
    
    const start = route[segment];
    const end = route[Math.min(segment + 1, route.length - 1)];
    
    return {
      latitude: start.latitude + (end.latitude - start.latitude) * segmentProgress,
      longitude: start.longitude + (end.longitude - start.longitude) * segmentProgress,
    };
  };

  const getAltitudeOffset = (progress) => {
    // Simulate altitude changes during flight
    const altitudeValue = altitudeAnim._value;
    const baseOffset = Math.sin(progress * Math.PI * 2) * 0.001; // Small oscillation
    const climbOffset = Math.min(progress * 4, 1) * 0.002; // Climbing phase
    const descentOffset = Math.max((progress - 0.8) * 5, 0) * -0.002; // Descent phase
    
    return baseOffset + climbOffset + descentOffset + (altitudeValue * 0.0005);
  };

  const handleLetterPress = async (letter) => {
    // Animate letter opening
    const openAnimation = new Animated.Value(0);
    
    if (letter.status === LETTER_STATUS.DELIVERED) {
      Animated.sequence([
        Animated.timing(openAnimation, {
          toValue: 1,
          duration: theme.animations.duration.letter,
          easing: Easing.elastic(1.2),
          useNativeDriver: true,
        })
      ]).start();

      Alert.alert(
        'Letter from Fellow Traveler ✉️',
        `${letter.text}\n\n📊 Journey Stats:\n• Distance traveled: ${letter.estimatedDistance || 1250}km\n• Flight time: 5 minutes\n• Weather: ${getWeatherCondition()}`,
        [
          {
            text: 'Mark as Read',
            onPress: async () => {
              await markLetterAsRead(letter.id);
              const updatedLetters = await processLetterStatuses();
              setLetters(updatedLetters);
              const unread = updatedLetters.filter(l => l.status === LETTER_STATUS.DELIVERED).length;
              setUnreadCount(unread);
            }
          }
        ]
      );
    } else if (letter.status === LETTER_STATUS.IN_TRANSIT) {
      const progress = Math.round((letter.animationProgress || 0) * 100);
      Alert.alert(
        'Letter In Transit 📮', 
        `This letter is ${progress}% of the way to its destination.\n\n🌤️ Current conditions: ${getWeatherCondition()}\n✈️ Cruising at simulated altitude`
      );
    } else {
      Alert.alert('Letter Scheduled ⏰', 'This letter hasn\'t started its journey yet.');
    }
  };

  const getWeatherCondition = () => {
    const conditions = ['Clear skies ☀️', 'Light turbulence 🌤️', 'Smooth sailing ✨', 'Partly cloudy ⛅'];
    return conditions[Math.floor(Math.random() * conditions.length)];
  };

  const renderLetterTrailMarkers = () => {
    const trailMarkers = [];
    
    lettersSim.forEach(letter => {
      if (letter.status !== LETTER_STATUS.IN_TRANSIT) return;
      
      const progress = letter.animationProgress || 0;
      const sourceCoords = letter.fromFlight === 'A' ? coordsA : coordsB;
      const destCoords = letter.toFlight === 'A' ? coordsA : coordsB;
      
      const sourcePos = interpolateRoute(sourceCoords, letter.fromFlight === 'A' ? progressA : progressB);
      const destPos = interpolateRoute(destCoords, letter.toFlight === 'A' ? progressA : progressB);
      
      // Create trail markers at previous positions
      const trailLength = 5; // Number of trail markers
      for (let i = 1; i <= trailLength; i++) {
        const trailProgress = Math.max(0, progress - (i * 0.05)); // 5% intervals
        if (trailProgress <= 0) break;
        
        const trailPosition = {
          latitude: sourcePos.latitude + (destPos.latitude - sourcePos.latitude) * trailProgress,
          longitude: sourcePos.longitude + (destPos.longitude - sourcePos.longitude) * trailProgress,
        };
        
        const opacity = 1 - (i / trailLength); // Fade older trail markers
        
        trailMarkers.push(
          <Marker
            key={`${letter.id}-trail-${i}`}
            coordinate={trailPosition}
            style={{ zIndex: 400 - i }}
          >
            <View style={{
              width: 8 - (i * 1),
              height: 8 - (i * 1),
              borderRadius: 4 - (i * 0.5),
              backgroundColor: letter.fromFlight === 'A' ? theme.colors.primary : theme.colors.accent,
              opacity: opacity * 0.6,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.8)'
            }} />
          </Marker>
        );
      }
    });
    
    return trailMarkers;
  };

  const renderLetterMarkers = () => {
    return lettersSim.map(letter => {
      if (letter.status === LETTER_STATUS.SCHEDULED) {
        return null;
      }

      let letterPosition;
      let emoji = '📮';
      let markerSize = 1;
      
      if (letter.status === LETTER_STATUS.IN_TRANSIT) {
        const progress = letter.animationProgress || 0;
        
        // Get source and destination positions based on letter direction
        const sourceCoords = letter.fromFlight === 'A' ? coordsA : coordsB;
        const destCoords = letter.toFlight === 'A' ? coordsA : coordsB;
        
        const sourcePos = interpolateRoute(sourceCoords, letter.fromFlight === 'A' ? progressA : progressB);
        const destPos = interpolateRoute(destCoords, letter.toFlight === 'A' ? progressA : progressB);
        
        // Interpolate letter position between source and destination flights
        letterPosition = {
          latitude: sourcePos.latitude + (destPos.latitude - sourcePos.latitude) * progress,
          longitude: sourcePos.longitude + (destPos.longitude - sourcePos.longitude) * progress,
        };
        
        emoji = '✉️';
        markerSize = 1 + (progress * 0.3); // Grow slightly during transit
      } else if (letter.status === LETTER_STATUS.DELIVERED) {
        // Position at destination flight
        const destCoords = letter.toFlight === 'A' ? coordsA : coordsB;
        const destProgress = letter.toFlight === 'A' ? progressA : progressB;
        letterPosition = interpolateRoute(destCoords, destProgress);
        emoji = '📬';
        markerSize = 1.2;
      } else if (letter.status === LETTER_STATUS.READ) {
        // Position at destination flight
        const destCoords = letter.toFlight === 'A' ? coordsA : coordsB;
        const destProgress = letter.toFlight === 'A' ? progressA : progressB;
        letterPosition = interpolateRoute(destCoords, destProgress);
        emoji = '📭';
        markerSize = 0.9;
      }

      if (!letterPosition) return null;

      return (
        <Marker
          key={letter.id}
          coordinate={letterPosition}
          onPress={() => handleLetterPress(letter)}
          style={{ zIndex: letter.status === LETTER_STATUS.DELIVERED ? 1000 : 500 }}
        >
          <Animated.View style={{
            transform: [
              { scale: letter.status === LETTER_STATUS.DELIVERED ? pulseAnim : markerSize }
            ]
          }}>
            <Text style={{ 
              fontSize: 24 * markerSize,
              textShadowColor: 'rgba(0,0,0,0.3)',
              textShadowOffset: { width: 1, height: 1 },
              textShadowRadius: 2
            }}>
              {emoji}
            </Text>
          </Animated.View>
          
          {/* Enhanced trail effect for in-transit letters */}
          {letter.status === LETTER_STATUS.IN_TRANSIT && (
            <Animated.View style={{
              transform: [{ scale: pulseAnim.interpolate({
                inputRange: [1, 1.2],
                outputRange: [1, 1.1]
              }) }]
            }}>
              <View style={styles.letterTrail} />
              <View style={[styles.letterTrail, { opacity: 0.4, top: -8, left: 8, width: 3, height: 15 }]} />
              <View style={[styles.letterTrail, { opacity: 0.2, top: -6, left: 6, width: 2, height: 10 }]} />
            </Animated.View>
          )}
        </Marker>
      );
    });
  };

  const renderFlightPath = (route, progress, color, strokeWidth = 3) => {
    // Render completed path with full opacity
    const completedPath = route.slice(0, Math.ceil(progress * (route.length - 1)) + 1);
    
    // Render remaining path with reduced opacity
    const remainingPath = route.slice(Math.floor(progress * (route.length - 1)));
    
    return (
      <>
        <Polyline 
          coordinates={completedPath} 
          strokeColor={color} 
          strokeWidth={strokeWidth}
          lineDashPattern={[1]}
        />
        <Polyline 
          coordinates={remainingPath} 
          strokeColor={color} 
          strokeWidth={strokeWidth * 0.5}
          strokeOpacity={0.3}
          lineDashPattern={[5, 5]}
        />
      </>
    );
  };

  const renderFlightMarker = (route, progress, flightNumber, emoji) => {
    const position = interpolateRoute(route, progress);
    const altitudeOffset = getAltitudeOffset(progress);
    
    return (
      <Marker 
        coordinate={{
          ...position,
          latitude: position.latitude + altitudeOffset
        }}
        title={`${flightNumber} - ${Math.round(progress * 100)}%`}
        style={{ zIndex: 800 }}
      >
        <Animated.View style={{
          transform: [
            { scale: altitudeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.9, 1.1]
            }) },
            { rotate: `${progress * 360}deg` }
          ]
        }}>
          <Text style={styles.flightEmoji}>{emoji}</Text>
        </Animated.View>
      </Marker>
    );
  };

  const focusOnAction = () => {
    if (mapRef.current && letters.length > 0) {
      // Find the most interesting point (active letters or midpoint)
      const inTransitLetters = letters.filter(l => l.status === LETTER_STATUS.IN_TRANSIT);
      if (inTransitLetters.length > 0) {
        const letter = inTransitLetters[0];
        const progress = letter.animationProgress || 0;
        const flightAPos = interpolateRoute(coordsA, progressA);
        const flightBPos = interpolateRoute(coordsB, progressB);
        
        const focusPoint = {
          latitude: flightAPos.latitude + (flightBPos.latitude - flightAPos.latitude) * progress,
          longitude: flightAPos.longitude + (flightBPos.longitude - flightAPos.longitude) * progress,
        };
        
        mapRef.current.animateToRegion({
          ...focusPoint,
          latitudeDelta: 2,
          longitudeDelta: 2,
        }, 1000);
      }
    }
  };

  const toggleMapStyle = () => {
    const styles = ['standard', 'satellite', 'hybrid'];
    const currentIndex = styles.indexOf(mapStyle);
    const nextStyle = styles[(currentIndex + 1) % styles.length];
    setMapStyle(nextStyle);
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        mapType={mapStyle}
        initialRegion={{
          latitude: 16,
          longitude: 76,
          latitudeDelta: 8,
          longitudeDelta: 8,
        }}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsPointsOfInterest={false}
        showsBuildings={true}
        showsTraffic={false}
      >
        {/* Flight A route and marker */}
        {renderFlightPath(coordsA, progressA, theme.colors.primary)}
        {renderFlightMarker(coordsA, progressA, flightA.flightNumber, '✈️')}

        {/* Flight B route and marker */}
        {renderFlightPath(coordsB, progressB, theme.colors.accent)}
        {renderFlightMarker(coordsB, progressB, flightB.flightNumber, '🛫')}

        {/* Letter markers */}
        {/* Render letter trail markers first (lower z-index) */}
        {renderLetterTrailMarkers()}
        
        {/* Render main letter markers */}
        {renderLetterMarkers()}
        
        {/* Airport markers */}
        {[...coordsA, ...coordsB].filter((coord, index, arr) => 
          arr.findIndex(c => c.latitude === coord.latitude && c.longitude === coord.longitude) === index
        ).map((airport, index) => (
          airport.name && (
            <Marker 
              key={index}
              coordinate={airport}
              title={airport.name}
            >
              <Text style={styles.airportEmoji}>🏢</Text>
            </Marker>
          )
        ))}
      </MapView>

      {/* Enhanced Status overlay */}
      <Animated.View style={[styles.statusOverlay, {
        transform: [{ scale: pulseAnim.interpolate({
          inputRange: [1, 1.2],
          outputRange: [1, 1.02]
        }) }]
      }]}>
        <View style={styles.flightStatus}>
          <View style={styles.flightRow}>
            <Text style={[styles.flightEmoji, { color: theme.colors.primary }]}>✈️</Text>
            <Text style={styles.flightText}>
              {flightA.flightNumber}: {Math.round(progressA * 100)}%
            </Text>
          </View>
          <View style={styles.flightRow}>
            <Text style={[styles.flightEmoji, { color: theme.colors.accent }]}>🛫</Text>
            <Text style={styles.flightText}>
              {flightB.flightNumber}: {Math.round(progressB * 100)}%
            </Text>
          </View>
        </View>
        
        {letters.length > 0 && (
          <View style={styles.letterStatus}>
            <Text style={styles.letterText}>
              📮 Letters: {letters.length} total
            </Text>
            <View style={styles.letterCounts}>
              <Text style={[styles.letterCount, { color: theme.colors.inTransit }]}>
                ✉️ {letters.filter(l => l.status === LETTER_STATUS.IN_TRANSIT).length} traveling
              </Text>
              <Text style={[styles.letterCount, { color: theme.colors.delivered }]}>
                📬 {letters.filter(l => l.status === LETTER_STATUS.DELIVERED).length} delivered
              </Text>
            </View>
          </View>
        )}
        
        {/* Weather info */}
        <View style={styles.weatherInfo}>
          <Text style={styles.weatherText}>{getWeatherCondition()}</Text>
        </View>
      </Animated.View>

      {/* Map controls */}
      <View style={styles.mapControls}>
        <TouchableOpacity style={styles.controlButton} onPress={focusOnAction}>
          <Text style={styles.controlButtonText}>🎯</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.controlButton} onPress={toggleMapStyle}>
          <Text style={styles.controlButtonText}>🗺️</Text>
        </TouchableOpacity>
      </View>

      {/* Unread notification with enhanced animation */}
      {unreadCount > 0 && (
        <Animated.View style={[styles.unreadBadge, {
          transform: [{ scale: pulseAnim }]
        }]}>
          <TouchableOpacity onPress={() => navigation.navigate('Letters')}>
            <Text style={styles.unreadText}>
              {unreadCount} new letter{unreadCount > 1 ? 's' : ''}! 📬
            </Text>
            <Text style={styles.unreadSubtext}>Tap to read</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Enhanced floating action button */}
      <Animated.View style={[styles.fab, {
        transform: [{ scale: altitudeAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.05]
        }) }]
      }]}>
        <TouchableOpacity 
          style={styles.fabButton}
          onPress={() => navigation.navigate('Compose')}
        >
          <Text style={styles.fabText}>✏️</Text>
        </TouchableOpacity>
      </Animated.View>
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
    top: Platform.OS === 'ios' ? 60 : 40,
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    backgroundColor: theme.colors.overlayLight,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    ...theme.shadows.lg,
  },
  flightStatus: {
    marginBottom: theme.spacing.md,
  },
  flightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  flightEmoji: {
    fontSize: 16,
    marginRight: theme.spacing.sm,
  },
  flightText: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
  },
  letterStatus: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
    paddingTop: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  letterText: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  letterCounts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  letterCount: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
  },
  weatherInfo: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
    paddingTop: theme.spacing.sm,
  },
  weatherText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  mapControls: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: theme.spacing.lg,
    flexDirection: 'column',
  },
  controlButton: {
    width: 44,
    height: 44,
    backgroundColor: theme.colors.card,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
    ...theme.shadows.md,
  },
  controlButtonText: {
    fontSize: 20,
  },
  unreadBadge: {
    position: 'absolute',
    bottom: 120,
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.lg,
    ...theme.shadows.xl,
  },
  unreadText: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: '#fff',
    textAlign: 'center',
    padding: theme.spacing.lg,
  },
  unreadSubtext: {
    fontSize: theme.typography.sizes.sm,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    paddingBottom: theme.spacing.md,
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 30,
  },
  fabButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.xl,
  },
  fabText: {
    fontSize: 28,
  },
  flightEmoji: {
    fontSize: 28,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  airportEmoji: {
    fontSize: 20,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  letterTrail: {
    position: 'absolute',
    width: 4,
    height: 20,
    backgroundColor: theme.colors.primary,
    opacity: 0.6,
    borderRadius: 2,
    top: -10,
    left: 10,
    transform: [{ rotate: '45deg' }],
  },
  offlineMap: {
    backgroundColor: '#f8fafb',
  },
  offlineGrid: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent'
  },
});