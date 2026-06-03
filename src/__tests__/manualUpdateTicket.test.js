import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { dbConnect, dbDisconnect, dbClear } from './helpers/db.js';
import { manualUpdateTicket } from '../controllers/ticketUpload.controller.js';
import TicketDocument from '../models/TicketDocument.js';
import Agency from '../models/Agency.js';
import User from '../models/User.js';
import { ROLES } from '../utils/constants.js';

beforeAll(() => dbConnect());
afterAll(() => dbDisconnect());
afterEach(() => dbClear());

let seq = 0;
function uid() { return `${Date.now()}-${++seq}`; }

function makeRes() {
  const res = { json: vi.fn() };
  res.status = vi.fn().mockReturnValue(res);
  return res;
}

async function seedTicket(agencyId, uploadedBy) {
  return TicketDocument.create({
    agencyId,
    uploadedBy,
    source: { fileType: 'PDF' },
    processingStatus: 'NORMALIZED',
  });
}

describe('manualUpdateTicket (T9 regression)', () => {
  it('returns 200 and applies patch when agency matches (req.user.agency)', async () => {
    const agency = await Agency.create({ name: 'A', code: `AA${uid()}` });
    const user = await User.create({ name: 'U', email: `u${uid()}@t.com`, phone: `+1${uid()}`, password: 'pass123' });
    const ticket = await seedTicket(agency._id, user._id);

    const req = {
      params: { id: ticket._id.toString() },
      user: { role: ROLES.AGENCY_ADMIN, agency: agency._id },
      body: { notes: ['corrected manually'] },
    };
    const res = makeRes();

    await manualUpdateTicket(req, res, vi.fn());

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Ticket updated manually' }),
    );
    expect(res.status).not.toHaveBeenCalled();

    const saved = await TicketDocument.findById(ticket._id).lean();
    expect(saved.notes).toEqual(['corrected manually']);
  });

  it('returns 404 when agencyId does not match (old bug: req.user.agencyId was undefined)', async () => {
    const agencyA = await Agency.create({ name: 'A', code: `AA${uid()}` });
    const agencyB = await Agency.create({ name: 'B', code: `BB${uid()}` });
    const user = await User.create({ name: 'U', email: `u${uid()}@t.com`, phone: `+1${uid()}`, password: 'pass123' });
    const ticket = await seedTicket(agencyA._id, user._id);

    const req = {
      params: { id: ticket._id.toString() },
      user: { role: ROLES.AGENCY_ADMIN, agency: agencyB._id },
      body: { notes: ['should not apply'] },
    };
    const res = makeRes();

    await manualUpdateTicket(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(404);
  });
});
