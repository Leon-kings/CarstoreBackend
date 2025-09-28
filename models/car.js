const mongoose = require('mongoose');

const specsSchema = new mongoose.Schema({
  range: {
    type: String,
    required: true
  },
  topSpeed: {
    type: String,
    required: true
  },
  acceleration: {
    type: String,
    required: true
  },
  seating: {
    type: String,
    required: true
  },
  engine: {
    type: String,
    required: true
  }
});

const carSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  image: {
    type: String,
    required: true
  },
  cloudinary_id: {
    type: String
  },
  description: {
    type: String,
    required: true
  },
  specs: {
    type: specsSchema,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'sold', 'pending'],
    default: 'active'
  },

  createdBy: {
    type: String,
    default: 'admin'
  }
}, {
  timestamps: true
});

// Index for better performance
carSchema.index({ price: 1, createdAt: -1 });
carSchema.index({ status: 1 });

module.exports = mongoose.model('Car', carSchema);