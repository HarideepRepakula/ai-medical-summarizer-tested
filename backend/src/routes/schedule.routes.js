import { Router } from 'express';
import { getSchedule, addTimeSlot, blockTime } from '../controllers/schedule.controller.js';
const router = Router();

// Authentication is handled at the route level in index.js

router.get('/', getSchedule);
router.post('/add-slot', addTimeSlot);
router.post('/block-time', blockTime);

export default router;