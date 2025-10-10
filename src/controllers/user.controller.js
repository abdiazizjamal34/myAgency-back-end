import User from '../models/User.js';
import Agency from '../models/Agency.js';
import { ROLES } from '../utils/constants.js';
import { validationResult } from 'express-validator';

export async function createUser(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { name, email, phone, password, role } = req.body;
    let agencyId = req.user.agency;
    if (req.user.role === ROLES.SUPER_ADMIN && req.body.agency) {
      agencyId = req.body.agency;
    }
    if (!agencyId && role !== ROLES.SUPER_ADMIN) {
      return res.status(400).json({ message: 'Agency is required for non-super users' });
    }
    if (agencyId) {
      const exists = await Agency.findById(agencyId);
      if (!exists) return res.status(400).json({ message: 'Invalid agency' });
    }
    if (role === ROLES.SUPER_ADMIN && req.user.role !== ROLES.SUPER_ADMIN) {
      return res.status(403).json({ message: 'Only SUPER_ADMIN can create SUPER_ADMIN' });
    }
  const user = await User.create({ name, email, phone, password, role: role || ROLES.PARTNER, agency: agencyId, createdBy: req.user._id });
    const data = user.toObject(); delete data.password;
    res.status(201).json(data);
  } catch (err) { next(err); }
}

export async function listUsers(req, res, next) {
  try {
    const query = {};
    if (req.user.role === ROLES.SUPER_ADMIN) {
      if (req.query.agencyId) query.agency = req.query.agencyId;
    } else {
      query.agency = req.user.agency;
    }
    const users = await User.find(query).select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) { next(err); }
}

export async function updateUser(req, res, next) {
  try {
    const { id } = req.params;
    const update = (({ name, role, isActive }) => ({ name, role, isActive }))(req.body);
    // prevent role escalation
    if (update.role === ROLES.SUPER_ADMIN && req.user.role !== ROLES.SUPER_ADMIN) {
      return res.status(403).json({ message: 'Cannot elevate to SUPER_ADMIN' });
    }
    let user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (req.user.role !== ROLES.SUPER_ADMIN && user.agency?.toString() !== req.user.agency?.toString()) {
      return res.status(403).json({ message: 'Cross-agency modification denied' });
    }
    user.set(update);
    await user.save();
    const data = user.toObject(); delete data.password;
    res.json(data);
  } catch (err) { next(err); }
}

export async function deleteUser(req, res, next) {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (req.user.role !== ROLES.SUPER_ADMIN && user.agency?.toString() !== req.user.agency?.toString()) {
      return res.status(403).json({ message: 'Cross-agency deletion denied' });
    }
    await user.deleteOne();
    res.json({ message: 'User deleted' });
  } catch (err) { next(err); }
}
