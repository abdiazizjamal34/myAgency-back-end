// // src/services/normalizeTravelport.service.js
// // Travelport ViewTrip ("My Trip") parser for your extracted rawText format

// const MONTHS = {
//     JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
//     JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12",
// };

// function pad2(n) { return String(n).padStart(2, "0"); }

// function toISODate(dd, mon, yyyy) {
//     const mm = MONTHS[(mon || "").toUpperCase()];
//     if (!mm) return "";
//     return `${yyyy}-${mm}-${pad2(dd)}`;
// }

// function normalize24h(t) {
//     const m = (t || "").match(/^(\d{1,2}):(\d{2})$/);
//     if (!m) return "";
//     return `${pad2(m[1])}:${m[2]}`;
// }

// function addDaysISO(isoDate, days) {
//     const [y, m, d] = isoDate.split("-").map(Number);
//     const dt = new Date(Date.UTC(y, m - 1, d));
//     dt.setUTCDate(dt.getUTCDate() + days);
//     return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
// }

// function detectTravelport(text) {
//     const up = (text || "").toUpperCase();
//     return up.includes("TRAVELPORT") && up.includes("VIEWTRIP");
// }

// // function extractPnr(text) {
// //     const m = text.match(/Confirmation\s+Number:\s*([A-Z0-9]{5,8})/i);
// //     return m ? m[1].toUpperCase() : "";
// // }
// function extractPnr(text) {
//     // allow longer codes and junk after it
//     const m = text.match(/Confirmation\s+Number:\s*([A-Z0-9]{5,12})/i);
//     return m ? m[1].toUpperCase() : "";
// }
// function extractAltReservationCode(text) {
//     const m = text.match(/Your\s+Reservation\s+Code:\s*([A-Z0-9]{5,10})/i);
//     return m ? m[1].toUpperCase() : "";
// }

// // ✅ passengers + eTickets (works with tabs OR multiple spaces)
// // function extractPassengersAndETickets(text) {
// //     const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

// //     const found = [];
// //     for (const l of lines) {
// //         // Works for:
// //         // "NAME \t0712672685896 \t..."
// //         // "NAME    0712672685896   ..."
// //         const m = l.match(/^(.+?)\s+(071\d{10})\b/);
// //         if (m) {
// //             const name = m[1].trim();

// //             // reduce false matches; keep lines that look like a passenger name
// //             const looksLikeName = /,|\(Child\)|\b[A-Z]{2,}\b/i.test(name);
// //             if (looksLikeName) {
// //                 found.push({ name, ticketNumber: m[2].trim() });
// //             }
// //         }
// //     }

// //     // dedupe by ticketNumber
// //     const map = new Map();
// //     for (const p of found) map.set(p.ticketNumber, p);
// //     return [...map.values()];
// // }

// function extractPassengersAndETickets(text) {
//     const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

//     const found = [];
//     let inPassengers = false;

//     for (const l of lines) {
//         const up = l.toUpperCase();

//         if (up === "PASSENGERS") { inPassengers = true; continue; }
//         // stop when we hit flight section
//         if (inPassengers && /AIRPORT INFO|FLIGHT INFO|Ethiopian Airlines\s+\(/i.test(l)) inPassengers = false;

//         if (!inPassengers) continue;

//         // row can be tab separated or multi spaces
//         // "MAHAMED, ABDIAZIZ AHMED \t0712672685896"
//         const m = l.match(/^(.+?)\s+(071\d{10})\b/);
//         if (m) found.push({ name: m[1].trim(), ticketNumber: m[2].trim() });
//     }

//     // dedupe by ticketNumber
//     const map = new Map();
//     for (const p of found) if (!map.has(p.ticketNumber)) map.set(p.ticketNumber, p);
//     return [...map.values()];
// }

// function extractAirlineFromFlights(text) {
//     // Travelport line: "Ethiopian Airlines (ET) 688"
//     const m = text.match(/([A-Za-z][A-Za-z\s]+)\s+\(([A-Z0-9]{2})\)\s+(\d{1,4})/);
//     if (!m) return { name: "", iata: "", icao: "" };
//     const name = m[1].trim();
//     const iata = m[2].toUpperCase();
//     return { name, iata, icao: "" };
// }

// function extractCabin(text) {
//     // "Class of Service: Economy"
//     const m = text.match(/Class\s+of\s+Service:\s*([A-Za-z]+)/i);
//     return m ? m[1].trim() : "";
// }

