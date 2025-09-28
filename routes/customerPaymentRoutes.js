const express = require('express');
const router = express.Router();
const customerPaymentController = require('../controllers/customerPaymentController');

// Customer CRUD routes
router.post('/', customerPaymentController.createCustomer);
router.get('/', customerPaymentController.getAllCustomers);
router.get('/:id', customerPaymentController.getCustomerById);
router.put('/:id', customerPaymentController.updateCustomer);
router.delete('/:id', customerPaymentController.deleteCustomer);

// Customer specific routes
router.get('/:id/dashboard', customerPaymentController.getCustomerDashboard);
router.get('/:customerId/payment-methods', customerPaymentController.getCustomerPaymentMethods);

// Payment routes
router.post('/', customerPaymentController.createPaymentIntent);
router.post('/confirm', customerPaymentController.confirmPayment);
router.get('/', customerPaymentController.getAllPayments);
router.get('/:id', customerPaymentController.getPaymentById);
router.post('/refund', customerPaymentController.refundPayment);

// Setup intent for saving payment methods
router.post('/setup-intents', customerPaymentController.createSetupIntent);

// Webhook route (must be raw body)
router.post('/webhook', express.raw({type: 'application/json'}), customerPaymentController.handleWebhook);

// Statistics routes
router.get('/statistics', customerPaymentController.getComprehensiveStats);

// Health check route
router.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Customer Payment API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

module.exports = router;