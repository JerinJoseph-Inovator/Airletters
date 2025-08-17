// App.js
import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import theme from './src/theme';
import SyncStatusScreen from './src/screens/SyncStatusScreen';
import HomeScreen from './src/screens/HomeScreen';
import FlightSetupScreen from './src/screens/FlightSetupScreen';
import ComposeScreen from './src/screens/ComposeScreen';
import VaultScreen from './src/screens/VaultScreen';
import MapScreen from './src/screens/MapScreen';
import LettersScreen from './src/screens/LettersScreen';
import UserSelectionScreen, { getUserSelection } from './src/screens/UserSelectionScreen';
import MovieTimeScreen from './src/screens/MovieTimeScreen';
// import PDFViewerScreen from './src/screens/PDFViewerScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [initialRoute, setInitialRoute] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkUserSelection();
  }, []);

  const checkUserSelection = async () => {
    try {
      const userType = await getUserSelection();
      if (userType) {
        setInitialRoute('Home');
      } else {
        setInitialRoute('UserSelection');
      }
    } catch (error) {
      console.error('Failed to check user selection:', error);
      setInitialRoute('UserSelection');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return null; // Or a loading screen
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.primary },
          headerTintColor: '#fff',
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Stack.Screen 
          name="UserSelection" 
          component={UserSelectionScreen} 
          options={{ headerShown: false }}
        />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="FlightSetup" component={FlightSetupScreen} options={{ title: 'Flight Setup' }} />
        <Stack.Screen name="Compose" component={ComposeScreen} options={{ title: 'Compose Letter' }} />
        <Stack.Screen name="Letters" component={LettersScreen} options={{ title: 'Letter History' }} />
        <Stack.Screen name="MovieTime" component={MovieTimeScreen} options={{ title: 'Movie Time' }} />
        <Stack.Screen name="Vault" component={VaultScreen} />
        <Stack.Screen name="Map" component={MapScreen} />
        {/* <Stack.Screen name="PDFViewer" component={PDFViewerScreen} options={{ title: 'View PDF' }} /> */}
      </Stack.Navigator>
    </NavigationContainer>
  );
}