import { createRequire } from "module";
import fs from "fs";
const require = createRequire(import.meta.url);

let output = "";
function log(msg) {
    output += msg + "\n";
    console.log(msg);
}

try {
    const pdfImport = require("pdf-parse");
    log("PDF_DIAGNOSTIC: type = " + typeof pdfImport);
    log("PDF_DIAGNOSTIC: keys = " + JSON.stringify(Object.keys(pdfImport)));
    if (pdfImport && typeof pdfImport === 'object') {
        log("PDF_DIAGNOSTIC: default type = " + typeof pdfImport.default);
    }
} catch (err) {
    log("PDF_DIAGNOSTIC: error = " + err.message);
}

fs.writeFileSync("debug_pdf.log", output);
