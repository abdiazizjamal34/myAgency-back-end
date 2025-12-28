// // src/controllers/ticketTemplate.controller.js
// import TicketTemplate from '../models/TicketTemplate.js';

// /** GET /api/ticket-templates */
// export const listTicketTemplates = async (req, res) => {
//   try {
//     const isSuper = req.user?.role === 'SUPER_ADMIN';
//     const filter = isSuper ? {} : { isActive: true };

//     const templates = await TicketTemplate.find(filter)
//       .sort({ createdAt: -1 })
//       .lean();

//     res.json({ data: templates });
//   } catch (err) {
//     res.status(500).json({ message: 'Failed to list templates', error: err.message });
//   }
// };

// /** POST /api/ticket-templates (SUPER_ADMIN) */
// export const createTicketTemplate = async (req, res) => {
//   try {
//     const { name, key, type = 'PREMADE', schemaJson = {}, html = null, isActive = true } = req.body;

//     if (!name || !key) return res.status(400).json({ message: 'name and key are required' });

//     const exists = await TicketTemplate.findOne({ key }).lean();
//     if (exists) return res.status(409).json({ message: 'Template key already exists' });

//     const created = await TicketTemplate.create({ name, key, type, schemaJson, html, isActive });
//     res.status(201).json({ message: 'Template created', data: created });
//   } catch (err) {
//     res.status(500).json({ message: 'Failed to create template', error: err.message });
//   }
// };

// /** PUT /api/ticket-templates/:id (SUPER_ADMIN) */
// export const updateTicketTemplate = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { name, key, type, schemaJson, html, isActive } = req.body;

//     const tpl = await TicketTemplate.findById(id);
//     if (!tpl) return res.status(404).json({ message: 'Template not found' });

//     if (name !== undefined) tpl.name = name;
//     if (key !== undefined) tpl.key = key;
//     if (type !== undefined) tpl.type = type;
//     if (schemaJson !== undefined) tpl.schemaJson = schemaJson;
//     if (html !== undefined) tpl.html = html;
//     if (isActive !== undefined) tpl.isActive = !!isActive;

//     await tpl.save();
//     res.json({ message: 'Template updated', data: tpl });
//   } catch (err) {
//     if (err.code === 11000) return res.status(409).json({ message: 'Template key already exists' });
//     res.status(500).json({ message: 'Failed to update template', error: err.message });
//   }
// };


import TicketTemplate from "../models/TicketTemplate.js";

export async function getMyTemplate(req, res) {
  try {
    const agencyId = req.user.agency;

    let tpl = await TicketTemplate.findOne({ agencyId });
    if (!tpl) {
      tpl = await TicketTemplate.create({
        agencyId,
        brand: { agencyName: "" },
      });
    }

    return res.json({ data: tpl });
  } catch (e) {
    return res.status(500).json({ message: "Failed to get template", error: e.message });
  }
}

export async function updateMyTemplate(req, res) {
  try {
    const agencyId = req.user.agency;
    const update = req.body || {};

    const tpl = await TicketTemplate.findOneAndUpdate(
      { agencyId },
      { $set: update },
      { new: true, upsert: true }
    );

    return res.json({ data: tpl });
  } catch (e) {
    return res.status(500).json({ message: "Failed to update template", error: e.message });
  }
}
