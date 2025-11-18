const express = require("express");
const { saveEmailSettings, getEmailSettings,savePaypalSettings,saveStripeSettings,
    getStripeSettings, } = require("../controllers/emailSettingsController");
const { authenticate } = require("../middleware/authh");

const router = express.Router();

router.post("/paypal", authenticate, savePaypalSettings); // POST /api/email-settings/paypal
router.post("/", authenticate, saveEmailSettings); // POST /api/email-settings
router.get("/", authenticate, getEmailSettings); // GET /api/email-settings
router.post("/stripe", authenticate, saveStripeSettings); // POST /api/email-settings/stripe
router.get("/stripe", authenticate, getStripeSettings);

module.exports = router;
