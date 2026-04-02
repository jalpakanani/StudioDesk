import { useEffect, useLayoutEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import DatePickerField from '../components/DatePickerField';
import { useStudio } from '../context/StudioContext';
import { useConfirm } from '../context/ConfirmContext';
import { coerceDateFieldToISO, formatISODateDisplay, orderEventRange, toISODateOr } from '../utils/dateRange';
import { formatINR, sumPayments } from '../utils/money';
import { colors, radius } from '../theme';
import { deriveOrderWorkflowStatus, orderWorkflowLabel } from '../utils/orderWorkflow';
import { localCalendarTodayISO } from '../utils/reminders';

export default function OrderDetailScreen() {
  const { t } = useTranslation();
  const { confirmAsync } = useConfirm();
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const orderId = route.params?.orderId;

  useEffect(() => {
    if (!orderId) navigation.goBack();
  }, [orderId, navigation]);

  const {
    orders,
    clientById,
    studioReady,
    updateOrder,
    removeOrder,
    addClientPayment,
    removeClientPayment,
    addExposureGuest,
    updateExposureGuest,
    removeExposureGuest,
  } = useStudio();

  const order = orders.find((o) => o.id === orderId);
  const clientName = order ? clientById.get(order.clientId)?.name || '—' : '—';

  useLayoutEffect(() => {
    navigation.setOptions({ title: order?.title || 'Order' });
  }, [navigation, order?.title]);

  useEffect(() => {
    if (!studioReady || !orderId) return;
    if (!order) navigation.goBack();
  }, [studioReady, orderId, order, navigation]);

  if (!order) {
    return null;
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.detailHead}>
        <Text style={styles.heroTitle} numberOfLines={2}>
          {order.title}
        </Text>
        <TouchableOpacity
          style={styles.deleteOutline}
          onPress={() => {
            void (async () => {
              const ok = await confirmAsync({
                title: t('deleteOrderTitle'),
                message: t('deleteOrderMessage'),
                confirmLabel: t('dialogDelete'),
                cancelLabel: t('dialogCancel'),
              });
              if (ok) {
                removeOrder(order.id);
                navigation.goBack();
              }
            })();
          }}
        >
          <Text style={styles.deleteOutlineText}>Delete order</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.clientLine}>Client: {clientName}</Text>

      <View style={styles.autoStatusBanner}>
        <Text style={styles.autoStatusLabel}>Status</Text>
        <Text
          style={[
            styles.autoStatusPill,
            styles[`autoStatus_${deriveOrderWorkflowStatus(order, localCalendarTodayISO())}`],
          ]}
        >
          {orderWorkflowLabel(deriveOrderWorkflowStatus(order, localCalendarTodayISO()))}
        </Text>
        <Text style={styles.autoStatusHint}>From event dates and balance due.</Text>
      </View>

      <OrderMetaForm key={order.id} order={order} updateOrder={updateOrder} />

      <MoneyStrip order={order} />

      <ExposureGuestsBlock
        orderId={order.id}
        guests={order.exposureGuests}
        addExposureGuest={addExposureGuest}
        updateExposureGuest={updateExposureGuest}
        removeExposureGuest={removeExposureGuest}
      />

      <View style={styles.subblock}>
        <Text style={styles.subblockTitle}>Client payments / installments</Text>
        <ClientPaymentsBlock
          order={order}
          addClientPayment={addClientPayment}
          removeClientPayment={removeClientPayment}
        />
      </View>
    </ScrollView>
  );
}

