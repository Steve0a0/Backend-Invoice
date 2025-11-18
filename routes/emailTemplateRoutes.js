
const express = require("express");
const {
  getTemplates,
  createTemplate,
  editTemplate,
  deleteTemplate,
} = require("../controllers/emailTemplateController");
const { authenticate } = require("../middleware/authh"); // Destructure the correct function
const router = express.Router();

// Routes
router.get("/", authenticate, getTemplates); // Fetch all templates
router.post("/", authenticate, createTemplate); // Create a new template
router.put("/:id", authenticate, editTemplate); // Edit a template
router.delete("/:id", authenticate, deleteTemplate); // Delete a template

module.exports = router;


