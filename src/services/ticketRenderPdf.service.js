import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";

const renderedDir = path.resolve("uploads", "rendered");
if (!fs.existsSync(renderedDir)) fs.mkdirSync(renderedDir, { recursive: true });

export async function renderHtmlToPdf({ html, fileNameBase = "ticket", format = "A4" }) {
  const safeBase = fileNameBase.replace(/[^a-zA-Z0-9-_]/g, "_");
  const fileName = `${Date.now()}_${safeBase}.pdf`;
  const absPath = path.join(renderedDir, fileName);
  const publicUrl = `/uploads/rendered/${fileName}`;

  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    await page.pdf({
      path: absPath,
      format: format === "LETTER" ? "Letter" : "A4",
      printBackground: true,
      margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
    });

    return { publicUrl };
  } finally {
    await browser.close();
  }
}
