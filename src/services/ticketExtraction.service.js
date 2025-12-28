import fs from "fs/promises";
import path from "path";
import { createWorker } from "tesseract.js";
import { PDFParse } from "pdf-parse";

export async function extractTextFromPdfBuffer(buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text || "";
  } finally {
    await parser.destroy();
  }
}

export async function extractTextFromImageBuffer(buffer) {
  const worker = await createWorker("eng");
  try {
    const { data } = await worker.recognize(buffer);
    return data?.text || "";
  } finally {
    await worker.terminate();
  }
}

export async function extractRawTextFromFile(filePath) {
  const abs = path.resolve(filePath);
  const buffer = await fs.readFile(abs);
  const ext = path.extname(abs).toLowerCase();

  if (ext === ".pdf") return extractTextFromPdfBuffer(buffer);
  if ([".png", ".jpg", ".jpeg", ".webp"].includes(ext)) return extractTextFromImageBuffer(buffer);

  return "";
}
