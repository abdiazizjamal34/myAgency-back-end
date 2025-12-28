import mongoose from "mongoose";
import Agency from "../src/models/Agency.js"; // your existing model
import TicketTemplate from "../src/models/TicketTemplate.js";
import AgencyBranding from "../src/models/AgencyBranding.js";
import AgencySettings from "../src/models/AgencySettings.js";

const MONGO_URI = process.env.MONGO_URI;

async function run() {
  await mongoose.connect(MONGO_URI);

  const defaultTemplate = await TicketTemplate.findOne({ key: "modern_a", isActive: true });
  if (!defaultTemplate) throw new Error("Default template modern_a not found. Seed templates first.");

  const agencies = await Agency.find({});
  for (const agency of agencies) {
    await AgencyBranding.updateOne(
      { agencyId: agency._id },
      { $setOnInsert: { agencyId: agency._id } },
      { upsert: true }
    );

    await AgencySettings.updateOne(
      { agencyId: agency._id },
      { $setOnInsert: { agencyId: agency._id, ticketTemplateId: defaultTemplate._id } },
      { upsert: true }
    );
  }

  console.log(`✅ Initialized branding/settings for ${agencies.length} agencies`);
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
