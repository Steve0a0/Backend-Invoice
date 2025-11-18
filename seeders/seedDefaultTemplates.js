const EmailTemplate = require("../model/EmailTemplate");

const seedDefaultTemplates = async () => {
  const existingDefaults = await EmailTemplate.findAll({ where: { isDefault: true } });
  if (existingDefaults.length > 0) {
    return;
  }

  await EmailTemplate.bulkCreate([
    {
      name: "Payment Reminder",
      subject: "Reminder: Invoice #{invoice_number} is due",
      content: `Hi {client_name}, your invoice #{invoice_number} for {amount} is due by {due_date}.`,
      isDefault: true,
      type: "payment_reminder",
    },
    {
      name: "Overdue Notice",
      subject: "Overdue: Invoice #{invoice_number}",
      content: `Hi {client_name}, your invoice #{invoice_number} is overdue. Please make the payment as soon as possible.`,
      isDefault: true,
      type: "overdue_notice",
    },
  ]);

};

module.exports = seedDefaultTemplates;
