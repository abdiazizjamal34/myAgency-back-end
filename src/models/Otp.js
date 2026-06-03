import mongoose from "mongoose";

const OtpSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  code: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  verified: { type: Boolean, default: false },
  purpose: {
    type: String,
    enum: ['password_reset', 'email_verification'],
    required: true,
  },
  resetToken: { type: String },
  resetTokenExpiresAt: { type: Date },
});

export default mongoose.model("Otp", OtpSchema);
