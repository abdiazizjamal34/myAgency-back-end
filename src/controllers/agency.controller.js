import Agency from '../models/Agency.js';
import User from '../models/User.js';
import { ROLES } from '../utils/constants.js';
import { validationResult } from 'express-validator';

export async function createAgency(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { name, code, address, phone, admin } = req.body;
    const agency = await Agency.create({ name, code, address, phone, createdBy: req.user._id });
    let adminUser = null;
    if (admin?.email && admin?.password && admin?.name) {
      adminUser = await User.create({
        name: admin.name,
        email: admin.email,
        password: admin.password,
        role: ROLES.AGENCY_ADMIN,
        agency: agency._id,
        createdBy: req.user._id,
      });
    }
    res.status(201).json({ agency, admin: adminUser });
  } catch (err) { next(err); }
}

export async function listAgencies(req, res, next) {
  try {
    const agencies = await Agency.find().sort({ createdAt: -1 });
    res.json(agencies);
  } catch (err) { next(err); }
}

export async function getAgency(req, res, next) {
  try {
    const agency = await Agency.findById(req.params.id);
    if (!agency) return res.status(404).json({ message: 'Agency not found' });
    res.json(agency);
  } catch (err) { next(err); }
}

export async function updateAgency(req, res, next) {
  try {
    const { name, address, phone } = req.body;
    const agency = await Agency.findByIdAndUpdate(req.params.id, { name, address, phone }, { new: true });
    if (!agency) return res.status(404).json({ message: 'Agency not found' });
    res.json(agency);
  } catch (err) { next(err); }
}

export async function deleteAgency(req, res, next) {
  try {
    const agency = await Agency.findByIdAndDelete(req.params.id);
    if (!agency) return res.status(404).json({ message: 'Agency not found' });
    await User.deleteMany({ agency: agency._id });
    res.json({ message: 'Agency and its users deleted' });
  } catch (err) { next(err); }
}

export async function addAgencyAdmin(req, res, next) {
  try {
    const { id } = req.params;
    const { name, email, password } = req.body;
    const agency = await Agency.findById(id);
    if (!agency) return res.status(404).json({ message: 'Agency not found' });
    const admin = await User.create({
      name, email, password,
      role: ROLES.AGENCY_ADMIN,
      agency: agency._id,
      createdBy: req.user._id,
    });
    res.status(201).json(admin);
  } catch (err) { next(err); }
}
