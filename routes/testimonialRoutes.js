const express = require('express');
const router = express.Router();
const testimonialController = require('../controllers/testimonialController');

// CRUD Routes
router.post('/', testimonialController.createTestimonial);
router.get('/', testimonialController.getTestimonials);
router.get('/:id', testimonialController.getTestimonialById);
router.put('/:id', testimonialController.updateTestimonial);
router.delete('/:id', testimonialController.deleteTestimonial);

// Statistics Routes
router.get('/stats/statistics', testimonialController.getStatistics);
router.post('/stats/send-monthly', testimonialController.sendMonthlyStatistics);

module.exports = router;