
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Only populate invoiceNumber for existing invoices
    const [results] = await queryInterface.sequelize.query(
      'SELECT id FROM "Invoices" ORDER BY "createdAt" ASC'
    );
    let counter = 1;
    for (const invoice of results) {
      const invoiceNum = `INV-${String(counter).padStart(4, '0')}`;
      await queryInterface.sequelize.query(
        `UPDATE "Invoices" SET "invoiceNumber" = :invoiceNum WHERE "id" = :id`,
        { replacements: { invoiceNum, id: invoice.id } }
      );
      counter++;
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Invoices', 'invoiceNumber');
  }
};
