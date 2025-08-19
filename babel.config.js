module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Use the Reanimated plugin that matches Expo SDK 53
      'react-native-reanimated/plugin'
    ]
  };
};
