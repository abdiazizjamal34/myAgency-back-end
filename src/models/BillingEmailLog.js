import mongoose from "mongoose";

const BillingEmailLogSchema = new mongoose.Schema(
    {
        agencyId: { type: mongoose.Schema.Types.ObjectId, ref: "Agency", required: true, index: true },
        invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice", required: true, index: true },
        type: {
            type: String,
            enum: ["invoice_issued", "reminder_13", "due_16", "locked_17"],
            required: true,
            index: true,
        },
        sentAt: { type: Date, default: Date.now },
    },
    { timestamps: true }
);

BillingEmailLogSchema.index({ invoiceId: 1, type: 1 }, { unique: true });

export default mongoose.models.BillingEmailLog || mongoose.model("BillingEmailLog", BillingEmailLogSchema);