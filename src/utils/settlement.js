import {sumPayments} from './money'

/** Lowercase trimmed, punctuation stripped — for comparing person names. */
export function normalizePersonName(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[.,'"()[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function normPartyKey(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
}

/** True if normalized full name equals key or starts with "key " (key at least 2 chars). */
function partyKeyMatchesName(pk, normalizedName) {
  if (!pk || !normalizedName) return false
  if (normalizedName === pk) return true
  return pk.length >= 2 && normalizedName.startsWith(`${pk} `)
}

/** Same person on studio guest vs field host (or guest–guest / visit–visit for grouping). */
export function twoPartyMatch(nameA, partyKeyA, nameB, partyKeyB) {
  const na = normalizePersonName(nameA)
  const nb = normalizePersonName(nameB)
  const aPk = normPartyKey(partyKeyA)
  const bPk = normPartyKey(partyKeyB)

  if (aPk && bPk) return aPk === bPk
  if (aPk && !bPk) return partyKeyMatchesName(aPk, nb)
  if (!aPk && bPk) return partyKeyMatchesName(bPk, na)
  if (!na || !nb) return false
  if (na === nb) return true
  return na.startsWith(`${nb} `) || nb.startsWith(`${na} `)
}

function sameAtom(a, b) {
  return twoPartyMatch(a.name, a.partyKey, b.name, b.partyKey)
}

class UnionFind {
  constructor(n) {
    this.p = Array.from({length: n}, (_, i) => i)
  }
  find(i) {
    if (this.p[i] !== i) this.p[i] = this.find(this.p[i])
    return this.p[i]
  }
  union(i, j) {
    const ri = this.find(i)
    const rj = this.find(j)
    if (ri !== rj) this.p[rj] = ri
  }
}

export function settlementKeyForGuest(g) {
  const pk = normPartyKey(g.partyKey)
  if (pk) return pk
  return normalizePersonName(g.name)
}

export function settlementKeyForVisit(v) {
  const pk = normPartyKey(v.partyKey)
  if (pk) return pk
  return normalizePersonName(v.hostName)
}

/**
 * For each field visit id: grouped visit money + linked Orders → exposure guest “Pay them”
 * (same `twoPartyMatch` rules as dashboard “Same-person net”).
 * `due` = sum of max(0, amountToCollect − receipts) per visit in the group (settlement-aligned).
 */
export function groupedFieldVisitCardStats(fieldVisits, orders) {
  const list = fieldVisits || []
  const n = list.length
  const idToStats = new Map()
  if (n === 0) return idToStats

  const uf = new UnionFind(n)
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = list[i]
      const b = list[j]
      if (
        twoPartyMatch(
          String(a.hostName || '').trim(),
          String(a.partyKey || '').trim(),
          String(b.hostName || '').trim(),
          String(b.partyKey || '').trim(),
        )
      ) {
        uf.union(i, j)
      }
    }
  }

  const indicesByRoot = new Map()
  for (let i = 0; i < n; i++) {
    const r = uf.find(i)
    if (!indicesByRoot.has(r)) indicesByRoot.set(r, [])
    indicesByRoot.get(r).push(i)
  }

  const statsByRoot = new Map()
  for (const [r, indices] of indicesByRoot) {
    let totalToCollect = 0
    let received = 0
    let visitDue = 0
    for (const i of indices) {
      const v = list[i]
      const t = Number(v.amountToCollect) || 0
      const rec = sumPayments(v.collections)
      totalToCollect += t
      received += rec
      visitDue += Math.max(0, t - rec)
    }
    const visitCount = indices.length

    let payToGuest = 0
    const seenGuest = new Set()
    ;(orders || []).forEach(o => {
      ;(o.exposureGuests || []).forEach(g => {
        const pay = Math.max(0, Number(g.amountToPay) || 0)
        if (pay <= 0) return
        const gid = `${o.id}|${g.id}`
        if (seenGuest.has(gid)) return
        const gn = String(g.name || '').trim()
        const gp = String(g.partyKey || '').trim()
        for (const i of indices) {
          const v = list[i]
          if (
            twoPartyMatch(
              gn,
              gp,
              String(v.hostName || '').trim(),
              String(v.partyKey || '').trim(),
            )
          ) {
            payToGuest += pay
            seenGuest.add(gid)
            return
          }
        }
      })
    })

    const net = visitDue - payToGuest
    statsByRoot.set(r, {
      totalToCollect,
      received,
      due: visitDue,
      visitCount,
      payToGuest,
      net,
    })
  }

  for (let i = 0; i < n; i++) {
    idToStats.set(list[i].id, statsByRoot.get(uf.find(i)))
  }
  return idToStats
}

/** @param {(v: object, due: number) => boolean} [visitEligible] Only visits that pass get a row (due is always > 0). */
function buildAtoms(orders, fieldVisits, visitEligible) {
  const allowVisit =
    typeof visitEligible === 'function' ? visitEligible : () => true
  const atoms = []
  ;(orders || []).forEach(o => {
    ;(o.exposureGuests || []).forEach(g => {
      const pay = Math.max(0, Number(g.amountToPay) || 0)
      if (pay <= 0) return
      atoms.push({
        kind: 'guest',
        payToGuest: pay,
        collectDue: 0,
        name: String(g.name || '').trim(),
        partyKey: String(g.partyKey || '').trim(),
      })
    })
  })
  ;(fieldVisits || []).forEach(v => {
    const total = Number(v.amountToCollect) || 0
    const due = Math.max(0, total - sumPayments(v.collections))
    if (due <= 0) return
    if (!allowVisit(v, due)) return
    atoms.push({
      kind: 'visit',
      payToGuest: 0,
      collectDue: due,
      name: String(v.hostName || '').trim(),
      partyKey: String(v.partyKey || '').trim(),
    })
  })
  return atoms
}

