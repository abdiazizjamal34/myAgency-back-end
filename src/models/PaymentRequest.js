import mongoose from "mongoose";

const paymentRequestSchema = new mongoose.Schema(
  {
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice", required: true, index: true },
    agencyId: { type: mongoose.Schema.Types.ObjectId, ref: "Agency", required: true, index: true },

    // user who submitted
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    amount: { type: Number, required: true },
    currency: { type: String, default: "ETB" },

    method: { type: String, default: "bank_transfer" }, // bank_transfer, cash, etc.
    transactionRef: { type: String, trim: true },       // e.g. CBE reference
    note: { type: String, trim: true },

    // store receipt file path if uploaded
    receiptUrl: { type: String },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },

    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    adminNote: { type: String, trim: true },
  },
  { timestamps: true }
);

export default mongoose.models.PaymentRequest ||
  mongoose.model("PaymentRequest", paymentRequestSchema);