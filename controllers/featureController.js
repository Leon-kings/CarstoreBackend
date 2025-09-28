const Feature = require('../models/Feature');
const EmailService = require('../services/EmailService');
const emailService = new EmailService();

// @desc    Get all features with advanced filtering
// @route   GET /api/features
// @access  Public
exports.getAllFeatures = async (req, res) => {
  try {
    const { 
      category, 
      status, 
      search,
      page = 1, 
      limit = 10,
      sortBy = 'releaseDate',
      sortOrder = 'desc'
    } = req.query;
    
    // Build filter object
    const filter = { isActive: true };
    
    if (category) filter.category = category;
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { longDescription: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Sort configuration
    const sortConfig = {};
    sortConfig[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    const features = await Feature.find(filter)
      .populate('createdBy', 'name email')
      .sort(sortConfig)
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Feature.countDocuments(filter);
    
    res.json({
      success: true,
      data: features,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching features:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching features'
    });
  }
};

// @desc    Get single feature and increment views
// @route   GET /api/features/:id
// @access  Public
exports.getFeatureById = async (req, res) => {
  try {
    const feature = await Feature.findById(req.params.id)
      .populate('createdBy', 'name email');
    
    if (!feature || !feature.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Feature not found'
      });
    }
    
    // Increment views
    feature.views += 1;
    await feature.save();
    
    res.json({
      success: true,
      data: feature
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching feature'
    });
  }
};

// @desc    Create new feature
// @route   POST /api/features
// @access  Admin only
exports.createFeature = async (req, res) => {
  try {
    const {
      title,
      category,
      description,
      longDescription,
      image,
      icon,
      status,
      releaseDate,
      benefits,
      availableIn
    } = req.body;

    // Validation
    const requiredFields = ['title', 'category', 'description', 'longDescription', 'image', 'releaseDate'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    // Check if feature with same title already exists
    const existingFeature = await Feature.findOne({ 
      title: { $regex: new RegExp(title, 'i') } 
    });
    
    if (existingFeature) {
      return res.status(400).json({
        success: false,
        message: 'A feature with this title already exists'
      });
    }

    const feature = new Feature({
      title,
      category,
      description,
      longDescription,
      image,
      icon: icon || '',
      status: status || 'new',
      releaseDate,
      benefits: benefits || [],
      availableIn: availableIn || [],
      createdBy: req.user.id
    });

    await feature.save();
    await feature.populate('createdBy', 'name email');
    
    // Send notification to admins
    try {
      await emailService.sendNewFeatureNotification(feature, req.user);
    } catch (emailError) {
      console.error('Failed to send notification email:', emailError);
    }

    res.status(201).json({
      success: true,
      message: 'Feature created successfully',
      data: feature
    });
  } catch (error) {
    console.error('Error creating feature:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating feature'
    });
  }
};

// @desc    Update feature
// @route   PUT /api/features/:id
// @access  Admin only
exports.updateFeature = async (req, res) => {
  try {
    const feature = await Feature.findById(req.params.id);
    
    if (!feature) {
      return res.status(404).json({
        success: false,
        message: 'Feature not found'
      });
    }

    // Check if title is being changed and if it conflicts with existing feature
    if (req.body.title && req.body.title !== feature.title) {
      const existingFeature = await Feature.findOne({ 
        title: { $regex: new RegExp(req.body.title, 'i') },
        _id: { $ne: req.params.id }
      });
      
      if (existingFeature) {
        return res.status(400).json({
          success: false,
          message: 'A feature with this title already exists'
        });
      }
    }

    const updates = { ...req.body };
    delete updates.createdBy; // Prevent changing creator
    delete updates.views; // Prevent manual view count manipulation
    
    const updatedFeature = await Feature.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email');

    res.json({
      success: true,
      message: 'Feature updated successfully',
      data: updatedFeature
    });
  } catch (error) {
    console.error('Error updating feature:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating feature'
    });
  }
};

// @desc    Delete feature (soft delete)
// @route   DELETE /api/features/:id
// @access  Admin only
exports.deleteFeature = async (req, res) => {
  try {
    const feature = await Feature.findById(req.params.id);
    
    if (!feature) {
      return res.status(404).json({
        success: false,
        message: 'Feature not found'
      });
    }

    // Soft delete by setting isActive to false
    feature.isActive = false;
    await feature.save();

    res.json({
      success: true,
      message: 'Feature deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting feature:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting feature'
    });
  }
};

