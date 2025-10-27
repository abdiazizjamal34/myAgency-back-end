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

    // determine agency: accept object { _id, ... } or id string, fallback to req.user.agency
    let agency = req.body.agency || req.query.agencyId;
    if (!agency) {
      agency = req.user && req.user.role === ROLES.SUPER_ADMIN ? undefined : req.user?.agency;
    }
    if (agency && typeof agency === 'object') agency = agency._id || agency.id || agency;
    if (!agency) return res.status(400).json({ message: 'Agency is required' });

    // parse numbers safely
    const sellingPrice = Number(req.body.sellingPrice) || 0;
    const buyingPrice = Number(req.body.buyingPrice) || 0;
    const expenses = Number(req.body.expenses) || 0;

    const data = {
      customerName: req.body.customerName,
      typeOfService: req.body.typeOfService,
      subService: req.body.subService || '',
      sellingPrice,
      buyingPrice,
      expenses,
      commission: sellingPrice - (buyingPrice + expenses),

      // additional frontend fields
      notes: req.body.notes ? String(req.body.notes).trim() : '',
      paymentMethod: req.body.paymentMethod ? String(req.body.paymentMethod).trim() : '',
      fromTo: req.body.fromTo ? String(req.body.fromTo).trim() : '',
      ticketNumber: req.body.ticketNumber ? String(req.body.ticketNumber).trim() : '',
      service: req.body.service || undefined,
      consultants: Array.isArray(req.body.consultants) ? req.body.consultants : [],

      createdBy: req.user?._id,
      agency,
    };

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

    // allow updates to new fields as well
    ['customerName', 'typeOfService', 'subService', 'sellingPrice', 'buyingPrice', 'expenses', 'notes', 'paymentMethod', 'service', 'consultants', 'fromTo', 'ticketNumber'].forEach(k => {
      if (req.body[k] !== undefined) {
        if (['sellingPrice','buyingPrice','expenses'].includes(k)) {
          record[k] = Number(req.body[k]) || 0;
        } else {
          record[k] = req.body[k];
        }
      }
    });

    // recompute commission after potential price changes
    record.commission = (Number(record.sellingPrice) || 0) - ((Number(record.buyingPrice) || 0) + (Number(record.expenses) || 0));

    // allow agency update for SUPER_ADMIN (accept object or id)
    if (req.body.agency !== undefined && req.user.role === ROLES.SUPER_ADMIN) {
      let newAgency = req.body.agency;
      if (typeof newAgency === 'object') newAgency = newAgency._id || newAgency.id || newAgency;
      record.agency = newAgency;
    }

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
