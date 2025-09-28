const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Customer name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true
  },
  address: {
    type: String, // Changed from object to string to match frontend
    required: [true, 'Address is required'],
    trim: true
  },
  paymentMethod: {
    cardNumber: {
      type: String,
      trim: true
    },
    expiry: {
      type: String,
      trim: true
    },
    cvv: {
      type: String,
      trim: true
    },
    nameOnCard: {
      type: String,
      trim: true
    }
  },
  stripeCustomerId: {
    type: String,
    unique: true,
    sparse: true
  },
  totalPayments: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    default: 0
  },
  currency: {
    type: String,
    default: 'usd'
  },
  lastPaymentDate: Date,
  customerSince: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'premium', 'suspended'],
    default: 'active'
  },
  paymentType: {
    type: String,
    enum: ['card', 'bank_transfer', 'paypal', null],
    default: 'card'
  },
  subscription: {
    stripeSubscriptionId: String,
    status: {
      type: String,
      enum: ['active', 'canceled', 'incomplete', 'past_due', 'unpaid', null],
      default: null
    },
    currentPeriodStart: Date,
    currentPeriodEnd: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for payments
customerSchema.virtual('payments', {
  ref: 'Payment',
  localField: '_id',
  foreignField: 'customer'
});

// Update customer stats when payments are made
customerSchema.methods.updatePaymentStats = async function() {
  const payments = await mongoose.model('Payment').find({ 
    customer: this._id, 
    status: 'completed' 
  });
  
  this.totalPayments = payments.length;
  this.totalAmount = payments.reduce((sum, payment) => sum + payment.amount, 0);
  this.lastPaymentDate = payments.length > 0 ? 
    new Date(Math.max(...payments.map(p => p.paymentDate))) : null;
  await this.save();
};

// Static method for customer statistics
customerSchema.statics.getCustomerStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalCustomers: { $sum: 1 },
        activeCustomers: { 
          $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } 
        },
        premiumCustomers: { 
          $sum: { $cond: [{ $eq: ['$status', 'premium'] }, 1, 0] } 
        },
        totalRevenue: { $sum: '$totalAmount' },
        avgCustomerValue: { $avg: '$totalAmount' }
      }
    }
  ]);
  
  return stats.length > 0 ? stats[0] : {
    totalCustomers: 0,
    activeCustomers: 0,
    premiumCustomers: 0,
    totalRevenue: 0,
    avgCustomerValue: 0
  };
};

// Method to check if customer has valid payment method
customerSchema.methods.hasValidPaymentMethod = async function() {
  if (!this.stripeCustomerId) return false;
  
  try {
    const stripeService = require('../stripes/stripeService');
    const paymentMethods = await stripeService.getCustomerPaymentMethods(this.stripeCustomerId);
    return paymentMethods.data.length > 0;
  } catch (error) {
    return false;
  }
};

module.exports = mongoose.model('Customer', customerSchema);