function OrderMetaForm({ order, updateOrder }) {
  const er0 = orderEventRange(order);
  const [title, setTitle] = useState(order.title);
  const [totalAmount, setTotalAmount] = useState(String(order.totalAmount ?? ''));
  const [orderDate, setOrderDate] = useState(() => formatISODateDisplay(order.orderDate || ''));
  const [eventDateFrom, setEventDateFrom] = useState(() =>
    formatISODateDisplay(order.eventDateFrom || er0.from || ''),
  );
  const [eventDateTo, setEventDateTo] = useState(() => {
    const from = order.eventDateFrom || er0.from || '';
    const to = order.eventDateTo || er0.to || '';
    if (from && to === from) return '';
    return formatISODateDisplay(to);
  });
  const [notes, setNotes] = useState(order.notes || '');
  const [address, setAddress] = useState(order.address || '');

  useEffect(() => {
    const r = orderEventRange(order);
    const from = order.eventDateFrom || r.from || '';
    const to = order.eventDateTo || r.to || '';
    setOrderDate(formatISODateDisplay(order.orderDate || ''));
    setEventDateFrom(formatISODateDisplay(from));
    setEventDateTo(from && to === from ? '' : formatISODateDisplay(to));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- narrow deps: avoid resetting on every `order` reference
  }, [order.id, order.orderDate, order.eventDateFrom, order.eventDateTo]);

  function saveMeta() {
    const today = localCalendarTodayISO();
    const fallbackOrder = coerceDateFieldToISO(order.orderDate) || today;
    let evFrom = toISODateOr(eventDateFrom, '');
    let evTo = toISODateOr(eventDateTo, '');
    if (evFrom && !evTo) evTo = evFrom;
    if (evFrom && evTo && evTo < evFrom) evTo = evFrom;
    updateOrder(order.id, {
      title: title.trim(),
      totalAmount: Number(totalAmount) || 0,
      orderDate: toISODateOr(orderDate, fallbackOrder),
      eventDateFrom: evFrom,
      eventDateTo: evTo,
      notes: notes.trim(),
      address: address.trim(),
    });
  }

  const today = localCalendarTodayISO();
  const orderDateFallback = coerceDateFieldToISO(order.orderDate) || today;
  const evFromFallback = toISODateOr(eventDateFrom, today);
  const evToFallback = toISODateOr(eventDateTo, evFromFallback);

  return (
    <View style={styles.card}>
      <Text style={styles.labelCaps}>Name</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} />

      <Text style={styles.labelCaps}>Total (₹)</Text>
      <TextInput
        style={styles.input}
        value={totalAmount}
        onChangeText={setTotalAmount}
        keyboardType="decimal-pad"
      />

      <Text style={styles.labelCaps}>Order date</Text>
      <DatePickerField
        style={styles.input}
        value={orderDate}
        onChangeValue={setOrderDate}
        placeholder="DD/MM/YYYY"
        placeholderTextColor={colors.muted}
        fallbackISO={orderDateFallback}
      />

      <Text style={styles.labelCaps}>Event from</Text>
      <DatePickerField
        style={styles.input}
        value={eventDateFrom}
        onChangeValue={setEventDateFrom}
        placeholder="DD/MM/YYYY"
        placeholderTextColor={colors.muted}
        fallbackISO={evFromFallback}
      />

      <Text style={styles.labelCaps}>Event to</Text>
      <DatePickerField
        style={styles.input}
        value={eventDateTo}
        onChangeValue={setEventDateTo}
        placeholder="DD/MM/YYYY"
        placeholderTextColor={colors.muted}
        fallbackISO={evToFallback}
        allowEmpty
      />

      <Text style={styles.helper}>
        For single-day events, leave &quot;Event to&quot; empty. For weddings across several days, set both.
      </Text>

      <Text style={styles.labelCaps}>Venue / address</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={address}
        onChangeText={setAddress}
        multiline
        textAlignVertical="top"
        placeholder="Shoot or delivery address (optional)"
        placeholderTextColor={colors.muted}
      />

      <Text style={styles.labelCaps}>Notes</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={notes}
        onChangeText={setNotes}
        multiline
        textAlignVertical="top"
        placeholder="Internal notes…"
        placeholderTextColor={colors.muted}
      />

      <TouchableOpacity style={styles.saveBtn} onPress={saveMeta}>
        <Text style={styles.saveBtnText}>Save details</Text>
      </TouchableOpacity>
    </View>
  );
}

