// src/screens/LettersScreen.js
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Animated,
  Dimensions,
  StatusBar,
  Modal,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  PanResponder,
  Platform
} from 'react-native';
import { DateTime } from 'luxon';
import { processLetterStatuses, markLetterAsRead, LETTER_STATUS, getCurrentUser } from '../lib/storage';
import { flightProgressPercent } from '../lib/simulation';
import defaultFlights from '../lib/defaultFlights';
import theme from '../theme';

const { width, height } = Dimensions.get('window');

const STATUS_COLORS = {
  [LETTER_STATUS.SCHEDULED]: theme.colors.scheduled,
  [LETTER_STATUS.IN_TRANSIT]: theme.colors.inTransit, 
  [LETTER_STATUS.DELIVERED]: theme.colors.delivered,
  [LETTER_STATUS.READ]: theme.colors.read
};

const STATUS_EMOJIS = {
  [LETTER_STATUS.SCHEDULED]: '⏰',
  [LETTER_STATUS.IN_TRANSIT]: '✈️',
  [LETTER_STATUS.DELIVERED]: '📬',
  [LETTER_STATUS.READ]: '✅'
};

const STATUS_LABELS = {
  [LETTER_STATUS.SCHEDULED]: 'Scheduled',
  [LETTER_STATUS.IN_TRANSIT]: 'Flying',
  [LETTER_STATUS.DELIVERED]: 'Delivered',
  [LETTER_STATUS.READ]: 'Read'
};

// Constants for zoom functionality - optimized for long text reading
const MIN_ZOOM = 0.6;
const MAX_ZOOM = 4.0;
const INITIAL_ZOOM = 1.0;

