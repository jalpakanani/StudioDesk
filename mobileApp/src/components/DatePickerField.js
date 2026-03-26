import { useMemo, useState } from 'react';
import {
  Dimensions,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  formatISODateDisplay,
  isoToLocalNoonDate,
  localNoonDateToISO,
  toISODateOr,
} from '../utils/dateRange';
import { localCalendarTodayISO } from '../utils/reminders';
import { colors, radius } from '../theme';

/** iOS wheel height; inline calendar gets 0 height inside RN Modal on many builds — spinner is reliable. */
const IOS_PICKER_WHEEL_HEIGHT = 216;

/**
 * Tap-to-open date field (DD/MM/YYYY). Android: system date dialog. iOS: dark bottom sheet + native wheels.
 */
export default function DatePickerField({
  value,
  onChangeValue,
  placeholder = 'DD/MM/YYYY',
  fallbackISO: fallbackProp,
  style,
  placeholderTextColor = colors.muted,
  /** When set, show “Clear date” if there is a value (optional end dates). */
  allowEmpty,
}) {
  const insets = useSafeAreaInsets();
  const fallbackISO = fallbackProp ?? localCalendarTodayISO();
  const baseISO = useMemo(
    () => toISODateOr(value, fallbackISO),
    [value, fallbackISO],
  );

  const [androidOpen, setAndroidOpen] = useState(false);
  const [iosOpen, setIosOpen] = useState(false);
  const [iosDraft, setIosDraft] = useState(() => isoToLocalNoonDate(baseISO));

  const displayText = String(value ?? '').trim();

  function openPicker() {
    const d = isoToLocalNoonDate(baseISO);
    if (Platform.OS === 'android') {
      setAndroidOpen(true);
    } else {
      setIosDraft(d);
      setIosOpen(true);
    }
  }

  function applyDate(selectedDate) {
    if (!selectedDate) return;
    onChangeValue(formatISODateDisplay(localNoonDateToISO(selectedDate)));
  }

  const androidOnChange = (event, selectedDate) => {
    setAndroidOpen(false);
    if (event?.type === 'dismissed') return;
    if (selectedDate) applyDate(selectedDate);
  };

  const androidValue = isoToLocalNoonDate(baseISO);

  return (
    <>
      <TouchableOpacity
        style={[styles.field, style]}
        onPress={openPicker}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={displayText || placeholder}
      >
        <Text
          style={[
            styles.fieldText,
            !displayText && { color: placeholderTextColor },
          ]}
          numberOfLines={1}
        >
          {displayText || placeholder}
        </Text>
        <Text style={styles.icon}>📅</Text>
      </TouchableOpacity>
      {allowEmpty && displayText ? (
        <TouchableOpacity
          onPress={() => onChangeValue('')}
          style={styles.clearTap}
          hitSlop={8}
        >
          <Text style={styles.clearText}>Clear date</Text>
        </TouchableOpacity>
      ) : null}

      {Platform.OS === 'android' && androidOpen ? (
        <DateTimePicker
          value={androidValue}
          mode="date"
          display="default"
          onChange={androidOnChange}
        />
      ) : null}

      {Platform.OS === 'ios' ? (
        <Modal
          visible={iosOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIosOpen(false)}
        >
          <View style={styles.iosRoot}>
            <Pressable
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: colors.modalOverlay },
              ]}
              onPress={() => setIosOpen(false)}
            />
            <View
              style={[
                styles.iosSheet,
                { paddingBottom: Math.max(insets.bottom, 10) },
              ]}
            >
              <View style={styles.iosBar}>
                <TouchableOpacity
                  onPress={() => setIosOpen(false)}
                  hitSlop={12}
                >
                  <Text style={styles.iosBarBtn}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.iosBarTitle}>Select date</Text>
                <TouchableOpacity
                  onPress={() => {
                    applyDate(iosDraft);
                    setIosOpen(false);
                  }}
                  hitSlop={12}
                >
                  <Text style={[styles.iosBarBtn, styles.iosBarDone]}>
                    Done
                  </Text>
                </TouchableOpacity>
              </View>
              <View
                style={[
                  styles.iosPickerWrap,
                  {
                    width: Dimensions.get('window').width,
                    height: IOS_PICKER_WHEEL_HEIGHT,
                  },
                ]}
              >
                <DateTimePicker
                  value={iosDraft}
                  mode="date"
                  display="spinner"
                  themeVariant="light"
                  style={{
                    width: Dimensions.get('window').width,
                    height: IOS_PICKER_WHEEL_HEIGHT,
                  }}
                  onChange={(_, d) => {
                    if (d) setIosDraft(d);
                  }}
                />
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fieldText: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  icon: { fontSize: 18, opacity: 0.75 },
  iosRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  iosSheet: {
    backgroundColor: '#e8e8ed',
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
    overflow: 'hidden',
  },
  iosPickerWrap: {
    backgroundColor: '#e8e8ed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iosBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  iosBarTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
    color: 'black',
  },
  iosBarBtn: { fontSize: 17, color: '#a99cf7', minWidth: 64 },
  iosBarDone: { fontWeight: '700', textAlign: 'right' },
  clearTap: { alignSelf: 'flex-start', marginTop: 6 },
  clearText: { fontSize: 14, color: colors.primary, fontWeight: '600' },
});
