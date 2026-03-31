import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useStudio } from '../context/StudioContext';
import {
  calendarWeekRangeISO,
  coerceDateFieldToISO,
  fieldVisitRange,
  formatDateRangeEn,
  orderEventRange,
  rangeOverlapsWindow,
} from '../utils/dateRange';
import { formatINR, sumPayments } from '../utils/money';
import {
  addDaysISO,
  localCalendarTodayISO,
  orderEventStartsTomorrow,
  orderPastDueWithBalance,
  visitTouchesTomorrow,
} from '../utils/reminders';
import {
  buildSettlementRows,
  computeStudioProfit,
  netVisitPendingAfterStudioPay,
  settlementNeedsLinkHint,
} from '../utils/settlement';
import { colors, radius } from '../theme';
import { getDeskNotificationState } from '../notifications/notifeeDesk';
import OpenDeskSearchButton from '../components/OpenDeskSearchButton';
import { navigateToDeskSettings } from '../navigation/navigateSettings';
import {
  deriveOrderWorkflowStatus,
  isOrderWorkflowClosed,
  orderWorkflowLabel,
} from '../utils/orderWorkflow';

const DASH_LIST_PAGE_SIZE_DEFAULT = 5;
const DASH_LIST_PAGE_SIZE_OPTIONS = [5, 10, 15, 20, 25, 50, 100];
const DASH_LIST_PAGE_SIZE_STORAGE = '@deskDashboardListPageSize';

function usePagedSlice(items, pageSize = DASH_LIST_PAGE_SIZE_DEFAULT) {
  const [page, setPage] = useState(1);
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize) || 1);

  useEffect(() => {
    setPage(1);
  }, [pageSize]);

  useEffect(() => {
    setPage(p => Math.min(Math.max(1, p), pageCount));
  }, [pageCount]);

  const slice = useMemo(() => {
    const p = Math.min(Math.max(1, page), pageCount);
    const start = (p - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize, pageCount]);

  const safePage = Math.min(Math.max(1, page), pageCount);

  return {
    page: safePage,
    setPage,
    pageCount,
    slice,
    total,
  };
}

