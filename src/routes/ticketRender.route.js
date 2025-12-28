import { Router } from "express";
import { auth } from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import { ROLES } from "../utils/constants.js";
import { renderTicket, getRendered } from "../controllers/ticketRender.controller.js";

const router = Router();
router.use(auth);

// render PDF
router.post("/:id/render", requireRole(ROLES.SUPER_ADMIN, ROLES.AGENCY_ADMIN, ROLES.ACCOUNTANT), renderTicket);

// get rendered info (pdfUrl)
router.get("/:id/rendered", requireRole(ROLES.SUPER_ADMIN, ROLES.AGENCY_ADMIN, ROLES.ACCOUNTANT), getRendered);

export default router;
