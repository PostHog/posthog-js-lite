import * as WebBrowser from 'expo-web-browser'
import { StyleSheet, TouchableOpacity } from 'react-native'

import Colors from '../constants/Colors'
import posthog from '../posthog'
import { Text, View } from './Themed'

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

  return (
    <View>
      <View style={styles.getStartedContainer}>
        <Text style={styles.getStartedText} lightColor="rgba(0,0,0,0.8)" darkColor="rgba(255,255,255,0.8)">
          You are looking at:
        </Text>

        <View
          style={[styles.codeHighlightContainer, styles.homeScreenFilename]}
          darkColor="rgba(255,255,255,0.05)"
          lightColor="rgba(0,0,0,0.05)"
        >
          <Text>{path}</Text>
        </View>

        <Text
          ph-no-capture
          style={styles.getStartedText}
          lightColor="rgba(0,0,0,0.8)"
          darkColor="rgba(255,255,255,0.8)"
        >
          I have the property "ph-no-capture" which means touching me will not be picked up by autocapture
        </Text>

        <Text
          ph-label="special-text"
          style={styles.getStartedText}
          lightColor="rgba(0,0,0,0.8)"
          darkColor="rgba(255,255,255,0.8)"
        >
          I have the property "ph-label" which means touching me will be autocaptured with a specific label
        </Text>
      </View>

      <View style={styles.helpContainer}>
        <TouchableOpacity onPress={() => trackRandomEvent()} style={styles.helpLink}>
          <Text style={styles.helpLinkText} lightColor={Colors.light.tint}>
            Tap here to track a random event!
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => identifyUser()} style={styles.helpLink}>
          <Text style={styles.helpLinkText} lightColor={Colors.light.tint}>
            Simulate login and identify!
          </Text>
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
  codeHighlightContainer: {
    borderRadius: 3,
    paddingHorizontal: 4,
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
