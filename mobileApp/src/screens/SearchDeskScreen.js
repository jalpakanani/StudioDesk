import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { applySearchResultNavigation } from '../navigation/applySearchNavigation';
import { useStudio } from '../context/StudioContext';
import { buildDeskSearchResults } from '../utils/deskSearch';
import { colors, radius } from '../theme';

export default function SearchDeskScreen() {
  const navigation = useNavigation();
  const { clients, orders, fieldVisits, clientById } = useStudio();
  const [q, setQ] = useState('');

  const results = useMemo(
    () =>
      buildDeskSearchResults(q, {
        clients,
        orders,
        fieldVisits: fieldVisits ?? [],
        clientById,
      }),
    [q, clients, orders, fieldVisits, clientById],
  );

  const grouped = useMemo(() => {
    const g = { client: [], order: [], visit: [] };
    for (const r of results) {
      g[r.kind].push(r);
    }
    return g;
  }, [results]);

  function onSelect(item) {
    applySearchResultNavigation(navigation, item);
  }

  const hasQ = Boolean(q.trim());

  return (
    <View style={styles.safe}>
      <Text style={styles.lead}>Clients, orders, and My Exposing — tap a row to jump there.</Text>
      <TextInput
        style={styles.input}
        placeholder="Name, job, venue, phone…"
        placeholderTextColor={colors.muted}
        value={q}
        onChangeText={setQ}
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="while-editing"
        returnKeyType="search"
      />
      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollPad}>
        {!hasQ ? (
          <Text style={styles.hint}>Type to search clients, orders, and My Exposing.</Text>
        ) : results.length === 0 ? (
          <Text style={styles.hint}>No matches.</Text>
        ) : (
          <>
            {grouped.client.length > 0 ? (
              <View style={styles.block}>
                <Text style={styles.blockTitle}>Clients</Text>
                {grouped.client.map((r) => (
                  <TouchableOpacity key={`c-${r.id}`} style={styles.row} onPress={() => onSelect(r)}>
                    <Text style={styles.rowTitle}>{r.title}</Text>
                    <Text style={styles.rowSub}>{r.subtitle}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
            {grouped.order.length > 0 ? (
              <View style={styles.block}>
                <Text style={styles.blockTitle}>Orders</Text>
                {grouped.order.map((r) => (
                  <TouchableOpacity key={`o-${r.id}`} style={styles.row} onPress={() => onSelect(r)}>
                    <Text style={styles.rowTitle}>{r.title}</Text>
                    <Text style={styles.rowSub}>{r.subtitle}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
            {grouped.visit.length > 0 ? (
              <View style={styles.block}>
                <Text style={styles.blockTitle}>My Exposing</Text>
                {grouped.visit.map((r) => (
                  <TouchableOpacity key={`v-${r.id}`} style={styles.row} onPress={() => onSelect(r)}>
                    <Text style={styles.rowTitle}>{r.title}</Text>
                    <Text style={styles.rowSub}>{r.subtitle}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  lead: {
    fontSize: 14,
    color: colors.muted,
    lineHeight: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  input: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSolid,
    fontSize: 16,
    color: colors.text,
  },
  scroll: { flex: 1 },
  scrollPad: { paddingHorizontal: 16, paddingBottom: 32 },
  hint: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  block: { marginBottom: 20 },
  blockTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.muted,
    letterSpacing: 0.6,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  row: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  rowTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  rowSub: { fontSize: 13, color: colors.muted, marginTop: 4, lineHeight: 18 },
});
