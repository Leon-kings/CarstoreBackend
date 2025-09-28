const express = require('express');
const router = express.Router();
const carController = require('../controllers/carController');
const upload = require('../middlewares/upload');

// CRUD Operations
router.post('/', upload.single('image'), carController.createCar);
router.get('/', carController.getAllCars);
router.get('/:id', carController.getCarById);
router.put('/:id', upload.single('image'), carController.updateCar);
router.delete('/:id', carController.deleteCar);

// Additional Operations
router.patch('/:id/like', carController.likeCar);
router.patch('/:id/status', carController.updateCarStatus);

// Statistics Routes
router.get('/stats/overview', carController.getCarStatistics);
router.get('/stats/dashboard', carController.getDashboardStats);

module.exports = router;