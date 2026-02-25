



import { Router } from "express";
import { auth } from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import { ROLES } from "../utils/constants.js";
import { getMyTemplate, updateMyTemplate } from "../controllers/ticketTemplate.controller.js";

const router = Router();
router.use(auth);

router.get("/my", requireRole(ROLES.SUPER_ADMIN, ROLES.AGENCY_ADMIN), getMyTemplate);
router.put("/my", requireRole(ROLES.SUPER_ADMIN, ROLES.AGENCY_ADMIN), updateMyTemplate);

export default router;