function MoneyStrip({ order }) {
  const received = sumPayments(order.clientPayments);
  const total = Number(order.totalAmount) || 0;
  const due = total - received;
  return (
    <View style={styles.moneyStrip}>
      <Text style={styles.moneyStripItem}>Received: {formatINR(received)}</Text>
      <Text style={styles.moneyStripItem}>Total: {formatINR(total)}</Text>
      <Text style={styles.moneyStripItem}>
        Due:{' '}
        <Text style={due > 0 ? styles.moneyDue : styles.moneyOk}>{formatINR(Math.max(0, due))}</Text>
      </Text>
    </View>
  );
}

function ExposureGuestsBlock({
  orderId,
  guests,
  addExposureGuest,
  updateExposureGuest,
  removeExposureGuest,
}) {
  const { t } = useTranslation();
  const { confirmAsync } = useConfirm();
  const list = guests || [];
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [gAmount, setGAmount] = useState('');
  const [gPartyKey, setGPartyKey] = useState('');
  const [gnotes, setGnotes] = useState('');
  const [editingId, setEditingId] = useState(null);

  function submitGuest() {
    if (!name.trim()) return;
    if (editingId) {
      updateExposureGuest(orderId, editingId, {
        name,
        phone,
        amountToPay: gAmount,
        partyKey: gPartyKey,
        notes: gnotes,
      });
      setEditingId(null);
      setName('');
      setPhone('');
      setGAmount('');
      setGPartyKey('');
      setGnotes('');
      return;
    }
    const g = addExposureGuest(orderId, {
      name,
      phone,
      amountToPay: gAmount,
      partyKey: gPartyKey,
      notes: gnotes,
    });
    if (g) {
      setName('');
      setPhone('');
      setGAmount('');
      setGPartyKey('');
      setGnotes('');
    }
  }

  function startEdit(g) {
    setEditingId(g.id);
    setName(g.name);
    setPhone(g.phone || '');
    setGAmount(String(g.amountToPay ?? ''));
    setGPartyKey(g.partyKey || '');
    setGnotes(g.notes || '');
  }

  function cancelEdit() {
    setEditingId(null);
    setName('');
    setPhone('');
    setGAmount('');
    setGPartyKey('');
    setGnotes('');
  }

  return (
    <View style={styles.subblock}>
      <Text style={styles.subblockTitle}>Who is coming to your studio for this Order</Text>
      <Text style={styles.instruction}>
        Add everyone who will be at <Text style={styles.bold}>your place</Text> for this job. When you go to
        someone else&apos;s location, use the <Text style={styles.bold}>My Exposing</Text> tab instead. If you owe
        them money for the exposure, enter it under <Text style={styles.bold}>Pay them</Text>. Use the same{' '}
        <Text style={styles.bold}>Match key</Text> on My Exposing (or the same spelling) so the dashboard can net
        what you collect minus what you pay.
      </Text>

      <Text style={styles.labelCaps}>Name *</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} />

      <Text style={styles.labelCaps}>Phone</Text>
      <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

      <Text style={styles.labelCaps}>Pay them (₹)</Text>
      <TextInput
        style={styles.input}
        value={gAmount}
        onChangeText={setGAmount}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={colors.muted}
      />

      <Text style={styles.labelCaps}>Match key</Text>
      <TextInput
        style={styles.input}
        value={gPartyKey}
        onChangeText={setGPartyKey}
        placeholder="e.g. sandip — same on My Exposing"
        placeholderTextColor={colors.muted}
      />

      <Text style={styles.labelCaps}>Note (role, day, etc.)</Text>
      <TextInput style={styles.input} value={gnotes} onChangeText={setGnotes} />

      <View style={styles.rowBtns}>
        <TouchableOpacity style={styles.addGuestBtn} onPress={submitGuest}>
          <Text style={styles.addGuestBtnText}>{editingId ? 'Save' : 'Add'}</Text>
        </TouchableOpacity>
        {editingId ? (
          <TouchableOpacity style={styles.cancelGhost} onPress={cancelEdit}>
            <Text style={styles.cancelGhostText}>Cancel</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {list.length === 0 ? (
        <Text style={styles.noneYet}>No one listed yet.</Text>
      ) : (
        list.map((g) => (
          <View key={g.id} style={styles.guestRow}>
            <View style={styles.guestCol}>
              <Text style={styles.guestName}>
                {g.name}
                {g.phone ? <Text style={styles.guestMeta}> · {g.phone}</Text> : null}
              </Text>
              {(Number(g.amountToPay) || 0) > 0 ? (
                <Text style={styles.guestMeta}>You pay: {formatINR(g.amountToPay)}</Text>
              ) : null}
              {g.partyKey ? <Text style={styles.guestMeta}>Match key: {g.partyKey}</Text> : null}
              {g.notes ? <Text style={styles.guestMeta}>{g.notes}</Text> : null}
            </View>
            <View style={styles.guestActions}>
              <TouchableOpacity style={styles.miniBtn} onPress={() => startEdit(g)}>
                <Text style={styles.miniBtnText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.miniBtn, styles.miniBtnDanger]}
                onPress={() => {
                  void (async () => {
                    const ok = await confirmAsync({
                      title: t('removeGuestTitle'),
                      message: t('removeGuestMessage', { name: g.name }),
                      confirmLabel: t('dialogRemove'),
                      cancelLabel: t('dialogCancel'),
                    });
                    if (ok) removeExposureGuest(orderId, g.id);
                  })();
                }}
              >
                <Text style={styles.miniBtnDangerText}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

function ClientPaymentsBlock({ order, addClientPayment, removeClientPayment }) {
  const { t } = useTranslation();
  const { confirmAsync } = useConfirm();
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(() => formatISODateDisplay(localCalendarTodayISO()));
  const [payNote, setPayNote] = useState('');

  function addPay() {
    if (!payAmount) return;
    const today = localCalendarTodayISO();
    const d = toISODateOr(payDate, today);
    addClientPayment(order.id, { amount: payAmount, date: d, note: payNote });
    setPayAmount('');
    setPayNote('');
    setPayDate(formatISODateDisplay(today));
  }

  return (
    <>
      <TextInput
        style={styles.input}
        value={payAmount}
        onChangeText={setPayAmount}
        keyboardType="decimal-pad"
        placeholder="Amount (₹)"
        placeholderTextColor={colors.muted}
      />
      <Text style={styles.labelCaps}>Payment date</Text>
      <DatePickerField
        style={styles.input}
        value={payDate}
        onChangeValue={setPayDate}
        placeholder="DD/MM/YYYY"
        placeholderTextColor={colors.muted}
        fallbackISO={localCalendarTodayISO()}
      />
      <Text style={styles.labelCaps}>Note</Text>
      <TextInput
        style={styles.input}
        value={payNote}
        onChangeText={setPayNote}
        placeholder="Note"
        placeholderTextColor={colors.muted}
      />
      <TouchableOpacity style={styles.addPayBtn} onPress={addPay}>
        <Text style={styles.addPayBtnText}>Add</Text>
      </TouchableOpacity>

      {(order.clientPayments || []).map((p) => (
        <View key={p.id} style={styles.payLine}>
          <View style={{ flex: 1 }}>
            <Text style={styles.payLineMain}>
              {formatISODateDisplay(p.date)} · {formatINR(p.amount)}
            </Text>
            {p.note ? <Text style={styles.guestMeta}>{p.note}</Text> : null}
          </View>
          <TouchableOpacity
            onPress={() => {
              void (async () => {
                const ok = await confirmAsync({
                  title: t('removePaymentTitle'),
                  message: t('removePaymentMessage', {
                    amount: formatINR(p.amount),
                    date: formatISODateDisplay(p.date),
                  }),
                  confirmLabel: t('dialogRemove'),
                  cancelLabel: t('dialogCancel'),
                });
                if (ok) removeClientPayment(order.id, p.id);
              })();
            }}
          >
            <Text style={styles.removePay}>×</Text>
          </TouchableOpacity>
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 16, paddingTop: 8 },
  detailHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroTitle: { flex: 1, fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  deleteOutline: {
    borderWidth: 1,
    borderColor: 'rgba(180, 60, 60, 0.45)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.dangerSoftBg,
  },
  deleteOutlineText: { color: colors.danger, fontWeight: '700', fontSize: 13 },
  clientLine: { fontSize: 14, color: colors.muted, marginTop: 8, marginBottom: 10 },
  autoStatusBanner: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  autoStatusLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.muted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  autoStatusPill: {
    alignSelf: 'flex-start',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    overflow: 'hidden',
  },
  autoStatus_booked: {
    backgroundColor: colors.accentSoft,
    color: colors.primary,
    borderWidth: 1,
    borderColor: 'rgba(91,74,232,0.28)',
  },
  autoStatus_in_progress: {
    backgroundColor: 'rgba(251,191,36,0.22)',
    color: '#b45309',
    borderWidth: 1,
    borderColor: 'rgba(217,119,6,0.35)',
  },
  autoStatus_pending_payment: {
    backgroundColor: 'rgba(251,191,36,0.25)',
    color: '#9a3412',
    borderWidth: 1,
    borderColor: 'rgba(234,88,12,0.4)',
  },
  autoStatus_closed: {
    backgroundColor: colors.surfaceSolid,
    color: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  autoStatusHint: { fontSize: 12, color: colors.muted, marginTop: 8, lineHeight: 17 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  labelCaps: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
    marginTop: 10,
  },
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
  textArea: { minHeight: 88, paddingTop: 12 },
  helper: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 8,
    lineHeight: 17,
  },
  saveBtn: {
    marginTop: 16,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.sm,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
    }),
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  moneyStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  moneyStripItem: { fontSize: 14, color: colors.text, fontWeight: '600' },
  moneyDue: { color: colors.warn, fontWeight: '800' },
  moneyOk: { color: colors.success, fontWeight: '800' },
  subblock: { marginTop: 20 },
  subblockTitle: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 10 },
  instruction: {
    fontSize: 13,
    color: colors.muted,
    lineHeight: 19,
    marginBottom: 12,
  },
  bold: { color: colors.text, fontWeight: '700' },
  rowBtns: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  addGuestBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: radius.sm,
  },
  addGuestBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  cancelGhost: { padding: 10 },
  cancelGhostText: { color: colors.muted, fontSize: 15, fontWeight: '600' },
  noneYet: { fontSize: 13, color: colors.muted, marginTop: 12 },
  guestRow: {
    flexDirection: 'row',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: 8,
  },
  guestCol: { flex: 1 },
  guestName: { fontSize: 16, fontWeight: '700', color: colors.text },
  guestMeta: { fontSize: 13, color: colors.muted, marginTop: 2 },
  guestActions: { justifyContent: 'center', gap: 8 },
  miniBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.secondaryBtnBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  miniBtnText: { fontSize: 13, fontWeight: '600', color: colors.text },
  miniBtnDanger: { backgroundColor: colors.dangerSoftBg, borderColor: 'rgba(180, 60, 60, 0.35)' },
  miniBtnDangerText: { fontSize: 13, fontWeight: '600', color: colors.danger, textAlign: 'center' },
  addPayBtn: {
    alignSelf: 'flex-start',
    marginTop: 12,
    backgroundColor: colors.primary,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: radius.sm,
  },
  addPayBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  payLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  payLineMain: { fontSize: 15, fontWeight: '600', color: colors.text },
  removePay: { fontSize: 22, color: colors.danger, paddingHorizontal: 8, fontWeight: '300' },
});
