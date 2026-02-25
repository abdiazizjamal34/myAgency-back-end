import express from "express";
import Invoice from "../models/Invoice.js";
import Usage from "../models/Usage.js";
import Agency from "../models/Agency.js";
import { getPeriodKey, getMonthStart, getMonthEnd, previousMonthKey, dueDateForCurrentMonth } from "../utils/billingPeriod.js";
import Plan from "../models/Plan.js";
import { ROLES } from "../utils/constants.js";
import PaymentRequest from "../models/PaymentRequest.js";
import { uploadReceipt } from "../middleware/uploadReceipt.js";

const router = express.Router();


router.get("/plans", async (req, res, next) => {
    try {
        const plans = await Plan.find({ isActive: true }).sort({ includedRecords: 1 }).lean();
        res.json({ plans });
    } catch (e) { next(e); }
});

import Record from "../models/Record.js"; // ✅ add at top

router.get("/usage/daily", async (req, res, next) => {
    try {
        const agencyId = req.user.agency;
        const now = new Date();
        const periodKey = req.query.periodKey || getPeriodKey(now);

        const [yearStr, monthStr] = String(periodKey).split("-");
        const year = Number(yearStr);
        const monthIndex = Number(monthStr) - 1; // 0-11

        const start = new Date(year, monthIndex, 1, 0, 0, 0, 0);
        const end = new Date(year, monthIndex + 1, 1, 0, 0, 0, 0);

        // group records by day
        const rows = await Record.aggregate([
            { $match: { agency: agencyId, createdAt: { $gte: start, $lt: end } } },
            {
                $group: {
                    _id: {
                        y: { $year: "$createdAt" },
                        m: { $month: "$createdAt" },
                        d: { $dayOfMonth: "$createdAt" },
                    },
                    count: { $sum: 1 },
                },
            },
            { $sort: { "_id.y": 1, "_id.m": 1, "_id.d": 1 } },
        ]);

        // normalize for frontend chart
        const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
        const daily = Array.from({ length: daysInMonth }, (_, i) => ({
            day: i + 1,
            count: 0,
        }));

        for (const r of rows) {
            const day = r._id.d;
            if (daily[day - 1]) daily[day - 1].count = r.count;
        }

        res.json({ periodKey, start, end, daily });
    } catch (e) {
        next(e);
    }
});



// POST /api/billing/payment-requests
// FormData: invoiceId, transactionRef, note, (optional) receipt file
router.post("/payment-requests", uploadReceipt.single("receipt"), async (req, res, next) => {
  try {
    const agencyId = req.user.agency;

    const { invoiceId, transactionRef, note, method } = req.body || {};
    if (!invoiceId) return res.status(400).json({ message: "invoiceId is required" });

    const invoice = await Invoice.findOne({ _id: invoiceId, agencyId });
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    if (invoice.status === "paid") {
      return res.status(400).json({ message: "Invoice is already paid" });
    }

    // prevent multiple pending requests for same invoice
    const existing = await PaymentRequest.findOne({ invoiceId, status: "pending" });
    if (existing) {
      return res.status(400).json({ message: "A payment request is already pending for this invoice" });
    }

    const receiptUrl = req.file ? `/uploads/receipts/${req.file.filename}` : undefined;

    const pr = await PaymentRequest.create({
      invoiceId: invoice._id,
      agencyId,
      submittedBy: req.user._id,
      amount: invoice.amount,
      currency: invoice.currency || "ETB",
      method: method || "bank_transfer",
      transactionRef: transactionRef ? String(transactionRef).trim() : undefined,
      note: note ? String(note).trim() : undefined,
      receiptUrl,
      status: "pending",
    });

    res.status(201).json({ message: "Payment request submitted", request: pr });
  } catch (e) {
    next(e);
  }
});



// GET /api/billing/payment-requests
router.get("/payment-requests", async (req, res, next) => {
  try {
    const agencyId = req.user.agency;
    const requests = await PaymentRequest.find({ agencyId })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ requests });
  } catch (e) {
    next(e);
  }
});


// Billing overview: usage + estimated bill this month
// router.get("/overview", async (req, res, next) => {
//     try {
//         const agencyId = req.user.agency;
//         const now = new Date();
//         const periodKey = getPeriodKey(now);

//         const agency = await Agency.findById(agencyId, { billingPlan: 1 }).lean();
//         const plan = agency?.billingPlan
//             ? await Plan.findById(agency.billingPlan).lean()
//             : await Plan.findOne({ name: "LEVEL_1" }).lean();

//         const usage = await Usage.findOne({ agencyId, periodKey }).lean();
//         const used = usage?.recordsCreated || 0;

//         const included = plan.includedRecords;
//         const overage = Math.max(0, used - included);
//         const estimate = plan.monthlyFee + overage * plan.overagePrice;

//         const unpaid = await Invoice.findOne({ agencyId, status: "unpaid" }).sort({ issuedAt: -1 }).lean();

//         res.json({
//             plan,
//             period: { periodKey, start: getMonthStart(now), end: getMonthEnd(now) },
//             usage: { used, included, overage, overagePrice: plan.overagePrice },
//             estimate: { amount: estimate, currency: plan.currency || "ETB" },
//             unpaidInvoice: unpaid || null,
//             billing: req.billing || { status: "ok" },
//         });
//     } catch (e) { next(e); }
// });





