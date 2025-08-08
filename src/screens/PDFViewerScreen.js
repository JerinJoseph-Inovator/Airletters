import React from 'react';
import { StyleSheet, Dimensions } from 'react-native';
import Pdf from 'react-native-pdf';
import { Asset } from 'expo-asset';

export default function PDFViewerScreen({ route }) {
  const { assetModule } = route.params;
  const asset = Asset.fromModule(assetModule);
  const source = { uri: asset.uri, cache: true };

  return (
    <Pdf
      source={source}
      style={styles.pdf}
      onError={(error) => {
        console.log('PDF load error:', error);
      }}
    />
  );
}

const styles = StyleSheet.create({
  pdf: {
    flex: 1,
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
});