// function extractAirportInfoTerminals(text) {
//     // Map terminals by airport code: { ADD: "Terminal 2", DEL: "Terminal 3" }
//     const lines = text.split("\n").map(l => l.replace(/\s+/g, " ").trim()).filter(Boolean);
//     const terminals = {};

//     for (let i = 0; i < lines.length; i++) {
//         const l = lines[i];

//         const a = l.match(/\(([A-Z]{3})\)/);
//         if (a) {
//             const code = a[1].toUpperCase();

//             // look ahead a few lines for "Terminal X"
//             for (let j = i; j < Math.min(i + 6, lines.length); j++) {
//                 const tm = lines[j].match(/Terminal\s+([0-9A-Za-z]+)/i);
//                 if (tm) {
//                     terminals[code] = `Terminal ${tm[1]}`;
//                     break;
//                 }
//             }
//         }
//     }

//     return terminals;
// }

// // function extractSegments(text) {
// //     const lines = text.split("\n").map(l => l.replace(/\s+/g, " ").trim()).filter(Boolean);

// //     const segments = [];
// //     let current = null;

// //     const headerRe =
// //         /^(MON|TUE|WED|THU|FRI|SAT|SUN)\s+(\d{2})\s+([A-Z]{3})\s+(20\d{2}).*\(([A-Z]{3})\)\s+to\s+.*\(([A-Z]{3})\)\s+-\s+(Confirmed|Cancelled|Ticketed|On hold|Pending)/i;

// //     const flightRe = /([A-Za-z][A-Za-z\s]+)\s+\(([A-Z0-9]{2})\)\s+(\d{1,4})/i;

// //     const isDepartMarker = (s) => s === "DEPART" || /\bDEPART\b/i.test(s);
// //     const isArriveMarker = (s) => s === "ARRIVE" || /\bARRIVE\b/i.test(s);

// //     for (let i = 0; i < lines.length; i++) {
// //         const l = lines[i];

// //         const h = l.match(headerRe);
// //         if (h) {
// //             if (current) segments.push(current);

// //             const dateISO = toISODate(h[2], h[3], h[4]);
// //             const fromA = h[5].toUpperCase();
// //             const toA = h[6].toUpperCase();

// //             current = {
// //                 segmentNo: segments.length + 1,
// //                 flightNo: "",
// //                 from: { city: "", airport: fromA, terminal: "" },
// //                 to: { city: "", airport: toA, terminal: "" },
// //                 departure: dateISO, // will add time later
// //                 arrival: dateISO,   // adjust +1 if needed
// //                 cabin: "",
// //                 bookingClass: "",
// //                 baggage: "",
// //                 seat: "",
// //                 _dateISO: dateISO,
// //             };
// //             continue;
// //         }

// //         if (!current) continue;

// //         // flight line
// //         const f = l.match(flightRe);
// //         if (f && !current.flightNo) {
// //             const iata = f[2].toUpperCase();
// //             const num = String(f[3]).padStart(3, "0");
// //             current.flightNo = `${iata}${num}`;
// //             continue;
// //         }

// //         // ✅ DEPART marker can be inside a longer line (e.g. "Confirmation Number ... DEPART")
// //         if (isDepartMarker(l)) {
// //             const next = lines[i + 1] || "";
// //             const m = next.match(/^(\d{1,2}:\d{2})\s+([A-Z]{3})$/i);
// //             if (m) {
// //                 const t = normalize24h(m[1]);
// //                 const airport = m[2].toUpperCase();
// //                 if (airport) current.from.airport = airport;
// //                 if (current._dateISO && t) current.departure = `${current._dateISO} ${t}`;
// //             }
// //             continue;
// //         }

// //         if (isArriveMarker(l)) {
// //             const next = lines[i + 1] || "";
// //             const m = next.match(/^(\d{1,2}:\d{2})\s+([A-Z]{3})$/i);
// //             const plus1 = (lines[i + 2] || "").trim() === "+1";
// //             if (m) {
// //                 const t = normalize24h(m[1]);
// //                 const airport = m[2].toUpperCase();
// //                 if (airport) current.to.airport = airport;

// //                 const arrDate = plus1 ? addDaysISO(current._dateISO, 1) : current._dateISO;
// //                 if (arrDate && t) current.arrival = `${arrDate} ${t}`;
// //             }
// //             continue;
// //         }

