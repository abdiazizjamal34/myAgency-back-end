import path from "path";
import fs from "fs";
import TicketDocument from "../models/TicketDocument.js";
import TicketTemplate from "../models/TicketTemplate.js";
import { sendTicketEmail } from "../utils/mailer.js";

export async function sendTicketViaEmail(req, res) {
  try {
    const agencyId = req.user.agency;
    const ticketId = req.params.id;
    const { email, customMessage } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Recipient email is required." });
    }

    // 1. Fetch Ticket
    const ticketDoc = await TicketDocument.findOne({ _id: ticketId, agencyId });
    if (!ticketDoc) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    if (!ticketDoc.rendered || !ticketDoc.rendered.pdfUrl) {
      return res.status(400).json({ message: "Please render the PDF before sending." });
    }

    // Convert relative URL to full path on disk
    // e.g. /uploads/rendered/1700000_ET.pdf
    const relativeUrl = ticketDoc.rendered.pdfUrl.replace(/^\//, "");
    const pdfPath = path.resolve(relativeUrl);
    
    if (!fs.existsSync(pdfPath)) {
      return res.status(404).json({ message: "Rendered PDF file missing on server." });
    }

    // 2. Fetch Agency Branding
    const tpl = (await TicketTemplate.findOne({ agencyId })) || { agencyId };
    
    // Fallbacks
    const agencyName = tpl.brand?.agencyName || "Our Agency";
    const primaryColor = tpl.theme?.primaryColor || "#004d40";
    let logoUrl = tpl.brand?.logoUrl || "";

    // If logo is local, construct absolute URL if frontend knows domain, 
    // but in HTML email, CID attachments or absolute URLs are needed. 
    // For simplicity, we assume an absolute URL, or else it breaks.
    if (logoUrl.startsWith("/")) {
      logoUrl = `${process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || "http://localhost:5173"}${logoUrl}`;
    }

    const passengerName = ticketDoc.passengers?.[0]?.fullName || "";
    const subject = `Your upcoming trip itinerary from ${agencyName}`;

    // 3. Construct file name safely
    let pdfName = "ETicket.pdf";
    if (passengerName) {
      const safeName = passengerName.replace(/[^a-zA-Z0-9]/g, "_");
      pdfName = `ETicket_${safeName}.pdf`;
    }

    const templateData = {
      agencyName,
      logoUrl,
      primaryColor,
      passengerName,
      messageBody: customMessage || "",
      footerText: tpl.footer?.disclaimer || ""
    };

    // 4. Send Email
    await sendTicketEmail(email, subject, templateData, pdfPath, pdfName);

    return res.json({
      message: "Ticket sent successfully",
      data: { sentTo: email }
    });

  } catch (err) {
    console.error("sendTicketViaEmail Error:", err);
    return res.status(500).json({ message: "Failed to send email", error: err.message });
  }
}

// Accept an in-memory/base64 PDF from the frontend and email it without saving to disk
export async function sendTicketViaEmailInline(req, res) {
  try {
    const agencyId = req.user.agency;
    const ticketId = req.params.id;
    const { email, customMessage, pdfBase64, filename } = req.body;

    if (!email) return res.status(400).json({ message: "Recipient email is required." });
    if (!pdfBase64) return res.status(400).json({ message: "pdfBase64 (base64 string) is required." });

    // Optionally fetch ticket doc to use passenger/name data for filename and template
    const ticketDoc = await TicketDocument.findOne({ _id: ticketId, agencyId });
    if (!ticketDoc) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    // Fetch template/branding
    const tpl = (await TicketTemplate.findOne({ agencyId })) || { agencyId };
    const agencyName = tpl.brand?.agencyName || "Our Agency";
    const primaryColor = tpl.theme?.primaryColor || "#004d40";
    let logoUrl = tpl.brand?.logoUrl || "";
    if (logoUrl && logoUrl.startsWith("/")) {
      logoUrl = `${process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || "http://localhost:5173"}${logoUrl}`;
    }

    const passengerName = ticketDoc.passengers?.[0]?.fullName || "";
    const subject = `Your upcoming trip itinerary from ${agencyName}`;

    // Determine filename
    let pdfName = filename || "ETicket.pdf";
    if (!filename && passengerName) {
      const safeName = passengerName.replace(/[^a-zA-Z0-9]/g, "_");
      pdfName = `ETicket_${safeName}.pdf`;
    }

    // decode base64
    let pdfBuffer;
    try {
      pdfBuffer = Buffer.from(pdfBase64, "base64");
    } catch (err) {
      return res.status(400).json({ message: "Invalid base64 PDF data" });
    }

    const templateData = {
      agencyName,
      logoUrl,
      primaryColor,
      passengerName,
      messageBody: customMessage || "",
      footerText: tpl.footer?.disclaimer || "",
    };

    // Send email with in-memory buffer
    await sendTicketEmail(email, subject, templateData, pdfBuffer, pdfName);

    return res.json({ message: "Ticket sent successfully (inline)", data: { sentTo: email } });
  } catch (err) {
    console.error("sendTicketViaEmailInline Error:", err);
    return res.status(500).json({ message: "Failed to send email", error: err.message });
  }
}
