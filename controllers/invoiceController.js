const { Invoice, Task } = require("../model/Invoice"); // Ensure path is correct
const { calculateNextRecurringDate } = require("../services/recurringInvoiceScheduler");
const fs = require("fs");
const path = require("path");
const handlebars = require("handlebars");
let puppeteer;
try {
  puppeteer = require("puppeteer");
} catch (e) {
  console.error('⚠️ Puppeteer not available:', e.message);
  puppeteer = null;
}
const User = require("../model/User");
const { getCurrencySymbol } = require("../utils/currencyHelper");
const { logActivity } = require("../utils/activityLogger");
const { imageToBase64 } = require("../utils/imageHelper");
const { prepareCustomFieldsForTemplate } = require("../utils/customFieldHelper");
const Activity = require("../model/Activity");

// Helper function to generate next invoice number
async function generateInvoiceNumber() {
  try {
    // Find the last invoice with an invoice number
    const lastInvoice = await Invoice.findOne({
      where: {
        invoiceNumber: {
          [require('sequelize').Op.ne]: null
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
    console.error('Error generating invoice number:', error);
    // Fallback to timestamp-based number if there's an error
    return `INV-${Date.now().toString().slice(-4)}`;
  }
}

// Register Handlebars helpers
handlebars.registerHelper('eq', function(a, b) {
  return a === b;
});

handlebars.registerHelper('unless', function(conditional, options) {
  if (!conditional) {
    return options.fn(this);
  }
  return options.inverse(this);
});

exports.createInvoice = async (req, res) => {
  const { 
    client,
    clientEmail, // Add clientEmail here
    date, 
    workType, 
    currency, 
    tasks, 
    notes,
    status,
    customFields, // Accept custom fields
    itemStructure, // Accept item structure
    // Recurring fields
    isRecurring,
    recurringFrequency,
    recurringStartDate,
    recurringEndDate,
    maxRecurrences,
    autoSendEmail
  } = req.body;

  try {
    if (!client || !date || !workType || !Array.isArray(tasks) || tasks.length === 0) {
      return res.status(400).json({ message: "All required fields must be provided" });
    }

    // Validate tasks based on item structure
    const structure = itemStructure || 'hourly';
    for (const task of tasks) {
      if (!task.description) {
        return res.status(400).json({ message: "Each task must have a description." });
      }
      
      // Validate fields based on structure
      if (structure === 'hourly') {
        if (typeof task.hours !== "number" || typeof task.rate !== "number") {
          return res.status(400).json({ message: "Hourly tasks must have hours and rate." });
        }
      } else if (structure === 'fixed_price') {
        if (typeof task.quantity !== "number" || typeof task.unitPrice !== "number") {
          return res.status(400).json({ message: "Fixed price tasks must have quantity and unit price." });
        }
      } else if (structure === 'daily_rate') {
        if (typeof task.days !== "number" || typeof task.rate !== "number") {
          return res.status(400).json({ message: "Daily rate tasks must have days and rate." });
        }
      } else if (structure === 'simple') {
        if (typeof task.amount !== "number") {
          return res.status(400).json({ message: "Simple tasks must have an amount." });
        }
      }
    }

    const totalAmount = tasks.reduce((sum, task) => sum + task.total, 0);

    // Generate sequential invoice number
    const invoiceNumber = await generateInvoiceNumber();

    console.log('📝 Creating invoice with data:', {
      client,
      clientEmail,
      workType,
      currency,
      totalAmount,
      isRecurring
    });

    // Prepare invoice data
    const invoiceData = {
      userId: req.user.id,
      invoiceNumber,
      client,
      clientEmail: clientEmail || null, // Save client email
      date,
      workType,
      currency,
      notes,
      totalAmount,
      status: status || "Draft", // Use provided status or default to Draft
      customFields: customFields || {}, // Store custom fields
      itemStructure: structure, // Store item structure
    };

    console.log('💾 Invoice data to save:', JSON.stringify(invoiceData, null, 2));

    // Add recurring fields if enabled
    if (isRecurring) {
      invoiceData.isRecurring = true;
      invoiceData.recurringFrequency = recurringFrequency || 'monthly';
      invoiceData.recurringStartDate = recurringStartDate || new Date();
      invoiceData.recurringEndDate = recurringEndDate || null;
      invoiceData.maxRecurrences = maxRecurrences || null;
      invoiceData.autoSendEmail = autoSendEmail !== undefined ? autoSendEmail : true;
      
      // Calculate next recurring date
      const startDate = new Date(recurringStartDate || date);
      invoiceData.nextRecurringDate = calculateNextRecurringDate(startDate, invoiceData.recurringFrequency);
      invoiceData.recurringCount = 0;
    }

    // ✅ Create invoice first
    const newInvoice = await Invoice.create(invoiceData, { 
      include: [{ model: Task, as: "tasks" }] 
    });
    
    console.log('✅ Invoice created with ID:', newInvoice.id);
    console.log('📧 Saved clientEmail:', newInvoice.clientEmail);
    
    const createdTasks = await Promise.all(
      tasks.map(task =>
        Task.create({ ...task, invoiceId: newInvoice.id })
      )
    );

    // Log activity
    await logActivity(
      req.user.id,
      'invoice_created',
      `Invoice created for ${client} - ${workType} (${getCurrencySymbol(currency)}${totalAmount.toFixed(2)})`,
      newInvoice.id,
      { client, workType, totalAmount, currency, status: invoiceData.status }
    );

    // Log recurring activity if applicable
    if (isRecurring) {
      await logActivity(
        req.user.id,
        'recurring_started',
        `Recurring invoice started for ${client} (${recurringFrequency})`,
        newInvoice.id,
        { client, frequency: recurringFrequency, autoSendEmail }
      );
    }

    res.status(201).json({ 
      message: isRecurring ? "Recurring invoice created successfully" : "Invoice created successfully", 
      invoice: newInvoice, 
      tasks: createdTasks 
    });
  } catch (error) {
    console.error("Error creating invoice:", error);
    res.status(500).json({ message: "Failed to create invoice" });
  }
};


// Get recurring invoices only
exports.getRecurringInvoices = async (req, res) => {
  try {
    const recurringInvoices = await Invoice.findAll({
      where: { 
        userId: req.user.id,
        isRecurring: true
      },
      include: [
        {
          model: Task,
          as: "tasks",
          attributes: ["id", "description", "hours", "rate", "total"],
        },
      ],
      order: [['nextRecurringDate', 'ASC']],
    });

    res.status(200).json(recurringInvoices);
  } catch (error) {
    console.error("Error fetching recurring invoices:", error);
    res.status(500).json({ message: "Failed to fetch recurring invoices" });
  }
};

// Update recurring invoice settings
exports.updateRecurringInvoice = async (req, res) => {
  const { id } = req.params;
  const { 
    recurringFrequency, 
    recurringEndDate, 
    maxRecurrences,
    autoSendEmail,
    isRecurring 
  } = req.body;

  try {
    const invoice = await Invoice.findOne({
      where: { 
        id,
        userId: req.user.id
      }
    });

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    // Update recurring settings
    if (recurringFrequency !== undefined) invoice.recurringFrequency = recurringFrequency;
    if (recurringEndDate !== undefined) invoice.recurringEndDate = recurringEndDate;
    if (maxRecurrences !== undefined) invoice.maxRecurrences = maxRecurrences;
    if (autoSendEmail !== undefined) invoice.autoSendEmail = autoSendEmail;
    if (isRecurring !== undefined) invoice.isRecurring = isRecurring;

    // Recalculate next date if frequency changed
    if (recurringFrequency && invoice.nextRecurringDate) {
      invoice.nextRecurringDate = calculateNextRecurringDate(
        invoice.nextRecurringDate,
        recurringFrequency
      );
    }

    await invoice.save();

    res.status(200).json({ 
      message: "Recurring invoice settings updated successfully", 
      invoice 
    });
  } catch (error) {
    console.error("Error updating recurring invoice:", error);
    res.status(500).json({ message: "Failed to update recurring invoice" });
  }
};

// Manually trigger recurring invoice processing
exports.triggerRecurringProcessing = async (req, res) => {
  try {
    const { processRecurringInvoices } = require("../services/recurringInvoiceScheduler");
    const result = await processRecurringInvoices();
    
    res.status(200).json({ 
      message: "Recurring invoice processing completed", 
      result 
    });
  } catch (error) {
    console.error("Error triggering recurring processing:", error);
    res.status(500).json({ message: "Failed to trigger recurring processing" });
  }
};


// Get invoices for the authenticated user
exports.getInvoices = async (req, res) => {
  try {
    const { parentInvoiceId } = req.query;
    
    // Build query filter
    const whereClause = { userId: req.user.id };
    
    // If filtering by parent invoice (for recurring invoice history)
    if (parentInvoiceId) {
      whereClause.parentInvoiceId = parentInvoiceId;
    }
    
    const invoices = await Invoice.findAll({
      where: whereClause,
      include: [
        {
          model: Task,
          as: "tasks", // ✅ Must match alias
          attributes: ["id", "description", "hours", "rate", "total"],
        },
      ],
      order: [['date', 'DESC']], // Most recent first
    });
    

    if (!invoices || invoices.length === 0) {
      return res.status(404).json({ message: "No invoices found" });
    }

    res.status(200).json(invoices);
  } catch (error) {
    console.error("Error fetching invoices:", error);
    res.status(500).json({ message: "Failed to fetch invoices" });
  }
};

// Delete an invoice
exports.deleteInvoice = async (req, res) => {
  const { id } = req.params;

  try {
    console.log('Attempting to delete invoice:', id);
    console.log('User ID:', req.user.id);

    // Find the invoice
    const invoice = await Invoice.findOne({
      where: { 
        id,
        userId: req.user.id // Ensure user can only delete their own invoices
      }
    });

    console.log('Invoice found:', invoice ? 'Yes' : 'No');

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found or you don't have permission to delete it" });
    }

    // Store invoice data before deletion for activity log
    const invoiceData = {
      client: invoice.client,
      workType: invoice.workType,
      totalAmount: invoice.totalAmount,
      currency: invoice.currency,
      isRecurring: invoice.isRecurring,
      recurringFrequency: invoice.recurringFrequency
    };

    // If this is a recurring invoice, stop it first and log the activity
    if (invoice.isRecurring) {
      await invoice.update({
        isRecurring: false,
        nextRecurringDate: null
      });
      
      // Delete all child invoices (auto-generated recurring emails)
      const childInvoices = await Invoice.findAll({
        where: { 
          parentInvoiceId: invoice.id,
          userId: req.user.id
        }
      });
      
      console.log(`Found ${childInvoices.length} child invoices to delete`);
      
      // Delete all child invoices
      for (const childInvoice of childInvoices) {
        await childInvoice.destroy();
        console.log(`Deleted child invoice ${childInvoice.id}`);
      }
      
      // Log activity for stopping recurring
      await logActivity(
        req.user.id,
        'recurring_stopped',
        `Recurring invoice stopped for ${invoice.client} (invoice deleted) - ${childInvoices.length} child invoices also deleted`,
        invoice.id,
        { client: invoice.client, frequency: invoice.recurringFrequency, reason: 'invoice_deleted', childInvoicesDeleted: childInvoices.length }
      );
      
      console.log(`Stopped recurring for invoice ${id} and deleted ${childInvoices.length} child invoices before deletion`);
    }

    // Delete the invoice (tasks will be cascade deleted)
    await invoice.destroy();

    // Log activity
    await logActivity(
      req.user.id,
      'invoice_deleted',
      `Invoice for ${invoiceData.client} deleted (${invoiceData.workType})`,
      id,
      invoiceData
    );

    console.log('Invoice deleted successfully');
    res.status(200).json({ message: "Invoice deleted successfully" });
  } catch (error) {
    console.error("Error deleting invoice:", error);
    res.status(500).json({ message: "Failed to delete invoice", error: error.message });
  }
};

// Update an invoice
exports.updateInvoice = async (req, res) => {
  const { id } = req.params;
  const { 
    status, 
    client, 
    clientEmail,
    date, 
    workType, 
    currency, 
    notes, 
    tasks, 
    totalAmount,
    itemStructure, // Add item structure support
    customFields, // Add custom fields support
    // Recurring fields
    isRecurring,
    recurringFrequency,
    recurringStartDate,
    nextRecurringDate,
    recurringEndDate,
    maxRecurrences,
    autoSendEmail,
    recurringCount,
    emailTemplateId,
    invoiceTemplateId
  } = req.body;

  try {
    console.log('📝 Attempting to update invoice:', id);
    console.log('📦 Update data:', req.body);
    if (invoiceTemplateId !== undefined) {
      console.log('🎨 Updating invoice template ID to:', invoiceTemplateId);
    }

    // Find the invoice with tasks
    const invoice = await Invoice.findOne({
      where: { 
        id,
        userId: req.user.id // Ensure user can only update their own invoices
      },
      include: [{ model: Task, as: 'tasks' }]
    });

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found or you don't have permission to update it" });
    }

    // Update basic invoice fields
    if (status) invoice.status = status;
    if (client) invoice.client = client;
    if (clientEmail !== undefined) invoice.clientEmail = clientEmail;
    if (date) invoice.date = date;
    if (workType) invoice.workType = workType;
    if (currency) invoice.currency = currency;
    if (notes !== undefined) invoice.notes = notes;
    if (totalAmount !== undefined) invoice.totalAmount = totalAmount;
    if (itemStructure !== undefined) invoice.itemStructure = itemStructure;
    if (customFields !== undefined) invoice.customFields = customFields;

    // Update recurring fields
    if (isRecurring !== undefined) invoice.isRecurring = isRecurring;
    if (recurringFrequency !== undefined) invoice.recurringFrequency = recurringFrequency;
    if (recurringStartDate !== undefined) invoice.recurringStartDate = recurringStartDate;
    if (nextRecurringDate !== undefined) invoice.nextRecurringDate = nextRecurringDate;
    if (recurringEndDate !== undefined) invoice.recurringEndDate = recurringEndDate;
    if (maxRecurrences !== undefined) invoice.maxRecurrences = maxRecurrences;
    if (autoSendEmail !== undefined) invoice.autoSendEmail = autoSendEmail;
    if (recurringCount !== undefined) invoice.recurringCount = recurringCount;
    if (emailTemplateId !== undefined) {
      console.log('📧 Updating email template ID from', invoice.emailTemplateId, 'to', emailTemplateId);
      invoice.emailTemplateId = emailTemplateId;
    }
    if (invoiceTemplateId !== undefined) {
      console.log('🎨 Updating invoice template ID from', invoice.invoiceTemplateId, 'to', invoiceTemplateId);
      invoice.invoiceTemplateId = invoiceTemplateId;
    }

    // Update tasks if provided
    if (tasks && Array.isArray(tasks)) {
      // Delete existing tasks
      await Task.destroy({ where: { invoiceId: invoice.id } });

      // Get item structure (use updated value if provided, otherwise existing)
      const structure = itemStructure || invoice.itemStructure || 'hourly';

      // Create new tasks with validation based on structure
      for (const task of tasks) {
        if (!task.description) {
          return res.status(400).json({ message: "Each task must have a description." });
        }

        // Validate and prepare task data based on structure
        let taskData = {
          invoiceId: invoice.id,
          description: task.description,
          total: task.total || 0
        };

        if (structure === 'hourly') {
          if (typeof task.hours !== "number" || typeof task.rate !== "number") {
            return res.status(400).json({ message: "Hourly tasks must have hours and rate." });
          }
          taskData.hours = task.hours;
          taskData.rate = task.rate;
          taskData.total = task.total || (task.hours * task.rate);
        } else if (structure === 'fixed_price') {
          if (typeof task.quantity !== "number" || typeof task.unitPrice !== "number") {
            return res.status(400).json({ message: "Fixed price tasks must have quantity and unitPrice." });
          }
          taskData.quantity = task.quantity;
          taskData.unitPrice = task.unitPrice;
          taskData.total = task.total || (task.quantity * task.unitPrice);
        } else if (structure === 'daily_rate') {
          if (typeof task.days !== "number" || typeof task.rate !== "number") {
            return res.status(400).json({ message: "Daily rate tasks must have days and rate." });
          }
          taskData.days = task.days;
          taskData.rate = task.rate;
          taskData.total = task.total || (task.days * task.rate);
        } else if (structure === 'simple') {
          if (typeof task.amount !== "number") {
            return res.status(400).json({ message: "Simple tasks must have an amount." });
          }
          taskData.amount = task.amount;
          taskData.total = task.amount;
        }

        await Task.create(taskData);
      }
    }

    // Save all changes to the invoice
    await invoice.save();
    console.log('✅ Invoice saved successfully. Current invoiceTemplateId:', invoice.invoiceTemplateId);

    // Fetch updated invoice with tasks
    const updatedInvoice = await Invoice.findOne({
      where: { id: invoice.id },
      include: [{ model: Task, as: 'tasks' }]
    });

    // Log activity
    let activityType = 'invoice_updated';
    let activityText = `Invoice for ${invoice.client} updated`;

    if (status) {
      if (status === 'Paid') {
        activityType = 'payment_received';
        activityText = `Payment received from ${invoice.client} (${getCurrencySymbol(invoice.currency)}${invoice.totalAmount.toFixed(2)})`;
      } else if (status === 'Sent') {
        activityType = 'email_sent';
        activityText = `Invoice sent to ${invoice.client}`;
      } else if (status === 'Overdue') {
        activityType = 'invoice_updated';
        activityText = `Invoice for ${invoice.client} marked as overdue`;
      }
    }

    await logActivity(
      req.user.id,
      activityType,
      activityText,
      invoice.id,
      { client: invoice.client, status: invoice.status, totalAmount: invoice.totalAmount }
    );

    console.log('Invoice updated successfully');
    res.status(200).json({ message: "Invoice updated successfully", invoice: updatedInvoice });
  } catch (error) {
    console.error("Error updating invoice:", error);
    res.status(500).json({ message: "Failed to update invoice", error: error.message });
  }
};

// Preview invoice (returns HTML)
exports.previewInvoice = async (req, res) => {
  const { id } = req.params;

  try {
    console.log('Preview invoice requested for ID:', id);
    console.log('User ID:', req.user.id);
    
    // Find the invoice with tasks
    const invoice = await Invoice.findOne({
      where: { 
        id,
        userId: req.user.id
      },
      include: [{ model: Task, as: 'tasks' }]
    });

    if (!invoice) {
      console.log('Invoice not found for ID:', id);
      return res.status(404).json({ message: "Invoice not found" });
    }

    console.log('Invoice found:', invoice.id, 'Client:', invoice.client);
    console.log('📋 Invoice Template ID:', invoice.invoiceTemplateId);

    // Get user info
    const user = await User.findByPk(req.user.id);
    console.log('User found:', user.name);

    // Determine which template to use
    let templateHTML;
    const InvoiceTemplate = require("../model/InvoiceTemplate");
    
    if (invoice.invoiceTemplateId) {
      // Invoice has a saved template - use it (last sent template)
      console.log('🔍 Looking for template with ID:', invoice.invoiceTemplateId);
      const customTemplate = await InvoiceTemplate.findByPk(invoice.invoiceTemplateId);
      if (customTemplate) {
        templateHTML = customTemplate.templateHTML;
        console.log('✅ Using invoice saved template:', customTemplate.title, '(ID:', customTemplate.id, ')');
      } else {
        console.warn('⚠️ Invoice template ID', invoice.invoiceTemplateId, 'exists but template not found in database');
      }
    }
    
    if (!templateHTML) {
      // No saved template - use first available template from database
      console.log('🔍 No saved template, fetching first available template from database...');
      const firstTemplate = await InvoiceTemplate.findOne({ order: [['createdAt', 'ASC']] });
      if (firstTemplate) {
        templateHTML = firstTemplate.templateHTML;
        console.log('✅ Using first available template:', firstTemplate.title, '(ID:', firstTemplate.id, ')');
      } else {
        // Final fallback: use file-based professional template
        const templatePath = path.join(__dirname, "../templates/professional-invoice-template.html");
        templateHTML = fs.readFileSync(templatePath, "utf-8");
        console.log('⚠️ No templates in database, using default professional template file');
      }
    }
    console.log('Template loaded, length:', templateHTML.length);

    // Compile the template
    const template = handlebars.compile(templateHTML);

    // Prepare custom fields for template
    const customFieldData = await prepareCustomFieldsForTemplate(invoice.customFields || {}, req.user.id);

    // Prepare data for the template
    const invoiceData = {
      company_name: user.companyName || "Your Company",
      company_logo: user.companyLogo ? imageToBase64(user.companyLogo) : null,
      company_address: user.email || "",
      company_email: user.email || "",
      companyLogo: user.companyLogo ? imageToBase64(user.companyLogo) : null,
      userName: user.name || "User",
      client_name: invoice.client,
      client_email: invoice.clientEmail || "",
      client_address: "",
      invoice_number: invoice.id,
      invoice_date: new Date(invoice.date).toLocaleDateString(),
      due_date: invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : null,
      status: invoice.status || "Draft",
      currency: invoice.currency || "USD",
      currencySymbol: getCurrencySymbol(invoice.currency || "USD"),
      currency_symbol: getCurrencySymbol(invoice.currency || "USD"),
      work_type: invoice.workType,
      item_structure: invoice.itemStructure || "hourly",
      tasks: invoice.tasks.map(task => ({
        description: task.description,
        hours: task.hours,
        rate: task.rate ? task.rate.toFixed(2) : null,
        quantity: task.quantity,
        unitPrice: task.unitPrice ? task.unitPrice.toFixed(2) : null,
        days: task.days,
        amount: task.amount ? task.amount.toFixed(2) : null,
        total: task.total.toFixed(2)
      })),
      subtotal: invoice.totalAmount.toFixed(2),
      tax_rate: 0,
      tax_amount: "0.00",
      totalAmount: invoice.totalAmount.toFixed(2),
      total_amount: invoice.totalAmount.toFixed(2),
      notes: invoice.notes || "",
      // Custom fields
      has_custom_fields: customFieldData.custom_fields && customFieldData.custom_fields.length > 0,
      custom_fields: customFieldData.custom_fields || [],
      ...customFieldData,
      // Bank details
      accountHolderName: user.accountHolderName || null,
      bankName: user.bankName || null,
      accountName: user.accountName || null,
      accountNumber: user.accountNumber || null,
      iban: user.iban || null,
      bic: user.bic || null,
      sortCode: user.sortCode || null,
      swiftCode: user.swiftCode || null,
      routingNumber: user.routingNumber || null,
      bankAddress: user.bankAddress || null,
      additionalInfo: user.additionalInfo || null,
      paypalPaymentLink: null,
      stripePaymentLink: null
    };

    console.log('[PREVIEW] Bank details being sent:', {
      accountHolderName: invoiceData.accountHolderName,
      bankName: invoiceData.bankName,
      iban: invoiceData.iban,
      bic: invoiceData.bic,
      sortCode: invoiceData.sortCode,
      accountNumber: invoiceData.accountNumber
    });
    
    console.log('[PREVIEW] Full user object:', {
      accountHolderName: user.accountHolderName,
      bankName: user.bankName,
      accountNumber: user.accountNumber,
      iban: user.iban
    });

    const html = template(invoiceData);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error("Error generating invoice preview:", error);
    res.status(500).json({ message: "Failed to generate preview", error: error.message });
  }
};

// Download invoice as PDF
exports.downloadInvoice = async (req, res) => {
  const { id } = req.params;

  try {
    // Find the invoice with tasks
    const invoice = await Invoice.findOne({
      where: { 
        id,
        userId: req.user.id
      },
      include: [{ model: Task, as: 'tasks' }]
    });

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    // Get user info
    const user = await User.findByPk(req.user.id);

    // Resolve the active template HTML: prefer DB template selected for this invoice
    let activeTemplateHTML;
    try {
      if (invoice.invoiceTemplateId) {
        const InvoiceTemplate = require("../model/InvoiceTemplate");
        const dbTemplate = await InvoiceTemplate.findByPk(invoice.invoiceTemplateId);
        if (dbTemplate && dbTemplate.templateHTML) {
          activeTemplateHTML = dbTemplate.templateHTML;
          console.log('[DOWNLOAD] Using DB invoice template for PDF:', dbTemplate.title);
        }
      }
    } catch (tplErr) {
      console.warn('[DOWNLOAD] Failed to load DB template, will fall back to file:', tplErr.message);
    }

    if (!activeTemplateHTML) {
      const templatePath = path.join(__dirname, "../templates/professional-invoice-template.html");
      activeTemplateHTML = fs.readFileSync(templatePath, "utf-8");
      console.log('[DOWNLOAD] Using file template: professional-invoice-template.html');
    }

    // Compile the template
    const template = handlebars.compile(activeTemplateHTML);

    // Prepare custom fields for template
    const customFieldData = await prepareCustomFieldsForTemplate(invoice.customFields || {}, req.user.id);

    // Prepare data for the template
    const invoiceData = {
      company_name: user.companyName || "Your Company",
      company_logo: user.companyLogo ? imageToBase64(user.companyLogo) : null,
      company_address: user.email || "",
      company_email: user.email || "",
      companyLogo: user.companyLogo ? imageToBase64(user.companyLogo) : null,
      userName: user.name || "User",
      client_name: invoice.client,
      client_email: invoice.clientEmail || "",
      client_address: "",
      invoice_number: invoice.id,
      invoice_date: new Date(invoice.date).toLocaleDateString(),
      due_date: invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : null,
      status: invoice.status || "Draft",
      currency: invoice.currency || "USD",
      currencySymbol: getCurrencySymbol(invoice.currency || "USD"),
      currency_symbol: getCurrencySymbol(invoice.currency || "USD"),
      work_type: invoice.workType,
      item_structure: invoice.itemStructure || "hourly",
      tasks: invoice.tasks.map(task => ({
        description: task.description,
        hours: task.hours,
        rate: task.rate ? task.rate.toFixed(2) : null,
        quantity: task.quantity,
        unitPrice: task.unitPrice ? task.unitPrice.toFixed(2) : null,
        days: task.days,
        amount: task.amount ? task.amount.toFixed(2) : null,
        total: task.total.toFixed(2)
      })),
      subtotal: invoice.totalAmount.toFixed(2),
      tax_rate: 0,
      tax_amount: "0.00",
      totalAmount: invoice.totalAmount.toFixed(2),
      total_amount: invoice.totalAmount.toFixed(2),
      notes: invoice.notes || "",
      // Custom fields
      has_custom_fields: customFieldData.custom_fields && customFieldData.custom_fields.length > 0,
      custom_fields: customFieldData.custom_fields || [],
      ...customFieldData,
      // Bank details
      accountHolderName: user.accountHolderName || null,
      bankName: user.bankName || null,
      accountName: user.accountName || null,
      accountNumber: user.accountNumber || null,
      iban: user.iban || null,
      bic: user.bic || null,
      sortCode: user.sortCode || null,
      swiftCode: user.swiftCode || null,
      routingNumber: user.routingNumber || null,
      bankAddress: user.bankAddress || null,
      additionalInfo: user.additionalInfo || null,
      paypalPaymentLink: null,
      stripePaymentLink: null
    };

    const html = template(invoiceData);

    // Generate PDF using Puppeteer first for browser-accurate rendering
    let buffer;
    try {
      if (!puppeteer) {
        return res.status(500).json({ message: 'PDF generation is not available' });
      }
      
      const browser = await puppeteer.launch({
        headless: 'new',
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--single-process",
          "--disable-gpu",
          "--font-render-hinting=none"
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
      });
      const page = await browser.newPage();
      await page.emulateMediaType('screen'); // ensure we use the same CSS as the preview
      await page.setContent(html, { waitUntil: 'networkidle0' });
      buffer = await page.pdf({
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 }
      });
      await browser.close();
    } catch (puppeteerErr) {
      return res.status(500).json({ message: 'Failed to generate PDF' });
    }

    // Log activity
    logActivity(
      req.user.id,
      'invoice_downloaded',
      `Invoice downloaded for ${invoice.client} (${invoice.workType})`,
      invoice.id,
      { client: invoice.client, totalAmount: invoice.totalAmount }
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Invoice-${invoice.id}.pdf`);
    res.send(buffer);
  } catch (error) {
    console.error("Error downloading invoice:", error);
    res.status(500).json({ message: "Failed to download invoice", error: error.message });
  }
};

// Stop recurring invoice
exports.stopRecurring = async (req, res) => {
  try {
    const { id } = req.params;

    const invoice = await Invoice.findByPk(id);
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    // Check authorization
    if (invoice.userId !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // Stop recurring
    await invoice.update({
      isRecurring: false,
      nextRecurringDate: null
    });

    // Log activity
    await logActivity(
      req.user.id,
      'recurring_stopped',
      `Recurring invoice stopped for ${invoice.client}`,
      invoice.id,
      { client: invoice.client, frequency: invoice.recurringFrequency }
    );

    console.log(`Stopped recurring for invoice ${id}`);
    res.status(200).json({ 
      message: "Recurring invoice stopped successfully",
      invoice 
    });
  } catch (error) {
    console.error("Error stopping recurring invoice:", error);
    res.status(500).json({ message: "Failed to stop recurring invoice", error: error.message });
  }
};
