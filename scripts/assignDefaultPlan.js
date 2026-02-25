// import dotenv from "dotenv";
// import mongoose from "mongoose";
// import connectDB from "../utils/db.js";
// import Plan from "../models/Plan.js";
// import Agency from "../models/Agency.js";

import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../src/utils/db.js";
import Plan from "../src/models/Plan.js";
import Agency from "../src/models/Agency.js";

dotenv.config();

async function run() {
    await connectDB();

    const level1 = await Plan.findOne({ name: "LEVEL_1" });
    if (!level1) throw new Error("LEVEL_1 plan not found. Run seed:plans first.");

    const result = await Agency.updateMany(
        { billingPlan: { $exists: false } },
        { $set: { billingPlan: level1._id } }
    );

    console.log("✅ Default plan assigned to agencies:", result.modifiedCount);
    await mongoose.disconnect();
}

run().catch((e) => {
    console.error(e);
    process.exit(1);
});