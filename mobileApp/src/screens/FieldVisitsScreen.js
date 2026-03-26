import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useStudio } from '../context/StudioContext';
import DatePickerField from '../components/DatePickerField';
import OpenDeskSearchButton from '../components/OpenDeskSearchButton';
import { fieldVisitRange, formatDateRangeEn, formatISODateDisplay, toISODateOr } from '../utils/dateRange';
import { formatINR, sumPayments } from '../utils/money';
import { groupedFieldVisitCardStats } from '../utils/settlement';
import { colors, radius } from '../theme';

function oneVisitCard(v) {
  const oneDue = Math.max(0, (Number(v.amountToCollect) || 0) - sumPayments(v.collections));
  return {
    totalToCollect: Number(v.amountToCollect) || 0,
    received: sumPayments(v.collections),
    due: oneDue,
    visitCount: 1,
    payToGuest: 0,
    net: oneDue,
  };
}

export default function FieldVisitsScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const {
    orders,
    fieldVisits,
    addFieldVisit,
    updateFieldVisit,
    addFieldVisitCollection,
    removeFieldVisitCollection,
    removeFieldVisit,
  } = useStudio();
  const [addOpen, setAddOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [tipOpen, setTipOpen] = useState(false);
  const [flashVisitId, setFlashVisitId] = useState(null);
  const listRef = useRef(null);
  const visits = useMemo(() => fieldVisits ?? [], [fieldVisits]);

  const sorted = useMemo(() => {
    return [...visits].sort((a, b) => {
      const ra = fieldVisitRange(a);
      const rb = fieldVisitRange(b);
      const c = ra.from.localeCompare(rb.from);
      if (c !== 0) return c;
      return (a.time || '').localeCompare(b.time || '');
    });
  }, [visits]);

  const cardStatsByVisitId = useMemo(
    () => groupedFieldVisitCardStats(fieldVisits, orders),
    [fieldVisits, orders],
  );

  useEffect(() => {
    if (!detail) return;
    const next = visits.find((v) => v.id === detail.id);
    if (next) setDetail(next);
  }, [visits, detail]);

  const highlightVisitId = route.params?.highlightVisitId;

  useFocusEffect(
    useCallback(() => {
      if (!highlightVisitId) return undefined;
      const idx = sorted.findIndex((v) => v.id === highlightVisitId);
      setFlashVisitId(highlightVisitId);
      const tScroll = setTimeout(() => {
        if (idx >= 0) {
          listRef.current?.scrollToIndex({ index: idx, viewPosition: 0.12 });
        }
      }, 200);
      const tPulse = setTimeout(() => setFlashVisitId(null), 2200);
      const tParam = setTimeout(() => navigation.setParams({ highlightVisitId: undefined }), 100);
      return () => {
        clearTimeout(tScroll);
        clearTimeout(tPulse);
        clearTimeout(tParam);
      };
    }, [highlightVisitId, sorted, navigation]),
  );

  const ListHeader = useCallback(
    () => (
      <View style={styles.headerBlock}>
        <View style={styles.headRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>My Exposing</Text>
            <Text style={styles.lead}>
              Outside shoot: who, where, how much they pay you. Multi-day? Set To date.
            </Text>
            <TouchableOpacity onPress={() => setTipOpen((x) => !x)} style={styles.tipToggle}>
              <Text style={styles.tipToggleText}>{tipOpen ? '▼' : '▶'} Same person on an order?</Text>
            </TouchableOpacity>
            {tipOpen ? (
              <Text style={styles.tipBody}>
                If you also Pay them on an order (exposure guest), use the same match key on both. The card
                then shows what you collect, what you owe on the order, and the net.
              </Text>
            ) : null}
          </View>
          <View style={styles.headActions}>
            <OpenDeskSearchButton />
            <TouchableOpacity style={styles.addBtn} onPress={() => setAddOpen(true)}>
              <Text style={styles.addBtnText}>+ New</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.subhead}>Entries ({sorted.length})</Text>

        {sorted.length === 0 ? (
          <View style={styles.emptyBanner}>
            <Text style={styles.emptyEmoji}>🚐</Text>
            <Text style={styles.emptyText}>
              Nothing saved yet. Add one when you book an outside job (tap + New).
            </Text>
          </View>
        ) : null}
      </View>
    ),
    [sorted.length, tipOpen],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <FlatList
        ref={listRef}
        data={sorted}
        keyExtractor={(v) => v.id}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={null}
        contentContainerStyle={styles.list}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            listRef.current?.scrollToIndex({
              index: info.index,
              viewPosition: 0.12,
            });
          }, 350);
        }}
        renderItem={({ item: v }) => {
          const { from, to } = fieldVisitRange(v);
          const card = cardStatsByVisitId.get(v.id) || oneVisitCard(v);
          const total = card.totalToCollect;
          const received = card.received;
          const due = card.due;
          return (
            <TouchableOpacity
              style={[styles.row, flashVisitId === v.id && styles.rowPulse]}
              onPress={() => setDetail(v)}
            >
              <View style={{ flex: 1 }}>
                <View style={styles.whenRow}>
                  <Text style={styles.whenStrong}>{formatDateRangeEn(from, to)}</Text>
                  {v.time ? <Text style={styles.rowSub}> · {v.time}</Text> : null}
                </View>
                <Text style={styles.hostLine}>At / with {v.hostName}</Text>
                {v.partyKey ? <Text style={styles.rowSub}>Match key: {v.partyKey}</Text> : null}
                {v.venue ? <Text style={styles.rowSub}>{v.venue}</Text> : null}
                {card.visitCount > 1 ? (
                  <Text style={styles.combineNote}>
                    {card.visitCount} entries, same contact—one combined total.
                  </Text>
                ) : null}
                <View style={styles.moneyRow}>
                  <Text style={styles.rowSub}>
                    To collect {formatINR(total)} · Received {formatINR(received)}
                  </Text>
                </View>
                {card.payToGuest > 0 ? (
                  <Text style={styles.rowSub}>Pay on order {formatINR(card.payToGuest)}</Text>
                ) : null}
                {card.payToGuest > 0 ? (
                  <Text
                    style={[
                      styles.netLine,
                      card.net > 0 ? styles.netCollect : card.net < 0 ? styles.netPay : styles.netEven,
                    ]}
                  >
                    Net {card.net > 0 ? `collect ${formatINR(card.net)}` : card.net < 0 ? `pay ${formatINR(-card.net)}` : 'even'}
                  </Text>
                ) : null}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.rowTitle}>{formatINR(total)}</Text>
                {due > 0 ? (
                  <Text style={styles.dueText}>{formatINR(due)} to collect</Text>
                ) : (
                  <Text style={styles.paidText}>Done</Text>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
      />

      <Modal visible={addOpen} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            <AddVisitForm
              onClose={() => setAddOpen(false)}
              onCreate={(payload) => {
                if (addFieldVisit(payload)) setAddOpen(false);
              }}
            />
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={!!detail} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            {detail ? (
              <VisitDetail
                visit={detail}
                card={cardStatsByVisitId.get(detail.id) || oneVisitCard(detail)}
                onClose={() => setDetail(null)}
                onAddCollection={(p) => addFieldVisitCollection(detail.id, p)}
                onRemoveCollection={(cid) => removeFieldVisitCollection(detail.id, cid)}
                onUpdatePartyKey={(partyKey) => updateFieldVisit(detail.id, { partyKey })}
                onDelete={() => {
                  removeFieldVisit(detail.id);
                  setDetail(null);
                }}
              />
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function AddVisitForm({ onClose, onCreate }) {
  const todayISO = new Date().toISOString().slice(0, 10);
  const [hostName, setHostName] = useState('');
  const [venue, setVenue] = useState('');
  const [dateFrom, setDateFrom] = useState(() => formatISODateDisplay(todayISO));
  const [dateTo, setDateTo] = useState('');
  const [time, setTime] = useState('');
  const [amountToCollect, setAmountToCollect] = useState('');
  const [partyKey, setPartyKey] = useState('');
  const [notes, setNotes] = useState('');

  return (
    <View style={styles.modalCard}>
      <Text style={styles.modalTitle}>New visit</Text>
      <Text style={styles.label}>Whose place / who *</Text>
      <TextInput
        style={styles.input}
        value={hostName}
        onChangeText={setHostName}
        placeholder="e.g. Rahul, Meera aunty, XYZ studio"
        placeholderTextColor={colors.muted}
      />
      <Text style={styles.label}>Venue or address</Text>
      <TextInput
        style={styles.input}
        value={venue}
        onChangeText={setVenue}
        placeholder="Area, full address, landmark…"
        placeholderTextColor={colors.muted}
      />
      <Text style={styles.label}>From date * (DD/MM/YYYY)</Text>
      <DatePickerField
        style={styles.input}
        value={dateFrom}
        onChangeValue={setDateFrom}
        placeholder="DD/MM/YYYY"
        placeholderTextColor={colors.muted}
        fallbackISO={todayISO}
      />
      <Text style={styles.label}>To date (optional)</Text>
      <DatePickerField
        style={styles.input}
        value={dateTo}
        onChangeValue={setDateTo}
        placeholder="Multi-day end"
        placeholderTextColor={colors.muted}
        fallbackISO={toISODateOr(dateFrom, todayISO)}
        allowEmpty
      />
      <Text style={styles.label}>Time</Text>
      <TextInput
        style={styles.input}
        value={time}
        onChangeText={setTime}
        placeholder='e.g. 4pm or "all day"'
        placeholderTextColor={colors.muted}
      />
      <Text style={styles.label}>Amount to collect (₹) *</Text>
      <TextInput
        style={styles.input}
        value={amountToCollect}
        onChangeText={setAmountToCollect}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={colors.muted}
      />
      <Text style={styles.label}>Match key (optional)</Text>
      <TextInput
        style={styles.input}
        value={partyKey}
        onChangeText={setPartyKey}
        placeholder="Same as order Pay them row, e.g. sandip"
        placeholderTextColor={colors.muted}
      />
      <Text style={styles.label}>Notes</Text>
      <TextInput
        style={styles.input}
        value={notes}
        onChangeText={setNotes}
        placeholder="Package, deliverables…"
        placeholderTextColor={colors.muted}
      />
      <TouchableOpacity
        style={styles.btnPrimary}
        onPress={() => {
          const from = toISODateOr(dateFrom, todayISO);
          const to = toISODateOr(dateTo, '') || from;
          onCreate({
            hostName,
            venue,
            dateFrom: from,
            dateTo: to,
            time,
            amountToCollect,
            partyKey,
            notes,
          });
        }}
      >
        <Text style={styles.btnText}>Create</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.btnGhost} onPress={onClose}>
        <Text style={styles.btnGhostText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

function VisitDetail({ visit, card, onClose, onAddCollection, onRemoveCollection, onUpdatePartyKey, onDelete }) {
  const [amt, setAmt] = useState('');
  const [note, setNote] = useState('');
  const [partyKey, setPartyKey] = useState(visit.partyKey || '');
  const { from, to } = fieldVisitRange(visit);
  const collected = sumPayments(visit.collections);
  const due = Math.max(0, (Number(visit.amountToCollect) || 0) - collected);

  useEffect(() => {
    setPartyKey(visit.partyKey || '');
  }, [visit.id, visit.partyKey]);

  return (
    <View style={styles.modalCard}>
      <Text style={styles.modalTitle}>{visit.hostName}</Text>
      <Text style={styles.rowSub}>{visit.venue || '—'}</Text>
      <Text style={styles.rowSub}>{formatDateRangeEn(from, to)}</Text>
      {visit.partyKey ? <Text style={styles.rowSub}>Match key: {visit.partyKey}</Text> : null}
      {visit.notes ? <Text style={styles.notesBlock}>{visit.notes}</Text> : null}
      <Text style={styles.bigDue}>
        {formatINR(Number(visit.amountToCollect) || 0)} · {formatINR(due)} left
      </Text>

      {card.visitCount > 1 ? (
        <Text style={styles.rowSub}>{card.visitCount} entries combined for this contact.</Text>
      ) : null}
      {card.payToGuest > 0 ? (
        <Text style={styles.rowSub}>Pay on order {formatINR(card.payToGuest)}</Text>
      ) : null}
      {card.payToGuest > 0 ? (
        <Text style={styles.bigDue}>
          Net:{' '}
          {card.net > 0
            ? `Collect ${formatINR(card.net)}`
            : card.net < 0
              ? `Pay ${formatINR(-card.net)}`
              : 'Even'}
        </Text>
      ) : null}

      <Text style={styles.section}>Match key (links to order Pay them)</Text>
      <TextInput
        style={styles.input}
        value={partyKey}
        onChangeText={setPartyKey}
        placeholder="Same as exposure guest"
        placeholderTextColor={colors.muted}
      />
      <TouchableOpacity style={styles.btnSecondary} onPress={() => onUpdatePartyKey(partyKey)}>
        <Text style={styles.btnSecondaryText}>Save match key</Text>
      </TouchableOpacity>

      <Text style={styles.section}>Collections</Text>
      {(visit.collections || []).map((p) => (
        <View key={p.id} style={styles.payRow}>
          <Text style={styles.rowSub}>
            {formatINR(p.amount)} · {formatISODateDisplay(p.date)}
            {p.note ? ` · ${p.note}` : ''}
          </Text>
          <TouchableOpacity onPress={() => onRemoveCollection(p.id)}>
            <Text style={styles.del}>Remove</Text>
          </TouchableOpacity>
        </View>
      ))}

      <TextInput
        style={styles.input}
        placeholder="Amount"
        placeholderTextColor={colors.muted}
        value={amt}
        onChangeText={setAmt}
        keyboardType="decimal-pad"
      />
      <TextInput
        style={styles.input}
        placeholder="Note"
        placeholderTextColor={colors.muted}
        value={note}
        onChangeText={setNote}
      />
      <TouchableOpacity
        style={styles.btnPrimary}
        onPress={() => {
          if (!amt) return;
          onAddCollection({ amount: amt, note });
          setAmt('');
          setNote('');
        }}
      >
        <Text style={styles.btnText}>Add collection</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.btnPrimary, styles.dangerBtn2]} onPress={onDelete}>
        <Text style={styles.btnText}>Delete visit</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.btnGhost} onPress={onClose}>
        <Text style={styles.btnGhostText}>Close</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  headerBlock: { paddingHorizontal: 16, paddingBottom: 8 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  headActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  lead: { fontSize: 14, color: colors.muted, marginTop: 8, lineHeight: 20, maxWidth: 320 },
  tipToggle: { marginTop: 10, alignSelf: 'flex-start' },
  tipToggleText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  tipBody: { fontSize: 13, color: colors.muted, marginTop: 8, lineHeight: 19 },
  addBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  addBtnText: { color: '#fff', fontWeight: '600' },
  subhead: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 16, marginBottom: 8 },
  emptyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: 8,
  },
  emptyEmoji: { fontSize: 24 },
  emptyText: { flex: 1, fontSize: 14, color: colors.muted, lineHeight: 20 },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  row: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowPulse: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: colors.accentSoft,
  },
  rowTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  rowSub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  whenRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  whenStrong: { fontSize: 14, fontWeight: '800', color: colors.text },
  hostLine: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 6 },
  combineNote: { fontSize: 12, color: colors.muted, marginTop: 6, fontStyle: 'italic' },
  moneyRow: { marginTop: 4 },
  netLine: { fontSize: 13, fontWeight: '700', marginTop: 4 },
  netCollect: { color: colors.warn },
  netPay: { color: colors.text },
  netEven: { color: colors.success },
  dueText: { fontSize: 13, color: colors.warn, marginTop: 4 },
  paidText: { fontSize: 13, color: colors.success, marginTop: 4 },
  muted: { color: colors.muted, padding: 16 },
  modalBg: { flex: 1, backgroundColor: colors.modalOverlay, justifyContent: 'flex-end' },
  modalScroll: { padding: 16, paddingBottom: 40 },
  modalCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 12 },
  label: { fontSize: 13, color: colors.muted, marginBottom: 6 },
  input: {
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 10,
    padding: 12,
    color: colors.text,
    marginBottom: 10,
    fontSize: 16,
  },
  btnPrimary: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  btnSecondary: {
    backgroundColor: colors.secondaryBtnBg,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnSecondaryText: { color: colors.text, fontWeight: '600', fontSize: 15 },
  dangerBtn2: { backgroundColor: colors.danger, marginTop: 12 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  btnGhost: { marginTop: 12, alignItems: 'center', padding: 12 },
  btnGhostText: { color: colors.muted, fontSize: 16 },
  section: { fontSize: 15, fontWeight: '600', color: colors.text, marginTop: 16, marginBottom: 8 },
  payRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  del: { color: colors.danger, fontSize: 13 },
  bigDue: { fontSize: 16, color: colors.text, marginVertical: 8, fontWeight: '600' },
  notesBlock: { fontSize: 14, color: colors.text, marginTop: 8, lineHeight: 20 },
});