// @desc    Restore deleted feature
// @route   PATCH /api/features/:id/restore
// @access  Admin only
exports.restoreFeature = async (req, res) => {
  try {
    const feature = await Feature.findById(req.params.id);
    
    if (!feature) {
      return res.status(404).json({
        success: false,
        message: 'Feature not found'
      });
    }

    feature.isActive = true;
    await feature.save();

    res.json({
      success: true,
      message: 'Feature restored successfully',
      data: feature
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error restoring feature'
    });
  }
};

// @desc    Get features by category
// @route   GET /api/features/category/:category
// @access  Public
exports.getFeaturesByCategory = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    const features = await Feature.find({ 
      category: req.params.category,
      isActive: true 
    })
      .populate('createdBy', 'name email')
      .sort({ releaseDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Feature.countDocuments({ 
      category: req.params.category,
      isActive: true 
    });
    
    res.json({
      success: true,
      data: features,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching features by category'
    });
  }
};

// @desc    Get featured/popular features
// @route   GET /api/features/featured/popular
// @access  Public
exports.getPopularFeatures = async (req, res) => {
  try {
    const { limit = 5 } = req.query;
    
    const features = await Feature.find({ 
      isActive: true,
      status: 'popular'
    })
      .populate('createdBy', 'name email')
      .sort({ views: -1, releaseDate: -1 })
      .limit(parseInt(limit));
    
    res.json({
      success: true,
      data: features
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching popular features'
    });
  }
};

// @desc    Get upcoming features
// @route   GET /api/features/upcoming
// @access  Public
exports.getUpcomingFeatures = async (req, res) => {
  try {
    const features = await Feature.find({ 
      isActive: true,
      status: 'upcoming',
      releaseDate: { $gt: new Date() }
    })
      .populate('createdBy', 'name email')
      .sort({ releaseDate: 1 });
    
    res.json({
      success: true,
      data: features
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching upcoming features'
    });
  }
};

// ================= STATISTICS FUNCTIONS =================

// @desc    Get feature statistics
// @route   GET /api/features/stats/overview
// @access  Admin only
exports.getFeatureStatistics = async (req, res) => {
  try {
    const totalFeatures = await Feature.countDocuments();
    const activeFeatures = await Feature.countDocuments({ isActive: true });
    const totalViews = await Feature.aggregate([
      { $group: { _id: null, totalViews: { $sum: '$views' } } }
    ]);
    
    const featuresByCategory = await Feature.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);
    
    const featuresByStatus = await Feature.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    const monthlyStats = await Feature.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 },
          totalViews: { $sum: '$views' }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 }
    ]);

    res.json({
      success: true,
      data: {
        totalFeatures,
        activeFeatures,
        inactiveFeatures: totalFeatures - activeFeatures,
        totalViews: totalViews[0]?.totalViews || 0,
        byCategory: featuresByCategory,
        byStatus: featuresByStatus,
        monthlyStats
      }
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching statistics'
    });
  }
};

// @desc    Get admin dashboard statistics
// @route   GET /api/features/stats/dashboard
// @access  Admin only
exports.getDashboardStats = async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      totalFeatures,
      activeFeatures,
      recentFeatures,
      popularFeatures,
      categoryStats,
      viewsThisMonth
    ] = await Promise.all([
      Feature.countDocuments(),
      Feature.countDocuments({ isActive: true }),
      Feature.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      Feature.find({ isActive: true }).sort({ views: -1 }).limit(5),
      Feature.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } }
      ]),
      Feature.aggregate([
        { $match: { updatedAt: { $gte: thirtyDaysAgo } } },
        { $group: { _id: null, totalViews: { $sum: '$views' } } }
      ])
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          total: totalFeatures,
          active: activeFeatures,
          recent: recentFeatures,
          viewsThisMonth: viewsThisMonth[0]?.totalViews || 0
        },
        popularFeatures,
        categoryDistribution: categoryStats
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard statistics'
    });
  }
};

// @desc    Get features with pagination for admin
// @route   GET /api/features/admin/all
// @access  Admin only
exports.getAdminFeatures = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, category, status } = req.query;
    
    const filter = {};
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    if (category) filter.category = category;
    if (status) filter.status = status;
    
    const features = await Feature.find(filter)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Feature.countDocuments(filter);
    
    res.json({
      success: true,
      data: features,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching features for admin'
    });
  }
};