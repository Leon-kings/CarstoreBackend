const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  stripePaymentIntentId: {
    type: String,
    required: true,
    unique: true
  },
  stripeCustomerId: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: [true, 'Payment amount is required'],
    min: [0.5, 'Amount must be at least 0.50'] // Stripe minimum
  },
  currency: {
    type: String,
    default: 'usd'
  },
  status: {
    type: String,
    enum: ['requires_payment_method', 'requires_confirmation', 'processing', 'requires_action', 'canceled', 'succeeded', 'failed', 'refunded'],
    default: 'requires_payment_method'
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'bank_transfer', 'paypal'],
    default: 'card'
  },
  paymentMethodDetails: {
    type: {
      type: String,
      enum: ['card', 'bank_transfer', 'paypal']
    },
    card: {
      brand: String,
      last4: String,
      exp_month: Number,
      exp_year: Number,
      country: String
    }
  },
  description: String,
  metadata: mongoose.Schema.Types.Mixed,
  refunded: {
    type: Boolean,
    default: false
  },
  refundAmount: {
    type: Number,
    default: 0
  },
  stripeRefundId: String,
  paymentDate: {
    type: Date,
    default: Date.now
  },
  receiptUrl: String
}, {
  timestamps: true
});

// Index for better query performance
paymentSchema.index({ customer: 1, paymentDate: -1 });
paymentSchema.index({ stripePaymentIntentId: 1 });
paymentSchema.index({ status: 1 });

// Static method for payment statistics
paymentSchema.statics.getPaymentStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalPayments: { $sum: 1 },
        totalRevenue: { $sum: '$amount' },
        avgPayment: { $avg: '$amount' },
        successfulPayments: { 
          $sum: { $cond: [{ $eq: ['$status', 'succeeded'] }, 1, 0] } 
        },
        failedPayments: { 
          $sum: { $cond: [{ $in: ['$status', ['failed', 'canceled']] }, 1, 0] } 
        },
        refundedAmount: { $sum: '$refundAmount' }
      }
    }
  ]);
  
  return stats.length > 0 ? stats[0] : {
    totalPayments: 0,
    totalRevenue: 0,
    avgPayment: 0,
    successfulPayments: 0,
    failedPayments: 0,
    refundedAmount: 0
  };
};

// Static method for monthly revenue
paymentSchema.statics.getMonthlyRevenue = async function() {
  return await this.aggregate([
    {
      $match: {
        status: 'succeeded',
        paymentDate: { $gte: new Date(new Date().getFullYear(), 0, 1) }
      }
    },
    {
      $group: {
        _id: { $month: '$paymentDate' },
        revenue: { $sum: '$amount' },
        paymentCount: { $sum: 1 },
        avgPayment: { $avg: '$amount' }
      }
    },
    {
      $sort: { '_id': 1 }
    }
  ]);
};

module.exports = mongoose.model('Payment', paymentSchema);