import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import User from '../models/User.js';
import { validationResult } from 'express-validator';
dotenv.config();

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
      user.password = await bcrypt.hash(newPassword, 10);
      await user.save();
      return res.json({ message: 'Password updated successfully' });
    }

    // Self password change: requires currentPassword and newPassword
    if (!currentPassword || !newPassword) return res.status(400).json({ message: 'currentPassword and newPassword are required' });
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Current password is incorrect' });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    next(err);
  }
}
