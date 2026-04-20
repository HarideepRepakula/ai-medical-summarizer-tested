import { Router } from "express";
import { getDoctors, getDoctorById, getEscalatedQueries, respondToEscalatedQuery } from "../controllers/doctor.controller.js";
import { requireRole } from "../middleware/rbac.js";

const router = Router();

router.get("/",                                          getDoctors);
router.get("/escalated-queries",   requireRole(["DOCTOR"]), getEscalatedQueries);
router.post("/escalated-queries/:queryId/respond", requireRole(["DOCTOR"]), respondToEscalatedQuery);
router.get("/:id",                                       getDoctorById);

export default router;
