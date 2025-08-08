// src/screens/LettersScreen.js
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl
} from 'react-native';
import { processLetterStatuses, markLetterAsRead, LETTER_STATUS } from '../lib/storage';
import theme from '../theme';

const STATUS_COLORS = {
  [LETTER_STATUS.SCHEDULED]: '#6B7280',
  [LETTER_STATUS.IN_TRANSIT]: '#3B82F6', 
  [LETTER_STATUS.DELIVERED]: '#F59E0B',
  [LETTER_STATUS.READ]: '#10B981'
};

const STATUS_EMOJIS = {
  [LETTER_STATUS.SCHEDULED]: '⏰',
  [LETTER_STATUS.IN_TRANSIT]: '✉️',
  [LETTER_STATUS.DELIVERED]: '📬',
  [LETTER_STATUS.READ]: '📭'
};

const STATUS_LABELS = {
  [LETTER_STATUS.SCHEDULED]: 'Scheduled',
  [LETTER_STATUS.IN_TRANSIT]: 'In Transit',
  [LETTER_STATUS.DELIVERED]: 'Delivered',
  [LETTER_STATUS.READ]: 'Read'
};

export default function LettersScreen() {
  const [letters, setLetters] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadLetters = async () => {
    try {
      const updatedLetters = await processLetterStatuses();
      // Sort by creation date, newest first
      const sorted = updatedLetters.sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
      );
      setLetters(sorted);
    } catch (error) {
      console.warn('Failed to load letters:', error);
    }
  };

  useEffect(() => {
    loadLetters();
    // Auto-refresh every 10 seconds
    const interval = setInterval(loadLetters, 10000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadLetters();
    setRefreshing(false);
  };

  const handleLetterPress = async (letter) => {
    if (letter.status === LETTER_STATUS.DELIVERED) {
      Alert.alert(
        'Letter Message ✉️',
        letter.text,
        [
          {
            text: 'Mark as Read',
            onPress: async () => {
              await markLetterAsRead(letter.id);
              await loadLetters();
            }
          },
          { text: 'Close', style: 'cancel' }
        ]
      );
    } else if (letter.status === LETTER_STATUS.READ) {
      Alert.alert('Letter Message ✉️', letter.text);
    } else {
      Alert.alert(
        'Letter Status',
        letter.status === LETTER_STATUS.SCHEDULED 
          ? 'This letter is scheduled to begin traveling soon.'
          : 'This letter is currently traveling between flights.'
      );
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderLetterItem = ({ item: letter }) => {
    const preview = letter.text.length > 50 
      ? letter.text.substring(0, 50) + '...'
      : letter.text;

    return (
      <TouchableOpacity
        style={[
          styles.letterItem,
          letter.status === LETTER_STATUS.DELIVERED && styles.unreadItem
        ]}
        onPress={() => handleLetterPress(letter)}
      >
        <View style={styles.letterHeader}>
          <View style={styles.statusContainer}>
            <Text style={styles.statusEmoji}>
              {STATUS_EMOJIS[letter.status]}
            </Text>
            <Text style={[
              styles.statusText,
              { color: STATUS_COLORS[letter.status] }
            ]}>
              {STATUS_LABELS[letter.status]}
            </Text>
          </View>
          <Text style={styles.dateText}>
            {formatDate(letter.createdAt)}
          </Text>
        </View>
        
        <Text style={styles.previewText}>{preview}</Text>
        
        {letter.status === LETTER_STATUS.IN_TRANSIT && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill,
                  { width: `${(letter.animationProgress || 0) * 100}%` }
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {Math.round((letter.animationProgress || 0) * 100)}% delivered
            </Text>
          </View>
        )}
        
        {letter.status === LETTER_STATUS.DELIVERED && (
          <Text style={styles.deliveredBadge}>New! Tap to read</Text>
        )}
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyEmoji}>✉️</Text>
      <Text style={styles.emptyTitle}>No Letters Yet</Text>
      <Text style={styles.emptyText}>
        Compose your first letter to start your aerial correspondence!
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={letters}
        keyExtractor={(item) => item.id}
        renderItem={renderLetterItem}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  listContainer: {
    padding: theme.spacing.page,
    paddingBottom: 100, // Extra space at bottom
  },
  letterItem: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.card,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  unreadItem: {
    borderColor: theme.colors.accent,
    borderWidth: 2,
  },
  letterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusEmoji: {
    fontSize: 16,
    marginRight: 6,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dateText: {
    fontSize: 12,
    color: theme.colors.muted,
  },
  previewText: {
    fontSize: 16,
    color: theme.colors.text,
    lineHeight: 22,
    marginBottom: 8,
  },
  progressContainer: {
    marginTop: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
  },
  progressText: {
    fontSize: 12,
    color: theme.colors.muted,
    textAlign: 'right',
  },
  deliveredBadge: {
    fontSize: 12,
    color: theme.colors.accent,
    fontWeight: '600',
    textAlign: 'right',
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.muted,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 24,
  },
});