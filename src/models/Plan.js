import mongoose from "mongoose";

const planSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true }, // "LEVEL_1"
    title: { type: String, required: true },              // "Level 1"
    currency: { type: String, default: "ETB" },

    includedRecords: { type: Number, required: true },    // 100/200/300
    monthlyFee: { type: Number, required: true },         // 1750/4500/7250
    overagePrice: { type: Number, required: true },       // 35 per record

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.models.Plan || mongoose.model("Plan", planSchema);
