import express from "express";
import { requireRole } from "../middleware/roles.js";
import { ROLES } from "../utils/constants.js";
import { generateMonthlyInvoicesAndEmail, sendDailyBillingReminders } from "../services/billingJobs.service.js";

const router = express.Router();

// Trigger monthly invoice generation manually
router.post(
    "/billing/run-monthly",
    requireRole(ROLES.SUPER_ADMIN),
    async (req, res, next) => {
        try {
            console.log("🚀 Manually triggering monthly invoice generation");
            const result = await generateMonthlyInvoicesAndEmail();
            res.json({ message: "Monthly invoices job completed", result });
        } catch (e) {
            console.error("❌ Manual monthly job failed:", e);
            res.status(500).json({ message: "Job failed", error: e.message });
        }
    }
);

// Trigger daily reminders manually
router.post(
    "/billing/run-daily",
    requireRole(ROLES.SUPER_ADMIN),
    async (req, res, next) => {
        try {
            console.log("🚀 Manually triggering daily billing reminders");
            const result = await sendDailyBillingReminders();
            res.json({ message: "Daily reminders job completed", result });
        } catch (e) {
            console.error("❌ Manual daily job failed:", e);
            res.status(500).json({ message: "Job failed", error: e.message });
        }
    }
);

export default router;
