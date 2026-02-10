import mongoose from "mongoose";

const NotificationHistorySchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    recipients: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        channel: { type: String, enum: ["email", "whatsapp", "both", "pop"] },
        status: { type: String, enum: ["sent", "failed"], default: "sent" },
      },
    ],

    channel: {
      type: String,
      enum: ["email", "whatsapp", "both", "pop"],
      required: true,
    },

    subject: { type: String },
    message: { type: String, required: true },

    scope: {
      type: String,
      enum: ["single", "broadcast", "agency"],
      required: true,
    },

    agency: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agency",
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model("NotificationHistory", NotificationHistorySchema);
