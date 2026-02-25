import mongoose from "mongoose";

const billingSettingsSchema = new mongoose.Schema(
  {
    agencyId: { type: mongoose.Schema.Types.ObjectId, ref: "Agency", required: true, unique: true },
    unitPrice: { type: Number, default: 0.02 },
    currency: { type: String, default: "USD" },

    // future: tiers, discounts, etc.
  },
  { timestamps: true }
);

export default mongoose.model("BillingSettings", billingSettingsSchema);
