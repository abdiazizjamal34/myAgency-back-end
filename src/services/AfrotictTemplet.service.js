export function buildAfroTripHtml({ ticketDoc, template }) {
    // ... (previous setup code remains same) ...

    const notes = Array.isArray(ticketDoc.notes) ? ticketDoc.notes : [];
    
    // Improved Split Logic: Prioritize semi-colon to keep "Last, First" together
    const splitRobust = (str) => {
        if (str.includes(";")) return str.split(";");
        // Fallback for older comma-separated records
        return str.split(/,(?!\s)/); 
    };

    const passengersNote = notes.find(n => n.startsWith("Passengers:")) || "";
    const eticketsNote = notes.find(n => n.startsWith("eTickets:")) || "";

    const passengerList = passengersNote
        ? splitRobust(passengersNote.replace("Passengers:", "")).map(x => x.trim()).filter(Boolean)
        : (ticketDoc.passenger?.fullName ? [ticketDoc.passenger.fullName] : []);

    const eticketsList = eticketsNote
        ? splitRobust(eticketsNote.replace("eTickets:", "")).map(x => x.trim()).filter(Boolean)
        : (ticket.ticketNumber ? [ticket.ticketNumber] : []);

    // --- ENHANCED PASSENGER DETAILS TABLE ROWS ---
    const passengerRowsHtml = passengerList.map((name, idx) => {
        const tnum = eticketsList[idx] || (idx === 0 ? ticket.ticketNumber : "-");
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

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <style>
        :root { --primary: ${primary}; }
        body { font-family: ${font}; margin: 0; padding: 20px; color: #333; }
        .container { width: 800px; margin: auto; background: white; padding: 40px; border: 1px solid #eee; }
        
        /* Fixed Table Structure for PDF */
        .passenger-table { width: 100%; border-collapse: collapse; margin: 20px 0 30px 0; }
        .passenger-table th { 
            text-align: left; 
            background: #f8f8f8; 
            padding: 10px; 
            font-size: 11px; 
            color: #777; 
            border-bottom: 2px solid var(--primary);
            text-transform: uppercase;
        }
        
        .section-header { 
            border-left: 4px solid var(--primary); 
            padding-left: 10px; 
            margin-top: 30px; 
            font-size: 16px; 
            color: var(--primary);
            font-weight: bold;
        }
        /* ... rest of your styles ... */
    </style>
</head>
<body>
<div class="container">
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

    </div>
</body>
</html>
    `;
}