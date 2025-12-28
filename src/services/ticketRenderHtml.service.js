import fs from "fs";
import path from "path";

/**
 * ProfitMate TicketDocument -> Afro Trip Express HTML template (server-rendered)
 * No browser JS needed => stable PDF output.
 */

function esc(s = "") {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// rawText times are like "2025-11-05 16:00"
function fmtDate(isoLike = "") {
  const [date] = String(isoLike).split(" ");
  return date || "";
}
function fmtTime(isoLike = "") {
  const parts = String(isoLike).split(" ");
  return parts[1] || "";
}

function findNoteValue(notes = [], prefix = "") {
  const n = notes.find(x => String(x).toLowerCase().startsWith(prefix.toLowerCase()));
  if (!n) return "";
  const idx = n.indexOf(":");
  if (idx === -1) return "";
  return n.slice(idx + 1).trim();
}

// Passengers list comes from notes like: "Passengers: A, B, C"
function parsePassengersFromNotes(notes = []) {
  const s = findNoteValue(notes, "Passengers");
  if (!s) return [];
  return s.split(",").map(x => x.trim()).filter(Boolean);
}

// eTickets list comes from notes like: "eTickets: 071..., 071..."
function parseEticketsFromNotes(notes = []) {
  const s = findNoteValue(notes, "eTickets");
  if (!s) return [];
  return s.split(",").map(x => x.trim()).filter(Boolean);
}

/**
 * Make logo always appear in PDF.
 * If logoUrl is "/uploads/....png" we read it and inline as base64.
 * If logoUrl is "http(s)://..." we keep it as is.
 */
function inlineLogoDataUrl(logoUrl = "") {
  if (!logoUrl) return "";

  // Remote image URL
  if (/^https?:\/\//i.test(logoUrl)) return logoUrl;

  // Local uploads path => convert to file path => base64
  if (logoUrl.startsWith("/uploads/")) {
    const abs = path.resolve(logoUrl.replace(/^\//, "")); // "/uploads/.." -> "uploads/.."
    if (fs.existsSync(abs)) {
      const ext = path.extname(abs).toLowerCase().replace(".", "");
      const mime =
        ext === "png" ? "image/png" :
        ext === "jpg" || ext === "jpeg" ? "image/jpeg" :
        ext === "webp" ? "image/webp" : "application/octet-stream";

      const buf = fs.readFileSync(abs);
      return `data:${mime};base64,${buf.toString("base64")}`;
    }
  }

  return logoUrl; // fallback
}

export function buildAfroTicketHtml({ ticketDoc, template }) {
  const tpl = template || {};
  const brand = tpl.brand || {};
  const theme = tpl.theme || {};
  const show = tpl.show || {};

  const primary = theme.primaryColor || "#004d40";
  const bg = "#f5f5f5";

  const airline = ticketDoc.airline || {};
  const ticket = ticketDoc.ticket || {};
  const notes = Array.isArray(ticketDoc.notes) ? ticketDoc.notes : [];
  const itinerary = Array.isArray(ticketDoc.itinerary) ? ticketDoc.itinerary : [];

  // reservation code can be in notes: "Reservation Code: DXC8VR"
  // or Travelport has pnr inside ticket.pnr already (UONGRS)
  const reservationCode =
    findNoteValue(notes, "Reservation Code") ||
    findNoteValue(notes, "Your Reservation Code") ||
    "";

  const status =
    notes.find(n => String(n).toLowerCase().includes("booking status"))?.split(":").slice(1).join(":").trim()
    || ticketDoc.processingStatus
    || "UNKNOWN";

  const passengerNames =
    parsePassengersFromNotes(notes).length
      ? parsePassengersFromNotes(notes)
      : (ticketDoc.passenger?.fullName ? [ticketDoc.passenger.fullName] : []);

  const ticketNumbers =
    parseEticketsFromNotes(notes).length
      ? parseEticketsFromNotes(notes)
      : (ticket.ticketNumber ? [ticket.ticketNumber] : []);

  const cabinDefault = itinerary[0]?.cabin || "";

  // Logo (inline base64 if local)
  const logoSrc = inlineLogoDataUrl(brand.logoUrl || "");

  const issueDate = ticketDoc.createdAt ? new Date(ticketDoc.createdAt).toISOString().slice(0, 10) : "";

  const passengersRows = passengerNames.map((name, idx) => {
    const tno = ticketNumbers[idx] || ticketNumbers[0] || "";
    return `
      <tr>
        <td><strong>${esc(name)}</strong></td>
        <td>${esc(tno)}</td>
        <td>${esc(cabinDefault)}</td>
      </tr>
    `;
  }).join("");

  const itineraryCards = itinerary.map(flight => {
    const depDate = fmtDate(flight.departure);
    const depTime = fmtTime(flight.departure);
    const arrTime = fmtTime(flight.arrival);

    return `
      <div class="flight-card">
        <div class="flight-header">
          <span>Flight ${esc(flight.flightNo || "-")}</span>
          <span>${esc(depDate)}</span>
        </div>
        <div class="flight-body">
          <div class="airport">
            <h2>${esc(flight.from?.airport || "-")}</h2>
            <div>Dep: ${esc(depTime || "-")}</div>
            ${show.showTerminals !== false ? `<small>${esc(flight.from?.terminal || "")}</small>` : ""}
          </div>
          <div class="plane">✈</div>
          <div class="airport" style="text-align:right">
            <h2>${esc(flight.to?.airport || "-")}</h2>
            <div>Arr: ${esc(arrTime || "-")}</div>
            ${show.showTerminals !== false ? `<small>${esc(flight.to?.terminal || "")}</small>` : ""}
          </div>
        </div>
      </div>
    `;
  }).join("");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Dynamic e-Ticket | ${esc(brand.agencyName || "Afro Trip Express")}</title>
  <style>
    :root { --primary: ${primary}; --bg: ${bg}; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: var(--bg); padding: 20px; }
    .container { width: 850px; margin: auto; background: white; padding: 40px; border-radius: 8px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
    .header { display: flex; justify-content: space-between; border-bottom: 3px solid var(--primary); padding-bottom: 15px; }
    .summary { display: flex; justify-content: space-around; background: #f9f9f9; padding: 15px; margin: 20px 0; border-radius: 5px; }
    .label { font-size: 11px; color: #777; text-transform: uppercase; display: block; }
    .value { font-weight: bold; font-size: 15px; color: #333; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th { text-align: left; background: #eee; padding: 10px; font-size: 12px; }
    td { padding: 12px 10px; border-bottom: 1px solid #eee; font-size: 13px; }
    .flight-card { border: 1px solid #ddd; border-radius: 8px; margin-top: 15px; }
    .flight-header { background: #f0f0f0; padding: 10px; font-weight: bold; display: flex; justify-content: space-between; }
    .flight-body { display: flex; justify-content: space-between; padding: 20px; align-items: center; }
    .airport h2 { margin: 0; color: var(--primary); font-size: 24px; }
    .plane { font-size: 24px; color: #ccc; }
    .footer { margin-top: 30px; font-size: 11px; text-align: center; color: #888; border-top: 1px solid #eee; padding-top: 10px; }
    .brandRow { display:flex; gap:12px; align-items:center; }
    .logo { width:56px; height:56px; object-fit:contain; border-radius:8px; border:1px solid #eee; background:#fff; }
  </style>
</head>
<body>

<div class="container" id="ticket-print-area">
  <div class="header">
    <div class="brandRow">
      ${logoSrc ? `<img class="logo" src="${esc(logoSrc)}" alt="logo" />` : ""}
      <div>
        <h1 style="margin:0; color:var(--primary);">${esc(brand.agencyName || "AFRO TRIP EXPRESS")}</h1>
        <p style="margin:5px 0; font-size:12px;">${esc(brand.address || "")}</p>
      </div>
    </div>

    <div style="text-align:right">
      <div style="background:var(--primary); color:white; padding:5px 10px; font-weight:bold;">E-TICKET</div>
      <p style="font-size:12px;">Issued: ${esc(issueDate)}</p>
    </div>
  </div>

  <div class="summary">
    <div><span class="label">PNR / Booking Ref</span><span class="value">${esc(ticket.pnr || "")}</span></div>
    <div><span class="label">Reservation Code</span><span class="value">${esc(reservationCode || "")}</span></div>
    <div><span class="label">Airline</span><span class="value">${esc(airline.name || airline.iata || "")}</span></div>
    <div><span class="label">Status</span><span class="value" style="color:green">${esc(status || "")}</span></div>
  </div>

  <h3 style="border-left: 4px solid var(--primary); padding-left: 10px;">PASSENGERS</h3>
  <table>
    <thead>
      <tr><th>NAME</th><th>TICKET NUMBER</th><th>CLASS</th></tr>
    </thead>
    <tbody>
      ${passengersRows || `<tr><td colspan="3">No passengers found</td></tr>`}
    </tbody>
  </table>

  <h3 style="border-left: 4px solid var(--primary); padding-left: 10px; margin-top:30px;">FLIGHT ITINERARY</h3>
  <div>
    ${itineraryCards || `<div>No itinerary segments found</div>`}
  </div>

  <div class="footer">
    <p>Please arrive at the airport 3 hours before departure. Check-in closes 60 minutes before flight.</p>
    <p>© 2025 ${esc(brand.agencyName || "Afro Trip Express")} | Generated by ProfitMate</p>
  </div>
</div>

</body>
</html>
`;
}
