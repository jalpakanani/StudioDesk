/**
 * Jump to the Settings tab (from any nested navigator or root stack above MainTabs).
 */
export function navigateToDeskSettings(navigation) {
  let current = navigation;
  for (let i = 0; i < 10 && current; i += 1) {
    const state = current.getState?.();
    const routeNames = state?.routeNames;
    if (routeNames?.includes('Settings')) {
      current.navigate('Settings');
      return true;
    }
    if (routeNames?.includes('MainTabs')) {
      current.navigate('MainTabs', { screen: 'Settings' });
      return true;
    }
    current = current.getParent?.();
  }
  return false;
}
