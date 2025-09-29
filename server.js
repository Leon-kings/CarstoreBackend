require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

// Routes
const userRoutes = require("./routes/users");
const contactsRoutes = require("./routes/contactsRoutes");
const testimonialRoutes = require("./routes/testimonialRoutes");
const customerPaymentRoutes = require("./routes/customerPaymentRoutes");
const carRoutes = require("./routes/carRoutes");
const featureRoutes = require("./routes/featureRoutes");

// Controllers / Services
const MonthlyReportService = require("./controllers/statisticsController");

const app = express();

// -------------------- Middleware --------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS configuration
app.use(
  cors({
    origin: process.env.CLIENT_URL || "*", // ✅ use CLIENT_URL, not DB
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// -------------------- Database --------------------
mongoose
  .connect(process.env.DB, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// -------------------- Routes --------------------
app.use("/users", userRoutes);
app.use("/contacts", contactsRoutes);
app.use("/testimony", testimonialRoutes);
app.use("/payments", customerPaymentRoutes);
app.use("/cars", carRoutes);
app.use("/features", featureRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Initialize monthly report service
if (typeof MonthlyReportService === "function") {
  MonthlyReportService();
}

// -------------------- Error Handling --------------------
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    success: false,
    message: "Something went wrong on our end. We're looking into it!",
    errorCode: "INTERNAL_SERVER_ERROR",
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "The page you're looking for doesn't exist.",
    errorCode: "NOT_FOUND",
    timestamp: new Date().toISOString(),
  });
});

// -------------------- Start Server --------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(
    `📧 Email service: ${
      process.env.EMAIL_SERVICE ? "Configured" : "Not configured"
    }`
  );
  console.log(`👤 Admin email: ${process.env.ADMIN_EMAIL || "Not set"}`);
});
