# PostHog React Native

Please see the main [PostHog docs](https://www.posthog.com/docs).

Specifically, the [React Native integration](https://www.posthog.com/docs/integrations/react-native-integration) details.

## Questions?

### [Join our Slack community.](https://join.slack.com/t/posthogusers/shared_invite/enQtOTY0MzU5NjAwMDY3LTc2MWQ0OTZlNjhkODk3ZDI3NDVjMDE1YjgxY2I4ZjI4MzJhZmVmNjJkN2NmMGJmMzc2N2U3Yjc3ZjI5NGFlZDQ)

## Installation

### Expo Apps

```sh
expo install posthog-react-native expo-file-system expo-application expo-device expo-localization
```

### React Native Apps

```sh
yarn add posthog-react-native @react-native-async-storage/async-storage react-native-device-info
# or
npm i -s posthog-react-native @react-native-async-storage/async-storage react-native-device-info
```

## Usage

### With the PosthogProvider

The best way to use PostHog is via the `PosthogProvider` which enables featues like `Autocapture` as well as providing posthog through your app via `context`.

```jsx
// App.(js|ts)
import PostHog, { usePostHog } from 'posthog-react-native'
...

export function MyApp() {
    return (
        <PostHogProvider apiKey="<ph_project_api_key>" options={{
            // (Optional) PostHog API host (https://app.posthog.com by default)
            host: '<ph_instance_address>',
        }}>
            <MyComponent />
        </PostHogProvider>
    )
}

// Now you can simply access posthog elsewhere in the app like so

const MyComponent = () => {
    const posthog = usePostHog()

    useEffect(() => {
        posthog.capture("MyComponent loaded", { foo: "bar" })
    }, [])
}
```

### Without the PosthogProvider

Due to the Async nature of React Native, PostHog needs to be initialised asynchronously in order for the persisted state to be loaded properly. The `PosthogProvider` takes care of this under-the-hood but you can alternatively create the instance yourself like so:

```tsx
// posthog.ts
import PostHog from 'posthog-react-native'

export let posthog: PostHog | undefined = undefined

export const posthogPromise: Promise<PostHog> = PostHog.initAsync('<ph_project_api_key>', {
  // PostHog API host (https://app.posthog.com by default)
  host: '<ph_instance_address>',
})

posthogPromise.then((client) => {
  posthog = client
})


// app.ts
import { posthog, posthogPromise} from './posthog'

export function MyApp1() {
    useEffect(() => {
        // Use posthog optionally with the possibility that it may still be loading
        posthog?.capture('MyApp1 loaded')
        // OR use posthog via the promise
        posthogPromise.then(ph => ph.capture('MyApp1 loaded')
    }, [])

    return <View>{...}</View>
}


// You can even use this instance with the PostHogProvider
export function MyApp2() {
  return <PostHogProvider client={posthog}>{/* Your app code */}</PostHogProvider>
}
```

### Implementing a custom solution for native dependencies

If you do not want to use either the `expo` libraries or the `async-storage / react-native-device-info` dependencies listed in the installation you can instead pass in the required information from whatever library you choose.

```sh
# You don't need to install any other dependencies
yarn add posthog-react-native
```

```tsx
const customAppProperties = {
  /** Build number like "1.2.2" or "122" */
  $app_build?: string | null,
  /** Name of the app as displayed below the icon like "PostHog" */
  $app_name?: string | null,
  /** Namespace of the app usually like "com.posthog.app" */
  $app_namespace?: string | null,
  /** Human friendly app version like what a user would see in the app store like "1.2.2" */
  $app_version?: string | null,
  /** Manufacturer like "Apple", "Samsung" or "Android" */
  $device_manufacturer?: string | null,
  /** Readable model name like "iPhone 12" */
  $device_name?: string | null,
  /** Operating system name like iOS or Android */
  $os_name?: string | null,
  /** Operating system version "14.0" */
  $os_version?: string | null,
  /** Locale (language) of the device like "en-US" */
  $locale?: string | null,
  /** Timezone of the device like "Europe/Berlin" */
  $timezone?: string | null
}

const posthog = new PostHog({
  customAppProperties,
  customAsyncStorage: {
    getItem: (key: string): Promise<string | null> => { /* IMPLEMENT */},
    setItem (key: string, value: string): Promise<void> => { /* IMPLEMENT */}
  }
})
```

# Development

## Building and deploying

React Native uses Metro as it's bundling system which has some unique behaviors. As such we have to bundle this part of the project differently with special babel config and keeping the original file structure rather than rolling up to a single file. This is due to the way that [Metro handles optional imports](https://github.com/facebook/metro/issues/836) leading us to need multiple files rather than one bundle file.
