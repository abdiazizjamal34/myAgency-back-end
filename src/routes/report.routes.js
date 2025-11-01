import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { ROLES } from '../utils/constants.js';
import { summary, byServiceType , paymentSummary } from '../controllers/report.controller.js';
import { trend } from '../controllers/report.controller.js';
// import { paymentSummary } from '../controllers/report.controller.js';

const router = Router();
router.use(auth);

router.get('/summary', requireRole(ROLES.SUPER_ADMIN, ROLES.AGENCY_ADMIN, ROLES.ACCOUNTANT), summary);
router.get('/paymentSummary', requireRole(ROLES.SUPER_ADMIN, ROLES.AGENCY_ADMIN, ROLES.ACCOUNTANT), paymentSummary);

router.get('/by-service', requireRole(ROLES.SUPER_ADMIN, ROLES.AGENCY_ADMIN, ROLES.ACCOUNTANT), byServiceType);
router.get('/trend', requireRole(ROLES.SUPER_ADMIN, ROLES.AGENCY_ADMIN, ROLES.ACCOUNTANT), trend);

export default router;
