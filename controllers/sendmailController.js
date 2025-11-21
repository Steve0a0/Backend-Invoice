const nodemailer = require("nodemailer");
const fetch = require("node-fetch");
const EmailSettings = require("../model/EmailSettings");
const { Invoice, Task } = require("../model/Invoice"); // ✅ correct way
const path = require("path");
const handlebars = require("handlebars");
let puppeteer;
let chromium;
try {
  puppeteer = require("puppeteer-core");
  chromium = require("@sparticuz/chromium");
} catch (e) {
  puppeteer = null;
  chromium = null;
}
const { getCurrencySymbol } = require("../utils/currencyHelper");
const { logActivity } = require("../utils/activityLogger");
const { prepareCustomFieldsForTemplate } = require("../utils/customFieldHelper");
const { imageToBase64 } = require("../utils/imageHelper");

// Register custom Handlebars helpers
handlebars.registerHelper('eq', function(a, b) {
  return a === b;
});

handlebars.registerHelper('unless', function(conditional, options) {
  if (!conditional) {
    return options.fn(this);
  }
  return options.inverse(this);
});


// Function to generate a PayPal Checkout link
const generatePayPalLink = async (invoice, userId) => {
  // Fetch PayPal credentials for the specific user (correct Sequelize syntax)
  const emailSettings = await EmailSettings.findOne({ where: { userId } });

  if (!emailSettings || !emailSettings.paypalClientId || !emailSettings.paypalSecret) {
    throw new Error("PayPal credentials not found for this user. Please configure them first.");
  }

  const { paypalClientId, paypalSecret } = emailSettings;

  // Generate OAuth token
  const authResponse = await fetch("https://api-m.sandbox.paypal.com/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${paypalClientId}:${paypalSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!authResponse.ok) {
    throw new Error(`PayPal authentication failed: ${await authResponse.text()}`);
  }

  const authData = await authResponse.json();
  const access_token = authData.access_token;

  if (!access_token) {
    throw new Error("Failed to authenticate with PayPal. Check the credentials.");
  }

  // Create a PayPal order
  const orderResponse = await fetch("https://api-m.sandbox.paypal.com/v2/checkout/orders", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE", // Immediate payment intent
      purchase_units: [
        {
          
          amount: {
            currency_code: invoice.currency || "USD",
            value: invoice.totalAmount.toString(),
          },
          description: `Payment for Invoice ${invoice._id}`,
        },
      ],
      application_context: {
        user_action: "PAY_NOW",
        return_url: `http://localhost:5000/api/paypal/return?invoiceId=${invoice.id}`, // Replace with your actual return URL
        cancel_url: "http://localhost:5000/api/paypal/cancel", // Replace with your actual cancel URL
      },
    }),
  });
  if (!orderResponse.ok) {
    throw new Error(`Failed to create PayPal order: ${await orderResponse.text()}`);
  }
  const orderData = await orderResponse.json();
  if (orderData.status !== "CREATED") {
    throw new Error("Failed to create PayPal order. Check the request details.");
  }
  // Extract the approval URL
  const approvalLink = orderData.links.find((link) => link.rel === "approve");
  if (!approvalLink) {
    throw new Error("Unable to generate PayPal approval link.");
  }
  
  // Log payment link generation activity
  await logActivity(
    userId,
    'payment_link_generated',
    `PayPal payment link generated for invoice`,
    invoice.id,
    { paymentMethod: 'PayPal', amount: invoice.totalAmount, currency: invoice.currency }
  );
  
  return approvalLink.href; // The PayPal Checkout link
};
const capturePayment = async (req, res) => {
  const { token: orderId, invoiceId } = req.query;

  if (!orderId || !invoiceId || invoiceId === "undefined") {
      return res.status(400).json({ error: "Missing or invalid order ID or invoice ID." });
  }

  try {
      const emailSettings = await EmailSettings.findOne();
      if (!emailSettings || !emailSettings.paypalClientId || !emailSettings.paypalSecret) {
          return res.status(400).json({ error: "PayPal credentials missing." });
      }

      const { paypalClientId, paypalSecret } = emailSettings;

      // Generate OAuth token
      const authResponse = await fetch("https://api-m.sandbox.paypal.com/v1/oauth2/token", {
          method: "POST",
          headers: {
              Authorization: `Basic ${Buffer.from(`${paypalClientId}:${paypalSecret}`).toString("base64")}`,
              "Content-Type": "application/x-www-form-urlencoded",
          },
          body: "grant_type=client_credentials",
      });

      const authData = await authResponse.json();
      const access_token = authData.access_token;

      if (!access_token) {
          return res.status(500).json({ error: "PayPal authentication failed." });
      }

      // Capture the payment
      const captureResponse = await fetch(`https://api-m.sandbox.paypal.com/v2/checkout/orders/${orderId}/capture`, {
          method: "POST",
          headers: {
              Authorization: `Bearer ${access_token}`,
              "Content-Type": "application/json",
          },
      });

      const captureData = await captureResponse.json();

      if (captureData.status === "COMPLETED") {
          // ✅ Update invoice status in database
          const updatedInvoice = await Invoice.update(
              { status: "Paid" },
              { where: { id: invoiceId } }
          );

          if (!updatedInvoice[0]) {
              return res.status(404).json({ error: "Invoice not found or not updated." });
          }

          // Log payment received activity
          const invoice = await Invoice.findOne({ where: { id: invoiceId } });
          if (invoice) {
            await logActivity(
              invoice.userId,
              'payment_received',
              `Payment received via PayPal for invoice`,
              invoiceId,
              { paymentMethod: 'PayPal', amount: invoice.totalAmount, currency: invoice.currency }
            );
          }

          // ✅ Ensure only one response is sent
          if (!res.headersSent) {
              return res.redirect(`http://localhost:5173/payment-success?invoice=${invoiceId}`);
          }
      } else {
          // Log payment failure activity
          const invoice = await Invoice.findOne({ where: { id: invoiceId } });
          if (invoice) {
            await logActivity(
              invoice.userId,
              'payment_failed',
              `PayPal payment failed for invoice`,
              invoiceId,
              { paymentMethod: 'PayPal', error: captureData.message || 'Payment capture failed' }
            );
          }

          if (!res.headersSent) {
              return res.status(500).json({ error: "Payment capture failed.", details: captureData });
          }
      }
  } catch (error) {
      if (!res.headersSent) {
          return res.status(500).json({ error: "Failed to capture payment.", details: error.message });
      }
  }
};


