// App.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import theme from './src/theme';

import HomeScreen from './src/screens/HomeScreen';
import FlightSetupScreen from './src/screens/FlightSetupScreen';
import ComposeScreen from './src/screens/ComposeScreen';
import VaultScreen from './src/screens/VaultScreen';
import MapScreen from './src/screens/MapScreen';
// import PDFViewerScreen from './src/screens/PDFViewerScreen';

// inside <Stack.Navigator>



const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.primary },
          headerTintColor: '#fff',
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="FlightSetup" component={FlightSetupScreen} options={{ title: 'Flight Setup' }} />
        <Stack.Screen name="Compose" component={ComposeScreen} />
        <Stack.Screen name="Vault" component={VaultScreen} />
        {/* <Stack.Screen name="PDFViewer" component={PDFViewerScreen} options={{ title: 'View PDF' }} /> */}
        <Stack.Screen name="Map" component={MapScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
