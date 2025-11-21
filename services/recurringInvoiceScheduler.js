const { Invoice, Task } = require("../model/Invoice");
const { Op } = require("sequelize");
const emailController = require("../controllers/emailController");
const { getCurrencySymbol } = require("../utils/currencyHelper");
const { logActivity } = require("../utils/activityLogger");
const { imageToBase64 } = require("../utils/imageHelper");

/**
 * Generate next sequential invoice number
 */
async function generateInvoiceNumber() {
  try {
    // Find the last invoice with an invoice number
    const lastInvoice = await Invoice.findOne({
      where: {
        invoiceNumber: {
          [Op.ne]: null
        }
      },
      order: [['createdAt', 'DESC']]
    });

    let nextNumber = 1;
    
    if (lastInvoice && lastInvoice.invoiceNumber) {
      // Extract number from format INV-0001
      const match = lastInvoice.invoiceNumber.match(/INV-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }

    return `INV-${String(nextNumber).padStart(4, '0')}`;
  } catch (error) {
    // Fallback to timestamp-based number if there's an error
    return `INV-${Date.now().toString().slice(-4)}`;
  }
}

/**
 * Calculate next recurring date based on frequency
 */
function calculateNextRecurringDate(currentDate, frequency, dayOfMonth = null, dayOfWeek = null, monthOfYear = null, quarterMonth = null, recurringTime = null) {
  const next = new Date(currentDate);
  
  switch (frequency) {
    case "every-20-seconds": // For testing
      next.setSeconds(next.getSeconds() + 20);
      break;
    case "every-minute": // For testing
      next.setMinutes(next.getMinutes() + 1);
      break;
    case "daily":
      next.setDate(next.getDate() + 1);
      break;
    case "weekly":
      next.setDate(next.getDate() + 7);
      // If dayOfWeek is specified, adjust to that day
      if (dayOfWeek !== null && dayOfWeek !== undefined) {
        const currentDay = next.getDay();
        const daysUntilTarget = (dayOfWeek - currentDay + 7) % 7;
        if (daysUntilTarget > 0) {
          next.setDate(next.getDate() + daysUntilTarget);
        }
      }
      break;
    case "bi-weekly":
      next.setDate(next.getDate() + 14);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + 1);
      // If dayOfMonth is specified, set to that day
      if (dayOfMonth) {
        // Get the last day of the target month
        const lastDayOfMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
        // Use the specified day, or last day if month doesn't have that many days
        next.setDate(Math.min(dayOfMonth, lastDayOfMonth));
      }
      break;
    case "monthly-test": // For testing monthly logic with 2-minute intervals
      next.setMinutes(next.getMinutes() + 2);
      // Still apply dayOfMonth logic for demonstration
      break;
    case "quarterly":
      next.setMonth(next.getMonth() + 3);
      // If quarterMonth and dayOfMonth are specified
      if (quarterMonth && dayOfMonth) {
        // Adjust to the specified month within the quarter
        const currentMonth = next.getMonth();
        const quarterStartMonth = Math.floor(currentMonth / 3) * 3; // 0, 3, 6, or 9
        const targetMonth = quarterStartMonth + (quarterMonth - 1);
        next.setMonth(targetMonth);
        
        // Set the day
        const lastDayOfMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
        next.setDate(Math.min(dayOfMonth, lastDayOfMonth));
      }
      break;
    case "yearly":
      next.setFullYear(next.getFullYear() + 1);
      // If monthOfYear and dayOfMonth are specified
      if (monthOfYear && dayOfMonth) {
        next.setMonth(monthOfYear - 1); // Months are 0-indexed
        const lastDayOfMonth = new Date(next.getFullYear(), monthOfYear, 0).getDate();
        next.setDate(Math.min(dayOfMonth, lastDayOfMonth));
      }
      break;
    default:
      next.setMonth(next.getMonth() + 1); // Default to monthly
  }
  
  // Apply recurringTime if specified (for non-test frequencies)
  if (recurringTime && !['every-20-seconds', 'every-minute', 'monthly-test'].includes(frequency)) {
    const [hours, minutes] = recurringTime.split(':').map(Number);
    next.setHours(hours, minutes, 0, 0);
  }
  
  return next;
}

