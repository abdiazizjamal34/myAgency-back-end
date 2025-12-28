import { normalizeEthiopian } from "./normalizeEthiopian.service.js";
import { normalizeTravelport } from "./normalizeTravelport.service.js";

function isTravelport(text) {
    const up = (text || "").toUpperCase();
    return up.includes("TRAVELPORT") && up.includes("VIEWTRIP") && up.includes();
}

export function normalizeTicket(rawText) {
    const text = (rawText || "").replace(/\r/g, "");

    if (isTravelport(text)) {
        return normalizeTravelport(text);
    }

    // default (Ethiopian format)
    return normalizeEthiopian(text);
}
