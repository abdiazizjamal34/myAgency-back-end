import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { dbConnect, dbDisconnect, dbClear } from './helpers/db.js';
import { auth } from '../middleware/auth.js';
import { serveFile } from '../routes/files.routes.js';
import User from '../models/User.js';
import Agency from '../models/Agency.js';
import Invoice from '../models/Invoice.js';
import PaymentRequest from '../models/PaymentRequest.js';
import { ROLES } from '../utils/constants.js';

const TEST_FILENAME = `test-receipt-${Date.now()}.pdf`;
const RECEIPTS_DIR = path.resolve('uploads', 'receipts');
const TEST_FILE_PATH = path.join(RECEIPTS_DIR, TEST_FILENAME);

function makeRes() {
  const res = { sendFile: vi.fn(), json: vi.fn() };
  res.status = vi.fn().mockReturnValue(res);
  return res;
}

let seq = 0;
function uid() { return `${Date.now()}-${++seq}`; }

beforeAll(async () => {
  await dbConnect();
  fs.mkdirSync(RECEIPTS_DIR, { recursive: true });
  fs.writeFileSync(TEST_FILE_PATH, 'stub');
});

afterAll(async () => {
  try { fs.unlinkSync(TEST_FILE_PATH); } catch { /* ignore */ }
  await dbDisconnect();
});

afterEach(async () => {
  await dbClear();
  vi.clearAllMocks();
});

// ─── auth middleware ──────────────────────────────────────────────────────────

describe('auth middleware (no token → 401)', () => {
  it('returns 401 when Authorization header is absent', async () => {
    const req = { headers: {} };
    const res = makeRes();
    const next = vi.fn();

    await auth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('passes error with status 401 for a bad token', async () => {
    const req = { headers: { authorization: 'Bearer not.a.valid.jwt' } };
    const res = makeRes();
    const next = vi.fn();

    await auth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(next.mock.calls[0][0]).toMatchObject({ status: 401 });
  });
});

// ─── file handler ─────────────────────────────────────────────────────────────

describe('serveFile handler', () => {
  let agencyA, agencyB, user;

  beforeEach(async () => {
    agencyA = await Agency.create({ name: 'A', code: `AAA${uid()}` });
    agencyB = await Agency.create({ name: 'B', code: `BBB${uid()}` });
    user = await User.create({ name: 'U', email: `u${uid()}@t.com`, phone: `+1${uid()}`, password: 'pass123' });
  });

  async function seedReceipt(agencyId) {
    const inv = await Invoice.create({
      agencyId,
      periodKey: `2026-0${(seq % 9) + 1}`,
      invoiceNumber: `INV-${uid()}`,
      recordsBilled: 1,
      unitPrice: 100,
      currency: 'ETB',
      amount: 100,
      status: 'unpaid',
      issuedAt: new Date(),
      dueAt: new Date(),
    });
    return PaymentRequest.create({
      invoiceId: inv._id,
      agencyId,
      submittedBy: user._id,
      amount: 100,
      currency: 'ETB',
      receiptUrl: `/uploads/receipts/${TEST_FILENAME}`,
    });
  }

  it('returns 200 and sends file to the owning agency', async () => {
    await seedReceipt(agencyA._id);

    const req = { params: { filename: TEST_FILENAME }, user: { role: ROLES.AGENCY_ADMIN, agency: agencyA._id } };
    const res = makeRes();

    await serveFile(req, res, vi.fn());

    expect(res.sendFile).toHaveBeenCalledWith(TEST_FILE_PATH);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 403 when a different agency requests the file', async () => {
    await seedReceipt(agencyA._id);

    const req = { params: { filename: TEST_FILENAME }, user: { role: ROLES.AGENCY_ADMIN, agency: agencyB._id } };
    const res = makeRes();

    await serveFile(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.sendFile).not.toHaveBeenCalled();
  });

  it('returns 400 for a path-traversal filename', async () => {
    const req = { params: { filename: '../../../etc/passwd' }, user: { role: ROLES.AGENCY_ADMIN, agency: agencyA._id } };
    const res = makeRes();

    await serveFile(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.sendFile).not.toHaveBeenCalled();
  });

  it('SUPER_ADMIN bypasses agency ownership check', async () => {
    const req = { params: { filename: TEST_FILENAME }, user: { role: ROLES.SUPER_ADMIN, agency: null } };
    const res = makeRes();

    await serveFile(req, res, vi.fn());

    expect(res.sendFile).toHaveBeenCalledWith(TEST_FILE_PATH);
  });
});
