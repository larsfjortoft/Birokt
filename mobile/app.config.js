const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = ({ config }) =>
  withAndroidManifest(config, (androidConfig) => {
    config.plugins = [
      ...(config.plugins || []),
      [
        'expo-audio',
        {
          microphonePermission: 'Birokt trenger mikrofontilgang for feltmodus.',
        },
      ],
    ];

    config.android = {
      ...(config.android || {}),
      permissions: Array.from(
        new Set([...(config.android?.permissions || []), 'android.permission.RECORD_AUDIO'])
      ),
    };

    // Birokt runs against the private Raspberry Pi API on the local network.
    // Android blocks HTTP by default unless this is set in the generated manifest.
    delete androidConfig.modResults.manifest.$['android:usesCleartextTraffic'];
    androidConfig.modResults.manifest.application[0].$['android:usesCleartextTraffic'] = 'true';
    return androidConfig;
  });
