const User = require('../models/user');

// Helper function to get comprehensive user statistics
async function getUserStatistics() {
  const totalUsers = await User.countDocuments();
  const activeUsers = await User.countDocuments({ isActive: true });
  const inactiveUsers = await User.countDocuments({ isActive: false });
  
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const todayRegistrations = await User.countDocuments({
    createdAt: { $gte: todayStart, $lte: todayEnd }
  });

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const thisWeekRegistrations = await User.countDocuments({
    createdAt: { $gte: weekStart }
  });

  const lastWeekStart = new Date(weekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekEnd = new Date(weekStart);
  lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);
  lastWeekEnd.setHours(23, 59, 59, 999);
  
  const lastWeekRegistrations = await User.countDocuments({
    createdAt: { $gte: lastWeekStart, $lte: lastWeekEnd }
  });

  const growthRate = lastWeekRegistrations > 0 ? 
    ((thisWeekRegistrations - lastWeekRegistrations) / lastWeekRegistrations * 100).toFixed(2) : 
    thisWeekRegistrations > 0 ? 100 : 0;

  const statusStats = await User.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        active: { $sum: { $cond: ['$isActive', 1, 0] } }
      }
    },
    { $sort: { count: -1 } }
  ]);

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const monthlyTrend = await User.aggregate([
    {
      $match: { createdAt: { $gte: sixMonthsAgo } }
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
    { $limit: 6 }
  ]);

  return {
    overview: {
      totalUsers,
      activeUsers,
      inactiveUsers,
      activationRate: totalUsers > 0 ? ((activeUsers / totalUsers) * 100).toFixed(2) : 0
    },
    recentActivity: {
      todayRegistrations,
      thisWeekRegistrations,
      lastWeekRegistrations,
      growthRate: parseFloat(growthRate)
    },
    distribution: {
      statusDistribution: statusStats,
      monthlyTrend: monthlyTrend.map(month => ({
        period: `${month._id.year}-${month._id.month.toString().padStart(2, '0')}`,
        registrations: month.count
      }))
    },
    lastUpdated: new Date()
  };
}

// Helper function to get registration statistics
async function getRegistrationStats(startDate, endDate, groupBy) {
  let groupFormat;
  switch (groupBy) {
    case 'month': groupFormat = '%Y-%m'; break;
    case 'week': groupFormat = '%Y-%U'; break;
    default: groupFormat = '%Y-%m-%d';
  }

  return await User.aggregate([
    {
      $match: { createdAt: { $gte: startDate, $lte: endDate } }
    },
    {
      $group: {
        _id: { $dateToString: { format: groupFormat, date: '$createdAt' } },
        count: { $sum: 1 },
        activeUsers: { $sum: { $cond: ['$isActive', 1, 0] } }
      }
    },
    { $sort: { _id: 1 } }
  ]);
}

// Helper function to convert users data to CSV
function convertToCSV(users) {
  const headers = ['ID', 'Name', 'Email', 'status', 'Status', 'Created At', 'Last Login'];
  let csv = headers.join(',') + '\n';
  
  users.forEach(user => {
    const row = [
      user._id,
      `"${user.name || ''}"`,
      user.email,
      user.status,
      user.isActive ? 'Active' : 'Inactive',
      user.createdAt.toISOString(),
      user.lastLogin ? user.lastLogin.toISOString() : 'Never'
    ];
    csv += row.join(',') + '\n';
  });
  
  return csv;
}

// CREATE - Register new user
exports.registerUser = async (req, res) => {
  try {
    const { name, email, password, phone, status } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    // Create new user
    const user = new User({
      name,
      email,
      phone,
      password,
      status: status || 'user'
    });

    await user.save();

    res.status(201).json({
      message: 'User registered successfully',
      user: user.toJSON()
    });
  } catch (error) {
    console.error('Register user error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ message: 'Validation error', errors });
    }
    
    res.status(500).json({ message: 'Server error during registration' });
  }
};