/**
 * Process recurring invoices that are due
 */
async function processRecurringInvoices() {
  try {
    const now = new Date();
    
    // First, let's check ALL recurring invoices
    const allRecurring = await Invoice.findAll({
      where: { isRecurring: true },
      attributes: ['id', 'client', 'nextRecurringDate', 'recurringEndDate', 'recurringFrequency']
    });
    
    // Find all recurring invoices that are due
    const dueInvoices = await Invoice.findAll({
      where: {
        isRecurring: true,
        nextRecurringDate: {
          [Op.lte]: now,
        },
        [Op.or]: [
          { recurringEndDate: null },
          { recurringEndDate: { [Op.gte]: now } },
        ],
      },
      include: [
        {
          model: Task,
          as: "tasks",
        },
      ],
    });

    if (dueInvoices.length > 0) {
    }

    for (const originalInvoice of dueInvoices) {
      try {
        // Check if max recurrences reached
        if (
          originalInvoice.maxRecurrences &&
          originalInvoice.recurringCount >= originalInvoice.maxRecurrences
        ) {
          // Update to mark as completed
          await originalInvoice.update({
            isRecurring: false,
            nextRecurringDate: null,
          });
          continue;
        }

        // Create a new invoice based on the recurring one
        // Start with Draft status, will be updated to Sent if email is successfully sent
        const invoiceNumber = await generateInvoiceNumber();
        
        const newInvoiceData = {
          invoiceNumber,
          client: originalInvoice.client,
          date: now,
          workType: originalInvoice.workType,
          currency: originalInvoice.currency,
          totalAmount: originalInvoice.totalAmount,
          status: "Draft", // Start as Draft, will update to Sent after email is sent
          userId: originalInvoice.userId,
          parentInvoiceId: originalInvoice.id,
          isRecurring: false, // The copy is not recurring
          isFirstRecurringInvoice: originalInvoice.recurringCount === 0, // True only for first invoice
          customFields: originalInvoice.customFields || {}, // Copy custom fields
          itemStructure: originalInvoice.itemStructure || "hourly", // Copy item structure
        };

        const newInvoice = await Invoice.create(newInvoiceData);

        // Fetch tasks directly from database to ensure we have them
        const originalTasks = await Task.findAll({
          where: { invoiceId: originalInvoice.id }
        });

        // Copy tasks from original invoice
        if (originalTasks && originalTasks.length > 0) {
          const taskPromises = originalTasks.map((task) => {
            // Validate task data before creating (description and total are always required)
            if (!task.description || task.total === null || task.total === undefined) {
              throw new Error(`Invalid task data: description="${task.description}", total=${task.total}`);
            }
            
            // Copy all task fields including flexible structure fields
            const taskData = {
              description: task.description,
              total: task.total,
              invoiceId: newInvoice.id,
            };
            
            // Add structure-specific fields if they exist
            if (task.hours !== null && task.hours !== undefined) taskData.hours = task.hours;
            if (task.rate !== null && task.rate !== undefined) taskData.rate = task.rate;
            if (task.quantity !== null && task.quantity !== undefined) taskData.quantity = task.quantity;
            if (task.unitPrice !== null && task.unitPrice !== undefined) taskData.unitPrice = task.unitPrice;
            if (task.days !== null && task.days !== undefined) taskData.days = task.days;
            if (task.amount !== null && task.amount !== undefined) taskData.amount = task.amount;
            
            return Task.create(taskData);
          });
          await Promise.all(taskPromises);
        } else {
        }

        // Log recurring auto-generation activity
        await logActivity(
          originalInvoice.userId,
          'recurring_auto_generated',
          `Recurring invoice auto-generated for ${newInvoice.client} (${getCurrencySymbol(newInvoice.currency)}${newInvoice.totalAmount.toFixed(2)})`,
          newInvoice.id,
          { 
            client: newInvoice.client, 
            totalAmount: newInvoice.totalAmount, 
            currency: newInvoice.currency,
            frequency: originalInvoice.recurringFrequency,
            count: originalInvoice.recurringCount + 1
          }
        );

        // Send email if auto-send is enabled
        if (originalInvoice.autoSendEmail) {
          try {
            // Get user's email settings and email template
            const EmailSettings = require("../model/EmailSettings");
            const EmailTemplate = require("../model/EmailTemplate");
            const User = require("../model/User");
            
            const emailSettings = await EmailSettings.findOne({ 
              where: { userId: originalInvoice.userId } 
            });
            
            const user = await User.findOne({ 
              where: { id: originalInvoice.userId } 
            });

            if (emailSettings && user && emailSettings.email) {
              const handlebars = require("handlebars");
              const nodemailer = require("nodemailer");
              
              // Get email template if specified, otherwise use default
              let emailSubject = `Invoice ${newInvoice.invoiceNumber || newInvoice.id} - ${newInvoice.workType || 'Your Invoice'}`;
              let emailContent = `Please find attached your invoice #${newInvoice.invoiceNumber || newInvoice.id} for ${newInvoice.currency} ${newInvoice.totalAmount}.`;
              
              if (originalInvoice.emailTemplateId) {
                const emailTemplate = await EmailTemplate.findOne({
                  where: { id: originalInvoice.emailTemplateId, userId: originalInvoice.userId }
                });
                
                if (emailTemplate) {
                  // Prepare placeholder data for email template
                  const emailPlaceholders = {
                    client_name: newInvoice.client,
                    clientName: newInvoice.client,
                    invoice_number: newInvoice.invoiceNumber || newInvoice.id,
                    invoiceId: newInvoice.id,
                    total_amount: `${newInvoice.currency || "USD"} ${newInvoice.totalAmount}`,
                    totalAmount: `${newInvoice.currency || "USD"} ${newInvoice.totalAmount}`,
                    currency: newInvoice.currency || "USD",
                    currencySymbol: getCurrencySymbol(newInvoice.currency || "USD"),
                    invoice_date: new Date(newInvoice.date).toLocaleDateString("en-US"),
                    date: new Date(newInvoice.date).toLocaleDateString("en-US"),
                    work_type: newInvoice.workType || "",
                    workType: newInvoice.workType || "",
                    company_name: user.companyName || "Your Company",
                    companyLogo: user.companyLogo ? imageToBase64(user.companyLogo) : null,
                    userName: user.name || emailSettings.email,
                    // Bank details
                    account_holder_name: user.accountHolderName || "",
                    accountHolderName: user.accountHolderName || "",
                    bank_name: user.bankName || "",
                    bankName: user.bankName || "",
                    account_name: user.accountName || "",
                    accountName: user.accountName || "",
                    account_number: user.accountNumber || "",
                    accountNumber: user.accountNumber || "",
                    iban: user.iban || "",
                    bic: user.bic || "",
                    sort_code: user.sortCode || "",
                    sortCode: user.sortCode || "",
                    swift_code: user.swiftCode || "",
                    swiftCode: user.swiftCode || "",
                    routing_number: user.routingNumber || "",
                    routingNumber: user.routingNumber || "",
                    bank_address: user.bankAddress || "",
                    bankAddress: user.bankAddress || "",
                    additional_info: user.additionalInfo || "",
                    additionalInfo: user.additionalInfo || "",
                    bankAddress: user.bankAddress || "",
                  };
                  
                  // Compile subject and content with handlebars
                  const subjectTemplate = handlebars.compile(emailTemplate.subject);
                  const contentTemplate = handlebars.compile(emailTemplate.content);
                  
                  emailSubject = subjectTemplate(emailPlaceholders);
                  emailContent = contentTemplate(emailPlaceholders);
                }
              }
              
              // Prepare email attachments
              const attachments = [];
              
              // Get invoice PDF template if specified
              if (originalInvoice.invoiceTemplateId) {
                try {
                  const InvoiceTemplate = require("../model/InvoiceTemplate");
                  const invoiceTemplate = await InvoiceTemplate.findOne({
                    where: { id: originalInvoice.invoiceTemplateId, userId: originalInvoice.userId }
                  });
                  
                  if (invoiceTemplate && invoiceTemplate.templateHTML) {
                    // Prepare placeholder data for PDF
                    const tasks = await Task.findAll({ where: { invoiceId: newInvoice.id } });
                    
                    // Convert Sequelize instances to plain objects for Handlebars
                    const plainTasks = tasks.map(task => task.get({ plain: true }));
                    
                    const placeholderData = {
                      client_name: newInvoice.client,
                      clientName: newInvoice.client,
                      company_name: user.companyName || "Your Company",
                      company_address: user.email || emailSettings.email,
                      companyLogo: user.companyLogo ? imageToBase64(user.companyLogo) : null,
                      invoice_number: newInvoice.invoiceNumber || newInvoice.id,
                      invoiceId: newInvoice.id,
                      invoice_date: new Date(newInvoice.date).toLocaleDateString("en-US"),
                      date: new Date(newInvoice.date).toLocaleDateString("en-US"),
                      total_amount: `${getCurrencySymbol(newInvoice.currency || "USD")}${newInvoice.totalAmount}`,
                      totalAmount: newInvoice.totalAmount.toFixed(2),
                      currency: newInvoice.currency || "USD",
                      currencySymbol: getCurrencySymbol(newInvoice.currency || "USD"),
                      item_structure: originalInvoice.itemStructure || "hourly",
                      itemStructure: originalInvoice.itemStructure || "hourly",
                      // Bank details for PDF
                      accountHolderName: user.accountHolderName || "",
                      bank_name: user.bankName || "",
                      bankName: user.bankName || "",
                      account_name: user.accountName || "",
                      accountName: user.accountName || "",
                      account_number: user.accountNumber || "",
                      accountNumber: user.accountNumber || "",
                      iban: user.iban || "",
                      bic: user.bic || "",
                      sort_code: user.sortCode || "",
                      sortCode: user.sortCode || "",
                      swift_code: user.swiftCode || "",
                      swiftCode: user.swiftCode || "",
                      routing_number: user.routingNumber || "",
                      routingNumber: user.routingNumber || "",
                      bank_address: user.bankAddress || "",
                      bankAddress: user.bankAddress || "",
                      additionalInfo: user.additionalInfo || "",
                      work_type: newInvoice.workType || "",
                      workType: newInvoice.workType || "",
                      userName: user.name || emailSettings.email,
                      tasks: plainTasks
                    };

                    const compiledTemplate = handlebars.compile(invoiceTemplate.templateHTML);
                    const finalHtml = compiledTemplate(placeholderData);
                    
                    // Generate PDF with Puppeteer only (Render-compatible configuration)
                    let pdfBuffer;
                    try {
                      const puppeteer = require('puppeteer-core');
                      const chromium = require('@sparticuz/chromium');
                      const browser = await puppeteer.launch({
                        args: chromium.args,
                        defaultViewport: chromium.defaultViewport,
                        executablePath: await chromium.executablePath(),
                        headless: chromium.headless,
                      });
                      const page = await browser.newPage();
                      await page.emulateMediaType('screen');
                      await page.setContent(finalHtml, { waitUntil: 'networkidle0' });
                      pdfBuffer = await page.pdf({ printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
                      await browser.close();
                    } catch (puppeteerErr) {
                      pdfBuffer = null;
                    }
                    
                    if (pdfBuffer) {
                      attachments.push({
                        filename: `invoice-${newInvoice.invoiceNumber || newInvoice.id}.pdf`,
                        content: pdfBuffer,
                      });
                    }
                  } else {
                  }
                } catch (pdfError) {
                }
              } else {
              }

              // Configure email transporter
              const emailDomain = emailSettings.email.split('@')[1]?.toLowerCase();
              let transporterConfig = {
                auth: {
                  user: emailSettings.email,
                  pass: emailSettings.appPassword,
                },
              };

              if (emailDomain && emailDomain.includes('gmail')) {
                transporterConfig.service = 'Gmail';
              } else if (emailDomain && (emailDomain.includes('outlook') || emailDomain.includes('hotmail') || emailDomain.includes('live'))) {
                transporterConfig.host = 'smtp-mail.outlook.com';
                transporterConfig.port = 587;
                transporterConfig.secure = false;
                transporterConfig.tls = { ciphers: 'SSLv3' };
              } else {
                transporterConfig.host = emailSettings.smtpHost || 'smtp.office365.com';
                transporterConfig.port = emailSettings.smtpPort || 587;
                transporterConfig.secure = false;
                transporterConfig.tls = { ciphers: 'SSLv3' };
              }

              const transporter = nodemailer.createTransport(transporterConfig);
              
              // Determine recipient email
              const recipientEmail = originalInvoice.clientEmail || emailSettings.email;
              
              const mailOptions = {
                from: emailSettings.email,
                to: recipientEmail,
                subject: emailSubject,
                text: emailContent,
                attachments: attachments, // Use the attachments array (empty if no PDF)
              };

              await transporter.sendMail(mailOptions);
              
              // Update invoice status to "Sent" after successful email delivery
              await newInvoice.update({ status: "Sent" });
              
              // Verify the status was updated
              await newInvoice.reload();

              // Log recurring email sent activity
              await logActivity(
                originalInvoice.userId,
                'recurring_email_sent',
                `Recurring invoice email sent to ${newInvoice.client} (${recipientEmail})`,
                newInvoice.id,
                { client: newInvoice.client, recipient: recipientEmail, totalAmount: newInvoice.totalAmount }
              );
            } else {
            }
          } catch (emailError) {

            // Log recurring email failed activity
            await logActivity(
              originalInvoice.userId,
              'recurring_failed',
              `Failed to send recurring invoice email for ${newInvoice.client}`,
              newInvoice.id,
              { client: newInvoice.client, error: emailError.message }
            );
          }
        } else {
        }

        // Update the original invoice
        const nextDate = calculateNextRecurringDate(
          originalInvoice.nextRecurringDate,
          originalInvoice.recurringFrequency,
          originalInvoice.dayOfMonth,
          originalInvoice.dayOfWeek,
          originalInvoice.monthOfYear,
          originalInvoice.quarterMonth,
          originalInvoice.recurringTime
        );

        await originalInvoice.update({
          nextRecurringDate: nextDate,
          recurringCount: originalInvoice.recurringCount + 1,
        });

      } catch (invoiceError) {
      }
    }

    return {
      processed: dueInvoices.length,
      success: true,
    };
  } catch (error) {
    return {
      processed: 0,
      success: false,
      error: error.message,
    };
  }
}

/**
 * Start the recurring invoice scheduler
 * Runs every hour by default, or every 10 seconds for testing
 */
function startRecurringInvoiceScheduler(intervalMinutes = 60) {
  // For testing with 20-second frequency, check every 10 seconds
  const useTestMode = process.env.RECURRING_TEST_MODE === 'true';
  const checkIntervalMs = useTestMode ? 10 * 1000 : intervalMinutes * 60 * 1000;
  
  // Log all recurring invoices on startup
  Invoice.findAll({
    where: { isRecurring: true },
    attributes: ['id', 'client', 'recurringFrequency', 'nextRecurringDate', 'recurringCount']
  }).then(invoices => {
  });
  
  // Run immediately on start
  processRecurringInvoices();
  
  // Then run at specified interval
  setInterval(() => {
    processRecurringInvoices();
  }, checkIntervalMs);
}

module.exports = {
  processRecurringInvoices,
  startRecurringInvoiceScheduler,
  calculateNextRecurringDate,
};
