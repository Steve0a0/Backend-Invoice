const express = require('express');
const router = express.Router();

// Protected test endpoint for verifying Puppeteer+Chromium in production
// Usage: GET /api/internal/test-puppeteer?token=YOUR_TOKEN
// If TEST_PUPPETEER_TOKEN is not set in env, the endpoint is allowed for convenience.
router.get('/internal/test-puppeteer', async (req, res) => {
  const expectedToken = process.env.TEST_PUPPETEER_TOKEN;
  const provided = req.query.token;
  if (expectedToken && provided !== expectedToken) {
    return res.status(401).json({ error: 'Unauthorized. Provide valid token as ?token=...' });
  }

  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch (e) {
    return res.status(500).json({ error: 'Puppeteer not available' });
  }

  const sampleHtml = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Test PDF</title>
        <style>body{font-family:Arial,Helvetica,sans-serif;padding:24px}h1{color:#2b7cff}</style>
      </head>
      <body>
        <h1>Puppeteer Test PDF</h1>
        <p>Date: ${new Date().toISOString()}</p>
        <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%">
          <thead><tr><th>Description</th><th>Qty</th><th>Unit</th><th>Total</th></tr></thead>
          <tbody><tr><td>Test service</td><td>1</td><td>$1.00</td><td>$1.00</td></tr></tbody>
        </table>
      </body>
    </html>
  `;

  try {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--font-render-hinting=none'
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    });

    const page = await browser.newPage();
    await page.emulateMediaType('screen');
    await page.setContent(sampleHtml, { waitUntil: 'networkidle0' });
    const buffer = await page.pdf({ printBackground: true, preferCSSPageSize: true, margin: { top: 10, right: 10, bottom: 10, left: 10 } });
    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename=test-puppeteer.pdf');
    return res.send(buffer);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
