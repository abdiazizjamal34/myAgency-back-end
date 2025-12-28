// src/controllers/agencyTicket.controller.js
import AgencyBranding from '../models/AgencyBranding.js';
import AgencySettings from '../models/AgencySettings.js';
import TicketTemplate from '../models/TicketTemplate.js';

/** GET /api/agency-ticket/branding */
export const getTicketBranding = async (req, res) => {
  try {
    const agencyId = req.user.agencyId;

    let branding = await AgencyBranding.findOne({ agencyId }).lean();
    if (!branding) {
      const created = await AgencyBranding.create({ agencyId });
      branding = created.toObject();
    }

    res.json({ data: branding });
  } catch (err) {
    res.status(500).json({ message: 'Failed to get branding', error: err.message });
  }
};

/** PUT /api/agency-ticket/branding */
export const updateTicketBranding = async (req, res) => {
  try {
    const agencyId = req.user.agencyId;

    const allowed = [
      'logoUrl',
      'primaryColor',
      'secondaryColor',
      'footerText',
      'contactPhone',
      'contactEmail',
      'website',
      'language',
      'paperSize',
    ];

    const patch = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) patch[k] = req.body[k];
    }

    const branding = await AgencyBranding.findOneAndUpdate(
      { agencyId },
      { $set: patch, $setOnInsert: { agencyId } },
      { new: true, upsert: true }
    ).lean();

    res.json({ message: 'Branding saved', data: branding });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update branding', error: err.message });
  }
};

/** GET /api/agency-ticket/settings */
export const getTicketSettings = async (req, res) => {
  try {
    const agencyId = req.user.agencyId;

    let settings = await AgencySettings.findOne({ agencyId })
      .populate('ticketTemplateId')
      .lean();

    if (!settings) {
      const defaultTemplate = await TicketTemplate.findOne({
        key: 'modern_a',
        isActive: true,
      }).lean();

      if (!defaultTemplate) {
        return res.status(500).json({
          message: 'Default template not found. Seed templates first (key: modern_a).',
        });
      }

      const created = await AgencySettings.create({
        agencyId,
        ticketTemplateId: defaultTemplate._id,
      });

      settings = await AgencySettings.findById(created._id)
        .populate('ticketTemplateId')
        .lean();
    }

    res.json({ data: settings });
  } catch (err) {
    res.status(500).json({ message: 'Failed to get settings', error: err.message });
  }
};

/** PUT /api/agency-ticket/settings */
export const updateTicketSettings = async (req, res) => {
  try {
    const agencyId = req.user.agencyId;
    const { ticketTemplateId, showFare, showBaggage, showNotes } = req.body;

    const patch = {};
    if (ticketTemplateId !== undefined) patch.ticketTemplateId = ticketTemplateId;
    if (showFare !== undefined) patch.showFare = !!showFare;
    if (showBaggage !== undefined) patch.showBaggage = !!showBaggage;
    if (showNotes !== undefined) patch.showNotes = !!showNotes;

    // Validate template choice
    if (patch.ticketTemplateId) {
      const tpl = await TicketTemplate.findOne({
        _id: patch.ticketTemplateId,
        isActive: true,
      }).lean();

      if (!tpl) return res.status(400).json({ message: 'Invalid or inactive ticketTemplateId' });
    }

    const settings = await AgencySettings.findOneAndUpdate(
      { agencyId },
      { $set: patch, $setOnInsert: { agencyId } },
      { new: true, upsert: true }
    )
      .populate('ticketTemplateId')
      .lean();

    res.json({ message: 'Settings saved', data: settings });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update settings', error: err.message });
  }
};
