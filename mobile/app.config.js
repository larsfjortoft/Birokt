const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = ({ config }) =>
  withAndroidManifest(config, (androidConfig) => {
    // Birøkt runs against the private Raspberry Pi API on the local network.
    // Android blocks HTTP by default unless this is set in the generated manifest.
    delete androidConfig.modResults.manifest.$['android:usesCleartextTraffic'];
    androidConfig.modResults.manifest.application[0].$['android:usesCleartextTraffic'] = 'true';
    return androidConfig;
  });
