// src/routes/templates.routes.js
import express from "express";
import { listTemplates, createTemplate, updateTemplate } from "../controllers/templates.controller.js";
import { requireRole } from "../middleware/roles.js";
import auth from "../middleware/auth.js"; // <-- use your real JWT middleware path

const router = express.Router();

router.get("/", auth, listTemplates);
router.post("/", auth, requireRole("SUPER_ADMIN"), createTemplate);
router.put("/:id", auth, requireRole("SUPER_ADMIN"), updateTemplate);

export default router;