// //         // cabin
// //         const c = l.match(/^Class\s+of\s+Service:\s*(.+)$/i);
// //         if (c) {
// //             current.cabin = c[1].trim();
// //             continue;
// //         }
// //     }

// //     if (current) segments.push(current);

// //     return segments.map(s => {
// //         const { _dateISO, ...rest } = s;
// //         return rest;
// //     });
// // }

// function extractSegments(text) {
//     const lines = text.split("\n").map(l => l.replace(/\s+/g, " ").trim()).filter(Boolean);

//     const segments = [];
//     let current = null;

//     // ✅ supports both:
//     // "WED 05 NOV 2025 - THU 06 NOV 2025 - Addis Ababa (ADD) to Delhi (DEL) - Confirmed"
//     // "FRI 12 DEC 2025 - Delhi (DEL) to Addis Ababa (ADD) - Confirmed"
//     const headerRe =
//         /^(MON|TUE|WED|THU|FRI|SAT|SUN)\s+(\d{2})\s+([A-Z]{3})\s+(20\d{2})\s*(?:-\s*(MON|TUE|WED|THU|FRI|SAT|SUN)\s+\d{2}\s+[A-Z]{3}\s+20\d{2})?\s*-\s*.*\(([A-Z]{3})\)\s+to\s+.*\(([A-Z]{3})\)\s+-\s+(Confirmed|Cancelled|Ticketed|On hold|Pending)/i;

//     const flightRe = /([A-Za-z][A-Za-z\s.&'-]+)\s+\(([A-Z0-9]{2})\)\s+(\d{1,4})/i;

//     const isDepart = (s) => s === "DEPART" || /\bDEPART\b/i.test(s);
//     const isArrive = (s) => s === "ARRIVE" || /\bARRIVE\b/i.test(s);

//     for (let i = 0; i < lines.length; i++) {
//         const l = lines[i];

//         const h = l.match(headerRe);
//         if (h) {
//             if (current) segments.push(current);

//             const dateISO = toISODate(h[2], h[3], h[4]);
//             const fromA = h[6].toUpperCase();
//             const toA = h[7].toUpperCase();

//             current = {
//                 segmentNo: segments.length + 1,
//                 flightNo: "",
//                 from: { city: "", airport: fromA, terminal: "" },
//                 to: { city: "", airport: toA, terminal: "" },
//                 departure: dateISO,
//                 arrival: dateISO,
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

//         if (isDepart(l)) {
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

//         if (isArrive(l)) {
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
//         if (c) current.cabin = c[1].trim();
//     }

//     if (current) segments.push(current);

//     return segments.map(s => {
//         const { _dateISO, ...rest } = s;
//         return rest;
//     });
// }

// export function normalizeTravelport(rawText) {
//     const text = (rawText || "").replace(/\r/g, "");

//     // If you want strict detection:
//     // if (!detectTravelport(text)) { ... }

//     const pnr = extractPnr(text);
//     const altCode = extractAltReservationCode(text);

//     const pax = extractPassengersAndETickets(text);
//     const primaryPassenger = pax[0]?.name || "";
//     const primaryTicket = pax[0]?.ticketNumber || "";

//     const airline = extractAirlineFromFlights(text);
//     const itinerary = extractSegments(text);

//     const terminals = extractAirportInfoTerminals(text);
//     for (const seg of itinerary) {
//         if (terminals[seg.from.airport]) seg.from.terminal = terminals[seg.from.airport];
//         if (terminals[seg.to.airport]) seg.to.terminal = terminals[seg.to.airport];
//     }

//     const cabin = extractCabin(text);
//     if (cabin) {
//         for (const seg of itinerary) {
//             if (!seg.cabin) seg.cabin = cabin;
//         }
//     }

//     const notes = [];
//     if (altCode) notes.push(`Reservation Code: ${altCode}`);
//     if (pax.length) notes.push(`Passengers: ${pax.map(p => p.name).join(", ")}`);
//     if (pax.length) notes.push(`eTickets: ${pax.map(p => p.ticketNumber).join(", ")}`);

//     const needsReview = !(pnr && primaryPassenger && itinerary.length);

