import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
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
