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
    enum: ['technology', 'safety', 'performance', 'comfort', 'entertainment', 'design']
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
  icon: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['new', 'popular', 'upcoming', 'legacy'],
    default: 'new'
  },
  releaseDate: {
    type: Date,
    required: true
  },
  benefits: [{
    type: String
  }],
  availableIn: [{
    type: String
  }],
  views: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Indexes for better performance
featureSchema.index({ category: 1, status: 1 });
featureSchema.index({ releaseDate: 1 });
featureSchema.index({ isActive: 1 });
featureSchema.index({ views: -1 });

module.exports = mongoose.model('Feature', featureSchema);