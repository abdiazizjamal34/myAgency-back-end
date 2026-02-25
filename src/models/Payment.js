import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice", required: true, index: true },
    agencyId: { type: mongoose.Schema.Types.ObjectId, ref: "Agency", required: true, index: true },

    provider: { type: String, enum: ["manual", "chapa", "stripe"], default: "manual" },
    providerRef: { type: String },
    amount: { type: Number, required: true },
    currency: { type: String, default: "USD" },
    status: { type: String, enum: ["pending", "succeeded", "failed"], default: "succeeded" },

    metadata: { type: Object },
  },
  { timestamps: true }
);

export default mongoose.model("Payment", paymentSchema);
