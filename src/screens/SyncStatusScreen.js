// src/screens/SyncStatusScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView
} from 'react-native';
import { performSync, getSyncStatus, getOrCreateDeviceId, isOnline } from '../lib/syncManager';
import theme from '../theme';

export default function SyncStatusScreen() {
  const [syncStatus, setSyncStatus] = useState(null);
  const [deviceId, setDeviceId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState(null);

  useEffect(() => {
    loadInitialData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadSyncStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadInitialData = async () => {
    const id = await getOrCreateDeviceId();
    setDeviceId(id);
    await loadSyncStatus();
  };

  const loadSyncStatus = async () => {
    const status = await getSyncStatus();
    setSyncStatus(status);
  };

  const handleManualSync = async () => {
    setIsLoading(true);
    try {
      const result = await performSync();
      setLastSyncResult(result);
      
      if (result.success) {
        if (result.offlineMode) {
          Alert.alert(
            'Offline Sync Complete 📱',
            `Letters updated using smart estimation.\nEstimated progress for ${result.estimated} letters.`
          );
        } else {
          Alert.alert(
            'Sync Complete! ✅',
            `Successfully synced with server.\n• ${result.newFromRemote} new letters from remote\n• ${result.uploadedToRemote} letters uploaded\n• Total: ${result.merged} letters`
          );
        }
      } else {
        Alert.alert('Sync Failed', result.error || 'Unknown error occurred');
      }
    } catch (error) {
      Alert.alert('Sync Error', 'Failed to sync data: ' + error.message);
    } finally {
      setIsLoading(false);
      await loadSyncStatus();
    }
  };

  const getCurrentConnectionStatus = () => {
    return isOnline() ? 'Online' : 'Offline';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Sync Status</Text>
        
        {/* Connection Status */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Text style={styles.cardTitle}>Connection Status</Text>
            <Text style={[
              styles.statusIndicator,
              { color: isOnline() ? '#10B981' : '#EF4444' }
            ]}>
              {getCurrentConnectionStatus()} {isOnline() ? '🟢' : '🔴'}
            </Text>
          </View>
          <Text style={styles.cardText}>
            Device ID: {deviceId}
          </Text>
        </View>

        {/* Last Sync Status */}
        <View style={styles.statusCard}>
          <Text style={styles.cardTitle}>Last Sync</Text>
          <Text style={styles.cardText}>
            {formatDate(syncStatus?.lastSyncAt)}
          </Text>
          
          {syncStatus?.offlineEstimation && (
            <View style={styles.offlineBadge}>
              <Text style={styles.offlineText}>
                📱 Offline Estimation Mode
              </Text>
            </View>
          )}
          
          {syncStatus?.isOnline === false && (
            <Text style={styles.warningText}>
              ⚠️ Last sync was in offline mode - using smart estimation
            </Text>
          )}
          
          <Text style={styles.cardSubtext}>
            Letters: {syncStatus?.letterCount || 0}
          </Text>
        </View>

        {/* Last Sync Result */}
        {lastSyncResult && (
          <View style={styles.statusCard}>
            <Text style={styles.cardTitle}>Last Sync Result</Text>
            
            {lastSyncResult.success ? (
              <View>
                {lastSyncResult.offlineMode ? (
                  <View>
                    <Text style={styles.successText}>✅ Offline sync successful</Text>
                    <Text style={styles.cardText}>
                      Estimated progress for {lastSyncResult.estimated} letters
                    </Text>
                  </View>
                ) : (
                  <View>
                    <Text style={styles.successText}>✅ Online sync successful</Text>
                    <Text style={styles.cardText}>
                      • New from remote: {lastSyncResult.newFromRemote}
                    </Text>
                    <Text style={styles.cardText}>
                      • Uploaded to remote: {lastSyncResult.uploadedToRemote}
                    </Text>
                    <Text style={styles.cardText}>
                      • Total letters: {lastSyncResult.merged}
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <Text style={styles.errorText}>
                ❌ Sync failed: {lastSyncResult.error}
              </Text>
            )}
          </View>
        )}

        {/* Sync Explanation */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>How Sync Works</Text>
          <Text style={styles.infoText}>
            <Text style={styles.bold}>Online Mode:</Text> Syncs letters with other devices, merges data intelligently.
          </Text>
          <Text style={styles.infoText}>
            <Text style={styles.bold}>Offline Mode:</Text> Uses smart estimation to predict letter progress based on time.
          </Text>
          <Text style={styles.infoText}>
            <Text style={styles.bold}>Auto-merge:</Text> When back online, automatically merges offline progress with remote data.
          </Text>
        </View>

        {/* Manual Sync Button */}
        <TouchableOpacity
          style={[styles.syncButton, isLoading && styles.syncButtonDisabled]}
          onPress={handleManualSync}
          disabled={isLoading}
        >
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.syncButtonText}>Syncing...</Text>
            </View>
          ) : (
            <Text style={styles.syncButtonText}>
              🔄 Manual Sync
            </Text>
          )}
        </TouchableOpacity>

        <Text style={styles.footnote}>
          Sync happens automatically when the app starts and periodically in the background.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.page,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 20,
  },
  statusCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.card,
    padding: 16,
    marginBottom: 16,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
  },
  cardText: {
    fontSize: 16,
    color: theme.colors.text,
    marginBottom: 4,
  },
  cardSubtext: {
    fontSize: 14,
    color: theme.colors.muted,
  },
  statusIndicator: {
    fontSize: 16,
    fontWeight: '600',
  },
  offlineBadge: {
    backgroundColor: '#FEF3C7',
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
    marginBottom: 8,
  },
  offlineText: {
    color: '#92400E',
    fontWeight: '500',
    fontSize: 14,
  },
  warningText: {
    color: '#F59E0B',
    fontSize: 14,
    marginTop: 4,
    marginBottom: 8,
  },
  successText: {
    color: '#10B981',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '500',
  },
  infoCard: {
    backgroundColor: '#F3F4F6',
    borderRadius: theme.radius.card,
    padding: 16,
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 20,
    marginBottom: 8,
  },
  bold: {
    fontWeight: '600',
  },
  syncButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 16,
    borderRadius: theme.radius.card,
    alignItems: 'center',
    marginBottom: 16,
  },
  syncButtonDisabled: {
    backgroundColor: theme.colors.muted,
  },
  syncButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footnote: {
    fontSize: 12,
    color: theme.colors.muted,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});