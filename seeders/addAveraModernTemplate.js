const { readFileSync } = require("fs");
const path = require("path");
const InvoiceTemplate = require("../model/InvoiceTemplate");
const User = require("../model/User");

async function seedAveraModernTemplate() {
  try {
    console.log("Seeding Avera Modern Invoice Template...");

    // Read the HTML template
    const templatePath = path.join(__dirname, "..", "templates", "avera-modern-invoice.html");
    const templateHTML = readFileSync(templatePath, "utf-8");

    // Get the first user (or you can specify a particular user)
    const user = await User.findOne();
    if (!user) {
      console.error("❌ No user found. Please create a user first.");
      return;
    }

    // Check if template already exists
    const existingTemplate = await InvoiceTemplate.findOne({
      where: { title: "Avera Modern" }
    });

    if (existingTemplate) {
      console.log("Template 'Avera Modern' already exists. Updating...");
      await existingTemplate.update({
        templateHTML,
        description: "Professional A4 invoice template with golden accent and clean design",
        category: "Professional",
        currency: "EUR"
      });
      console.log("✅ Template updated successfully!");
    } else {
      // Create new template
      await InvoiceTemplate.create({
        userId: user.id,
        title: "Avera Modern",
        templateHTML,
        description: "Professional A4 invoice template with golden accent and clean design",
        category: "Professional",
        currency: "EUR"
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
  seedAveraModernTemplate()
    .then(() => {
      console.log("Done!");
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = seedAveraModernTemplate;
