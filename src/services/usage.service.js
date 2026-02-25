import Usage from "../models/Usage.js";
import { getPeriodKey, getMonthStart, getMonthEnd } from "../utils/billingPeriod.js";

export async function incrementRecordUsage({ agencyId, at = new Date() }) {
    const periodKey = getPeriodKey(at);

    const update = await Usage.findOneAndUpdate(
        { agencyId, periodKey, locked: { $ne: true } },
        {
            $setOnInsert: {
                agencyId,
                periodKey,
                periodStart: getMonthStart(at),
                periodEnd: getMonthEnd(at),
            },
            $inc: { recordsCreated: 1 },
            $set: { lastRecordAt: at },
        },
        { upsert: true, new: true }
    );

    return update;
}
