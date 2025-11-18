const { Invoice } = require('../model/Invoice');

async function addInvoiceNumberColumn() {
  try {
    console.log('Starting invoice number migration...');

    // Add the column to the database
    await Invoice.sequelize.query(`
      ALTER TABLE "Invoices" 
      ADD COLUMN IF NOT EXISTS "invoiceNumber" VARCHAR(255) UNIQUE;
    `);

    console.log('Column added successfully.');

    // Get all existing invoices ordered by creation date
    const existingInvoices = await Invoice.findAll({
      order: [['createdAt', 'ASC']],
      attributes: ['id', 'invoiceNumber', 'createdAt']
    });

    console.log(`Found ${existingInvoices.length} existing invoices.`);

    // Generate invoice numbers for existing invoices
    let counter = 1;
    for (const invoice of existingInvoices) {
      if (!invoice.invoiceNumber) {
        const invoiceNum = `INV-${String(counter).padStart(4, '0')}`;
        await invoice.update({ invoiceNumber: invoiceNum });
        console.log(`Updated invoice ${invoice.id} with number ${invoiceNum}`);
        counter++;
      }
    }

    console.log('Invoice number migration completed successfully!');
  } catch (error) {
    console.error('Error during migration:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  addInvoiceNumberColumn()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = addInvoiceNumberColumn;
