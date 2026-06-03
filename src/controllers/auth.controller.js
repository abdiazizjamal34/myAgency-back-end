import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import User from '../models/User.js';
import { validationResult } from 'express-validator';
import Otp from "../models/Otp.js";
import crypto from "crypto";
import { sendWhatsAppTwilio } from '../utils/whatsapp.js';
dotenv.config();

import { sendOtpEmail, sendVerificationEmail } from "../utils/mailer.js";

function signToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role, agency: user.agency },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

export async function login(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { email, password } = req.body;
    const user = await User.findOne({ email })
      .populate('agency', 'name code')

    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    const ok = await user.comparePassword(password);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });
    const token = signToken(user);
    const data = user.toObject();
    delete data.password;
    res.json({ token, user: data });
  } catch (err) { next(err); }
}


export async function changePassword(req, res, next) {
  try {
    // If :id is present, this is an admin reset for another user
    const targetId = req.params.id;
    const { currentPassword, newPassword } = req.body;

    if (targetId) {
      // validate ObjectId to avoid Mongoose CastError when client provides invalid id (eg ':id')
      if (!mongoose.Types.ObjectId.isValid(targetId)) {
        return res.status(400).json({ message: 'Invalid user id' });
      }
      // Admin resetting another user's password. Route is protected by requireRole in routes.
      if (!newPassword || newPassword.length < 6) return res.status(400).json({ message: 'newPassword is required and must be at least 6 characters' });
      const user = await User.findById(targetId);
      if (!user) return res.status(404).json({ message: 'User not found' });
        user.password = newPassword; // let pre-save hook hash it
      await user.save();
      return res.json({ message: 'Password updated successfully' });
    }

    // Self password change: requires currentPassword and newPassword
    if (!currentPassword || !newPassword) return res.status(400).json({ message: 'currentPassword and newPassword are required' });
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Current password is incorrect' });

      user.password = newPassword; // let pre-save hook hash it
    await user.save();
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    next(err);
  }
}


export async function requestOtp(req, res, next) {
  try {
    const { identifier, method = 'email' } = req.body;
    if (!identifier) return res.status(400).json({ message: 'Phone or email is required' });

    const user = identifier.includes('@')
      ? await User.findOne({ email: identifier })
      : await User.findOne({ phone: identifier });

    if (!user) return res.status(404).json({ message: 'User not found' });

    const code = String(Math.floor(100000 + Math.random() * 900000)).padStart(6, '0');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    user.emailVerificationCode = code;
    user.emailVerificationExpires = expiresAt;
    await user.save();

    await Otp.create({
      user: user._id,
      code,
      type: method === 'email' ? 'email' : (method === 'whatsapp' ? 'whatsapp' : 'sms'),
      purpose: 'password_reset',
      expiresAt,
      verified: false
    });

    if (method === 'whatsapp') {
      await sendWhatsAppTwilio(user.phone, `Your OTP is ${code}`);
      console.log(`WhatsApp OTP ${code} sent to ${user.phone}`);
    } else if (method === 'sms') {
      await sendOtpSms(user.phone, code);
      console.log(`SMS OTP ${code} sent to ${user.phone}`);
    } else {
      await sendVerificationEmail(user.email, code, user.name);
      console.log(`✅ Verification OTP ${code} sent via Email to ${user.email}`);
    }

    res.json({ message: `${method || 'email'} OTP sent` });
  } catch (err) {
    console.error('requestOtp error:', err);
    next(err);
  }
}

