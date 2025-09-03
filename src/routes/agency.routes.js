import { Router } from 'express';
import { body } from 'express-validator';
import { auth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { ROLES } from '../utils/constants.js';
import {
  createAgency, listAgencies, getAgency, updateAgency, deleteAgency, addAgencyAdmin
} from '../controllers/agency.controller.js';

const router = Router();

router.use(auth);

// SUPER_ADMIN only for agency management
router.post('/', requireRole(ROLES.SUPER_ADMIN), [
  body('name').notEmpty(),
  body('code').notEmpty(),
], createAgency);

router.get('/', requireRole(ROLES.SUPER_ADMIN), listAgencies);
router.get('/:id', requireRole(ROLES.SUPER_ADMIN), getAgency);
router.patch('/:id', requireRole(ROLES.SUPER_ADMIN), updateAgency);
router.delete('/:id', requireRole(ROLES.SUPER_ADMIN), deleteAgency);

router.post('/:id/admin', requireRole(ROLES.SUPER_ADMIN), [
  body('name').notEmpty(),
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
], addAgencyAdmin);

export default router;
