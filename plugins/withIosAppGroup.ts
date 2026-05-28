import { ConfigPlugin, withEntitlementsPlist, withInfoPlist } from 'expo/config-plugins';

const APP_GROUP_ID = 'group.com.jshir700.syncclipboardmobile';

/**
 * Add App Group entitlement and Info.plist entries for iOS Share Extension support.
 */
const withIosAppGroup: ConfigPlugin = (config) => {
  // Add App Group entitlement
  config = withEntitlementsPlist(config, (modConfig) => {
    const entitlements = modConfig.modResults;

    if (!entitlements['com.apple.security.application-groups']) {
      entitlements['com.apple.security.application-groups'] = [];
    }
    const groups = entitlements['com.apple.security.application-groups'] as string[];
    if (!groups.includes(APP_GROUP_ID)) {
      groups.push(APP_GROUP_ID);
    }

    return modConfig;
  });

  // Add BGTaskScheduler identifiers to Info.plist
  config = withInfoPlist(config, (modConfig) => {
    const plist = modConfig.modResults;

    if (!plist.BGTaskSchedulerPermittedIdentifiers) {
      plist.BGTaskSchedulerPermittedIdentifiers = [];
    }
    const ids = plist.BGTaskSchedulerPermittedIdentifiers as string[];
    const required = [
      'com.jshir700.syncclipboardmobile.refresh',
      'com.jshir700.syncclipboardmobile.processing',
    ];
    for (const id of required) {
      if (!ids.includes(id)) {
        ids.push(id);
      }
    }

    // App Group identifier for Share Extension
    plist.AppGroupIdentifier = APP_GROUP_ID;

    return modConfig;
  });

  return config;
};

export default withIosAppGroup;
