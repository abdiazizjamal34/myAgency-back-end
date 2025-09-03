import Record from '../models/Record.js';
import { ROLES } from '../utils/constants.js';
import { validationResult } from 'express-validator';

import dayjs from 'dayjs';

function scope(req) {
  const query = {};
  if (req.user.role === ROLES.SUPER_ADMIN) {
    if (req.query.agencyId) query.agency = req.query.agencyId;
  } else {
    query.agency = req.user.agency;
  }
  return query;
}

export async function createRecord(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const data = {
      customerName: req.body.customerName,
      typeOfService: req.body.typeOfService,
      sellingPrice: req.body.sellingPrice,
      buyingPrice: req.body.buyingPrice,
      expenses: req.body.expenses || 0,
      notes: req.body.notes,
      createdBy: req.user._id,
      // agency: req.user.role === ROLES.SUPER_ADMIN ? (req.body.agency || req.query.agencyId) : req.user.agency,
      agency: req.body.agency
    };
    if (!data.agency) return res.status(400).json({ message: 'Agency is required' });
    const record = await Record.create(data);
    res.status(201).json(record);
  } catch (err) { next(err); }
}


export async function listRecords(req, res, next) {
  try {
    const query = scope(req);

    let { from, to, type, day, month } = req.query;

    // Daily filter (example: ?day=2025-08-28)
    if (day) {
      from = dayjs(day).startOf('day').toDate();
      to   = dayjs(day).endOf('day').toDate();
    }

    // Monthly filter (example: ?month=2025-08)
    if (month) {
      from = dayjs(month + "-01").startOf('month').toDate();
      to   = dayjs(month + "-01").endOf('month').toDate();
    }

    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }

    if (type) query.typeOfService = type;

    const records = await Record.find(query).sort({ createdAt: -1 });
    res.json(records);
  } catch (err) { next(err); }
}


export async function getRecord(req, res, next) {
  try {
    const query = scope(req);
    query._id = req.params.id;
    const record = await Record.findOne(query);
    if (!record) return res.status(404).json({ message: 'Record not found' });
    res.json(record);
  } catch (err) { next(err); }
}

export async function updateRecord(req, res, next) {
  try {
    const query = scope(req);
    query._id = req.params.id;
    const record = await Record.findOne(query);
    if (!record) return res.status(404).json({ message: 'Record not found' });
    ['customerName', 'typeOfService', 'sellingPrice', 'buyingPrice', 'expenses', 'notes'].forEach(k => {
      if (req.body[k] !== undefined) record[k] = req.body[k];
    });
    await record.save();
    res.json(record);
  } catch (err) { next(err); }
}

export async function deleteRecord(req, res, next) {
  try {
    const query = scope(req);
    query._id = req.params.id;
    const record = await Record.findOne(query);
    if (!record) return res.status(404).json({ message: 'Record not found' });
    await record.deleteOne();
    res.json({ message: 'Record deleted' });
  } catch (err) { next(err); }
}
