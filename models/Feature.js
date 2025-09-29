const mongoose = require('mongoose');

const featureSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['technology', 'safety', 'performance', 'comfort', 'entertainment']
  },
  description: {
    type: String,
    required: true
  },
  longDescription: {
    type: String,
    required: true
  },
  image: {
    type: String,
    required: true
  },
  cloudinary_id: {
    type: String
  },
  icon: {
    type: String, 
    required: true
  },
  status: {
    type: String,
    enum: ['new', 'updated', 'coming-soon', 'standard'],
    default: 'new'
  },
  releaseDate: {
    type: Date
  },
  benefits: [{
    type: String
  }],
  availableIn: [{
    type: String
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  order: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index for better performance
featureSchema.index({ category: 1, status: 1 });
featureSchema.index({ isActive: 1, order: 1 });

module.exports = mongoose.model('Feature', featureSchema);