// src/controllers/ticketUpload.controller.js
import TicketDocument from '../models/TicketDocument.js';
import { extractRawTextFromFile } from '../services/ticketExtraction.service.js';
import { normalizeTicket } from '../services/ticketNormalizeRouter.service.js';

import path from 'path';
// NOTE: In Phase 2 MVP we do extraction in-process (works fine for low volume)
// Later you can move extraction to a queue worker.
import fs from 'fs';

// NOTE: In Phase 2 MVP we do extraction in-process (works fine for low volume)
// Later you can move extraction to a queue worker.
export const uploadTicket = async (req, res) => {
  try {
    const agencyId = req.user.agency;
    const uploadedBy = req.user._id;


    if (!req.file) return res.status(400).json({ message: 'file is required (field name: file)' });

    // Ephemeral processing: We do NOT store the fileUrl in DB, and we delete the file after extraction.

    // 1) Create initial document
    const doc = await TicketDocument.create({
      agencyId,
      uploadedBy,
      source: {
        fileType: req.file.mimetype === 'application/pdf' ? 'PDF' : (req.file.mimetype === 'image/png' ? 'PNG' : 'JPG'),
        fileUrl: "", // No longer storing file path
        rawTextStored: false,
        rawText: '',
        extractionConfidence: 0,
      },
      processingStatus: 'UPLOADED',
    });

    // 2) Extract text using the file path saved by multer
    let rawText = "";
    try {
      rawText = await extractRawTextFromFile(req.file.path);
    } catch (extractionErr) {
      console.error("Extraction failed:", extractionErr);
      // We still want to delete the file, so we catch here
    }

    // 3) Delete the file immediately after extraction attempt
    if (req.file.path) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error("Failed to delete temp file:", err);
        else console.log("Deleted temp file:", req.file.path);
      });
    }

    // 4) Normalize
    const { normalized, confidence, processingStatus } = normalizeTicket(rawText);

    // 5) Update document
    const updated = await TicketDocument.findByIdAndUpdate(
      doc._id,
      {
        $set: {
          'source.rawTextStored': true,
          'source.rawText': rawText,
          'source.extractionConfidence': confidence,
          airline: normalized.airline,
          ticket: normalized.ticket,
          passengers: normalized.passengers,
          itinerary: normalized.itinerary,
          fare: normalized.fare,
          notes: normalized.notes,
          processingStatus,
        },
      },
      { new: true }
    ).lean();

    res.status(201).json({
      message: 'Ticket uploaded and processed',
      data: updated,
    });
  } catch (err) {
    // If main logic fails, ensure file deletion if it exists
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, (unlinkErr) => {
        if (unlinkErr) console.error("Failed to delete temp file on error:", unlinkErr);
      });
    }
    res.status(500).json({ message: 'Upload failed', error: err.message });
  }
};

export const reprocessTicket = async (req, res) => {
  try {
    const agencyId = req.user.agencyId;
    const { id } = req.params;

    const ticket = await TicketDocument.findOne({ _id: id, agencyId });
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    const rawText = ticket?.source?.rawText || '';
    const { normalized, confidence, processingStatus } = normalizeTicket(rawText);

    const updated = await TicketDocument.findByIdAndUpdate(
      ticket._id,
      {
        $set: {
          'source.extractionConfidence': confidence,
          airline: normalized.airline,
          ticket: normalized.ticket,
          passengers: normalized.passengers,
          itinerary: normalized.itinerary,
          fare: normalized.fare,
          notes: normalized.notes,
          processingStatus,
        },
      },
      { new: true }
    ).lean();

    res.json({ message: 'Ticket reprocessed', data: updated });
  } catch (err) {
    res.status(500).json({ message: 'Reprocess failed', error: err.message });
  }
};

export const manualUpdateTicket = async (req, res) => {
  try {
    const agencyId = req.user.agencyId;
    const { id } = req.params;

    const ticket = await TicketDocument.findOne({ _id: id, agencyId });
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    // Allow manual patch for normalized fields only
    const allowedRoots = ['airline', 'ticket', 'passengers', 'itinerary', 'fare', 'notes', 'processingStatus'];
    const patch = {};
    for (const k of allowedRoots) {
      if (req.body[k] !== undefined) patch[k] = req.body[k];
    }

    const updated = await TicketDocument.findByIdAndUpdate(
      ticket._id,
      { $set: patch },
      { new: true }
    ).lean();

    res.json({ message: 'Ticket updated manually', data: updated });
  } catch (err) {
    res.status(500).json({ message: 'Manual update failed', error: err.message });
  }
};
