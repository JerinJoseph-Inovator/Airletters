// src/screens/UserSelectionScreen.js
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Dimensions, SafeAreaView, StatusBar, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import theme from '../theme';

const { width } = Dimensions.get('window');
const USER_SELECTION_KEY = '@airletters_user_selection';

export default function UserSelectionScreen({ navigation }) {
  const [selectedUser, setSelectedUser] = useState(null);

  const handleUserSelection = async (userType) => {
    try {
      // Save the user selection
      await AsyncStorage.setItem(USER_SELECTION_KEY, userType);
      
      // Navigate to Home screen
      navigation.replace('Home', { userType });
    } catch (error) {
      console.error('Failed to save user selection:', error);
      Alert.alert('Error', 'Failed to save user selection. Please try again.');
    }
  };

  const handleUserPress = (userType) => {
    setSelectedUser(userType);
    
    const flightInfo = userType === 'A' 
      ? 'Flight 6E 6633: Bengaluru → Chandigarh' 
      : 'Flight 6E 5205: Bengaluru → Mumbai';
    
    const recipientUser = userType === 'A' ? 'B' : 'A';
    
    // Show confirmation with enhanced messaging
    Alert.alert(
      `Confirm User ${userType} Selection`,
      `You've selected User ${userType}.\n\n✈️ Your Flight: ${flightInfo}\n\n📨 You'll send letters to User ${recipientUser}\n📬 You'll receive letters from User ${recipientUser}\n\nThis selection determines your flight assignment and letter exchange directions throughout your journey.`,
      [
        {
          text: 'Change Selection',
          style: 'cancel',
          onPress: () => setSelectedUser(null)
        },
        {
          text: 'Confirm & Continue',
          style: 'default',
          onPress: () => handleUserSelection(userType)
        }
      ],
      { cancelable: true }
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />
      
      {/* Header with gradient-like effect */}
      <View style={styles.headerContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>Welcome to AirLetters</Text>
          <Text style={styles.titleEmoji}>✈️</Text>
          <Text style={styles.subtitle}>Choose your identity to begin your journey</Text>
        </View>
      </View>

      {/* Scrollable main content */}
      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        <View style={styles.instructionContainer}>
          <Text style={styles.instructionTitle}>Select Your User Identity</Text>
          <Text style={styles.instructionText}>
            Your selection determines which flight you'll be on and the direction of letter exchanges during the journey.
          </Text>
        </View>

        <View style={styles.selectionContainer}>
          <TouchableOpacity
            style={[
              styles.userCard,
              styles.userCardA,
              selectedUser === 'A' && styles.selectedCard
            ]}
            onPress={() => handleUserPress('A')}
            activeOpacity={0.8}
          >
            <View style={styles.userHeader}>
              <View style={styles.userBadge}>
                <Text style={styles.userLetter}>A</Text>
              </View>
              <View style={styles.userTitleContainer}>
                <Text style={styles.userTitle}>User A</Text>
                <Text style={styles.userSubtitle}>Primary Traveler</Text>
              </View>
            </View>
            
            <View style={styles.flightInfo}>
              <View style={styles.flightHeader}>
                <Text style={styles.flightLabel}>✈️ Your Flight</Text>
              </View>
              <Text style={styles.flightNumber}>Flight 6E 6633</Text>
              <Text style={styles.flightRoute}>Bengaluru → Chandigarh</Text>
              <Text style={styles.flightDetails}>BLR Terminal 1 → IXC</Text>
            </View>

            <View style={styles.letterDirection}>
              <Text style={styles.directionTitle}>Letter Exchange</Text>
              <View style={styles.directionItem}>
                <Text style={styles.directionIcon}>📨</Text>
                <Text style={styles.directionText}>Send letters to User B</Text>
              </View>
              <View style={styles.directionItem}>
                <Text style={styles.directionIcon}>📬</Text>
                <Text style={styles.directionText}>Receive letters from User B</Text>
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.userCard,
              styles.userCardB,
              selectedUser === 'B' && styles.selectedCard
            ]}
            onPress={() => handleUserPress('B')}
            activeOpacity={0.8}
          >
            <View style={styles.userHeader}>
              <View style={styles.userBadge}>
                <Text style={styles.userLetter}>B</Text>
              </View>
              <View style={styles.userTitleContainer}>
                <Text style={styles.userTitle}>User B</Text>
                <Text style={styles.userSubtitle}>Secondary Traveler</Text>
              </View>
            </View>
            
            <View style={styles.flightInfo}>
              <View style={styles.flightHeader}>
                <Text style={styles.flightLabel}>✈️ Your Flight</Text>
              </View>
              <Text style={styles.flightNumber}>Flight 6E 5205</Text>
              <Text style={styles.flightRoute}>Bengaluru → Mumbai</Text>
              <Text style={styles.flightDetails}>BLR Terminal 1 → BOM Terminal 1</Text>
            </View>

            <View style={styles.letterDirection}>
              <Text style={styles.directionTitle}>Letter Exchange</Text>
              <View style={styles.directionItem}>
                <Text style={styles.directionIcon}>📨</Text>
                <Text style={styles.directionText}>Send letters to User A</Text>
              </View>
              <View style={styles.directionItem}>
                <Text style={styles.directionIcon}>📬</Text>
                <Text style={styles.directionText}>Receive letters from User A</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Footer inside ScrollView */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            💡 You can change your selection later from the home screen settings
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  headerContainer: {
    backgroundColor: theme.colors.primary,
    paddingTop: StatusBar.currentHeight || 0,
    paddingBottom: theme.spacing.xl * 2,
    borderBottomLeftRadius: theme.radius.xl * 2,
    borderBottomRightRadius: theme.radius.xl * 2,
    ...theme.shadows.lg,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: theme.spacing.page,
    paddingTop: theme.spacing.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
  },
  titleEmoji: {
    fontSize: 36,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    fontWeight: '500',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: theme.spacing.page,
    paddingTop: theme.spacing.xl,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.page,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.xl * 2,
  },
  instructionContainer: {
    marginBottom: theme.spacing.xl,
    alignItems: 'center',
  },
  instructionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  instructionText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: theme.spacing.md,
  },
  selectionContainer: {
    marginBottom: theme.spacing.xl,
  },
  userCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    ...theme.shadows.lg,
    elevation: 8,
  },
  userCardA: {
    borderTopWidth: 4,
    borderTopColor: '#4CAF50',
  },
  userCardB: {
    borderTopWidth: 4,
    borderTopColor: '#2196F3',
  },
  selectedCard: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.cardElevated,
    transform: [{ scale: 1.02 }],
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  userBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
    ...theme.shadows.md,
  },
  userLetter: {
    fontSize: 28,
    fontWeight: '900',
    color: '#fff',
  },
  userTitleContainer: {
    flex: 1,
  },
  userTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 2,
  },
  userSubtitle: {
    fontSize: 14,
    color: theme.colors.textMuted,
    fontWeight: '500',
  },
  flightInfo: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  flightHeader: {
    marginBottom: theme.spacing.sm,
  },
  flightLabel: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  flightNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  flightRoute: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.primary,
    marginBottom: theme.spacing.xs,
  },
  flightDetails: {
    fontSize: 14,
    color: theme.colors.textMuted,
    fontWeight: '500',
  },
  letterDirection: {
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
  },
  directionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  directionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  directionIcon: {
    fontSize: 16,
    marginRight: theme.spacing.sm,
    width: 24,
  },
  directionText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: '500',
    flex: 1,
  },
  footer: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
    backgroundColor: theme.colors.cardElevated,
    borderRadius: theme.radius.lg,
    marginTop: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  footerText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 18,
  },
});

// Export function to get stored user selection
export async function getUserSelection() {
  try {
    const userType = await AsyncStorage.getItem(USER_SELECTION_KEY);
    return userType;
  } catch (error) {
    console.error('Failed to get user selection:', error);
    return null;
  }
}

// Export function to clear user selection (for testing/reset)
export async function clearUserSelection() {
  try {
    await AsyncStorage.removeItem(USER_SELECTION_KEY);
  } catch (error) {
    console.error('Failed to clear user selection:', error);
  }
}
