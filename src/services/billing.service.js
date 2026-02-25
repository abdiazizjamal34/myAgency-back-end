// import Usage from "../models/Usage.js";
// import Invoice from "../models/Invoice.js";
// import BillingSettings from "../models/BillingSettings.js";
// import { getPeriodKey, getPreviousMonthDate, dueDateForCurrentMonth, getMonthStart, getMonthEnd } from "../utils/billingPeriod.js";
// import Plan from "../models/Plan.js";
// import Agency from "../models/Agency.js";
// // ...other imports

// // helper for money rounding
// function round2(n) {
//     return Math.round((n + Number.EPSILON) * 100) / 100;
// }

// export async function generateMonthlyInvoicesForAllAgencies({ sendEmailFn }) {
//     const now = new Date();
//     const periodKey = previousMonthKey(now);

//     const agencies = await Agency.find({}, { _id: 1, name: 1, email: 1, billingPlan: 1 }).lean();

//     for (const agency of agencies) {
//         const existing = await Invoice.findOne({ agencyId: agency._id, periodKey });
//         if (existing) continue;

//         const usage = await Usage.findOne({ agencyId: agency._id, periodKey });
//         const used = usage?.recordsCreated || 0;

//         // If you want to bill even when used=0 (base monthly fee), set this to true.
//         const BILL_ZERO_USAGE = true;

//         // Load plan
//         const plan = agency.billingPlan
//             ? await Plan.findById(agency.billingPlan).lean()
//             : await Plan.findOne({ name: "LEVEL_1" }).lean();

//         if (!plan) throw new Error("No billing plan found");

//         const included = plan.includedRecords;
//         const overage = Math.max(0, used - included);

//         const base = plan.monthlyFee;
//         const overageAmount = overage * plan.overagePrice;
//         const amount = round2(base + overageAmount);

//         // if (!BILL_ZERO_USAGE && used === 0) continue;

//         const invoice = await Invoice.create({
//             agencyId: agency._id,
//             periodKey,
//             recordsBilled: used,
//             unitPrice: plan.overagePrice, // keep for reference
//             currency: plan.currency || "ETB",
//             amount,
//             status: "unpaid",
//             issuedAt: now,
//             dueAt: dueDateForCurrentMonth(now),
//             // optional: store breakdown (recommended)
//             breakdown: {
//                 planName: plan.name,
//                 planTitle: plan.title,
//                 includedRecords: included,
//                 monthlyFee: base,
//                 overageRecords: overage,
//                 overagePrice: plan.overagePrice,
//                 overageAmount: round2(overageAmount),
//             },
//         });

//         // lock usage
//         if (usage) {
//             usage.locked = true;
//             await usage.save();
//         }

//         // email
//         if (sendEmailFn && agency.email) {
//             await sendEmailFn({
//                 to: agency.email,
//                 subject: `ProfitMate Bill - ${periodKey} (Due 16th)`,
//                 html: `
//           <p>Hello ${agency.name || ""},</p>
//           <p>Your monthly bill is ready for <b>${periodKey}</b>.</p>
//           <ul>
//             <li><b>Plan:</b> ${plan.title} (${plan.name})</li>
//             <li><b>Included records:</b> ${included}</li>
//             <li><b>Used records:</b> ${used}</li>
//             <li><b>Overage records:</b> ${overage}</li>
//             <li><b>Base fee:</b> ${base} ${plan.currency}</li>
//             <li><b>Overage:</b> ${round2(overageAmount)} ${plan.currency} (${plan.overagePrice} each)</li>
//             <li><b>Total:</b> ${amount} ${plan.currency}</li>
//             <li><b>Due date:</b> ${invoice.dueAt.toDateString()}</li>
//           </ul>
//           <p>Unpaid bills will put the account in <b>read-only</b> from the <b>17th</b>.</p>
//         `,
//             });
//         }
//     }
// }


import Agency from "../models/Agency.js";
import Invoice from "../models/Invoice.js";
import Usage from "../models/Usage.js";
import Plan from "../models/Plan.js";
import BillingEmailLog from "../models/BillingEmailLog.js";
import { sendMail } from "../utils/mailer.js";
import { previousMonthKey, dueDateForCurrentMonth } from "../utils/billingPeriod.js";

function money(n) {
    return Number(n || 0).toLocaleString();
}

function invoiceEmailHtml({ agencyName, invoice, plan, appUrl }) {
    const b = invoice.breakdown || {};
    return `
  <div style="font-family: Arial, sans-serif; line-height:1.5">
    <h2>ProfitMate Invoice: ${invoice.periodKey}</h2>
    <p>Hello ${agencyName || "Agency"},</p>
    <p>Your monthly invoice has been generated.</p>

    <div style="padding:12px;border:1px solid #eee;border-radius:10px">
      <p><b>Plan:</b> ${b.planTitle || plan?.title || plan?.name}</p>
      <p><b>Included records:</b> ${b.includedRecords ?? plan?.includedRecords ?? 0}</p>
      <p><b>Records used:</b> ${invoice.recordsBilled ?? 0}</p>
      <p><b>Monthly fee:</b> ${money(b.monthlyFee)} ${invoice.currency}</p>
      <p><b>Overage records:</b> ${b.overageRecords ?? 0}</p>
      <p><b>Overage amount:</b> ${money(b.overageAmount)} ${invoice.currency}</p>
      <hr/>
      <p style="font-size:18px"><b>Total:</b> ${money(invoice.amount)} ${invoice.currency}</p>
      <p><b>Due date:</b> ${new Date(invoice.dueAt).toLocaleDateString()}</p>
    </div>

    <p style="margin-top:14px">
      Open Billing Dashboard:
      <a href="${appUrl}/billing">${appUrl}/billing</a>
    </p>
    <p>If you already paid, please submit your transaction reference in the dashboard.</p>
    <p>— ProfitMate</p>
  </div>`;
}

