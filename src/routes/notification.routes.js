import express from "express";
import { auth } from "../middleware/auth.js";
import {
  sendToSingleUser,
  broadcastMessage,
  notifyAgency,
} from "../controllers/notification.controller.js";
import NotificationHistory from "../models/NotificationHistory.js";

const router = express.Router();

// All routes are protected (need JWT)
router.use(auth);

// Send to one user
router.post("/send", sendToSingleUser);

// Broadcast to all users (SUPER_ADMIN only)
router.post("/broadcast", broadcastMessage);

// Notify a specific agency (SUPER_ADMIN or that AGENCY_ADMIN)
router.post("/agency", notifyAgency);

router.get("/history", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [history, total] = await Promise.all([
      NotificationHistory.find()
        .populate("sender", "name email")
        .populate("recipients.user", "name email phone")
        .populate("agency", "name code")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      NotificationHistory.countDocuments(),
    ]);
    /// pagination 
    res.json({
      data: history,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch notification history", error: err.message });
  }
});

export default router;