const generateStripeLink = async (invoice, userId) => {
  const emailSettings = await EmailSettings.findOne({ where: { userId } });

  if (!emailSettings || !emailSettings.stripeSecretKey) {
    throw new Error("Stripe credentials not found for this user. Please configure them first.");
  }

  const stripeInstance = require("stripe")(emailSettings.stripeSecretKey);

  const session = await stripeInstance.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: invoice.currency || "USD",
          product_data: {
            name: `Payment for Invoice ${invoice._id}`,
          },
          unit_amount: Math.round(invoice.totalAmount * 100),
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: `http://localhost:5173/payment-success?invoice=${invoice.id}`,
    cancel_url: `https://yourdomain.com/stripe/cancel`,
    metadata: {
      invoiceId: invoice.id.toString(), // ✅ Required for webhook
    },
  });

  // Log payment link generation activity
  await logActivity(
    userId,
    'payment_link_generated',
    `Stripe payment link generated for invoice`,
    invoice.id,
    { paymentMethod: 'Stripe', amount: invoice.totalAmount, currency: invoice.currency }
  );

  return session.url;
};


const sendInvoiceEmail = async (req, res) => {
  const { recipientEmail, subject, message, invoiceId, templateHTML: clientProvidedTemplateHTML, forceClientTemplate } = req.body;

  if (!recipientEmail || !subject || !message || !invoiceId) {
    return res.status(400).json({
      error: "Recipient email, subject, message, and invoice ID are required.",
    });
  }

  try {
    const userId = req.user.id;

    // Fetch email settings
    const emailSettings = await EmailSettings.findOne({ where: { userId } });
    if (!emailSettings || !emailSettings.email || !emailSettings.appPassword) {
      return res.status(400).json({
        error: "Email settings not found or incomplete. Please configure them first.",
      });
    }

    // Fetch user information for company details
    const User = require("../model/User");
    const user = await User.findOne({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // Fetch the invoice details
    const invoice = await Invoice.findOne({ 
      where: { id: invoiceId },
      include: [
        {
          model: Task,
          as: "tasks",
          attributes: ["description", "hours", "rate", "quantity", "unitPrice", "days", "amount", "total"],
        },
      ],
    });
     
    if (!invoice) {
        return res.status(404).json({ error: "Invoice not found." });
      }

      // Generate payment links if credentials exist
      let paypalPaymentLink = null;
      let stripePaymentLink = null;

    if (emailSettings.paypalClientId && emailSettings.paypalSecret) {
      try {
        paypalPaymentLink = await generatePayPalLink(invoice, userId);
      } catch (error) {
        // PayPal link generation failed silently
      }
    }

    if (emailSettings.stripeSecretKey) {
      try {
        stripePaymentLink = await generateStripeLink(invoice, userId);
      } catch (error) {
        // Stripe link generation failed silently
      }
    }

      // Prepare placeholder data for HTML
      const customFieldData = await prepareCustomFieldsForTemplate(invoice.customFields || {}, userId);

      // Map tasks into a plain array for Handlebars templates
      const mappedTasks = (invoice.tasks || []).map(task => {
        const rateValue = typeof task.rate === "number" ? task.rate.toFixed(2) : task.rate ?? null;
        const unitPriceValue = typeof task.unitPrice === "number" ? task.unitPrice.toFixed(2) : task.unitPrice ?? null;
        const totalValue = typeof task.total === "number" ? task.total.toFixed(2) : task.total ?? null;
        const amountValue = typeof task.amount === "number"
          ? task.amount.toFixed(2)
          : totalValue;

        return {
          description: task.description,
          hours: task.hours,
          rate: rateValue,
          quantity: task.quantity,
          unitPrice: unitPriceValue,
          days: task.days,
          amount: amountValue,
          total: totalValue,
        };
      });

      // Build a generic custom_fields array for templates that expect label/value pairs
      const customFieldsArray = Object.entries(customFieldData || {}).map(([key, value]) => ({
        label: key,
        value,
      }));
      
      const subtotalValue = Number(invoice.totalAmount || 0);
      const taxAmountValue = 0;
      const discountValue = 0;
      const formattedTax = taxAmountValue > 0 ? taxAmountValue.toFixed(2) : null;
      const formattedDiscount = discountValue > 0 ? discountValue.toFixed(2) : null;

      const placeholderData = {
        // Client information
        client_name: invoice.client,
        clientName: invoice.client,
        // Legacy key for older templates (e.g. invoice.hbs)
        client: invoice.client,
        client_email: invoice.clientEmail || "",
        client_address: invoice.clientAddress || "N/A",
        
      // Company information (from user model)
        company_name: user.companyName || "Your Company",
        company_logo: user.companyLogo ? imageToBase64(user.companyLogo) : null,
        company_email: user.email || emailSettings.email,
        company_address: user.email || emailSettings.email, // Use email as address fallback
        companyLogo: user.companyLogo ? imageToBase64(user.companyLogo) : null,
        // Legacy user object for older templates that expect {{user.name}}
        user: {
          name: user.name || emailSettings.email,
        },
        
        // Invoice details
        invoice_number: invoice.invoiceNumber || invoice.id,
        invoiceId: invoice.id,
        // Legacy _id field for older templates
        _id: invoice.id,
        invoice_date: new Date(invoice.date).toLocaleDateString("en-US"),
        date: new Date(invoice.date).toLocaleDateString("en-US"),
        due_date: invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("en-US") : "N/A",
      status: invoice.status || "Draft",
      
      // Amount and currency
        subtotal: subtotalValue.toFixed(2),
        tax_rate: 0,
        tax_amount: taxAmountValue.toFixed(2),
        total_amount: subtotalValue.toFixed(2),
        totalAmount: subtotalValue.toFixed(2),
        // Legacy fields used by some templates
        tax: formattedTax,
        discount: formattedDiscount,
        total: subtotalValue.toFixed(2),
        currency: invoice.currency || "USD",
        currencySymbol: getCurrencySymbol(invoice.currency || "USD"),
      currency_symbol: getCurrencySymbol(invoice.currency || "USD"),
      
      // Work details
      work_type: invoice.workType || "",
      workType: invoice.workType || "",
      item_structure: invoice.itemStructure || "hourly",
      notes: invoice.notes || "",
      
      // User/sender information
      userName: user.name || emailSettings.email,
      
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
      
      // Payment links
        paypalPaymentLink,
        stripePaymentLink,
        
        // Tasks / line items
        tasks: mappedTasks,
        items: mappedTasks, // legacy templates expect {{#each items}}
        
        // Custom fields
        has_custom_fields: customFieldsArray.length > 0,
        custom_fields: customFieldsArray,
        customFields: customFieldsArray, // legacy templates expect camelCase
        
        // Custom fields - spread them into the placeholder data
        ...customFieldData,
      };

    // Personalize email message and subject
    const personalizedMessage = message.replace(/{{(.*?)}}/g, (_, key) => placeholderData[key.trim()] || "");
    const personalizedSubject = subject.replace(/{{(.*?)}}/g, (_, key) => placeholderData[key.trim()] || "");

    // Set email attachments - only include PDF if template is provided
    const attachments = [];
    
    // Only generate PDF if clientProvidedTemplateHTML is present or forceClientTemplate is true
    let activeTemplateHTML = null;
    if (clientProvidedTemplateHTML) {
      activeTemplateHTML = clientProvidedTemplateHTML;
    } else if (forceClientTemplate) {
      // If forceClientTemplate is true, use the saved template
      if (invoice.invoiceTemplateId) {
        try {
          const InvoiceTemplate = require("../model/InvoiceTemplate");
          const dbTemplate = await InvoiceTemplate.findByPk(invoice.invoiceTemplateId);
          if (dbTemplate && dbTemplate.templateHTML) {
            activeTemplateHTML = dbTemplate.templateHTML;
          }
        } catch (err) {
          // Failed to fetch template from database
        }
      }
    }

    if (activeTemplateHTML) {
        // Compile template and replace placeholders
        const compiledTemplate = handlebars.compile(activeTemplateHTML);
        const finalHtml = compiledTemplate(placeholderData);

      // Generate PDF buffer from HTML using Puppeteer
      let pdfBuffer = null;
      
      if (!puppeteer || !chromium) {
        // Puppeteer or Chromium not available
      } else {
        try {
          const browser = await puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
          });
          
          const page = await browser.newPage();
          await page.emulateMediaType('screen');
          await page.setContent(finalHtml, { waitUntil: 'networkidle0' });
          
          pdfBuffer = await page.pdf({
            printBackground: true,
            preferCSSPageSize: true,
            margin: { top: 0, right: 0, bottom: 0, left: 0 }
          });
          
          await browser.close();
        } catch (puppeteerErr) {
          pdfBuffer = null;
        }
      }

      if (pdfBuffer) {
        attachments.push({
          filename: `invoice-${invoice.id}.pdf`,
          content: pdfBuffer,
        });
      }
    }

    // Configure email transporter with dynamic settings
    let transporterConfig = {
      auth: {
        user: emailSettings.email,
        pass: emailSettings.appPassword,
      },
    };

    // Determine SMTP settings based on email domain
    const emailDomain = emailSettings.email.split('@')[1]?.toLowerCase();
    
    if (emailDomain && emailDomain.includes('gmail')) {
      transporterConfig.service = 'Gmail';
    } else if (emailDomain && (emailDomain.includes('outlook') || emailDomain.includes('hotmail') || emailDomain.includes('live'))) {
      transporterConfig.host = 'smtp-mail.outlook.com';
      transporterConfig.port = 587;
      transporterConfig.secure = false;
      transporterConfig.tls = {
        ciphers: 'SSLv3'
      };
    } else if (emailDomain && emailDomain.includes('office365.com')) {
      transporterConfig.host = 'smtp.office365.com';
      transporterConfig.port = 587;
      transporterConfig.secure = false;
      transporterConfig.tls = {
        ciphers: 'SSLv3'
      };
    } else {
      // Generic SMTP settings for custom domains
      transporterConfig.host = emailSettings.smtpHost || 'smtp.office365.com';
      transporterConfig.port = emailSettings.smtpPort || 587;
      transporterConfig.secure = false;
      transporterConfig.tls = {
        ciphers: 'SSLv3'
      };
    }

    const transporter = nodemailer.createTransport(transporterConfig);

    // Setup email
    const mailOptions = {
      from: emailSettings.email,
      to: recipientEmail,
      subject: personalizedSubject,
      text: personalizedMessage,
      attachments,
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);

    // Update invoice with PDF template info if template was sent
    if (activeTemplateHTML && info.accepted && info.accepted.length > 0) {
      await Invoice.update(
        {
          pdfTemplateSent: true,
          sentTemplateHTML: activeTemplateHTML,
        },
        { where: { id: invoiceId } }
      );
    }

    // Log activity based on email success/failure
    if (info.accepted && info.accepted.length > 0) {
      await logActivity(
        userId,
        'email_sent',
        `Invoice email sent to ${recipientEmail}`,
        invoiceId,
        { recipientEmail, client: invoice.client, subject, withPDF: !!activeTemplateHTML }
      );
    } else if (info.rejected && info.rejected.length > 0) {
      await logActivity(
        userId,
        'email_failed',
        `Failed to send invoice email to ${recipientEmail}`,
        invoiceId,
        { recipientEmail, client: invoice.client, error: 'Email rejected' }
      );
    }

    res.status(200).json({
      message: "Email sent successfully!",
      paypalPaymentLink: emailSettings.paypalClientId ? paypalPaymentLink : null,
      stripePaymentLink: emailSettings.stripeSecretKey ? stripePaymentLink : null,
    });

  } catch (error) {
    // Log email failure activity
    const userId = req.user?.id;
    const { recipientEmail, invoiceId } = req.body;
    if (userId && invoiceId) {
      await logActivity(
        userId,
        'email_failed',
        `Failed to send invoice email to ${recipientEmail}`,
        invoiceId,
        { recipientEmail, error: error.message }
      );
    }
    
    res.status(500).json({ error: "Failed to send email.", details: error.message });
  }
};

module.exports = {
  generatePayPalLink,
  generateStripeLink,
  capturePayment,
  sendInvoiceEmail,
};
