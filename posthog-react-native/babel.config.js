module.exports = {
  presets: [
    'module:metro-react-native-babel-preset',
    '@babel/env',
    '@babel/preset-typescript',
    ['@babel/preset-react', { runtime: 'automatic' }],
  ],
}
