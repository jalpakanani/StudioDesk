/**
 * Open Search as a pushed screen (root stack). Not a tab.
 */
export function navigateToDeskSearch(navigation) {
  let current = navigation;
  for (let i = 0; i < 8 && current; i += 1) {
    const state = current.getState?.();
    if (state?.routeNames?.includes('SearchDesk')) {
      current.navigate('SearchDesk');
      return true;
    }
    current = current.getParent?.();
  }
  return false;
}
