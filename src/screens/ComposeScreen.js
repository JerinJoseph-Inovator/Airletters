// src/screens/ComposeScreen.js
import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import theme from '../theme';

const LETTERS_KEY = '@airletters_letters';

export default function ComposeScreen({ navigation }) {
  const [text, setText] = useState('');
  const [sendDelayMinutes, setSendDelayMinutes] = useState('45'); // default 45 minutes

  const saveLetter = async () => {
    if (!text.trim()) {
      Alert.alert('Write something', 'Please enter a message.');
      return;
    }

    const now = new Date();
    const scheduledSend = new Date(now.getTime() + parseInt(sendDelayMinutes || '45', 10) * 60000);

    const letter = {
      id: Math.random().toString(36).slice(2),
      text: text.trim(),
      createdAt: now.toISOString(),
      scheduledSendUTC: scheduledSend.toISOString(),
      status: 'scheduled',
    };

    try {
      const raw = await AsyncStorage.getItem(LETTERS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      arr.push(letter);
      await AsyncStorage.setItem(LETTERS_KEY, JSON.stringify(arr));
      Alert.alert('Saved', `Letter scheduled at ${letter.scheduledSendUTC}`);
      setText('');
      navigation.navigate('Map');
    } catch (e) {
      Alert.alert('Save failed', 'Could not store letter locally.');
      console.warn(e);
    }
  };

  return (
    <View style={styles.page}>
      <Text style={styles.title}>Compose Letter</Text>
      <TextInput
        style={styles.inputMultiline}
        placeholder="Write your message..."
        multiline
        numberOfLines={6}
        value={text}
        onChangeText={setText}
      />
      <TextInput
        style={styles.input}
        placeholder="Delay minutes (default 45)"
        keyboardType="numeric"
        value={sendDelayMinutes}
        onChangeText={setSendDelayMinutes}
      />
      <Button title="Schedule Letter" onPress={saveLetter} />
    </View>
  );
}

const styles = {
  page: {
    flex: 1,
    padding: theme.spacing.page,
  },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  inputMultiline: {
    backgroundColor: theme.colors.card,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    textAlignVertical: 'top',
  },
  input: {
    backgroundColor: theme.colors.card,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
};
