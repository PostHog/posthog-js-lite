# 2.1.4 - 2022-10-28

Also include the fix in the compiled `lib` folder.

# 2.1.3 - 2022-10-27

Actually include the fix.

# 2.1.2 - 2022-10-27

Fix bug where all values set while stored data was being loaded would get overwritten once the data was done loading.

# 2.1.1 - 2022-09-09

Support for bootstrapping feature flags and distinctIDs. This allows you to initialise the library with a set of feature flags and distinctID that are immediately available.

# 2.1.0 - 2022-09-02

PosthogProvider `autocapture` can be configured with `captureLifecycleEvents: false` and `captureScreens: false` if you want do disable these autocapture elements. Both of these default to `true`
