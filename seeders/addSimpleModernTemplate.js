const fs = require('fs');
const path = require('path');
const InvoiceTemplate = require('../model/InvoiceTemplate');
const sequelize = require('../config/database');

async function addSimpleModernTemplate() {
  try {
    // Connect to database
    await sequelize.authenticate();
    console.log('✅ Database connected');

    // Read the template file
    const templatePath = path.join(__dirname, '../templates/simple-modern-invoice.html');
    const templateHTML = fs.readFileSync(templatePath, 'utf-8');
    
    console.log(`✅ Template file read (${templateHTML.length} characters)`);

    // You need to provide a userId - get it from your database or use an existing user
    // For now, I'll show you how to get the first user or you can hardcode your user ID
    const User = require('../model/User');
    const user = await User.findOne();
    
    if (!user) {
      console.error('❌ No user found. Please create a user first.');
      process.exit(1);
    }

    console.log(`📧 Using user: ${user.email} (${user.id})`);

    // Create the template
    const template = await InvoiceTemplate.create({
      userId: user.id,
      title: 'Simple Modern Invoice (Universal)',
      description: 'A clean, modern invoice template that automatically adapts to all invoice types (Hourly, Fixed Price, Daily, Simple Amount)',
      category: 'Professional',
      currency: 'USD',
      templateHTML: templateHTML
    });

    console.log('✅ Template created successfully!');
    console.log(`   ID: ${template.id}`);
    console.log(`   Title: ${template.title}`);
    console.log(`   HTML Length: ${template.templateHTML.length} chars`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the function
addSimpleModernTemplate();
