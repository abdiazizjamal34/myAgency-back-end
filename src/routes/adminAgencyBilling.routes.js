import express from "express";
import { requireRole, sameAgencyOrSuper } from "../middleware/roles.js";
import { ROLES } from "../utils/constants.js";

import Agency from "../models/Agency.js";
import Plan from "../models/Plan.js";
import Usage from "../models/Usage.js";
import Invoice from "../models/Invoice.js";
import PaymentRequest from "../models/PaymentRequest.js";

import {
    getPeriodKey,
    previousMonthKey,
    dueDateForCurrentMonth,
    getMonthStart,
    getMonthEnd,
} from "../utils/billingPeriod.js";

const router = express.Router();

/**
 * GET /api/admin/billing/agencies/:agencyId/profile
 * Full billing profile for an agency
 */
router.get(
    "/agencies/:agencyId/profile",
    requireRole(ROLES.SUPER_ADMIN, ROLES.AGENCY_ADMIN),
    sameAgencyOrSuper,
    async (req, res, next) => {
        try {
            const { agencyId } = req.params;

            const agency = await Agency.findById(agencyId)
                .select("name email phone billingPlan billingOverrideUnlocked billingOverrideUntil createdAt")
                .populate({ path: "billingPlan", select: "name title includedRecords monthlyFee overagePrice currency isActive" })
                .lean();

            if (!agency) return res.status(404).json({ message: "Agency not found" });

            const now = new Date();
            const currentPeriodKey = getPeriodKey(now);
            const prevPeriodKey = previousMonthKey(now);

            // Current month usage
            const usage = await Usage.findOne({ agencyId, periodKey: currentPeriodKey }).lean();

            // Latest unpaid invoice (any period)
            const unpaidInvoice = await Invoice.findOne({ agencyId, status: "unpaid" })
                .sort({ issuedAt: -1 })
                .lean();

            // Recent invoices
            const invoices = await Invoice.find({ agencyId })
                .sort({ issuedAt: -1 })
                .limit(24)
                .lean();

            // Recent payment requests (any status)
            const paymentRequests = await PaymentRequest.find({ agencyId })
                .sort({ createdAt: -1 })
                .limit(30)
                .populate({ path: "invoiceId", select: "periodKey amount currency status dueAt issuedAt breakdown recordsBilled" })
                .populate({ path: "submittedBy", select: "name email" })
                .populate({ path: "reviewedBy", select: "name email" })
                .lean();

            // Plans list (for dropdown)
            const plans = await Plan.find({ isActive: true }).sort({ includedRecords: 1 }).lean();

            // Estimated current month bill (based on plan)
            const plan = agency.billingPlan || (await Plan.findOne({ name: "LEVEL_1" }).lean());
            const used = usage?.recordsCreated || 0;
            const included = plan?.includedRecords || 0;
            const overage = Math.max(0, used - included);
            const base = plan?.monthlyFee || 0;
            const overageAmount = overage * (plan?.overagePrice || 0);
            const estimateTotal = base + overageAmount;

            // Previous month invoice existence (help admin see if it’s generated)
            const prevInvoice = await Invoice.findOne({ agencyId, periodKey: prevPeriodKey }).lean();

            res.json({
                agency,
                currentPeriod: {
                    periodKey: currentPeriodKey,
                    start: getMonthStart(now),
                    end: getMonthEnd(now),
                },
                usage: usage || { agencyId, periodKey: currentPeriodKey, recordsCreated: 0, locked: false },
                estimate: {
                    base,
                    overageRecords: overage,
                    overagePrice: plan?.overagePrice || 0,
                    overageAmount,
                    total: estimateTotal,
                    currency: plan?.currency || "ETB",
                },
                unpaidInvoice: unpaidInvoice
                    ? {
                        id: unpaidInvoice._id,
                        periodKey: unpaidInvoice.periodKey,
                        amount: unpaidInvoice.amount,
                        currency: unpaidInvoice.currency,
                        dueAt: unpaidInvoice.dueAt,
                        issuedAt: unpaidInvoice.issuedAt,
                        breakdown: unpaidInvoice.breakdown,
                        recordsBilled: unpaidInvoice.recordsBilled,
                        status: unpaidInvoice.status,
                    }
                    : null,
                invoices,
                paymentRequests,
                plans,
                prevPeriodKey,
                prevInvoice: prevInvoice
                    ? { id: prevInvoice._id, periodKey: prevInvoice.periodKey, status: prevInvoice.status, amount: prevInvoice.amount }
                    : null,
            });
        } catch (e) {
            next(e);
        }
    }
);

