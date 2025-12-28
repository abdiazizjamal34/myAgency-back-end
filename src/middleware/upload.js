import multer from 'multer';
import path from 'path';
import fs from 'fs';

const destDir = path.resolve('uploads', 'agencies');
if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, destDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = `${Date.now()}-${Math.round(Math.random()*1e6)}${ext}`;
    cb(null, name);
  }
});

function fileFilter(req, file, cb) {
  const allowed = ['.png', '.jpg', '.jpeg', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowed.includes(ext)) return cb(new Error('Only images are allowed'));
  cb(null, true);
}

export const uploadAgencyLogo = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB
}).single('logo');


// src/middleware/uploadTicketFile.js
// import multer from 'multer';
// import path from 'path';
// import fs from 'fs';

// const destDir = path.resolve('uploads', 'tickets');
// if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

// const storage = multer.diskStorage({
//   destination: (req, file, cb) => cb(null, destDir),
//   filename: (req, file, cb) => {
//     const ext = path.extname(file.originalname).toLowerCase();
//     const name = `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
//     cb(null, name);
//   },
// });

// function fileFilter(req, file, cb) {
//   const allowed = ['.pdf', '.png', '.jpg', '.jpeg', '.webp'];
//   const ext = path.extname(file.originalname).toLowerCase();
//   if (!allowed.includes(ext)) return cb(new Error('Only PDF or images are allowed'));
//   cb(null, true);
// }

// export const uploadTicketFile = multer({
//   storage,
//   fileFilter,
//   limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
// }).single('file'); // field name: file
