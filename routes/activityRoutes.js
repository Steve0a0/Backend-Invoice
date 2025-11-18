const express = require("express");
const router = express.Router();
const { getRecentActivities } = require("../controllers/activityController");
const { authenticate } = require("../middleware/authh");

// Get recent activities for the authenticated user
router.get("/", authenticate, getRecentActivities);

module.exports = router;
