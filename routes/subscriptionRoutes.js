const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');

// CREATE
router.post('/', subscriptionController.subscribe);

// READ
router.get('/', subscriptionController.getSubscriptions);
router.get('/statistics', subscriptionController.getStatistics);
router.get('/export', subscriptionController.exportSubscriptions);
router.get('/date-range', subscriptionController.getSubscriptionsByDateRange);
router.get('/:email', subscriptionController.getSubscriptionByEmail);
router.get('/:id', subscriptionController.getSubscriptionById);

// UPDATE
router.put('/:id', subscriptionController.updateSubscription);
router.post('/unsubscribe', subscriptionController.unsubscribeByEmail);
router.post('/resubscribe', subscriptionController.resubscribeByEmail);

// DELETE
router.delete('/:id', subscriptionController.deleteSubscription);

module.exports = router;