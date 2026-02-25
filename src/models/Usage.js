import mongoose from "mongoose";

const usageSchema = new mongoose.Schema(
  {
    agencyId: { type: mongoose.Schema.Types.ObjectId, ref: "Agency", required: true, index: true },
    periodKey: { type: String, required: true, index: true }, // "YYYY-MM"
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },

    recordsCreated: { type: Number, default: 0 },
    lastRecordAt: { type: Date },

    locked: { type: Boolean, default: false }, // locked after invoice generated
  },
  { timestamps: true }
);

usageSchema.index({ agencyId: 1, periodKey: 1 }, { unique: true });

export default mongoose.model("Usage", usageSchema);
