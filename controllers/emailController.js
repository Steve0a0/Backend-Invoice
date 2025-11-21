const Invoice = require("../model/Invoice");
const fs = require("fs");
const path = require("path");
const handlebars = require("handlebars");
let puppeteer;
let chromium;
try {
  puppeteer = require("puppeteer-core");
  chromium = require("@sparticuz/chromium");
} catch (e) {
  console.error('⚠️ Puppeteer or Chromium not available:', e.message);
  puppeteer = null;
  chromium = null;
}

// Allow insecure prototype access for Handlebars
const { allowInsecurePrototypeAccess } = require("@handlebars/allow-prototype-access");
const HandlebarsWithAccess = allowInsecurePrototypeAccess(handlebars);

const generateInvoicePDF = async (req, res) => {
    const { invoiceId } = req.body;

    try {
        const invoice = await Invoice.findById(invoiceId).populate("user");
        if (!invoice) {
            return res.status(404).json({ message: "Invoice not found." });
        }

        // Load Handlebars Template
        const templatePath = path.resolve(__dirname, "../templates/invoice.hbs");
        const templateSource = fs.readFileSync(templatePath, "utf-8");
        const template = HandlebarsWithAccess.compile(templateSource);

        // Render HTML with dynamic data
        const html = template({
            client: invoice.client,
            date: new Date(invoice.date).toLocaleDateString(),
            tasks: invoice.tasks,
            currency: invoice.currency,
            totalAmount: invoice.totalAmount.toFixed(2),
        });

        // Generate PDF with Puppeteer
        if (!puppeteer || !chromium) {
            return res.status(500).json({ message: 'PDF generation is not available' });
        }
        
        const browser = await puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
        });
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: "domcontentloaded" });
        const pdfBuffer = Buffer.from(await page.pdf({ format: "A4" })); // Convert Uint8Array to Buffer
        await browser.close();

        // Save PDF Buffer to Database
        invoice.pdf = pdfBuffer; // Attach the Buffer to the `pdf` field
        await invoice.save(); // Save the invoice with the PDF in the database

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename=invoice_${invoiceId}.pdf`
        );
        res.send(pdfBuffer); // Send the PDF as a response
    } catch (err) {
        console.error("Error generating invoice PDF:", err);
        res.status(500).json({ message: "Failed to generate PDF." });
    }
};

// Retrieve PDF from the database
const getInvoicePDF = async (req, res) => {
    const { invoiceId } = req.params;

    try {
        const invoice = await Invoice.findById(invoiceId);
        if (!invoice || !invoice.pdf) {
            return res.status(404).json({ message: "Invoice PDF not found." });
        }

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename=invoice_${invoiceId}.pdf`
        );
        res.send(invoice.pdf); // Send the stored PDF
    } catch (err) {
        console.error("Error retrieving invoice PDF:", err);
        res.status(500).json({ message: "Failed to retrieve PDF." });
    }
};

module.exports = { generateInvoicePDF, getInvoicePDF };
