import fs from 'fs';
import path from 'path';
import { validationResult } from 'express-validator';
import Agency from '../models/Agency.js';
import User from '../models/User.js';
import { ROLES } from '../utils/constants.js';
//import { uploadAgencyLogo ,uploadAgencyLogoHandler } from '../controllers/agency.controller.js';


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
    const isSuperAdmin = req.user?.role === ROLES.SUPER_ADMIN;
    if (!isSuperAdmin && !req.user?.agency) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const query = isSuperAdmin ? {} : { _id: req.user.agency };
    const agencies = await Agency.find(query).sort({ createdAt: -1 });
    res.json(agencies);
  } catch (err) { next(err); }
}

export async function getAgency(req, res, next) {
  try {
    const agency = await Agency.findById(req.params.id);
    if (!agency) return res.status(404).json({ message: 'Agency not found' });
    if (req.user?.role !== ROLES.SUPER_ADMIN && String(req.user?.agency) !== String(agency._id)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    res.json(agency);
  } catch (err) { next(err); }
}

export async function updateAgency(req, res, next) {
  try {
    const { name, address, code, phone } = req.body;
    const agency = await Agency.findById(req.params.id);
    if (!agency) return res.status(404).json({ message: 'Agency not found' });
    if (req.user?.role !== ROLES.SUPER_ADMIN && String(req.user?.agency) !== String(agency._id)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    agency.set({ name, address, code, phone });
    await agency.save();
    res.json(agency);
  } catch (err) { next(err); }
}

export async function deleteAgency(req, res, next) {
  try {
    if (req.user?.role !== ROLES.SUPER_ADMIN) {
      return res.status(403).json({ message: 'Forbidden' });
    }
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

export async function uploadAgencyLogoHandler(req, res, next) {
  try {
    const agencyId = req.params.id;
    const agency = await Agency.findById(agencyId);
    if (!agency) return res.status(404).json({ message: 'Agency not found' });

    // only SUPER_ADMIN or admin of the agency
    if (req.user.role !== ROLES.SUPER_ADMIN && String(req.user.agency) !== String(agencyId)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    if (!req.file) return res.status(400).json({ message: 'Logo file is required' });

    // validate logo file type and size
    const allowedLogoMimeTypes = [
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/svg+xml',
      'image/webp',
    ];
    const maxLogoSizeBytes = 2 * 1024 * 1024; // 2MB

    if (!allowedLogoMimeTypes.includes(req.file.mimetype)) {
      if (req.file.path) {
        try { if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); } catch (e) { /* ignore */ }
      }
      return res
        .status(400)
        .json({ message: 'Invalid logo file type. Allowed types are PNG, JPEG, SVG, and WEBP.' });
    }

    if (typeof req.file.size === 'number' && req.file.size > maxLogoSizeBytes) {
      if (req.file.path) {
        try { if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); } catch (e) { /* ignore */ }
      }
      return res
        .status(413)
        .json({ message: 'Logo file is too large. Maximum size is 2MB.' });
    }

    // remove old local file if present
    if (agency.logo && agency.logo.startsWith('/uploads/')) {
      const oldPath = path.resolve('.', agency.logo.slice(1));
      try { if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath); } catch (e) { /* ignore */ }
    }

    agency.logo = `/uploads/agencies/${req.file.filename}`;
    await agency.save();

    res.json({ message: 'Logo uploaded', logo: agency.logo });
  } catch (err) {
    next(err);
  }
}

export async function getAgencyLogo(req, res, next) {
  try {
    const agency = await Agency.findById(req.params.id);
    if (!agency) return res.status(404).json({ message: 'Agency not found' });
    if (!agency.logo) return res.status(404).json({ message: 'Logo not found' });

    // If logo is absolute URL (http/https) only allow redirects to whitelisted hosts.
    // Otherwise treat as relative path and let static middleware serve it.
    const { logo } = agency;
    const isAbsoluteUrl = /^https?:\/\//i.test(logo);

    if (isAbsoluteUrl) {
      let url;
      try {
        url = new URL(logo, `${req.protocol}://${req.get('host')}`);
      } catch (e) {
        return res.status(400).json({ message: 'Invalid logo URL' });
      }

      const allowedLogoHosts = (process.env.AGENCY_LOGO_ALLOWED_HOSTS || '')
        .split(',')
        .map((h) => h.trim())
        .filter(Boolean);

      const isAllowed =
        allowedLogoHosts.length === 0
          ? false
          : allowedLogoHosts.includes(url.hostname);

      if (!isAllowed) {
        return res.status(400).json({ message: 'Logo host not allowed' });
      }

      return res.redirect(url.toString());
    }

    // Relative path, e.g. "/uploads/agencies/xxx.png" served by static middleware
    return res.redirect(logo);
  } catch (err) {
    next(err);
  }
}