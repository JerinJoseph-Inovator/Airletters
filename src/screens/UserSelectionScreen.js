// src/screens/UserSelectionScreen.js
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Dimensions } from 'react-native';
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
    
    // Show confirmation
    Alert.alert(
      `Confirm Selection`,
      `You selected User ${userType}. This will determine your flight assignment and letter directions.\n\n${userType === 'A' ? 'Flight A: Bengaluru → Chandigarh' : 'Flight B: Bengaluru → Mumbai'}`,
      [
        {
          text: 'Change',
          style: 'cancel',
          onPress: () => setSelectedUser(null)
        },
        {
          text: 'Confirm',
          onPress: () => handleUserSelection(userType)
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Welcome to AirLetters ✈️</Text>
        <Text style={styles.subtitle}>Choose your identity to begin</Text>
      </View>

      <View style={styles.selectionContainer}>
        <Text style={styles.instructionText}>
          Select which user you are to determine your flight and letter exchange direction:
        </Text>

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
            <Text style={styles.userLetter}>A</Text>
            <Text style={styles.userTitle}>User A</Text>
          </View>
          
          <View style={styles.flightInfo}>
            <Text style={styles.flightNumber}>Flight 6E 6633</Text>
            <Text style={styles.flightRoute}>Bengaluru → Chandigarh</Text>
            <Text style={styles.flightDetails}>BLR Terminal 1 → IXC</Text>
          </View>

          <View style={styles.letterDirection}>
            <Text style={styles.directionText}>📨 You send letters to User B</Text>
            <Text style={styles.directionText}>📬 You receive letters from User B</Text>
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
            <Text style={styles.userLetter}>B</Text>
            <Text style={styles.userTitle}>User B</Text>
          </View>
          
          <View style={styles.flightInfo}>
            <Text style={styles.flightNumber}>Flight 6E 5205</Text>
            <Text style={styles.flightRoute}>Bengaluru → Mumbai</Text>
            <Text style={styles.flightDetails}>BLR Terminal 1 → BOM Terminal 1</Text>
          </View>

          <View style={styles.letterDirection}>
            <Text style={styles.directionText}>📨 You send letters to User A</Text>
            <Text style={styles.directionText}>📬 You receive letters from User A</Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          This selection determines which flight you're on and the direction of letter exchanges during the journey.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.page,
  },
  header: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl * 2,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  selectionContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  instructionText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xl * 2,
    lineHeight: 24,
    paddingHorizontal: theme.spacing.lg,
  },
  userCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
    borderWidth: 3,
    borderColor: 'transparent',
    ...theme.shadows.lg,
  },
  userCardA: {
    borderLeftWidth: 6,
    borderLeftColor: '#4CAF50', // Green for User A
  },
  userCardB: {
    borderLeftWidth: 6,
    borderLeftColor: '#2196F3', // Blue for User B
  },
  selectedCard: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.cardElevated,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  userLetter: {
    fontSize: 48,
    fontWeight: '900',
    color: theme.colors.primary,
    marginRight: theme.spacing.md,
  },
  userTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text,
  },
  flightInfo: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
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
  },
  letterDirection: {
    gap: theme.spacing.sm,
  },
  directionText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  footer: {
    paddingVertical: theme.spacing.xl,
  },
  footerText: {
    fontSize: 14,
    color: theme.colors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 20,
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
