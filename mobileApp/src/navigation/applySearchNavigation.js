/**
 * After picking a search result, leave SearchDesk without leaving it in the stack (no Back → Search).
 * Use navigate(..., { pop: true }) so the root stack pops to the existing MainTabs route and merges
 * nested tab params. replace() swaps in a fresh MainTabs key and can drop nested state / feel like a wrong "back".
 */
function goToMainTabs(navigation, tabScreen, tabParams) {
  const state = navigation.getState?.();
  const top = state?.routes?.[state?.index];
  const onSearch = top?.name === 'SearchDesk';

  const mainTabsPayload = {
    screen: tabScreen,
    params: tabParams,
  };

  if (onSearch) {
    navigation.navigate('MainTabs', mainTabsPayload, { pop: true });
    return;
  }

  navigation.navigate('MainTabs', mainTabsPayload);
}

export function applySearchResultNavigation(navigation, item) {
  if (item.kind === 'client') {
    goToMainTabs(navigation, 'Clients', { highlightClientId: item.id });
    return;
  }
  if (item.kind === 'order') {
    goToMainTabs(navigation, 'Orders', {
      screen: 'OrdersList',
      params: { highlightOrderId: item.id },
    });
    return;
  }
  goToMainTabs(navigation, 'Field', { highlightVisitId: item.id });
}
