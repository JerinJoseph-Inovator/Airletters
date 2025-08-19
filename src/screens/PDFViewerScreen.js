import React, { useEffect, useState } from 'react';
import { StyleSheet, Dimensions, View, ActivityIndicator, Alert, Button, Platform, Text } from 'react-native';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { WebView } from 'react-native-webview';
import * as IntentLauncher from 'expo-intent-launcher';

export default function PDFViewerScreen({ route }) {
  const { assetModule } = route.params;
  const [localUri, setLocalUri] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const asset = Asset.fromModule(assetModule);
        // Ensure the asset is downloaded and get a local URI
        await asset.downloadAsync();
        // asset.localUri is where the file lives after download
        const sourceUri = asset.localUri || asset.uri;

        // For consistency, copy to cacheDirectory where WebView/other apps can access
        const filename = sourceUri.split('/').pop();
        const dest = `${FileSystem.cacheDirectory}${filename}`;

        // If the file is not already present in cache, copy it
        const info = await FileSystem.getInfoAsync(dest);
        if (!info.exists) {
          await FileSystem.copyAsync({ from: sourceUri, to: dest });
        }

        if (mounted) setLocalUri(dest);
      } catch (err) {
        console.warn('Failed to prepare PDF for viewing', err);
        Alert.alert('Unable to open document', 'The document could not be prepared for viewing. You can open it in another app instead.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [assetModule]);

  const openExternal = async () => {
    if (!localUri) {
      Alert.alert('No file', 'File is not ready yet.');
      return;
    }
    try {
      if (Platform.OS === 'android') {
        // Convert file:// URI to content:// URI so it can be safely shared via Intent
        try {
          const contentUri = await FileSystem.getContentUriAsync(localUri);
          // Debug: show content URI so you can confirm the path in logs/device
          console.log('Opening contentUri:', contentUri);
          // FLAG_GRANT_READ_URI_PERMISSION (allow receiver to read) + FLAG_ACTIVITY_NEW_TASK
          const FLAG_GRANT_READ_URI_PERMISSION = 1; // compatible value for many Android APIs
          const FLAG_ACTIVITY_NEW_TASK = 0x10000000; // 268435456
          const flags = FLAG_GRANT_READ_URI_PERMISSION | FLAG_ACTIVITY_NEW_TASK;

          await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
            data: contentUri,
            type: 'application/pdf',
            flags,
          });
          return;
        } catch (innerErr) {
          console.warn('Open external error (android content uri)', innerErr);
          // Fall back to sharing if Intent launch fails
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(localUri, { mimeType: 'application/pdf' });
            return;
          }
          // otherwise continue to generic fallback below
        }
      }

      // Fallback for iOS / other platforms: use Sharing
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(localUri, { mimeType: 'application/pdf' });
      } else {
        Alert.alert('Share not available', 'Cannot open document in external app on this device.');
      }
    } catch (err) {
      console.warn('Open external error', err);
      Alert.alert('Error', 'Failed to open document: ' + (err?.message || err));
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!localUri) {
    return (
      <View style={styles.center}>
        <Button title="Open in external app" onPress={openExternal} />
      </View>
    );
  }

  // On Android (Expo Go), loading file:// URIs inside WebView can fail with ERR_ACCESS_DENIED.
  // Prefer opening the file in an external app instead of embedding it.
  if (Platform.OS === 'android') {
    return (
      <View style={styles.center}>
        <Text style={{ marginBottom: 12, textAlign: 'center' }}>
          PDF preview may not be supported inside Expo Go on Android.
          Use an external PDF viewer to open this document.
        </Text>
        <Button title="Open in external app" onPress={openExternal} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        originWhitelist={["*"]}
        source={{ uri: localUri }}
        style={styles.webview}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.center}><ActivityIndicator size="large" /></View>
        )}
      />
      <View style={styles.footer}>
        <Button title="Open in external app" onPress={openExternal} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  webview: { flex: 1, width: Dimensions.get('window').width },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  footer: { padding: 8, backgroundColor: '#fff' },
});
