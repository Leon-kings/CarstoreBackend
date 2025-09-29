const express = require("express");
const router = express.Router();
const {
  createFeature,
  getAllFeatures,
  getFeaturesStats,
  getFeaturesByCategory,
  getFeatureById,
  updateFeature,
  deleteFeature,
  hardDeleteFeature,
} = require("../controllers/featureController");
const upload = require("../middlewares/upload");

// CRUD Operations
router.post("/", upload.single("image"), createFeature);
router.get("/", getAllFeatures);
router.get("/stats", getFeaturesStats);
router.get("/:category", getFeaturesByCategory);
router.get("/:id", getFeatureById);
router.put("/:id", upload.single("image"), updateFeature);
router.delete("/:id", deleteFeature);
router.delete("/:id/hard", hardDeleteFeature);

module.exports = router;
