const Subscription = require("../models/Subscription");

class SubscriptionController {
  // CREATE - Subscribe new email
  async subscribe(req, res) {
    try {
      const { email } = req.body;

      // Validate required fields
      if (!email) {
        return res.status(400).json({
          success: false,
          message: "Email is required",
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: "Invalid email format",
        });
      }

      // Check if email already exists
      const existingSubscription = await Subscription.findOne({
        email: email.toLowerCase(),
      });

      if (existingSubscription) {
        // If exists but unsubscribed, reactivate it
        if (existingSubscription.status === "unsubscribed") {
          await existingSubscription.resubscribe();
          existingSubscription.source = source;

          await existingSubscription.save();

          return res.status(200).json({
            success: true,
            message: "Email resubscribed successfully",
            data: existingSubscription,
            action: "resubscribed",
          });
        } else if (existingSubscription.status === "active") {
          return res.status(409).json({
            success: false,
            message: "Email already subscribed",
          });
        }
      }

      // Create new subscription
      const subscription = new Subscription({
        email: email.toLowerCase(),
      });

      await subscription.save();

      return res.status(201).json({
        success: true,
        message: "Successfully subscribed to newsletter",
        data: subscription,
        action: "created",
      });
    } catch (error) {
      console.error("Subscription controller error:", error);

      // Handle duplicate key error (MongoDB unique constraint)
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: "Email already subscribed",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // READ - Get all subscriptions with pagination and filtering
  async getSubscriptions(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        source,
        search,
        sortBy = "subscribedAt",
        sortOrder = "desc",
      } = req.query;

      // Build query
      const query = {};

      // Filter by status
      if (status && status !== "all") {
        query.status = status;
      }

      // Filter by source
      if (source && source !== "all") {
        query.source = source;
      }

      // Search by email
      if (search) {
        query.email = { $regex: search, $options: "i" };
      }

      // Build sort object
      const sort = {};
      const validSortFields = [
        "email",
        "status",
        "source",
        "subscribedAt",
        "unsubscribedAt",
        "createdAt",
      ];
      const sortField = validSortFields.includes(sortBy)
        ? sortBy
        : "subscribedAt";
      sort[sortField] = sortOrder === "asc" ? 1 : -1;

      // Execute query with pagination
      const subscriptions = await Subscription.find(query)
        .sort(sort)
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit))
        .select("-__v");

      const total = await Subscription.countDocuments(query);
      const totalPages = Math.ceil(total / parseInt(limit));

