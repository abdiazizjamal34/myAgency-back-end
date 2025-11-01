import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { ROLES } from '../utils/constants.js';
import { body } from 'express-validator';
import {
  createAgency,
  listAgencies,
  getAgency,
  updateAgency,
  deleteAgency,
  addAgencyAdmin,
  uploadAgencyLogoHandler,
  getAgencyLogo
} from '../controllers/agency.controller.js';
import { uploadAgencyLogo } from '../middleware/upload.js';

const router = Router();

router.use(auth);

router.post(
  '/',
  requireRole(ROLES.SUPER_ADMIN),
  [
    body('name').notEmpty(),
    body('code').notEmpty(),
  ],
  createAgency
);

router.get('/', requireRole(ROLES.SUPER_ADMIN, ROLES.AGENCY_ADMIN), listAgencies);
router.get('/:id', requireRole(ROLES.SUPER_ADMIN, ROLES.AGENCY_ADMIN), getAgency);
router.get('/:id/logo', requireRole(ROLES.SUPER_ADMIN, ROLES.AGENCY_ADMIN), getAgencyLogo);
router.put('/:id', requireRole(ROLES.SUPER_ADMIN), updateAgency);
router.delete('/:id', requireRole(ROLES.SUPER_ADMIN), deleteAgency);

router.post('/:id/admin', requireRole(ROLES.SUPER_ADMIN), addAgencyAdmin);

router.post(
  '/:id/logo',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AGENCY_ADMIN),
  (req, res, next) => uploadAgencyLogo(req, res, err => { if (err) return next(err); next(); }),
  uploadAgencyLogoHandler
);

export default router;