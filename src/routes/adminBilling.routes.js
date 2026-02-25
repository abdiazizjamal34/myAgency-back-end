import express from "express";
import { requireRole } from "../middleware/roles.js";
import { ROLES } from "../utils/constants.js";
import { markInvoicePaidManual } from "../controllers/billingController.js";
import Agency from "../models/Agency.js";
import Plan from "../models/Plan.js";
import PaymentRequest from "../models/PaymentRequest.js";
import Payment from "../models/Payment.js";
import Invoice from "../models/Invoice.js";

const router = express.Router();




router.put(
    "/agencies/:agencyId/plan",
    requireRole(ROLES.SUPER_ADMIN),
    async (req, res, next) => {
        try {
            const { agencyId } = req.params;
            const { planId, planName } = req.body;

            let plan = null;
            if (planId) plan = await Plan.findById(planId);
            if (!plan && planName) plan = await Plan.findOne({ name: planName });

            if (!plan) return res.status(400).json({ message: "Plan not found" });

            const agency = await Agency.findByIdAndUpdate(
                agencyId,
                { $set: { billingPlan: plan._id } },
                { new: true }
            ).lean();

            res.json({ message: "Plan assigned", agency, plan });
        } catch (e) { next(e); }
    }
);

// POST /api/admin/billing/payment-requests/:id/approve
router.post(
    "/payment-requests/:id/approve",
    requireRole(ROLES.SUPER_ADMIN),
    async (req, res, next) => {
        try {
            const { id } = req.params;
            const { adminNote, providerRef } = req.body || {};

            const pr = await PaymentRequest.findById(id);
            if (!pr) return res.status(404).json({ message: "Payment request not found" });
            if (pr.status !== "pending") return res.status(400).json({ message: "Request is not pending" });

            const invoice = await Invoice.findById(pr.invoiceId);
            if (!invoice) return res.status(404).json({ message: "Invoice not found" });

            if (invoice.status !== "paid") {
                invoice.status = "paid";
                invoice.paidAt = new Date();
                await invoice.save();
            }

            // create payment audit
            const payment = await Payment.create({
                invoiceId: invoice._id,
                agencyId: invoice.agencyId,
                provider: "manual",
                providerRef: providerRef || pr.transactionRef || undefined,
                amount: pr.amount,
                currency: pr.currency,
                status: "succeeded",
                metadata: {
                    source: "payment_request",
                    requestId: pr._id.toString(),
                    receiptUrl: pr.receiptUrl,
                    note: pr.note,
                    adminNote: adminNote ? String(adminNote) : undefined,
                },
            });

            pr.status = "approved";
            pr.reviewedBy = req.user._id;
            pr.reviewedAt = new Date();
            pr.adminNote = adminNote ? String(adminNote) : undefined;
            await pr.save();

            res.json({ message: "Approved", request: pr, invoice, payment });
        } catch (e) {
            next(e);
        }
    }
);


// POST /api/admin/billing/payment-requests/:id/reject
router.post(
    "/payment-requests/:id/reject",
    requireRole(ROLES.SUPER_ADMIN),
    async (req, res, next) => {
        try {
            const { id } = req.params;
            const { adminNote } = req.body || {};

            const pr = await PaymentRequest.findById(id);
            if (!pr) return res.status(404).json({ message: "Payment request not found" });
            if (pr.status !== "pending") return res.status(400).json({ message: "Request is not pending" });

            pr.status = "rejected";
            pr.reviewedBy = req.user._id;
            pr.reviewedAt = new Date();
            pr.adminNote = adminNote ? String(adminNote) : undefined;
            await pr.save();

            res.json({ message: "Rejected", request: pr });
        } catch (e) {
            next(e);
        }
    }
);


// GET /api/admin/billing/payment-requests?status=pending
// router.get(
//     "/payment-requests",
//     requireRole(ROLES.SUPER_ADMIN),
//     async (req, res, next) => {
//         try {
//             const status = req.query.status || "pending";
//             const requests = await PaymentRequest.find({ status })
//                 .sort({ createdAt: -1 })
//                 .lean();
//             res.json({ requests });
//         } catch (e) {
//             next(e);
//         }
//     }
// );


// GET /api/admin/billing/payment-requests?status=pending
router.get(
  "/payment-requests",
  requireRole(ROLES.SUPER_ADMIN),
  async (req, res, next) => {
    try {
      const status = req.query.status || "pending";

      const requests = await PaymentRequest.find({ status })
        .sort({ createdAt: -1 })
        .populate({ path: "agencyId", select: "name email phone" })            // ✅ agency name
        .populate({ path: "invoiceId", select: "periodKey amount currency status breakdown recordsBilled issuedAt dueAt" }) // ✅ invoice periodKey
        .populate({ path: "submittedBy", select: "name email" })             // ✅ who submitted
        .populate({ path: "reviewedBy", select: "name email" })              // ✅ who reviewed (if any)
        .lean();

      res.json({ requests });
    } catch (e) {
      next(e);
    }
  }
);

// SUPER_ADMIN only
router.post(
    "/invoices/:invoiceId/mark-paid",
    requireRole(ROLES.SUPER_ADMIN),
    markInvoicePaidManual
);

export default router;
