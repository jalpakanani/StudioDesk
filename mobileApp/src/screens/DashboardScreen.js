import { useCallback, useMemo, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useStudio } from '../context/StudioContext';
import {
  coerceDateFieldToISO,
  fieldVisitRange,
  formatDateRangeEn,
  orderEventRange,
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
import { getDeskNotificationState, requestDeskNotificationPermission } from '../notifications/notifeeDesk';

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
  const { logOut, user } = useAuth();
  const { orders, clients, clientById, fieldVisits, syncError, cloudSync } = useStudio();
  const [notifAuth, setNotifAuth] = useState(false);
  const [notifDenied, setNotifDenied] = useState(false);

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

  async function onEnablePhoneAlerts() {
    await requestDeskNotificationPermission();
    const next = await getDeskNotificationState();
    setNotifAuth(next.authorized);
    setNotifDenied(next.denied);
  }

  const t = todayISO();

  const futureOrderRows = useMemo(() => {
    return orders
      .map((o) => {
        const received = sumPayments(o.clientPayments);
        const total = Number(o.totalAmount) || 0;
        const due = total - received;
        return { order: o, received, due, total };
      })
      .filter((x) => isOrderFuture(x.order, t))
      .sort((a, b) => {
        const c = futureOrderSortKey(a.order).localeCompare(futureOrderSortKey(b.order));
        if (c !== 0) return c;
        if (b.due !== a.due) return b.due - a.due;
        return (a.order.title || '').localeCompare(b.order.title || '');
      });
  }, [orders, t]);

  const totalClientDue = useMemo(
    () => futureOrderRows.reduce((s, x) => s + Math.max(0, x.due), 0),
    [futureOrderRows],
  );

  const visitBalances = useMemo(() => {
    return (fieldVisits || []).map((v) => {
      const received = sumPayments(v.collections);
      const total = Number(v.amountToCollect) || 0;
      return { v, received, due: total - received };
    });
  }, [fieldVisits]);

  const totalVisitDueGross = useMemo(() => {
    return visitBalances.reduce((s, x) => {
      if (x.due <= 0 || !isVisitFuture(x.v, t)) return s;
      return s + Math.max(0, x.due);
    }, 0);
  }, [visitBalances, t]);

  const totalVisitDueNet = useMemo(
    () =>
      netVisitPendingAfterStudioPay(orders, fieldVisits, (v, due) => due > 0 && isVisitFuture(v, t)),
    [orders, fieldVisits, t],
  );

  const dashboardVisitRows = useMemo(() => {
    const rows = visitBalances.filter(({ v, due }) => due > 0 && isVisitFuture(v, t));
    rows.sort((a, b) => {
      const af = fieldVisitRange(a.v).from;
      const bf = fieldVisitRange(b.v).from;
      return af.localeCompare(bf) || (a.v.time || '').localeCompare(b.v.time || '');
    });
    return rows;
  }, [visitBalances, t]);

  const isFresh =
    clients.length === 0 && orders.length === 0 && (fieldVisits || []).length === 0;
  const visitCount = (fieldVisits || []).length;

  const settlementRows = useMemo(() => buildSettlementRows(orders, fieldVisits), [orders, fieldVisits]);
  const settlementHint = useMemo(() => settlementNeedsLinkHint(settlementRows), [settlementRows]);
  const profit = useMemo(() => computeStudioProfit(orders, fieldVisits), [orders, fieldVisits]);

  const tomorrowOrders = useMemo(() => {
    return orders
      .filter((o) => orderEventStartsTomorrow(o, t))
      .map((o) => ({
        order: o,
        client: clientById.get(o.clientId)?.name || '—',
        when: upcomingOrderWhenLabel(o),
      }));
  }, [orders, clientById, t]);

  const tomorrowVisits = useMemo(() => {
    return (fieldVisits || [])
      .filter((v) => visitTouchesTomorrow(v, t))
      .map((v) => {
        const { from, to } = fieldVisitRange(v);
        return { v, rangeLabel: formatDateRangeEn(from, to) };
      });
  }, [fieldVisits, t]);

  const pastDueOrders = useMemo(() => {
    return orders
      .filter((o) => orderPastDueWithBalance(o, t))
      .map((o) => {
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

  const hasReminders =
    tomorrowOrders.length > 0 || tomorrowVisits.length > 0 || pastDueOrders.length > 0;
  const showReminderCard = !isFresh && (hasReminders || !notifAuth);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.rowBetween}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Dashboard</Text>
            <Text style={styles.panelLead}>
              Dues, outside visits, and quick adds—at a glance.
            </Text>
            {user?.email ? (
              <Text style={styles.email} numberOfLines={1}>
                {user.email}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity style={styles.outBtn} onPress={() => logOut()}>
            <Text style={styles.outBtnText}>Sign out</Text>
          </TouchableOpacity>
        </View>

        {syncError ? (
          <View style={styles.bannerErr}>
            <Text style={styles.bannerErrText}>{syncError}</Text>
          </View>
        ) : null}
        {cloudSync ? <Text style={styles.syncOk}>Synced with Firestore</Text> : null}

        <Text style={styles.sectionLabel}>Quick actions</Text>
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.qaBtn}
            onPress={() => navigation.navigate('Clients')}
            activeOpacity={0.85}
          >
            <Text style={styles.qaEmoji}>+</Text>
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
            <Text style={styles.qaEmoji}>✦</Text>
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
            <Text style={styles.qaEmoji}>⌖</Text>
            <View style={styles.qaTextWrap}>
              <Text style={styles.qaStrong}>My Exposing</Text>
              <Text style={styles.qaSmall}>Where to go & collect</Text>
            </View>
          </TouchableOpacity>
        </View>

        {showReminderCard ? (
          <View style={styles.reminderCard}>
            <Text style={styles.reminderTitle}>Reminders</Text>
            {!notifAuth ? (
              <View style={styles.reminderNotifBlock}>
                <TouchableOpacity style={styles.reminderNotifBtn} onPress={onEnablePhoneAlerts}>
                  <Text style={styles.reminderNotifBtnText}>Turn on phone alerts</Text>
                </TouchableOpacity>
                {notifDenied ? (
                  <TouchableOpacity onPress={() => Linking.openSettings()} style={styles.reminderSettingsWrap}>
                    <Text style={styles.reminderSettingsLink}>Notifications blocked — open system settings</Text>
                  </TouchableOpacity>
                ) : null}
                <Text style={styles.reminderNotifHelp}>
                  We will notify you about tomorrow's jobs and overdue payments (same limits as the web app: up
                  to five per type per day, spaced out).
                </Text>
              </View>
            ) : (
              <Text style={styles.reminderOk}>Phone alerts on</Text>
            )}
            <Text style={styles.reminderLead}>
              Jobs and balances that need attention soon.
            </Text>
            {tomorrowOrders.length > 0 ? (
              <View style={styles.reminderBlock}>
                <Text style={styles.reminderBlockTitle}>
                  Tomorrow ({formatDateRangeEn(addDaysISO(t, 1), addDaysISO(t, 1))})
                </Text>
                {tomorrowOrders.map(({ order, client, when }) => (
                  <TouchableOpacity
                    key={order.id}
                    style={styles.reminderRow}
                    onPress={() => navigation.navigate('Orders')}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reminderMain}>{order.title}</Text>
                      <Text style={styles.reminderMuted}>{client}</Text>
                    </View>
                    {when ? <Text style={styles.reminderMeta}>{when}</Text> : null}
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
            {tomorrowVisits.length > 0 ? (
              <View style={styles.reminderBlock}>
                <Text style={styles.reminderBlockTitle}>My exposing tomorrow</Text>
                {tomorrowVisits.map(({ v, rangeLabel }) => (
                  <TouchableOpacity
                    key={v.id}
                    style={styles.reminderRow}
                    onPress={() => navigation.navigate('Field')}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reminderMain}>{v.hostName}</Text>
                      {v.venue ? <Text style={styles.reminderMuted}>{v.venue}</Text> : null}
                    </View>
                    <Text style={styles.reminderMeta}>{rangeLabel}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
            {pastDueOrders.length > 0 ? (
              <View style={styles.reminderBlock}>
                <Text style={styles.reminderBlockTitle}>
                  Collect payment (event over, balance left)
                </Text>
                {pastDueOrders.map(({ order, client, due, when }) => (
                  <TouchableOpacity
                    key={order.id}
                    style={styles.reminderRow}
                    onPress={() => navigation.navigate('Orders')}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reminderMain}>{order.title}</Text>
                      <Text style={styles.reminderMuted}>{client}</Text>
                    </View>
                    <Text style={[styles.reminderMeta, styles.warnText]}>{formatINR(due)} due</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {isFresh ? (
          <View style={styles.welcome}>
            <Text style={styles.welcomeTitle}>Your desk is ready</Text>
            <Text style={styles.welcomeCopy}>
              Add a client and an order for studio jobs—or open My Exposing for outside shoots (whose
              place, what to collect).
            </Text>
            <View style={styles.welcomeBtns}>
              <TouchableOpacity
                style={styles.welcomeBtnPrimary}
                onPress={() => navigation.navigate('Clients')}
              >
                <Text style={styles.welcomeBtnPrimaryText}>Start with a client</Text>
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
            <Text style={[styles.statValue, styles.statMoney]}>{formatINR(totalClientDue)}</Text>
            <Text style={styles.statHint}>Orders not ended</Text>
          </View>
          <View style={[styles.statTile, styles.statTileStatic]}>
            <Text style={styles.statLabel}>Est. profit (all time)</Text>
            <Text
              style={[
                styles.statValue,
                styles.statMoney,
                profit.netEstimate > 0 ? styles.okText : profit.netEstimate < 0 ? styles.warnText : null,
              ]}
            >
              {formatINR(profit.netEstimate)}
            </Text>
            <Text style={styles.statHintSmall}>
              Received {formatINR(profit.totalReceived)} − team {formatINR(profit.teamPayouts)} − guest pay
              (net) {formatINR(profit.guestPayCommitted)}
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
            <Text style={styles.statHint}>Net after studio pay (same person)</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Upcoming orders</Text>
          <Text style={styles.cardSub}>
            Future jobs on the calendar—shown even when fully paid; balance due when anything is left to
            receive.
          </Text>
          {futureOrderRows.length === 0 ? (
            <View style={styles.emptyInner}>
              <Text style={styles.emptyIcon}>✦</Text>
              <Text style={styles.emptyTitle}>No upcoming orders</Text>
              <Text style={styles.emptyText}>
                When an order's event is still today or ahead, it appears here.
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
              return (
                <View key={order.id} style={styles.feedItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.feedTitle}>{order.title}</Text>
                    {whenLabel ? (
                      <Text style={styles.pillDate}>{whenLabel}</Text>
                    ) : (
                      <Text style={styles.mutedSmall}>No event date — set in order</Text>
                    )}
                    <Text style={styles.feedClient}>{cname}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', maxWidth: '46%' }}>
                    {dueOutstanding > 0 ? (
                      <Text style={styles.feedDue}>{formatINR(dueOutstanding)}</Text>
                    ) : overpaid ? (
                      <Text style={styles.feedOver}>Overpaid {formatINR(-due)}</Text>
                    ) : (
                      <Text style={styles.feedPaid}>Paid up</Text>
                    )}
                    <Text style={styles.feedReceived}>
                      {total > 0
                        ? `Total ${formatINR(total)} · Received ${formatINR(received)}`
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
          <Text style={styles.cardSub}>Upcoming shoots where you still need to collect.</Text>
          {dashboardVisitRows.length === 0 ? (
            <View style={styles.emptyInner}>
              <Text style={styles.emptyIcon}>⌖</Text>
              <Text style={styles.emptyTitle}>No pending collections</Text>
              <Text style={styles.emptyText}>Log My Exposing with an amount to see it here.</Text>
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
                      {v.time ? <Text style={styles.mutedSmall}> · {v.time}</Text> : null}
                    </View>
                    <Text style={styles.visitHost}>{v.hostName}</Text>
                    {v.venue ? <Text style={styles.mutedSmall}>{v.venue}</Text> : null}
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
            Field due minus studio Pay them when it's the same contact (name or Match key).
          </Text>
          {settlementHint ? (
            <Text style={styles.settleHint}>
              Studio pay and visit money both exist, but nothing linked—use the same Match key on the guest
              and the visit (or similar names).
            </Text>
          ) : null}
          {settlementRows.length === 0 ? (
            <View style={styles.emptyInner}>
              <Text style={styles.emptyIcon}>⇄</Text>
              <Text style={styles.emptyTitle}>No offsets yet</Text>
              <Text style={styles.emptyText}>
                Add Pay them on an exposure guest and My Exposing for the same person.
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
              {settlementRows.map((r) => (
                <View
                  key={r.key}
                  style={[styles.tableRow, r.hasBothSides ? styles.tableRowNet : null]}
                >
                  <Text style={[styles.td, styles.thPerson]} numberOfLines={3}>
                    {r.label}
                  </Text>
                  <Text style={styles.td}>{r.payToGuest > 0 ? formatINR(r.payToGuest) : '—'}</Text>
                  <Text style={styles.td}>{r.collectDue > 0 ? formatINR(r.collectDue) : '—'}</Text>
                  <View style={styles.td}>
                    {r.net === 0 && r.hasBothSides ? (
                      <Text style={styles.okText}>Even</Text>
                    ) : r.net > 0 ? (
                      <Text style={styles.warnText}>Collect {formatINR(r.net)}</Text>
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
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, gap: 8 },
  title: { fontSize: 24, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  panelLead: { fontSize: 14, color: colors.muted, marginTop: 6, lineHeight: 20, maxWidth: 280 },
  email: { fontSize: 13, color: colors.muted, marginTop: 4 },
  outBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSolid,
    alignSelf: 'flex-start',
  },
  outBtnText: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  bannerErr: {
    backgroundColor: colors.syncErrorBg,
    borderWidth: 1,
    borderColor: colors.syncErrorBorder,
    padding: 12,
    borderRadius: radius.sm,
    marginBottom: 12,
  },
  bannerErrText: { color: colors.syncErrorText, fontSize: 14, lineHeight: 20 },
  syncOk: { color: colors.success, fontSize: 13, marginBottom: 12 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  quickActions: { gap: 10, marginBottom: 16 },
  qaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  qaEmoji: { fontSize: 22, color: colors.primary, width: 28, textAlign: 'center' },
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
  reminderNotifBtn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.sm,
    marginTop: 6,
  },
  reminderNotifBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  reminderSettingsWrap: { marginTop: 10 },
  reminderSettingsLink: { fontSize: 13, fontWeight: '600', color: colors.primary, textDecorationLine: 'underline' },
  reminderNotifHelp: { fontSize: 12, color: colors.muted, marginTop: 10, lineHeight: 17 },
  reminderOk: { fontSize: 13, fontWeight: '600', color: colors.success, marginTop: 6, marginBottom: 4 },
  reminderLead: { fontSize: 13, color: colors.muted, marginTop: 8, marginBottom: 12 },
  reminderBlock: { marginBottom: 12 },
  reminderBlockTitle: { fontSize: 14, fontWeight: '800', color: colors.primary, marginBottom: 8 },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  reminderMain: { fontSize: 15, fontWeight: '600', color: colors.text },
  reminderMuted: { fontSize: 13, color: colors.muted, marginTop: 2 },
  reminderMeta: { fontSize: 12, color: colors.muted, marginLeft: 8, maxWidth: 120, textAlign: 'right' },
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
  welcomeCopy: { fontSize: 14, color: colors.muted, marginTop: 8, lineHeight: 21 },
  welcomeBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
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
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statTile: {
    width: '48%',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statTileStatic: { opacity: 1 },
  statLabel: { fontSize: 12, color: colors.muted },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: 4 },
  statMoney: { fontSize: 17 },
  statHint: { fontSize: 11, color: colors.muted, marginTop: 6 },
  statHintSmall: { fontSize: 10, color: colors.muted, marginTop: 6, lineHeight: 14 },
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
  emptyInner: { alignItems: 'center', paddingVertical: 20 },
  emptyIcon: { fontSize: 28, marginBottom: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  emptyText: { fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: 6, paddingHorizontal: 12 },
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
  feedTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
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
  feedReceived: { fontSize: 11, color: colors.muted, marginTop: 4, textAlign: 'right' },
  feedItemVisit: {
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  visitWhenRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  visitHost: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 6 },
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
  th: { flex: 1, fontSize: 10, fontWeight: '700', color: colors.muted, textTransform: 'uppercase' },
  thPerson: { flex: 1.4 },
  td: { flex: 1, fontSize: 12, color: colors.text, paddingRight: 4 },
});
