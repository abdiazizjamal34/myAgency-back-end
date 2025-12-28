import mongoose from "mongoose";

const AgencySettingsSchema = new mongoose.Schema(
  {
    agencyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agency",
      required: true,
      unique: true,
      index: true,
    },

    ticketTemplateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TicketTemplate",
      required: true,
      index: true,
    },

    // MVP toggles (optional but useful)
    showFare: { type: Boolean, default: true },
    showBaggage: { type: Boolean, default: true },
    showNotes: { type: Boolean, default: true },
  },
  { timestamps: true }
);

AgencySettingsSchema.index({ agencyId: 1 }, { unique: true });

export default mongoose.model("AgencySettings", AgencySettingsSchema);
