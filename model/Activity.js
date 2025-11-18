const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const User = require("./User");

const Activity = sequelize.define("Activity", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: "Users",
      key: "id",
    },
  },
  type: {
    type: DataTypes.ENUM(
      // Invoice activities
      "invoice_created",
      "invoice_updated",
      "invoice_deleted",
      "invoice_duplicated",
      "invoice_downloaded",
      "invoice_previewed",
      // Recurring invoice activities
      "recurring_started",
      "recurring_stopped",
      "recurring_auto_generated",
      "recurring_email_sent",
      "recurring_failed",
      // Email activities
      "email_sent",
      "email_failed",
      // Email template activities
      "email_template_created",
      "email_template_updated",
      "email_template_deleted",
      // Payment activities
      "payment_received",
      "payment_failed",
      "payment_link_generated",
      // Settings activities
      "settings_updated",
      "email_settings_updated",
      "bank_details_updated",
      "profile_updated",
      // System activities
      "bulk_action_completed",
      "export_completed"
    ),
    allowNull: false,
  },
  text: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  invoiceId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: "Additional data like client name, amount, etc.",
  },
}, {
  timestamps: true,
  indexes: [
    {
      fields: ["userId", "createdAt"],
    },
    {
      fields: ["type"],
    },
  ],
});

// Define relationship
Activity.belongsTo(User, { foreignKey: "userId" });
User.hasMany(Activity, { foreignKey: "userId" });

module.exports = Activity;
