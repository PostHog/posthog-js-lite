# Contributing

## Building and deploying

React Native uses Metro as it's bundling system which has some unique behaviors. As such we have to bundle this part of the project differently with special babel config and keeping the original file structure rather than rolling up to a single file. This is due to the way that [Metro handles optional imports](https://github.com/facebook/metro/issues/836) leading us to need multiple files rather than one bundle file.
