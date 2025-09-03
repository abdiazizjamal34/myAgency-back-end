import { ROLES, ROLE_HIERARCHY } from '../utils/constants.js';

export function requireRole(...allowed) {
  return (req, res, next) => {
    const role = req.user?.role;
    if (!role) return res.status(403).json({ message: 'Forbidden' });
    if (allowed.includes(ROLES.SUPER_ADMIN) && role === ROLES.SUPER_ADMIN) return next();
    if (allowed.includes(role)) return next();
    return res.status(403).json({ message: 'Insufficient role' });
  };
}

export function sameAgencyOrSuper(req, res, next) {
  if (req.user.role === ROLES.SUPER_ADMIN) return next();
  const paramAgencyId = req.params.agencyId || req.body.agency || req.query.agencyId;
  const userAgencyId = req.user.agency?.toString();
  // if route scoped to agency resource, enforce
  if (paramAgencyId && userAgencyId && paramAgencyId !== userAgencyId) {
    return res.status(403).json({ message: 'Cross-agency access denied' });
  }
  next();
}

export function scopeQueryToAgency(query, req) {
  if (req.user.role === ROLES.SUPER_ADMIN) {
    // super can optionally pass ?agencyId=...
    if (req.query.agencyId) query.agency = req.query.agencyId;
  } else {
    query.agency = req.user.agency;
  }
  return query;
}
