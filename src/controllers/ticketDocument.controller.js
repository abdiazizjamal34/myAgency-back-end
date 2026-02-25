// src/controllers/ticketDocument.controller.js
import TicketDocument from '../models/TicketDocument.js';
import { ROLES } from '../utils/constants.js';

/** GET /api/tickets */
export const listTicketDocuments = async (req, res) => {
  try {
    let agencyId = req.user.agency;

    // Super Admin can override agencyId via query
    if (req.user.role === ROLES.SUPER_ADMIN && req.query.agencyId) {
      agencyId = req.query.agencyId;
    }

    const { page = 1, limit = 20, status, uploadedBy, q, sort = '-createdAt' } = req.query;
    const nPage = Math.max(parseInt(page, 10) || 1, 1);
    const nLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

    const filter = {};
    if (agencyId) filter.agencyId = agencyId;
    if (status) filter.processingStatus = status;
    if (uploadedBy) filter.uploadedBy = uploadedBy;

    if (q && String(q).trim()) {
      const s = String(q).trim();
      filter.$or = [
        { 'ticket.ticketNumber': { $regex: s, $options: 'i' } },
        { 'ticket.pnr': { $regex: s, $options: 'i' } },
        { 'passenger.fullName': { $regex: s, $options: 'i' } },
        { 'airline.name': { $regex: s, $options: 'i' } },
      ];
    }

    const [items, total] = await Promise.all([
      TicketDocument.find(filter)
        .sort(sort)
        .skip((nPage - 1) * nLimit)
        .limit(nLimit)
        .select({
          airline: 1,
          ticket: 1,
          passenger: 1,
          itinerary: 1,
          fare: 1,
          processingStatus: 1,
          createdAt: 1,
        })
        .lean(),
      TicketDocument.countDocuments(filter),
    ]);

    res.json({
      data: items,
      meta: { page: nPage, limit: nLimit, total, pages: Math.ceil(total / nLimit) || 1 },
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to list tickets', error: err.message });
  }
};

/** GET /api/tickets/agency/:agencyId */
export const listAgencyTickets = async (req, res) => {
  try {
    const { agencyId } = req.params;

    // Security: Super Admin can fetch any; others only their own
    if (req.user.role !== ROLES.SUPER_ADMIN && String(req.user.agency) !== agencyId) {
      return res.status(403).json({ message: "Forbidden: You can only access your own agency's tickets" });
    }

    const { page = 1, limit = 20, status, uploadedBy, q, sort = '-createdAt' } = req.query;
    const nPage = Math.max(parseInt(page, 10) || 1, 1);
    const nLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

    const filter = { agencyId };
    if (status) filter.processingStatus = status;
    if (uploadedBy) filter.uploadedBy = uploadedBy;

    if (q && String(q).trim()) {
      const s = String(q).trim();
      filter.$or = [
        { 'ticket.ticketNumber': { $regex: s, $options: 'i' } },
        { 'ticket.pnr': { $regex: s, $options: 'i' } },
        { 'passenger.fullName': { $regex: s, $options: 'i' } },
        { 'airline.name': { $regex: s, $options: 'i' } },
      ];
    }

    const [items, total] = await Promise.all([
      TicketDocument.find(filter)
        .sort(sort)
        .skip((nPage - 1) * nLimit)
        .limit(nLimit)
        .select({
          airline: 1,
          ticket: 1,
          passenger: 1,
          itinerary: 1,
          fare: 1,
          processingStatus: 1,
          createdAt: 1,
        })
        .lean(),
      TicketDocument.countDocuments(filter),
    ]);

    res.json({
      data: items,
      meta: { page: nPage, limit: nLimit, total, pages: Math.ceil(total / nLimit) || 1 },
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to list agency tickets', error: err.message });
  }
};

/** GET /api/tickets/:id */
export const getTicketDocument = async (req, res) => {
  try {
    const agencyId = req.user.agency;
    const { id } = req.params;

    const ticket = await TicketDocument.findOne({ _id: id, agencyId }).lean();
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    res.json({ data: ticket });
  } catch (err) {
    res.status(500).json({ message: 'Failed to get ticket', error: err.message });
  }
};
