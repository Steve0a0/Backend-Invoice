const express = require("express");
const router = express.Router();
const customFieldController = require("../controllers/customFieldController");
const { authenticate } = require("../middleware/authh");

// Get active custom fields only (must come before /:id route)
router.get("/active", authenticate, customFieldController.getActiveCustomFields);

// Bulk update custom field order (must come before /:id route)
router.put("/order/bulk", authenticate, customFieldController.updateCustomFieldOrder);

// Get all custom fields for user
router.get("/", authenticate, customFieldController.getCustomFields);

// Create a new custom field
router.post("/", authenticate, customFieldController.createCustomField);

// Update a custom field
router.put("/:id", authenticate, customFieldController.updateCustomField);

// Delete a custom field
router.delete("/:id", authenticate, customFieldController.deleteCustomField);

module.exports = router;