//     return {
//         normalized: {
//             airline,
//             ticket: {
//                 ticketNumber: primaryTicket,
//                 pnr,
//                 issueDate: "",
//                 issuingOffice: "",
//                 status: "UNKNOWN",
//             },
//             passenger: {
//                 fullName: primaryPassenger,
//                 type: "UNKNOWN",
//                 passportNumber: "",
//                 nationality: "",
//             },
//             itinerary,
//             fare: { currency: "", base: 0, taxes: 0, total: 0, breakdown: [] },
//             notes,
//         },
//         confidence: Math.min(
//             1,
//             (pnr ? 0.35 : 0) +
//             (primaryPassenger ? 0.25 : 0) +
//             (itinerary.length ? 0.25 : 0) +
//             (primaryTicket ? 0.15 : 0)
//         ),
//         processingStatus: needsReview ? "NEEDS_REVIEW" : "READY",
//     };
// }


// src/services/normalizeTravelport.service.js
// src/services/normalizeTravelport.service.js

// const MONTHS = {
//     JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
//     JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12",
// };

// function pad2(n) { return String(n).padStart(2, "0"); }

// function toISODate(dd, mon, yyyy) {
//     const mm = MONTHS[(mon || "").toUpperCase()];
//     if (!mm) return "";
//     return `${yyyy}-${mm}-${pad2(dd)}`;
// }

// function normalize24h(t) {
//     const m = (t || "").match(/^(\d{1,2}):(\d{2})$/);
//     if (!m) return "";
//     return `${pad2(m[1])}:${m[2]}`;
// }

// function addDaysISO(isoDate, days) {
//     const [y, m, d] = isoDate.split("-").map(Number);
//     const dt = new Date(Date.UTC(y, m - 1, d));
//     dt.setUTCDate(dt.getUTCDate() + days);
//     return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
// }

// function extractPnr(text) {
//     // Looks for 'Confirmation Number: UONGRS' or 'Your Reservation Code: DXC8VR'
//     const m1 = text.match(/Confirmation\s+Number:\s*([A-Z0-9]{6})/i);
//     const m2 = text.match(/Your\s+Reservation\s+Code:\s*([A-Z0-9]{6})/i);
//     return (m1 ? m1[1] : m2 ? m2[1] : "").toUpperCase();
// }

// function extractPassengers(text) {
//     const passengers = [];
//     // Captures Name + 13 digit ticket starting with Ethiopian's 071
//     const regex = /([A-Z\s,]+(?:\(Child\))?)\s+(071\d{10})\b/gi;
//     let match;
//     while ((match = regex.exec(text)) !== null) {
//         passengers.push({
//             fullName: match[1].trim(),
//             ticketNumber: match[2].trim(),
//             type: match[1].includes("(Child)") ? "CHILD" : "ADULT"
//         });
//     }
//     // Deduplicate by ticket number
//     return Array.from(new Map(passengers.map(p => [p.ticketNumber, p])).values());
// }

// function extractSegments(text) {
//     const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
//     const segments = [];
//     let current = null;

//     // Matches: WED 05 NOV 2025 - THU 06 NOV 2025 - Addis Ababa (ADD) to Delhi (DEL) - Confirmed
//     const headerRe = /^([A-Z]{3})\s+(\d{2})\s+([A-Z]{3})\s+(\d{4}).*?\(([A-Z]{3})\)\s+to\s+.*?\(([A-Z]{3})\)\s+-\s+(\w+)/i;
//     // Matches: Ethiopian Airlines (ET) 688
//     const flightRe = /Ethiopian\s+Airlines\s+\(ET\)\s+(\d{1,4})/i;

//     for (let i = 0; i < lines.length; i++) {
//         const line = lines[i];
//         const hMatch = line.match(headerRe);

//         if (hMatch) {
//             if (current) segments.push(current);
//             const dateISO = toISODate(hMatch[2], hMatch[3], hMatch[4]);
//             current = {
//                 segmentNo: segments.length + 1,
//                 from: { airport: hMatch[5].toUpperCase(), terminal: hMatch[5] === "ADD" ? "Terminal 2" : hMatch[5] === "DEL" ? "Terminal 3" : "" },
//                 to: { airport: hMatch[6].toUpperCase(), terminal: hMatch[6] === "ADD" ? "Terminal 2" : hMatch[6] === "DEL" ? "Terminal 3" : "" },
//                 departure: dateISO,
//                 arrival: dateISO,
//                 status: hMatch[7].toUpperCase(),
//                 flightNo: "",
//                 _dateISO: dateISO
//             };
//             continue;
//         }

//         if (!current) continue;

//         const fMatch = line.match(flightRe);
//         if (fMatch) {
//             current.flightNo = `ET${fMatch[1].padStart(3, '0')}`;
//         }

