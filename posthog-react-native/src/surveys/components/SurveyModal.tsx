import React, { useCallback, useEffect, useState } from 'react'
import { Modal, Pressable, StyleSheet, TouchableWithoutFeedback, View } from 'react-native'

import { Cancel } from './Cancel'
import { ConfirmationMessage } from './ConfirmationMessage'
import { Questions } from './Surveys'

import { SurveyAppearanceTheme } from '../surveys-utils'
import { Survey, SurveyQuestionDescriptionContentType } from '../../../../posthog-core/src/surveys-types'
import { useOptionalSafeAreaInsets } from '../../optional/OptionalReactNativeSafeArea'

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
  const insets = useOptionalSafeAreaInsets()

  // TODO: delay seconds
  // const surveyPopupDelayMilliseconds = appearance.surveyPopupDelaySeconds * 1000
  const [isVisible] = useState(true)
  // if (surveyPopupDelayMilliseconds > 0) {
  //   setTimeout(() => {
  //     setIsVisible(true)
  //   }, surveyPopupDelayMilliseconds)
  // }

  const shouldShowConfirmation = isSurveySent && appearance.thankYouMessageHeader

  useEffect(() => {
    if (isVisible) {
      onShow()
    }
  }, [isVisible, onShow])

  // TODO: auto disappear
  // useEffect(() => {
  //   let timeout: NodeJS.Timeout | undefined
  //   if (isVisible && shouldShowConfirmation && appearance.autoDisappear) {
  //     timeout = setTimeout(() => {
  //       onClose()
  //     }, 5000)
  //   }
  //   return () => timeout && clearTimeout(timeout)
  // }, [isVisible, onClose, shouldShowConfirmation, appearance])

  if (!isVisible) {
    return null
  }

  return (
    <Modal animationType="fade" transparent onRequestClose={onClose} statusBarTranslucent={true}>
      <Pressable
        style={[styles.modalContainer, { marginBottom: insets.bottom + 20 }]}
        onPress={onClose}
        accessible={false}
      >
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
                contentType={
                  appearance.thankYouMessageDescriptionContentType ?? SurveyQuestionDescriptionContentType.Text
                }
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
    marginHorizontal: 20,
  },
  modalContent: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    marginHorizontal: 20,
  },
  topIconContainer: {
    position: 'absolute',
    right: -20,
    top: -20,
  },
})
