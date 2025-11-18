const express = require("express");
const { 
  createInvoice, 
  getInvoices, 
  deleteInvoice, 
  updateInvoice,
  getRecurringInvoices,
  updateRecurringInvoice,
  triggerRecurringProcessing,
  previewInvoice,
  downloadInvoice,
  stopRecurring
} = require("../controllers/invoiceController");
const { authenticate } = require("../middleware/authh"); // Middleware for user authentication
const router = express.Router();

// Static routes first (before dynamic :id routes)
router.post("/", authenticate, createInvoice); 
router.get("/", authenticate, getInvoices);
router.get("/recurring", authenticate, getRecurringInvoices);
router.post("/recurring/process", authenticate, triggerRecurringProcessing);

// Dynamic :id routes (these must come AFTER static routes)
router.get("/:id/preview", authenticate, previewInvoice);
router.get("/:id/download", authenticate, downloadInvoice);
router.patch("/:id", authenticate, updateInvoice);
router.patch("/:id/recurring", authenticate, updateRecurringInvoice);
router.post("/:id/stop-recurring", authenticate, stopRecurring);
router.delete("/:id", authenticate, deleteInvoice);

module.exports = router;
