import React, { useState } from 'react';
import { View, Text, StyleSheet, Button, ScrollView, Alert, Platform, ActivityIndicator } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';
import * as Sharing from 'expo-sharing';
import theme from '../theme';

// Try to import IntentLauncher for Android
let IntentLauncher = null;
try {
  IntentLauncher = require('expo-intent-launcher');
} catch (error) {
  console.log('IntentLauncher not available, will use sharing fallback');
}

// Helper to open PDF with better user experience
async function openPDF(assetModule, title = 'PDF') {
  try {
    // Download and prepare the PDF file
    const asset = Asset.fromModule(assetModule);
    await asset.downloadAsync();

    // Create a proper PDF filename with .pdf extension
    const pdfFileName = `${title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    const destUri = `${FileSystem.cacheDirectory}${pdfFileName}`;
    
    await FileSystem.copyAsync({
      from: asset.localUri || asset.uri,
      to: destUri,
    });

    // Try Android Intent Launcher first for direct opening
    if (Platform.OS === 'android' && IntentLauncher) {
      try {
        // Get content URI for better Android compatibility
        const contentUri = await FileSystem.getContentUriAsync(destUri);
        
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          type: 'application/pdf',
          flags: 1, // FLAG_ACTIVITY_NEW_TASK
        });
        return; // Success! Exit early
      } catch (intentError) {
        console.log('Direct opening failed, falling back to sharing:', intentError);
        // Continue to sharing fallback below
      }
    }

    // Fallback to sharing (iOS or Android fallback)

    // Check if sharing is available
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      Alert.alert(
        'No PDF Viewer Found', 
        'Please install a PDF viewer app to view your documents.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Use sharing with optimized options for better recognition
    await Sharing.shareAsync(destUri, {
      mimeType: 'application/pdf',
      dialogTitle: `Open ${title}`,
      UTI: 'com.adobe.pdf', // iOS specific - helps target PDF apps
    });

  } catch (err) {
    console.error('Error opening PDF:', err);
    Alert.alert(
      'Error Opening PDF', 
      'Could not open the PDF file. Please make sure you have a PDF viewer app installed.',
      [{ text: 'OK' }]
    );
  }
}

export default function VaultScreen() {
  const [loadingPdf, setLoadingPdf] = useState(null);

  const handleOpenPdf = async (assetModule, title) => {
    setLoadingPdf(title);
    try {
      await openPDF(assetModule, title);
    } finally {
      setLoadingPdf(null);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.heading}>Tickets</Text>
      <View style={styles.buttonGroup}>
        {loadingPdf === 'Anjali\'s Ticket' ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Opening PDF...</Text>
          </View>
        ) : (
          <Button
            title="View Ticket - Anjali"
            onPress={() => handleOpenPdf(require('../../assets/pdfs/Itinerary_A_done.pdf'), 'Anjali\'s Ticket')}
          />
        )}
      </View>
      <View style={styles.buttonGroup}>
        {loadingPdf === 'Jerin\'s Ticket' ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Opening PDF...</Text>
          </View>
        ) : (
          <Button
            title="View Ticket - Jerin"
            onPress={() => handleOpenPdf(require('../../assets/pdfs/Itinerary_J_done.pdf'), 'Jerin\'s Ticket')}
          />
        )}
      </View>

      <Text style={styles.heading}>Boarding Passes</Text>
      <View style={styles.buttonGroup}>
        {loadingPdf === 'Anjali\'s Boarding Pass' ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Opening PDF...</Text>
          </View>
        ) : (
          <Button
            title="View Boarding Pass - Anjali"
            onPress={() => handleOpenPdf(require('../../assets/pdfs/Itinerary_A_done.pdf'), 'Anjali\'s Boarding Pass')}
          />
        )}
      </View>
      <View style={styles.buttonGroup}>
        {loadingPdf === 'Jerin\'s Boarding Pass' ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Opening PDF...</Text>
          </View>
        ) : (
          <Button
            title="View Boarding Pass - Jerin"
            onPress={() => handleOpenPdf(require('../../assets/pdfs/Itinerary_J_done.pdf'), 'Jerin\'s Boarding Pass')}
          />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.page,
  },
  heading: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginVertical: 12,
  },
  buttonGroup: {
    marginBottom: 10,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: theme.colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  loadingText: {
    marginLeft: 8,
    color: theme.colors.primary,
    fontSize: 16,
  },
});