async function safeSendOnce({ agencyId, invoiceId, type, to, subject, html }) {
    // prevent duplicates
    const already = await BillingEmailLog.findOne({ invoiceId, type }).lean();
    if (already) return { skipped: true };

    await sendMail({ to, subject, html, text: subject });

    await BillingEmailLog.create({ agencyId, invoiceId, type });
    return { sent: true };
}

/**
 * Runs on day 1: generate previous month invoice for each agency
 */
export async function generateMonthlyInvoicesAndEmail({ now = new Date() } = {}) {
    const periodKey = previousMonthKey(now);

    const agencies = await Agency.find({ isActive: { $ne: false } })
        .select("name email billingPlan ownerEmail") // adapt to your schema
        .lean();

    let createdCount = 0;
    let emailedCount = 0;

    for (const agency of agencies) {
        const agencyId = agency._id;

        // Plan
        const plan = agency.billingPlan
            ? await Plan.findById(agency.billingPlan).lean()
            : await Plan.findOne({ name: "LEVEL_1" }).lean();

        if (!plan) continue;

        // Usage
        const usage = await Usage.findOne({ agencyId, periodKey }).lean();
        const used = usage?.recordsCreated || 0;

        const included = plan.includedRecords;
        const overage = Math.max(0, used - included);
        const base = plan.monthlyFee;
        const overageAmount = overage * plan.overagePrice;
        const amount = base + overageAmount;

        // Create invoice if not exists
        let invoice = await Invoice.findOne({ agencyId, periodKey }).lean();
        if (!invoice) {
            invoice = await Invoice.create({
                agencyId,
                periodKey,
                recordsBilled: used,
                unitPrice: plan.overagePrice,
                currency: plan.currency || "ETB",
                amount,
                status: "unpaid",
                issuedAt: now,
                dueAt: dueDateForCurrentMonth(now),
                breakdown: {
                    planName: plan.name,
                    planTitle: plan.title,
                    includedRecords: included,
                    monthlyFee: base,
                    overageRecords: overage,
                    overagePrice: plan.overagePrice,
                    overageAmount,
                },
            });
            createdCount++;
        }

        // Email invoice
        const to = agency.email || agency.ownerEmail;
        if (to) {
            const appUrl = process.env.APP_BASE_URL || "";
            const html = invoiceEmailHtml({ agencyName: agency.name, invoice, plan, appUrl });
            const r = await safeSendOnce({
                agencyId,
                invoiceId: invoice._id,
                type: "invoice_issued",
                to,
                subject: `ProfitMate Invoice ${periodKey} — ${money(invoice.amount)} ${invoice.currency}`,
                html,
            });
            if (r?.sent) emailedCount++;
        }
    }

    return { periodKey, createdCount, emailedCount };
}

/**
 * Runs daily: send reminders based on due date and read-only date logic.
 * - Day 13 reminder
 * - Day 16 final notice
 * - Day 17 read-only warning (your guard enforces it)
 */
export async function sendDailyBillingReminders({ now = new Date() } = {}) {
    const day = now.getDate(); // local TZ (set TZ env)
    const unpaidInvoices = await Invoice.find({ status: "unpaid" }).lean();

    let sent = 0;
    for (const inv of unpaidInvoices) {
        const agency = await Agency.findById(inv.agencyId).select("name email ownerEmail").lean();
        if (!agency) continue;

        const to = agency.email || agency.ownerEmail;
        if (!to) continue;

        // Choose reminder type based on day-of-month
        let type = null;
        let subject = null;
        let message = null;

        if (day === 13) {
            type = "reminder_13";
            subject = `Reminder: ProfitMate invoice ${inv.periodKey} is due soon`;
            message = `Your invoice is due on ${new Date(inv.dueAt).toLocaleDateString()}. Please pay to avoid read-only.`;
        } else if (day === 16) {
            type = "due_16";
            subject = `Final Notice: ProfitMate invoice ${inv.periodKey} due today`;
            message = `Your invoice is due today. Please pay to avoid account restrictions.`;
        } else if (day >= 17) {
            type = "locked_17";
            subject = `Account restricted: ProfitMate invoice ${inv.periodKey} unpaid`;
            message = `Your account is now in read-only mode until payment is approved.`;
        } else {
            continue;
        }

        const appUrl = process.env.APP_BASE_URL || "";
        const html = `
      <div style="font-family: Arial, sans-serif; line-height:1.5">
        <h3>${subject}</h3>
        <p>Hello ${agency.name || "Agency"},</p>
        <p>${message}</p>
        <p><b>Invoice:</b> ${inv.periodKey} · <b>Total:</b> ${money(inv.amount)} ${inv.currency}</p>
        <p>Open Billing Dashboard: <a href="${appUrl}/billing">${appUrl}/billing</a></p>
        <p>— ProfitMate</p>
      </div>
    `;

        const r = await safeSendOnce({
            agencyId: agency._id,
            invoiceId: inv._id,
            type,
            to,
            subject,
            html,
        });
        if (r?.sent) sent++;
    }

    return { day, sent };
}