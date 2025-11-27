const { Sequelize, DataTypes, Op } = require("sequelize");
const sequelize = require("../config/database");
const User = require("./User"); // Import User model

const Task = sequelize.define("Task", {
  description: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  // Hourly rate fields
  hours: {
    type: DataTypes.INTEGER,
    allowNull: true,  // Made optional for other item structures
  },
  rate: {
    type: DataTypes.FLOAT,
    allowNull: true,  // Made optional for other item structures
  },
  // Fixed price fields
  quantity: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  unitPrice: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  // Daily rate fields  
  days: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  // Simple amount field
  amount: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  // Total is calculated or direct amount
  total: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
});

const Invoice = sequelize.define("Invoice", {
  id: {
    type: DataTypes.UUID,
    defaultValue: Sequelize.UUIDV4,
    allowNull: false,
    primaryKey: true,
  },
  invoiceNumber: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
    comment: "Sequential invoice number like INV-0001, INV-0002, etc.",
  },
  client: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  documentType: {
    type: DataTypes.ENUM("invoice", "quote"),
    defaultValue: "invoice",
    allowNull: false,
    comment: "Identifies whether this record is a quote or an invoice",
  },
  clientEmail: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: "Client email for recurring invoices",
  },
  date: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  workType: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  currency: {
    type: DataTypes.STRING,
    defaultValue: "USD",
  },
  totalAmount: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM("Draft", "Sent", "Pending", "Paid", "Overdue", "Accepted", "Declined", "Converted"),
    defaultValue: "Draft",
  },
  validUntil: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: "Expiration date for quotes",
  },
  // Recurring Invoice Fields
  isRecurring: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  recurringFrequency: {
    type: DataTypes.ENUM("every-20-seconds", "every-minute", "daily", "weekly", "bi-weekly", "monthly", "monthly-test", "quarterly", "yearly"),
    allowNull: true,
  },
  recurringStartDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  recurringEndDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  nextRecurringDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  recurringCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: "Number of times this invoice has been sent",
  },
  maxRecurrences: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: "Maximum number of times to send (null = infinite)",
  },
  parentInvoiceId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: "Reference to original recurring invoice if this is a copy",
  },
  quoteId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: "Quote this invoice originated from (if applicable)",
  },
  convertedInvoiceId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: "Invoice created from this quote (if applicable)",
  },
  isFirstRecurringInvoice: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: "True only for the very first auto-generated invoice, false for subsequent ones",
  },
  autoSendEmail: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: "Automatically send email when recurring invoice is created",
  },
  emailTemplateId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: "Email template to use when sending recurring invoices",
  },
  invoiceTemplateId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: "Invoice PDF template to use when sending recurring invoices",
  },
  dayOfMonth: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 1,
      max: 31
    },
    comment: "Day of month (1-31) to send recurring monthly invoices. For months with fewer days, sends on last day of month.",
  },
  dayOfWeek: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 0,
      max: 6
    },
    comment: "Day of week (0=Sunday, 1=Monday, ..., 6=Saturday) for weekly recurring invoices.",
  },
  monthOfYear: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 1,
      max: 12
    },
    comment: "Month of year (1-12) for yearly recurring invoices.",
  },
  quarterMonth: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 1,
      max: 3
    },
    comment: "Month within quarter (1-3) for quarterly recurring invoices. 1=first month, 2=second, 3=third.",
  },
  recurringTime: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      is: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/  // HH:MM format (24-hour)
    },
    comment: "Time of day (HH:MM in 24-hour format) to send recurring invoices. Example: '09:00' for 9 AM, '14:30' for 2:30 PM.",
  },
  customFields: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {},
    comment: "Custom fields for flexible invoice data (e.g., PO Number, Tax ID, Notes, etc.)",
  },
  itemStructure: {
    type: DataTypes.ENUM('hourly', 'fixed_price', 'daily_rate', 'simple'),
    defaultValue: 'hourly',
    allowNull: false,
    comment: "Item structure type: hourly (rate x hours), fixed_price (quantity x unit price), daily_rate (rate x days), or simple (amount only)",
  },
  pdfTemplateSent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: "Whether invoice was sent with a PDF template attachment",
  },
  sentTemplateHTML: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: "The HTML template that was used to generate the PDF (for preview)",
  },
});

// Define relationships
Invoice.belongsTo(User, { foreignKey: "userId" });
User.hasMany(Invoice, { foreignKey: "userId" });

Invoice.hasMany(Task, { foreignKey: "invoiceId", as: "tasks", onDelete: "CASCADE" });
Task.belongsTo(Invoice, { foreignKey: "invoiceId", as: "invoice" });

module.exports = { Invoice, Task };
