// In index.js of a new project
import {Navigation} from 'react-native-navigation';
import {HomeScreen, SettingsScreen} from './App';
import {$posthog} from './posthog';

Navigation.registerComponent('Home', () => HomeScreen);
Navigation.registerComponent('Settings', () => SettingsScreen);

Navigation.events().registerAppLaunchedListener(async () => {
  (await $posthog).initReactNativeNavigation({
    navigation: {
      // (Optional) Set the name based on the route. Defaults to the route name.
      routeToName: (name, properties) => name,

      // (Optional) Tracks all passProps as properties. Defaults to undefined
      routeToProperties: (name, properties) => properties,
    },
  });

  Navigation.setRoot({
    root: {
      bottomTabs: {
        id: 'BOTTOM_TABS_LAYOUT',
        children: [
          {
            stack: {
              id: 'Home',
              children: [
                {
                  component: {
                    id: 'Home',
                    name: 'Home',
                  },
                },
              ],
              options: {
                bottomTab: {
                  text: 'Home',
                },
              },
            },
          },
          {
            stack: {
              id: 'Settings',
              children: [
                {
                  component: {
                    id: 'Settings',
                    name: 'Settings',
                  },
                },
              ],
              options: {
                bottomTab: {
                  text: 'Settings',
                },
              },
            },
          },
        ],
      },
      stack: {
        children: [
          {
            component: {
              name: 'Home',
            },
          },
        ],
      },
    },
  });
});
