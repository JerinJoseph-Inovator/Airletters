// src/screens/ComposeScreen.js
import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  ScrollView,
  KeyboardAvoidingView,
  Platform 
} from 'react-native';
import { saveLetter } from '../lib/storage';
import theme from '../theme';

const PRESET_DELAYS = [
  { label: '15 min', value: 15 },
  { label: '45 min', value: 45 },
  { label: '2 hours', value: 120 },
  { label: '4 hours', value: 240 },
];

export default function ComposeScreen({ navigation }) {
  const [text, setText] = useState('');
  const [sendDelayMinutes, setSendDelayMinutes] = useState(45);
  const [isCustomDelay, setIsCustomDelay] = useState(false);
  const [customDelayText, setCustomDelayText] = useState('45');

  const handleSaveLetter = async () => {
    if (!text.trim()) {
      Alert.alert('Write something', 'Please enter a message before sending.');
      return;
    }

    try {
      const letter = await saveLetter(text, sendDelayMinutes);
      const delayText = sendDelayMinutes < 60 
        ? `${sendDelayMinutes} minutes`
        : `${Math.round(sendDelayMinutes / 60 * 10) / 10} hours`;
      
      Alert.alert(
        'Letter Scheduled! ✉️', 
        `Your letter will begin its journey in ${delayText}.`,
        [{ text: 'View on Map', onPress: () => navigation.navigate('Map') }]
      );
      setText('');
    } catch (error) {
      Alert.alert('Failed to send', 'Could not schedule your letter. Please try again.');
    }
  };

  const selectPresetDelay = (minutes) => {
    setSendDelayMinutes(minutes);
    setIsCustomDelay(false);
  };

  const handleCustomDelaySubmit = () => {
    const parsed = parseInt(customDelayText, 10);
    if (parsed > 0) {
      setSendDelayMinutes(parsed);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.page} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Compose Letter</Text>
        <Text style={styles.subtitle}>
          Write a message to your fellow traveler ✈️
        </Text>
        
        <TextInput
          style={styles.inputMultiline}
          placeholder="Dear fellow traveler,&#10;&#10;I hope your journey is going well..."
          placeholderTextColor={theme.colors.muted}
          multiline
          numberOfLines={8}
          value={text}
          onChangeText={setText}
          textAlignVertical="top"
        />
        
        <Text style={styles.sectionTitle}>Delivery Timing</Text>
        <Text style={styles.hint}>
          Choose when your letter should begin its journey
        </Text>
        
        <View style={styles.delayOptions}>
          {PRESET_DELAYS.map((preset) => (
            <TouchableOpacity
              key={preset.value}
              style={[
                styles.delayButton,
                sendDelayMinutes === preset.value && !isCustomDelay && styles.delayButtonActive
              ]}
              onPress={() => selectPresetDelay(preset.value)}
            >
              <Text style={[
                styles.delayButtonText,
                sendDelayMinutes === preset.value && !isCustomDelay && styles.delayButtonTextActive
              ]}>
                {preset.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        
        <TouchableOpacity 
          style={styles.customDelayToggle}
          onPress={() => setIsCustomDelay(!isCustomDelay)}
        >
          <Text style={styles.customDelayText}>
            {isCustomDelay ? '← Use presets' : 'Custom timing →'}
          </Text>
        </TouchableOpacity>
        
        {isCustomDelay && (
          <View style={styles.customDelayContainer}>
            <TextInput
              style={styles.customDelayInput}
              placeholder="Minutes"
              keyboardType="numeric"
              value={customDelayText}
              onChangeText={setCustomDelayText}
              onSubmitEditing={handleCustomDelaySubmit}
            />
            <TouchableOpacity 
              style={styles.customDelayButton}
              onPress={handleCustomDelaySubmit}
            >
              <Text style={styles.customDelayButtonText}>Set</Text>
            </TouchableOpacity>
          </View>
        )}
        
        <View style={styles.previewContainer}>
          <Text style={styles.previewTitle}>Preview:</Text>
          <Text style={styles.previewText}>
            Letter will start traveling in {sendDelayMinutes < 60 
              ? `${sendDelayMinutes} minutes` 
              : `${Math.round(sendDelayMinutes / 60 * 10) / 10} hours`
            }, then take ~5 minutes to reach the other flight.
          </Text>
        </View>
      </ScrollView>
      
      <View style={styles.bottomContainer}>
        <TouchableOpacity style={styles.sendButton} onPress={handleSaveLetter}>
          <Text style={styles.sendButtonText}>Schedule Letter ✉️</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  page: {
    flex: 1,
    padding: theme.spacing.page,
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
    marginBottom: 20,
  },
  inputMultiline: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.card,
    padding: 16,
    marginBottom: 24,
    minHeight: 120,
    fontSize: 16,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  hint: {
    fontSize: 14,
    color: theme.colors.muted,
    marginBottom: 12,
  },
  delayOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  delayButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: theme.colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  delayButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  delayButtonText: {
    fontSize: 14,
    color: theme.colors.text,
    fontWeight: '500',
  },
  delayButtonTextActive: {
    color: '#fff',
  },
  customDelayToggle: {
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  customDelayText: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  customDelayContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  customDelayInput: {
    flex: 1,
    backgroundColor: theme.colors.card,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  customDelayButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  customDelayButtonText: {
    color: '#fff',
    fontWeight: '500',
  },
  previewContainer: {
    backgroundColor: theme.colors.card,
    padding: 16,
    borderRadius: theme.radius.card,
    marginBottom: 20,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  previewText: {
    fontSize: 14,
    color: theme.colors.muted,
    lineHeight: 20,
  },
  bottomContainer: {
    padding: theme.spacing.page,
    backgroundColor: theme.colors.background,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  sendButton: {
    backgroundColor: theme.colors.accent,
    paddingVertical: 16,
    borderRadius: theme.radius.card,
    alignItems: 'center',
  },
  sendButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
});