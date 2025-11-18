const { Invoice } = require("../model/Invoice");
const Activity = require("../model/Activity");
const { getCurrencySymbol } = require("./currencyHelper");

/**
 * Migrate existing invoices to activities
 * This should be run once to populate the Activity table from existing data
 */
async function migrateExistingInvoices() {
  try {

    // Get all invoices
    const invoices = await Invoice.findAll({
      order: [['createdAt', 'ASC']],
      attributes: ['id', 'client', 'workType', 'totalAmount', 'currency', 'status', 'createdAt', 'updatedAt', 'isRecurring', 'userId', 'recurringFrequency']
    });


    let activitiesCreated = 0;

    for (const invoice of invoices) {
      // Create invoice_created activity
      await Activity.create({
        userId: invoice.userId,
        type: 'invoice_created',
        text: `Invoice created for ${invoice.client} - ${invoice.workType} (${getCurrencySymbol(invoice.currency)}${invoice.totalAmount.toFixed(2)})`,
        invoiceId: invoice.id,
        metadata: {
          client: invoice.client,
          workType: invoice.workType,
          totalAmount: invoice.totalAmount,
          currency: invoice.currency,
          status: invoice.status
        },
        createdAt: invoice.createdAt,
        updatedAt: invoice.createdAt
      });
      activitiesCreated++;

      // If invoice was updated after creation, create update activity
      const timeDiff = new Date(invoice.updatedAt) - new Date(invoice.createdAt);
      if (timeDiff > 2000) {
        let activityType = 'invoice_updated';
        let activityText = `Invoice for ${invoice.client} updated`;

        if (invoice.status === 'Paid') {
          activityType = 'payment_received';
          activityText = `Payment received from ${invoice.client} (${getCurrencySymbol(invoice.currency)}${invoice.totalAmount.toFixed(2)})`;
        } else if (invoice.status === 'Sent') {
          activityType = 'email_sent';
          activityText = `Invoice sent to ${invoice.client}`;
        } else if (invoice.status === 'Overdue') {
          activityType = 'invoice_updated';
          activityText = `Invoice for ${invoice.client} marked as overdue`;
        }

        await Activity.create({
          userId: invoice.userId,
          type: activityType,
          text: activityText,
          invoiceId: invoice.id,
          metadata: {
            client: invoice.client,
            status: invoice.status,
            totalAmount: invoice.totalAmount
          },
          createdAt: invoice.updatedAt,
          updatedAt: invoice.updatedAt
        });
        activitiesCreated++;
      }

      // If recurring, create recurring_started activity
      if (invoice.isRecurring) {
        await Activity.create({
          userId: invoice.userId,
          type: 'recurring_started',
          text: `Recurring invoice started for ${invoice.client} (${invoice.recurringFrequency})`,
          invoiceId: invoice.id,
          metadata: {
            client: invoice.client,
            frequency: invoice.recurringFrequency
          },
          createdAt: invoice.createdAt,
          updatedAt: invoice.createdAt
        });
        activitiesCreated++;
      }
    }

    return { success: true, activitiesCreated, invoicesProcessed: invoices.length };
  } catch (error) {
    console.error("Error migrating activities:", error);
    return { success: false, error: error.message };
  }
}

module.exports = { migrateExistingInvoices };