//         if (line.includes("DEPART")) {
//             const timeLine = lines[i+1];
//             if (timeLine && /^\d{1,2}:\d{2}/.test(timeLine)) {
//                 current.departure = `${current._dateISO} ${normalize24h(timeLine.split(" ")[0])}`;
//             }
//         }

//         if (line.includes("ARRIVE")) {
//             const timeLine = lines[i+1];
//             if (timeLine && /^\d{1,2}:\d{2}/.test(timeLine)) {
//                 const isNextDay = lines[i+2]?.includes("+1");
//                 const arrDate = isNextDay ? addDaysISO(current._dateISO, 1) : current._dateISO;
//                 current.arrival = `${arrDate} ${normalize24h(timeLine.split(" ")[0])}`;
//             }
//         }
//     }
//     if (current) segments.push(current);
//     return segments;
// }

// export function normalizeTravelport(rawText) {
//     const text = (rawText || "");
//     const pnr = extractPnr(text);
//     const paxList = extractPassengers(text);
//     const itinerary = extractSegments(text);

//     const primaryPax = paxList[0] || { fullName: "", ticketNumber: "", type: "UNKNOWN" };

//     // Calculate confidence based on presence of critical data
//     const hasPnr = pnr.length > 0;
//     const hasPax = paxList.length > 0;
//     const hasItinerary = itinerary.length > 0;

//     const confidence = (hasPnr ? 0.4 : 0) + (hasPax ? 0.3 : 0) + (hasItinerary ? 0.3 : 0);

//     return {
//         normalized: {
//             airline: { name: "Ethiopian Airlines", iata: "ET", icao: "ETH" },
//             ticket: {
//                 ticketNumber: primaryPax.ticketNumber,
//                 pnr: pnr,
//                 issueDate: "",
//                 issuingOffice: "AFRO TRIP EXPRESS",
//                 status: itinerary[0]?.status || "CONFIRMED"
//             },
//             passenger: {
//                 fullName: primaryPax.fullName,
//                 type: primaryPax.type,
//                 passportNumber: "",
//                 nationality: ""
//             },
//             itinerary: itinerary.map(({ _dateISO, ...rest }) => rest),
//             fare: { currency: "", base: 0, taxes: 0, total: 0, breakdown: [] },
//             notes: [
//                 `Total Passengers: ${paxList.length}`,
//                 `All Tickets: ${paxList.map(p => p.ticketNumber).join(", ")}`
//             ]
//         },
//         confidence,
//         processingStatus: (hasPnr && hasPax && hasItinerary) ? "READY" : "NEEDS_REVIEW"
//     };
// }


// src/services/normalizeTravelport.service.js

// src/services/normalizeTravelport.service.js
// Robust Travelport ViewTrip ("My Trip") parser for noisy PDF-extracted rawText

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

