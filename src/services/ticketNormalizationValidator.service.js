// src/services/ticketNormalizationValidator.service.js

export function validateTicketSchema(normalized) {
    let missingFields = [];
    let warnings = [];
    let confidence = normalized?.meta?.confidence || 0;

    // Ensure default structure
    const validated = {
        airline: normalized.airline || {},
        ticketInfo: normalized.ticketInfo || {},
        passengers: normalized.passengers || [],
        itinerary: normalized.itinerary || [],
        fare: normalized.fare || { baseFare: 0, taxes: 0, total: 0 },
        notes: normalized.notes || [],
        meta: normalized.meta || {}
    };

    // Layer 3: Backend validations

    // 1. Passengers
    if (validated.passengers.length === 0) {
        missingFields.push('passengers');
        confidence -= 0.3;
        warnings.push('No passengers were detected.');
    } else {
        // Find empty passenger names
        const emptyNames = validated.passengers.filter(p => !p.fullName || p.fullName.trim() === '');
        if (emptyNames.length > 0) {
            warnings.push(`${emptyNames.length} passenger(s) have missing names.`);
            confidence -= 0.1;
        }
    }

    // 2. Itinerary Segments
    if (validated.itinerary.length === 0) {
        missingFields.push('itinerary');
        confidence -= 0.3;
        warnings.push('No flight segments were detected.');
    }

    // 3. Ticket PNR or Ticket Number
    if (!validated.ticketInfo.pnr && !validated.ticketInfo.ticketNumber) {
        missingFields.push('pnr_or_ticketNumber');
        warnings.push('No PNR or Ticket Number detected.');
        confidence -= 0.2;
    }

    // Ensure Fare is numeric where appropriate
    if (validated.fare) {
        if (isNaN(validated.fare.baseFare)) validated.fare.baseFare = 0;
        if (isNaN(validated.fare.taxes)) validated.fare.taxes = 0;
        if (isNaN(validated.fare.total)) validated.fare.total = 0;
    }

    // Clamp confidence between 0 and 1
    confidence = Math.max(0, Math.min(1, confidence));

    let needsReview = false;
    let processingStatus = "READY";

    if (confidence < 0.6) {
        processingStatus = "FAILED";
    } else if (confidence < 0.90 || missingFields.length > 0) {
        processingStatus = "NEEDS_REVIEW";
        needsReview = true;
    }

    return {
        ...validated,
        meta: {
            ...validated.meta,
            confidence: Number(confidence.toFixed(2)),
            missingFields,
            warnings,
            needsReview
        },
        processingStatus
    };
}
