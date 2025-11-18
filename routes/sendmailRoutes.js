const express = require("express");
const { sendInvoiceEmail , capturePayment, generateStripeLink, generatePayPalLink} = require("../controllers/sendmailController");
const { authenticate } = require("../middleware/authh");
const { Invoice } = require("../model/Invoice");
const InvoiceTemplate = require("../model/InvoiceTemplate"); // Correct import for Sequelize model

const path = require("path");


const router = express.Router();

// Route to send an invoice email
router.post("/send-email", authenticate, sendInvoiceEmail);
router.get("/paypal/return", async (req, res) => {
  try {
      await capturePayment(req, res);
      // ✅ Remove res.redirect() from here, let capturePayment handle it.
  } catch (error) {
      console.error("Error capturing PayPal payment:", error);
      res.status(500).json({ error: "Failed to capture payment.", details: error.message });
  }
});
router.get("/api/invoices", async (req, res) => {
  try {
      const invoices = await Invoice.findAll();
      res.json(invoices);
  } catch (error) {
      res.status(500).json({ error: "Failed to fetch invoices." });
  }
});


router.get("/templates/:id", authenticate, async (req, res) => {
  const { id } = req.params; // ✅ Extract ID properly
  console.log(`Fetching template with ID: ${id}`);

  try {
      const template = await InvoiceTemplate.findOne({ where: { id } });

      if (!template) {
          return res.status(404).json({ error: "Template not found" });
      }

      console.log("Invoice Template Fetched Successfully:", template.templateHTML); // ❌ This might be `undefined`

      res.status(200).json({ htmlContent: template.templateHTML }); // ✅ Ensure correct field is returned
  } catch (error) {
      console.error("❌ Error fetching template:", error);
      res.status(500).json({ error: "Failed to fetch template HTML" });
  }
});





// ✅ Stripe Success Payment Route
router.get("/stripe/success", async (req, res) => {
    try {
        const { invoiceId } = req.query;
        if (!invoiceId || invoiceId === "undefined") {
            return res.status(400).json({ error: "Invoice ID is required." });
        }
  
        await Invoice.update({ status: "Paid" }, { where: { id: invoiceId } });
  
        console.log(`Invoice ${invoiceId} marked as Paid.`);
  
        res.json({ message: "Invoice marked as paid." }); // Changed from redirect to JSON response
    } catch (error) {
        console.error("Error in Stripe success:", error);
        res.status(500).json({ error: "An error occurred while processing the payment." });
    }
  });
  
  
  // Stripe Webhook Route
router.post("/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY); // Use env var here
    const sig = req.headers["stripe-signature"];
  
    let event;
  
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET // Set this from your Stripe dashboard
      );
    } catch (err) {
      console.error("⚠️ Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  
    // Handle event types
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
  
      // You should store metadata like invoiceId when creating the session
      const invoiceId = session.metadata?.invoiceId;
  
      if (invoiceId) {
        try {
          await Invoice.update({ status: "Paid" }, { where: { id: invoiceId } });
          console.log(`✅ Stripe: Invoice ${invoiceId} marked as Paid.`);
        } catch (error) {
          console.error(`❌ Stripe: Failed to update invoice ${invoiceId}`, error);
        }
      }
    }
  
    res.status(200).json({ received: true });
  });
  


  router.post("/paypal/generate-payment-link", authenticate, async (req, res) => {
    try {
        const { invoiceId } = req.body;
        const userId = req.user.id; // Get user from authentication middleware

        if (!invoiceId) {
            return res.status(400).json({ error: "Invoice ID is required." });
        }

        // 🔹 Use `findOne` or `findByPk` (for Sequelize)
        const invoice = await Invoice.findOne({ where: { id: invoiceId } });

        if (!invoice) {
            return res.status(404).json({ error: "Invoice not found." });
        }

        // Call the existing function from sendmailController
        const paypalLink = await generatePayPalLink(invoice, userId);

        res.status(200).json({ paymentLink: paypalLink });
    } catch (error) {
        console.error("Error generating PayPal link:", error);
        res.status(500).json({ error: "Failed to generate PayPal payment link." });
    }
});

// ✅ Stripe Payment Link Generation Route
router.post("/stripe/generate-payment-link", authenticate, async (req, res) => {
    try {
        const { invoiceId } = req.body;
        const userId = req.user.id;

        if (!invoiceId) {
            return res.status(400).json({ error: "Invoice ID is required." });
        }

        // 🔹 Use `findOne` or `findByPk`
        const invoice = await Invoice.findOne({ where: { id: invoiceId } });

        if (!invoice) {
            return res.status(404).json({ error: "Invoice not found." });
        }

        // Call the existing function from sendmailController
        const stripeLink = await generateStripeLink(invoice, userId);

        res.status(200).json({ paymentLink: stripeLink });
    } catch (error) {
        console.error("Error generating Stripe link:", error);
        res.status(500).json({ error: "Failed to generate Stripe payment link." });
    }
});

module.exports = router;