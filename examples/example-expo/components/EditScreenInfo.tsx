import { useFeatureFlags } from 'posthog-react-native'
import React from 'react'
import { ScrollView, StyleSheet, TouchableOpacity, View, Text } from 'react-native'

import posthog from '../posthog'

export default function EditScreenInfo({ path }: { path: string }) {
  const trackRandomEvent = () => {
    posthog.capture('random event', {
      random: Math.random(),
    })
  }

  const identifyUser = () => {
    const id = Math.round(Math.random() * 1000)
    posthog.identify(`user-${id}`, {
      email: `user-${id}@posthog.com`,
    })
  }

  const flags = useFeatureFlags()

  return (
    <View>
      <View style={styles.getStartedContainer}>
        <Text style={styles.getStartedText}>Feature Flags:</Text>

        {flags ? (
          <ScrollView style={[styles.featueFlags]}>
            <View>
              {Object.keys(flags).map((key) => (
                <Text key={key}>
                  {key}: {JSON.stringify(flags[key])}
                </Text>
              ))}
            </View>
          </ScrollView>
        ) : (
          <Text>Loading feature flags...</Text>
        )}

        <Text testID="example-ph-no-capture" ph-no-capture style={styles.getStartedText}>
          I have the property "ph-no-capture" which means touching me will not be picked up by autocapture
        </Text>

        <Text testID="example-ph-label" ph-label="special-text" style={styles.getStartedText}>
          I have the property "ph-label" which means touching me will be autocaptured with a specific label
        </Text>
      </View>

      <View style={styles.helpContainer}>
        <TouchableOpacity onPress={() => trackRandomEvent()} style={styles.helpLink}>
          <Text style={styles.helpLinkText}>Tap here to track a random event!</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => identifyUser()} style={styles.helpLink}>
          <Text style={styles.helpLinkText}>Simulate login and identify!</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  getStartedContainer: {
    alignItems: 'center',
    marginHorizontal: 50,
  },
  homeScreenFilename: {
    marginVertical: 7,
  },
  featueFlags: {
    borderRadius: 3,
    paddingHorizontal: 4,
    height: 100,
    flexGrow: 0,
  },
  getStartedText: {
    fontSize: 17,
    lineHeight: 24,
    textAlign: 'center',
  },
  helpContainer: {
    marginTop: 15,
    marginHorizontal: 20,
    alignItems: 'center',
  },
  helpLink: {
    paddingVertical: 15,
  },
  helpLinkText: {
    textAlign: 'center',
  },
})
