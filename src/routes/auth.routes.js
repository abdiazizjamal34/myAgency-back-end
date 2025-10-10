import { Router } from 'express';
import { body } from 'express-validator';
import { login } from '../controllers/auth.controller.js';
import {
  requestOtp,
  verifyOtp,
  resetPassword
} from '../controllers/auth.controller.js';

const router = Router();

router.post('/login', [
  body('email').isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password required'),
], login);

router.post("/forgot-password", requestOtp);
router.post("/verify-otp", verifyOtp);
router.post("/reset-password", resetPassword);

export default router;
