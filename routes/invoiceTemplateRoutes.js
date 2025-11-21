const express = require("express");
const {
  createTemplate,
  getUserTemplates,
  updateTemplate,
  deleteTemplate,
} = require("../controllers/invoiceTemplateController");
const { authenticate } = require("../middleware/authh");
const InvoiceTemplate = require('../model/InvoiceTemplate');
const handlebars = require('handlebars');

const router = express.Router();

handlebars.registerHelper('increment', function(value) {
    return parseInt(value) + 1;
  });

// ✅ Existing CRUD Routes
router.post("/", authenticate, createTemplate);
router.get("/", authenticate, getUserTemplates);
router.put("/:id", authenticate, updateTemplate);
router.delete("/:id", authenticate, deleteTemplate);

// ✅ PDF Generation with html-pdf
router.get('/:id/html', authenticate, async (req, res) => {
    try {
      const templateId = req.params.id;
  
      const template = await InvoiceTemplate.findOne({
        where: { id: templateId, userId: req.user.id },
      });
  
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
  
      // ✅ Send the template HTML and metadata clearly
      res.status(200).json({
        id: template.id,
        title: template.title,
        templateHTML: template.templateHTML,
      });
  
    } catch (error) {
      console.error('Internal Server Error:', error);
      res.status(500).json({ message: "Internal server error", error: error.message });
    }
  });
module.exports = router;
