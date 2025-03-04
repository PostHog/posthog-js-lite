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

## Supported Features

| Feature                           | Support                            |
| --------------------------------- | ---------------------------------- |
| **Questions**                     |                                    |
| All question types                | ✅                                 |
| Multi-question surveys            | ✅                                 |
| Confirmation message              | ✅ When using default modal UI     |
| **Feedback Button Presentation**  |                                    |
| Custom feedback button            | ❌                                 |
| Pre-built feedback tab            | ❌                                 |
| **Customization / Appearance**    | _When using default modal UI_      |
| Set colors in PostHog Dashboard   | ✅ Or override with your app theme |
| Shuffle Questions                 | ❌                                 |
| PostHog branding                  | ❌ Always off                      |
| Delay popup after page load       | ❌                                 |
| Position config                   | ❌ Always bottom center            |
| **Display conditions**            |                                    |
| Feature flag & property targeting | ✅                                 |
| URL Targeting                     | ❌                                 |
| Device type Targeting             | ❌                                 |
| CSS Selector Matches              | ❌                                 |
| Survey Wait period                | ❌                                 |
| Event Triggers                    | ✅                                 |
| Action Triggers                   | ❌                                 |
