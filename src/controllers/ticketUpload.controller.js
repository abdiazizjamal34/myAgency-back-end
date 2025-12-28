// src/controllers/ticketUpload.controller.js
import TicketDocument from '../models/TicketDocument.js';
import { extractRawTextFromFile } from '../services/ticketExtraction.service.js';
import { normalizeTicket } from '../services/ticketNormalizeRouter.service.js';

import path from 'path';
// NOTE: In Phase 2 MVP we do extraction in-process (works fine for low volume)
// Later you can move extraction to a queue worker.
export const uploadTicket = async (req, res) => {
  try {
    const agencyId = req.user.agency;
    const uploadedBy = req.user._id;


    if (!req.file) return res.status(400).json({ message: 'file is required (field name: file)' });

    // TODO: replace fileUrl with real storage (S3/local). MVP uses placeholder.
    // const fileUrl = `local://tickets/${Date.now()}_${req.file.originalname}`;
    const fileUrl = `/uploads/tickets/${path.basename(req.file.path)}`;

    // 1) Create initial document
    const doc = await TicketDocument.create({
      agencyId,
      uploadedBy,
      source: {
        fileType: req.file.mimetype === 'application/pdf' ? 'PDF' : (req.file.mimetype === 'image/png' ? 'PNG' : 'JPG'),
        fileUrl,
        rawTextStored: false,
        rawText: '',
        extractionConfidence: 0,
      },
      processingStatus: 'UPLOADED',
    });
    console.log("REQ.USER =", req.user);

    // 2) Extract text using the file path saved by multer
    const rawText = await extractRawTextFromFile(req.file.path);

    // 3) Normalize
    const { normalized, confidence, processingStatus } = normalizeTicket(rawText);

    // 4) Update document
    const updated = await TicketDocument.findByIdAndUpdate(
      doc._id,
      {
        $set: {
          'source.rawTextStored': true,
          'source.rawText': rawText,
          'source.extractionConfidence': confidence,
          airline: normalized.airline,
          ticket: normalized.ticket,
          passenger: normalized.passenger,
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
          passenger: normalized.passenger,
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
    const allowedRoots = ['airline', 'ticket', 'passenger', 'itinerary', 'fare', 'notes', 'processingStatus'];
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
