const Feature = require('../models/Feature');
const cloudinary = require('../cloudinary/cloudinary');

// Create new feature with image upload
exports.createFeature = async (req, res) => {
  try {
    const {
      title,
      category,
      description,
      longDescription,
      icon,
      status,
      releaseDate,
      benefits,
      availableIn,
      order
    } = req.body;

    // Validate required fields
    if (!title || !category || !description || !longDescription || !icon) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields: title, category, description, longDescription, icon"
      });
    }

    let imageUrl = "";
    let cloudinaryId = "";

    // Handle image upload - FIXED VERSION
    if (req.file) {
      try {
        // If using multer with memory storage
        const b64 = Buffer.from(req.file.buffer).toString('base64');
        const dataURI = "data:" + req.file.mimetype + ";base64," + b64;
        
        const result = await cloudinary.uploader.upload(dataURI, {
          folder: "car-features",
          resource_type: "image",
          quality: "auto:good",
          fetch_format: "auto"
        });
        
        imageUrl = result.secure_url;
        cloudinaryId = result.public_id;
      } catch (uploadError) {
        console.error('Cloudinary upload error:', uploadError);
        return res.status(500).json({
          success: false,
          message: "Failed to upload image to Cloudinary",
          error: uploadError.message
        });
      }
    } else if (req.body.image) {
      // Use provided image URL
      imageUrl = req.body.image;
    } else {
      return res.status(400).json({
        success: false,
        message: "Please provide an image"
      });
    }

    // Safely parse arrays
    let benefitsArray = [];
    let availableInArray = [];

    try {
      benefitsArray = benefits ? 
        (typeof benefits === 'string' ? JSON.parse(benefits) : benefits) 
        : [];
    } catch (e) {
      benefitsArray = benefits || [];
    }

    try {
      availableInArray = availableIn ? 
        (typeof availableIn === 'string' ? JSON.parse(availableIn) : availableIn) 
        : [];
    } catch (e) {
      availableInArray = availableIn || [];
    }

    // Create new feature
    const feature = new Feature({
      title: title.trim(),
      category,
      description: description.trim(),
      longDescription: longDescription.trim(),
      image: imageUrl,
      cloudinary_id: cloudinaryId,
      icon,
      status: status || "new",
      releaseDate: releaseDate || null,
      benefits: benefitsArray,
      availableIn: availableInArray,
      order: order || 0
    });

    await feature.save();
    
    console.log('Feature created successfully:', feature._id);
    
    res.status(201).json({
      success: true,
      message: "Feature created successfully!",
      data: feature
    });

  } catch (error) {
    console.error("Error creating feature:", error);
    res.status(500).json({
      success: false,
      message: "Error creating feature",
      error: error.message
    });
  }
};

// Get all features with filtering and pagination
exports.getAllFeatures = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      status,
      search,
      sortBy = 'order',
      sortOrder = 'asc'
    } = req.query;

    // Build filter object
    const filter = { isActive: true };
    if (category) filter.category = category;
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { longDescription: { $regex: search, $options: 'i' } }
      ];
    }

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query with pagination
    const features = await Feature.find(filter)
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Get total count for pagination
    const total = await Feature.countDocuments(filter);

    res.status(200).json({
      success: true,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      totalFeatures: total,
      count: features.length,
      data: features
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching features",
      error: error.message
    });
  }
};

// Get single feature by ID
exports.getFeatureById = async (req, res) => {
  try {
    const feature = await Feature.findById(req.params.id);
    
    if (!feature) {
      return res.status(404).json({
        success: false,
        message: "Feature not found"
      });
    }

    res.status(200).json({
      success: true,
      data: feature
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching feature",
      error: error.message
    });
  }
};

// Update feature
exports.updateFeature = async (req, res) => {
  try {
    const {
      title,
      category,
      description,
      longDescription,
      icon,
      status,
      releaseDate,
      benefits,
      availableIn,
      order
    } = req.body;

    const feature = await Feature.findById(req.params.id);
    
    if (!feature) {
      return res.status(404).json({
        success: false,
        message: "Feature not found"
      });
    }

    let updateData = {
      title,
      category,
      description,
      longDescription,
      icon,
      status,
      releaseDate,
      order
    };

    // Parse arrays if provided
    if (benefits) {
      updateData.benefits = typeof benefits === 'string' ? JSON.parse(benefits) : benefits;
    }
    if (availableIn) {
      updateData.availableIn = typeof availableIn === 'string' ? JSON.parse(availableIn) : availableIn;
    }

    // Handle image update
    if (req.file) {
      // Delete old image from Cloudinary if exists
      if (feature.cloudinary_id) {
        await cloudinary.uploader.destroy(feature.cloudinary_id);
      }

      // Upload new image
      const b64 = Buffer.from(req.file.buffer).toString('base64');
      const dataURI = "data:" + req.file.mimetype + ";base64," + b64;
      
      const result = await cloudinary.uploader.upload(dataURI, {
        folder: "car-features",
        resource_type: "image"
      });
      
      updateData.image = result.secure_url;
      updateData.cloudinary_id = result.public_id;
    } else if (req.body.image && req.body.image !== feature.image) {
      // If new URL provided, clear cloudinary_id
      updateData.image = req.body.image;
      updateData.cloudinary_id = '';
    }

    const updatedFeature = await Feature.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: "Feature updated successfully",
      data: updatedFeature
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating feature",
      error: error.message
    });
  }
};

// Delete feature (soft delete)
exports.deleteFeature = async (req, res) => {
  try {
    const feature = await Feature.findById(req.params.id);

    if (!feature) {
      return res.status(404).json({
        success: false,
        message: "Feature not found"
      });
    }

    // Soft delete by setting isActive to false
    await Feature.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: "Feature deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting feature",
      error: error.message
    });
  }
};

// Hard delete feature with Cloudinary cleanup
exports.hardDeleteFeature = async (req, res) => {
  try {
    const feature = await Feature.findById(req.params.id);

    if (!feature) {
      return res.status(404).json({
        success: false,
        message: "Feature not found"
      });
    }

    // Delete image from Cloudinary if exists
    if (feature.cloudinary_id) {
      await cloudinary.uploader.destroy(feature.cloudinary_id);
    }

    await Feature.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Feature permanently deleted"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting feature",
      error: error.message
    });
  }
};

// Get features by category
exports.getFeaturesByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    
    const features = await Feature.find({ 
      category, 
      isActive: true 
    }).sort({ order: 1 });

    res.status(200).json({
      success: true,
      count: features.length,
      data: features
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching features by category",
      error: error.message
    });
  }
};

// Get features statistics
exports.getFeaturesStats = async (req, res) => {
  try {
    const totalFeatures = await Feature.countDocuments({ isActive: true });
    
    const featuresByCategory = await Feature.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    const featuresByStatus = await Feature.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const stats = {
      totalFeatures,
      byCategory: featuresByCategory,
      byStatus: featuresByStatus
    };

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching feature statistics",
      error: error.message
    });
  }
};