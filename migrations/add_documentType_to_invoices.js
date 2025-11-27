// Migration to add documentType column to Invoices table
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Invoices', 'documentType', {
      type: Sequelize.ENUM('invoice', 'quote'),
      allowNull: false,
      defaultValue: 'invoice',
      comment: 'Identifies whether this record is a quote or an invoice',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Invoices', 'documentType');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Invoices_documentType";');
  }
};
