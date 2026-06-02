import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';
import { dbConnect, dbDisconnect, dbClear } from './helpers/db.js';
import mongoose from 'mongoose';

vi.mock('../utils/billingPeriod.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, isReadOnlyWindow: vi.fn(() => false) };
});

import { isReadOnlyWindow } from '../utils/billingPeriod.js';
import Agency from '../models/Agency.js';
import Invoice from '../models/Invoice.js';
import { ROLES } from '../utils/constants.js';
import { billingGuard } from '../middleware/billingGuard.js';

let invoiceSeq = 0;
function makeInvoice(agencyId, overrides = {}) {
  invoiceSeq += 1;
  return {
    agencyId,
    periodKey: '2026-05',
    invoiceNumber: `INV-TEST-${invoiceSeq}`,
    recordsBilled: 10,
    unitPrice: 35,
    currency: 'ETB',
    amount: 1750,
    status: 'unpaid',
    issuedAt: new Date(),
    dueAt: new Date(),
    ...overrides,
  };
}

function makeReq({ method = 'GET', path = '/status', baseUrl = '/api/billing', agency = null, role = ROLES.AGENCY_ADMIN } = {}) {
  return { method, path, baseUrl, user: { _id: new mongoose.Types.ObjectId(), role, agency } };
}

function makeRes() {
  const res = { json: vi.fn() };
  res.status = vi.fn().mockReturnValue(res);
  return res;
}

beforeAll(() => dbConnect());
afterAll(() => dbDisconnect());
afterEach(async () => { await dbClear(); vi.clearAllMocks(); });

describe('billingGuard', () => {
  let agency;

  beforeEach(async () => {
    agency = await Agency.create({ name: 'Test', code: `AG${Date.now()}` });
    isReadOnlyWindow.mockReturnValue(false);
  });

  it('SUPER_ADMIN bypasses all billing checks without any DB query', async () => {
    const req = makeReq({ method: 'POST', role: ROLES.SUPER_ADMIN });
    const res = makeRes();
    const next = vi.fn();

    await billingGuard()(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
    expect(req.billing).toEqual({ status: 'ok' });
  });

  it('passes when no unpaid invoice exists', async () => {
    const req = makeReq({ method: 'POST', agency: agency._id });
    const res = makeRes();
    const next = vi.fn();

    await billingGuard()(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('sets unpaid_warning on req.billing but allows writes before day 17', async () => {
    await Invoice.create(makeInvoice(agency._id));
    isReadOnlyWindow.mockReturnValue(false);

    const req = makeReq({ method: 'POST', path: '/tickets', baseUrl: '/api', agency: agency._id });
    const res = makeRes();
    const next = vi.fn();

    await billingGuard()(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.billing.status).toBe('unpaid_warning');
    expect(res.status).not.toHaveBeenCalled();
  });

  it('blocks writes on day 17+ when unpaid invoice exists', async () => {
    await Invoice.create(makeInvoice(agency._id));
    isReadOnlyWindow.mockReturnValue(true);

    const req = makeReq({ method: 'POST', path: '/tickets', baseUrl: '/api', agency: agency._id });
    const res = makeRes();
    const next = vi.fn();

    await billingGuard()(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('allows GET requests in read-only window', async () => {
    await Invoice.create(makeInvoice(agency._id));
    isReadOnlyWindow.mockReturnValue(true);

    const req = makeReq({ method: 'GET', path: '/invoices', baseUrl: '/api/billing', agency: agency._id });
    const res = makeRes();
    const next = vi.fn();

    await billingGuard()(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('exempts POST /api/billing/payment-requests in read-only window', async () => {
    await Invoice.create(makeInvoice(agency._id));
    isReadOnlyWindow.mockReturnValue(true);

    const req = makeReq({ method: 'POST', path: '/payment-requests', baseUrl: '/api/billing', agency: agency._id });
    const res = makeRes();
    const next = vi.fn();

    await billingGuard()(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('valid billingOverrideUnlocked bypasses read-only block (T2 fix)', async () => {
    await Agency.findByIdAndUpdate(agency._id, {
      billingOverrideUnlocked: true,
      billingOverrideUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    await Invoice.create(makeInvoice(agency._id));
    isReadOnlyWindow.mockReturnValue(true);

    const req = makeReq({ method: 'POST', path: '/tickets', baseUrl: '/api', agency: agency._id });
    const res = makeRes();
    const next = vi.fn();

    await billingGuard()(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.billing).toEqual({ status: 'ok', override: true });
    expect(res.status).not.toHaveBeenCalled();
  });

  it('expired billingOverrideUntil still blocks', async () => {
    await Agency.findByIdAndUpdate(agency._id, {
      billingOverrideUnlocked: true,
      billingOverrideUntil: new Date(Date.now() - 1000),
    });
    await Invoice.create(makeInvoice(agency._id));
    isReadOnlyWindow.mockReturnValue(true);

    const req = makeReq({ method: 'POST', path: '/tickets', baseUrl: '/api', agency: agency._id });
    const res = makeRes();
    const next = vi.fn();

    await billingGuard()(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('passes when req.user has no agencyId', async () => {
    const req = makeReq({ method: 'POST', agency: null });
    const res = makeRes();
    const next = vi.fn();

    await billingGuard()(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });
});