function DashPaginationMobile({
  page,
  pageCount,
  total,
  pageSize,
  setPage,
  onPageSizeChange,
  pageSizeOptions,
}) {
  const [jumpDraft, setJumpDraft] = useState(() => String(page));

  useEffect(() => {
    setJumpDraft(String(page));
  }, [page]);

  if (total === 0) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  function commitJump() {
    const n = parseInt(jumpDraft, 10);
    if (!Number.isFinite(n)) {
      setJumpDraft(String(page));
      return;
    }
    const c = Math.min(Math.max(1, n), pageCount);
    setPage(c);
    setJumpDraft(String(c));
  }

  return (
    <View style={pagStyles.wrap}>
      <View style={pagStyles.rppRow}>
        <Text style={pagStyles.rppLabel}>Rows per page</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={pagStyles.rppChipsInner}
        >
          {pageSizeOptions.map(n => (
            <TouchableOpacity
              key={n}
              style={[pagStyles.rppChip, pageSize === n && pagStyles.rppChipOn]}
              onPress={() => onPageSizeChange(n)}
              activeOpacity={0.85}
            >
              <Text
                style={[pagStyles.rppChipTxt, pageSize === n && pagStyles.rppChipTxtOn]}
              >
                {n}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      <Text style={pagStyles.range}>
        {start}-{end} of {total} {total === 1 ? 'row' : 'rows'}
      </Text>
      <View style={pagStyles.navRow}>
        <TouchableOpacity
          style={pagStyles.iconBtn}
          disabled={page <= 1}
          onPress={() => setPage(1)}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        >
          <Text style={[pagStyles.iconBtnTxt, page <= 1 && pagStyles.iconBtnTxtOff]}>
            |‹‹
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          disabled={page <= 1}
          onPress={() => setPage(p => Math.max(1, p - 1))}
          style={pagStyles.navTxtBtn}
        >
          <Text style={[pagStyles.navLink, page <= 1 && pagStyles.navLinkOff]}>
            ‹ Previous
          </Text>
        </TouchableOpacity>
        <TextInput
          style={pagStyles.jump}
          value={jumpDraft}
          onChangeText={t => setJumpDraft(t.replace(/\D/g, ''))}
          onBlur={commitJump}
          onSubmitEditing={commitJump}
          keyboardType="number-pad"
          returnKeyType="done"
          selectTextOnFocus
        />
        <Text style={pagStyles.ofText}>of {pageCount}</Text>
        <TouchableOpacity
          disabled={page >= pageCount}
          onPress={() => setPage(p => Math.min(pageCount, p + 1))}
          style={pagStyles.navTxtBtn}
        >
          <Text style={[pagStyles.navLink, page >= pageCount && pagStyles.navLinkOff]}>
            Next ›
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={pagStyles.iconBtn}
          disabled={page >= pageCount}
          onPress={() => setPage(pageCount)}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        >
          <Text style={[pagStyles.iconBtnTxt, page >= pageCount && pagStyles.iconBtnTxtOff]}>
            ››|
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const pagStyles = StyleSheet.create({
  wrap: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: 10,
  },
  rppRow: { gap: 8 },
  rppLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
  },
  rppChipsInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  rppChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  rppChipOn: {
    borderColor: colors.primary,
    backgroundColor: colors.secondaryPillBg,
  },
  rppChipTxt: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  rppChipTxtOn: { color: colors.primary },
  range: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
  },
  navRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  iconBtn: {
    minWidth: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  iconBtnTxt: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.5,
  },
  iconBtnTxtOff: { color: colors.muted, opacity: 0.5 },
  navTxtBtn: { paddingVertical: 6, paddingHorizontal: 4 },
  navLink: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  navLinkOff: { color: colors.muted, opacity: 0.55 },
  jump: {
    width: 44,
    height: 36,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 8,
    backgroundColor: colors.inputBg,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  ofText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
    marginHorizontal: 2,
  },
});

function todayISO() {
  return localCalendarTodayISO();
}

function isOrderFuture(order, today) {
  const { from, to } = orderEventRange(order);
  const end = to || from;
  if (end) return end >= today;
  const od = coerceDateFieldToISO(order.orderDate);
  if (od) return od >= today;
  return true;
}

function isVisitFuture(v, today) {
  const { from, to } = fieldVisitRange(v);
  const end = to || from;
  if (!end) return false;
  return end >= today;
}

function futureOrderSortKey(order) {
  const { from, to } = orderEventRange(order);
  const end = to || from;
  const od = coerceDateFieldToISO(order.orderDate);
  return end || od || '9999-12-31';
}

function upcomingOrderWhenLabel(order) {
  const { from, to } = orderEventRange(order);
  if (from) return formatDateRangeEn(from, to);
  const od = coerceDateFieldToISO(order.orderDate);
  if (od) return `Booked ${formatDateRangeEn(od, od)}`;
  return '';
}

export default function DashboardScreen() {
  const navigation = useNavigation();
  const { orders, clients, clientById, fieldVisits, syncError } = useStudio();
  const [notifAuth, setNotifAuth] = useState(false);
  const [notifDenied, setNotifDenied] = useState(false);
  const [listPageSize, setListPageSize] = useState(DASH_LIST_PAGE_SIZE_DEFAULT);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(DASH_LIST_PAGE_SIZE_STORAGE)
      .then(raw => {
        if (cancelled || raw == null) return;
        const n = Number(raw);
        if (DASH_LIST_PAGE_SIZE_OPTIONS.includes(n)) {
          setListPageSize(n);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(DASH_LIST_PAGE_SIZE_STORAGE, String(listPageSize)).catch(
      () => {},
    );
  }, [listPageSize]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      getDeskNotificationState().then(({ authorized, denied }) => {
        if (alive) {
          setNotifAuth(authorized);
          setNotifDenied(denied);
        }
      });
      return () => {
        alive = false;
      };
    }, []),
  );

  const t = todayISO();

  const futureOrderRows = useMemo(() => {
    return orders
      .map(o => {
        const received = sumPayments(o.clientPayments);
        const total = Number(o.totalAmount) || 0;
        const due = total - received;
        return { order: o, received, due, total };
      })
      .filter(x => isOrderFuture(x.order, t) && !isOrderWorkflowClosed(x.order, t))
      .sort((a, b) => {
        const c = futureOrderSortKey(a.order).localeCompare(
          futureOrderSortKey(b.order),
        );
        if (c !== 0) return c;
        if (b.due !== a.due) return b.due - a.due;
        return (a.order.title || '').localeCompare(b.order.title || '');
      });
  }, [orders, t]);

  const totalClientDue = useMemo(
    () => futureOrderRows.reduce((s, x) => s + Math.max(0, x.due), 0),
    [futureOrderRows],
  );

  const clientsWithBalanceDue = useMemo(() => {
    const map = new Map();
    for (const o of orders) {
      const received = sumPayments(o.clientPayments);
      const total = Number(o.totalAmount) || 0;
      const due = total - received;
      if (due <= 0 || !o.clientId) continue;
      const cur = map.get(o.clientId) || { dueSum: 0, orderCount: 0 };
      cur.dueSum += due;
      cur.orderCount += 1;
      map.set(o.clientId, cur);
    }
    return Array.from(map.entries())
      .map(([clientId, agg]) => ({
        clientId,
        name: String(clientById.get(clientId)?.name || '').trim() || '—',
        dueSum: agg.dueSum,
        orderCount: agg.orderCount,
      }))
      .filter(x => x.dueSum > 0)
      .sort((a, b) => b.dueSum - a.dueSum);
  }, [orders, clientById]);

  const totalAllClientsStudioDue = useMemo(
    () => clientsWithBalanceDue.reduce((s, r) => s + r.dueSum, 0),
    [clientsWithBalanceDue],
  );

  const visitBalances = useMemo(() => {
    return (fieldVisits || []).map(v => {
      const received = sumPayments(v.collections);
      const total = Number(v.amountToCollect) || 0;
      return { v, received, due: total - received };
    });
  }, [fieldVisits]);

  const totalAllVisitsDueGrossAll = useMemo(
    () => visitBalances.reduce((s, x) => s + Math.max(0, x.due), 0),
    [visitBalances],
  );

  const totalCollectStudioPlusExposingGross = useMemo(
    () => totalAllClientsStudioDue + totalAllVisitsDueGrossAll,
    [totalAllClientsStudioDue, totalAllVisitsDueGrossAll],
  );

  const totalVisitDueGross = useMemo(() => {
    return visitBalances.reduce((s, x) => {
      if (x.due <= 0 || !isVisitFuture(x.v, t)) return s;
      return s + Math.max(0, x.due);
    }, 0);
  }, [visitBalances, t]);

  const totalVisitDueNet = useMemo(
    () =>
      netVisitPendingAfterStudioPay(
        orders,
        fieldVisits,
        (v, due) => due > 0 && isVisitFuture(v, t),
      ),
    [orders, fieldVisits, t],
  );

  const dashboardVisitRows = useMemo(() => {
    const rows = visitBalances.filter(
      ({ v, due }) => due > 0 && isVisitFuture(v, t),
    );
    rows.sort((a, b) => {
      const af = fieldVisitRange(a.v).from;
      const bf = fieldVisitRange(b.v).from;
      return (
        af.localeCompare(bf) || (a.v.time || '').localeCompare(b.v.time || '')
      );
    });
    return rows;
  }, [visitBalances, t]);

  const isFresh =
    clients.length === 0 &&
    orders.length === 0 &&
    (fieldVisits || []).length === 0;
  const visitCount = (fieldVisits || []).length;

  const settlementRows = useMemo(
    () => buildSettlementRows(orders, fieldVisits),
    [orders, fieldVisits],
  );
  const settlementHint = useMemo(
    () => settlementNeedsLinkHint(settlementRows),
    [settlementRows],
  );
  const profit = useMemo(
    () => computeStudioProfit(orders, fieldVisits),
    [orders, fieldVisits],
  );

  const tomorrowOrders = useMemo(() => {
    return orders
      .filter(o => !isOrderWorkflowClosed(o, t) && orderEventStartsTomorrow(o, t))
      .map(o => ({
        order: o,
        client: clientById.get(o.clientId)?.name || '—',
        when: upcomingOrderWhenLabel(o),
      }));
  }, [orders, clientById, t]);

  const tomorrowVisits = useMemo(() => {
    return (fieldVisits || [])
      .filter(v => visitTouchesTomorrow(v, t))
      .map(v => {
        const { from, to } = fieldVisitRange(v);
        return { v, rangeLabel: formatDateRangeEn(from, to) };
      });
  }, [fieldVisits, t]);

  const pastDueOrders = useMemo(() => {
    return orders
      .filter(o => !isOrderWorkflowClosed(o, t) && orderPastDueWithBalance(o, t))
      .map(o => {
        const received = sumPayments(o.clientPayments);
        const due = (Number(o.totalAmount) || 0) - received;
        return {
          order: o,
          client: clientById.get(o.clientId)?.name || '—',
          due: Math.max(0, due),
          when: upcomingOrderWhenLabel(o),
        };
      })
      .sort((a, b) => b.due - a.due);
  }, [orders, clientById, t]);

  const thisWeekRangeText = useMemo(() => {
    const { weekStart, weekEnd } = calendarWeekRangeISO(t);
    return formatDateRangeEn(weekStart, weekEnd);
  }, [t]);

  const thisWeekOrderRows = useMemo(() => {
    const { weekStart, weekEnd } = calendarWeekRangeISO(t);
    return orders
      .filter(o => {
        if (isOrderWorkflowClosed(o, t)) return false;
        const r = orderEventRange(o);
        if (r.from)
          return rangeOverlapsWindow(
            r.from,
            r.to || r.from,
            weekStart,
            weekEnd,
          );
        const od = coerceDateFieldToISO(o.orderDate);
        return od ? rangeOverlapsWindow(od, od, weekStart, weekEnd) : false;
      })
      .map(o => ({
        order: o,
        client: clientById.get(o.clientId)?.name || '—',
        when: upcomingOrderWhenLabel(o),
      }))
      .sort((a, b) =>
        futureOrderSortKey(a.order).localeCompare(futureOrderSortKey(b.order)),
      );
  }, [orders, clientById, t]);

  const thisWeekVisitRows = useMemo(() => {
    const { weekStart, weekEnd } = calendarWeekRangeISO(t);
    return (fieldVisits || [])
      .filter(v => {
        const { from, to } = fieldVisitRange(v);
        if (!from) return false;
        return rangeOverlapsWindow(from, to || from, weekStart, weekEnd);
      })
      .map(v => {
        const { from, to } = fieldVisitRange(v);
        return { v, rangeLabel: formatDateRangeEn(from, to) };
      })
      .sort((a, b) =>
        fieldVisitRange(a.v).from.localeCompare(fieldVisitRange(b.v).from),
      );
  }, [fieldVisits, t]);

  const weekOrdersPage = usePagedSlice(thisWeekOrderRows, listPageSize);
  const weekVisitsPage = usePagedSlice(thisWeekVisitRows, listPageSize);
  const tomorrowOrdersPage = usePagedSlice(tomorrowOrders, listPageSize);
  const tomorrowVisitsPage = usePagedSlice(tomorrowVisits, listPageSize);
  const pastDuePage = usePagedSlice(pastDueOrders, listPageSize);
  const balancesPage = usePagedSlice(clientsWithBalanceDue, listPageSize);

  const hasReminders =
    tomorrowOrders.length > 0 ||
    tomorrowVisits.length > 0 ||
    pastDueOrders.length > 0;
  const showReminderCard = !isFresh && (hasReminders || !notifAuth);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <Text style={styles.title} accessibilityRole="header">
              Dashboard
            </Text>
            <View style={styles.headerActions}>
              <OpenDeskSearchButton variant="toolbar" />
            </View>
          </View>
          <Text style={styles.panelLead}>
            Dues, outside visits, and quick adds—at a glance.
          </Text>
        </View>

        {syncError ? (
          <View style={styles.bannerErr}>
            <Text style={styles.bannerErrText}>{syncError}</Text>
          </View>
        ) : null}

        <Text style={styles.sectionLabel}>Quick actions</Text>
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.qaBtn}
            onPress={() => navigation.navigate('Clients')}
            activeOpacity={0.85}
          >
            <View style={styles.qaEmojiWrap}>
              <Text style={styles.qaEmoji}>+</Text>
            </View>
            <View style={styles.qaTextWrap}>
              <Text style={styles.qaStrong}>New client</Text>
              <Text style={styles.qaSmall}>Save a name & phone</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.qaBtn}
            onPress={() => navigation.navigate('Orders')}
            activeOpacity={0.85}
          >
            <View style={styles.qaEmojiWrap}>
              <Text style={styles.qaEmoji}>✦</Text>
            </View>
            <View style={styles.qaTextWrap}>
              <Text style={styles.qaStrong}>New order</Text>
              <Text style={styles.qaSmall}>Quote & payments</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.qaBtn}
            onPress={() => navigation.navigate('Field')}
            activeOpacity={0.85}
          >
            <View style={styles.qaEmojiWrap}>
              <Text style={styles.qaEmoji}>⌖</Text>
            </View>
            <View style={styles.qaTextWrap}>
              <Text style={styles.qaStrong}>My Exposing</Text>
              <Text style={styles.qaSmall}>Where to go & collect</Text>
            </View>
          </TouchableOpacity>
        </View>

        {!isFresh &&
        (thisWeekOrderRows.length > 0 || thisWeekVisitRows.length > 0) ? (
          <View style={styles.weekCard}>
            <Text style={styles.weekTitle}>This week</Text>
            <Text style={styles.weekRange}>{thisWeekRangeText}</Text>
            <Text style={styles.weekLead}>
              Mon–Sun: jobs and visits that touch these dates.
            </Text>
            {thisWeekOrderRows.length > 0 ? (
              <View style={styles.weekBlock}>
                <Text style={styles.weekBlockTitle}>Orders</Text>
                {weekOrdersPage.slice.map(({ order, client, when }) => (
                  <TouchableOpacity
                    key={order.id}
                    style={styles.weekRow}
                    onPress={() =>
                      navigation.navigate('Orders', {
                        screen: 'OrderDetail',
                        params: { orderId: order.id },
                      })
                    }
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.weekRowMain}>{order.title}</Text>
                      <Text style={styles.weekRowMuted}>{client}</Text>
                    </View>
                    {when ? (
                      <Text style={styles.weekRowMeta}>{when}</Text>
                    ) : null}
                  </TouchableOpacity>
                ))}
                <DashPaginationMobile
                  page={weekOrdersPage.page}
                  pageCount={weekOrdersPage.pageCount}
                  total={weekOrdersPage.total}
                  pageSize={listPageSize}
                  setPage={weekOrdersPage.setPage}
                  onPageSizeChange={setListPageSize}
                  pageSizeOptions={DASH_LIST_PAGE_SIZE_OPTIONS}
                />
              </View>
            ) : null}
            {thisWeekVisitRows.length > 0 ? (
              <View style={styles.weekBlock}>
                <Text style={styles.weekBlockTitle}>My Exposing</Text>
                {weekVisitsPage.slice.map(({ v, rangeLabel }) => (
                  <TouchableOpacity
                    key={v.id}
                    style={styles.weekRow}
                    onPress={() =>
                      navigation.navigate('Field', { highlightVisitId: v.id })
                    }
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.weekRowMain}>{v.hostName}</Text>
                      {v.venue ? (
                        <Text style={styles.weekRowMuted}>{v.venue}</Text>
                      ) : null}
                    </View>
                    <Text style={styles.weekRowMeta}>{rangeLabel}</Text>
                  </TouchableOpacity>
                ))}
                <DashPaginationMobile
                  page={weekVisitsPage.page}
                  pageCount={weekVisitsPage.pageCount}
                  total={weekVisitsPage.total}
                  pageSize={listPageSize}
                  setPage={weekVisitsPage.setPage}
                  onPageSizeChange={setListPageSize}
                  pageSizeOptions={DASH_LIST_PAGE_SIZE_OPTIONS}
                />
              </View>
            ) : null}
          </View>
        ) : null}

        {showReminderCard ? (
          <View style={styles.reminderCard}>
            <Text style={styles.reminderTitle}>Reminders</Text>
            {!notifAuth ? (
              <View style={styles.reminderNotifBlock}>
                <TouchableOpacity
                  style={styles.reminderSettingsCta}
                  onPress={() => navigateToDeskSettings(navigation)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.reminderSettingsCtaTitle}>Desk alerts are off</Text>
                  <Text style={styles.reminderSettingsCtaSub}>
                    Open Settings to turn on reminders for tomorrow&apos;s jobs and overdue payments.
                  </Text>
                </TouchableOpacity>
                {notifDenied ? (
                  <TouchableOpacity
                    onPress={() => Linking.openSettings()}
                    style={styles.reminderSettingsWrap}
                  >
                    <Text style={styles.reminderSettingsLink}>
                      Notifications blocked — open system settings
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : (
              <TouchableOpacity
                style={styles.reminderOkRow}
                onPress={() => navigateToDeskSettings(navigation)}
                activeOpacity={0.85}
              >
                <Text style={styles.reminderOk}>Phone alerts on</Text>
                <Text style={styles.reminderOkHint}>Settings →</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.reminderLead}>
              Jobs and balances that need attention soon.
            </Text>
            {tomorrowOrders.length > 0 ? (
              <View style={styles.reminderBlock}>
                <Text style={styles.reminderBlockTitle}>
                  Tomorrow (
                  {formatDateRangeEn(addDaysISO(t, 1), addDaysISO(t, 1))})
                </Text>
                {tomorrowOrdersPage.slice.map(({ order, client, when }) => (
                  <TouchableOpacity
                    key={order.id}
                    style={styles.reminderRow}
                    onPress={() => navigation.navigate('Orders')}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reminderMain}>{order.title}</Text>
                      <Text style={styles.reminderMuted}>{client}</Text>
                    </View>
                    {when ? (
                      <Text style={styles.reminderMeta}>{when}</Text>
                    ) : null}
                  </TouchableOpacity>
                ))}
                <DashPaginationMobile
                  page={tomorrowOrdersPage.page}
                  pageCount={tomorrowOrdersPage.pageCount}
                  total={tomorrowOrdersPage.total}
                  pageSize={listPageSize}
                  setPage={tomorrowOrdersPage.setPage}
                  onPageSizeChange={setListPageSize}
                  pageSizeOptions={DASH_LIST_PAGE_SIZE_OPTIONS}
                />
              </View>
            ) : null}
            {tomorrowVisits.length > 0 ? (
              <View style={styles.reminderBlock}>
                <Text style={styles.reminderBlockTitle}>
                  My exposing tomorrow
                </Text>
                {tomorrowVisitsPage.slice.map(({ v, rangeLabel }) => (
                  <TouchableOpacity
                    key={v.id}
                    style={styles.reminderRow}
                    onPress={() => navigation.navigate('Field')}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reminderMain}>{v.hostName}</Text>
                      {v.venue ? (
                        <Text style={styles.reminderMuted}>{v.venue}</Text>
                      ) : null}
                    </View>
                    <Text style={styles.reminderMeta}>{rangeLabel}</Text>
                  </TouchableOpacity>
                ))}
                <DashPaginationMobile
                  page={tomorrowVisitsPage.page}
                  pageCount={tomorrowVisitsPage.pageCount}
                  total={tomorrowVisitsPage.total}
                  pageSize={listPageSize}
                  setPage={tomorrowVisitsPage.setPage}
                  onPageSizeChange={setListPageSize}
                  pageSizeOptions={DASH_LIST_PAGE_SIZE_OPTIONS}
                />
              </View>
            ) : null}
            {pastDueOrders.length > 0 ? (
              <View style={styles.reminderBlock}>
                <Text style={styles.reminderBlockTitle}>
                  Collect payment (event over, balance left)
                </Text>
                {pastDuePage.slice.map(({ order, client, due, when }) => (
                  <TouchableOpacity
                    key={order.id}
                    style={styles.reminderRow}
                    onPress={() => navigation.navigate('Orders')}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reminderMain}>{order.title}</Text>
                      <Text style={styles.reminderMuted}>{client}</Text>
                    </View>
                    <Text style={[styles.reminderMeta, styles.warnText]}>
                      {formatINR(due)} due
                    </Text>
                  </TouchableOpacity>
                ))}
                <DashPaginationMobile
                  page={pastDuePage.page}
                  pageCount={pastDuePage.pageCount}
                  total={pastDuePage.total}
                  pageSize={listPageSize}
                  setPage={pastDuePage.setPage}
                  onPageSizeChange={setListPageSize}
                  pageSizeOptions={DASH_LIST_PAGE_SIZE_OPTIONS}
                />
              </View>
            ) : null}
          </View>
        ) : null}

        {isFresh ? (
          <View style={styles.welcome}>
            <Text style={styles.welcomeTitle}>Your desk is ready</Text>
            <Text style={styles.welcomeCopy}>
              Add a client and an order for studio jobs—or open My Exposing for
              outside shoots (whose place, what to collect).
            </Text>
            <View style={styles.welcomeBtns}>
              <TouchableOpacity
                style={styles.welcomeBtnPrimary}
                onPress={() => navigation.navigate('Clients')}
              >
                <Text style={styles.welcomeBtnPrimaryText}>
                  Start with a client
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.welcomeBtnGhost}
                onPress={() => navigation.navigate('Field')}
              >
                <Text style={styles.welcomeBtnGhostText}>Log My Exposing</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        <View style={styles.statsGrid}>
          <TouchableOpacity
            style={styles.statTile}
            onPress={() => navigation.navigate('Clients')}
            activeOpacity={0.9}
          >
            <Text style={styles.statLabel}>Clients</Text>
            <Text style={styles.statValue}>{clients.length}</Text>
            <Text style={styles.statHint}>Tap to manage</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.statTile}
            onPress={() => navigation.navigate('Orders')}
            activeOpacity={0.9}
          >
            <Text style={styles.statLabel}>Orders</Text>
            <Text style={styles.statValue}>{orders.length}</Text>
            <Text style={styles.statHint}>Tap to open</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.statTile}
            onPress={() => navigation.navigate('Field')}
            activeOpacity={0.9}
          >
            <Text style={styles.statLabel}>My Exposing</Text>
            <Text style={styles.statValue}>{visitCount}</Text>
            <Text style={styles.statHint}>Outside shoots</Text>
          </TouchableOpacity>
          <View style={[styles.statTile, styles.statTileStatic]}>
            <Text style={styles.statLabel}>Due (future jobs)</Text>
            <Text style={[styles.statValue, styles.statMoney]}>
              {formatINR(totalClientDue)}
            </Text>
            <Text style={styles.statHint}>Open jobs — closed hidden</Text>
          </View>
          <View
            style={[styles.statTile, styles.statTileStatic, styles.statTileFullWidth]}
            accessibilityLabel={`To collect desk total ${formatINR(totalCollectStudioPlusExposingGross)}`}
          >
            <Text style={styles.statLabel}>To collect (desk)</Text>
            <Text style={[styles.statValue, styles.statMoney, styles.warnText]}>
              {formatINR(totalCollectStudioPlusExposingGross)}
            </Text>
            <Text style={styles.statHint}>
              Studio {formatINR(totalAllClientsStudioDue)} + exposing{' '}
              {formatINR(totalAllVisitsDueGrossAll)} · gross
            </Text>
          </View>
          <View style={[styles.statTile, styles.statTileStatic]}>
            <Text style={styles.statLabel}>Est. profit (all time)</Text>
            <Text
              style={[
                styles.statValue,
                styles.statMoney,
                profit.netEstimate > 0
                  ? styles.okText
                  : profit.netEstimate < 0
                  ? styles.warnText
                  : null,
              ]}
            >
              {formatINR(profit.netEstimate)}
            </Text>
            <Text style={styles.statHintSmall}>
              Received {formatINR(profit.totalReceived)} − team{' '}
              {formatINR(profit.teamPayouts)} − guest pay (net){' '}
              {formatINR(profit.guestPayCommitted)}
              {profit.guestPayRaw > profit.guestPayCommitted
                ? ` (was ${formatINR(profit.guestPayRaw)} before visit offset)`
                : ''}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.statTile}
            onPress={() => navigation.navigate('Field')}
            activeOpacity={0.9}
          >
            <Text style={styles.statLabel}>Pending (visits)</Text>
            <Text style={[styles.statValue, styles.statMoney, styles.okText]}>
              {formatINR(totalVisitDueNet)}
            </Text>
            {totalVisitDueGross > totalVisitDueNet ? (
              <Text style={styles.statGrossNote}>
                Gross on visits {formatINR(totalVisitDueGross)}
              </Text>
            ) : null}
            <Text style={styles.statHint}>
              Net after studio pay (same person)
            </Text>
          </TouchableOpacity>
        </View>

        {clientsWithBalanceDue.length > 0 || totalAllVisitsDueGrossAll > 0 ? (
          <View style={styles.card} accessibilityLabel="Balances to collect">
            <Text style={styles.cardTitle}>Balances to collect</Text>
            <Text style={styles.cardSub}>
              Studio = all client orders with balance left. My Exposing = gross still due on each visit (amount −
              collected), all dates. Combined is a simple sum—not the same-person net on Pending (visits).
            </Text>
            <View style={styles.deskTotalBox}>
              <View style={styles.deskTotalRow}>
                <Text style={styles.deskTotalLabel}>Studio (all clients)</Text>
                <Text style={styles.deskTotalSubval}>{formatINR(totalAllClientsStudioDue)}</Text>
              </View>
              <View style={styles.deskTotalRow}>
                <Text style={styles.deskTotalLabel}>My Exposing (gross)</Text>
                <Text style={styles.deskTotalSubval}>{formatINR(totalAllVisitsDueGrossAll)}</Text>
              </View>
              <View style={[styles.deskTotalRow, styles.deskTotalRowLast]}>
                <Text style={styles.deskTotalLabelStrong}>Total desk</Text>
                <Text style={styles.deskTotalGrand}>{formatINR(totalCollectStudioPlusExposingGross)}</Text>
              </View>
            </View>
            {clientsWithBalanceDue.length > 0 ? (
              <>
                {balancesPage.slice.map((row, idx) => (
                  <View
                    key={row.clientId}
                    style={[
                      styles.clientBalRow,
                      balancesPage.page === 1 && idx === 0 && styles.clientBalRowFirst,
                    ]}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.feedTitle}>{row.name}</Text>
                      <Text style={styles.mutedSmall}>
                        {row.orderCount} {row.orderCount === 1 ? 'job' : 'jobs'} with balance
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', maxWidth: '42%' }}>
                      <Text style={styles.feedDue}>{formatINR(row.dueSum)}</Text>
                      <Text style={[styles.feedReceived, { textAlign: 'right' }]}>
                        to collect
                      </Text>
                    </View>
                  </View>
                ))}
                <DashPaginationMobile
                  page={balancesPage.page}
                  pageCount={balancesPage.pageCount}
                  total={balancesPage.total}
                  pageSize={listPageSize}
                  setPage={balancesPage.setPage}
                  onPageSizeChange={setListPageSize}
                  pageSizeOptions={DASH_LIST_PAGE_SIZE_OPTIONS}
                />
              </>
            ) : (
              <Text style={styles.mutedSmall}>
                No studio balances by client right now. Use My Exposing for outside collections.
              </Text>
            )}
            <View style={styles.balancesBtnRow}>
              <TouchableOpacity
                style={styles.cardFooterBtn}
                onPress={() => navigation.navigate('Orders')}
                activeOpacity={0.85}
              >
                <Text style={styles.emptyBtnText}>Open orders</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cardFooterBtnSecondary}
                onPress={() => navigation.navigate('Field')}
                activeOpacity={0.85}
              >
                <Text style={styles.cardFooterBtnSecondaryText}>My Exposing</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Upcoming orders</Text>
          <Text style={styles.cardSub}>
            Event still running or coming up (end today or later, or no event date). After the event, fully paid jobs
            become Closed and leave. Past events with balance due show under Reminders.
          </Text>
          {futureOrderRows.length === 0 ? (
            <View style={styles.emptyInner}>
              <Text style={styles.emptyIcon}>✦</Text>
              <Text style={styles.emptyTitle}>No upcoming orders</Text>
              <Text style={styles.emptyText}>
                Nothing in this window. Past events with payment due appear under Reminders → Collect payment.
              </Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => navigation.navigate('Orders')}
              >
                <Text style={styles.emptyBtnText}>New order</Text>
              </TouchableOpacity>
            </View>
          ) : (
            futureOrderRows.map(({ order, received, due, total }) => {
              const cname = clientById.get(order.clientId)?.name || '—';
              const dueOutstanding = Math.max(0, due);
              const overpaid = due < 0;
              const whenLabel = upcomingOrderWhenLabel(order);
              const wf = deriveOrderWorkflowStatus(order, t);
              const wfPillStyle = styles[`wfPill_${wf}`] ?? styles.wfPill_booked;
              return (
                <View key={order.id} style={styles.feedItem}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.feedTitleRow}>
                      <Text style={styles.feedTitle}>{order.title}</Text>
                      <Text style={[styles.wfPill, wfPillStyle]}>
                        {orderWorkflowLabel(wf)}
                      </Text>
                    </View>
                    {whenLabel ? (
                      <Text style={styles.pillDate}>{whenLabel}</Text>
                    ) : (
                      <Text style={styles.mutedSmall}>
                        No event date — set in order
                      </Text>
                    )}
                    <Text style={styles.feedClient}>{cname}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', maxWidth: '46%' }}>
                    {dueOutstanding > 0 ? (
                      <Text style={styles.feedDue}>
                        {formatINR(dueOutstanding)}
                      </Text>
                    ) : overpaid ? (
                      <Text style={styles.feedOver}>
                        Overpaid {formatINR(-due)}
                      </Text>
                    ) : (
                      <Text style={styles.feedPaid}>Paid up</Text>
                    )}
                    <Text style={styles.feedReceived}>
                      {total > 0
                        ? `Total ${formatINR(total)} · Received ${formatINR(
                            received,
                          )}`
                        : `Received ${formatINR(received)}`}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Visit collections</Text>
          <Text style={styles.cardSub}>
            Upcoming shoots where you still need to collect.
          </Text>
          {dashboardVisitRows.length === 0 ? (
            <View style={styles.emptyInner}>
              <Text style={styles.emptyIcon}>⌖</Text>
              <Text style={styles.emptyTitle}>No pending collections</Text>
              <Text style={styles.emptyText}>
                Log My Exposing with an amount to see it here.
              </Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => navigation.navigate('Field')}
              >
                <Text style={styles.emptyBtnText}>Add visit</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {dashboardVisitRows.map(({ v, due }) => {
                const { from, to } = fieldVisitRange(v);
                const rangeLabel = formatDateRangeEn(from, to);
                return (
                  <View key={v.id} style={styles.feedItemVisit}>
                    <View style={styles.visitWhenRow}>
                      <Text style={styles.pillDate}>{rangeLabel}</Text>
                      {v.time ? (
                        <Text style={styles.mutedSmall}> · {v.time}</Text>
                      ) : null}
                    </View>
                    <Text style={styles.visitHost}>{v.hostName}</Text>
                    {v.venue ? (
                      <Text style={styles.mutedSmall}>{v.venue}</Text>
                    ) : null}
                    <View style={styles.visitDueRow}>
                      <Text style={styles.mutedSmall}>Still due</Text>
                      <Text style={due > 0 ? styles.feedDue : styles.feedPaid}>
                        {formatINR(Math.max(0, due))}
                      </Text>
                    </View>
                  </View>
                );
              })}
              <TouchableOpacity
                style={styles.cardFooterBtn}
                onPress={() => navigation.navigate('Field')}
              >
                <Text style={styles.emptyBtnText}>Open My Exposing</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Same-person net</Text>
          <Text style={styles.cardSub}>
            Field due minus studio Pay them when it's the same contact (name or
            Match key).
          </Text>
          {settlementHint ? (
            <Text style={styles.settleHint}>
              Studio pay and visit money both exist, but nothing linked—use the
              same Match key on the guest and the visit (or similar names).
            </Text>
          ) : null}
          {settlementRows.length === 0 ? (
            <View style={styles.emptyInner}>
              <Text style={styles.emptyIcon}>⇄</Text>
              <Text style={styles.emptyTitle}>No offsets yet</Text>
              <Text style={styles.emptyText}>
                Add Pay them on an exposure guest and My Exposing for the same
                person.
              </Text>
            </View>
          ) : (
            <View style={styles.table}>
              <View style={styles.tableHeadRow}>
                <Text style={[styles.th, styles.thPerson]}>Person</Text>
                <Text style={styles.th}>Pay (studio)</Text>
                <Text style={styles.th}>Due (visit)</Text>
                <Text style={styles.th}>Net</Text>
              </View>
              {settlementRows.map(r => (
                <View
                  key={r.key}
                  style={[
                    styles.tableRow,
                    r.hasBothSides ? styles.tableRowNet : null,
                  ]}
                >
                  <Text style={[styles.td, styles.thPerson]} numberOfLines={3}>
                    {r.label}
                  </Text>
                  <Text style={styles.td}>
                    {r.payToGuest > 0 ? formatINR(r.payToGuest) : '—'}
                  </Text>
                  <Text style={styles.td}>
                    {r.collectDue > 0 ? formatINR(r.collectDue) : '—'}
                  </Text>
                  <View style={styles.td}>
                    {r.net === 0 && r.hasBothSides ? (
                      <Text style={styles.okText}>Even</Text>
                    ) : r.net > 0 ? (
                      <Text style={styles.warnText}>
                        Collect {formatINR(r.net)}
                      </Text>
                    ) : r.net < 0 ? (
                      <Text>Pay {formatINR(-r.net)}</Text>
                    ) : (
                      <Text style={styles.mutedSmall}>—</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  hero: {
    marginBottom: 18,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  title: {
    flex: 1,
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.6,
    lineHeight: 32,
  },
  panelLead: {
    fontSize: 14,
    color: colors.muted,
    lineHeight: 21,
    marginBottom: 10,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  weekCard: {
    backgroundColor: colors.surfaceSolid,
    borderRadius: radius.md,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#14121f',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
      },
      android: { elevation: 1 },
    }),
  },
  weekTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  weekRange: { fontSize: 13, color: colors.muted, marginTop: 4 },
  weekLead: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 8,
    marginBottom: 10,
    lineHeight: 17,
  },
  weekBlock: { marginTop: 4, marginBottom: 8 },
  weekBlockTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: 8,
  },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  weekRowMain: { fontSize: 15, fontWeight: '600', color: colors.text },
  weekRowMuted: { fontSize: 13, color: colors.muted, marginTop: 2 },
  weekRowMeta: {
    fontSize: 12,
    color: colors.muted,
    maxWidth: '38%',
    textAlign: 'right',
  },
  bannerErr: {
    backgroundColor: colors.syncErrorBg,
    borderWidth: 1,
    borderColor: colors.syncErrorBorder,
    padding: 12,
    borderRadius: radius.sm,
    marginBottom: 12,
  },
  bannerErrText: { color: colors.syncErrorText, fontSize: 14, lineHeight: 20 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
    opacity: 0.85,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 2,
  },
  quickActions: { gap: 12, marginBottom: 18 },
  qaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surfaceSolid,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    ...Platform.select({
      ios: {
        shadowColor: '#14121f',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  qaEmojiWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.chipOnBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qaEmoji: {
    fontSize: 22,
    color: colors.primary,
    textAlign: 'center',
  },
  qaTextWrap: { flex: 1 },
  qaStrong: { fontSize: 16, fontWeight: '700', color: colors.text },
  qaSmall: { fontSize: 13, color: colors.muted, marginTop: 2 },
  reminderCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  reminderTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  reminderNotifBlock: { marginBottom: 10 },
  reminderSettingsCta: {
    backgroundColor: colors.secondaryPillBg,
    borderRadius: radius.sm,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reminderSettingsCtaTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  reminderSettingsCtaSub: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 6,
    lineHeight: 19,
  },
  reminderSettingsWrap: { marginTop: 12 },
  reminderSettingsLink: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  reminderOkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 8,
    gap: 8,
  },
  reminderOk: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.success,
    flex: 1,
  },
  reminderOkHint: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  reminderLead: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 8,
    marginBottom: 12,
  },
  reminderBlock: { marginBottom: 12 },
  reminderBlockTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: 8,
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  reminderMain: { fontSize: 15, fontWeight: '600', color: colors.text },
  reminderMuted: { fontSize: 13, color: colors.muted, marginTop: 2 },
  reminderMeta: {
    fontSize: 12,
    color: colors.muted,
    marginLeft: 8,
    maxWidth: 120,
    textAlign: 'right',
  },
  warnText: { color: colors.warn, fontWeight: '600' },
  okText: { color: colors.success, fontWeight: '600' },
  welcome: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.lg,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  welcomeTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  welcomeCopy: {
    fontSize: 14,
    color: colors.muted,
    marginTop: 8,
    lineHeight: 21,
  },
  welcomeBtns: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  welcomeBtnPrimary: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radius.sm,
  },
  welcomeBtnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  welcomeBtnGhost: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSolid,
  },
  welcomeBtnGhostText: { color: colors.text, fontWeight: '600', fontSize: 15 },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  statTile: {
    width: '48%',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statTileStatic: { opacity: 1 },
  statTileFullWidth: {
    width: '100%',
    backgroundColor: colors.secondaryPillBg,
    borderColor: 'rgba(194, 65, 12, 0.22)',
  },
  statLabel: { fontSize: 12, color: colors.muted },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    marginTop: 4,
  },
  statMoney: { fontSize: 17 },
  statHint: { fontSize: 11, color: colors.muted, marginTop: 6 },
  statHintSmall: {
    fontSize: 10,
    color: colors.muted,
    marginTop: 6,
    lineHeight: 14,
  },
  statGrossNote: { fontSize: 11, color: colors.muted, marginTop: 4 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
  },
  cardTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  cardSub: { fontSize: 13, color: colors.muted, marginTop: 6, lineHeight: 19 },
  deskTotalBox: {
    marginTop: 4,
    marginBottom: 8,
    padding: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  deskTotalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  deskTotalRowLast: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  deskTotalLabel: { fontSize: 13, color: colors.text, fontWeight: '600', flex: 1 },
  deskTotalLabelStrong: { fontSize: 14, color: colors.text, fontWeight: '800' },
  deskTotalSubval: { fontSize: 15, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  deskTotalGrand: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.warn,
    fontVariant: ['tabular-nums'],
  },
  balancesBtnRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
    alignItems: 'center',
  },
  cardFooterBtnSecondary: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSolid,
  },
  cardFooterBtnSecondaryText: { color: colors.text, fontWeight: '700', fontSize: 14 },
  clientBalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: 8,
  },
  clientBalRowFirst: { borderTopWidth: 0, paddingTop: 4 },
  emptyInner: { alignItems: 'center', paddingVertical: 20 },
  emptyIcon: { fontSize: 28, marginBottom: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  emptyText: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 12,
  },
  emptyBtn: {
    marginTop: 14,
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radius.sm,
  },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  cardFooterBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.sm,
  },
  feedItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: 8,
  },
  feedTitle: { fontSize: 15, fontWeight: '700', color: colors.text, flex: 1, minWidth: 0 },
  feedTitleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  wfPill: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 5,
    overflow: 'hidden',
  },
  wfPill_booked: {
    backgroundColor: colors.accentSoft,
    color: colors.primary,
    borderWidth: 1,
    borderColor: 'rgba(91,74,232,0.28)',
  },
  wfPill_in_progress: {
    backgroundColor: 'rgba(251,191,36,0.22)',
    color: '#b45309',
    borderWidth: 1,
    borderColor: 'rgba(217,119,6,0.35)',
  },
  wfPill_pending_payment: {
    backgroundColor: 'rgba(251,191,36,0.25)',
    color: '#9a3412',
    borderWidth: 1,
    borderColor: 'rgba(234,88,12,0.4)',
  },
  wfPill_closed: {
    backgroundColor: colors.surfaceSolid,
    color: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillDate: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 4,
  },
  mutedSmall: { fontSize: 12, color: colors.muted, marginTop: 4 },
  feedClient: { fontSize: 13, color: colors.muted, marginTop: 4 },
  feedDue: { fontSize: 15, fontWeight: '800', color: colors.warn },
  feedOver: { fontSize: 13, fontWeight: '600', color: colors.success },
  feedPaid: { fontSize: 13, fontWeight: '600', color: colors.success },
  feedReceived: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 4,
    textAlign: 'right',
  },
  feedItemVisit: {
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  visitWhenRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  visitHost: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginTop: 6,
  },
  visitDueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  settleHint: {
    fontSize: 13,
    color: colors.text,
    backgroundColor: colors.secondaryPillBg,
    padding: 10,
    borderRadius: radius.sm,
    marginTop: 10,
    lineHeight: 19,
  },
  table: { marginTop: 12 },
  tableHeadRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 8,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    alignItems: 'flex-start',
  },
  tableRowNet: { backgroundColor: colors.chipOnBg },
  th: {
    flex: 1,
    fontSize: 10,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
  },
  thPerson: { flex: 1.4 },
  td: { flex: 1, fontSize: 12, color: colors.text, paddingRight: 4 },
});
