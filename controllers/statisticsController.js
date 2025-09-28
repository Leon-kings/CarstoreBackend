const User = require("../models/User");
const EmailService = require("../mails/sendEmail");
const cron = require("node-cron");

class MonthlyReportService {
  constructor() {
    this.setupMonthlyJob();
  }

  async generateMonthlyReport() {
    try {
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      // Get user statistics
      const totalUsers = await User.countDocuments();
      const newUsersThisMonth = await User.countDocuments({
        createdAt: { $gte: firstDayOfMonth, $lte: lastDayOfMonth }
      });
      
      const activeUsersThisMonth = await User.countDocuments({
        lastLogin: { $gte: firstDayOfMonth, $lte: lastDayOfMonth }
      });

      const totalLogins = await User.aggregate([
        { $group: { _id: null, total: { $sum: "$loginCount" } } }
      ]);

      // Get recent users (last 10)
      const recentUsers = await User.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .select('name email createdAt');

      const reportData = {
        totalUsers,
        newUsersThisMonth,
        activeUsersThisMonth,
        totalLogins: totalLogins[0]?.total || 0,
        recentUsers,
        reportPeriod: {
          from: firstDayOfMonth.toLocaleDateString(),
          to: lastDayOfMonth.toLocaleDateString()
        }
      };

      return reportData;
    } catch (error) {
      console.error("Error generating monthly report:", error);
      throw error;
    }
  }

  async sendMonthlyReport() {
    try {
      const adminEmail = process.env.ADMIN_EMAIL;
      if (!adminEmail) {
        console.log("No admin email configured for monthly reports");
        return;
      }

      const reportData = await this.generateMonthlyReport();
      await EmailService.sendMonthlyReportToAdmin(adminEmail, reportData);
      
      console.log("Monthly report sent successfully");
    } catch (error) {
      console.error("Failed to send monthly report:", error);
    }
  }

  setupMonthlyJob() {
    // Run at 9 AM on the first day of every month
    cron.schedule("0 9 1 * *", () => {
      console.log("Sending monthly report...");
      this.sendMonthlyReport();
    });

    console.log("Monthly report scheduler initialized");
  }
}

module.exports = new MonthlyReportService();