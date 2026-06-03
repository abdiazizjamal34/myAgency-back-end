import express from 'express';
import path from 'path';
import fs from 'fs';
import PaymentRequest from '../models/PaymentRequest.js';
import TicketDocument from '../models/TicketDocument.js';
import Agency from '../models/Agency.js';
import { ROLES } from '../utils/constants.js';

const SUBDIRS = ['receipts', 'agencies', 'tickets', 'rendered'];

async function ownsFile(filename, agencyId) {
  const paths = SUBDIRS.map(sub => `/uploads/${sub}/${filename}`);
  if (await PaymentRequest.exists({ receiptUrl: { $in: paths }, agencyId })) return true;
  if (await TicketDocument.exists({
    $or: [{ 'rendered.pdfUrl': { $in: paths } }, { 'source.fileUrl': { $in: paths } }],
    agencyId,
  })) return true;
  if (await Agency.exists({ logo: { $in: paths }, _id: agencyId })) return true;
  return false;
}

export async function serveFile(req, res, next) {
  try {
    const raw = req.params.filename;
    const filename = path.basename(raw);
    if (filename !== raw || !filename) {
      return res.status(400).json({ message: 'Invalid filename' });
    }

    let filePath = null;
    for (const sub of SUBDIRS) {
      const candidate = path.resolve('uploads', sub, filename);
      if (fs.existsSync(candidate)) {
        filePath = candidate;
        break;
      }
    }
    if (!filePath) return res.status(404).json({ message: 'File not found' });

    if (req.user.role !== ROLES.SUPER_ADMIN) {
      const agencyId = req.user.agency;
      if (!agencyId || !(await ownsFile(filename, agencyId))) {
        return res.status(403).json({ message: 'Forbidden' });
      }
    }

    res.sendFile(filePath);
  } catch (e) {
    next(e);
  }
}

const router = express.Router();
router.get('/:filename', serveFile);
export default router;