/**
 * POST /api/admin/billing/agencies/:agencyId/change-plan
 * body: { planId }
 */
router.post(
    "/agencies/:agencyId/change-plan",
    requireRole(ROLES.SUPER_ADMIN),
    async (req, res, next) => {
        try {
            const { agencyId } = req.params;
            const { planId } = req.body;

            if (!planId) return res.status(400).json({ message: "planId is required" });

            const plan = await Plan.findById(planId).lean();
            if (!plan) return res.status(404).json({ message: "Plan not found" });

            const updated = await Agency.findByIdAndUpdate(
                agencyId,
                { billingPlan: planId },
                { new: true }
            ).select("name billingPlan").populate({ path: "billingPlan", select: "name title includedRecords monthlyFee overagePrice currency" });

            if (!updated) return res.status(404).json({ message: "Agency not found" });

            res.json({ message: "Plan updated", agency: updated });
        } catch (e) {
            next(e);
        }
    }
);

/**
 * POST /api/admin/billing/agencies/:agencyId/generate-invoice
 * Generates invoice for a given periodKey (default previous month)
 * body: { periodKey? }
 */
router.post(
    "/agencies/:agencyId/generate-invoice",
    requireRole(ROLES.SUPER_ADMIN),
    async (req, res, next) => {
        try {
            const { agencyId } = req.params;
            const now = new Date();

            const periodKey = req.body?.periodKey || previousMonthKey(now);

            // prevent duplicates
            const existing = await Invoice.findOne({ agencyId, periodKey }).lean();
            if (existing) return res.json({ message: "Invoice already exists", invoice: existing });

            const agency = await Agency.findById(agencyId, { billingPlan: 1, name: 1, email: 1 }).lean();
            if (!agency) return res.status(404).json({ message: "Agency not found" });

            const plan = agency.billingPlan
                ? await Plan.findById(agency.billingPlan).lean()
                : await Plan.findOne({ name: "LEVEL_1" }).lean();

            if (!plan) return res.status(500).json({ message: "No plan found" });

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

            res.json({ message: "Invoice generated", invoice });
        } catch (e) {
            next(e);
        }
    }
);

/**
 * POST /api/admin/billing/agencies/:agencyId/force-unlock
 * Temporarily bypass read-only even if unpaid
 * body: { untilDays?: number }  // default 3 days
 */
router.post(
    "/agencies/:agencyId/force-unlock",
    requireRole(ROLES.SUPER_ADMIN),
    async (req, res, next) => {
        try {
            const { agencyId } = req.params;
            const untilDays = Number(req.body?.untilDays || 3);

            const until = new Date(Date.now() + untilDays * 24 * 60 * 60 * 1000);

            const updated = await Agency.findByIdAndUpdate(
                agencyId,
                {
                    billingOverrideUnlocked: true,
                    billingOverrideUntil: until,
                },
                { new: true }
            ).select("name billingOverrideUnlocked billingOverrideUntil");

            if (!updated) return res.status(404).json({ message: "Agency not found" });

            res.json({ message: "Agency unlocked temporarily", agency: updated });
        } catch (e) {
            next(e);
        }
    }
);

/**
 * POST /api/admin/billing/agencies/:agencyId/send-reminder
 * body: { type?: "invoice_due"|"read_only"|"manual", message?: string }
 * This is a stub - connect to your email sender service.
 */
router.post(
    "/agencies/:agencyId/send-reminder",
    requireRole(ROLES.SUPER_ADMIN),
    async (req, res, next) => {
        try {
            const { agencyId } = req.params;
            const type = req.body?.type || "manual";
            const message = req.body?.message || "";

            const agency = await Agency.findById(agencyId).select("name email").lean();
            if (!agency) return res.status(404).json({ message: "Agency not found" });

            // TODO: integrate nodemailer / SES etc.
            // await sendEmail({ to: agency.email, subject: "...", html: "..." })

            res.json({
                message: "Reminder queued (stub). Connect email service to send real emails.",
                meta: { to: agency.email, type, message },
            });
        } catch (e) {
            next(e);
        }
    }
);

export default router;