router.get("/overview", async (req, res, next) => {
    try {
        const agencyId = req.user.agency;
        const now = new Date();
        const periodKey = getPeriodKey(now);

        const agency = await Agency.findById(agencyId, { billingPlan: 1 }).lean();
        const plan = agency?.billingPlan
            ? await Plan.findById(agency.billingPlan).lean()
            : await Plan.findOne({ name: "LEVEL_1" }).lean();

        const usage = await Usage.findOne({ agencyId, periodKey }).lean();
        const used = usage?.recordsCreated || 0;

        const included = plan.includedRecords;
        const overage = Math.max(0, used - included);
        const remainingInQuota = Math.max(0, included - used);

        const base = plan.monthlyFee;
        const overageAmount = overage * plan.overagePrice;
        const estimatedTotal = base + overageAmount;

        const unpaid = await Invoice.findOne({ agencyId, status: "unpaid" })
            .sort({ issuedAt: -1 })
            .lean();

        // timeline helpers
        const dueDay = 16;
        const lockDay = 17;
        const today = now.getDate();

        const daysUntilDue = today <= dueDay ? (dueDay - today) : 0;
        const daysUntilLock = today < lockDay ? (lockDay - today) : 0;

        res.json({
            billing: req.billing || { status: "ok" },

            plan: {
                id: plan._id,
                name: plan.name,
                title: plan.title,
                currency: plan.currency || "ETB",
                includedRecords: plan.includedRecords,
                monthlyFee: plan.monthlyFee,
                overagePrice: plan.overagePrice,
            },

            period: {
                periodKey,
                start: getMonthStart(now),
                end: getMonthEnd(now),
            },

            usage: {
                used,
                included,
                remainingInQuota,
                overage,
                overagePrice: plan.overagePrice,
            },

            estimate: {
                base,
                overageAmount,
                total: estimatedTotal,
                currency: plan.currency || "ETB",
            },

            unpaidInvoice: unpaid
                ? {
                    id: unpaid._id,
                    periodKey: unpaid.periodKey,
                    amount: unpaid.amount,
                    currency: unpaid.currency,
                    dueAt: unpaid.dueAt,
                    issuedAt: unpaid.issuedAt,
                    breakdown: unpaid.breakdown || null,
                }
                : null,

            dunning: unpaid
                ? {
                    dueDay,
                    lockDay,
                    daysUntilDue,
                    daysUntilLock,
                }
                : null,
        });
    } catch (e) {
        next(e);
    }
});


// Current billing status (banner)
router.get("/status", async (req, res, next) => {
    try {
        return res.json({ billing: req.billing || { status: "ok" } });
    } catch (e) {
        next(e);
    }
});

router.get("/debug-usage", async (req, res, next) => {
    try {
        const agencyId = req.user.agency;
        const all = await Usage.find({ agencyId }).sort({ createdAt: -1 }).lean();
        res.json({ count: all.length, items: all });
    } catch (e) {
        next(e);
    }
});

                
// List invoices

// router.post("/test-generate", async (req, res, next) => {
//     try {
//         let agencyId = req.user?.agency;

//         // ✅ SUPER_ADMIN can pass ?agencyId=
//         if (req.user?.role === ROLES.SUPER_ADMIN && req.query.agencyId) {
//             agencyId = req.query.agencyId;
//         }

//         if (!agencyId) {
//             return res.status(400).json({ message: "agencyId is required (or login as agency user)" });
//         }

//         const usage = await Usage.findOne({ agencyId }).sort({ createdAt: -1 });
//         if (!usage) return res.json({ message: "No usage found" });

//         const invoice = await Invoice.create({
//             agencyId,
//             periodKey: usage.periodKey,
//             recordsBilled: usage.recordsCreated,
//             unitPrice: 0.02,
//             currency: "USD",
//             amount: Number((usage.recordsCreated * 0.02).toFixed(2)),
//             status: "unpaid",
//             issuedAt: new Date(),
//             dueAt: new Date(new Date().getFullYear(), new Date().getMonth(), 16, 23, 59, 59, 999),
//         });

//         return res.json({ invoice });
//     } catch (err) {
//         next(err);
//     }
// });


router.post("/test-generate", async (req, res, next) => {
    try {
        let agencyId = req.user.agency;

        // SUPER_ADMIN can pass ?agencyId=
        if (req.user.role === ROLES.SUPER_ADMIN && req.query.agencyId) {
            agencyId = req.query.agencyId;
        }
        if (!agencyId) return res.status(400).json({ message: "agencyId is required" });

        const now = new Date();
        const periodKey = previousMonthKey(now); // ✅ bill previous month (real behavior)

        // prevent duplicates
        const existing = await Invoice.findOne({ agencyId, periodKey });
        if (existing) return res.json({ message: "Invoice already exists", invoice: existing });

        const agency = await Agency.findById(agencyId, { billingPlan: 1, name: 1, email: 1 }).lean();

        const plan = agency?.billingPlan
            ? await Plan.findById(agency.billingPlan).lean()
            : await Plan.findOne({ name: "LEVEL_1" }).lean();

        if (!plan) return res.status(500).json({ message: "No plan found" });

        // usage might not exist => used = 0 (still bill base)
        const usage = await Usage.findOne({ agencyId, periodKey }).lean();
        const used = usage?.recordsCreated || 0;

        const included = plan.includedRecords;
        const overage = Math.max(0, used - included);

        const base = plan.monthlyFee;
        const overageAmount = overage * plan.overagePrice;
        const amount = base + overageAmount;

        const invoice = await Invoice.create({
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

        return res.json({ invoice });
    } catch (e) {
        next(e);
    }
});

router.get("/invoices", async (req, res, next) => {
    try {
        const agencyId = req.user.agency;
        const invoices = await Invoice.find({ agencyId }).sort({ issuedAt: -1 }).lean();
        res.json({ invoices });
    } catch (e) {
        next(e);
    }
});

export default router;
