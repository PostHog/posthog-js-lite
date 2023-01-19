// In index.js of a new project
import {Navigation} from 'react-native-navigation';
import {HomeScreen, SettingsScreen} from './App';
import {$posthog} from './posthog';

Navigation.registerComponent('Home', () => HomeScreen);
Navigation.registerComponent('Settings', () => SettingsScreen);

Navigation.events().registerAppLaunchedListener(async () => {
  $posthog.then(ph => {
    ph.initReactNativeNavigation({
      navigation: {
        routeToProperties(name, params) {
          return params;
        },
      },
    });
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
                  //   icon: require('./home.png'),
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
                  //   icon: require('./profile.png'),
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
