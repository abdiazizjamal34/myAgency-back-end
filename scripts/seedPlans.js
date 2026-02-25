import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../src/utils/db.js";
import Plan from "../src/models/Plan.js";

dotenv.config();

async function run() {
    await connectDB();

    const plans = [
        {
            name: "Level_0",
            title: "Level 0",
            currency: "ETB",
            includedRecords: 15,
            monthlyFee: 0,
            overagePrice: 50,
            isActive: true,
        },
        {
            name: "LEVEL_1",
            title: "Level 1",
            currency: "ETB",
            includedRecords: 100,
            monthlyFee: 1750,
            overagePrice: 35,
        },
        {
            name: "LEVEL_2",
            title: "Level 2",
            currency: "ETB",
            includedRecords: 200,
            monthlyFee: 4500,
            overagePrice: 35,
        },
        {
            name: "LEVEL_3",
            title: "Level 3",
            currency: "ETB",
            includedRecords: 300,
            monthlyFee: 7250,
            overagePrice: 35,
        },
    ];

    for (const p of plans) {
        await Plan.updateOne({ name: p.name }, { $set: p }, { upsert: true });
    }

    console.log("✅ Plans seeded/updated");
    await mongoose.disconnect();
}

run().catch((e) => {
    console.error(e);
    process.exit(1);
});