export default function LettersScreen({ navigation }) {
  const [letters, setLetters] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedLetter, setSelectedLetter] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [activeWindow, setActiveWindow] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  // Animation references
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;
  const letterAnimations = useRef(new Map()).current;

  // Zoom and pan references for letter content
  const zoomScale = useRef(new Animated.Value(INITIAL_ZOOM)).current;
  const panX = useRef(new Animated.Value(0)).current;
  const panY = useRef(new Animated.Value(0)).current;
  const lastZoom = useRef(INITIAL_ZOOM);
  const lastPanX = useRef(0);
  const lastPanY = useRef(0);

  // PanResponder for handling touch gestures - optimized for long text
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only activate pan if zoom is greater than 1 or significant movement
        return lastZoom.current > 1 || Math.abs(gestureState.dx) > 10 || Math.abs(gestureState.dy) > 10;
      },
      onMoveShouldSetPanResponderCapture: () => false,
      onPanResponderGrant: () => {
        panX.setOffset(lastPanX.current);
        panY.setOffset(lastPanY.current);
      },
      onPanResponderMove: (evt, gestureState) => {
        // Handle pinch-to-zoom with two fingers
        if (evt.nativeEvent.touches && evt.nativeEvent.touches.length === 2) {
          const touch1 = evt.nativeEvent.touches[0];
          const touch2 = evt.nativeEvent.touches[1];
          const distance = Math.sqrt(
            Math.pow(touch2.pageX - touch1.pageX, 2) + 
            Math.pow(touch2.pageY - touch1.pageY, 2)
          );
          
          if (!lastZoom.distance) {
            lastZoom.distance = distance;
          } else {
            const scale = distance / lastZoom.distance;
            const newScale = Math.min(Math.max(lastZoom.current * scale, MIN_ZOOM), MAX_ZOOM);
            zoomScale.setValue(newScale);
          }
        } else if (lastZoom.current > 1) {
          // Only allow pan when zoomed in
          panX.setValue(gestureState.dx);
          panY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (evt.nativeEvent.touches && evt.nativeEvent.touches.length === 2) {
          lastZoom.current = Math.min(Math.max(lastZoom.current, MIN_ZOOM), MAX_ZOOM);
          delete lastZoom.distance;
        } else if (lastZoom.current > 1) {
          lastPanX.current += gestureState.dx;
          lastPanY.current += gestureState.dy;
          
          // Constrain pan within bounds - larger bounds for long text
          const maxPanX = 200 * (lastZoom.current - 1);
          const maxPanY = 500 * (lastZoom.current - 1);
          
          lastPanX.current = Math.min(Math.max(lastPanX.current, -maxPanX), maxPanX);
          lastPanY.current = Math.min(Math.max(lastPanY.current, -maxPanY), maxPanY);
        }
        
        panX.flattenOffset();
        panY.flattenOffset();
      },
    })
  ).current;

  useEffect(() => {
    initializeScreen();
    
    const timer = setInterval(() => {
      loadLetters();
      updateActiveWindow();
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);

  const initializeScreen = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadLetters(),
        loadCurrentUser()
      ]);
      startEntranceAnimations();
    } catch (err) {
      setError('Failed to load letters');
      console.error('Initialization error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentUser = async () => {
    try {
      const userType = await getCurrentUser();
      setCurrentUser(userType);
    } catch (error) {
      console.error('Failed to load current user:', error);
      setCurrentUser('A'); // Default to A
    }
  };

  const startEntranceAnimations = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.timing(headerAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulse animation for new letters
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const updateActiveWindow = useCallback(() => {
    const now = DateTime.utc();
    const flightA = defaultFlights.flightA;
    const flightStart = DateTime.fromISO(flightA.departureUTC, { zone: 'utc' });
    const oneHourWindow = flightStart.plus({ hours: 1 });
    
    if (now >= flightStart && now <= oneHourWindow) {
      setActiveWindow(true);
      const timeLeft = oneHourWindow.diff(now, 'milliseconds').milliseconds;
      setTimeRemaining(Math.max(0, timeLeft));
    } else {
      setActiveWindow(false);
      setTimeRemaining(0);
    }
  }, []);

  const loadLetters = async () => {
    try {
      const updatedLetters = await processLetterStatuses();
      
      // Enhanced sorting with better prioritization
      const prioritySort = (a, b) => {
        const statusPriority = {
          [LETTER_STATUS.DELIVERED]: 0,
          [LETTER_STATUS.IN_TRANSIT]: 1,
          [LETTER_STATUS.SCHEDULED]: 2,
          [LETTER_STATUS.READ]: 3
        };
        
        if (statusPriority[a.status] !== statusPriority[b.status]) {
          return statusPriority[a.status] - statusPriority[b.status];
        }
        
        // Secondary sort by date for same status
        return new Date(b.createdAt) - new Date(a.createdAt);
      };
      
      const sortedLetters = updatedLetters.sort(prioritySort);
      setLetters(sortedLetters);

      // Enhanced animation with staggered entrance
      sortedLetters.forEach((letter, index) => {
        if (!letterAnimations.has(letter.id)) {
          const anim = new Animated.Value(0);
          letterAnimations.set(letter.id, anim);
          
          Animated.timing(anim, {
            toValue: 1,
            duration: 500,
            delay: index * 100,
            useNativeDriver: true,
          }).start();
        }
      });
      
      setError(null);
    } catch (error) {
      console.error('Failed to load letters:', error);
      setError('Failed to load letters. Pull to refresh.');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setError(null);
    await loadLetters();
    setRefreshing(false);
  };

  const handleLetterPress = useCallback((letter) => {
    if (!letter) return;
    
    // Reset zoom and pan for new letter
    resetZoomAndPan();
    setSelectedLetter(letter);
    setModalVisible(true);
  }, []);

  const resetZoomAndPan = () => {
    zoomScale.setValue(INITIAL_ZOOM);
    panX.setValue(0);
    panY.setValue(0);
    lastZoom.current = INITIAL_ZOOM;
    lastPanX.current = 0;
    lastPanY.current = 0;
  };

  const handleMarkAsRead = async (letter) => {
    if (!letter || letter.status !== LETTER_STATUS.DELIVERED) return;
    
    try {
      await markLetterAsRead(letter.id);
      await loadLetters();
      setModalVisible(false);
      
      // Enhanced success feedback
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0.8,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
      
      // Optional: Show success toast
      Alert.alert('✅ Letter Marked as Read', 'The letter has been marked as read successfully.');
    } catch (error) {
      console.error('Failed to mark letter as read:', error);
      Alert.alert('Error', 'Failed to mark letter as read. Please try again.');
    }
  };

  const formatDate = useCallback((dateString) => {
    try {
      const date = DateTime.fromISO(dateString);
      const now = DateTime.now();
      
      if (!date.isValid) return 'Invalid date';
      
      if (date.hasSame(now, 'day')) {
        return date.toFormat('t'); // Just time for today
      } else if (date.hasSame(now, 'week')) {
        return date.toFormat('EEE t'); // Day and time for this week
      } else {
        return date.toFormat('MMM d, t'); // Month, day, time for older
      }
    } catch (error) {
      console.error('Date formatting error:', error);
      return 'Unknown date';
    }
  }, []);

  const formatTimeRemaining = useCallback((milliseconds) => {
    if (milliseconds <= 0) return '00:00';
    
    const totalSeconds = Math.ceil(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  const getJourneyDetails = useCallback((letter) => {
    if (!letter) return {};
    
    const flightA = defaultFlights.flightA;
    const flightB = defaultFlights.flightB;
    
    let details = {
      route: `${flightA.departure} → ${flightB.arrival}`,
      distance: '~1,250 km',
      altitude: '35,000 ft',
      estimatedTime: '~5 minutes transit'
    };
    
    if (letter.status === LETTER_STATUS.IN_TRANSIT) {
      const progress = Math.round((letter.animationProgress || 0) * 100);
      details.currentStatus = `${progress}% delivered`;
      details.position = progress < 50 ? 'En route to midpoint' : 'Approaching destination';
    } else if (letter.status === LETTER_STATUS.DELIVERED) {
      details.currentStatus = 'Arrived at destination';
      details.deliveredAt = formatDate(letter.deliveredAt || letter.createdAt);
    }
    
    return details;
  }, [formatDate]);

  // Enhanced zoom functionality with better touch handling
  const handleZoomIn = useCallback(() => {
    const newScale = Math.min(lastZoom.current * 1.5, MAX_ZOOM);
    lastZoom.current = newScale;
    Animated.spring(zoomScale, {
      toValue: newScale,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
  }, []);

  const handleZoomOut = useCallback(() => {
    const newScale = Math.max(lastZoom.current * 0.67, MIN_ZOOM);
    lastZoom.current = newScale;
    Animated.spring(zoomScale, {
      toValue: newScale,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
  }, []);

  const handleResetZoom = useCallback(() => {
    resetZoomAndPan();
    Animated.parallel([
      Animated.spring(zoomScale, {
        toValue: INITIAL_ZOOM,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }),
      Animated.spring(panX, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }),
      Animated.spring(panY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }),
    ]).start();
  }, []);

  const renderZoomControls = () => (
    <View style={styles.zoomControls}>
      <TouchableOpacity 
        style={styles.zoomButton}
        onPress={handleZoomIn}
      >
        <Text style={styles.zoomButtonText}>+</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.zoomButton}
        onPress={handleResetZoom}
      >
        <Text style={styles.zoomButtonText}>⌂</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.zoomButton}
        onPress={handleZoomOut}
      >
        <Text style={styles.zoomButtonText}>−</Text>
      </TouchableOpacity>
    </View>
  );

  const renderEnhancedLetterModal = () => (
    <Modal
      animationType="slide"
      transparent={false}
      visible={modalVisible}
      onRequestClose={() => setModalVisible(false)}
    >
      <SafeAreaView style={styles.fullScreenModal}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        
        {/* Full Screen Header */}
        <View style={styles.fullScreenHeader}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => setModalVisible(false)}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          
          {selectedLetter && (
            <View style={styles.fullScreenHeaderInfo}>
              <Text style={styles.fullScreenTitle}>
                {STATUS_EMOJIS[selectedLetter.status]} Letter
              </Text>
              <Text style={styles.fullScreenSubtitle}>
                {formatDate(selectedLetter.createdAt)}
              </Text>
            </View>
          )}
          
          {selectedLetter?.status === LETTER_STATUS.DELIVERED && (
            <TouchableOpacity 
              style={styles.markReadHeaderButton}
              onPress={() => handleMarkAsRead(selectedLetter)}
            >
              <Text style={styles.markReadHeaderText}>✓</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Full Screen Letter Content */}
        {selectedLetter && (
          <ScrollView 
            style={styles.fullScreenContent}
            contentContainerStyle={styles.fullScreenContentContainer}
            showsVerticalScrollIndicator={true}
            bounces={true}
          >
            <Animated.View 
              style={[
                styles.fullScreenLetterContainer,
                {
                  transform: [
                    { scale: zoomScale },
                    { translateX: panX },
                    { translateY: panY }
                  ]
                }
              ]}
              {...panResponder.panHandlers}
            >
              <Text style={styles.fullScreenLetterText}>
                {selectedLetter.text || 'No content available'}
              </Text>
            </Animated.View>
          </ScrollView>
        )}

        {/* Zoom Controls */}
        <View style={styles.fullScreenZoomControls}>
          <TouchableOpacity 
            style={styles.fullScreenZoomButton}
            onPress={handleZoomOut}
          >
            <Text style={styles.fullScreenZoomButtonText}>A-</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.fullScreenZoomButton}
            onPress={handleResetZoom}
          >
            <Text style={styles.fullScreenZoomButtonText}>A</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.fullScreenZoomButton}
            onPress={handleZoomIn}
          >
            <Text style={styles.fullScreenZoomButtonText}>A+</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );

  const renderLetterItem = ({ item: letter, index }) => {
    if (!letter) return null;
    
    // Enhanced preview text handling
    const letterText = letter.text || 'No content available';
    const preview = letterText.length > 80 
      ? letterText.substring(0, 80).trim() + '...'
      : letterText;

    const letterAnim = letterAnimations.get(letter.id) || new Animated.Value(1);
    const isNew = letter.status === LETTER_STATUS.DELIVERED;
    const isUnread = letter.status === LETTER_STATUS.DELIVERED;

    return (
      <Animated.View style={[
        styles.letterItemContainer,
        {
          opacity: letterAnim,
          transform: [
            { 
              translateX: letterAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [50, 0]
              })
            },
            { 
              scale: isNew ? pulseAnim : 1 
            }
          ]
        }
      ]}>
        <TouchableOpacity
          style={[
            styles.letterItem,
            isUnread && styles.unreadItem,
            letter.status === LETTER_STATUS.IN_TRANSIT && styles.transitItem
          ]}
          onPress={() => handleLetterPress(letter)}
          activeOpacity={0.7}
        >
          <View style={styles.letterHeader}>
            <View style={styles.statusContainer}>
              <Animated.Text style={[
                styles.statusEmoji,
                letter.status === LETTER_STATUS.IN_TRANSIT && {
                  transform: [{ rotate: '45deg' }]
                }
              ]}>
                {STATUS_EMOJIS[letter.status]}
              </Animated.Text>
              <View style={styles.statusInfo}>
                <Text style={[
                  styles.statusText,
                  { color: STATUS_COLORS[letter.status] }
                ]}>
                  {STATUS_LABELS[letter.status]}
                </Text>
                {letter.status === LETTER_STATUS.IN_TRANSIT && (
                  <Text style={styles.progressSubtext}>
                    {Math.round((letter.animationProgress || 0) * 100)}% delivered
                  </Text>
                )}
              </View>
            </View>
            
            <View style={styles.dateContainer}>
              <Text style={styles.dateText}>
                {formatDate(letter.createdAt)}
              </Text>
              {isUnread && (
                <View style={styles.newBadge}>
                  <Text style={styles.newBadgeText}>NEW</Text>
                </View>
              )}
            </View>
          </View>
          
          {/* Enhanced letter preview */}
          <View style={styles.previewContainer}>
            <Text style={styles.previewText} numberOfLines={3}>
              {preview}
            </Text>
            {letterText.length > 80 && (
              <Text style={styles.previewContinue}>
                Tap to read full letter...
              </Text>
            )}
          </View>
          
          {/* Enhanced Progress Bar for In-Transit Letters */}
          {letter.status === LETTER_STATUS.IN_TRANSIT && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <Animated.View 
                  style={[
                    styles.progressFill,
                    { 
                      width: `${(letter.animationProgress || 0) * 100}%`,
                      backgroundColor: theme.colors.inTransit 
                    }
                  ]}
                />
                <View style={[styles.progressIndicator, {
                  left: `${Math.max(0, Math.min(95, (letter.animationProgress || 0) * 100))}%`
                }]}>
                  <Text style={styles.progressIndicatorText}>✈️</Text>
                </View>
              </View>
            </View>
          )}
          
          {/* Enhanced Action Hint */}
          <View style={styles.actionHint}>
            {letter.status === LETTER_STATUS.DELIVERED && (
              <Text style={styles.actionHintText}>📖 Tap to read</Text>
            )}
            {letter.status === LETTER_STATUS.IN_TRANSIT && (
              <Text style={styles.actionHintText}>🗺️ Tap to track</Text>
            )}
            {letter.status === LETTER_STATUS.SCHEDULED && (
              <Text style={styles.actionHintText}>⏰ Waiting to depart</Text>
            )}
            {letter.status === LETTER_STATUS.READ && (
              <Text style={styles.actionHintText}>✅ Read</Text>
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderHeader = () => (
    <Animated.View style={[styles.headerContainer, {
      opacity: headerAnim,
      transform: [{ translateY: headerAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [-20, 0]
      }) }]
    }]}>
      <View style={styles.headerContent}>
        <Text style={styles.headerTitle}>Air Letters</Text>
        <Text style={styles.headerSubtitle}>Your aerial correspondence</Text>
      </View>
      
      {activeWindow && (
        <Animated.View style={[styles.activeWindowBanner, {
          transform: [{ scale: pulseAnim }]
        }]}>
          <Text style={styles.activeWindowText}>
            🟢 Letter window active: {formatTimeRemaining(timeRemaining)} remaining
          </Text>
        </Animated.View>
      )}
      
      {letters.length > 0 && (
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {letters.filter(l => l.status === LETTER_STATUS.DELIVERED).length}
            </Text>
            <Text style={styles.statLabel}>New</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {letters.filter(l => l.status === LETTER_STATUS.IN_TRANSIT).length}
            </Text>
            <Text style={styles.statLabel}>Flying</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{letters.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
        </View>
      )}
    </Animated.View>
  );

  const renderEmptyState = () => (
    <Animated.View style={[styles.emptyContainer, {
      opacity: fadeAnim,
      transform: [{ translateY: slideAnim }]
    }]}>
      <Text style={styles.emptyEmoji}>✈️</Text>
      <Text style={styles.emptyTitle}>Ready for Takeoff?</Text>
      <Text style={styles.emptyText}>
        No letters yet! When the flight window opens, you can compose and send your first aerial message.
      </Text>
      
      <TouchableOpacity 
        style={styles.composeFirstButton}
        onPress={() => navigation.navigate('Compose')}
      >
        <Text style={styles.composeFirstButtonText}>Prepare Your First Letter ✏️</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderFloatingActionButton = () => (
    <Animated.View style={[styles.fab, {
      transform: [{ scale: pulseAnim }],
      opacity: fadeAnim
    }]}>
      <TouchableOpacity 
        style={styles.fabButton}
        onPress={() => navigation.navigate('Compose')}
      >
        <Text style={styles.fabText}>✏️</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderErrorState = () => (
    <View style={styles.errorContainer}>
      <Text style={styles.errorEmoji}>⚠️</Text>
      <Text style={styles.errorTitle}>Something went wrong</Text>
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
        <Text style={styles.retryButtonText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );

  const renderLoadingState = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
      <Text style={styles.loadingText}>Loading letters...</Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />
        {renderLoadingState()}
      </SafeAreaView>
    );
  }

  if (error && letters.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />
        {renderErrorState()}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <FlatList
          data={letters}
          renderItem={renderLetterItem}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={letters.length === 0 ? styles.emptyListContainer : styles.listContainer}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          initialNumToRender={10}
          maxToRenderPerBatch={5}
          windowSize={10}
          getItemLayout={(data, index) => ({
            length: 180,
            offset: 180 * index,
            index,
          })}
        />
      </Animated.View>
      
      {renderFloatingActionButton()}
      {renderEnhancedLetterModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
  },
  listContainer: {
    paddingBottom: 100,
  },
  emptyListContainer: {
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: 16,
    color: theme.colors.textMuted,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.page,
  },
  errorEmoji: {
    fontSize: 48,
    marginBottom: theme.spacing.lg,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
  retryButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.lg,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  headerContainer: {
    padding: theme.spacing.page,
    paddingBottom: theme.spacing.lg,
  },
  headerContent: {
    marginBottom: theme.spacing.lg,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: theme.colors.textMuted,
    fontWeight: '400',
  },
  activeWindowBanner: {
    backgroundColor: theme.colors.success,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.lg,
    marginBottom: theme.spacing.lg,
    ...theme.shadows.sm,
  },
  activeWindowText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    ...theme.shadows.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 26,
    fontWeight: '700',
    color: theme.colors.primary,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  statDivider: {
    width: 1,
    backgroundColor: theme.colors.borderLight,
    marginHorizontal: theme.spacing.md,
  },
  separator: {
    height: theme.spacing.md,
  },
  letterItemContainer: {
    marginHorizontal: theme.spacing.page,
  },
  letterItem: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    borderWidth: 2,
    borderColor: 'transparent',
    ...theme.shadows.md,
    minHeight: 140,
  },
  unreadItem: {
    borderColor: theme.colors.delivered,
    backgroundColor: theme.colors.deliveredBg || theme.colors.card,
    ...theme.shadows.lg,
  },
  transitItem: {
    borderColor: theme.colors.inTransit,
    backgroundColor: theme.colors.inTransitBg || theme.colors.card,
  },
  letterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusInfo: {
    marginLeft: theme.spacing.sm,
  },
  statusEmoji: {
    fontSize: 24,
    marginRight: theme.spacing.md,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
  },
  progressSubtext: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
    fontWeight: '500',
  },
  dateContainer: {
    alignItems: 'flex-end',
  },
  dateText: {
    fontSize: 13,
    color: theme.colors.textMuted,
    marginBottom: 4,
    fontWeight: '500',
  },
  newBadge: {
    backgroundColor: theme.colors.delivered,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.sm,
  },
  newBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  previewContainer: {
    marginBottom: theme.spacing.sm,
  },
  previewText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    lineHeight: 24,
    marginBottom: theme.spacing.xs,
    fontWeight: '400',
  },
  previewContinue: {
    fontSize: 12,
    color: theme.colors.primary,
    fontStyle: 'italic',
    fontWeight: '500',
  },
  progressContainer: {
    marginBottom: theme.spacing.sm,
  },
  progressBar: {
    height: 10,
    backgroundColor: theme.colors.borderLight,
    borderRadius: 5,
    overflow: 'hidden',
    position: 'relative',
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
  },
  progressIndicator: {
    position: 'absolute',
    top: -10,
    transform: [{ translateX: -12 }],
  },
  progressIndicatorText: {
    fontSize: 18,
  },
  actionHint: {
    alignItems: 'flex-end',
  },
  actionHintText: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.page,
  },
  emptyEmoji: {
    fontSize: 72,
    marginBottom: theme.spacing.xl,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
  },
  composeFirstButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.radius.xl,
    ...theme.shadows.lg,
  },
  composeFirstButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.xl,
  },
  fabText: {
    fontSize: 28,
  },
  // Enhanced Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.card,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    maxHeight: height * 0.92,
    minHeight: height * 0.6,
  },
  modalScroll: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
    backgroundColor: theme.colors.backgroundSecondary,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
  },
  letterStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.lg,
    ...theme.shadows.sm,
  },
  letterTimestamp: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: theme.colors.textMuted,
    fontWeight: '600',
  },
  letterContentContainer: {
    padding: theme.spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  letterContentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  letterContentTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text,
  },
  zoomHint: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontWeight: '500',
  },
  letterPaperContainer: {
    position: 'relative',
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    minHeight: 200,
    maxHeight: 400,
  },
  letterPaperWrapper: {
    flex: 1,
    minHeight: 200,
  },
  letterPaper: {
    backgroundColor: '#ffffff',
    padding: theme.spacing.xl,
    margin: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderLeftWidth: 6,
    borderLeftColor: theme.colors.primary,
    ...theme.shadows.sm,
    minHeight: 160,
    maxHeight: 360,
  },
  letterScrollView: {
    flex: 1,
    maxHeight: 300,
  },
  letterText: {
    fontSize: 18,
    color: theme.colors.text,
    lineHeight: 28,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    textAlign: 'left',
  },
  zoomControls: {
    position: 'absolute',
    bottom: theme.spacing.md,
    right: theme.spacing.md,
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: theme.radius.lg,
    padding: theme.spacing.sm,
  },
  zoomButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 2,
  },
  zoomButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  journeyInfoContainer: {
    padding: theme.spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  journeyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
  },
  journeyDetails: {
    gap: theme.spacing.md,
  },
  journeyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  journeyLabel: {
    fontSize: 14,
    color: theme.colors.textMuted,
    fontWeight: '500',
    flex: 1,
  },
  journeyValue: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  progressVisualization: {
    padding: theme.spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
    backgroundColor: theme.colors.backgroundSecondary,
  },
  progressTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  },
  visualProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
  },
  progressStep: {
    alignItems: 'center',
  },
  progressDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.colors.borderLight,
    marginBottom: theme.spacing.sm,
    borderWidth: 2,
    borderColor: theme.colors.card,
  },
  progressDotActive: {
    backgroundColor: theme.colors.success,
    borderColor: theme.colors.success,
  },
  progressLine: {
    height: 6,
    width: 80,
    backgroundColor: theme.colors.inTransit,
    marginHorizontal: theme.spacing.lg,
    borderRadius: 3,
  },
  progressLabel: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontWeight: '500',
  },
  progressPercentage: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.inTransit,
    textAlign: 'center',
  },
  modalActions: {
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
    backgroundColor: theme.colors.backgroundSecondary,
  },
  markReadButton: {
    backgroundColor: theme.colors.success,
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    ...theme.shadows.md,
  },
  markReadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  viewMapButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    ...theme.shadows.md,
  },
  viewMapButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Full Screen Modal Styles
  fullScreenModal: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  fullScreenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
    backgroundColor: '#ffffff',
    ...theme.shadows.sm,
  },
  backButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  backButtonText: {
    fontSize: 16,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  fullScreenHeaderInfo: {
    flex: 1,
    alignItems: 'center',
  },
  fullScreenTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 2,
  },
  fullScreenSubtitle: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  markReadHeaderButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markReadHeaderText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  fullScreenContent: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  fullScreenContentContainer: {
    padding: theme.spacing.lg,
    minHeight: height - 200, // Ensure full scrollable area
  },
  fullScreenLetterContainer: {
    backgroundColor: '#ffffff',
    borderRadius: theme.radius.md,
    padding: theme.spacing.xl,
    minHeight: height - 250,
  },
  fullScreenLetterText: {
    fontSize: 18,
    lineHeight: 32,
    color: theme.colors.text,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    textAlign: 'justify',
    letterSpacing: 0.3,
  },
  fullScreenZoomControls: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: theme.radius.lg,
    padding: theme.spacing.sm,
    ...theme.shadows.lg,
  },
  fullScreenZoomButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  fullScreenZoomButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});