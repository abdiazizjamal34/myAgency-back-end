// src/services/normalizeTravelport.service.js
// Travelport ViewTrip ("My Trip") parser for your extracted rawText format

const MONTHS = {
    JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
    JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12",
};

function pad2(n) { return String(n).padStart(2, "0"); }

function toISODate(dd, mon, yyyy) {
    const mm = MONTHS[(mon || "").toUpperCase()];
    if (!mm) return "";
    return `${yyyy}-${mm}-${pad2(dd)}`;
}

function normalize24h(t) {
    const m = (t || "").match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return "";
    return `${pad2(m[1])}:${m[2]}`;
}

function addDaysISO(isoDate, days) {
    const [y, m, d] = isoDate.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + days);
    return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

function detectTravelport(text) {
    const up = (text || "").toUpperCase();
    return up.includes("TRAVELPORT") && up.includes("VIEWTRIP");
}

// function extractPnr(text) {
//     const m = text.match(/Confirmation\s+Number:\s*([A-Z0-9]{5,8})/i);
//     return m ? m[1].toUpperCase() : "";
// }
function extractPnr(text) {
    // allow longer codes and junk after it
    const m = text.match(/Confirmation\s+Number:\s*([A-Z0-9]{5,12})/i);
    return m ? m[1].toUpperCase() : "";
}
function extractAltReservationCode(text) {
    const m = text.match(/Your\s+Reservation\s+Code:\s*([A-Z0-9]{5,10})/i);
    return m ? m[1].toUpperCase() : "";
}

// ✅ passengers + eTickets (works with tabs OR multiple spaces)
// function extractPassengersAndETickets(text) {
//     const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

//     const found = [];
//     for (const l of lines) {
//         // Works for:
//         // "NAME \t0712672685896 \t..."
//         // "NAME    0712672685896   ..."
//         const m = l.match(/^(.+?)\s+(071\d{10})\b/);
//         if (m) {
//             const name = m[1].trim();

//             // reduce false matches; keep lines that look like a passenger name
//             const looksLikeName = /,|\(Child\)|\b[A-Z]{2,}\b/i.test(name);
//             if (looksLikeName) {
//                 found.push({ name, ticketNumber: m[2].trim() });
//             }
//         }
//     }

//     // dedupe by ticketNumber
//     const map = new Map();
//     for (const p of found) map.set(p.ticketNumber, p);
//     return [...map.values()];
// }

