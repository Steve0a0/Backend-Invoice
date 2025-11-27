"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const sequelize = queryInterface.sequelize;

    // 1. Create enum if missing
    await sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_Invoices_documentType') THEN
          CREATE TYPE "enum_Invoices_documentType" AS ENUM ('invoice', 'quote');
        END IF;
      END$$;
    `);

    // 2. Add documentType column
    await sequelize.query(`
      ALTER TABLE "Invoices"
      ADD COLUMN IF NOT EXISTS "documentType" "enum_Invoices_documentType"
      DEFAULT 'invoice';
    `);

    // 3. Add validUntil, quoteId, convertedInvoiceId
    await sequelize.query(`
      ALTER TABLE "Invoices"
      ADD COLUMN IF NOT EXISTS "validUntil" TIMESTAMP WITH TIME ZONE;
    `);

    await sequelize.query(`
      ALTER TABLE "Invoices"
      ADD COLUMN IF NOT EXISTS "quoteId" UUID;
    `);

    await sequelize.query(`
      ALTER TABLE "Invoices"
      ADD COLUMN IF NOT EXISTS "convertedInvoiceId" UUID;
    `);

    // 4. Add missing enum statuses
    const extraStatuses = ["Accepted", "Declined", "Converted"];
    for (const status of extraStatuses) {
      await sequelize.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_enum
            WHERE enumlabel = '${status}'
              AND enumtypid = '"enum_Invoices_status"'::regtype
          ) THEN
            ALTER TYPE "enum_Invoices_status" ADD VALUE '${status}';
          END IF;
        END$$;
      `);
    }
  },

  down: async (queryInterface, Sequelize) => {
    const sequelize = queryInterface.sequelize;

    await sequelize.query(`ALTER TABLE "Invoices" DROP COLUMN IF EXISTS "convertedInvoiceId";`);
    await sequelize.query(`ALTER TABLE "Invoices" DROP COLUMN IF EXISTS "quoteId";`);
    await sequelize.query(`ALTER TABLE "Invoices" DROP COLUMN IF EXISTS "validUntil";`);
    await sequelize.query(`ALTER TABLE "Invoices" DROP COLUMN IF EXISTS "documentType";`);
    await sequelize.query(`DROP TYPE IF EXISTS "enum_Invoices_documentType";`);
  }
};
