import mongoose from "mongoose";

const AirportPointSchema = new mongoose.Schema(
  {
    city: { type: String, default: "" },
    airport: { type: String, default: "" },   // "ADD", "DXB"
    terminal: { type: String, default: "" },
  },
  { _id: false }
);

const SegmentSchema = new mongoose.Schema(
  {
    segmentNo: { type: Number, default: 1 },
    flightNo: { type: String, default: "" },   // "ET625"

    from: { type: AirportPointSchema, default: {} },
    to: { type: AirportPointSchema, default: {} },

    departure: { type: String, default: "" },  // ISO string
    arrival: { type: String, default: "" },    // ISO string

    cabin: { type: String, default: "" },      // "ECONOMY"
    bookingClass: { type: String, default: "" }, // "Y"
    baggage: { type: String, default: "" },    // "2PC"
    seat: { type: String, default: "" },
  },
  { _id: false }
);

const FareBreakdownSchema = new mongoose.Schema(
  {
    code: { type: String, default: "" },       // "XT", "YQ"
    amount: { type: Number, default: 0 },
  },
  { _id: false }
);

const TicketDocumentSchema = new mongoose.Schema(
  {
    agencyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agency",
      required: true,
      index: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    rendered: {
      pdfUrl: { type: String, default: "" },   // /uploads/rendered/xxx.pdf
      renderedAt: { type: Date, default: null },
    },

    source: {
      fileType: { type: String, enum: ["PDF", "JPG", "PNG"], required: true },
      fileUrl: { type: String, required: true },

      rawTextStored: { type: Boolean, default: false },
      rawText: { type: String, default: "" }, // optional storage

      extractionConfidence: { type: Number, default: 0 },
    },

    airline: {
      name: { type: String, default: "" },
      iata: { type: String, default: "" },
      icao: { type: String, default: "" },
    },

    ticket: {
      ticketNumber: { type: String, default: "" }, // string (keep leading zeros)
      pnr: { type: String, default: "" },
      issueDate: { type: String, default: "" },    // "YYYY-MM-DD" or ISO

      issuingOffice: { type: String, default: "" },
      status: {
        type: String,
        enum: ["ISSUED", "VOID", "REFUNDED", "UNKNOWN"],
        default: "UNKNOWN",
      },
    },

    passenger: {
      fullName: { type: String, default: "" },
      type: { type: String, enum: ["ADT", "CHD", "INF", "UNKNOWN"], default: "UNKNOWN" },
      passportNumber: { type: String, default: "" },
      nationality: { type: String, default: "" },
    },

    itinerary: { type: [SegmentSchema], default: [] },

    fare: {
      currency: { type: String, default: "" },
      base: { type: Number, default: 0 },
      taxes: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
      breakdown: { type: [FareBreakdownSchema], default: [] },
    },

    notes: { type: [String], default: [] },

    processingStatus: {
      type: String,
      enum: ["UPLOADED", "EXTRACTED", "NORMALIZED", "NEEDS_REVIEW", "READY"],
      default: "UPLOADED",
      index: true,
    },
  },
  { timestamps: true }
);

// Helpful indexes
TicketDocumentSchema.index({ agencyId: 1, createdAt: -1 });
TicketDocumentSchema.index({ agencyId: 1, "ticket.ticketNumber": 1 });
TicketDocumentSchema.index({ agencyId: 1, "ticket.pnr": 1 });

export default mongoose.model("TicketDocument", TicketDocumentSchema);
