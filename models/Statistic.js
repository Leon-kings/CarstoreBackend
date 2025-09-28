const mongoose = require('mongoose');

const statisticSchema = new mongoose.Schema({
  totalCars: {
    type: Number,
    default: 0
  },
  totalValue: {
    type: Number,
    default: 0
  },
  averagePrice: {
    type: Number,
    default: 0
  },
  carsByStatus: {
    active: { type: Number, default: 0 },
    sold: { type: Number, default: 0 },
    pending: { type: Number, default: 0 }
  },
  priceRange: {
    under50k: { type: Number, default: 0 },
    under100k: { type: Number, default: 0 },
    under200k: { type: Number, default: 0 },
    over200k: { type: Number, default: 0 }
  },
  topViewedCars: [{
    carId: { type: mongoose.Schema.Types.ObjectId, ref: 'Car' },
    name: String,
    views: Number
  }],
  monthlyData: [{
    month: String,
    carsAdded: Number,
    carsSold: Number,
    revenue: Number
  }],
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Statistic', statisticSchema);