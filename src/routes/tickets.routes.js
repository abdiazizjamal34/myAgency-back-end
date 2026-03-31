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
  deleteTicketDocument,
} from '../controllers/ticketDocument.controller.js';

import multer from 'multer';
import { sendTicketViaEmail, sendTicketViaEmailInline, sendTicketViaEmailMultipart } from '../controllers/ticketEmail.controller.js';

const router = Router();
router.use(auth);

router.get('/', requireRole(ROLES.SUPER_ADMIN, ROLES.AGENCY_ADMIN, ROLES.ACCOUNTANT, ROLES.PARTNER), listTicketDocuments);
router.get('/agency/:agencyId', requireRole(ROLES.SUPER_ADMIN, ROLES.AGENCY_ADMIN, ROLES.ACCOUNTANT), listAgencyTickets);
router.get('/:id', requireRole(ROLES.SUPER_ADMIN, ROLES.AGENCY_ADMIN, ROLES.ACCOUNTANT, ROLES.PARTNER), getTicketDocument);

// get normalized JSON data (for frontend rendering)
router.get("/:id/data", requireRole(ROLES.SUPER_ADMIN, ROLES.AGENCY_ADMIN, ROLES.ACCOUNTANT), getTicketData);

// send ticket via email
router.post("/:id/email", requireRole(ROLES.SUPER_ADMIN, ROLES.AGENCY_ADMIN, ROLES.PARTNER), sendTicketViaEmail);

// send ticket via email directly taking a multipart form PDF from frontend
const uploadMemory = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });
router.post("/:id/send-email", requireRole(ROLES.SUPER_ADMIN, ROLES.AGENCY_ADMIN, ROLES.PARTNER), uploadMemory.single("file"), sendTicketViaEmailMultipart);

// send ticket via email with inline/base64 PDF (frontend provides base64 PDF, no saving)
router.post("/:id/email-inline", requireRole(ROLES.SUPER_ADMIN, ROLES.AGENCY_ADMIN, ROLES.PARTNER), sendTicketViaEmailInline);


// delete ticket
router.delete('/:id', requireRole(ROLES.SUPER_ADMIN, ROLES.AGENCY_ADMIN, ROLES.PARTNER), deleteTicketDocument);

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
