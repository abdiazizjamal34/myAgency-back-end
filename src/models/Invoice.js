import mongoose from "mongoose";

const invoiceSchema = new mongoose.Schema(
  {
    agencyId: { type: mongoose.Schema.Types.ObjectId, ref: "Agency", required: true, index: true },
    periodKey: { type: String, required: true, index: true }, // month being billed, e.g. "2026-02"
    invoiceNumber: { type: String, unique: true, index: true },
    recordsBilled: { type: Number, required: true },
    unitPrice: { type: Number, required: true }, // e.g. 0.02
    currency: { type: String, default: "USD" },

    amount: { type: Number, required: true }, // recordsBilled * unitPrice
    status: { type: String, enum: ["unpaid", "paid", "void"], default: "unpaid", index: true },

    issuedAt: { type: Date, required: true },
    dueAt: { type: Date, required: true },
    paidAt: { type: Date },
  },
  { timestamps: true }
);

invoiceSchema.index({ agencyId: 1, periodKey: 1 }, { unique: true });

export default mongoose.model("Invoice", invoiceSchema);
