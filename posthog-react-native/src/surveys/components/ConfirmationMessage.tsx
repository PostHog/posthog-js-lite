import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { getContrastingTextColor, SurveyAppearanceTheme } from '../surveys-utils'
import { SurveyQuestionDescriptionContentType } from '../../../../posthog-core/src/posthog-surveys-types'
import { BottomSection } from './BottomSection'

export function ConfirmationMessage({
  appearance,
  header,
  description,
  contentType,
  onClose,
  styleOverrides,
  isModal,
}: {
  appearance: SurveyAppearanceTheme
  header: string
  description: string
  contentType?: SurveyQuestionDescriptionContentType
  onClose: () => void
  styleOverrides?: object
  isModal: boolean
}): JSX.Element {
  const textColor = getContrastingTextColor(appearance.backgroundColor)

  return (
    <View style={styleOverrides}>
      <View style={styles.thankYouMessageContainer}>
        <Text style={[styles.thankYouMessageHeader, { color: textColor }]}>{header}</Text>
        {description && contentType === 'text' && <Text>{description} </Text>}
      </View>
      {isModal && (
        <BottomSection
          text={appearance.thankYouMessageCloseButtonText}
          submitDisabled={false}
          appearance={appearance}
          onSubmit={onClose}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  thankYouMessageContainer: {
    padding: 10,
  },
  thankYouMessageHeader: {
    fontSize: 18,
    fontWeight: 'bold',
  },
})
