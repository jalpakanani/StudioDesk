import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import OpenDeskSearchButton from '../components/OpenDeskSearchButton';
import { useStudio } from '../context/StudioContext';
import {
  coerceDateFieldToISO,
  formatDateRangeEn,
  formatISODateDisplay,
  orderEventRange,
  toISODateOr,
} from '../utils/dateRange';
import { formatINR, sumPayments } from '../utils/money';
import { colors, radius } from '../theme';

function orderSortKey(o) {
  const { from, to } = orderEventRange(o);
  const end = to || from;
  const od = coerceDateFieldToISO(o.orderDate);
  return end || od || '9999-12-31';
}

export default function OrdersListScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const scrollRef = useRef(null);
  const titleRef = useRef(null);
  const rowYRef = useRef({});
  const { orders, clients, clientById, addOrder } = useStudio();

  const [newClientId, setNewClientId] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newTotal, setNewTotal] = useState('');
  const [newOrderDate, setNewOrderDate] = useState(() =>
    formatISODateDisplay(new Date().toISOString().slice(0, 10)),
  );
  const [newEventFrom, setNewEventFrom] = useState('');
  const [newEventTo, setNewEventTo] = useState('');
  const [showNewOrderForm, setShowNewOrderForm] = useState(false);
  const [pulseOrderId, setPulseOrderId] = useState(null);

  const highlightOrderId = route.params?.highlightOrderId;

  useFocusEffect(
    useCallback(() => {
      if (!highlightOrderId) return undefined;
      setPulseOrderId(highlightOrderId);
      const tScroll = setTimeout(() => {
        const y = rowYRef.current[highlightOrderId];
        if (y != null) {
          scrollRef.current?.scrollTo({ y: Math.max(0, y - 24), animated: true });
        }
      }, 180);
      const tClearPulse = setTimeout(() => setPulseOrderId(null), 2200);
      const tClearParam = setTimeout(() => {
        navigation.setParams({ highlightOrderId: undefined });
      }, 80);
      return () => {
        clearTimeout(tScroll);
        clearTimeout(tClearPulse);
        clearTimeout(tClearParam);
      };
    }, [highlightOrderId, navigation]),
  );

  const sorted = useMemo(
    () =>
      [...orders].sort((a, b) => {
        const ka = orderSortKey(a);
        const kb = orderSortKey(b);
        return ka.localeCompare(kb);
      }),
    [orders],
  );

  function submitOrder() {
    const today = new Date().toISOString().slice(0, 10);
    const orderDateISO = toISODateOr(newOrderDate, today);
    const evFrom = toISODateOr(newEventFrom, '');
    const evToRaw = toISODateOr(newEventTo, '');
    const o = addOrder({
      clientId: newClientId,
      title: newTitle,
      totalAmount: newTotal,
      orderDate: orderDateISO,
      eventDateFrom: evFrom,
      eventDateTo: evToRaw || evFrom,
    });
    if (o) {
      setNewTitle('');
      setNewTotal('');
      setNewEventFrom('');
      setNewEventTo('');
      setNewClientId('');
      setShowNewOrderForm(false);
      navigation.navigate('OrderDetail', { orderId: o.id });
    }
  }

  function closeNewOrderForm() {
    setShowNewOrderForm(false);
    setNewClientId('');
    setNewTitle('');
    setNewTotal('');
    setNewOrderDate(formatISODateDisplay(new Date().toISOString().slice(0, 10)));
    setNewEventFrom('');
    setNewEventTo('');
  }

  function openNewOrderForm() {
    setShowNewOrderForm(true);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      setTimeout(() => titleRef.current?.focus(), 300);
    });
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headRow}>
          <View style={styles.headTextCol}>
            <Text style={styles.title}>Orders</Text>
            <Text style={styles.lead}>
              Quote, booking date, optional <Text style={styles.leadStrong}>event from → to</Text> for multi-day
              functions (e.g. wedding), and client payments.
            </Text>
          </View>
          <View style={styles.headActions}>
            <OpenDeskSearchButton />
            {clients.length > 0 ? (
              <TouchableOpacity
                style={showNewOrderForm ? styles.headerBtnGhost : styles.headerBtnPrimary}
                onPress={() => (showNewOrderForm ? closeNewOrderForm() : setShowNewOrderForm(true))}
                activeOpacity={0.85}
              >
                <Text style={showNewOrderForm ? styles.headerBtnGhostText : styles.headerBtnPrimaryText}>
                  {showNewOrderForm ? 'Close' : '+ New'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {!clients.length ? (
          <View style={styles.glass}>
            <Text style={styles.glassTitle}>Almost there</Text>
            <Text style={styles.glassCopy}>
              Add a client first—then you can attach orders and track payments.
            </Text>
            <TouchableOpacity style={styles.glassBtn} onPress={() => navigation.getParent()?.navigate('Clients')}>
              <Text style={styles.glassBtnText}>Go to Clients</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {clients.length > 0 && showNewOrderForm ? (
          <View style={styles.glass}>
            <View style={styles.formHeadRow}>
              <Text style={styles.sectionKicker}>New order</Text>
              <TouchableOpacity onPress={closeNewOrderForm} hitSlop={12}>
                <Text style={styles.cancelLink}>Cancel</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.labelCaps}>Client *</Text>
            {!newClientId ? (
              <Text style={styles.selectHint}>— Select —</Text>
            ) : (
              <Text style={styles.selectedClientName}>{clientById.get(newClientId)?.name}</Text>
            )}
            <Text style={styles.quickSelectLabel}>Quick select</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              {clients.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.chip, newClientId === c.id && styles.chipOn]}
                  onPress={() => setNewClientId(c.id)}
                >
                  <Text style={[styles.chipText, newClientId === c.id && styles.chipTextOn]}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.labelCaps}>Order / event name *</Text>
            <TextInput
              ref={titleRef}
              style={styles.input}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="Event name"
              placeholderTextColor={colors.muted}
            />

            <Text style={styles.labelCaps}>Total quote (₹)</Text>
            <TextInput
              style={styles.input}
              value={newTotal}
              onChangeText={setNewTotal}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.muted}
            />

            <Text style={styles.labelCaps}>Order date</Text>
            <TextInput
              style={styles.input}
              value={newOrderDate}
              onChangeText={setNewOrderDate}
              placeholder="DD/MM/YYYY"
              placeholderTextColor={colors.muted}
            />

            <Text style={styles.labelCaps}>Event from</Text>
            <TextInput
              style={styles.input}
              value={newEventFrom}
              onChangeText={setNewEventFrom}
              placeholder="DD/MM/YYYY"
              placeholderTextColor={colors.muted}
            />

            <Text style={styles.labelCaps}>Event to</Text>
            <TextInput
              style={styles.input}
              value={newEventTo}
              onChangeText={setNewEventTo}
              placeholder="Leave empty for single day"
              placeholderTextColor={colors.muted}
            />

            <TouchableOpacity
              style={[
                styles.createBtn,
                (!newClientId || !newTitle.trim()) && styles.createBtnDisabled,
              ]}
              disabled={!newClientId || !newTitle.trim()}
              onPress={submitOrder}
            >
              <Text style={styles.createBtnText}>Create order</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <Text style={[styles.subhead, !showNewOrderForm && styles.subheadTight]}>Your jobs</Text>

        {orders.length === 0 && clients.length > 0 ? (
          <TouchableOpacity style={styles.emptySpot} activeOpacity={0.9} onPress={openNewOrderForm}>
            <Text style={styles.emptyIcon}>✦</Text>
            <Text style={styles.emptyTitle}>No orders yet</Text>
            <Text style={styles.emptyCopy}>Tap to add your first booking.</Text>
          </TouchableOpacity>
        ) : null}

        {orders.length === 0 && !clients.length ? (
          <Text style={styles.mutedLine}>Add a client to create orders.</Text>
        ) : null}

        {sorted.map((o) => {
          const rec = sumPayments(o.clientPayments);
          const total = Number(o.totalAmount) || 0;
          const due = total - rec;
          const ev = orderEventRange(o);
          const evLabel = ev.from ? formatDateRangeEn(ev.from, ev.to) : null;
          const guestCount = (o.exposureGuests || []).length;
          return (
            <TouchableOpacity
              key={o.id}
              style={[
                styles.jobCard,
                styles.jobCardTouchable,
                pulseOrderId === o.id && styles.jobCardPulse,
              ]}
              onLayout={(e) => {
                rowYRef.current[o.id] = e.nativeEvent.layout.y;
              }}
              onPress={() => navigation.navigate('OrderDetail', { orderId: o.id })}
              activeOpacity={0.85}
            >
              <Text style={styles.jobTitle}>{o.title}</Text>
              <Text style={styles.jobMeta}>
                {clientById.get(o.clientId)?.name} · Due:{' '}
                <Text style={due > 0 ? styles.warn : styles.ok}>{formatINR(Math.max(0, due))}</Text>
              </Text>
              {evLabel ? <Text style={styles.jobMeta}>Event: {evLabel}</Text> : null}
              {guestCount > 0 ? (
                <Text style={styles.guestHint}>{guestCount} coming to studio</Text>
              ) : null}
            </TouchableOpacity>
          );
        })}

        <View style={styles.detailHint}>
          <Text style={styles.detailHintIcon}>📋</Text>
          <Text style={styles.detailHintText}>Pick a job above to edit the quote, studio guests, and payments.</Text>
          <TouchableOpacity style={styles.detailHintBtn} onPress={() => navigation.getParent()?.navigate('Field')}>
            <Text style={styles.detailHintBtnText}>Outside shoots → My Exposing</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 36 },
  headRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headTextCol: { flex: 1, minWidth: 0 },
  headActions: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', marginTop: 4 },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.4 },
  lead: { fontSize: 14, color: colors.muted, marginTop: 10, lineHeight: 21, maxWidth: 360 },
  leadStrong: { color: colors.text, fontWeight: '600' },
  headerBtnPrimary: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  headerBtnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  headerBtnGhost: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.surfaceSolid,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  headerBtnGhostText: { color: colors.muted, fontWeight: '700', fontSize: 15 },
  formHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cancelLink: { fontSize: 15, fontWeight: '600', color: colors.primary },
  quickSelectLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
    marginBottom: 6,
    marginTop: 4,
  },
  glass: {
    marginTop: 16,
    padding: 18,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      ios: {
        shadowColor: '#2d235a',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
      },
      android: { elevation: 3 },
    }),
  },
  sectionKicker: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.muted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 0,
  },
  glassTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  glassCopy: { fontSize: 14, color: colors.muted, marginTop: 8, lineHeight: 20 },
  glassBtn: {
    alignSelf: 'flex-start',
    marginTop: 14,
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: radius.sm,
  },
  glassBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  labelCaps: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
    marginTop: 12,
  },
  selectHint: { fontSize: 15, color: colors.muted, marginBottom: 8, fontStyle: 'italic' },
  selectedClientName: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 8 },
  chipScroll: { marginBottom: 4, maxHeight: 48 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.surfaceSolid,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  chipOn: { borderColor: colors.primary, backgroundColor: colors.chipOnBg },
  chipText: { color: colors.muted, fontSize: 14, fontWeight: '500' },
  chipTextOn: { color: colors.primary, fontWeight: '700' },
  input: {
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  createBtn: {
    marginTop: 18,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  createBtnDisabled: { opacity: 0.45 },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  subhead: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.muted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 22,
    marginBottom: 10,
  },
  subheadTight: { marginTop: 14 },
  emptySpot: {
    padding: 20,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.secondaryPillBg,
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyIcon: { fontSize: 32, marginBottom: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  emptyCopy: { fontSize: 14, color: colors.muted, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  mutedLine: { fontSize: 14, color: colors.muted, marginTop: 8, marginBottom: 8 },
  jobCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  jobCardTouchable: { alignSelf: 'stretch' },
  jobCardPulse: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: colors.accentSoft,
  },
  jobTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  jobMeta: { fontSize: 13, color: colors.muted, marginTop: 4 },
  warn: { color: colors.warn, fontWeight: '700' },
  ok: { color: colors.success, fontWeight: '700' },
  guestHint: { fontSize: 12, color: colors.primary, fontWeight: '600', marginTop: 6 },
  detailHint: {
    marginTop: 20,
    padding: 18,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  detailHintIcon: { fontSize: 28, marginBottom: 8 },
  detailHintText: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  detailHintBtn: { marginTop: 12, paddingVertical: 10, paddingHorizontal: 14 },
  detailHintBtnText: { fontSize: 14, fontWeight: '700', color: colors.primary },
});