      return res.status(200).json({
        success: true,
        data: {
          subscriptions,
          pagination: {
            currentPage: parseInt(page),
            totalPages,
            totalSubscriptions: total,
            hasNext: parseInt(page) < totalPages,
            hasPrev: parseInt(page) > 1,
          },
        },
      });
    } catch (error) {
      console.error("Get subscriptions controller error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // READ - Get single subscription by ID
  async getSubscriptionById(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: "Subscription ID is required",
        });
      }

      const subscription = await Subscription.findById(id).select("-__v");

      if (!subscription) {
        return res.status(404).json({
          success: false,
          message: "Subscription not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: subscription,
      });
    } catch (error) {
      console.error("Get subscription by ID controller error:", error);

      if (error.name === "CastError") {
        return res.status(400).json({
          success: false,
          message: "Invalid subscription ID format",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // READ - Get subscription by email
  async getSubscriptionByEmail(req, res) {
    try {
      const { email } = req.params;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: "Email is required",
        });
      }

      const subscription = await Subscription.findOne({
        email: email.toLowerCase(),
      }).select("-__v");

      return res.status(200).json({
        success: true,
        data: subscription,
      });
    } catch (error) {
      console.error("Get subscription by email controller error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // UPDATE - Update subscription
  async updateSubscription(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: "Subscription ID is required",
        });
      }

      // Allowed updates
      const allowedUpdates = ["status", "source", "tags", "metadata"];
      const updates = {};

      Object.keys(updateData).forEach((key) => {
        if (allowedUpdates.includes(key)) {
          updates[key] = updateData[key];
        }
      });

      // Handle status changes
      if (updates.status === "unsubscribed" && !updateData.unsubscribedAt) {
        updates.unsubscribedAt = new Date();
      } else if (updates.status === "active" && updateData.unsubscribedAt) {
        updates.unsubscribedAt = null;
      }

      const subscription = await Subscription.findByIdAndUpdate(id, updates, {
        new: true,
        runValidators: true,
      }).select("-__v");

      if (!subscription) {
        return res.status(404).json({
          success: false,
          message: "Subscription not found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Subscription updated successfully",
        data: subscription,
      });
    } catch (error) {
      console.error("Update subscription controller error:", error);

      if (error.name === "CastError") {
        return res.status(400).json({
          success: false,
          message: "Invalid subscription ID format",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // DELETE - Remove subscription permanently
  async deleteSubscription(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: "Subscription ID is required",
        });
      }

      const subscription = await Subscription.findByIdAndDelete(id);

      if (!subscription) {
        return res.status(404).json({
          success: false,
          message: "Subscription not found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Subscription deleted successfully",
        data: { id },
      });
    } catch (error) {
      console.error("Delete subscription controller error:", error);

      if (error.name === "CastError") {
        return res.status(400).json({
          success: false,
          message: "Invalid subscription ID format",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // UNSUBSCRIBE BY EMAIL
  async unsubscribeByEmail(req, res) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: "Email is required",
        });
      }

      const subscription = await Subscription.findOne({
        email: email.toLowerCase(),
      });

      if (!subscription) {
        return res.status(404).json({
          success: false,
          message: "Subscription not found",
        });
      }

      if (subscription.status === "unsubscribed") {
        return res.status(400).json({
          success: false,
          message: "Email is already unsubscribed",
        });
      }

      await subscription.unsubscribe();

      return res.status(200).json({
        success: true,
        message: "Successfully unsubscribed",
        data: subscription,
      });
    } catch (error) {
      console.error("Unsubscribe by email controller error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // RESUBSCRIBE BY EMAIL
  async resubscribeByEmail(req, res) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: "Email is required",
        });
      }

      const subscription = await Subscription.findOne({
        email: email.toLowerCase(),
      });

      if (!subscription) {
        return res.status(404).json({
          success: false,
          message: "Subscription not found",
        });
      }

      if (subscription.status === "active") {
        return res.status(400).json({
          success: false,
          message: "Email is already subscribed",
        });
      }

      await subscription.resubscribe();

      return res.status(200).json({
        success: true,
        message: "Successfully resubscribed",
        data: subscription,
      });
    } catch (error) {
      console.error("Resubscribe by email controller error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // STATISTICS
  async getStatistics(req, res) {
    try {
      const statistics = await Subscription.getStatistics();

      return res.status(200).json({
        success: true,
        data: statistics,
      });
    } catch (error) {
      console.error("Get statistics controller error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to get statistics",
      });
    }
  }

  // GET SUBSCRIPTIONS BY DATE RANGE
  async getSubscriptionsByDateRange(req, res) {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: "Start date and end date are required",
        });
      }

      // Validate dates
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid date format",
        });
      }

      if (start > end) {
        return res.status(400).json({
          success: false,
          message: "Start date cannot be after end date",
        });
      }

      const subscriptions = await Subscription.getSubscriptionsByDateRange(
        startDate,
        endDate
      );

      return res.status(200).json({
        success: true,
        data: subscriptions,
      });
    } catch (error) {
      console.error("Get subscriptions by date range controller error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to get subscriptions by date range",
      });
    }
  }

  // EXPORT SUBSCRIPTIONS
  async exportSubscriptions(req, res) {
    try {
      const { status = "active", format = "csv" } = req.query;

      const query = {};
      if (status && status !== "all") {
        query.status = status;
      }

      const subscriptions = await Subscription.find(query)
        .select("email source subscribedAt status")
        .sort({ subscribedAt: -1 });

      if (format === "json") {
        return res.status(200).json({
          success: true,
          data: subscriptions,
        });
      }

      // Default to CSV
      const csvHeaders = "Email,Source,Status,Subscribed At\n";
      const csvRows = subscriptions
        .map(
          (sub) =>
            `"${sub.email}","${sub.source}","${
              sub.status
            }","${sub.subscribedAt.toISOString()}"`
        )
        .join("\n");

      const csv = csvHeaders + csvRows;

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=subscriptions-${status}-${Date.now()}.csv`
      );

      return res.send(csv);
    } catch (error) {
      console.error("Export subscriptions controller error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to export subscriptions",
      });
    }
  }
}

module.exports = new SubscriptionController();
