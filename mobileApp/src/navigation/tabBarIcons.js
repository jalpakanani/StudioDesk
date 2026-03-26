import { StyleSheet, View } from 'react-native';

const STROKE = 1.5;
const W = 24;
const H = 24;

const wrap = {
  width: W,
  height: H,
  justifyContent: 'center',
  alignItems: 'center',
};

/** Desk — outlined diamond (rotated square). */
export function TabDeskIcon({ color }) {
  return (
    <View style={styles.wrap} accessible={false} accessibilityElementsHidden>
      <View style={[styles.deskDiamond, { borderColor: color }]} />
    </View>
  );
}

/** Clients — two overlapping outline circles. */
export function TabClientsIcon({ color }) {
  return (
    <View style={styles.wrap} accessible={false} accessibilityElementsHidden>
      <View style={[styles.clientsBack, { borderColor: color }]} />
      <View style={[styles.clientsFront, { borderColor: color }]} />
    </View>
  );
}

/** Orders — document with list lines. */
export function TabOrdersIcon({ color }) {
  return (
    <View style={styles.wrap} accessible={false} accessibilityElementsHidden>
      <View style={[styles.ordersSheet, { borderColor: color }]}>
        <View style={[styles.ordersLine, { backgroundColor: color, top: 4 }]} />
        <View style={[styles.ordersLine, { backgroundColor: color, top: 8 }]} />
        <View style={[styles.ordersLineShort, { backgroundColor: color, top: 12 }]} />
      </View>
    </View>
  );
}

/** Exposing / field — circle + crosshair. */
export function TabFieldIcon({ color }) {
  return (
    <View style={styles.wrap} accessible={false} accessibilityElementsHidden>
      <View style={[styles.fieldRing, { borderColor: color }]} />
      <View style={[styles.fieldBarH, { backgroundColor: color }]} />
      <View style={[styles.fieldBarV, { backgroundColor: color }]} />
    </View>
  );
}

/** Settings — flat gear (no emoji). */
export function TabSettingsIcon({ color }) {
  const teeth = [0, 60, 120, 180, 240, 300];
  return (
    <View style={styles.wrap} accessible={false} accessibilityElementsHidden>
      {teeth.map((deg) => (
        <View
          key={deg}
          style={[styles.gearPivot, { transform: [{ rotate: `${deg}deg` }] }]}
        >
          <View style={[styles.gearTooth, { backgroundColor: color }]} />
        </View>
      ))}
      <View style={[styles.gearHub, { borderColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap,
  deskDiamond: {
    width: 11,
    height: 11,
    borderWidth: STROKE,
    borderRadius: 1,
    backgroundColor: 'transparent',
    transform: [{ rotate: '45deg' }],
  },
  clientsBack: {
    position: 'absolute',
    right: 3,
    top: 7,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: STROKE,
    backgroundColor: 'transparent',
  },
  clientsFront: {
    position: 'absolute',
    left: 3,
    top: 7,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: STROKE,
    backgroundColor: 'transparent',
  },
  ordersSheet: {
    width: 14,
    height: 17,
    borderRadius: 2,
    borderWidth: STROKE,
    backgroundColor: 'transparent',
  },
  ordersLine: {
    position: 'absolute',
    left: 2.5,
    width: 7,
    height: 1.5,
    borderRadius: 0.75,
  },
  ordersLineShort: {
    position: 'absolute',
    left: 2.5,
    width: 5,
    height: 1.5,
    borderRadius: 0.75,
  },
  fieldRing: {
    position: 'absolute',
    left: 4.5,
    top: 4.5,
    width: 15,
    height: 15,
    borderRadius: 7.5,
    borderWidth: STROKE,
    backgroundColor: 'transparent',
  },
  fieldBarH: {
    position: 'absolute',
    left: 7.5,
    top: 11.25,
    width: 9,
    height: 1.5,
    borderRadius: 0.75,
  },
  fieldBarV: {
    position: 'absolute',
    left: 11.25,
    top: 7.5,
    width: 1.5,
    height: 9,
    borderRadius: 0.75,
  },
  gearPivot: {
    position: 'absolute',
    left: 12,
    top: 12,
    width: 0,
    height: 0,
    alignItems: 'center',
  },
  gearTooth: {
    position: 'absolute',
    top: -10,
    width: 2,
    height: 5,
    borderRadius: 1,
  },
  gearHub: {
    position: 'absolute',
    left: 8.5,
    top: 8.5,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    borderWidth: STROKE,
    backgroundColor: 'transparent',
  },
});
