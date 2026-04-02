import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { uid } from '../utils/money';
import { coerceDateFieldToISO } from '../utils/dateRange';
import { getDb, USER_DATA_COLLECTION } from '../firebase/init';

const STORAGE_KEY = 'my-studio-desk-v1';

const emptyState = () => ({ clients: [], orders: [], fieldVisits: [] });

function normalizeFieldVisits(visits) {
  if (!Array.isArray(visits)) return [];
  return visits.map((v) => {
    const from = coerceDateFieldToISO(v.dateFrom || v.date || '');
    let to = coerceDateFieldToISO(v.dateTo || '');
    if (!to) to = from;
    if (from && to < from) to = from;
    const { date: _legacy, ...rest } = v;
    return { ...rest, dateFrom: from, dateTo: to };
  });
}

function parseStateFromRaw(raw) {
  if (!raw) return emptyState();
  try {
    const parsed = JSON.parse(raw);
    return {
      clients: Array.isArray(parsed.clients) ? parsed.clients : [],
      orders: Array.isArray(parsed.orders) ? parsed.orders : [],
      fieldVisits: normalizeFieldVisits(parsed.fieldVisits),
    };
  } catch {
    return emptyState();
  }
}

async function loadStateFromAsync() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return parseStateFromRaw(raw);
  } catch {
    return emptyState();
  }
}

function hasLocalData(s) {
  return (
    (s.clients?.length || 0) + (s.orders?.length || 0) + (s.fieldVisits?.length || 0) > 0
  );
}

/**
 * @param {{ useCloud?: boolean, syncUserId?: string | null }} opts
 * useCloud + syncUserId: Firestore doc per user. Otherwise AsyncStorage only.
 */
