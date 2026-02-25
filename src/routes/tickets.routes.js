// src/routes/tickets.routes.js
import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { ROLES } from '../utils/constants.js';

import { uploadTicketFile } from '../middleware/uploadTicketFile.js';
import { uploadTicket, reprocessTicket, manualUpdateTicket } from '../controllers/ticketUpload.controller.js';
import { renderTicket, getRendered, getTicketData } from "../controllers/ticketRender.controller.js";

import {
  listTicketDocuments,
  getTicketDocument,
  listAgencyTickets,
} from '../controllers/ticketDocument.controller.js';

const router = Router();
router.use(auth);

router.get('/', requireRole(ROLES.SUPER_ADMIN, ROLES.AGENCY_ADMIN, ROLES.ACCOUNTANT, ROLES.PARTNER), listTicketDocuments);
router.get('/agency/:agencyId', requireRole(ROLES.SUPER_ADMIN, ROLES.AGENCY_ADMIN, ROLES.ACCOUNTANT), listAgencyTickets);
router.get('/:id', requireRole(ROLES.SUPER_ADMIN, ROLES.AGENCY_ADMIN, ROLES.ACCOUNTANT, ROLES.PARTNER), getTicketDocument);

// get normalized JSON data (for frontend rendering)
router.get("/:id/data", requireRole(ROLES.SUPER_ADMIN, ROLES.AGENCY_ADMIN, ROLES.ACCOUNTANT), getTicketData);

// upload (Phase 2)
router.post(
  '/upload',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AGENCY_ADMIN, ROLES.ACCOUNTANT, ROLES.PARTNER),
  (req, res, next) => next(),
  (req, res, next) => uploadTicketFile(req, res, err => { if (err) return next(err); next(); }),
  uploadTicket
);

// reprocess (admin only)
router.post('/:id/reprocess', requireRole(ROLES.SUPER_ADMIN, ROLES.AGENCY_ADMIN), reprocessTicket);

// manual update (admin only)
router.put('/:id/manual', requireRole(ROLES.SUPER_ADMIN, ROLES.AGENCY_ADMIN), manualUpdateTicket);

// render PDF
router.post("/:id/render", requireRole(ROLES.SUPER_ADMIN, ROLES.AGENCY_ADMIN, ROLES.ACCOUNTANT), renderTicket);

// get rendered info (pdfUrl)
router.get("/:id/rendered", requireRole(ROLES.SUPER_ADMIN, ROLES.AGENCY_ADMIN, ROLES.ACCOUNTANT), getRendered);

export default router;
