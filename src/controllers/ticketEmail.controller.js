import path from "path";
import fs from "fs";
import TicketDocument from "../models/TicketDocument.js";
import TicketTemplate from "../models/TicketTemplate.js";
import Agency from "../models/Agency.js";
import { sendTicketEmail, sendCustomAttachmentEmail } from "../utils/mailer.js";
import { buildAfroTicketHtml } from "../services/ticketRenderHtml.service.js";
import { renderHtmlToPdf } from "../services/ticketRenderPdf.service.js";

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

    // 2. Fetch Agency Branding
    const tpl = (await TicketTemplate.findOne({ agencyId })) || { agencyId };
    
    // 3. Render PDF if missing or not rendered
    let relativeUrl = "";
    if (!ticketDoc.rendered || !ticketDoc.rendered.pdfUrl) {
      const html = buildAfroTicketHtml({ ticketDoc, template: tpl });
      const fileBase = `${ticketDoc.ticket?.pnr || "PNR"}_${ticketDoc.passenger?.fullName || "Passenger"}`;
      const format = tpl?.theme?.paper || "A4";

      const { publicUrl } = await renderHtmlToPdf({ html, fileNameBase: fileBase, format });
      
      ticketDoc.rendered = { pdfUrl: publicUrl, renderedAt: new Date() };
      await ticketDoc.save();
      
      relativeUrl = publicUrl.replace(/^\//, "");
    } else {
      relativeUrl = ticketDoc.rendered.pdfUrl.replace(/^\//, "");
    }

    // Convert relative URL to full path on disk
    let pdfPath = path.resolve(relativeUrl);
    
    if (!fs.existsSync(pdfPath)) {
      // Re-render if file is missing
      const html = buildAfroTicketHtml({ ticketDoc, template: tpl });
      const fileBase = `${ticketDoc.ticket?.pnr || "PNR"}_${ticketDoc.passenger?.fullName || "Passenger"}`;
      const format = tpl?.theme?.paper || "A4";

      const { publicUrl } = await renderHtmlToPdf({ html, fileNameBase: fileBase, format });
      
      ticketDoc.rendered = { pdfUrl: publicUrl, renderedAt: new Date() };
      await ticketDoc.save();
      
      relativeUrl = publicUrl.replace(/^\//, "");
      pdfPath = path.resolve(relativeUrl);
      
      if (!fs.existsSync(pdfPath)) {
          return res.status(404).json({ message: "Rendered PDF file missing on server and regeneration failed." });
      }
    }
    
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

// Receive a PDF file from frontend and send it via email
export async function sendTicketViaEmailMultipart(req, res) {
  try {
    const agencyId = req.user.agency;
    // We can extract ticketId if needed for logging or further features: const ticketId = req.params.id;
    const { to, subject, message } = req.body;

    if (!to) return res.status(400).json({ message: "Recipient email is required." });
    if (!req.file) return res.status(400).json({ message: "PDF file is required." });

    // Fetch Agency data to construct sender name and reply-to
    const targetAgency = await Agency.findById(agencyId);
    let agencyName = "Agency Name";
    let replyTo = null;

    if (targetAgency) {
      agencyName = targetAgency.name || "Agency Name";
      replyTo = targetAgency.contactEmail || targetAgency.email || null;
    } else {
      // Fallback
      const tpl = await TicketTemplate.findOne({ agencyId });
      if (tpl && tpl.brand) {
        agencyName = tpl.brand.agencyName || "Agency Name";
      }
    }

    // "Agency Name via ProfitMate <tickets@yourdomain.com>"
    // Assuming process.env.SMTP_USER is tickets@yourdomain.com
    const fromAddress = `"${agencyName} via ProfitMate" <${process.env.SMTP_USER || "tickets@yourdomain.com"}>`;

    const attachments = [
      {
        filename: "ticket.pdf",
        content: req.file.buffer,   // directly from multer memoryStorage
        contentType: "application/pdf"
      }
    ];

    // the message body could be HTML directly from the frontend
    const htmlBody = message || "<p>Attached is your document.</p>";

    // Send the email
    await sendCustomAttachmentEmail({
      to,
      subject: subject || "Your Ticket",
      html: htmlBody,
      attachments,
      from: fromAddress,
      replyTo
    });

    console.log(`Email successfully sent for ticket upload (Agency: ${agencyId}) to ${to}`);

    return res.json({ success: true, message: "Email sent successfully" });

  } catch (err) {
    console.error("sendTicketViaEmailMultipart Error:", err);
    return res.status(500).json({ success: false, message: "Failed to send email", error: err.message });
  }
}
