import { describe, it, expect, vi } from 'vitest';
import { requireRole } from '../middleware/roles.js';
import { ROLES } from '../utils/constants.js';

// Tests the requireRole(SUPER_ADMIN) guard added to POST /api/billing/test-generate

const guard = requireRole(ROLES.SUPER_ADMIN);

function makeCtx(role) {
  const res = { json: vi.fn() };
  res.status = vi.fn().mockReturnValue(res);
  return {
    req: { user: { role } },
    res,
    next: vi.fn(),
  };
}

describe('POST /api/billing/test-generate — role guard', () => {
  it('blocks AGENCY_ADMIN with 403', () => {
    const { req, res, next } = makeCtx(ROLES.AGENCY_ADMIN);
    guard(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('blocks PARTNER with 403', () => {
    const { req, res, next } = makeCtx(ROLES.PARTNER);
    guard(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('blocks ACCOUNTANT with 403', () => {
    const { req, res, next } = makeCtx(ROLES.ACCOUNTANT);
    guard(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows SUPER_ADMIN through', () => {
    const { req, res, next } = makeCtx(ROLES.SUPER_ADMIN);
    guard(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });
});
