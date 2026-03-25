import { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStudio } from '../context/StudioContext';
import { colors, radius } from '../theme';

export default function ClientsScreen() {
  const { clients, addClient, updateClient, removeClient } = useStudio();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [edit, setEdit] = useState(null);
  const nameRef = useRef(null);

  const submitNew = useCallback(() => {
    const c = addClient({ name, phone, notes });
    if (c) {
      setName('');
      setPhone('');
      setNotes('');
    }
  }, [addClient, name, phone, notes]);

  const listHeader = useMemo(
    () => (
      <View style={styles.headerBlock}>
        <Text style={styles.title}>Clients</Text>
        <Text style={styles.lead}>People you shoot for—used on every order and payment line.</Text>

        {clients.length === 0 ? (
          <TouchableOpacity
            style={styles.emptySpot}
            activeOpacity={0.9}
            onPress={() => nameRef.current?.focus()}
          >
            <Text style={styles.emptyIcon}>👋</Text>
            <Text style={styles.emptyTitle}>Add your first client</Text>
            <Text style={styles.emptyCopy}>Tap here or fill the form below—takes a few seconds.</Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.glass}>
          <Text style={styles.glassTitle}>Quick add</Text>
          <TextInput
            ref={nameRef}
            style={styles.input}
            placeholder="Name *"
            placeholderTextColor={colors.muted}
            value={name}
            onChangeText={setName}
          />
          <TextInput
            style={styles.input}
            placeholder="Phone"
            placeholderTextColor={colors.muted}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
          <TextInput
            style={styles.input}
            placeholder="Notes"
            placeholderTextColor={colors.muted}
            value={notes}
            onChangeText={setNotes}
          />
          <TouchableOpacity style={styles.btnPrimary} onPress={submitNew}>
            <Text style={styles.btnText}>Add client</Text>
          </TouchableOpacity>
        </View>

        {clients.length > 0 ? <Text style={styles.subhead}>Directory ({clients.length})</Text> : null}
      </View>
    ),
    [clients.length, name, phone, notes, submitNew],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <FlatList
        data={clients}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          clients.length === 0 ? null : <Text style={styles.muted}>No clients yet.</Text>
        }
        contentContainerStyle={styles.list}
        renderItem={({ item: c }) => (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{c.name}</Text>
              {c.phone ? <Text style={styles.rowSub}>{c.phone}</Text> : null}
              {c.notes ? <Text style={styles.rowSub}>{c.notes}</Text> : null}
            </View>
            <TouchableOpacity onPress={() => setEdit(c)} style={styles.smallBtn}>
              <Text style={styles.smallBtnText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => removeClient(c.id)}
              style={[styles.smallBtn, styles.dangerBtn]}
            >
              <Text style={styles.smallBtnText}>Del</Text>
            </TouchableOpacity>
          </View>
        )}
      />

      <Modal visible={!!edit} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit client</Text>
            {edit ? (
              <EditForm
                c={edit}
                onSave={(payload) => {
                  updateClient(edit.id, payload);
                  setEdit(null);
                }}
                onClose={() => setEdit(null)}
              />
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function EditForm({ c, onSave, onClose }) {
  const [name, setName] = useState(c.name);
  const [phone, setPhone] = useState(c.phone || '');
  const [notes, setNotes] = useState(c.notes || '');
  return (
    <>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Name" />
      <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="Phone" />
      <TextInput style={styles.input} value={notes} onChangeText={setNotes} placeholder="Notes" />
      <TouchableOpacity style={styles.btnPrimary} onPress={() => onSave({ name, phone, notes })}>
        <Text style={styles.btnText}>Save</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.btnGhost} onPress={onClose}>
        <Text style={styles.btnGhostText}>Cancel</Text>
      </TouchableOpacity>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  headerBlock: { paddingHorizontal: 16, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  lead: { fontSize: 14, color: colors.muted, marginTop: 8, lineHeight: 20 },
  emptySpot: {
    marginTop: 14,
    padding: 18,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.secondaryPillBg,
    alignItems: 'center',
  },
  emptyIcon: { fontSize: 28, marginBottom: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  emptyCopy: { fontSize: 14, color: colors.muted, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  glass: {
    marginTop: 16,
    padding: 16,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  glassTitle: { fontSize: 15, fontWeight: '800', color: colors.text, marginBottom: 12 },
  subhead: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 20, marginBottom: 8 },
  input: {
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 10,
    padding: 12,
    color: colors.text,
    marginBottom: 8,
    fontSize: 16,
  },
  btnPrimary: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  rowTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  rowSub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  smallBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.secondaryBtnBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dangerBtn: {
    backgroundColor: colors.dangerSoftBg,
    borderColor: 'rgba(180, 60, 60, 0.3)',
    borderWidth: 1,
  },
  smallBtnText: { color: colors.text, fontSize: 13 },
  muted: { color: colors.muted, paddingVertical: 20 },
  modalBg: {
    flex: 1,
    backgroundColor: colors.modalOverlay,
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: 12 },
  btnGhost: { marginTop: 8, alignItems: 'center', padding: 12 },
  btnGhostText: { color: colors.muted, fontSize: 16 },
});
