const { readFileSync } = require("fs");
const path = require("path");
const InvoiceTemplate = require("../model/InvoiceTemplate");
const User = require("../model/User");

async function seedCompactTemplate() {
  try {
    console.log("Seeding Compact Invoice Template...");

    // Read the HTML template
  const templatePath = path.join(__dirname, "..", "templates", "compact-invoice.hbs");
    const templateHTML = readFileSync(templatePath, "utf-8");

    // Get the first user (or you can specify a particular user)
    const user = await User.findOne();
    if (!user) {
      console.error("❌ No user found. Please create a user first.");
      return;
    }

    // Check if template already exists
    const existingTemplate = await InvoiceTemplate.findOne({
      where: { title: "Compact Invoice" }
    });

    if (existingTemplate) {
      console.log("Template 'Compact Invoice' already exists. Updating...");
      await existingTemplate.update({
        templateHTML,
        description: "Compact 480px invoice template with clean design - perfect for smaller invoices and mobile viewing",
        category: "Modern",
        currency: "USD"
      });
      console.log("✅ Template updated successfully!");
    } else {
      // Create new template
      await InvoiceTemplate.create({
        userId: user.id,
        title: "Compact Invoice",
        templateHTML,
        description: "Compact 480px invoice template with clean design - perfect for smaller invoices and mobile viewing",
        category: "Modern",
        currency: "USD"
      });
      console.log("✅ Template created successfully!");
    }

    console.log("Seeding completed!");
  } catch (error) {
    console.error("Error seeding template:", error);
    throw error;
  }
}

// Run seeder if called directly
if (require.main === module) {
  seedCompactTemplate()
    .then(() => {
      console.log("Done!");
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = seedCompactTemplate;
