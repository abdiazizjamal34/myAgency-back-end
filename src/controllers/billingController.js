import Invoice from "../models/Invoice.js";
import Payment from "../models/Payment.js";
import { ROLES } from "../utils/constants.js";

/**
 * SUPER_ADMIN marks invoice as paid (manual/bank transfer/cash).
 * Body:
 *  - amount (optional): defaults to invoice.amount
 *  - currency (optional): defaults to invoice.currency
 *  - providerRef (optional): receipt number, transaction id, etc.
 *  - note (optional)
 */
export async function markInvoicePaidManual(req, res, next) {
    try {
        if (req.user?.role !== ROLES.SUPER_ADMIN) {
            return res.status(403).json({ message: "Not allowed" });
        }

        const { invoiceId } = req.params;
        const { amount, currency, providerRef, note } = req.body || {};

        const invoice = await Invoice.findById(invoiceId);
        if (!invoice) return res.status(404).json({ message: "Invoice not found" });

        if (invoice.status === "paid") {
            return res.status(200).json({ message: "Invoice already paid", invoice });
        }

        const payAmount = Number(amount ?? invoice.amount);
        const payCurrency = String(currency ?? invoice.currency);

        // Mark invoice paid
        invoice.status = "paid";
        invoice.paidAt = new Date();
        await invoice.save();

        // Create payment audit record
        const payment = await Payment.create({
            invoiceId: invoice._id,
            agencyId: invoice.agencyId,
            provider: "manual",
            providerRef: providerRef ? String(providerRef) : undefined,
            amount: payAmount,
            currency: payCurrency,
            status: "succeeded",
            metadata: note ? { note: String(note) } : undefined,
        });

        return res.json({
            message: "Invoice marked as paid",
            invoice,
            payment,
        });
    } catch (err) {
        next(err);
    }
}
