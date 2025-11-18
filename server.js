const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const dotenv = require("dotenv");
const sequelize = require("./config/database"); // Sequelize instance

// Import models to sync with DB
const User = require("./model/User");
const { Invoice, Task } = require("./model/Invoice");
const EmailTemplate = require("./model/EmailTemplate");
const EmailSettings = require("./model/EmailSettings");
const Activity = require("./model/Activity");
const CustomField = require("./model/CustomField");

// Import Routes
const authRoutes = require("./routes/auth");
const invoiceRoutes = require("./routes/invoiceRoutes");
const emailRoutes = require("./routes/emailRoutes");
const templateRoutes = require("./routes/emailTemplateRoutes");
const sendmailRoutes = require("./routes/sendmailRoutes");
const userRoutes = require("./routes/userRoutes");
const emailSettingsRoutes = require("./routes/emailSettingsRoutes");
const webhookRoutes = require("./routes/webhookRoutes");
const invoiceTemplateRoutes = require("./routes/invoiceTemplateRoutes");
const seedRoute = require("./routes/adminRoutes");
const activityRoutes = require("./routes/activityRoutes");
const customFieldRoutes = require("./routes/customFieldRoutes");
const { startRecurringInvoiceScheduler } = require("./services/recurringInvoiceScheduler");
const { migrateExistingInvoices } = require("./utils/migrateActivities");
dotenv.config();
const app = express();

// Get allowed origins from environment variable
const allowedOrigins = [
  "https://freeinvoice-frontend.onrender.com"
];

// Add production frontend URL if set
if (process.env.VITE_API_URL) {
  allowedOrigins.push(process.env.VITE_API_URL);
}

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
    credentials: true,
  })
);

// Allow CORS in responses
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
  }
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Authorization,Content-Type");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204); 
  }
  next();
});


// Body parser middleware
app.use(bodyParser.json({ limit: "20mb" }));
app.use(bodyParser.urlencoded({ limit: "10mb", extended: true }));
app.use("/uploads", express.static("uploads"));

// Health check endpoint for Render
app.get("/", (req, res) => {
  res.status(200).json({ 
    status: "ok", 
    message: "Freelance Invoice Backend API is running",
    timestamp: new Date().toISOString()
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({ 
    status: "healthy", 
    database: sequelize.authenticate() ? "connected" : "disconnected"
  });
});

// Database connection & server start
const startServer = async () => {
  let retries = 5;
  while (retries) {
    try {
      await sequelize.authenticate();

      // Sync without alter to avoid ENUM conversion issues
      await sequelize.sync();

      // Auto-migrate existing invoices to activities if Activity table is empty
      const activityCount = await Activity.count();
      if (activityCount === 0) {
        const migrationResult = await migrateExistingInvoices();
        if (migrationResult.success) {
        }
      }

      // Start recurring invoice scheduler (checks every 60 minutes)
      startRecurringInvoiceScheduler(60);

      const PORT = process.env.PORT || 5000;
      app.listen(PORT, () =>
        console.log(`Server running on port ${PORT}`)
      );
      break;
    } catch (err) {
      console.error("⏳ Database connection failed. Retrying in 5s...");
      console.error(err.message);
      retries--;
      await new Promise(res => setTimeout(res, 5000));
    }
  }
};

startServer();


// Routes
app.use("/api", webhookRoutes);
app.use("/api/user", userRoutes);
app.use("/api/email-settings", emailSettingsRoutes);
app.use("/api", sendmailRoutes);
app.use("/api/templates", templateRoutes);
app.use(authRoutes);
app.use("/api", emailRoutes);
app.use("/api/invoices", invoiceRoutes); 
app.use("/api/invoicetemplates", invoiceTemplateRoutes);
app.use("/api/recent-activities", activityRoutes);
app.use("/api/custom-fields", customFieldRoutes);

app.use("/api/admin", seedRoute);