// 2️⃣ Verify OTP
export async function verifyOtp(req, res, next) {
  try {
    const { phone, email, identifier, code, otp } = req.body;
    const providedCode = String(code ?? otp ?? '').trim();
    if (!providedCode) return res.status(400).json({ message: 'phone/email and code are required' });

    // find user by phone or email or identifier
    let user;
    if (phone) user = await User.findOne({ phone });
    else if (email) user = await User.findOne({ email });
    else if (identifier) {
      user = identifier.includes('@') ? await User.findOne({ email: identifier }) : await User.findOne({ phone: identifier });
    }

    if (!user) return res.status(404).json({ message: 'User not found' });

    const otpRecord = await Otp.findOne({
      user: user._id,
      code: providedCode,
      purpose: 'password_reset',
      verified: false,
      expiresAt: { $gt: new Date() },
    });

    if (!otpRecord) {
      console.error('OTP verify failed', { user: user._id.toString() });
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    otpRecord.verified = true;
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    otpRecord.resetToken = resetTokenHash;
    otpRecord.resetTokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await otpRecord.save();

    res.json({ message: 'OTP verified successfully', userId: user._id, resetToken });
  } catch (err) {
    next(err);
  }
}


// 3️⃣ Reset password
export async function resetPassword(req, res, next) {
  try {
    const { userId, resetToken, newPassword } = req.body;

    if (!userId || !resetToken || !newPassword) {
      return res.status(400).json({ message: "userId, resetToken, and newPassword are required" });
    }

    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    if (!mongoose.Types.ObjectId.isValid(userId) || typeof resetToken !== 'string' || !/^[a-f0-9]{64}$/.test(resetToken)) {
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }

    // Atomic consume: findOneAndDelete ensures only one concurrent request can use this token
    const otpRecord = await Otp.findOneAndDelete({
      user: userId,
      resetToken: resetTokenHash,
      resetTokenExpiresAt: { $gt: new Date() },
      verified: true,
    });

    if (!otpRecord) {
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }

    // Use the DB-sourced user reference, not the attacker-controlled userId from req.body
    const user = await User.findById(otpRecord.user);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.password = newPassword; // hashing handled by pre-save hook in User model
    await user.save();

    // Delete any remaining OTPs (e.g. re-sent codes) for this user
    await Otp.deleteMany({ user: user._id });

    console.log(`🔑 Password reset successful for ${user.email}`);

    res.json({ message: "Password reset successful" });
  } catch (err) {
    console.error("resetPassword error:", err);
    next(err);
  }
}


// Email verification
export async function verifyEmail(req, res, next) {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ message: 'email and code are required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const provided = String(code).trim();

    // 1) check user fields first (legacy)
    if (user.emailVerificationCode && String(user.emailVerificationCode).trim() === provided && user.emailVerificationExpires && user.emailVerificationExpires > new Date()) {
      user.emailVerified = true;
      user.emailVerificationCode = undefined;
      user.emailVerificationExpires = undefined;
      await user.save();
      return res.json({ message: 'Email verified successfully' });
    }

    // 2) fallback: check Otp collection
    const otpRecord = await Otp.findOne({
      user: user._id,
      code: provided,
      type: 'email',
      purpose: 'email_verification',
      verified: false,
      expiresAt: { $gt: new Date() }
    });

    if (otpRecord) {
      otpRecord.verified = true;
      await otpRecord.save();
      user.emailVerified = true;
      // clear legacy fields too
      user.emailVerificationCode = undefined;
      user.emailVerificationExpires = undefined;
      await user.save();
      return res.json({ message: 'Email verified successfully' });
    }

    // debug info (do not return sensitive details in production)
    const latest = await Otp.findOne({ user: user._id }).sort({ createdAt: -1 }).lean();
    console.error('verifyEmail failed', { email, provided, userField: user.emailVerificationCode, latest });
    return res.status(400).json({ message: 'Invalid or expired verification code' });
  } catch (err) {
    next(err);
  }
}


export async function resendVerificationEmail(req, res, next) {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user)
      return res.status(404).json({ message: "User not found" });

    if (user.emailVerified)
      return res.status(400).json({ message: "Email already verified" });

    // Generate a new code
    const newCode = crypto.randomInt(100000, 999999).toString();
    const newExpiry = new Date(Date.now() + 15 * 60 * 1000);

    // Update user record
    user.emailVerificationCode = newCode;
    user.emailVerificationExpires = newExpiry;
    await user.save();

    // Send email again
    await sendVerificationEmail(email, newCode);

    console.log(`📧 Resent verification email to ${email} (expires ${newExpiry})`);

    res.json({
      message: "Verification email resent successfully",
      email,
    });
  } catch (err) {
    console.error("resendVerificationEmail error:", err);
    next(err);
  }
}
