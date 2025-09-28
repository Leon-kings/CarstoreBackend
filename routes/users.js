const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const { authMiddleware } = require("../middlewares/auth");

// Public routes
router.post("/register", userController.registerUser);
router.post("/login", userController.login); // You'll need to implement login in controller

// Protected routes (require authentication)
router.get("/profile", authMiddleware, userController.getCurrentUser);
router.put("/profile", authMiddleware, userController.updateProfile);

// Admin only routes
router.get("/", userController.getAllUsers);
router.get("/all", authMiddleware, userController.getAllUsersWithoutPagination);
router.get("/stats", authMiddleware, userController.getUserStatistics);
router.get("/date-range", authMiddleware, userController.getUsersByDateRange);
router.get("/export", authMiddleware, userController.exportUsers);
router.get("/search", authMiddleware, userController.searchUsers);

// User management routes (Admin only)
router.get("/:id", authMiddleware, userController.getUserById);
router.put("/:id", userController.updateUser);
router.patch("/:id/status", authMiddleware, userController.updateUserStatus);
router.delete("/:id",  userController.deleteUser);


// Dashboard route
router.get("/dashboard", authMiddleware, userController.getUserDashboardStats);

module.exports = router;