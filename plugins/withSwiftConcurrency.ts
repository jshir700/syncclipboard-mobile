import { ConfigPlugin, withDangerousMod } from 'expo/config-plugins';
import { readFileSync, writeFileSync } from 'fs';

const withSwiftConcurrency: ConfigPlugin = (config) => {
  return withDangerousMod(config, [
    'ios',
    (mod) => {
      const podfilePath = mod.modRequest.platformProjectRoot + '/Podfile';
      let content = readFileSync(podfilePath, 'utf-8');
      if (!content.includes('SWIFT_STRICT_CONCURRENCY')) {
        content = content.replace(
          'post_install do |installer|',
          `post_install do |installer|
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['SWIFT_STRICT_CONCURRENCY'] = 'minimal'
    end
  end`
        );
        writeFileSync(podfilePath, content);
      }
      return mod;
    },
  ]);
};

export default withSwiftConcurrency;
