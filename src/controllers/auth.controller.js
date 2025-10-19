import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import User from '../models/User.js';
import { validationResult } from 'express-validator';
// import crypto from "crypto";
// import { sendOtpWhatsApp } from "../utils/whatsapp.js";
import Otp from "../models/Otp.js";
import crypto from "crypto";
import { sendOtpWhatsApp } from '../utils/whatsapp.js';
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

//     res.json({
//   token,
//   user: {
//     _id: user._id,
//     name: user.name,
//     email: user.email,
//     role: user.role,
//     agency: user.agency.name, // Return agency name
//     isActive: user.isActive,
//     createdBy: user.createdBy,
//     createdAt: user.createdAt,
//     updatedAt: user.updatedAt,
//     __v: user.__v
//   }
// });
//     const user = await User.findOne({ email }).populate('agency', 'name code');
// if (!user) return res.status(401).json({ message: 'Invalid credentials' });

// const ok = await user.comparePassword(password);
// if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

// const token = signToken(user);

// // clean up user object
// const data = user.toObject();  
// delete data.password;

// res.json({
//   token,
//   user: data
// });

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



// 1️⃣ Request OTP
// export async function requestOtp(req, res, next) {
//   try {
//     const { phone } = req.body;
//     const user = await User.findOne({ phone });
//     if (!user)
//       return res.status(404).json({ message: "No user found with this phone number" });

//     // generate 6-digit OTP
//     const code = crypto.randomInt(100000, 999999).toString();
//     const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

//     // save OTP
//     await Otp.create({
//       user: user._id,
//       code,
//       expiresAt
//     });

//     // send via WhatsApp
//     await sendOtpWhatsApp(phone, code);

//     // ✅ log info for debugging
//     console.log(
//       `OTP created: ${code} for ${user.email} expires at ${expiresAt.toISOString()}`
//     );

//     res.json({ message: "OTP sent via WhatsApp" });
//   } catch (err) {
//     console.error("requestOtp error:", err);
//     next(err);
//   }
// }

export async function requestOtp(req, res, next) {
  try {
    const { identifier, method } = req.body;   // identifier = phone or email

    if (!identifier) {
      return res.status(400).json({ message: "Phone or email is required" });
    }

    // 1️⃣ Find user by phone or email
    const user = identifier.includes("@")
      ? await User.findOne({ email: identifier })
      : await User.findOne({ phone: identifier });

    if (!user)
      return res.status(404).json({ message: "No user found with this identifier" });

    // 2️⃣ Generate 6-digit OTP
    const code = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    await Otp.create({ user: user._id, code, expiresAt, verified: false });

    // 3️⃣ Send OTP by selected method
    if (method === "whatsapp") {
      await sendOtpWhatsApp(user.phone, code);
      console.log(`✅ OTP ${code} sent via WhatsApp to ${user.phone}`);
    } else if (method === "email") {
      await sendOtpEmail(user.email, code);
      console.log(`✅ OTP ${code} sent via Email to ${user.email}`);
    } else {
      return res.status(400).json({ message: "method must be 'whatsapp' or 'email'" });
    }

    res.json({ message: `OTP sent via ${method}`, expiresAt });
  } catch (err) {
    console.error("requestOtp error:", err);
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
      verified: false,
      expiresAt: { $gt: new Date() },
    });

    if (!otpRecord) {
      console.error('OTP verify failed', { user: user._id.toString(), providedCode });
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    otpRecord.verified = true;
    await otpRecord.save();

    res.json({ message: 'OTP verified successfully', userId: user._id });
  } catch (err) {
    next(err);
  }
}


// 3️⃣ Reset password
export async function resetPassword(req, res, next) {
  try {
    const { userId, newPassword } = req.body;

    // Validate inputs
    if (!userId || !newPassword) {
      return res.status(400).json({ message: "userId and newPassword are required" });
    }

    // 1️⃣ Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 2️⃣ Update password
    user.password = newPassword; // hashing handled by pre-save hook in User model
    await user.save();

    // 3️⃣ Clean up OTPs for this user
    await Otp.deleteMany({ user: user._id });

    console.log(`🔑 Password reset successful for ${user.email}`);

    // 4️⃣ Respond
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

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (
      user.emailVerificationCode !== code ||
      user.emailVerificationExpires < new Date()
    ) {
      return res.status(400).json({ message: "Invalid or expired verification code" });
    }

    user.emailVerified = true;
    user.emailVerificationCode = null;
    user.emailVerificationExpires = null;
    await user.save();

    res.json({ message: "Email verified successfully" });
  } catch (err) {
    console.error("verifyEmail error:", err);
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
