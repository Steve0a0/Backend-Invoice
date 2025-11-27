const { Sequelize } = require("sequelize");

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const sequelize = queryInterface.sequelize;
    // Create documentType enum if it doesn't exist
    await sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_Invoices_documentType') THEN
          CREATE TYPE "enum_Invoices_documentType" AS ENUM ('invoice','quote');
        END IF;
      END$$;
    `);

      // Skipped: "documentType" column already exists
      // await sequelize.query(`
      //   ALTER TABLE "Invoices"
      //   ADD COLUMN "documentType" "enum_Invoices_documentType" DEFAULT 'invoice';
      // `);

    await sequelize.query(`
      UPDATE "Invoices" SET "documentType" = 'invoice' WHERE "documentType" IS NULL;
    `);

// Extend status enum with quote specific states
const statusValues = ["Accepted", "Declined", "Converted"];
for (const status of statusValues) {
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



    // Add quote specific columns
      // Skipped: "validUntil" column already exists
      // await sequelize.query(`
      //   ALTER TABLE "Invoices"
      //   ADD COLUMN "validUntil" TIMESTAMP WITH TIME ZONE;
      // `);

      // Skipped: "quoteId" column already exists
      // await sequelize.query(`
      //   ALTER TABLE "Invoices"
      //   ADD COLUMN "quoteId" UUID;
      // `);

      // Skipped: "convertedInvoiceId" column already exists
      // await sequelize.query(`
      //   ALTER TABLE "Invoices"
      //   ADD COLUMN "convertedInvoiceId" UUID;
      // `);
  },

  down: async (queryInterface, Sequelize) => {
    const sequelize = queryInterface.sequelize;

    await sequelize.query(`
      ALTER TABLE "Invoices"
      DROP COLUMN IF EXISTS "convertedInvoiceId";
    `);

    await sequelize.query(`
      ALTER TABLE "Invoices"
      DROP COLUMN IF EXISTS "quoteId";
    `);

    await sequelize.query(`
      ALTER TABLE "Invoices"
      DROP COLUMN IF EXISTS "validUntil";
    `);

    await sequelize.query(`
      ALTER TABLE "Invoices"
      DROP COLUMN IF EXISTS "documentType";
    `);

    await sequelize.query(`
      DROP TYPE IF EXISTS "enum_Invoices_documentType";
    `);
  },
};
