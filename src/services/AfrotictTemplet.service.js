export function buildAfroTripHtml({ ticketDoc, template }) {
    const tpl = template || {};
    const brand = tpl.brand || {};
    const theme = tpl.theme || {};
    const primary = theme.primaryColor || "#004d40";
    const font = "'Segoe UI', Arial, sans-serif";

    const ticket = ticketDoc.ticket || {};
    const itinerary = Array.isArray(ticketDoc.itinerary) ? ticketDoc.itinerary : [];
    const notes = Array.isArray(ticketDoc.notes) ? ticketDoc.notes : [];

    const esc = (s = "") => String(s)
        .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;").replaceAll("'", "&#039;");

    const formatName = (name = "") => {
        if (!name) return "";
        const isChild = name.toUpperCase().includes("(CHILD)");
        let clean = name.replace(/\(CHILD\)/i, "").trim();
        // Only swap if it looks like "LAST, FIRST" (exactly one comma)
        const parts = clean.split(",");
        if (parts.length === 2) {
            clean = `${parts[1].trim()} ${parts[0].trim()}`;
        }
        return clean.toLowerCase().split(' ').map(s => s.charAt(0).toUpperCase() + s.substring(1)).join(' ') + (isChild ? " (Child)" : "");
    };

    // Improved Split Logic: Prioritize semi-colon to keep "Last, First" together
    const splitRobust = (str) => {
        if (!str) return [];
        if (str.includes(";")) {
            return str.split(";").map(x => x.trim()).filter(Boolean);
        }
        // Fallback: If no semi-colons, check if it's "Last, First, Last, First"
        // Splitting by comma is risky, but if we have multiple ticket numbers, they'll match by index anyway.
        return str.split(/,(?!\s)/).map(x => x.trim()).filter(Boolean);
    };

    const findNoteValue = (prefix) => {
        const n = notes.find(x => String(x).startsWith(prefix + ":"));
        return n ? n.split(":").slice(1).join(":").trim() : "";
    };

    const passengerList = findNoteValue("Passengers")
        ? splitRobust(findNoteValue("Passengers"))
        : (ticketDoc.passenger?.fullName ? [ticketDoc.passenger.fullName] : []);

    const eticketsList = findNoteValue("eTickets")
        ? splitRobust(findNoteValue("eTickets"))
        : (ticket.ticketNumber ? [ticket.ticketNumber] : []);

    const passengerRowsHtml = passengerList.map((name, idx) => {
        const tnum = eticketsList[idx] || (idx === 0 ? (ticket.ticketNumber || "-") : "-");
        const cabin = itinerary[0]?.cabin || "Economy";
        const isChild = name.toUpperCase().includes("(CHILD)");

        return `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 12px 10px;">
            <div style="font-weight: bold; color: #333; font-size: 14px;">${esc(formatName(name))}</div>
            <div style="font-size: 10px; color: ${primary}; font-weight: bold; text-transform: uppercase; margin-top: 2px;">
                ${isChild ? 'Child' : 'Adult'}
            </div>
        </td>
        <td style="padding: 12px 10px;">
            <span style="font-family: monospace; background: #f4f4f4; padding: 4px 8px; border-radius: 4px; border: 1px solid #ddd; font-size: 13px;">
                ${esc(tnum)}
            </span>
        </td>
        <td style="padding: 12px 10px; text-align: right;">
            <span style="background: #e0f2f1; color: #00695c; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: bold; text-transform: uppercase;">
                ${esc(cabin)}
            </span>
        </td>
      </tr>
    `;
    }).join("");

    // Minimal segmentsHtml for a working file
    const segmentsHtml = itinerary.map(f => `
        <div style="border: 1px solid #eee; margin-bottom: 15px; padding: 15px; border-radius: 8px;">
            <div style="font-weight: bold; color: ${primary}; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-bottom: 10px;">
                ${esc(f.flightNo || "Flight")} | ${esc(f.departure?.split(' ')[0] || "")}
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <div style="font-size: 18px; font-weight: bold;">${esc(f.from?.airport || "")}</div>
                    <div style="font-size: 12px; color: #666;">${esc(f.departure?.split(' ')[1] || "")}</div>
                </div>
                <div style="color: #ccc; font-size: 20px;">✈</div>
                <div style="text-align: right;">
                    <div style="font-size: 18px; font-weight: bold;">${esc(f.to?.airport || "")}</div>
                    <div style="font-size: 12px; color: #666;">${esc(f.arrival?.split(' ')[1] || "")}</div>
                </div>
            </div>
        </div>
    `).join("");

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <style>
        :root { --primary: ${primary}; }
        body { font-family: ${font}; margin: 0; padding: 20px; color: #333; }
        .container { width: 800px; margin: auto; background: white; padding: 40px; border: 1px solid #eee; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
        .passenger-table { width: 100%; border-collapse: collapse; margin: 20px 0 30px 0; }
        .passenger-table th { 
            text-align: left; background: #f8f8f8; padding: 12px 10px; font-size: 11px; 
            color: #777; border-bottom: 2px solid var(--primary); text-transform: uppercase;
        }
        .section-header { 
            border-left: 4px solid var(--primary); padding-left: 10px; margin-top: 30px; 
            font-size: 16px; color: var(--primary); font-weight: bold; margin-bottom: 15px;
        }
    </style>
</head>
<body>
<div class="container">
    <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: ${primary}; margin: 0;">${esc(brand.agencyName || "AFRO TRIP EXPRESS")}</h1>
        <p style="font-size: 12px; color: #666;">${esc(brand.address || "")}</p>
    </div>

    <div class="section-header">PASSENGER DETAILS</div>
    <table class="passenger-table">
        <thead>
            <tr>
                <th style="width: 50%;">Passenger Name</th>
                <th style="width: 30%;">Ticket Number</th>
                <th style="width: 20%; text-align: right;">Class</th>
            </tr>
        </thead>
        <tbody>
            ${passengerRowsHtml}
        </tbody>
    </table>

    <div class="section-header">FLIGHT ITINERARY</div>
    ${segmentsHtml}

    <div style="margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px; text-align: center; font-size: 11px; color: #888;">
        <p>Please arrive at the airport 3 hours before departure. © ${brand.agencyName || "Afro Trip Express"}</p>
    </div>
</div>
</body>
</html>
    `;
}
