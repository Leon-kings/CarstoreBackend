const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  status: {
    type: String,
    enum: ['active', 'unsubscribed', 'bounced'],
    default: 'active'
  },

  subscribedAt: {
    type: Date,
    default: Date.now
  },
  unsubscribedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Index for better query performance
subscriptionSchema.index({ email: 1 });
subscriptionSchema.index({ status: 1 });
subscriptionSchema.index({ subscribedAt: -1 });

// Static method to get statistics
subscriptionSchema.statics.getStatistics = async function() {
  try {
    const total = await this.countDocuments();
    const active = await this.countDocuments({ status: 'active' });
    const unsubscribed = await this.countDocuments({ status: 'unsubscribed' });
    const bounced = await this.countDocuments({ status: 'bounced' });
    
    // Get subscriptions by source
    const bySource = await this.aggregate([
      {
        $group: {
          _id: '$source',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    // Get recent subscriptions (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentSubscriptions = await this.countDocuments({
      subscribedAt: { $gte: thirtyDaysAgo }
    });

    // Get monthly growth
    const currentMonth = new Date();
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    const currentMonthSubs = await this.countDocuments({
      subscribedAt: {
        $gte: new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1),
        $lt: new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
      }
    });

    const lastMonthSubs = await this.countDocuments({
      subscribedAt: {
        $gte: new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1),
        $lt: new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 1)
      }
    });

    const growthRate = lastMonthSubs > 0 
      ? ((currentMonthSubs - lastMonthSubs) / lastMonthSubs * 100).toFixed(2)
      : 0;

    return {
      total,
      active,
      unsubscribed,
      bounced,
      bySource,
      recentSubscriptions,
      monthlyGrowth: {
        currentMonth: currentMonthSubs,
        lastMonth: lastMonthSubs,
        growthRate: parseFloat(growthRate)
      }
    };
  } catch (error) {
    throw new Error(`Failed to get statistics: ${error.message}`);
  }
};

// Static method to get subscriptions by date range
subscriptionSchema.statics.getSubscriptionsByDateRange = async function(startDate, endDate) {
  try {
    return await this.find({
      subscribedAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    }).sort({ subscribedAt: -1 });
  } catch (error) {
    throw new Error(`Failed to get subscriptions by date range: ${error.message}`);
  }
};

// Instance method to unsubscribe
subscriptionSchema.methods.unsubscribe = function() {
  this.status = 'unsubscribed';
  this.unsubscribedAt = new Date();
  return this.save();
};

// Instance method to resubscribe
subscriptionSchema.methods.resubscribe = function() {
  this.status = 'active';
  this.unsubscribedAt = null;
  return this.save();
};

const Subscription = mongoose.model('Subscription', subscriptionSchema);

module.exports = Subscription;