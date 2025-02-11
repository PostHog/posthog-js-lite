# PostHog React Native Surveys

A port of survey UI and hooks from [poshog-js](https://github.com/PostHog/posthog-js) to React Native.

Adds support for popover and manually triggered surveys when using posthog-react-native.

## Usage

Add `PostHogSurveyProvider` to your app anywhere inside `PostHogProvider`. This component fetches surveys and provides hooks described below. It also acts as the root for where popover surveys are rendered.

```tsx
<PostHogProvider /*... your config ...*/>
  <PostHogSurveyProvider>{children}</PostHogSurveyProvider>
</PostHogProvider>
```

Survey appearance respects settings in the Customization section of the survey setup.
If you want to override this so that all surveys use your app theme, you can set

```tsx
<PostHogProvider /*... your config ...*/>
  <PostHogSurveyProvider
        overrideAppearanceWithDefault={true}
        defaultSurveyAppearance={{ ... }}>
    {children}
</PostHogSurveyProvider>
</PostHogProvider>
```

### Feedback Button Surveys

While this library doesn't provide the beta Feedback Widget UI, you can manually trigger a survey using your own button by using the `useFeedbackSurvey` hook.

When creating your survey in PostHog set:

- Presentation = Feedback button
- Customization -> Feedback button type = Custom
- Customization -> Class or ID selector = The value you pass to `useFeedbackSurvey`

```ts
export function FeedbackButton() {
  const feedbackSurvey = useFeedbackSurvey('MySurveySelector')

  const onPress = () => {
    if (feedbackSurvey) {
      feedbackSurvey.showSurveyModal()
    } else {
      // Your fallback in case this survey doesn't exist
    }
  }

  return <Button onPress={onPress} title="Send Feedback" />
}
```

### Custom Components

By default, popover surveys are shown automatically. You can disable this by setting `automaticSurveyModal={false}`.

The hook `useActiveSurvey` will return the survey that should currently be displayed.
You can also import the `<Questions>` component directly and pass your own survey appearance if you'd like to reuse the survey content in your own modal or screen.

```ts
import { useActiveSurvey, type SurveyAppearance } from 'posthog-react-native'

const appearance: SurveyAppearance = {
  // ... Your theme here
}

export function SurveyScreen() {
  const activeSurvey = useActiveSurvey()
  if (!activeSurvey) return null

  const { survey, onShow, onClose } = activeSurvey

  const onSubmit = () => {
    // e.g. you might show your own thank you message here
    onClose()
  }

  useEffect(() => {
    // Call this once when the survey is show
    onShow()
  }, [onShow])

  return (
    <View style={styles.surveyScreen}>
      <Questions
        survey={survey}
        onSubmit={onSubmit}
        appearance={appearance}
        styleOverride={styles.surveyScrollViewStyle}
      />
    </View>
  )
}
```

## Supported Features

| Feature                           | Support                            |
| --------------------------------- | ---------------------------------- |
| **Questions**                     |                                    |
| All question types                | ✅                                 |
| Multi-question surveys            | ✅                                 |
| Confirmation message              | ✅ When using default modal UI     |
| **Feedback Button Presentation**  |                                    |
| Custom feedback button            | ✅ Via `useFeedbackSurvey` hook    |
| Pre-built feedback tab            | ❌                                 |
| **Customization / Appearance**    | _When using default modal UI_      |
| Set colors in PostHog Dashboard   | ✅ Or override with your app theme |
| Shuffle Questions                 | ✅                                 |
| PostHog branding                  | ❌ Always off                      |
| Delay popup after page load       | ✅                                 |
| Position config                   | ❌ Always bottom center            |
| **Display conditions**            |                                    |
| Feature flag & property targeting | ✅                                 |
| URL Targeting                     | ❌                                 |
| CSS Selector Matches              | ❌                                 |
| Survey Wait period                | ✅                                 |
| Event Triggers                    | ✅                                 |
| Action Triggers                   | ❌                                 |
