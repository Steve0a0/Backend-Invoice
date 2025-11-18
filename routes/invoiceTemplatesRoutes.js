// routes/invoiceTemplates.js
const express = require('express');
const router = express.Router();
const InvoiceTemplate = require('../model/InvoiceTemplate');
const puppeteer = require('puppeteer');
const authMiddleware = require('../middleware/authh'); // Your existing auth middleware

// GET /invoiceTemplates/:id/pdf
router.get('/:id/pdf', authMiddleware, async (req, res) => {
  try {
    const templateId = req.params.id;

    // Fetch template from DB
    const template = await InvoiceTemplate.findOne({
      where: { id: templateId, userId: req.user.id },
    });

    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }

    // Generate PDF from templateHTML
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    await page.setContent(template.templateHTML, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
    });

    await browser.close();

    // Send PDF response
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${template.title}.pdf"`,
    });

    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
