// src/services/ticketNormalize.service.js
// Ethiopian Airlines (ET) ticket normalization: multi-segment + passengers + seats + eTickets

const ET_TICKET_RE = /\b071[\s-]*\d{3}[\s-]*\d{7}\b/g;
const RES_CODE_RE = /RESERVATION\s+CODE\s+([A-Z0-9]{5,8})/i;

const MONTHS = {
  JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
  JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12",
};

const STOP_CODES = new Set([
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "SEPT", "OCT", "NOV", "DEC",
  "MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"
]);

function detectAirline(text) {
  const up = (text || "").toUpperCase();
  if (up.includes("ETHIOPIAN AIRLINES")) {
    return { name: "Ethiopian Airlines", iata: "ET", icao: "ETH" };
  }
  return { name: "", iata: "", icao: "" };
}

function extractPnr(text) {
  const m = text.match(RES_CODE_RE);
  return m ? m[1].toUpperCase() : "";
}

function extractPassengers(text) {
  // best source: PREPARED FOR block (often lists all passengers)
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  const idx = lines.findIndex(l => l.toUpperCase() === "PREPARED FOR");
  const prepared = [];
  if (idx >= 0) {
    for (let i = idx + 1; i < lines.length; i++) {
      const L = lines[i];
      if (/^RESERVATION\s+CODE/i.test(L)) break;
      if (L.length >= 3 && !prepared.includes(L)) prepared.push(L);
    }
  }

  // backup: bullet lines "» Name ..."
  const bullets = [];
  for (const line of lines) {
    const m = line.match(/^»\s*([A-Za-z][A-Za-z\s.'-]{2,})/);
    if (m) {
      const name = m[1].trim();
      if (name && !bullets.includes(name)) bullets.push(name);
    }
  }

  return prepared.length ? prepared : bullets;
}

// function extractEticketNumbers(text) {
//   const m = text.match(ET_TICKET_RE) || [];
//   return [...new Set(m)];
// }

function extractEticketNumbers(text) {
  const matches = text.match(ET_TICKET_RE) || [];
  const cleaned = matches.map(x => x.replace(/[\s-]/g, ""));

  // fallback: digit runs
  const digitRuns = text.match(/\d{8,20}/g) || [];
  for (const run of digitRuns) {
    if (run.startsWith("071") && run.length === 13) cleaned.push(run);
  }

  return [...new Set(cleaned)];
}



function extractStatus(text) {
  const m = text.match(/Status:\s*(Confirmed|Cancelled|Ticketed|On hold|Pending)/i);
  return m ? m[1] : "";
}

function normalizeTime(t) {
  const s = (t || "").replace(/\s+/g, "").toUpperCase(); // "3:30PM"
  const m = s.match(/^(\d{1,2}):(\d{2})(AM|PM)$/);
  if (!m) return s;
  const hh = m[1].padStart(2, "0");
  return `${hh}:${m[2]}${m[3]}`; // "03:30PM"
}


function extractHeaderYearMap(text) {
  // handles common header pattern: "03 NOV 2025    31 JAN 2026 ..."
  const m = text.match(/(\d{2})\s+NOV\s+(20\d{2}).*?(\d{2})\s+JAN\s+(20\d{2})/i);
  const map = {};
  if (m) {
    map.NOV = m[2];
    map.JAN = m[4];
  }
  return map;
}

function extractDepartureDates(text) {
  // returns ISO dates per segment in order of appearance
  const lines = text.split("\n").map(l => l.trim());
  const yearMap = extractHeaderYearMap(text);
  const dates = [];

  for (const l of lines) {
    const m = l.match(/^DEPARTURE:\s*[A-Z]+\s+(\d{2})\s+([A-Z]{3})/i);
    if (m) {
      const dd = m[1];
      const monAbbr = m[2].toUpperCase();
      const mon = MONTHS[monAbbr];
      const yyyy =
        yearMap[monAbbr] ||
        (text.match(/\b(20\d{2})\b/)?.[1] || "");

      if (yyyy && mon) dates.push(`${yyyy}-${mon}-${dd}`);
    }
  }
  return dates;
}

function extractSeatLines(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const seats = [];

  for (const l of lines) {
    // matches:
    // » Name 16C 0712157130294
    // » Name 16C
    const m = l.match(/^»\s*([A-Za-z][A-Za-z\s.'-]{2,})\s+(\d{1,2}[A-Z])(\s+\b071\d{10}\b)?$/);
    if (m) seats.push(`${m[1].trim()}: ${m[2]}`);
  }

  return seats;
}


// function extractETSegments(rawText) {
//   const lines = rawText.split("\n").map(l => l.trim()).filter(Boolean);

//   const segments = [];
//   let current = null;
//   let terminalCount = 0;

//   const isAirportCode = (s) => /^[A-Z]{3}$/.test(s) && !STOP_CODES.has(s);

//   for (const line of lines) {
//     // Segment begins at flight line: "ET 0336"
//     const fm = line.match(/^ET\s+0?(\d{3,4})$/i);
//     if (fm) {
//       if (current) segments.push(current);

//       current = {
//         segmentNo: segments.length + 1,
//         flightNo: `ET${fm[1].padStart(4, "0")}`,
//         from: { city: "", airport: "", terminal: "" },
//         to: { city: "", airport: "", terminal: "" },
//         departure: "",
//         arrival: "",
//         cabin: "",
//         bookingClass: "",
//         baggage: "",
//         seat: "",
//       };

//       terminalCount = 0;
//       continue;
//     }

//     if (!current) continue;

//     // Cabin: "Economy / H"
//     const cm = line.match(/^Cabin:\s*(.+)$/i);
//     if (cm) {
//       const v = cm[1].trim();
//       current.cabin = v;
//       const parts = v.split("/").map(x => x.trim());
//       if (parts.length >= 2) current.bookingClass = parts[1];
//       continue;
//     }

//     // Departing At / Arriving At
//     const dm = line.match(/^Departing\s+At:\s*(.+)$/i);
//     if (dm) current.departure = normalizeTime(dm[1].trim());

//     const am = line.match(/^Arriving\s+At:\s*(.+)$/i);
//     if (am) current.arrival = normalizeTime(am[1].trim());

//     // Terminal (1st = departure terminal, 2nd = arrival terminal)
//     const tm = line.match(/^Terminal:\s*(.+)$/i);
//     if (tm) {
//       terminalCount += 1;
//       const t = tm[1].trim();
//       if (terminalCount === 1) current.from.terminal = t;
//       else if (terminalCount === 2) current.to.terminal = t;
//       continue;
//     }

//     // Airports: standalone 3-letter codes (ADD, EBB, JIJ, ...)
//     if (isAirportCode(line)) {
//       if (!current.from.airport) current.from.airport = line;
//       else if (!current.to.airport) current.to.airport = line;
//     }
//   }

//   if (current) segments.push(current);

//   return segments.filter(s => s.flightNo && s.from.airport && s.to.airport);
// }

function extractETSegments(rawText) {
  const lines = rawText
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);

  const segments = [];
  let current = null;
  let terminalCount = 0;

  const isAirportCode = (s) => /^[A-Z]{3}$/.test(s) && !STOP_CODES.has(s);

  // helper: read next non-empty line safely
  const nextLine = (i) => (i + 1 < lines.length ? lines[i + 1] : "");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Start segment at flight line: "ET 0336"
    const fm = line.match(/^ET\s+0?(\d{3,4})$/i);
    if (fm) {
      if (current) segments.push(current);

      current = {
        segmentNo: segments.length + 1,
        flightNo: `ET${fm[1].padStart(4, "0")}`,
        from: { city: "", airport: "", terminal: "" },
        to: { city: "", airport: "", terminal: "" },
        departure: "",
        arrival: "",
        cabin: "",
        bookingClass: "",
        baggage: "",
        seat: "",
      };

      terminalCount = 0;
      continue;
    }

    if (!current) continue;

    // Cabin label might be "Cabin:" then next line "Economy / H"
    if (/^Cabin:$/i.test(line)) {
      const v = nextLine(i);
      if (v && !/^[A-Z]+:$/.test(v)) {
        current.cabin = v.trim();
        const parts = current.cabin.split("/").map(x => x.trim());
        if (parts.length >= 2) current.bookingClass = parts[1];
      }
      continue;
    }

    // Departing At label then next line "10:10am"
    if (/^Departing\s+At:$/i.test(line)) {
      const v = nextLine(i);
      if (v) current.departure = normalizeTime(v.trim());
      continue;
    }

    // Arriving At label then next line "12:15pm"
    if (/^Arriving\s+At:$/i.test(line)) {
      const v = nextLine(i);
      if (v) current.arrival = normalizeTime(v.trim());
      continue;
    }

    // Terminal label then next line "TERMINAL 2" / "Not Available"
    if (/^Terminal:$/i.test(line)) {
      terminalCount += 1;
      const v = nextLine(i);
      const t = (v || "").trim();
      if (terminalCount === 1) current.from.terminal = t;
      else if (terminalCount === 2) current.to.terminal = t;
      continue;
    }

    // Airports: standalone codes
    if (isAirportCode(line)) {
      if (!current.from.airport) current.from.airport = line;
      else if (!current.to.airport) current.to.airport = line;
      continue;
    }
  }

  if (current) segments.push(current);

  return segments.filter(s => s.flightNo && s.from.airport && s.to.airport);
}

// function toISO(dateISO, time12) {
//   // dateISO: "2025-11-03", time12: "10:10AM"
//   const m = time12.match(/^(\d{2}):(\d{2})(AM|PM)$/);
//   if (!m) return "";
//   let hour = parseInt(m[1], 10);
//   const minute = parseInt(m[2], 10);
//   const ap = m[3];

//   if (ap === "PM" && hour !== 12) hour += 12;
//   if (ap === "AM" && hour === 12) hour = 0;

//   const hh = String(hour).padStart(2, "0");
//   const mm = String(minute).padStart(2, "0");
//   return `${dateISO}T${hh}:${mm}:00+03:00`;
// }



export function normalizeEthiopian(rawText) {
  const text = (rawText || "").replace(/\r/g, "");

  const airline = detectAirline(text);
  const pnr = extractPnr(text);
  const passengers = extractPassengers(text);
  const etickets = extractEticketNumbers(text);
  const status = extractStatus(text);

  // ✅ multi-segment itinerary
  const segments = extractETSegments(text);
  const depDates = extractDepartureDates(text);

  for (let i = 0; i < segments.length; i++) {
    const dateISO = depDates[i] || "";
    if (dateISO && segments[i].departure) segments[i].departure = `${dateISO} ${segments[i].departure}`;
    if (dateISO && segments[i].arrival) segments[i].arrival = `${dateISO} ${segments[i].arrival}`;

    //     segments[i].departure = toISO(dateISO, segments[i].departure);
    // segments[i].arrival   = toISO(dateISO, segments[i].arrival);

  }

  const itinerary = segments;

  const primaryPassenger = passengers[0] || "";

  const seatLines = extractSeatLines(text);

  // Create passengers array
  const paxArray = passengers.map((name, idx) => ({
    fullName: name,
    type: name.includes("(Child)") ? "CHILD" : "ADULT",
    ticketNumber: etickets[idx] || (idx === 0 ? (etickets[0] || "") : ""),
    passportNumber: "",
    nationality: "",
  }));

  // REQUIRED: PNR + at least 1 passenger + at least 1 segment
  const needsReview = !(pnr && paxArray.length && itinerary.length);

  return {
    normalized: {
      airline,
      ticket: {
        pnr,
        issueDate: "",
        issuingOffice: "",
        status: "UNKNOWN",
      },
      passengers: paxArray,
      itinerary,
      fare: { currency: "", base: 0, taxes: 0, total: 0, breakdown: [] },
      notes: [
        ...(status ? [`Booking Status: ${status}`] : []),
        ...(passengers.length > 1 ? [`Passengers: ${passengers.join("; ")}`] : []),
        ...(etickets.length > 1 ? [`eTickets: ${etickets.join("; ")}`] : []),
        ...(seatLines.length ? [`Seats: ${seatLines.join(", ")}`] : []),
      ],
    },
    confidence: Math.min(
      1,
      (pnr ? 0.35 : 0) +
      (paxArray.length ? 0.25 : 0) +
      (itinerary.length ? 0.25 : 0) +
      (etickets.length ? 0.15 : 0)
    ),
    processingStatus: needsReview ? "NEEDS_REVIEW" : "READY",
  };
}
