// src/screens/VaultScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Image,
  TextInput,
  Modal
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import theme from '../theme';

const VAULT_KEY = '@airletters_vault';

export default function VaultScreen() {
  const [boardingPasses, setBoardingPasses] = useState([]);
  const [selectedPass, setSelectedPass] = useState(null);
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [currentNote, setCurrentNote] = useState('');
  const [editingPassId, setEditingPassId] = useState(null);

  useEffect(() => {
    loadBoardingPasses();
  }, []);

  const loadBoardingPasses = async () => {
    try {
      const raw = await AsyncStorage.getItem(VAULT_KEY);
      const passes = raw ? JSON.parse(raw) : [];
      setBoardingPasses(passes);
    } catch (error) {
      console.warn('Failed to load boarding passes:', error);
    }
  };

  const saveBoardingPasses = async (passes) => {
    try {
      await AsyncStorage.setItem(VAULT_KEY, JSON.stringify(passes));
      setBoardingPasses(passes);
    } catch (error) {
      console.warn('Failed to save boarding passes:', error);
    }
  };

  const addBoardingPass = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        
        // Create a permanent copy in the app's document directory
        const fileName = `boarding_pass_${Date.now()}_${asset.name}`;
        const permanentUri = `${FileSystem.documentDirectory}${fileName}`;
        
        await FileSystem.copyAsync({
          from: asset.uri,
          to: permanentUri,
        });

        const newPass = {
          id: Math.random().toString(36).slice(2),
          name: asset.name || 'Boarding Pass',
          type: asset.mimeType || 'unknown',
          size: asset.size || 0,
          uri: permanentUri,
          originalUri: asset.uri,
          addedAt: new Date().toISOString(),
          notes: '',
          tags: [],
        };

        const updatedPasses = [...boardingPasses, newPass];
        await saveBoardingPasses(updatedPasses);
        
        Alert.alert('Added!', 'Boarding pass added to vault successfully.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to add boarding pass: ' + error.message);
      console.warn('Error adding boarding pass:', error);
    }
  };

  const viewBoardingPass = async (pass) => {
    try {
      // Check if file still exists
      const fileInfo = await FileSystem.getInfoAsync(pass.uri);
      if (!fileInfo.exists) {
        Alert.alert('File Missing', 'This boarding pass file no longer exists.');
        return;
      }

      if (pass.type === 'application/pdf') {
        // For PDFs, we'll use sharing since we don't have a PDF viewer
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(pass.uri, {
            mimeType: 'application/pdf',
            dialogTitle: pass.name
          });
        } else {
          Alert.alert('Cannot View', 'PDF viewing not available on this device.');
        }
      } else {
        // For images, show in modal
        setSelectedPass(pass);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to open boarding pass: ' + error.message);
    }
  };

  const deleteBoardingPass = async (passId) => {
    Alert.alert(
      'Delete Boarding Pass',
      'Are you sure you want to delete this boarding pass?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const passToDelete = boardingPasses.find(p => p.id === passId);
              if (passToDelete) {
                // Delete the file
                await FileSystem.deleteAsync(passToDelete.uri, { idempotent: true });
              }
              
              const updatedPasses = boardingPasses.filter(p => p.id !== passId);
              await saveBoardingPasses(updatedPasses);
            } catch (error) {
              console.warn('Error deleting boarding pass:', error);
              Alert.alert('Error', 'Failed to delete boarding pass.');
            }
          }
        }
      ]
    );
  };

  const addNote = (passId) => {
    const pass = boardingPasses.find(p => p.id === passId);
    if (pass) {
      setCurrentNote(pass.notes || '');
      setEditingPassId(passId);
      setNoteModalVisible(true);
    }
  };

  const saveNote = async () => {
    try {
      const updatedPasses = boardingPasses.map(pass =>
        pass.id === editingPassId
          ? { ...pass, notes: currentNote.trim() }
          : pass
      );
      
      await saveBoardingPasses(updatedPasses);
      setNoteModalVisible(false);
      setCurrentNote('');
      setEditingPassId(null);
    } catch (error) {
      Alert.alert('Error', 'Failed to save note.');
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderBoardingPass = (pass) => {
    const isImage = pass.type?.startsWith('image/');
    const isPDF = pass.type === 'application/pdf';

    return (
      <View key={pass.id} style={styles.passCard}>
        <View style={styles.passHeader}>
          <View style={styles.passInfo}>
            <Text style={styles.passName} numberOfLines={1}>
              {isImage ? '🖼️' : isPDF ? '📄' : '📎'} {pass.name}
            </Text>
            <Text style={styles.passDetails}>
              {formatFileSize(pass.size)} • {formatDate(pass.addedAt)}
            </Text>
          </View>
          
          <View style={styles.passActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => viewBoardingPass(pass)}
            >
              <Text style={styles.actionButtonText}>👁️</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => addNote(pass.id)}
            >
              <Text style={styles.actionButtonText}>
                {pass.notes ? '📝' : '📄'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton]}
              onPress={() => deleteBoardingPass(pass.id)}
            >
              <Text style={styles.actionButtonText}>🗑️</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {pass.notes && (
          <View style={styles.noteContainer}>
            <Text style={styles.noteText}>{pass.notes}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyEmoji}>📱</Text>
      <Text style={styles.emptyTitle}>No Boarding Passes</Text>
      <Text style={styles.emptyText}>
        Add your boarding passes, tickets, and travel documents for offline access.
      </Text>
      <TouchableOpacity style={styles.addFirstButton} onPress={addBoardingPass}>
        <Text style={styles.addFirstButtonText}>Add Your First Pass</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Boarding Pass Vault</Text>
          <Text style={styles.subtitle}>
            Store your travel documents offline
          </Text>
          
          {boardingPasses.length > 0 && (
            <Text style={styles.count}>
              {boardingPasses.length} document{boardingPasses.length !== 1 ? 's' : ''} stored
            </Text>
          )}
        </View>

        {boardingPasses.length === 0 ? (
          renderEmptyState()
        ) : (
          <View style={styles.passList}>
            {boardingPasses.map(renderBoardingPass)}
          </View>
        )}
      </ScrollView>

      {/* Add Button */}
      {boardingPasses.length > 0 && (
        <TouchableOpacity style={styles.fab} onPress={addBoardingPass}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}

      {/* Image Viewer Modal */}
      <Modal
        visible={selectedPass !== null}
        animationType="slide"
        onRequestClose={() => setSelectedPass(null)}
      >
        {selectedPass && (
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={1}>
                {selectedPass.name}
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setSelectedPass(null)}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView contentContainerStyle={styles.imageContainer}>
              <Image
                source={{ uri: selectedPass.uri }}
                style={styles.fullImage}
                resizeMode="contain"
              />
            </ScrollView>
          </View>
        )}
      </Modal>

      {/* Note Editor Modal */}
      <Modal
        visible={noteModalVisible}
        animationType="slide"
        onRequestClose={() => setNoteModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Note</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setNoteModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.noteEditor}>
            <TextInput
              style={styles.noteInput}
              placeholder="Add notes about this boarding pass..."
              multiline
              numberOfLines={6}
              value={currentNote}
              onChangeText={setCurrentNote}
              textAlignVertical="top"
            />
            
            <TouchableOpacity style={styles.saveNoteButton} onPress={saveNote}>
              <Text style={styles.saveNoteButtonText}>Save Note</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
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
  header: {
    padding: theme.spacing.page,
    paddingBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.muted,
    marginBottom: 8,
  },
  count: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  passList: {
    paddingHorizontal: theme.spacing.page,
    paddingBottom: 100,
  },
  passCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.card,
    padding: 16,
    marginBottom: 12,
  },
  passHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  passInfo: {
    flex: 1,
    marginRight: 12,
  },
  passName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  passDetails: {
    fontSize: 12,
    color: theme.colors.muted,
  },
  passActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    backgroundColor: '#FEE2E2',
  },
  actionButtonText: {
    fontSize: 16,
  },
  noteContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  noteText: {
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 20,
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabText: {
    fontSize: 24,
    color: '#fff',
    fontWeight: '300',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 60,
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
    lineHeight: 24,
    marginBottom: 24,
  },
  addFirstButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addFirstButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.page,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    flex: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: theme.colors.text,
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.page,
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  noteEditor: {
    flex: 1,
    padding: theme.spacing.page,
  },
  noteInput: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.card,
    padding: 16,
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  saveNoteButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 16,
    borderRadius: theme.radius.card,
    alignItems: 'center',
  },
  saveNoteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});