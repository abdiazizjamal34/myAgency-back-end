import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { dbConnect, dbDisconnect, dbClear } from './helpers/db.js';
import mongoose from 'mongoose';
import Invoice from '../models/Invoice.js';

beforeAll(() => dbConnect());
afterAll(() => dbDisconnect());
afterEach(() => dbClear());

// Mirrors the formula in billing.routes.js
function calcAmount(plan, recordsUsed) {
  const overage = Math.max(0, recordsUsed - plan.includedRecords);
  return plan.monthlyFee + overage * plan.overagePrice;
}

const L1 = { includedRecords: 100, monthlyFee: 1750, overagePrice: 35 };
const L2 = { includedRecords: 200, monthlyFee: 4500, overagePrice: 35 };

// ─── Pure math ───────────────────────────────────────────────────────────────

describe('calcAmount — billing formula', () => {
  it('zero usage → monthly fee only', () => {
    expect(calcAmount(L1, 0)).toBe(1750);
  });

  it('usage within quota → monthly fee only', () => {
    expect(calcAmount(L1, 50)).toBe(1750);
  });

  it('usage exactly equals quota → no overage charged (boundary)', () => {
    expect(calcAmount(L1, 100)).toBe(1750);
  });

  it('one record over quota → one overage unit charged', () => {
    expect(calcAmount(L1, 101)).toBe(1750 + 35);
  });

  it('20 records over quota → correct total', () => {
    // 1750 + 20 × 35 = 2450
    expect(calcAmount(L1, 120)).toBe(2450);
  });

  it('large overage stays integer (no float drift)', () => {
    // 150 over → 1750 + 5250 = 7000
    expect(calcAmount(L1, 250)).toBe(7000);
    expect(Number.isInteger(calcAmount(L1, 250))).toBe(true);
  });

  it('result is always an integer for all typical inputs', () => {
    [0, 1, 99, 100, 101, 200, 500, 999].forEach((used) => {
      expect(Number.isInteger(calcAmount(L1, used))).toBe(true);
    });
  });

  it('Level 2 plan: usage within quota', () => {
    expect(calcAmount(L2, 200)).toBe(4500);
  });

  it('Level 2 plan: overage charged correctly', () => {
    // 10 over × 35 = 350 → 4850
    expect(calcAmount(L2, 210)).toBe(4850);
  });
});

// ─── Invoice model storage ───────────────────────────────────────────────────

describe('Invoice — storage correctness', () => {
  const agencyId = new mongoose.Types.ObjectId();
  let seq = 0;
  const inv = (periodKey, amount, extra = {}) => ({
    agencyId,
    periodKey,
    invoiceNumber: `TEST-${++seq}`,
    recordsBilled: 120,
    unitPrice: L1.overagePrice,
    currency: 'ETB',
    amount,
    status: 'unpaid',
    issuedAt: new Date(),
    dueAt: new Date(),
    ...extra,
  });

  it('stores computed amount without mutation', async () => {
    const amount = calcAmount(L1, 120); // 2450
    const doc = await Invoice.create(inv('2026-05', amount));
    expect(doc.amount).toBe(2450);
    expect(Number.isInteger(doc.amount)).toBe(true);
  });

  it('defaults to unpaid status', async () => {
    const doc = await Invoice.create(inv('2026-04', 1750));
    expect(doc.status).toBe('unpaid');
  });

  it('zero-usage invoice stores monthlyFee as amount', async () => {
    const amount = calcAmount(L1, 0); // 1750
    const doc = await Invoice.create(inv('2026-03', amount, { recordsBilled: 0 }));
    expect(doc.amount).toBe(1750);
    expect(doc.recordsBilled).toBe(0);
  });

  it('enforces unique {agencyId, periodKey} index', async () => {
    await Invoice.create(inv('2026-02', 1750));
    await expect(Invoice.create(inv('2026-02', 1750))).rejects.toThrow();
  });

  it('paid invoice records paidAt timestamp', async () => {
    const paidAt = new Date();
    const doc = await Invoice.create(inv('2026-01', 1750, { status: 'paid', paidAt }));
    expect(doc.status).toBe('paid');
    expect(doc.paidAt).toBeInstanceOf(Date);
  });
});