// Remove glyph noise and normalize whitespace, keep newlines
function cleanText(raw) {
    return (raw || "")
        .replace(/\r/g, "")
        // remove private-use glyphs that break regex
        .replace(/[]/g, " ")
        .replace(/\u00A0/g, " ")
        // normalize repeated spaces but keep line breaks
        .split("\n")
        .map(l => l.replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .join("\n");
}

function extractPnr(text) {
    // PNR appears as: "Confirmation Number: UONGRS  DEPART"
    // Or: "Confirmation Number (PNR): UONGRS"
    const m = text.match(/Confirmation\s+Number(?:\s+\(PNR\))?:\s*([A-Z0-9]{5,12})/i);
    return m ? m[1].toUpperCase() : "";
}

function extractAltReservationCode(text) {
    const m = text.match(/Your\s+Reservation\s+Code:\s*([A-Z0-9]{5,12})/i);
    return m ? m[1].toUpperCase() : "";
}

function extractPassengersAndETickets(text) {
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

    let passengerBlock = "";
    let inPassengers = false;

    for (const l of lines) {
        const up = l.toUpperCase();

        // Check for both "PASSENGERS" and "Passenger Information"
        if (up === "PASSENGERS" || up === "PASSENGER INFORMATION") { inPassengers = true; continue; }

        // stop passenger capture when flight area starts
        if (inPassengers && (/AIRPORT INFO|FLIGHT INFO|CLASS OF SERVICE|ETHIOPIAN AIRLINES\s*\(|FLIGHT SCHEDULE/i.test(l))) {
            inPassengers = false;
        }

        if (inPassengers) {
            passengerBlock += l + " ";
        }
    }

    const pax = [];
    // Global search for Name + 071-ticket + Type
    // Include () for (Child) and . for names like ST. JOHN
    const regex = /([A-Z\s,().]+?)\s*(071\d{10})(Adult|Child|Infant)?\b/gi;
    let m;
    while ((m = regex.exec(passengerBlock)) !== null) {
        let name = m[1].trim();
        let tnum = m[2].trim();
        let type = (m[3] || "").toUpperCase();

        // Remove any garbage prefixes like "NameeTicket " or leading commas
        name = name.replace(/^.*Ticket Number/i, "").replace(/^[,.\s]+/, "").trim();

        // Strip common Travelport "noise" phrases
        const noise = [
            /Special Services/i,
            /Refer to airline baggage policy for further details\.?/i,
            /^[A-Z]{3}\s+Refer/i,
            /Passenger Information/i,
            /NameeTicket NumberPassenger Type/i,
            /^[A-Z]{3}\s+(?=[A-Z]{2,})/ // matches "DEL " only if followed by another name part
        ];
        for (const re of noise) name = name.replace(re, "").trim();

        if (!name || name.toLowerCase() === "name") continue;

        pax.push({
            name,
            ticketNumber: tnum,
            type: type || (name.includes("(Child)") ? "CHILD" : "ADULT")
        });
    }

    // dedupe by ticketNumber
    const map = new Map();
    for (const p of pax) if (!map.has(p.ticketNumber)) map.set(p.ticketNumber, p);
    return [...map.values()];
}

function extractAirlineFromFlights(text) {
    // 1. Try high-confidence anchor: "Airline: Ethiopian Airlines (ET)"
    const anchorM = text.match(/Airline:\s*([^\n]+)\s+\(([A-Z0-9]{2})\)/i);
    if (anchorM) {
        let name = anchorM[1].trim();
        const iata = anchorM[2].toUpperCase();
        if (name.includes("\n")) name = name.split("\n").pop().trim();
        return { name, iata, icao: iata === "ET" ? "ETH" : "" };
    }

    // 2. Fallback to flight-style pattern "Ethiopian Airlines (ET) 308"
    // Use [^\n] to prevent grabbing multiple lines at once
    const m = text.match(/([^\n]+)\s+\(([A-Z0-9]{2})\)\s+(\d{1,4})/);
    if (!m) return null;

    let name = m[1].trim();
    if (name.includes("\n")) name = name.split("\n").pop().trim();
    const iata = m[2].toUpperCase();

    // Clean noise from the start of the name
    const noise = [
        /^[A-Z]{3}\s*-\s*[A-Z]{3}/i,
        /Refer to airline baggage policy for further details\.?/i,
        /Special Services/i,
        /^[A-Z0-9]\b/i
    ];
    for (const re of noise) name = name.replace(re, "").trim();
    name = name.replace(/^[,.\s-]+/, "").trim();

    return { name, iata, icao: iata === "ET" ? "ETH" : "" };
}

function extractCabin(text) {
    const m = text.match(/Class\s+of\s+Service:\s*([A-Za-z]+)/i);
    return m ? m[1].trim() : "";
}

function extractAirportInfoTerminals(text) {
    // captures "(ADD)" then nearby "Terminal 2"
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    const terminals = {};

    for (let i = 0; i < lines.length; i++) {
        const a = lines[i].match(/\(([A-Z]{3})\)/);
        if (!a) continue;

        const code = a[1].toUpperCase();

        for (let j = i; j < Math.min(i + 8, lines.length); j++) {
            const tm = lines[j].match(/Terminal\s+([0-9A-Za-z]+)/i);
            if (tm) {
                terminals[code] = `Terminal ${tm[1]}`;
                break;
            }
        }
    }
    return terminals;
}

function extractSegmentsOverview(text) {
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    const segments = [];
    let current = null;

    for (let i = 0; i < lines.length; i++) {
        const l = lines[i];

        // Outbound: Addis Ababa to Delhi
        const startM = l.match(/^(Outbound|Inbound):\s+(.+?)\s+to\s+(.+)$/i);
        if (startM) {
            if (current) segments.push(current);
            current = {
                segmentNo: segments.length + 1,
                flightNo: "",
                from: { city: startM[2].trim(), airport: "", terminal: "" },
                to: { city: startM[3].trim(), airport: "", terminal: "" },
                departure: "",
                arrival: "",
                cabin: "",
                bookingClass: "",
                baggage: "",
                seat: "",
            };
            continue;
        }

        if (!current) continue;

        // Flight: ET 688 | Boeing 787
        const flightM = l.match(/^Flight:\s*([A-Z0-9]{2,3})\s*(\d{1,4})/i);
        if (flightM) {
            current.flightNo = `${flightM[1].toUpperCase()}${flightM[2].padStart(3, "0")}`;
            continue;
        }

        // Date: Wednesday, 05 Nov 2025
        const dateM = l.match(/^Date:\s*\w+,\s*(\d{1,2})\s+([A-Z]{3})\s+(\d{4})/i);
        if (dateM) {
            current._dateISO = toISODate(dateM[1], dateM[2], dateM[3]);
            continue;
        }

        // Departure: 16:00 (4:00 PM) — Bole Airport (ADD), Terminal 2
        const depM = l.match(/^Departure:\s*(\d{1,2}:\d{2}).*?\(([A-Z]{3})\)(?:,\s*(Terminal\s*.+))?/i);
        if (depM) {
            current.from.airport = depM[2].toUpperCase();
            if (depM[3]) current.from.terminal = depM[3].trim();
            if (current._dateISO) current.departure = `${current._dateISO} ${normalize24h(depM[1])}`;
            continue;
        }

        // Arrival: 00:55 (+1 Day) — Indira Gandhi Intl (DEL), Terminal 3
        const arrM = l.match(/^Arrival:\s*(\d{1,2}:\d{2}).*?\(([A-Z]{3})\)(?:,\s*(Terminal\s*.+))?/i);
        if (arrM) {
            current.to.airport = arrM[2].toUpperCase();
            if (arrM[3]) current.to.terminal = arrM[3].trim();
            const plus1 = l.includes("+1");
            const arrDate = plus1 ? addDaysISO(current._dateISO, 1) : current._dateISO;
            if (arrDate) current.arrival = `${arrDate} ${normalize24h(arrM[1])}`;
            continue;
        }
    }

    if (current) segments.push(current);
    return segments.map(s => { delete s._dateISO; return s; });
}

function extractBaggage(text) {
    const m = text.match(/Checked Baggage:\s*(.+)/i);
    return m ? m[1].trim() : "";
}

function extractSegments(text) {
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

    const segments = [];
    let current = null;

    // ✅ supports both:
    // "WED 05 NOV 2025 - THU 06 NOV 2025 - ... (ADD) to ... (DEL) - Confirmed"
    // "WED, DEC 24, 2025 - THU, DEC 25, 2025 - ... (ADD) to ... (NBO) - Confirmed"
    const headerRe =
        /^(MON|TUE|WED|THU|FRI|SAT|SUN),?\s+(?:(\d{2})\s+([A-Z]{3})|([A-Z]{3})\s+(\d{1,2})),?\s+(20\d{2})/i;

    const flightRe = /([A-Za-z][A-Za-z\s.&'-]+)\s+\(([A-Z0-9]{2})\)\s+(\d{1,4})/i;

    for (let i = 0; i < lines.length; i++) {
        const l = lines[i];

        // start segment
        const h = l.match(headerRe);
        if (h) {
            if (current) segments.push(current);

            const day = h[2] || h[5];
            const mon = h[3] || h[4];
            const year = h[6];

            const dateISO = toISODate(day, mon, year);

            // extract airport codes from current line
            const codes = l.match(/\(([A-Z]{3})\)/g) || [];
            const fromCode = codes[0] ? codes[0].replace(/[()]/g, "").toUpperCase() : "";
            const toCode = codes[1] ? codes[1].replace(/[()]/g, "").toUpperCase() : "";

            current = {
                segmentNo: segments.length + 1,
                flightNo: "",
                from: { city: "", airport: fromCode, terminal: "" },
                to: { city: "", airport: toCode, terminal: "" },
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

        // DEPART marker can be embedded in the line: "Confirmation Number: UONGRS DEPART"
        if (/\bDEPART\b/i.test(l)) {
            for (let j = 1; j <= 3; j++) {
                const next = (lines[i + j] || "").trim();
                const tm = next.match(/^(\d{1,2}:\d{2})\s*([A-Z]{2,3})?/i);
                if (tm) {
                    let fullTime = tm[1];
                    let ap = tm[2] || "";
                    if (!ap) {
                        const nextNext = (lines[i + j + 1] || "").trim();
                        if (/^(AM|PM)$/i.test(nextNext)) ap = nextNext;
                    }

                    const t = normalize24h(fullTime + ap);
                    if (current._dateISO && t) current.departure = `${current._dateISO} ${t}`;
                    if (tm[2] && tm[2].length === 3) current.from.airport = tm[2].toUpperCase();
                    break;
                }
            }
            continue;
        }

        if (/\bARRIVE\b/i.test(l)) {
            for (let j = 1; j <= 4; j++) {
                const next = (lines[i + j] || "").trim();
                const tm = next.match(/^(\d{1,2}:\d{2})\s*([A-Z]{2,3})?/i);
                if (tm) {
                    let fullTime = tm[1];
                    let ap = tm[2] || "";
                    if (!ap) {
                        const nextNext = (lines[i + j + 1] || "").trim();
                        if (/^(AM|PM)$/i.test(nextNext)) ap = nextNext;
                    }

                    const t = normalize24h(fullTime + ap);
                    // Check for +1 nearby
                    const near = lines.slice(i + j, i + j + 4).join(" ");
                    const hasPlus1 = /\+1\b/.test(near);
                    const arrDate = hasPlus1 ? addDaysISO(current._dateISO, 1) : current._dateISO;
                    if (arrDate && t) current.arrival = `${arrDate} ${t}`;
                    if (tm[2] && tm[2].length === 3) current.to.airport = tm[2].toUpperCase();
                    break;
                }
                // Handle standalone airport code on next line
                if (/^[A-Z]{3}$/.test(next) && !current.to.airport) {
                    current.to.airport = next;
                }
            }
            continue;
        }

        // Catch standalone airport codes if not already filled
        if (/^[A-Z]{3}$/.test(l)) {
            if (!current.from.airport) current.from.airport = l;
            else if (!current.to.airport) current.to.airport = l;
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
    const text = cleanText(rawText);

    const pnr = extractPnr(text);
    const altCode = extractAltReservationCode(text);

    const pax = extractPassengersAndETickets(text);
    const primaryPassenger = pax[0]?.name || "";
    const primaryTicket = pax[0]?.ticketNumber || "";
    const primaryType = pax[0]?.type || "UNKNOWN";

    const airline = extractAirlineFromFlights(text) || { name: "Ethiopian Airlines", iata: "ET", icao: "ETH" };
    let itinerary = extractSegments(text);
    if (!itinerary.length) itinerary = extractSegmentsOverview(text);

    const baggage = extractBaggage(text);
    if (baggage) {
        for (const seg of itinerary) seg.baggage = baggage;
    }

    // apply terminals
    const terminals = extractAirportInfoTerminals(text);
    for (const seg of itinerary) {
        if (terminals[seg.from.airport]) seg.from.terminal = terminals[seg.from.airport];
        if (terminals[seg.to.airport]) seg.to.terminal = terminals[seg.to.airport];
    }

    // cabin fallback
    const cabin = extractCabin(text);
    if (cabin) {
        for (const seg of itinerary) {
            if (!seg.cabin) seg.cabin = cabin;
        }
    }

    const notes = [];
    if (altCode) notes.push(`Reservation Code: ${altCode}`);
    if (pax.length) notes.push(`Passengers: ${pax.map(p => p.name).join("; ")}`);
    if (pax.length) notes.push(`eTickets: ${pax.map(p => p.ticketNumber).join("; ")}`);
    if (baggage) notes.push(`Baggage: ${baggage}`);

    const needsReview = !((pnr || altCode) && pax.length && itinerary.length);

    return {
        normalized: {
            airline,
            ticket: {
                pnr: pnr || "",              // primary PNR
                issueDate: "",
                issuingOffice: "",
                status: "UNKNOWN",
            },
            passengers: pax.map(p => ({
                fullName: p.name,
                type: p.type || "UNKNOWN",
                ticketNumber: p.ticketNumber,
                passportNumber: "",
                nationality: "",
            })),
            itinerary,
            fare: { currency: "", base: 0, taxes: 0, total: 0, breakdown: [] },
            notes,
        },
        confidence: Math.min(
            1,
            ((pnr || altCode) ? 0.35 : 0) +
            (pax.length ? 0.25 : 0) +
            (itinerary.length ? 0.25 : 0) +
            (pax[0]?.ticketNumber ? 0.15 : 0)
        ),
        processingStatus: needsReview ? "NEEDS_REVIEW" : "READY",
    };
}
