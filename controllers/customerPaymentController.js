const Customer = require('../models/Customer');
const Payment = require('../models/Payment');
const stripeService = require('../stripes/stripeService');
const emailService = require('../mails/sendEmail');

const customerPaymentController = {
  // Create customer with Stripe integration
  async createCustomer(req, res) {
    try {
      const { name, email, phone, address } = req.body;

      // Check if customer already exists
      const existingCustomer = await Customer.findOne({ email });
      if (existingCustomer) {
        return res.status(400).json({
          success: false,
          message: 'Customer with this email already exists'
        });
      }

      // Create customer in MongoDB
      const customer = new Customer({
        name,
        email,
        phone,
        address
      });

      await customer.save();

      // Create customer in Stripe
      const stripeCustomer = await stripeService.createStripeCustomer(customer);
      customer.stripeCustomerId = stripeCustomer.id;
      await customer.save();

      // Send welcome email
      try {
        await emailService.sendCustomerWelcome(customer, stripeCustomer.id);
      } catch (emailError) {
        console.error('Email sending failed:', emailError);
      }

      res.status(201).json({
        success: true,
        message: 'Customer created successfully',
        data: {
          customer,
          stripeCustomerId: stripeCustomer.id
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error creating customer',
        error: error.message
      });
    }
  },

  // Get all customers with pagination
  async getAllCustomers(req, res) {
    try {
      const { page = 1, limit = 10, search = '', sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

      const query = {};
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } }
        ];
      }

      const customers = await Customer.find(query)
        .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .populate('payments');

      const total = await Customer.countDocuments(query);

      res.json({
        success: true,
        data: {
          customers,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            totalCustomers: total,
            hasNextPage: page < Math.ceil(total / limit),
            hasPrevPage: page > 1
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching customers',
        error: error.message
      });
    }
  },

  // Get customer by ID
  async getCustomerById(req, res) {
    try {
      const customer = await Customer.findById(req.params.id).populate('payments');
      
      if (!customer) {
        return res.status(404).json({
          success: false,
          message: 'Customer not found'
        });
      }

      res.json({
        success: true,
        data: customer
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching customer',
        error: error.message
      });
    }
  },

  // Update customer
  async updateCustomer(req, res) {
    try {
      const { name, phone, address, status } = req.body;

      const customer = await Customer.findByIdAndUpdate(
        req.params.id,
        { name, phone, address, status, updatedAt: new Date() },
        { new: true, runValidators: true }
      );

      if (!customer) {
        return res.status(404).json({
          success: false,
          message: 'Customer not found'
        });
      }

      // Update Stripe customer if exists
      if (customer.stripeCustomerId) {
        try {
          await stripeService.updateStripeCustomer(customer.stripeCustomerId, {
            name: customer.name,
            phone: customer.phone,
            metadata: { updated_at: new Date().toISOString() }
          });
        } catch (stripeError) {
          console.error('Error updating Stripe customer:', stripeError);
        }
      }

      res.json({
        success: true,
        message: 'Customer updated successfully',
        data: customer
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error updating customer',
        error: error.message
      });
    }
  },

  // Delete customer
  async deleteCustomer(req, res) {
    try {
      const customer = await Customer.findById(req.params.id);
      
      if (!customer) {
        return res.status(404).json({
          success: false,
          message: 'Customer not found'
        });
      }

      // Delete from Stripe if exists
      if (customer.stripeCustomerId) {
        try {
          await stripeService.deleteStripeCustomer(customer.stripeCustomerId);
        } catch (stripeError) {
          console.error('Error deleting Stripe customer:', stripeError);
        }
      }

      // Delete associated payments
      await Payment.deleteMany({ customer: customer._id });

      await Customer.findByIdAndDelete(req.params.id);

      res.json({
        success: true,
        message: 'Customer deleted successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error deleting customer',
        error: error.message
      });
    }
  },

  // Create payment intent
  async createPaymentIntent(req, res) {
    try {
      const { customerId, amount, currency = 'usd', description, metadata = {} } = req.body;

      // Validate amount
      if (amount < 0.5) {
        return res.status(400).json({
          success: false,
          message: 'Amount must be at least 0.50'
        });
      }

      const customer = await Customer.findById(customerId);
      if (!customer) {
        return res.status(404).json({
          success: false,
          message: 'Customer not found'
        });
      }

      if (!customer.stripeCustomerId) {
        // Create Stripe customer if not exists
        const stripeCustomer = await stripeService.createStripeCustomer(customer);
        customer.stripeCustomerId = stripeCustomer.id;
        await customer.save();
      }

      const paymentIntent = await stripeService.createPaymentIntent(
        amount,
        currency,
        customer.stripeCustomerId,
        {
          ...metadata,
          mongodb_customer_id: customerId,
          description: description || 'Payment for services'
        }
      );

      res.json({
        success: true,
        data: {
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id,
          amount: paymentIntent.amount / 100,
          currency: paymentIntent.currency,
          status: paymentIntent.status
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error creating payment intent',
        error: error.message
      });
    }
  },

  // Confirm and process payment
  async confirmPayment(req, res) {
    try {
      const { paymentIntentId, paymentMethodId } = req.body;

      const paymentIntent = await stripeService.confirmPaymentIntent(paymentIntentId, paymentMethodId);

      if (paymentIntent.status === 'succeeded') {
        const customer = await Customer.findOne({ stripeCustomerId: paymentIntent.customer });
        if (customer) {
          const payment = new Payment({
            customer: customer._id,
            stripePaymentIntentId: paymentIntent.id,
            stripeCustomerId: paymentIntent.customer,
            amount: paymentIntent.amount / 100,
            currency: paymentIntent.currency,
            status: paymentIntent.status,
            paymentMethod: 'card',
            paymentMethodDetails: paymentIntent.payment_method_details,
            description: paymentIntent.description,
            metadata: paymentIntent.metadata,
            receiptUrl: paymentIntent.charges.data[0]?.receipt_url,
            paymentDate: new Date()
          });

          await payment.save();
          await customer.updatePaymentStats();

          try {
            await emailService.sendPaymentConfirmation(payment, customer);
          } catch (emailError) {
            console.error('Email sending failed:', emailError);
          }

          return res.json({
            success: true,
            message: 'Payment confirmed successfully',
            data: {
              payment,
              customer: {
                id: customer._id,
                name: customer.name,
                email: customer.email,
                totalPayments: customer.totalPayments,
                totalAmount: customer.totalAmount
              }
            }
          });
        }
      }

      res.json({
        success: true,
        message: 'Payment processing',
        data: { paymentIntent }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error confirming payment',
        error: error.message
      });
    }
  },

  // Get all payments with pagination
  async getAllPayments(req, res) {
    try {
      const { page = 1, limit = 10, customerId, status, sortBy = 'paymentDate', sortOrder = 'desc' } = req.query;

      const query = {};
      if (customerId) query.customer = customerId;
      if (status) query.status = status;

      const payments = await Payment.find(query)
        .populate('customer')
        .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await Payment.countDocuments(query);

      res.json({
        success: true,
        data: {
          payments,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            totalPayments: total,
            hasNextPage: page < Math.ceil(total / limit),
            hasPrevPage: page > 1
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching payments',
        error: error.message
      });
    }
  },

  // Get payment by ID
  async getPaymentById(req, res) {
    try {
      const payment = await Payment.findById(req.params.id).populate('customer');
      
      if (!payment) {
        return res.status(404).json({
          success: false,
          message: 'Payment not found'
        });
      }

      res.json({
        success: true,
        data: payment
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching payment',
        error: error.message
      });
    }
  },

  // Handle Stripe webhooks
  async handleWebhook(req, res) {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = await stripeService.handleWebhookEvent(req.body, sig);
    } catch (error) {
      return res.status(400).send(`Webhook Error: ${error.message}`);
    }

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object);
        break;
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object);
        break;
      case 'payment_intent.canceled':
        await handlePaymentIntentCanceled(event.data.object);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  },

  // Get customer dashboard with payments
  async getCustomerDashboard(req, res) {
    try {
      const customer = await Customer.findById(req.params.id)
        .populate({
          path: 'payments',
          options: { sort: { paymentDate: -1 }, limit: 10 }
        });

      if (!customer) {
        return res.status(404).json({
          success: false,
          message: 'Customer not found'
        });
      }

      let stripeData = {};
      if (customer.stripeCustomerId) {
        try {
          const stripeCustomer = await stripeService.getStripeCustomer(customer.stripeCustomerId);
          const paymentMethods = await stripeService.getCustomerPaymentMethods(customer.stripeCustomerId);
          
          stripeData = {
            stripeCustomer,
            paymentMethods: paymentMethods.data
          };
        } catch (stripeError) {
          console.error('Error fetching Stripe data:', stripeError);
        }
      }

      const paymentStats = await Payment.aggregate([
        { $match: { customer: customer._id, status: 'succeeded' } },
        { 
          $group: {
            _id: null,
            totalSpent: { $sum: '$amount' },
            averagePayment: { $avg: '$amount' },
            paymentCount: { $sum: 1 },
            lastPaymentDate: { $max: '$paymentDate' }
          }
        }
      ]);

      const stats = paymentStats.length > 0 ? paymentStats[0] : {
        totalSpent: 0,
        averagePayment: 0,
        paymentCount: 0,
        lastPaymentDate: null
      };

      res.json({
        success: true,
        data: {
          customer,
          statistics: stats,
          recentPayments: customer.payments,
          stripeData
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching customer dashboard',
        error: error.message
      });
    }
  },

  // Get comprehensive statistics
  async getComprehensiveStats(req, res) {
    try {
      const [customerStats, paymentStats, monthlyRevenue, topCustomers] = await Promise.all([
        Customer.getCustomerStats(),
        Payment.getPaymentStats(),
        Payment.getMonthlyRevenue(),
        Customer.aggregate([
          { $sort: { totalAmount: -1 } },
          { $limit: 5 },
          { $project: { name: 1, email: 1, totalAmount: 1, totalPayments: 1 } }
        ])
      ]);

      let stripeBalance = { available: 0, pending: 0 };
      try {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        const balance = await stripe.balance.retrieve();
        stripeBalance = {
          available: balance.available[0]?.amount / 100 || 0,
          pending: balance.pending[0]?.amount / 100 || 0
        };
      } catch (stripeError) {
        console.error('Error fetching Stripe balance:', stripeError);
      }

      const stats = {
        customerStats,
        paymentStats,
        monthlyRevenue,
        topCustomers,
        stripeBalance,
        summary: {
          customerLifetimeValue: customerStats.avgCustomerValue,
          paymentSuccessRate: paymentStats.totalPayments > 0 ? 
            (paymentStats.successfulPayments / paymentStats.totalPayments * 100).toFixed(2) : 0,
          revenueGrowth: this.calculateRevenueGrowth(monthlyRevenue)
        }
      };

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching statistics',
        error: error.message
      });
    }
  },

  // Refund payment
  async refundPayment(req, res) {
    try {
      const { paymentIntentId, amount, reason } = req.body;

      const refund = await stripeService.createRefund(paymentIntentId, amount, reason);

      const payment = await Payment.findOne({ stripePaymentIntentId: paymentIntentId });
      if (payment) {
        payment.refunded = true;
        payment.refundAmount = amount || payment.amount;
        payment.stripeRefundId = refund.id;
        payment.status = 'refunded';
        payment.refundReason = reason;
        await payment.save();

        const customer = await Customer.findById(payment.customer);
        if (customer) {
          await customer.updatePaymentStats();
        }
      }

      res.json({
        success: true,
        message: 'Refund processed successfully',
        data: { refund }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error processing refund',
        error: error.message
      });
    }
  },

  // Create setup intent for saving payment methods
  async createSetupIntent(req, res) {
    try {
      const { customerId } = req.body;

      const customer = await Customer.findById(customerId);
      if (!customer) {
        return res.status(404).json({
          success: false,
          message: 'Customer not found'
        });
      }

      if (!customer.stripeCustomerId) {
        const stripeCustomer = await stripeService.createStripeCustomer(customer);
        customer.stripeCustomerId = stripeCustomer.id;
        await customer.save();
      }

      const setupIntent = await stripeService.createSetupIntent(customer.stripeCustomerId);

      res.json({
        success: true,
        data: {
          clientSecret: setupIntent.client_secret,
          setupIntentId: setupIntent.id
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error creating setup intent',
        error: error.message
      });
    }
  },

  // Get customer's payment methods
  async getCustomerPaymentMethods(req, res) {
    try {
      const { customerId } = req.params;

      const customer = await Customer.findById(customerId);
      if (!customer || !customer.stripeCustomerId) {
        return res.status(404).json({
          success: false,
          message: 'Customer or Stripe customer not found'
        });
      }

      const paymentMethods = await stripeService.getCustomerPaymentMethods(customer.stripeCustomerId);

      res.json({
        success: true,
        data: paymentMethods.data
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching payment methods',
        error: error.message
      });
    }
  },

  // Helper method for revenue growth calculation
  calculateRevenueGrowth(monthlyRevenue) {
    if (monthlyRevenue.length < 2) return 0;
    
    const currentMonth = monthlyRevenue[monthlyRevenue.length - 1];
    const previousMonth = monthlyRevenue[monthlyRevenue.length - 2];
    
    return previousMonth.revenue > 0 ? 
      ((currentMonth.revenue - previousMonth.revenue) / previousMonth.revenue * 100).toFixed(2) : 100;
  }
};

