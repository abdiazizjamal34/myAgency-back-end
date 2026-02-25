// src/controllers/agencyTicket.controller.js
import AgencyBranding from '../models/AgencyBranding.js';
import AgencySettings from '../models/AgencySettings.js';
import TicketTemplate from '../models/TicketTemplate.js';

const parseBooleanField = (value) => {
  if (typeof value === 'boolean') return value;

  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n'].includes(normalized)) return false;
  }

  return value;
};

/** GET /api/agency-ticket/branding */
export const getTicketBranding = async (req, res) => {
  try {
    const { agencyId } = req.user;

    const branding = await AgencyBranding.findOneAndUpdate(
      { agencyId },
      { $setOnInsert: { agencyId } },
      { new: true, upsert: true, lean: true }
    );

    res.json({ data: branding });
  } catch (err) {
    console.error('Failed to get branding', err);
    res.status(500).json({ message: 'Failed to get branding' });
  }
};

/** PUT /api/agency-ticket/branding */
export const updateTicketBranding = async (req, res) => {
  try {
    const { agencyId } = req.user;

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
    console.error('Failed to update branding', err);
    res.status(500).json({ message: 'Failed to update branding' });
  }
};

/** GET /api/agency-ticket/settings */
export const getTicketSettings = async (req, res) => {
  try {
    const { agencyId } = req.user;

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
    console.error('Failed to get settings', err);
    res.status(500).json({ message: 'Failed to get settings' });
  }
};

/** PUT /api/agency-ticket/settings */
export const updateTicketSettings = async (req, res) => {
  try {
    const { agencyId } = req.user;
    const { ticketTemplateId, showFare, showBaggage, showNotes } = req.body;

    const patch = {};
    if (ticketTemplateId !== undefined) patch.ticketTemplateId = ticketTemplateId;
    if (showFare !== undefined) patch.showFare = parseBooleanField(showFare);
    if (showBaggage !== undefined) patch.showBaggage = parseBooleanField(showBaggage);
    if (showNotes !== undefined) patch.showNotes = parseBooleanField(showNotes);

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
    console.error('Failed to update settings', err);
    res.status(500).json({ message: 'Failed to update settings' });
  }
};