// READ - Get all users with pagination (Admin only)
exports.getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = -1, stats = 'true' } = req.query;
    
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit))); // Limit max 50 per page
    const skip = (pageNum - 1) * limitNum;

    // Build sort object
    const sortOptions = {};
    const allowedSortFields = ['name', 'email', 'status', 'createdAt', 'lastLogin'];
    sortOptions[allowedSortFields.includes(sortBy) ? sortBy : 'createdAt'] = parseInt(sortOrder) === 1 ? 1 : -1;

    const users = await User.find()
      .select('-password')
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum);

    const totalUsers = await User.countDocuments();
    const totalPages = Math.ceil(totalUsers / limitNum);

    const response = { 
      success: true,
      users, 
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalUsers,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
        limit: limitNum
      }
    };

    if (stats === 'true') {
      response.statistics = await getUserStatistics();
    }

    res.json(response);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error while fetching users' });
  }
};


// Login controller
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Always include password explicitly
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Compare passwords
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Update login stats
    await user.updateLoginStats();

    res.json({
      success: true,
      message: "Login successful",
      user: user.toJSON(), // excludes password
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during login",
    });
  }
};



// READ - Get all users without pagination (Admin only)
exports.getAllUsersWithoutPagination = async (req, res) => {
  try {
    const { sortBy = 'createdAt', sortOrder = -1, includeInactive = 'true', stats = 'false' } = req.query;
    
    const queryConditions = {};
    if (includeInactive === 'false') {
      queryConditions.isActive = true;
    }

    const sortOptions = {};
    const allowedSortFields = ['name', 'email', 'status', 'createdAt', 'lastLogin'];
    sortOptions[allowedSortFields.includes(sortBy) ? sortBy : 'createdAt'] = parseInt(sortOrder) === 1 ? 1 : -1;

    const users = await User.find(queryConditions)
      .select('-password')
      .sort(sortOptions);

    const response = { 
      success: true,
      users,
      metadata: {
        totalUsers: users.length,
        activeUsers: users.filter(user => user.isActive).length,
        inactiveUsers: users.filter(user => !user.isActive).length,
        timestamp: new Date()
      }
    };

    if (stats === 'true') {
      response.statistics = await getUserStatistics();
    }

    res.json(response);
  } catch (error) {
    console.error('Get all users without pagination error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// READ - Get user by ID
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ 
      success: true,
      user 
    });
  } catch (error) {
    console.error('Get user error:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }
    
    res.status(500).json({ message: 'Server error while fetching user' });
  }
};

// READ - Get current user profile
exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ 
      success: true,
      user 
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ message: 'Server error while fetching profile' });
  }
};

// UPDATE - Update user (Admin only)
exports.updateUser = async (req, res) => {
  try {
    const { name, email, phone, isActive, status } = req.body;
    const userId = req.params.id;

    if (email) {
      const existingUser = await User.findOne({ 
        email, 
        _id: { $ne: userId } 
      });
      
      if (existingUser) {
        return res.status(400).json({ message: 'Email already exists' });
      }
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (phone) updateData.phone = phone;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (status) updateData.status = status;

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ 
      success: true,
      message: 'User updated successfully', 
      user 
    });
  } catch (error) {
    console.error('Update user error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ message: 'Validation error', errors });
    }
    
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }
    
    res.status(500).json({ message: 'Server error while updating user' });
  }
};

// UPDATE - Update user profile (Own profile)
exports.updateProfile = async (req, res) => {
  try {
    const { name, email } = req.body;
    const userId = req.user.id;

    if (email) {
      const existingUser = await User.findOne({ 
        email, 
        _id: { $ne: userId } 
      });
      
      if (existingUser) {
        return res.status(400).json({ message: 'Email already exists' });
      }
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({ 
      success: true,
      message: 'Profile updated successfully', 
      user 
    });
  } catch (error) {
    console.error('Update profile error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ message: 'Validation error', errors });
    }
    
    res.status(500).json({ message: 'Server error while updating profile' });
  }
};

// UPDATE - Update user status (Admin only)
exports.updateUserStatus = async (req, res) => {
  try {
    const { isActive } = req.body;
    const userId = req.params.id;

    const user = await User.findByIdAndUpdate(
      userId,
      { isActive },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const status = isActive ? 'activated' : 'deactivated';
    res.json({ 
      success: true,
      message: `User ${status} successfully`, 
      user 
    });
  } catch (error) {
    console.error('Update status error:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }
    
    res.status(500).json({ message: 'Server error while updating status' });
  }
};

// DELETE - Delete user (Admin only)
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ 
      success: true,
      message: 'User deleted successfully' 
    });
  } catch (error) {
    console.error('Delete user error:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }
    
    res.status(500).json({ message: 'Server error while deleting user' });
  }
};

// SEARCH - Search users by name or email
exports.searchUsers = async (req, res) => {
  try {
    const { query, limit = 10 } = req.query;
    
    if (!query || query.trim().length < 2) {
      return res.status(400).json({ 
        message: 'Search query is required and must be at least 2 characters long' 
      });
    }

    const searchCondition = {
      $or: [
        { name: { $regex: query.trim(), $options: 'i' } },
        { email: { $regex: query.trim(), $options: 'i' } }
      ],
      ...(req.user.status !== 'admin' ? { isActive: true } : {})
    };

    const users = await User.find(searchCondition)
      .select('-password')
      .limit(Math.min(50, parseInt(limit)));

    const response = { 
      success: true,
      users 
    };
    
    if (req.user.status === 'admin') {
      response.searchStats = {
        query: query.trim(),
        totalResults: users.length,
        timestamp: new Date()
      };
    }

    res.json(response);
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ message: 'Server error while searching users' });
  }
};

// STATISTICS - Get user statistics (Admin only)
exports.getUserStatistics = async (req, res) => {
  try {
    const stats = await getUserStatistics();
    res.json({ 
      success: true,
      statistics: stats 
    });
  } catch (error) {
    console.error('Get statistics error:', error);
    res.status(500).json({ message: 'Server error while fetching statistics' });
  }
};

// DASHBOARD - Get user dashboard statistics
exports.getUserDashboardStats = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const now = new Date();
    const accountAgeDays = Math.floor((now - user.createdAt) / (1000 * 60 * 60 * 24));

    const userStats = {
      account: {
        ageDays: accountAgeDays,
        memberSince: user.createdAt,
        status: user.isActive ? 'Active' : 'Inactive',
        status: user.status
      },
      activity: {
        lastLogin: user.lastLogin || 'Never',
        isActive: user.isActive
      }
    };
    
    res.json({ 
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        status: user.status,
        isActive: user.isActive,
        createdAt: user.createdAt
      },
      statistics: userStats
    });
  } catch (error) {
    console.error('Get user dashboard stats error:', error);
    res.status(500).json({ message: 'Server error while fetching dashboard stats' });
  }
};

// READ - Get users by registration date range (Admin only)
exports.getUsersByDateRange = async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'Start date and end date are required' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const maxRange = 365 * 24 * 60 * 60 * 1000;
    if (end - start > maxRange) {
      return res.status(400).json({ message: 'Date range cannot exceed 1 year' });
    }

    const users = await User.find({
      createdAt: { $gte: start, $lte: end }
    }).select('-password').sort({ createdAt: -1 });

    const registrationStats = await getRegistrationStats(start, end, groupBy);

    res.json({
      success: true,
      users,
      dateRange: { startDate: start, endDate: end },
      statistics: {
        totalUsersInRange: users.length,
        registrationStats,
        averageRegistrationsPerDay: registrationStats.length > 0 ? 
          (users.length / Math.max(1, (end - start) / (1000 * 60 * 60 * 24))).toFixed(2) : 0
      }
    });
  } catch (error) {
    console.error('Get users by date range error:', error);
    res.status(500).json({ message: 'Server error while fetching users by date range' });
  }
};

// EXPORT - Export users data (Admin only)
exports.exportUsers = async (req, res) => {
  try {
    const { format = 'json', includeInactive = 'true' } = req.query;
    
    const queryConditions = {};
    if (includeInactive === 'false') {
      queryConditions.isActive = true;
    }

    const users = await User.find(queryConditions)
      .select('-password')
      .sort({ createdAt: -1 });

    if (format === 'csv') {
      const csvData = convertToCSV(users);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=users-export-${Date.now()}.csv`);
      return res.send(csvData);
    } else {
      res.json({
        success: true,
        exportedAt: new Date(),
        totalUsers: users.length,
        data: users
      });
    }
  } catch (error) {
    console.error('Export users error:', error);
    res.status(500).json({ message: 'Server error while exporting users' });
  }
};