import crypto from "crypto";
import { validationResult } from "express-validator";
import { sendVerificationEmail } from "../utils/mailer.js";
import User from "../models/User.js";
import Agency from "../models/Agency.js";
import { ROLES } from '../utils/constants.js';
import { verifyEmailWithMailboxLayer } from "../utils/emailVerifier.js";

// export async function createUser(req, res, next) {
//   try {
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
//   const { name, email, phone, password, role } = req.body;
//     let agencyId = req.user.agency;
//     if (req.user.role === ROLES.SUPER_ADMIN && req.body.agency) {
//       agencyId = req.body.agency;
//     }
//     if (!agencyId && role !== ROLES.SUPER_ADMIN) {
//       return res.status(400).json({ message: 'Agency is required for non-super users' });
//     }
//     if (agencyId) {
//       const exists = await Agency.findById(agencyId);
//       if (!exists) return res.status(400).json({ message: 'Invalid agency' });
//     }
//     if (role === ROLES.SUPER_ADMIN && req.user.role !== ROLES.SUPER_ADMIN) {
//       return res.status(403).json({ message: 'Only SUPER_ADMIN can create SUPER_ADMIN' });
//     }
//   const user = await User.create({ name, email, phone, password, role: role || ROLES.PARTNER, agency: agencyId, createdBy: req.user._id });
//     const data = user.toObject(); delete data.password;
//     res.status(201).json(data);
//   } catch (err) { next(err); }
// }



export async function createUser(req, res, next) {
  try {
    // 🔹 Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    const { name, email, phone, password, role } = req.body;
    const isValidEmail = await verifyEmailWithMailboxLayer(email);
    if (!isValidEmail) {
      return res.status(400).json({
        message: "Please use a real, working email address (invalid or unreachable)"
      });
    }

    // 🔹 Determine agency
    let agencyId = req.user.agency;
    if (req.user.role === ROLES.SUPER_ADMIN && req.body.agency) {
      agencyId = req.body.agency;
    }

    if (!agencyId && role !== ROLES.SUPER_ADMIN) {
      return res.status(400).json({ message: "Agency is required for non-super users" });
    }

    if (agencyId) {
      const exists = await Agency.findById(agencyId);
      if (!exists) return res.status(400).json({ message: "Invalid agency" });
    }

    // 🔹 Only super admin can create another super admin
    if (role === ROLES.SUPER_ADMIN && req.user.role !== ROLES.SUPER_ADMIN) {
      return res.status(403).json({ message: "Only SUPER_ADMIN can create SUPER_ADMIN" });
    }

    // 🔹 Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    // 🔹 Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // 🔹 Generate email verification code
    const verificationCode = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // 🔹 Create user (unverified)
    const user = await User.create({
      name,
      email,
      phone,
      password,
      role: role || ROLES.PARTNER,
      agency: agencyId,
      createdBy: req.user._id,
      emailVerified: false,
      emailVerificationCode: verificationCode,
      emailVerificationExpires: expiresAt,
    });

    // 🔹 Send verification email
    await sendVerificationEmail(email, verificationCode);

    const data = user.toObject();
    delete data.password;

    console.log(`📧 Verification email sent to ${email} (expires ${expiresAt.toISOString()})`);

    res.status(201).json({
      message: "User created successfully. Verification email sent.",
      user: data,
    });
  } catch (err) {
    console.error("createUser error:", err);
    next(err);
  }
}

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



export async function listUsers(req, res, next) {
  try {
    const query = {};
    if (req.user.role === ROLES.SUPER_ADMIN) {
      if (req.query.agencyId) query.agency = req.query.agencyId;
    } else {
      query.agency = req.user.agency;
    }
    const users = await User.find(query).select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) { next(err); }
}

export async function updateUser(req, res, next) {
  try {
    const { id } = req.params;
    const update = (({ name, role, isActive }) => ({ name, role, isActive }))(req.body);
    // prevent role escalation
    if (update.role === ROLES.SUPER_ADMIN && req.user.role !== ROLES.SUPER_ADMIN) {
      return res.status(403).json({ message: 'Cannot elevate to SUPER_ADMIN' });
    }
    let user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (req.user.role !== ROLES.SUPER_ADMIN && user.agency?.toString() !== req.user.agency?.toString()) {
      return res.status(403).json({ message: 'Cross-agency modification denied' });
    }
    user.set(update);
    await user.save();
    const data = user.toObject(); delete data.password;
    res.json(data);
  } catch (err) { next(err); }
}

export async function deleteUser(req, res, next) {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (req.user.role !== ROLES.SUPER_ADMIN && user.agency?.toString() !== req.user.agency?.toString()) {
      return res.status(403).json({ message: 'Cross-agency deletion denied' });
    }
    await user.deleteOne();
    res.json({ message: 'User deleted' });
  } catch (err) { next(err); }
}

