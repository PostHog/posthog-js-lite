import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import PostHog from "posthog-react-native";

export const posthog = new PostHog('phc_QFbR1y41s5sxnNTZoyKG2NJo2RlsCIWkUfdpawgb40D', { 
  host: 'https://us.i.posthog.com',
  flushAt: 1,
  enableSessionReplay: true,
  })
posthog.debug(true)

export default function App() {
  const [buttonText, setButtonText] = useState('Open up App.js to start working on your app!');

  const handleClick = () => {
    posthog.capture('button_clicked', { name: 'example' });
    setButtonText('button_clicked' + new Date().toISOString());
  };

  return (
    <View style={styles.container}>
      <Text onPress={handleClick}>{buttonText}</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