function settlementGroupsFromAtoms(atoms) {
  const n = atoms.length
  if (n === 0) return new Map()

  const uf = new UnionFind(n)
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (sameAtom(atoms[i], atoms[j])) uf.union(i, j)
    }
  }

  const groups = new Map()
  for (let i = 0; i < n; i++) {
    const root = uf.find(i)
    const a = atoms[i]
    let g = groups.get(root)
    if (!g) {
      g = {payToGuest: 0, collectDue: 0, displayNames: new Set()}
      groups.set(root, g)
    }
    g.payToGuest += a.payToGuest
    g.collectDue += a.collectDue
    if (a.name) g.displayNames.add(a.name)
  }
  return groups
}

/**
 * Part of "Pay them" that still hits profit after same-person netting with My Exposing (visit still due).
 * Per settlement group: max(0, payToGuest − collectDue). Matches Same-person net logic so 12k owed does not
 * stack on top of 16k to collect when they are the same linked person.
 */
export function effectiveGuestPayAfterVisitOffset(orders, fieldVisits) {
  const atoms = buildAtoms(orders, fieldVisits, null)
  const groups = settlementGroupsFromAtoms(atoms)
  let sum = 0
  for (const g of groups.values()) {
    sum += Math.max(0, g.payToGuest - g.collectDue)
  }
  return sum
}

/**
 * Raw sum of exposure guest amountToPay (before visit offset).
 */
export function rawGuestPayCommitted(orders) {
  let sum = 0
  for (const o of orders || []) {
    for (const g of o.exposureGuests || []) {
      sum += Math.max(0, Number(g.amountToPay) || 0)
    }
  }
  return sum
}

/**
 * All-time cash received, team payouts, and estimated profit using net guest pay (same as settlement grouping).
 */
export function computeStudioProfit(orders, fieldVisits) {
  let fromOrders = 0
  let fromVisits = 0
  let teamPayouts = 0

  for (const o of orders || []) {
    fromOrders += sumPayments(o.clientPayments)
    for (const ex of o.exposures || []) {
      for (const m of ex.team || []) {
        teamPayouts += sumPayments(m.payouts)
      }
    }
  }

  for (const v of fieldVisits || []) {
    fromVisits += sumPayments(v.collections)
  }

  const totalReceived = fromOrders + fromVisits
  const guestPayRaw = rawGuestPayCommitted(orders)
  const guestPayNet = effectiveGuestPayAfterVisitOffset(orders, fieldVisits)
  const netEstimate = totalReceived - teamPayouts - guestPayNet

  return {
    fromOrders,
    fromVisits,
    totalReceived,
    teamPayouts,
    guestPayCommitted: guestPayNet,
    guestPayRaw,
    netEstimate,
  }
}

/**
 * Sum of max(0, visit due − studio pay to same matched person) per group. Use for dashboard “pending visits” net.
 */
export function netVisitPendingAfterStudioPay(
  orders,
  fieldVisits,
  visitEligible,
) {
  const atoms = buildAtoms(orders, fieldVisits, visitEligible)
  const groups = settlementGroupsFromAtoms(atoms)
  let sum = 0
  for (const g of groups.values()) {
    sum += Math.max(0, g.collectDue - g.payToGuest)
  }
  return sum
}

/**
 * Aggregate “you pay exposure guest” vs “field visit still due” per person (flexible name / match key).
 * Net positive = you collect that much from them after offset; negative = you pay them net.
 */
export function buildSettlementRows(orders, fieldVisits) {
  const atoms = buildAtoms(orders, fieldVisits, null)
  const groups = settlementGroupsFromAtoms(atoms)

  return [...groups.values()]
    .map((row, idx) => {
      const names = [...row.displayNames]
      const label = names.length ? names.sort().join(' · ') : `Group ${idx + 1}`
      const net = row.collectDue - row.payToGuest
      const key = names.sort().join('|') || `g${idx}`
      return {
        key,
        label,
        payToGuest: row.payToGuest,
        collectDue: row.collectDue,
        net,
        hasBothSides: row.payToGuest > 0 && row.collectDue > 0,
      }
    })
    .filter(r => r.payToGuest > 0 || r.collectDue > 0)
    .sort((a, b) => {
      if (a.hasBothSides !== b.hasBothSides) return a.hasBothSides ? -1 : 1
      return Math.abs(b.net) - Math.abs(a.net)
    })
}

/** True when there is money on both “pay guest” and “visit due” sides but nothing was merged (linking hint). */
export function settlementNeedsLinkHint(rows) {
  const totalPay = rows.reduce((s, r) => s + r.payToGuest, 0)
  const totalCollect = rows.reduce((s, r) => s + r.collectDue, 0)
  const anyMerged = rows.some(r => r.hasBothSides)
  return totalPay > 0 && totalCollect > 0 && !anyMerged
}
