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
  const history = await NotificationHistory.find()
    .populate("sender", "name email")
    .populate("recipients.user", "name email phone")
    .populate("agency", "name code")
    .sort({ createdAt: -1 });

  res.json(history);
});

export default router;
