// src/services/ticketNormalizationPrompt.service.js
import { Type } from '@google/genai';

export const SYSTEM_PROMPT = `
You are an expert travel ticket data extraction bot for ProfitMate.
Your job is to read raw text extracted from travel tickets (PDFs or images) and convert it into a strictly formatted JSON structure.

Follow these rules:
1. Extract the airline name, IATA code, and ICAO code if present.
2. Extract the ticket information including PNR (Booking Reference), Ticket Number, Issue Date, and Ticket Status (ISSUED, VOID, REFUNDED, UNKNOWN).
3. Extract all passengers. Guess the type (ADT, CHD, INF) if not explicitly stated, or leave as UNKNOWN. Include ticket/passport numbers if available next to their names.
4. Extract the full itinerary. A segment includes flight number, from/to airports, departure/arrival timestamps (ISO format if possible), cabin class, booking class, and baggage allowance.
5. Extract the fare breakdown: Currency, Base Fare, Total Taxes, and Total Fare.
6. Write any anomalies or notes into the 'notes' array.
7. You must return EXACTLY the JSON structure specified by the schema. No markdown, no extra text.
8. If a field is not found in the text, leave it as an empty string or default value. Do not invent information.
`;

export function getTicketSchema() {
    return {
        type: Type.OBJECT,
        properties: {
            airline: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING },
                    iata: { type: Type.STRING },
                    icao: { type: Type.STRING }
                }
            },
            ticketInfo: {
                type: Type.OBJECT,
                properties: {
                    pnr: { type: Type.STRING },
                    ticketNumber: { type: Type.STRING },
                    issueDate: { type: Type.STRING },
                    status: { type: Type.STRING, enum: ["ISSUED", "VOID", "REFUNDED", "UNKNOWN"] }
                }
            },
            passengers: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        fullName: { type: Type.STRING },
                        type: { type: Type.STRING, enum: ["ADT", "CHD", "INF", "ADULT", "CHILD", "INFANT", "UNKNOWN"] },
                        ticketNumber: { type: Type.STRING },
                        passportNumber: { type: Type.STRING },
                        nationality: { type: Type.STRING }
                    }
                }
            },
            itinerary: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        segmentNo: { type: Type.NUMBER },
                        flightNo: { type: Type.STRING },
                        from: {
                            type: Type.OBJECT,
                            properties: {
                                city: { type: Type.STRING },
                                airport: { type: Type.STRING },
                                code: { type: Type.STRING, description: "IATA code of the airport, e.g., ADD, JED, DXB" },
                                terminal: { type: Type.STRING }
                            }
                        },
                        to: {
                            type: Type.OBJECT,
                            properties: {
                                city: { type: Type.STRING },
                                airport: { type: Type.STRING },
                                code: { type: Type.STRING, description: "IATA code of the airport, e.g., ADD, JED, DXB" },
                                terminal: { type: Type.STRING }
                            }
                        },
                        departure: { type: Type.STRING },
                        arrival: { type: Type.STRING },
                        cabin: { type: Type.STRING },
                        bookingClass: { type: Type.STRING },
                        baggage: { type: Type.STRING },
                        seat: { type: Type.STRING }
                    }
                }
            },
            fare: {
                type: Type.OBJECT,
                properties: {
                    currency: { type: Type.STRING },
                    baseFare: { type: Type.NUMBER },
                    taxes: { type: Type.NUMBER },
                    total: { type: Type.NUMBER }
                }
            },
            notes: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
            },
            meta: {
                type: Type.OBJECT,
                properties: {
                    confidence: { type: Type.NUMBER, description: "Your confidence in the extraction between 0.0 and 1.0" }
                }
            }
        },
        required: ["airline", "ticketInfo", "passengers", "itinerary", "fare", "meta"]
    };
}
