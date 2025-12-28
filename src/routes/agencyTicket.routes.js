// src/routes/agencyTicket.routes.js
import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { ROLES } from '../utils/constants.js';

import {
  getTicketBranding,
  updateTicketBranding,
  getTicketSettings,
  updateTicketSettings,
} from '../controllers/agencyTicket.controller.js';

const router = Router();
router.use(auth);

// Branding
router.get('/branding', requireRole(ROLES.SUPER_ADMIN, ROLES.AGENCY_ADMIN, ROLES.ACCOUNTANT, ROLES.PARTNER), getTicketBranding);
router.put('/branding', requireRole(ROLES.SUPER_ADMIN, ROLES.AGENCY_ADMIN), updateTicketBranding);

// Settings
router.get('/settings', requireRole(ROLES.SUPER_ADMIN, ROLES.AGENCY_ADMIN, ROLES.ACCOUNTANT, ROLES.PARTNER), getTicketSettings);
router.put('/settings', requireRole(ROLES.SUPER_ADMIN, ROLES.AGENCY_ADMIN), updateTicketSettings);

export default router;
