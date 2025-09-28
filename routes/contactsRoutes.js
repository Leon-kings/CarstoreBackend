const express = require("express");
const router = express.Router();
const {
  createContact,
  getContacts,
  searchContacts,
  getContactsByStatus,
  getContact,
  updateContact,
  deleteContact,
  bulkUpdateContacts,
  bulkDeleteContacts,
} = require("../controllers/contactController");
const { authMiddleware } = require("../middlewares/auth");

// Public routes
router.post("/", createContact);

// Protected admin routes
router.get("/", getContacts);
router.get("/search", authMiddleware, searchContacts);
router.get("/status/:status", authMiddleware, getContactsByStatus);
router.get("/:id", authMiddleware, getContact);
router.put("/:id", authMiddleware, updateContact);
router.delete("/:id", authMiddleware, deleteContact);

// Bulk operations
router.patch("/bulk/update", authMiddleware, bulkUpdateContacts);
router.post("/bulk/delete", authMiddleware, bulkDeleteContacts);

module.exports = router;