function extractPassengersAndETickets(text) {
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

    const found = [];
    let inPassengers = false;

    for (const l of lines) {
        const up = l.toUpperCase();

        if (up === "PASSENGERS") { inPassengers = true; continue; }
        // stop when we hit flight section
        if (inPassengers && /AIRPORT INFO|FLIGHT INFO|Ethiopian Airlines\s+\(/i.test(l)) inPassengers = false;

        if (!inPassengers) continue;

        // row can be tab separated or multi spaces
        // "MAHAMED, ABDIAZIZ AHMED \t0712672685896"
        const m = l.match(/^(.+?)\s+(071\d{10})\b/);
        if (m) found.push({ name: m[1].trim(), ticketNumber: m[2].trim() });
    }

    // dedupe by ticketNumber
    const map = new Map();
    for (const p of found) if (!map.has(p.ticketNumber)) map.set(p.ticketNumber, p);
    return [...map.values()];
}

function extractAirlineFromFlights(text) {
    // Travelport line: "Ethiopian Airlines (ET) 688"
    const m = text.match(/([A-Za-z][A-Za-z\s]+)\s+\(([A-Z0-9]{2})\)\s+(\d{1,4})/);
    if (!m) return { name: "", iata: "", icao: "" };
    const name = m[1].trim();
    const iata = m[2].toUpperCase();
    return { name, iata, icao: "" };
}

function extractCabin(text) {
    // "Class of Service: Economy"
    const m = text.match(/Class\s+of\s+Service:\s*([A-Za-z]+)/i);
    return m ? m[1].trim() : "";
}

function extractAirportInfoTerminals(text) {
    // Map terminals by airport code: { ADD: "Terminal 2", DEL: "Terminal 3" }
    const lines = text.split("\n").map(l => l.replace(/\s+/g, " ").trim()).filter(Boolean);
    const terminals = {};

    for (let i = 0; i < lines.length; i++) {
        const l = lines[i];

        const a = l.match(/\(([A-Z]{3})\)/);
        if (a) {
            const code = a[1].toUpperCase();

            // look ahead a few lines for "Terminal X"
            for (let j = i; j < Math.min(i + 6, lines.length); j++) {
                const tm = lines[j].match(/Terminal\s+([0-9A-Za-z]+)/i);
                if (tm) {
                    terminals[code] = `Terminal ${tm[1]}`;
                    break;
                }
            }
        }
    }

    return terminals;
}

// function extractSegments(text) {
//     const lines = text.split("\n").map(l => l.replace(/\s+/g, " ").trim()).filter(Boolean);

//     const segments = [];
//     let current = null;

//     const headerRe =
//         /^(MON|TUE|WED|THU|FRI|SAT|SUN)\s+(\d{2})\s+([A-Z]{3})\s+(20\d{2}).*\(([A-Z]{3})\)\s+to\s+.*\(([A-Z]{3})\)\s+-\s+(Confirmed|Cancelled|Ticketed|On hold|Pending)/i;

//     const flightRe = /([A-Za-z][A-Za-z\s]+)\s+\(([A-Z0-9]{2})\)\s+(\d{1,4})/i;

//     const isDepartMarker = (s) => s === "DEPART" || /\bDEPART\b/i.test(s);
//     const isArriveMarker = (s) => s === "ARRIVE" || /\bARRIVE\b/i.test(s);

//     for (let i = 0; i < lines.length; i++) {
//         const l = lines[i];

//         const h = l.match(headerRe);
//         if (h) {
//             if (current) segments.push(current);

//             const dateISO = toISODate(h[2], h[3], h[4]);
//             const fromA = h[5].toUpperCase();
//             const toA = h[6].toUpperCase();

//             current = {
//                 segmentNo: segments.length + 1,
//                 flightNo: "",
//                 from: { city: "", airport: fromA, terminal: "" },
//                 to: { city: "", airport: toA, terminal: "" },
//                 departure: dateISO, // will add time later
//                 arrival: dateISO,   // adjust +1 if needed
//                 cabin: "",
//                 bookingClass: "",
//                 baggage: "",
//                 seat: "",
//                 _dateISO: dateISO,
//             };
//             continue;
//         }

//         if (!current) continue;

//         // flight line
//         const f = l.match(flightRe);
//         if (f && !current.flightNo) {
//             const iata = f[2].toUpperCase();
//             const num = String(f[3]).padStart(3, "0");
//             current.flightNo = `${iata}${num}`;
//             continue;
//         }

//         // ✅ DEPART marker can be inside a longer line (e.g. "Confirmation Number ... DEPART")
//         if (isDepartMarker(l)) {
//             const next = lines[i + 1] || "";
//             const m = next.match(/^(\d{1,2}:\d{2})\s+([A-Z]{3})$/i);
//             if (m) {
//                 const t = normalize24h(m[1]);
//                 const airport = m[2].toUpperCase();
//                 if (airport) current.from.airport = airport;
//                 if (current._dateISO && t) current.departure = `${current._dateISO} ${t}`;
//             }
//             continue;
//         }

//         if (isArriveMarker(l)) {
//             const next = lines[i + 1] || "";
//             const m = next.match(/^(\d{1,2}:\d{2})\s+([A-Z]{3})$/i);
//             const plus1 = (lines[i + 2] || "").trim() === "+1";
//             if (m) {
//                 const t = normalize24h(m[1]);
//                 const airport = m[2].toUpperCase();
//                 if (airport) current.to.airport = airport;

//                 const arrDate = plus1 ? addDaysISO(current._dateISO, 1) : current._dateISO;
//                 if (arrDate && t) current.arrival = `${arrDate} ${t}`;
//             }
//             continue;
//         }

//         // cabin
//         const c = l.match(/^Class\s+of\s+Service:\s*(.+)$/i);
//         if (c) {
//             current.cabin = c[1].trim();
//             continue;
//         }
//     }

//     if (current) segments.push(current);

//     return segments.map(s => {
//         const { _dateISO, ...rest } = s;
//         return rest;
//     });
// }

function extractSegments(text) {
    const lines = text.split("\n").map(l => l.replace(/\s+/g, " ").trim()).filter(Boolean);

    const segments = [];
    let current = null;

    // ✅ supports both:
    // "WED 05 NOV 2025 - THU 06 NOV 2025 - Addis Ababa (ADD) to Delhi (DEL) - Confirmed"
    // "FRI 12 DEC 2025 - Delhi (DEL) to Addis Ababa (ADD) - Confirmed"
    const headerRe =
        /^(MON|TUE|WED|THU|FRI|SAT|SUN)\s+(\d{2})\s+([A-Z]{3})\s+(20\d{2})\s*(?:-\s*(MON|TUE|WED|THU|FRI|SAT|SUN)\s+\d{2}\s+[A-Z]{3}\s+20\d{2})?\s*-\s*.*\(([A-Z]{3})\)\s+to\s+.*\(([A-Z]{3})\)\s+-\s+(Confirmed|Cancelled|Ticketed|On hold|Pending)/i;

    const flightRe = /([A-Za-z][A-Za-z\s.&'-]+)\s+\(([A-Z0-9]{2})\)\s+(\d{1,4})/i;

    const isDepart = (s) => s === "DEPART" || /\bDEPART\b/i.test(s);
    const isArrive = (s) => s === "ARRIVE" || /\bARRIVE\b/i.test(s);

    for (let i = 0; i < lines.length; i++) {
        const l = lines[i];

        const h = l.match(headerRe);
        if (h) {
            if (current) segments.push(current);

            const dateISO = toISODate(h[2], h[3], h[4]);
            const fromA = h[6].toUpperCase();
            const toA = h[7].toUpperCase();

            current = {
                segmentNo: segments.length + 1,
                flightNo: "",
                from: { city: "", airport: fromA, terminal: "" },
                to: { city: "", airport: toA, terminal: "" },
                departure: dateISO,
                arrival: dateISO,
                cabin: "",
                bookingClass: "",
                baggage: "",
                seat: "",
                _dateISO: dateISO,
            };
            continue;
        }

        if (!current) continue;

        // flight line
        const f = l.match(flightRe);
        if (f && !current.flightNo) {
            const iata = f[2].toUpperCase();
            const num = String(f[3]).padStart(3, "0");
            current.flightNo = `${iata}${num}`;
            continue;
        }

        if (isDepart(l)) {
            const next = lines[i + 1] || "";
            const m = next.match(/^(\d{1,2}:\d{2})\s+([A-Z]{3})$/i);
            if (m) {
                const t = normalize24h(m[1]);
                const airport = m[2].toUpperCase();
                if (airport) current.from.airport = airport;
                if (current._dateISO && t) current.departure = `${current._dateISO} ${t}`;
            }
            continue;
        }

        if (isArrive(l)) {
            const next = lines[i + 1] || "";
            const m = next.match(/^(\d{1,2}:\d{2})\s+([A-Z]{3})$/i);
            const plus1 = (lines[i + 2] || "").trim() === "+1";
            if (m) {
                const t = normalize24h(m[1]);
                const airport = m[2].toUpperCase();
                if (airport) current.to.airport = airport;

                const arrDate = plus1 ? addDaysISO(current._dateISO, 1) : current._dateISO;
                if (arrDate && t) current.arrival = `${arrDate} ${t}`;
            }
            continue;
        }

        // cabin
        const c = l.match(/^Class\s+of\s+Service:\s*(.+)$/i);
        if (c) current.cabin = c[1].trim();
    }

    if (current) segments.push(current);

    return segments.map(s => {
        const { _dateISO, ...rest } = s;
        return rest;
    });
}

export function normalizeTravelport(rawText) {
    const text = (rawText || "").replace(/\r/g, "");

    // If you want strict detection:
    // if (!detectTravelport(text)) { ... }

    const pnr = extractPnr(text);
    const altCode = extractAltReservationCode(text);

    const pax = extractPassengersAndETickets(text);
    const primaryPassenger = pax[0]?.name || "";
    const primaryTicket = pax[0]?.ticketNumber || "";

    const airline = extractAirlineFromFlights(text);
    const itinerary = extractSegments(text);

    const terminals = extractAirportInfoTerminals(text);
    for (const seg of itinerary) {
        if (terminals[seg.from.airport]) seg.from.terminal = terminals[seg.from.airport];
        if (terminals[seg.to.airport]) seg.to.terminal = terminals[seg.to.airport];
    }

    const cabin = extractCabin(text);
    if (cabin) {
        for (const seg of itinerary) {
            if (!seg.cabin) seg.cabin = cabin;
        }
    }

    const notes = [];
    if (altCode) notes.push(`Reservation Code: ${altCode}`);
    if (pax.length) notes.push(`Passengers: ${pax.map(p => p.name).join(", ")}`);
    if (pax.length) notes.push(`eTickets: ${pax.map(p => p.ticketNumber).join(", ")}`);

    const needsReview = !(pnr && primaryPassenger && itinerary.length);

    return {
        normalized: {
            airline,
            ticket: {
                ticketNumber: primaryTicket,
                pnr,
                issueDate: "",
                issuingOffice: "",
                status: "UNKNOWN",
            },
            passenger: {
                fullName: primaryPassenger,
                type: "UNKNOWN",
                passportNumber: "",
                nationality: "",
            },
            itinerary,
            fare: { currency: "", base: 0, taxes: 0, total: 0, breakdown: [] },
            notes,
        },
        confidence: Math.min(
            1,
            (pnr ? 0.35 : 0) +
            (primaryPassenger ? 0.25 : 0) +
            (itinerary.length ? 0.25 : 0) +
            (primaryTicket ? 0.15 : 0)
        ),
        processingStatus: needsReview ? "NEEDS_REVIEW" : "READY",
    };
}
