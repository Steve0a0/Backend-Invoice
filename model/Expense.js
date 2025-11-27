const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const User = require("./User");
const { Invoice } = require("./Invoice");

const Expense = sequelize.define("Expense", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  sourceFileUrl: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: "Relative path/url to the uploaded receipt file",
  },
  vendor: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  description: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  expenseDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  amount: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  currency: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: "USD",
  },
  taxPercent: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  taxAmount: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  category: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM("pending_review", "confirmed", "matched"),
    allowNull: false,
    defaultValue: "pending_review",
  },
  confidenceScore: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  rawExtraction: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
});

Expense.belongsTo(User, { foreignKey: "userId", as: "owner" });
User.hasMany(Expense, { foreignKey: "userId", as: "expenses" });

Expense.belongsTo(Invoice, { foreignKey: "invoiceId", as: "invoice" });
Invoice.hasMany(Expense, { foreignKey: "invoiceId", as: "expenses" });

module.exports = Expense;
