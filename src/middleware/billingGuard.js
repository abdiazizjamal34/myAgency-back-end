

import { ROLES } from "../utils/constants.js";
import Invoice from "../models/Invoice.js";
import Agency from "../models/Agency.js";
import { isReadOnlyWindow } from "../utils/billingPeriod.js";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// ✅ allow some write endpoints even in read-only
function isWriteAllowedInReadOnly(req) {
    const path = req.path || "";           // e.g. "/payment-requests"
    const base = req.baseUrl || "";        // e.g. "/api/billing"
    const full = `${base}${path}`;         // e.g. "/api/billing/payment-requests"

    // Allow submitting payment request + anything payment-related
    if (req.method === "POST" && full === "/api/billing/payment-requests") return true;

    // Optional future-proof: allow any /api/billing/payments/* endpoints
    if (full.startsWith("/api/billing/payments")) return true;

    return false;
}

export function billingGuard() {
    return async (req, res, next) => {
        try {
            // SUPER_ADMIN bypass
            if (req.user?.role === ROLES.SUPER_ADMIN) {
                req.billing = { status: "ok" };
                return next();
            }

            const agencyId = req.user?.agency;
            if (!agencyId) {
                req.billing = { status: "ok" };
                return next();
            }

            const unpaid = await Invoice.findOne({ agencyId, status: "unpaid" }).sort({ issuedAt: -1 });

            if (!unpaid) {
                req.billing = { status: "ok" };
                return next();
            }

            const readOnly = isReadOnlyWindow(new Date());

            req.billing = {
                status: readOnly ? "read_only" : "unpaid_warning",
                invoice: {
                    id: unpaid._id,
                    periodKey: unpaid.periodKey,
                    amount: unpaid.amount,
                    currency: unpaid.currency,
                    dueAt: unpaid.dueAt,
                },
            };

            // ✅ If read-only, block writes EXCEPT allowed payment/billing actions
            if (readOnly && WRITE_METHODS.has(req.method) && !isWriteAllowedInReadOnly(req)) {
                return res.status(403).json({
                    message: "Account is in read-only mode due to unpaid invoice. Please pay to unlock.",
                    billing: req.billing,
                });
            }

            const agency = await Agency.findById(agencyId).select("billingOverrideUnlocked billingOverrideUntil").lean();

            const overrideOk =
                agency?.billingOverrideUnlocked &&
                agency?.billingOverrideUntil &&
                new Date(agency.billingOverrideUntil) > new Date();

            if (overrideOk) {
                req.billing = { status: "ok", override: true };
                return next();
            }

            return next();
        } catch (err) {
            return next(err);
        }
    };
}