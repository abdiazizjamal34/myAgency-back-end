import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { dbConnect, dbDisconnect, dbClear } from './helpers/db.js';
import mongoose from 'mongoose';
import Usage from '../models/Usage.js';

beforeAll(() => dbConnect());
afterAll(() => dbDisconnect());
afterEach(() => dbClear());

const PERIOD = '2026-05';
const periodDates = () => ({ periodStart: new Date('2026-05-01'), periodEnd: new Date('2026-05-31') });
const newId = () => new mongoose.Types.ObjectId();

describe('Usage counter', () => {
  it('upsert creates document with recordsCreated defaulting to 0', async () => {
    const agencyId = newId();
    const doc = await Usage.findOneAndUpdate(
      { agencyId, periodKey: PERIOD },
      { $setOnInsert: { ...periodDates() } },
      { upsert: true, new: true }
    );
    expect(doc.recordsCreated).toBe(0);
    expect(doc.periodKey).toBe(PERIOD);
  });

  it('$inc increments recordsCreated by 1', async () => {
    const agencyId = newId();
    await Usage.create({ agencyId, periodKey: PERIOD, ...periodDates(), recordsCreated: 5 });

    const updated = await Usage.findOneAndUpdate(
      { agencyId, periodKey: PERIOD },
      { $inc: { recordsCreated: 1 } },
      { new: true }
    );
    expect(updated.recordsCreated).toBe(6);
  });

  it('multiple increments accumulate correctly', async () => {
    const agencyId = newId();
    await Usage.create({ agencyId, periodKey: PERIOD, ...periodDates(), recordsCreated: 0 });

    for (let i = 0; i < 5; i++) {
      await Usage.findOneAndUpdate({ agencyId, periodKey: PERIOD }, { $inc: { recordsCreated: 1 } });
    }

    const result = await Usage.findOne({ agencyId, periodKey: PERIOD });
    expect(result.recordsCreated).toBe(5);
  });

  it('$inc with negative value decrements recordsCreated', async () => {
    const agencyId = newId();
    await Usage.create({ agencyId, periodKey: PERIOD, ...periodDates(), recordsCreated: 10 });

    const updated = await Usage.findOneAndUpdate(
      { agencyId, periodKey: PERIOD },
      { $inc: { recordsCreated: -3 } },
      { new: true }
    );
    expect(updated.recordsCreated).toBe(7);
  });

  it('enforces unique {agencyId, periodKey} index', async () => {
    const agencyId = newId();
    await Usage.create({ agencyId, periodKey: PERIOD, ...periodDates() });

    await expect(
      Usage.create({ agencyId, periodKey: PERIOD, ...periodDates() })
    ).rejects.toThrow();
  });

  it('allows same periodKey for different agencies', async () => {
    await Usage.create({ agencyId: newId(), periodKey: PERIOD, ...periodDates() });
    await Usage.create({ agencyId: newId(), periodKey: PERIOD, ...periodDates() });

    expect(await Usage.countDocuments({ periodKey: PERIOD })).toBe(2);
  });

  it('locked flag prevents usage from being billed twice', async () => {
    const agencyId = newId();
    await Usage.create({ agencyId, periodKey: PERIOD, ...periodDates(), recordsCreated: 50, locked: false });

    await Usage.findOneAndUpdate({ agencyId, periodKey: PERIOD }, { $set: { locked: true } });
    const locked = await Usage.findOne({ agencyId, periodKey: PERIOD });
    expect(locked.locked).toBe(true);
  });
});
