import cron from "node-cron";
import { generateMonthlyInvoicesAndEmail, sendDailyBillingReminders } from "../services/billingJobs.service.js";

export function startBillingCron() {
  const enabled = String(process.env.BILLING_JOBS_ENABLED || "true").toLowerCase() === "true";
  if (!enabled) {
    console.log("🟡 Billing cron disabled (BILLING_JOBS_ENABLED=false)");
    return;
  }

  // 1) Monthly: 1st day of month at 08:00
  cron.schedule("0 8 1 * *", async () => {
    try {
      const r = await generateMonthlyInvoicesAndEmail({ now: new Date() });
      console.log("✅ Monthly invoices generated:", r);
    } catch (e) {
      console.error("❌ Monthly invoice job failed:", e);
    }
  });

  // 2) Daily reminders: every day at 09:00
  cron.schedule("0 9 * * *", async () => {
    try {
      const r = await sendDailyBillingReminders({ now: new Date() });
      console.log("✅ Daily billing reminders:", r);
    } catch (e) {
      console.error("❌ Daily reminder job failed:", e);
    }
  });

  console.log("✅ Billing cron started (TZ:", process.env.TZ || "system", ")");
}