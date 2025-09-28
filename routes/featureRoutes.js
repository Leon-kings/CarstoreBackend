const express = require('express');
const router = express.Router();
const featureController = require('../controllers/featureController');
const { authenticate, authorizeAdmin } = require('../middleware/authMiddleware');

// Public routes
router.get('/', featureController.getAllFeatures);
router.get('/:id', featureController.getFeatureById);
router.get('/category/:category', featureController.getFeaturesByCategory);
router.get('/featured/popular', featureController.getPopularFeatures);
router.get('/upcoming', featureController.getUpcomingFeatures);

// Admin only routes
router.post('/', authenticate, authorizeAdmin, featureController.createFeature);
router.put('/:id', authenticate, authorizeAdmin, featureController.updateFeature);
router.delete('/:id', authenticate, authorizeAdmin, featureController.deleteFeature);
router.patch('/:id/restore', authenticate, authorizeAdmin, featureController.restoreFeature);

// Statistics routes (Admin only)
router.get('/stats/overview', authenticate, authorizeAdmin, featureController.getFeatureStatistics);
router.get('/stats/dashboard', authenticate, authorizeAdmin, featureController.getDashboardStats);
router.get('/admin/all', authenticate, authorizeAdmin, featureController.getAdminFeatures);

module.exports = router;