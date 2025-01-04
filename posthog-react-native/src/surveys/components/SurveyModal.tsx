import React, { useCallback, useEffect, useState } from 'react'
import { Modal, Pressable, StyleSheet, TouchableWithoutFeedback, View } from 'react-native'

import { Cancel } from './Cancel'
import { ConfirmationMessage } from './ConfirmationMessage'
import { Questions } from './Surveys'

import { SurveyAppearanceTheme } from '../surveys-utils'
import { Survey } from '../posthog-surveys-types'

export type SlypModalProps = {
  survey: Survey
  appearance: SurveyAppearanceTheme
  onShow: () => void
  onClose: (submitted: boolean) => void
}

export function SurveyModal(props: SlypModalProps): JSX.Element | null {
  const { survey, appearance, onShow } = props
  const [isSurveySent, setIsSurveySent] = useState(false)
  const onClose = useCallback(() => props.onClose(isSurveySent), [isSurveySent, props])

  const surveyPopupDelayMilliseconds = appearance.surveyPopupDelaySeconds * 1000
  const [isVisible, setIsVisible] = useState(surveyPopupDelayMilliseconds === 0)
  if (surveyPopupDelayMilliseconds > 0) {
    setTimeout(() => {
      setIsVisible(true)
    }, surveyPopupDelayMilliseconds)
  }

  const shouldShowConfirmation = isSurveySent && appearance.thankYouMessageHeader

  useEffect(() => {
    if (isVisible) {
      onShow()
    }
  }, [isVisible, onShow])

  useEffect(() => {
    let timeout: NodeJS.Timeout | undefined
    if (isVisible && shouldShowConfirmation && appearance.autoDisappear) {
      timeout = setTimeout(() => {
        onClose()
      }, 5000)
    }
    return () => timeout && clearTimeout(timeout)
  }, [isVisible, onClose, shouldShowConfirmation, appearance])

  if (!isVisible) {
    return null
  }

  return (
    <Modal animationType="fade" transparent onRequestClose={onClose} statusBarTranslucent={true}>
      <Pressable style={styles.modalContainer} onPress={onClose} accessible={false}>
        <TouchableWithoutFeedback accessible={false}>
          <View
            style={[
              styles.modalContent,
              { borderColor: appearance.borderColor, backgroundColor: appearance.backgroundColor },
            ]}
          >
            {!shouldShowConfirmation ? (
              <Questions survey={survey} appearance={appearance} onSubmit={() => setIsSurveySent(true)} />
            ) : (
              <ConfirmationMessage
                appearance={appearance}
                header={appearance.thankYouMessageHeader}
                description={appearance.thankYouMessageDescription}
                contentType={appearance.thankYouMessageDescriptionContentType ?? 'text'}
                onClose={onClose}
                isModal={true}
              />
            )}
            <View style={styles.topIconContainer}>
              <Cancel onPress={onClose} appearance={appearance} />
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginVertical: 40, // TODO Plus safe area?
    marginHorizontal: 20,
  },
  modalContent: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 20,
  },
  topIconContainer: {
    position: 'absolute',
    right: -20,
    top: -20,
  },
})
