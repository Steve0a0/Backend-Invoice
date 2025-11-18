const express = require("express");
const seedDefaultTemplates = require("../seeders/seedDefaultTemplates");
const { authenticate } = require("../middleware/authh"); // your auth middleware
const { migrateExistingInvoices } = require("../utils/migrateActivities");
// Optionally add an isAdmin middleware too

const router = express.Router();

router.post("/seed-default-templates", authenticate, async (req, res) => {
  try {
    await seedDefaultTemplates();
    res.status(200).json({ message: "Default templates seeded successfully." });
  } catch (error) {
    console.error("Seeding error:", error);
    res.status(500).json({ error: "Failed to seed templates." });
  }
});

router.post("/migrate-activities", authenticate, async (req, res) => {
  try {
    const result = await migrateExistingInvoices();
    if (result.success) {
      res.status(200).json({ 
        message: "Activities migrated successfully.", 
        activitiesCreated: result.activitiesCreated,
        invoicesProcessed: result.invoicesProcessed
      });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    console.error("Migration error:", error);
    res.status(500).json({ error: "Failed to migrate activities." });
  }
});

module.exports = router;
