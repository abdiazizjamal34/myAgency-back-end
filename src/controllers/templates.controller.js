// src/controllers/templates.controller.js
import TicketTemplate from "../models/TicketTemplate.js";

export const listTemplates = async (req, res) => {
  try {
    const isSuper = req.user?.role === "SUPER_ADMIN";
    const filter = isSuper ? {} : { isActive: true };

    const templates = await TicketTemplate.find(filter).sort({ createdAt: -1 }).lean();
    res.json({ data: templates });
  } catch (err) {
    res.status(500).json({ message: "Failed to list templates", error: err.message });
  }
};

export const createTemplate = async (req, res) => {
  try {
    const {
      name,
      key,
      type = "PREMADE",
      schemaJson = {},
      html = null,
      isActive = true,
    } = req.body;

    if (!name || !key) {
      return res.status(400).json({ message: "name and key are required" });
    }

    const exists = await TicketTemplate.findOne({ key }).lean();
    if (exists) return res.status(409).json({ message: "Template key already exists" });

    const created = await TicketTemplate.create({ name, key, type, schemaJson, html, isActive });
    res.status(201).json({ message: "Template created", data: created });
  } catch (err) {
    res.status(500).json({ message: "Failed to create template", error: err.message });
  }
};

export const updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, key, type, schemaJson, html, isActive } = req.body;

    const template = await TicketTemplate.findById(id);
    if (!template) return res.status(404).json({ message: "Template not found" });

    if (name !== undefined) template.name = name;
    if (key !== undefined) template.key = key;
    if (type !== undefined) template.type = type;
    if (schemaJson !== undefined) template.schemaJson = schemaJson;
    if (html !== undefined) template.html = html;
    if (isActive !== undefined) template.isActive = !!isActive;

    await template.save();
    res.json({ message: "Template updated", data: template });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "Template key already exists" });
    }
    res.status(500).json({ message: "Failed to update template", error: err.message });
  }
};
