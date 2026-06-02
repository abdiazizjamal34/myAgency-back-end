import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { dbConnect, dbDisconnect, dbClear } from './helpers/db.js';

vi.mock('../utils/mailer.js', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendOtpEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../utils/whatsapp.js', () => ({
  sendWhatsAppTwilio: vi.fn().mockResolvedValue(undefined),
}));

import User from '../models/User.js';
import Otp from '../models/Otp.js';
import { requestOtp, verifyOtp, resetPassword } from '../controllers/auth.controller.js';

function makeCtx(body = {}) {
  const res = { json: vi.fn() };
  res.status = vi.fn().mockReturnValue(res);
  return { req: { body }, res, next: vi.fn() };
}

beforeAll(() => dbConnect());
afterAll(() => dbDisconnect());
afterEach(async () => { await dbClear(); vi.clearAllMocks(); });

// ─── requestOtp ──────────────────────────────────────────────────────────────

describe('requestOtp', () => {
  it('creates an OTP record for a known email', async () => {
    const user = await User.create({ name: 'A', email: 'a@test.com', phone: '+1000', password: 'pass123' });
    const { req, res, next } = makeCtx({ identifier: user.email, method: 'email' });

    await requestOtp(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('OTP') }));

    const otp = await Otp.findOne({ user: user._id });
    expect(otp).not.toBeNull();
    expect(otp.code).toHaveLength(6);
    expect(otp.verified).toBe(false);
  });

  it('returns 404 for an unknown identifier', async () => {
    const { req, res } = makeCtx({ identifier: 'ghost@test.com', method: 'email' });
    await requestOtp(req, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

// ─── verifyOtp ───────────────────────────────────────────────────────────────

describe('verifyOtp', () => {
  async function seedOtp(overrides = {}) {
    const user = await User.create({ name: 'B', email: 'b@test.com', phone: '+2000', password: 'pass123' });
    await Otp.create({
      user: user._id,
      code: '654321',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      verified: false,
      ...overrides,
    });
    return user;
  }

  it('marks OTP verified and returns userId + 64-char resetToken', async () => {
    const user = await seedOtp();
    const { req, res, next } = makeCtx({ identifier: user.email, code: '654321' });

    await verifyOtp(req, res, next);

    expect(next).not.toHaveBeenCalled();
    const payload = res.json.mock.calls[0][0];
    expect(payload.userId.toString()).toBe(user._id.toString());
    expect(payload.resetToken).toHaveLength(64);

    const updated = await Otp.findOne({ user: user._id });
    expect(updated.verified).toBe(true);
    expect(updated.resetToken).toBe(payload.resetToken);
    expect(updated.resetTokenExpiresAt).toBeInstanceOf(Date);
  });

  it('returns 400 for wrong code', async () => {
    const user = await seedOtp();
    const { req, res } = makeCtx({ identifier: user.email, code: '000000' });
    await verifyOtp(req, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 for expired OTP', async () => {
    const user = await seedOtp({ expiresAt: new Date(Date.now() - 1000) });
    const { req, res } = makeCtx({ identifier: user.email, code: '654321' });
    await verifyOtp(req, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 for already-verified OTP', async () => {
    const user = await seedOtp({ verified: true });
    const { req, res } = makeCtx({ identifier: user.email, code: '654321' });
    await verifyOtp(req, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

// ─── resetPassword ───────────────────────────────────────────────────────────

describe('resetPassword', () => {
  async function seedWithToken(tokenOverrides = {}) {
    const user = await User.create({ name: 'C', email: 'c@test.com', phone: '+3000', password: 'oldpass' });
    const resetToken = 'a'.repeat(64);
    await Otp.create({
      user: user._id,
      code: '000000',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      verified: true,
      resetToken,
      resetTokenExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
      ...tokenOverrides,
    });
    return { user, resetToken };
  }

  it('returns 400 when resetToken is absent', async () => {
    const { req, res } = makeCtx({ userId: 'anyid', newPassword: 'newpass' });
    await resetPassword(req, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('resetToken') }));
  });

  it('returns 400 for a wrong resetToken', async () => {
    const { user } = await seedWithToken();
    const { req, res } = makeCtx({ userId: user._id.toString(), resetToken: 'b'.repeat(64), newPassword: 'newpass' });
    await resetPassword(req, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('Invalid') }));
  });

  it('returns 400 for an expired resetToken', async () => {
    const { user, resetToken } = await seedWithToken({ resetTokenExpiresAt: new Date(Date.now() - 1000) });
    const { req, res } = makeCtx({ userId: user._id.toString(), resetToken, newPassword: 'newpass' });
    await resetPassword(req, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('updates password and deletes all OTPs on success', async () => {
    const { user, resetToken } = await seedWithToken();
    const { req, res, next } = makeCtx({ userId: user._id.toString(), resetToken, newPassword: 'newpass123' });

    await resetPassword(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('successful') }));

    const updated = await User.findById(user._id);
    expect(await updated.comparePassword('newpass123')).toBe(true);

    const remaining = await Otp.find({ user: user._id });
    expect(remaining).toHaveLength(0);
  });

  it('token is single-use — second attempt returns 400', async () => {
    const { user, resetToken } = await seedWithToken();
    const body = { userId: user._id.toString(), resetToken, newPassword: 'newpass123' };

    const { req: r1, res: rs1 } = makeCtx(body);
    await resetPassword(r1, rs1, vi.fn());
    expect(rs1.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('successful') }));

    const { req: r2, res: rs2 } = makeCtx(body);
    await resetPassword(r2, rs2, vi.fn());
    expect(rs2.status).toHaveBeenCalledWith(400);
  });
});
