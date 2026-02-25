import multer from "multer";
import path from "path";
import fs from "fs";

const dir = path.resolve("uploads", "receipts");
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, dir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const safe = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, safe);
  },
});

function fileFilter(req, file, cb) {
  // allow images + pdf
  const ok = ["image/jpeg", "image/png", "application/pdf"].includes(file.mimetype);
  cb(ok ? null : new Error("Only JPG/PNG/PDF allowed"), ok);
}

export const uploadReceipt = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });