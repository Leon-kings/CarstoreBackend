const mongoose = require('mongoose');

const carSchema = new mongoose.Schema({
  modelId: {
    type: String,
    unique: true,
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  brand: {
    type: String,
    required: true,
    trim: true
  },
  year: {
    type: Number,
    required: true,
    min: 1900,
    max: new Date().getFullYear() + 1
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  color: {
    type: String,
    required: true
  },
  fuelType: {
    type: String,
    enum: ['petrol', 'diesel', 'electric', 'hybrid'],
    required: true
  },
  transmission: {
    type: String,
    enum: ['manual', 'automatic'],
    required: true
  },
  mileage: {
    type: Number,
    min: 0
  },
  features: [String],
  imageUrl: {
    type: String
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  location: {
    city: String,
    state: String,
    country: {
      type: String,
      default: 'USA'
    }
  },
  postedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  contactEmail: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better performance
carSchema.index({ brand: 1, name: 1 });
carSchema.index({ price: 1 });
carSchema.index({ year: -1 });
carSchema.index({ fuelType: 1 });
carSchema.index({ createdAt: -1 });
carSchema.index({ 'location.city': 1 });
carSchema.index({ postedBy: 1 });

// Static method for getting statistics
carSchema.statics.getStatistics = async function(filters = {}) {
  const matchStage = {};
  
  // Apply filters if provided
  if (filters.year) matchStage.year = parseInt(filters.year);
  if (filters.brand) matchStage.brand = new RegExp(filters.brand, 'i');
  if (filters.fuelType) matchStage.fuelType = filters.fuelType;
  if (filters.startDate || filters.endDate) {
    matchStage.createdAt = {};
    if (filters.startDate) matchStage.createdAt.$gte = new Date(filters.startDate);
    if (filters.endDate) matchStage.createdAt.$lte = new Date(filters.endDate);
  }

  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalCars: { $sum: 1 },
        avgPrice: { $avg: '$price' },
        minPrice: { $min: '$price' },
        maxPrice: { $max: '$price' },
        avgMileage: { $avg: '$mileage' },
        totalValue: { $sum: '$price' },
        availableCars: {
          $sum: { $cond: ['$isAvailable', 1, 0] }
        },
        byBrand: { $push: '$brand' },
        byFuelType: { $push: '$fuelType' },
        byYear: { $push: '$year' },
        byTransmission: { $push: '$transmission' }
      }
    }
  ]);

  // Get brand distribution
  const brandStats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$brand',
        count: { $sum: 1 },
        avgPrice: { $avg: '$price' },
        minPrice: { $min: '$price' },
        maxPrice: { $max: '$price' }
      }
    },
    { $sort: { count: -1 } }
  ]);

  // Get fuel type distribution
  const fuelStats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$fuelType',
        count: { $sum: 1 },
        avgPrice: { $avg: '$price' },
        avgMileage: { $avg: '$mileage' }
      }
    }
  ]);

  // Get yearly distribution
  const yearStats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$year',
        count: { $sum: 1 },
        avgPrice: { $avg: '$price' }
      }
    },
    { $sort: { _id: -1 } }
  ]);

  // Get monthly growth (last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const monthlyStats = await this.aggregate([
    {
      $match: {
        createdAt: { $gte: sixMonthsAgo },
        ...matchStage
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        },
        count: { $sum: 1 },
        totalValue: { $sum: '$price' }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } }
  ]);

  return {
    overview: stats[0] || {
      totalCars: 0,
      avgPrice: 0,
      minPrice: 0,
      maxPrice: 0,
      avgMileage: 0,
      totalValue: 0,
      availableCars: 0
    },
    brandDistribution: brandStats,
    fuelTypeDistribution: fuelStats,
    yearDistribution: yearStats,
    monthlyGrowth: monthlyStats,
    filtersApplied: Object.keys(filters).length > 0
  };
};

// Method for price analysis
carSchema.statics.getPriceAnalysis = async function() {
  return await this.aggregate([
    {
      $bucket: {
        groupBy: '$price',
        boundaries: [0, 10000, 20000, 30000, 50000, 75000, 100000, 150000],
        default: 'Above 150000',
        output: {
          count: { $sum: 1 },
          cars: { $push: { name: '$name', brand: '$brand', price: '$price' } }
        }
      }
    }
  ]);
};

// Method for location-based statistics
carSchema.statics.getLocationStats = async function() {
  return await this.aggregate([
    {
      $group: {
        _id: {
          city: '$location.city',
          state: '$location.state'
        },
        count: { $sum: 1 },
        avgPrice: { $avg: '$price' },
        brands: { $addToSet: '$brand' }
      }
    },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);
};

// Method to get user posting statistics
carSchema.statics.getUserPostingStats = async function() {
  return await this.aggregate([
    {
      $group: {
        _id: '$postedBy',
        totalPosts: { $sum: 1 },
        totalValue: { $sum: '$price' },
        avgPrice: { $avg: '$price' },
        availablePosts: { $sum: { $cond: ['$isAvailable', 1, 0] } },
        brands: { $addToSet: '$brand' }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'userInfo'
      }
    },
    {
      $unwind: '$userInfo'
    },
    {
      $project: {
        userName: '$userInfo.name',
        userEmail: '$userInfo.email',
        totalPosts: 1,
        totalValue: 1,
        avgPrice: 1,
        availablePosts: 1,
        brands: 1
      }
    },
    { $sort: { totalPosts: -1 } }
  ]);
};

module.exports = mongoose.model('Car', carSchema);