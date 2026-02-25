import Agency from "../models/Agency.js";
import Invoice from "../models/Invoice.js";
import Usage from "../models/Usage.js";
import Plan from "../models/Plan.js";
import BillingEmailLog from "../models/BillingEmailLog.js";
import { sendMail } from "../utils/mailer.js";
import { previousMonthKey, dueDateForCurrentMonth } from "../utils/billingPeriod.js";
import User from "../models/User.js";

function money(n) {
    return Number(n || 0).toLocaleString();
}


async function getBillingRecipientsForAgency(agencyId) {
    // Primary: AGENCY_ADMIN users
    const admins = await User.find({
        agency: agencyId,
        role: "AGENCY_ADMIN",
        isActive: true,
    })
        .select("email name")
        .lean();

    // fallback: any active user in agency if no agency admin exists
    if (!admins.length) {
        const anyUser = await User.findOne({ agency: agencyId, isActive: true })
            .select("email name")
            .lean();
        return anyUser?.email ? [anyUser.email] : [];
    }

    return admins.map((u) => u.email).filter(Boolean);
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
            const invoiceCount = await Invoice.countDocuments();
            const invoiceNumber = `PM-${periodKey}-${String(invoiceCount + 1).padStart(5, "0")}`;
            invoice = await Invoice.create({
                invoiceNumber,
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
        // const to = agency.email || agency.ownerEmail;
        // if (to) {
        //     const appUrl = process.env.APP_BASE_URL || "";
        //     const html = invoiceEmailHtml({ agencyName: agency.name, invoice, plan, appUrl });
        //     const r = await safeSendOnce({
        //         agencyId,
        //         invoiceId: invoice._id,
        //         type: "invoice_issued",
        //         to,
        //         subject: `ProfitMate Invoice ${periodKey} — ${money(invoice.amount)} ${invoice.currency}`,
        //         html,
        //     });
        //     if (r?.sent) emailedCount++;
        // }

        const recipients = await getBillingRecipientsForAgency(agencyId);

        if (!recipients.length) {
            console.log("🟡 No billing email recipients found for agency:", agency.name, agencyId);
            continue;
        }

        const appUrl = process.env.APP_BASE_URL || "";
        const html = invoiceEmailHtml({ agencyName: agency.name, invoice, plan, appUrl });

        for (const to of recipients) {
            const r = await safeSendOnce({
                agencyId,
                invoiceId: invoice._id,
                type: "invoice_issued",
                to,
                subject: `ProfitMate Invoice ${periodKey} — ${Number(invoice.amount || 0).toLocaleString()} ${invoice.currency}`,
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
    const day = now.getDate(); // relies on TZ env
    const unpaidInvoices = await Invoice.find({ status: "unpaid" }).lean();

    let sent = 0;

    for (const inv of unpaidInvoices) {
        const agency = await Agency.findById(inv.agencyId).select("name").lean();
        if (!agency) continue;

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
            continue; // not a reminder day
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

        const recipients = await getBillingRecipientsForAgency(inv.agencyId);
        if (!recipients.length) continue;

        for (const to of recipients) {
            const r = await safeSendOnce({
                agencyId: inv.agencyId,
                invoiceId: inv._id,
                type,
                to,
                subject,
                html,
            });
            if (r?.sent) sent++;
        }
    }

    return { day, sent };
}

// export async function sendDailyBillingReminders({ now = new Date() } = {}) {
//     const day = now.getDate(); // local TZ (set TZ env)
//     const unpaidInvoices = await Invoice.find({ status: "unpaid" }).lean();

//     let sent = 0;
//     for (const inv of unpaidInvoices) {
//         // const agency = await Agency.findById(inv.agencyId).select("name email ownerEmail").lean();
//         // if (!agency) continue;

//         // const to = agency.email || agency.ownerEmail;
//         // if (!to) continue;


//         const agency = await Agency.findById(inv.agencyId).select("name").lean();
//         if (!agency) continue;

//         const recipients = await getBillingRecipientsForAgency(inv.agencyId);
//         if (!recipients.length) continue;

//         for (const to of recipients) {
//             const r = await safeSendOnce({
//                 agencyId: inv.agencyId,
//                 invoiceId: inv._id,
//                 type,
//                 to,
//                 subject,
//                 html,
//             });
//             if (r?.sent) sent++;
//         }

//         // Choose reminder type based on day-of-month
//         let type = null;
//         let subject = null;
//         let message = null;

//         if (day === 13) {
//             type = "reminder_13";
//             subject = `Reminder: ProfitMate invoice ${inv.periodKey} is due soon`;
//             message = `Your invoice is due on ${new Date(inv.dueAt).toLocaleDateString()}. Please pay to avoid read-only.`;
//         } else if (day === 16) {
//             type = "due_16";
//             subject = `Final Notice: ProfitMate invoice ${inv.periodKey} due today`;
//             message = `Your invoice is due today. Please pay to avoid account restrictions.`;
//         } else if (day >= 17) {
//             type = "locked_17";
//             subject = `Account restricted: ProfitMate invoice ${inv.periodKey} unpaid`;
//             message = `Your account is now in read-only mode until payment is approved.`;
//         } else {
//             continue;
//         }

//         const appUrl = process.env.APP_BASE_URL || "";
//         const html = `
//       <div style="font-family: Arial, sans-serif; line-height:1.5">
//         <h3>${subject}</h3>
//         <p>Hello ${agency.name || "Agency"},</p>
//         <p>${message}</p>
//         <p><b>Invoice:</b> ${inv.periodKey} · <b>Total:</b> ${money(inv.amount)} ${inv.currency}</p>
//         <p>Open Billing Dashboard: <a href="${appUrl}/billing">${appUrl}/billing</a></p>
//         <p>— ProfitMate</p>
//       </div>
//     `;

//         const r = await safeSendOnce({
//             agencyId: agency._id,
//             invoiceId: inv._id,
//             type,
//             to,
//             subject,
//             html,
//         });
//         if (r?.sent) sent++;
//     }

//     return { day, sent };
// } 