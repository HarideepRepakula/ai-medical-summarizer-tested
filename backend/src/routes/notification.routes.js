import express from "express";
import { getUnreadNotifications, markNotificationsRead } from "../services/notificationService.js";

const router = express.Router();

// GET /api/notifications — Get unread in-app notifications
router.get("/", async (req, res) => {
	try {
		const notifications = await getUnreadNotifications(req.user.userId);
		res.json({ success: true, data: { notifications, count: notifications.length } });
	} catch (err) {
		res.status(500).json({ success: false, error: "Failed to fetch notifications." });
	}
});

// PATCH /api/notifications/read — Mark as read
router.patch("/read", async (req, res) => {
	try {
		const { ids } = req.body; // Array of notification IDs
		if (!ids?.length) return res.status(400).json({ success: false, error: "ids array required." });
		await markNotificationsRead(req.user.userId, ids);
		res.json({ success: true, message: "Marked as read." });
	} catch (err) {
		res.status(500).json({ success: false, error: "Failed to mark notifications." });
	}
});

export default router;
