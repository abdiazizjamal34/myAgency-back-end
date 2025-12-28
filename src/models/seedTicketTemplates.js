import mongoose from "mongoose";
import dotenv from "dotenv";
import TicketTemplate from "./TicketTemplate.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

async function run() {
  await mongoose.connect(MONGO_URI);

  const templates = [
    { name: "Modern A", key: "modern_a", type: "PREMADE", schemaJson: { layout: "A" } },
    { name: "Compact B", key: "compact_b", type: "PREMADE", schemaJson: { layout: "B" } },
    { name: "Invoice C", key: "invoice_c", type: "PREMADE", schemaJson: { layout: "C" } },
  ];

  for (const t of templates) {
    await TicketTemplate.updateOne({ key: t.key }, { $set: t }, { upsert: true });
  }

  console.log("✅ Ticket templates seeded");
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
