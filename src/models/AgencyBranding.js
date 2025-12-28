import mongoose from "mongoose";

const AgencyBrandingSchema = new mongoose.Schema(
  {
    agencyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agency",
      required: true,
      unique: true,
      index: true,
    },

    logoUrl: { type: String, default: null },

    primaryColor: { type: String, default: "#0B5FFF" },
    secondaryColor: { type: String, default: "#111827" },

    footerText: { type: String, default: "" },
    contactPhone: { type: String, default: "" },
    contactEmail: { type: String, default: "" },
    website: { type: String, default: "" },

    language: { type: String, enum: ["EN", "SO", "AM"], default: "EN" },
    paperSize: { type: String, enum: ["A4", "LETTER"], default: "A4" },
  },
  { timestamps: true }
);

AgencyBrandingSchema.index({ agencyId: 1 }, { unique: true });

export default mongoose.model("AgencyBranding", AgencyBrandingSchema);