// Webhook handlers
async function handlePaymentIntentSucceeded(paymentIntent) {
  try {
    const customer = await Customer.findOne({ stripeCustomerId: paymentIntent.customer });
    if (customer) {
      const payment = new Payment({
        customer: customer._id,
        stripePaymentIntentId: paymentIntent.id,
        stripeCustomerId: paymentIntent.customer,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        paymentMethod: 'card',
        paymentMethodDetails: paymentIntent.payment_method_details,
        description: paymentIntent.description,
        metadata: paymentIntent.metadata,
        receiptUrl: paymentIntent.charges.data[0]?.receipt_url,
        paymentDate: new Date()
      });

      await payment.save();
      await customer.updatePaymentStats();
      await emailService.sendPaymentConfirmation(payment, customer);
    }
  } catch (error) {
    console.error('Error handling payment intent succeeded:', error);
  }
}

async function handlePaymentIntentFailed(paymentIntent) {
  try {
    const customer = await Customer.findOne({ stripeCustomerId: paymentIntent.customer });
    if (customer) {
      const lastError = paymentIntent.last_payment_error;
      await emailService.sendPaymentFailed(
        { amount: paymentIntent.amount / 100, currency: paymentIntent.currency },
        customer,
        lastError?.message || 'Payment failed'
      );
    }
  } catch (error) {
    console.error('Error handling payment intent failed:', error);
  }
}

async function handlePaymentIntentCanceled(paymentIntent) {
  try {
    const payment = await Payment.findOne({ stripePaymentIntentId: paymentIntent.id });
    if (payment) {
      payment.status = 'canceled';
      await payment.save();
    }
  } catch (error) {
    console.error('Error handling payment intent canceled:', error);
  }
}

async function handleSubscriptionCreated(subscription) {
  try {
    const customer = await Customer.findOne({ stripeCustomerId: subscription.customer });
    if (customer) {
      customer.subscription = {
        stripeSubscriptionId: subscription.id,
        status: subscription.status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000)
      };
      await customer.save();
    }
  } catch (error) {
    console.error('Error handling subscription created:', error);
  }
}

async function handleInvoicePaymentSucceeded(invoice) {
  try {
    if (invoice.payment_intent) {
      const paymentIntent = await stripeService.retrievePaymentIntent(invoice.payment_intent);
      await handlePaymentIntentSucceeded(paymentIntent);
    }
  } catch (error) {
    console.error('Error handling invoice payment succeeded:', error);
  }
}

module.exports = customerPaymentController;