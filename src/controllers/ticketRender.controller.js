import TicketTemplate from "../models/TicketTemplate.js";
import TicketDocument from "../models/TicketDocument.js";
import { buildAfroTicketHtml } from "../services/ticketRenderHtml.service.js";
import { renderHtmlToPdf } from "../services/ticketRenderPdf.service.js";

export async function renderTicket(req, res) {
    try {
        const agencyId = req.user.agency;
        const ticketId = req.params.id;

        const ticketDoc = await TicketDocument.findOne({ _id: ticketId, agencyId });
        if (!ticketDoc) return res.status(404).json({ message: "Ticket not found" });

        const tpl = (await TicketTemplate.findOne({ agencyId })) || { agencyId };
        const html = buildAfroTicketHtml({ ticketDoc, template: tpl });

        const fileBase = `${ticketDoc.ticket?.pnr || "PNR"}_${ticketDoc.passenger?.fullName || "Passenger"}`;
        const format = tpl?.theme?.paper || "A4";

        const { publicUrl } = await renderHtmlToPdf({ html, fileNameBase: fileBase, format });

        ticketDoc.rendered = { pdfUrl: publicUrl, renderedAt: new Date() };
        await ticketDoc.save();

        return res.json({
            message: "Ticket rendered",
            data: { ticketId: ticketDoc._id, pdfUrl: publicUrl },
        });
    } catch (e) {
        return res.status(500).json({ message: "Render failed", error: e.message });
    }
}

export async function getRendered(req, res) {
    try {
        const agencyId = req.user.agency;
        const ticketId = req.params.id;

        const ticketDoc = await TicketDocument.findOne({ _id: ticketId, agencyId });
        if (!ticketDoc) return res.status(404).json({ message: "Ticket not found" });

        return res.json({
            data: {
                pdfUrl: ticketDoc.rendered?.pdfUrl || "",
                renderedAt: ticketDoc.rendered?.renderedAt || null,
            },
        });
    } catch (e) {
        return res.status(500).json({ message: "Failed", error: e.message });
    }
}

export async function getTicketData(req, res) {
    try {
        const agencyId = req.user.agency;
        const ticketId = req.params.id;

        const ticketDoc = await TicketDocument.findOne({ _id: ticketId, agencyId });
        if (!ticketDoc) return res.status(404).json({ message: "Ticket not found" });

        const tpl = (await TicketTemplate.findOne({ agencyId })) || { agencyId };

        return res.json({
            message: "Success",
            data: {
                ticket: ticketDoc,
                template: tpl,
            },
        });
    } catch (e) {
        return res.status(500).json({ message: "Failed", error: e.message });
    }
}
