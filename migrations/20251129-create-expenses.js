/**
 * Migration: create Expenses table for receipt-based expense tracking.
 */
"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("Expenses", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        primaryKey: true,
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "Users",
          key: "id",
        },
        onDelete: "CASCADE",
      },
      invoiceId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: "Invoices",
          key: "id",
        },
        onDelete: "SET NULL",
      },
      sourceFileUrl: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: "Relative path/url to the uploaded receipt file",
      },
      vendor: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      description: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      expenseDate: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      amount: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      currency: {
        type: Sequelize.STRING,
        defaultValue: "USD",
        allowNull: false,
      },
      taxPercent: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      taxAmount: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      category: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM("pending_review", "confirmed", "matched"),
        allowNull: false,
        defaultValue: "pending_review",
      },
      confidenceScore: {
        type: Sequelize.FLOAT,
        allowNull: true,
        comment: "Average confidence score returned by extractor",
      },
      rawExtraction: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: "Full payload returned from OCR/AI service",
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    await queryInterface.addIndex("Expenses", ["userId"]);
    await queryInterface.addIndex("Expenses", ["invoiceId"]);
    await queryInterface.addIndex("Expenses", ["status"]);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("Expenses", ["status"]);
    await queryInterface.removeIndex("Expenses", ["invoiceId"]);
    await queryInterface.removeIndex("Expenses", ["userId"]);
    await queryInterface.dropTable("Expenses");
  },
};
