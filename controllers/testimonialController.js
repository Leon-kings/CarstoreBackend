const Testimonial = require("../models/Testimonial");
const EmailService = require("../mails/sendEmail"); 
const emailService = new EmailService();

exports.createTestimonial = async (req, res) => {
  try {
    const { name, content, rating, email } = req.body;

    if (!name || !content || !email) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // Check for exact duplicate content from same email
    const existingTestimonial = await Testimonial.findOne({
      email: email,
      content: content,
    });

    if (existingTestimonial) {
      return res.status(400).json({
        success: false,
        message:
          "You have already submitted this exact testimonial. Thank you for your feedback!",
      });
    }

    const testimonial = new Testimonial({
      name,
      content,
      rating,
      email,
    });

    await testimonial.save();

    // Use the EmailService class method instead
    await emailService.sendTestimonialEmail(email, name, content, rating);

    res.status(201).json({
      success: true,
      message: "Testimonial submitted successfully!",
      data: testimonial,
    });
  } catch (error) {
    console.error("Error creating testimonial:", error); // Add this for debugging
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get all testimonials
exports.getTestimonials = async (req, res) => {
  try {
    const testimonials = await Testimonial.find().sort({ createdAt: -1 });

    res.json({
      success: true,
      data: testimonials,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get testimonial by ID
exports.getTestimonialById = async (req, res) => {
  try {
    const testimonial = await Testimonial.findById(req.params.id);

    if (!testimonial) {
      return res.status(404).json({
        success: false,
        message: "Testimonial not found",
      });
    }

    res.json({
      success: true,
      data: testimonial,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Update testimonial
exports.updateTestimonial = async (req, res) => {
  try {
    const testimonial = await Testimonial.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!testimonial) {
      return res.status(404).json({
        success: false,
        message: "Testimonial not found",
      });
    }

    res.json({
      success: true,
      message: "Testimonial updated successfully",
      data: testimonial,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Delete testimonial
exports.deleteTestimonial = async (req, res) => {
  try {
    const testimonial = await Testimonial.findByIdAndDelete(req.params.id);

    if (!testimonial) {
      return res.status(404).json({
        success: false,
        message: "Testimonial not found",
      });
    }

    res.json({
      success: true,
      message: "Testimonial deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get statistics
exports.getStatistics = async (req, res) => {
  try {
    const totalTestimonials = await Testimonial.countDocuments();
    const approvedTestimonials = await Testimonial.countDocuments({
      status: "approved",
    });
    const pendingTestimonials = await Testimonial.countDocuments({
      status: "pending",
    });

    const ratingStats = await Testimonial.aggregate([
      {
        $group: {
          _id: "$rating",
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const averageRating = await Testimonial.aggregate([
      {
        $group: {
          _id: null,
          average: { $avg: "$rating" },
        },
      },
    ]);

    // Monthly statistics for current year
    const monthlyStats = await Testimonial.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(new Date().getFullYear(), 0, 1),
            $lte: new Date(new Date().getFullYear(), 11, 31),
          },
        },
      },
      {
        $group: {
          _id: { $month: "$createdAt" },
          count: { $sum: 1 },
          avgRating: { $avg: "$rating" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      data: {
        total: totalTestimonials,
        approved: approvedTestimonials,
        pending: pendingTestimonials,
        averageRating: averageRating[0]?.average || 0,
        ratingDistribution: ratingStats,
        monthlyStats: monthlyStats,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Send monthly statistics email to admin
exports.sendMonthlyStatistics = async (req, res) => {
  try {
    const { adminEmail } = req.body;

    if (!adminEmail) {
      return res.status(400).json({
        success: false,
        message: "Admin email is required",
      });
    }

    // Get current month statistics
    const currentDate = new Date();
    const month = currentDate.getMonth() + 1;
    const year = currentDate.getFullYear();

    const monthlyStats = await Testimonial.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(year, month - 1, 1),
            $lte: new Date(year, month, 0),
          },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          approved: {
            $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] },
          },
          pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
          averageRating: { $avg: "$rating" },
        },
      },
    ]);

    const stats = monthlyStats[0] || {
      total: 0,
      approved: 0,
      pending: 0,
      averageRating: 0,
    };

    // Send email to admin
    await EmailService.sendMonthlyStatsEmail(adminEmail, stats, month, year);

    res.json({
      success: true,
      message: "Monthly statistics sent to admin successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
