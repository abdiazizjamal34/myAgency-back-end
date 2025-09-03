import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { ROLES } from '../utils/constants.js';
import { body } from 'express-validator';
import { createRecord, listRecords, getRecord, updateRecord, deleteRecord } from '../controllers/record.controller.js';

const router = Router();

router.use(auth);

router.post('/', requireRole(ROLES.SUPER_ADMIN, ROLES.AGENCY_ADMIN, ROLES.ACCOUNTANT, ROLES.PARTNER), [
  body('customerName').notEmpty(),
  body('typeOfService').notEmpty(),
  body('sellingPrice').isFloat({ min: 0 }),
  body('buyingPrice').isFloat({ min: 0 }),
  body('expenses').optional().isFloat({ min: 0 }),
], createRecord);

router.get('/', requireRole(ROLES.SUPER_ADMIN, ROLES.AGENCY_ADMIN, ROLES.ACCOUNTANT, ROLES.PARTNER), listRecords);

router.get('/:id', requireRole(ROLES.SUPER_ADMIN, ROLES.AGENCY_ADMIN, ROLES.ACCOUNTANT, ROLES.PARTNER), getRecord);
router.patch('/:id', requireRole(ROLES.SUPER_ADMIN, ROLES.AGENCY_ADMIN, ROLES.ACCOUNTANT), updateRecord);
router.delete('/:id', requireRole(ROLES.SUPER_ADMIN, ROLES.AGENCY_ADMIN), deleteRecord);

export default router;
