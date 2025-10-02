import Record from '../models/Record.js';
import { ROLES } from '../utils/constants.js';
import dayjs from 'dayjs';
// function baseMatch(req) {
//   const $match = {};
//   if (req.user.role === ROLES.SUPER_ADMIN) {
//     if (req.query.agencyId) $match.agency = req.query.agencyId;
//   } else {
//     $match.agency = req.user.agency;
//   }
//   const { from, to, type } = req.query;
//   if (from || to) {
//     $match.createdAt = {};
//     if (from) $match.createdAt.$gte = new Date(from);
//     if (to) $match.createdAt.$lte = new Date(to);
//   }
//   if (type) $match.typeOfService = type;
//   return $match;
// }


function baseMatch(req) {
  const $match = {};

  // existing agency scope
  if (req.user.role === 'SUPER_ADMIN') {
    if (req.query.agencyId) $match.agency = req.query.agencyId;
  } else {
    $match.agency = req.user.agency;
  }

  // NEW: support daily/month query
  let { from, to, day, month } = req.query;

  if (day) {
    // e.g. ?day=2025-08-28
    from = dayjs(day).startOf('day').toDate();
    to   = dayjs(day).endOf('day').toDate();
  }

  if (month) {
    // e.g. ?month=2025-08
    from = dayjs(month + "-01").startOf('month').toDate();
    to   = dayjs(month + "-01").endOf('month').toDate();
  }

  if (from || to) {
    $match.createdAt = {};
    if (from) $match.createdAt.$gte = new Date(from);
    if (to)   $match.createdAt.$lte = new Date(to);
  }

  if (req.query.type) {
    $match.typeOfService = req.query.type;
  }

  return $match;
}


export async function summary(req, res, next) {
  try {
    const pipeline = [
      { $match: baseMatch(req) },
      { $group: {
        _id: null,
        totalSelling: { $sum: '$sellingPrice' },
        totalBuying: { $sum: '$buyingPrice' },
        totalExpenses: { $sum: '$expenses' },
        totalCommission: { $sum: '$commission' },
        count: { $sum: 1 },
      } },
      { $addFields: {
        totalIncome: '$totalCommission',
        totalProfit: { $subtract: ['$totalCommission', '$totalExpenses'] },
      } },
      { $project: { _id: 0 } }
    ];
    const [result] = await Record.aggregate(pipeline);
    res.json(result || {
      totalSelling: 0, totalBuying: 0, totalExpenses: 0,
      totalCommission: 0, totalIncome: 0, totalProfit: 0, count: 0
    });
  } catch (err) { next(err); }
}

export async function byServiceType(req, res, next) {
  try {
    const pipeline = [
      { $match: baseMatch(req) },
      { $group: {
        _id: '$typeOfService',
        totalSelling: { $sum: '$sellingPrice' },
        totalBuying: { $sum: '$buyingPrice' },
        totalExpenses: { $sum: '$expenses' },
        totalCommission: { $sum: '$commission' },
        count: { $sum: 1 },
      } },
      { $addFields: {
        totalIncome: '$totalCommission',
        totalProfit: { $subtract: ['$totalCommission', '$totalExpenses'] },
      } },
      { $sort: { totalProfit: -1 } }
    ];
    const results = await Record.aggregate(pipeline);
    res.json(results);
  } catch (err) { next(err); }
}

// GET /api/reports/trend?group=day&range=7d
export async function trend(req, res, next) {
  try {
    const { group = "day", range = "7d" } = req.query;

    // Calculate date range
    const end = new Date();
    let start;
    if (range.endsWith("d")) {
      const days = parseInt(range);
      start = new Date();
      start.setDate(end.getDate() - days + 1);
    } else {
      start = new Date(end.getFullYear(), 0, 1); // fallback: this year
    }

    const pipeline = [
      { $match: { createdAt: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: {
            $dateToString: {
              format: group === "day" ? "%Y-%m-%d" : "%Y-%m",
              date: "$createdAt",
            },
          },
          profit: { $sum: { $subtract: ["$commission", "$expenses"] } },
        },
      },
      { $project: { period: "$_id", profit: 1, _id: 0 } },
      { $sort: { period: 1 } },
    ];

    const results = await Record.aggregate(pipeline);
    res.json(results);
  } catch (err) {
    next(err);
  }
}
