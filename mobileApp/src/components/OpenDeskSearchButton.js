import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { navigateToDeskSearch } from '../navigation/navigateDeskSearch';
import { colors, radius } from '../theme';

/**
 * Search glyph drawn with Views only (no react-native-svg).
 * Some RN New Architecture + RNSVG builds show a broken pink "Un" placeholder instead of vector shapes.
 */
function SearchGlyph() {
  return (
    <View style={glyph.wrap} accessibilityElementsHidden>
      <View style={glyph.lens} />
      <View style={glyph.handleAnchor}>
        <View style={glyph.handle} />
      </View>
    </View>
  );
}

const glyph = StyleSheet.create({
  wrap: {
    width: 24,
    height: 24,
  },
  lens: {
    position: 'absolute',
    left: 4,
    top: 4,
    width: 13,
    height: 13,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: 'transparent',
  },
  /** Pivot at lens SE; short bar rotated 45° reads as magnifier handle */
  handleAnchor: {
    position: 'absolute',
    left: 10,
    top: 6,
    width: 14,
    height: 14,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  handle: {
    width: 9,
    height: 2.5,
    borderRadius: 1.25,
    backgroundColor: colors.primary,
    marginRight: 1,
    marginBottom: 1,
    transform: [{ rotate: '45deg' }],
  },
});

export default function OpenDeskSearchButton({ variant = 'default' }) {
  const navigation = useNavigation();
  const isToolbar = variant === 'toolbar';

  return (
    <TouchableOpacity
      style={[styles.btn, isToolbar && styles.btnToolbar]}
      onPress={() => navigateToDeskSearch(navigation)}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityLabel="Search desk"
      accessibilityRole="button"
    >
      <SearchGlyph />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSolid,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Matches compact header pills (e.g. Sign out) — same height & radius */
  btnToolbar: {
    minWidth: 40,
    width: 40,
    minHeight: 40,
    height: 40,
    paddingHorizontal: 0,
    borderRadius: radius.sm,
  },
});