export function useStudioStore({ useCloud = false, syncUserId = null } = {}) {
  const [state, setState] = useState(emptyState);
  const [hydrated, setHydrated] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const skipNextPersist = useRef(false);
  const actionBusyNestRef = useRef(0);
  const actionBusyMountedRef = useRef(true);

  const MIN_ACTION_BUSY_MS = 280;
  const wrapMutation = useCallback((fn) => {
    return (...args) => {
      actionBusyNestRef.current += 1;
      if (actionBusyNestRef.current === 1) {
        setActionBusy(true);
      }
      const t0 =
        typeof performance !== 'undefined' && performance.now
          ? performance.now()
          : Date.now();
      try {
        return fn(...args);
      } finally {
        const now =
          typeof performance !== 'undefined' && performance.now
            ? performance.now()
            : Date.now();
        const delay = Math.max(0, MIN_ACTION_BUSY_MS - (now - t0));
        setTimeout(() => {
          actionBusyNestRef.current -= 1;
          if (actionBusyNestRef.current <= 0) {
            actionBusyNestRef.current = 0;
            if (actionBusyMountedRef.current) {
              setActionBusy(false);
            }
          }
        }, delay);
      }
    };
  }, []);

  useEffect(() => {
    actionBusyMountedRef.current = true;
    return () => {
      actionBusyMountedRef.current = false;
      actionBusyNestRef.current = 0;
    };
  }, []);

  useEffect(() => {
    setSyncError(null);
  }, [syncUserId, useCloud]);

  useEffect(() => {
    if (useCloud) return undefined;
    let cancelled = false;
    void (async () => {
      const s = await loadStateFromAsync();
      if (!cancelled) {
        setState(s);
        setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [useCloud]);

  useEffect(() => {
    if (useCloud || !hydrated) return undefined;
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, useCloud, hydrated]);

  useEffect(() => {
    if (!useCloud || !syncUserId) return undefined;
    const db = getDb();
    if (!db) {
      setHydrated(true);
      return undefined;
    }
    setHydrated(false);
    const docRef = doc(db, USER_DATA_COLLECTION, syncUserId);
    const unsub = onSnapshot(
      docRef,
      (snap) => {
        setSyncError(null);
        if (!snap.exists()) {
          void (async () => {
            const local = await loadStateFromAsync();
            if (hasLocalData(local)) {
              const next = {
                clients: local.clients || [],
                orders: local.orders || [],
                fieldVisits: normalizeFieldVisits(local.fieldVisits || []),
              };
              skipNextPersist.current = true;
              setState(next);
              setDoc(docRef, {
                clients: next.clients,
                orders: next.orders,
                fieldVisits: next.fieldVisits,
                updatedAt: serverTimestamp(),
              }).catch((e) => {
                console.error('[Firestore]', e);
                setSyncError(e?.message || 'Could not save to cloud. Check Firestore rules.');
              });
            } else {
              setState(emptyState());
            }
            setHydrated(true);
          })();
          return;
        }
        const d = snap.data();
        skipNextPersist.current = true;
        setState({
          clients: Array.isArray(d.clients) ? d.clients : [],
          orders: Array.isArray(d.orders) ? d.orders : [],
          fieldVisits: normalizeFieldVisits(d.fieldVisits),
        });
        setHydrated(true);
      },
      (err) => {
        console.error('[Firestore]', err);
        setSyncError(err?.message || 'Cloud sync failed. Check rules and internet.');
        setHydrated(true);
      }
    );
    return () => unsub();
  }, [useCloud, syncUserId]);

  useEffect(() => {
    if (!useCloud || !syncUserId || !hydrated) return undefined;
    if (skipNextPersist.current) {
      skipNextPersist.current = false;
      return undefined;
    }
    const db = getDb();
    if (!db) return undefined;
    const docRef = doc(db, USER_DATA_COLLECTION, syncUserId);
    const t = setTimeout(() => {
      setDoc(
        docRef,
        {
          clients: state.clients,
          orders: state.orders,
          fieldVisits: state.fieldVisits,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      ).catch((e) => {
        console.error('[Firestore]', e);
        setSyncError(e?.message || 'Could not save to cloud.');
      });
    }, 650);
    return () => clearTimeout(t);
  }, [state, useCloud, syncUserId, hydrated]);

  /* eslint-disable react-hooks/exhaustive-deps -- mutators use stable wrapMutation(); inner fns only call setState */
  const addClient = useCallback(wrapMutation((payload) => {
    const row = {
      id: uid(),
      name: String(payload.name || '').trim(),
      phone: String(payload.phone || '').trim(),
      notes: String(payload.notes || '').trim(),
    };
    if (!row.name) return null;
    setState((s) => ({ ...s, clients: [...s.clients, row] }));
    return row;
  }), [wrapMutation]);

  const updateClient = useCallback(wrapMutation((id, payload) => {
    setState((s) => ({
      ...s,
      clients: s.clients.map((c) =>
        c.id === id
          ? {
              ...c,
              name: String(payload.name ?? c.name).trim(),
              phone: String(payload.phone ?? c.phone).trim(),
              notes: String(payload.notes ?? c.notes).trim(),
            }
          : c
      ),
    }));
  }), [wrapMutation]);

  const removeClient = useCallback(wrapMutation((id) => {
    setState((s) => ({
      ...s,
      clients: s.clients.filter((c) => c.id !== id),
      orders: s.orders.filter((o) => o.clientId !== id),
    }));
  }), [wrapMutation]);

  const addOrder = useCallback(wrapMutation((payload) => {
    const evFrom = String(payload.eventDateFrom || '').slice(0, 10);
    let evTo = String(payload.eventDateTo || '').slice(0, 10);
    if (evFrom && !evTo) evTo = evFrom;
    if (evFrom && evTo && evTo < evFrom) evTo = evFrom;
    const row = {
      id: uid(),
      clientId: payload.clientId,
      title: String(payload.title || '').trim(),
      orderDate: payload.orderDate || new Date().toISOString().slice(0, 10),
      eventDateFrom: evFrom,
      eventDateTo: evTo,
      totalAmount: Number(payload.totalAmount) || 0,
      notes: String(payload.notes || '').trim(),
      address: String(payload.address || '').trim(),
      clientPayments: [],
      exposures: [],
      exposureGuests: [],
    };
    if (!row.clientId || !row.title) return null;
    setState((s) => ({ ...s, orders: [...s.orders, row] }));
    return row;
  }), [wrapMutation]);

  const updateOrder = useCallback(wrapMutation((id, patch) => {
    setState((s) => ({
      ...s,
      orders: s.orders.map((o) => (o.id === id ? { ...o, ...patch, id: o.id } : o)),
    }));
  }), [wrapMutation]);

  const removeOrder = useCallback(wrapMutation((id) => {
    setState((s) => ({ ...s, orders: s.orders.filter((o) => o.id !== id) }));
  }), [wrapMutation]);

  const addClientPayment = useCallback(wrapMutation((orderId, p) => {
    const pay = {
      id: uid(),
      amount: Number(p.amount) || 0,
      date: p.date || new Date().toISOString().slice(0, 10),
      note: String(p.note || '').trim(),
    };
    setState((s) => ({
      ...s,
      orders: s.orders.map((o) =>
        o.id === orderId ? { ...o, clientPayments: [...(o.clientPayments || []), pay] } : o
      ),
    }));
  }), [wrapMutation]);

  const removeClientPayment = useCallback(wrapMutation((orderId, paymentId) => {
    setState((s) => ({
      ...s,
      orders: s.orders.map((o) =>
        o.id === orderId
          ? { ...o, clientPayments: (o.clientPayments || []).filter((x) => x.id !== paymentId) }
          : o
      ),
    }));
  }), [wrapMutation]);

  const addExposure = useCallback(wrapMutation((orderId, payload) => {
    const ex = {
      id: uid(),
      date: payload.date || new Date().toISOString().slice(0, 10),
      time: String(payload.time || '').trim(),
      place: String(payload.place || '').trim(),
      note: String(payload.note || '').trim(),
      team: [],
    };
    setState((s) => ({
      ...s,
      orders: s.orders.map((o) =>
        o.id === orderId ? { ...o, exposures: [...(o.exposures || []), ex] } : o
      ),
    }));
  }), [wrapMutation]);

  const updateExposure = useCallback(wrapMutation((orderId, exposureId, patch) => {
    setState((s) => ({
      ...s,
      orders: s.orders.map((o) => {
        if (o.id !== orderId) return o;
        return {
          ...o,
          exposures: (o.exposures || []).map((e) =>
            e.id === exposureId ? { ...e, ...patch, id: e.id } : e
          ),
        };
      }),
    }));
  }), [wrapMutation]);

  const removeExposure = useCallback(wrapMutation((orderId, exposureId) => {
    setState((s) => ({
      ...s,
      orders: s.orders.map((o) =>
        o.id === orderId
          ? { ...o, exposures: (o.exposures || []).filter((e) => e.id !== exposureId) }
          : o
      ),
    }));
  }), [wrapMutation]);

  const addTeamMember = useCallback(wrapMutation((orderId, exposureId, payload) => {
    const member = {
      id: uid(),
      name: String(payload.name || '').trim(),
      phone: String(payload.phone || '').trim(),
      amountTotal: Number(payload.amountTotal) || 0,
      payouts: [],
    };
    if (!member.name) return;
    setState((s) => ({
      ...s,
      orders: s.orders.map((o) => {
        if (o.id !== orderId) return o;
        return {
          ...o,
          exposures: (o.exposures || []).map((e) =>
            e.id === exposureId ? { ...e, team: [...(e.team || []), member] } : e
          ),
        };
      }),
    }));
  }), [wrapMutation]);

  const updateTeamMember = useCallback(wrapMutation((orderId, exposureId, memberId, patch) => {
    setState((s) => ({
      ...s,
      orders: s.orders.map((o) => {
        if (o.id !== orderId) return o;
        return {
          ...o,
          exposures: (o.exposures || []).map((e) => {
            if (e.id !== exposureId) return e;
            return {
              ...e,
              team: (e.team || []).map((m) =>
                m.id === memberId ? { ...m, ...patch, id: m.id } : m
              ),
            };
          }),
        };
      }),
    }));
  }), [wrapMutation]);

  const removeTeamMember = useCallback(wrapMutation((orderId, exposureId, memberId) => {
    setState((s) => ({
      ...s,
      orders: s.orders.map((o) => {
        if (o.id !== orderId) return o;
        return {
          ...o,
          exposures: (o.exposures || []).map((e) =>
            e.id === exposureId
              ? { ...e, team: (e.team || []).filter((m) => m.id !== memberId) }
              : e
          ),
        };
      }),
    }));
  }), [wrapMutation]);

  const addTeamPayout = useCallback(wrapMutation((orderId, exposureId, memberId, p) => {
    const pay = {
      id: uid(),
      amount: Number(p.amount) || 0,
      date: p.date || new Date().toISOString().slice(0, 10),
      note: String(p.note || '').trim(),
    };
    setState((s) => ({
      ...s,
      orders: s.orders.map((o) => {
        if (o.id !== orderId) return o;
        return {
          ...o,
          exposures: (o.exposures || []).map((e) => {
            if (e.id !== exposureId) return e;
            return {
              ...e,
              team: (e.team || []).map((m) =>
                m.id === memberId ? { ...m, payouts: [...(m.payouts || []), pay] } : m
              ),
            };
          }),
        };
      }),
    }));
  }), [wrapMutation]);

  const removeTeamPayout = useCallback(wrapMutation((orderId, exposureId, memberId, payoutId) => {
    setState((s) => ({
      ...s,
      orders: s.orders.map((o) => {
        if (o.id !== orderId) return o;
        return {
          ...o,
          exposures: (o.exposures || []).map((e) => {
            if (e.id !== exposureId) return e;
            return {
              ...e,
              team: (e.team || []).map((m) =>
                m.id === memberId
                  ? { ...m, payouts: (m.payouts || []).filter((x) => x.id !== payoutId) }
                  : m
              ),
            };
          }),
        };
      }),
    }));
  }), [wrapMutation]);

  const addFieldVisit = useCallback(wrapMutation((payload) => {
    const dateFrom =
      String(payload.dateFrom || payload.date || '').slice(0, 10) ||
      new Date().toISOString().slice(0, 10);
    let dateTo = String(payload.dateTo || '').slice(0, 10);
    if (!dateTo) dateTo = dateFrom;
    if (dateTo < dateFrom) dateTo = dateFrom;
    const row = {
      id: uid(),
      hostName: String(payload.hostName || '').trim(),
      venue: String(payload.venue || '').trim(),
      dateFrom,
      dateTo,
      time: String(payload.time || '').trim(),
      amountToCollect: Number(payload.amountToCollect) || 0,
      partyKey: String(payload.partyKey || '').trim(),
      notes: String(payload.notes || '').trim(),
      collections: [],
    };
    if (!row.hostName) return null;
    setState((s) => ({ ...s, fieldVisits: [...(s.fieldVisits || []), row] }));
    return row;
  }), [wrapMutation]);

  const updateFieldVisit = useCallback(wrapMutation((id, patch) => {
    setState((s) => ({
      ...s,
      fieldVisits: (s.fieldVisits || []).map((v) => {
        if (v.id !== id) return v;
        let dateFrom = String(patch.dateFrom ?? v.dateFrom ?? v.date ?? '').slice(0, 10);
        let dateTo = String(patch.dateTo ?? v.dateTo ?? '').slice(0, 10);
        if (patch.date != null && patch.dateFrom == null && patch.dateTo == null) {
          dateFrom = String(patch.date).slice(0, 10);
          dateTo = dateFrom;
        }
        if (!dateFrom) dateFrom = v.dateFrom || new Date().toISOString().slice(0, 10);
        if (!dateTo) dateTo = dateFrom;
        if (dateTo < dateFrom) dateTo = dateFrom;
        return {
          ...v,
          hostName: String(patch.hostName ?? v.hostName).trim(),
          venue: String(patch.venue ?? v.venue).trim(),
          dateFrom,
          dateTo,
          time: String(patch.time ?? v.time).trim(),
          amountToCollect: Number(patch.amountToCollect ?? v.amountToCollect) || 0,
          partyKey: String(patch.partyKey ?? v.partyKey ?? '').trim(),
          notes: String(patch.notes ?? v.notes).trim(),
        };
      }),
    }));
  }), [wrapMutation]);

  const removeFieldVisit = useCallback(wrapMutation((id) => {
    setState((s) => ({ ...s, fieldVisits: (s.fieldVisits || []).filter((v) => v.id !== id) }));
  }), [wrapMutation]);

  const addFieldVisitCollection = useCallback(wrapMutation((visitId, p) => {
    const pay = {
      id: uid(),
      amount: Number(p.amount) || 0,
      date: p.date || new Date().toISOString().slice(0, 10),
      note: String(p.note || '').trim(),
    };
    setState((s) => ({
      ...s,
      fieldVisits: (s.fieldVisits || []).map((v) =>
        v.id === visitId ? { ...v, collections: [...(v.collections || []), pay] } : v
      ),
    }));
  }), [wrapMutation]);

  const removeFieldVisitCollection = useCallback(wrapMutation((visitId, collectionId) => {
    setState((s) => ({
      ...s,
      fieldVisits: (s.fieldVisits || []).map((v) =>
        v.id === visitId
          ? { ...v, collections: (v.collections || []).filter((x) => x.id !== collectionId) }
          : v
      ),
    }));
  }), [wrapMutation]);

  const addExposureGuest = useCallback(wrapMutation((orderId, payload) => {
    const guest = {
      id: uid(),
      name: String(payload.name || '').trim(),
      phone: String(payload.phone || '').trim(),
      amountToPay: Math.max(0, Number(payload.amountToPay) || 0),
      partyKey: String(payload.partyKey || '').trim(),
      notes: String(payload.notes || '').trim(),
    };
    if (!guest.name) return null;
    setState((s) => ({
      ...s,
      orders: s.orders.map((o) =>
        o.id === orderId ? { ...o, exposureGuests: [...(o.exposureGuests || []), guest] } : o
      ),
    }));
    return guest;
  }), [wrapMutation]);

  const updateExposureGuest = useCallback(wrapMutation((orderId, guestId, patch) => {
    setState((s) => ({
      ...s,
      orders: s.orders.map((o) => {
        if (o.id !== orderId) return o;
        return {
          ...o,
          exposureGuests: (o.exposureGuests || []).map((g) =>
            g.id === guestId
              ? {
                  ...g,
                  name: String(patch.name ?? g.name).trim(),
                  phone: String(patch.phone ?? g.phone).trim(),
                  amountToPay: Math.max(0, Number(patch.amountToPay ?? g.amountToPay) || 0),
                  partyKey: String(patch.partyKey ?? g.partyKey ?? '').trim(),
                  notes: String(patch.notes ?? g.notes).trim(),
                }
              : g
          ),
        };
      }),
    }));
  }), [wrapMutation]);

  const removeExposureGuest = useCallback(wrapMutation((orderId, guestId) => {
    setState((s) => ({
      ...s,
      orders: s.orders.map((o) =>
        o.id === orderId
          ? { ...o, exposureGuests: (o.exposureGuests || []).filter((g) => g.id !== guestId) }
          : o
      ),
    }));
  }), [wrapMutation]);

  const clientById = useMemo(() => {
    const m = new Map();
    state.clients.forEach((c) => m.set(c.id, c));
    return m;
  }, [state.clients]);

  const exportJson = useCallback(() => {
    return JSON.stringify(state, null, 2);
  }, [state]);

  const importJson = useCallback(wrapMutation((text) => {
    const parsed = JSON.parse(text);
    setState({
      clients: Array.isArray(parsed.clients) ? parsed.clients : [],
      orders: Array.isArray(parsed.orders) ? parsed.orders : [],
      fieldVisits: normalizeFieldVisits(parsed.fieldVisits),
    });
  }), [wrapMutation]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const cloudSync = useCloud && Boolean(syncUserId);

  return {
    ...state,
    clientById,
    studioReady: hydrated,
    actionBusy,
    cloudSync,
    syncError,
    addClient,
    updateClient,
    removeClient,
    addOrder,
    updateOrder,
    removeOrder,
    addClientPayment,
    removeClientPayment,
    addExposure,
    updateExposure,
    removeExposure,
    addTeamMember,
    updateTeamMember,
    removeTeamMember,
    addTeamPayout,
    removeTeamPayout,
    addFieldVisit,
    updateFieldVisit,
    removeFieldVisit,
    addFieldVisitCollection,
    removeFieldVisitCollection,
    addExposureGuest,
    updateExposureGuest,
    removeExposureGuest,
    exportJson,
    importJson,
  };
}
