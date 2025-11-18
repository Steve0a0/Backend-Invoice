const fs = require('fs');
const path = require('path');
const InvoiceTemplate = require('../model/InvoiceTemplate');
const User = require('../model/User');
const sequelize = require('../config/database');

async function addClassicProfessionalTemplate() {
  try {
    // Connect to database
    await sequelize.authenticate();
    console.log('✅ Database connected');

    // Read the template file
    const templatePath = path.join(__dirname, '../templates/classic-professional-invoice.html');
    const templateHTML = fs.readFileSync(templatePath, 'utf-8');
    
    console.log(`✅ Template file read (${templateHTML.length} characters)`);

    // Get all users
    const users = await User.findAll();
    
    if (!users || users.length === 0) {
      console.error('❌ No users found. Please create a user first.');
      process.exit(1);
    }

    console.log(`👥 Found ${users.length} user(s). Adding template for each...`);

    // Create template for each user
    let created = 0;
    let updated = 0;

    for (const user of users) {
      // Check if user already has this template
      const existingTemplate = await InvoiceTemplate.findOne({
        where: { 
          userId: user.id,
          title: 'Classic Professional Invoice'
        }
      });

      if (existingTemplate) {
        // Update existing template
        await existingTemplate.update({
          templateHTML: templateHTML,
          description: 'Professional invoice template with classic serif typography and clean layout',
          category: 'Professional',
          currency: 'USD'
        });
        updated++;
        console.log(`   ✏️  Updated for user: ${user.email}`);
      } else {
        // Create new template
        await InvoiceTemplate.create({
          userId: user.id,
          title: 'Classic Professional Invoice',
          description: 'Professional invoice template with classic serif typography and clean layout',
          category: 'Professional',
          currency: 'USD',
          templateHTML: templateHTML
        });
        created++;
        console.log(`   ✅ Created for user: ${user.email}`);
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   Created: ${created}`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Total users processed: ${users.length}`);
    console.log('\n✅ All done!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the function
addClassicProfessionalTemplate();
