import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { ROLES } from '../utils/constants.js';
import { body } from 'express-validator';
import { createUser, listUsers, updateUser, deleteUser } from '../controllers/user.controller.js';
import { changePassword } from '../controllers/auth.controller.js';


const router = Router();

router.use(auth);

// AGENCY_ADMIN can manage users in their agency; SUPER_ADMIN can manage all
router.post('/', requireRole(ROLES.SUPER_ADMIN, ROLES.AGENCY_ADMIN), [
  body('name').notEmpty(),
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
], createUser);

router.get('/', requireRole(ROLES.SUPER_ADMIN, ROLES.AGENCY_ADMIN), listUsers);
router.patch('/:id', requireRole(ROLES.SUPER_ADMIN, ROLES.AGENCY_ADMIN), updateUser);
router.delete('/:id', requireRole(ROLES.SUPER_ADMIN, ROLES.AGENCY_ADMIN), deleteUser);
// allow admins to reset another user's password
router.post('/:id/change-password', requireRole(ROLES.SUPER_ADMIN, ROLES.AGENCY_ADMIN), changePassword);
// allow authenticated user to change their own password
router.post('/change-password', changePassword);

export default router;
