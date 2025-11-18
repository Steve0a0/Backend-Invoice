const { Sequelize } = require("sequelize");
require("dotenv").config();

// Support both DATABASE_URL (Render) and individual credentials (local)
let sequelize;

if (process.env.DATABASE_URL) {
  // Production: Use DATABASE_URL from Render
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: "postgres",
    logging: false,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false // Render requires SSL
      }
    }
  });
} else {
  // Development: Use individual environment variables
  sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS, {
    host: process.env.DB_HOST,
    dialect: "postgres",
    port: process.env.DB_PORT,
    logging: false, // Set to true for debugging SQL queries
  });
}

sequelize
  .authenticate()
  .then(() => console.log("Connected to PostgreSQL"))
  .catch((err) => console.error("Failed to connect to PostgreSQL:", err));

module.exports = sequelize;
