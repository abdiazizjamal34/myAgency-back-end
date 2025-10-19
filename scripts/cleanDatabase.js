// scripts/cleanDatabase.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import Agency from "../src/models/Agency.js";
import Record from "../src/models/Record.js";
import User from "../src/models/User.js";
import Otp from "../src/models/Otp.js";

dotenv.config(); // load .env file

const MONGO_URI = process.env.MONGO_URI;

(async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Find all SUPER_ADMIN users
    const superAdmins = await User.find({ role: "SUPER_ADMIN" });
    console.log(`Found ${superAdmins.length} Super Admin(s)`);

    const superAdminIds = superAdmins.map((u) => u._id);

    // Delete all other users except Super Admins
    const deletedUsers = await User.deleteMany({ _id: { $nin: superAdminIds } });
    console.log(`🗑️ Deleted ${deletedUsers.deletedCount} non-superadmin users`);

    // Clean all other collections
    const deletedAgencies = await Agency.deleteMany({});
    const deletedRecords = await Record.deleteMany({});
    const deletedOtps = await Otp.deleteMany({});

    console.log(`🗑️ Agencies deleted: ${deletedAgencies.deletedCount}`);
    console.log(`🗑️ Records deleted: ${deletedRecords.deletedCount}`);
    console.log(`🗑️ OTPs deleted: ${deletedOtps.deletedCount}`);

    console.log("🎯 Clean-up complete. Only SUPER_ADMIN data remains.");
    await mongoose.disconnect();
  } catch (err) {
    console.error("❌ Error during cleanup:", err);
  }
})();
