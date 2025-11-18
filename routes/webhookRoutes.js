const express = require("express");
const Invoice = require("../model/Invoice"); // Assuming Invoice schema is defined
const router = express.Router();

router.post("/paypal/webhook", async (req, res) => {
  try {
    const event = req.body;

    if (event.event_type === "PAYMENT.SALE.COMPLETED") {
      const resource = event.resource;

      // Extract invoice ID from the description (or another identifier)
      const invoiceId = resource.description.match(/Invoice (\w+)/)[1];

      // Update the invoice status in the database
      const invoice = await Invoice.findById(invoiceId);
      if (invoice) {
        invoice.status = "Paid";
        await invoice.save();
        console.log(`Invoice ${invoiceId} marked as Paid.`);
      } else {
        console.error(`Invoice ${invoiceId} not found.`);
      }
    }

    res.status(200).send("Webhook received successfully.");
  } catch (error) {
    console.error("Error processing webhook:", error);
    res.status(500).send("Internal server error.");
  }
});

module.exports = router;
