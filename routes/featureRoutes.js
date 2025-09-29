const express = require('express');
const router = express.Router();
const featureController = require('../controllers/featureController');
const upload = require('../middlewares/upload');

// CRUD Operations
router.post('/', upload.single('image'), featureController.createFeature);
router.get('/', featureController.getAllFeatures);
router.get('/stats', featureController.getFeaturesStats);
router.get('/category/:category', featureController.getFeaturesByCategory);
router.get('/:id', featureController.getFeatureById);
router.put('/:id', upload.single('image'), featureController.updateFeature);
router.delete('/:id', featureController.deleteFeature);
router.delete('/:id/hard', featureController.hardDeleteFeature);

module.exports = router;