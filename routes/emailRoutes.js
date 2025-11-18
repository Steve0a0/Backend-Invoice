const express = require("express");
const { generateInvoicePDF , getInvoicePDF} = require("../controllers/emailController");

const router = express.Router();

router.post("/generate-invoice", generateInvoicePDF);
router.get("/get-invoice/:invoiceId", getInvoicePDF);
module.exports = router;
