const Car = require("../models/car");
const Statistic = require("../models/Statistic");
const cloudinary = require("../cloudinary/cloudinary");
const sendEmail = require("../mails/sendEmail");

// Create new car with image upload
exports.createCar = async (req, res) => {
  try {
    const { name, price, description, specs, userEmail } = req.body;

    // // Validate required fields
    // if (!name || !price || !description || !specs) {
    //   return res.status(400).json({
    //     success: false,
    //     message: "Please provide all required fields",
    //   });
    // }

    let imageUrl = "";
    let cloudinaryId = "";

    // Check if image is provided via file upload or URL
    if (req.file) {
      // Upload image to Cloudinary
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "cars",
      });
      imageUrl = result.secure_url;
      cloudinaryId = result.public_id;
    } else if (req.body.image) {
      // Use provided image URL
      imageUrl = req.body.image;
    } else {
      return res.status(400).json({
        success: false,
        message: "Please provide an image",
      });
    }

    // Parse specs if it's a string
    const specsData = typeof specs === "string" ? JSON.parse(specs) : specs;

    // Create new car
    const car = new Car({
      name,
      price,
      image: imageUrl,
      cloudinary_id: cloudinaryId,
      description,
      specs: specsData,
      status: status || "active",
    });

    await car.save();

    // Update statistics
    await updateStatistics();

    // Send confirmation email
    if (userEmail) {
      await sendEmail.sendCarPostConfirmation({
        carName: name,
        price: price,
        description: description,
        imageUrl: imageUrl,
        userEmail: userEmail,
      });
    }

    res.status(201).json({
      success: true,
      message: "Car posted successfully!",
      data: car,
    });
  } catch (error) {
    console.error("Error creating car:", error);
    res.status(500).json({
      success: false,
      message: "Error creating car listing",
      error: error.message,
    });
  }
};

// Get all cars with filtering, sorting, and pagination
exports.getAllCars = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
      status,
      minPrice,
      maxPrice,
      search,
    } = req.query;

    // Build filter object
    const filter = {};
    if (status) filter.status = status;
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseInt(minPrice);
      if (maxPrice) filter.price.$lte = parseInt(maxPrice);
    }
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Execute query with pagination
    const cars = await Car.find(filter)
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Get total count for pagination
    const total = await Car.countDocuments(filter);

    // Increment views for fetched cars
    await Car.updateMany(
      { _id: { $in: cars.map((car) => car._id) } },
      { $inc: { views: 1 } }
    );

    res.status(200).json({
      success: true,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      totalCars: total,
      count: cars.length,
      data: cars,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching cars",
      error: error.message,
    });
  }
};

// Get single car by ID
exports.getCarById = async (req, res) => {
  try {
    const car = await Car.findById(req.params.id);

    if (!car) {
      return res.status(404).json({
        success: false,
        message: "Car not found",
      });
    }

    // Increment views
    car.views += 1;
    await car.save();

    res.status(200).json({
      success: true,
      data: car,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching car",
      error: error.message,
    });
  }
};

// Update car
exports.updateCar = async (req, res) => {
  try {
    const { name, price, description, specs, status } = req.body;

    const car = await Car.findById(req.params.id);

    if (!car) {
      return res.status(404).json({
        success: false,
        message: "Car not found",
      });
    }

    let updateData = { name, price, description, status };

    // Handle specs update
    if (specs) {
      updateData.specs = typeof specs === "string" ? JSON.parse(specs) : specs;
    }

    // Handle image update
    if (req.file) {
      // Delete old image from Cloudinary if exists
      if (car.cloudinary_id) {
        await cloudinary.uploader.destroy(car.cloudinary_id);
      }

      // Upload new image
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "cars",
      });

      updateData.image = result.secure_url;
      updateData.cloudinary_id = result.public_id;
    }

    const updatedCar = await Car.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    // Update statistics
    await updateStatistics();

    res.status(200).json({
      success: true,
      message: "Car updated successfully",
      data: updatedCar,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating car",
      error: error.message,
    });
  }
};

// Delete car
exports.deleteCar = async (req, res) => {
  try {
    const car = await Car.findById(req.params.id);

    if (!car) {
      return res.status(404).json({
        success: false,
        message: "Car not found",
      });
    }

    // Delete image from Cloudinary if exists
    if (car.cloudinary_id) {
      await cloudinary.uploader.destroy(car.cloudinary_id);
    }

    await Car.findByIdAndDelete(req.params.id);

    // Update statistics
    await updateStatistics();

    res.status(200).json({
      success: true,
      message: "Car deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting car",
      error: error.message,
    });
  }
};

// Like a car
exports.likeCar = async (req, res) => {
  try {
    const car = await Car.findByIdAndUpdate(
      req.params.id,
      { $inc: { likes: 1 } },
      { new: true }
    );

    if (!car) {
      return res.status(404).json({
        success: false,
        message: "Car not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Car liked successfully",
      likes: car.likes,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error liking car",
      error: error.message,
    });
  }
};

// Update car status
exports.updateCarStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!["active", "sold", "pending"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    const car = await Car.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!car) {
      return res.status(404).json({
        success: false,
        message: "Car not found",
      });
    }

    // Update statistics
    await updateStatistics();

    res.status(200).json({
      success: true,
      message: `Car status updated to ${status}`,
      data: car,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating car status",
      error: error.message,
    });
  }
};

// Get car statistics
exports.getCarStatistics = async (req, res) => {
  try {
    const stats = await Statistic.findOne().sort({ lastUpdated: -1 });

    if (!stats) {
      // Generate initial statistics if none exist
      await updateStatistics();
      const newStats = await Statistic.findOne().sort({ lastUpdated: -1 });
      return res.status(200).json({
        success: true,
        data: newStats,
      });
    }

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching statistics",
      error: error.message,
    });
  }
};

// Get dashboard statistics
exports.getDashboardStats = async (req, res) => {
  try {
    const totalCars = await Car.countDocuments();
    const activeCars = await Car.countDocuments({ status: "active" });
    const soldCars = await Car.countDocuments({ status: "sold" });
    const totalValue = await Car.aggregate([
      { $match: { status: "active" } },
      { $group: { _id: null, total: { $sum: "$price" } } },
    ]);
    const averagePrice = await Car.aggregate([
      { $match: { status: "active" } },
      { $group: { _id: null, average: { $avg: "$price" } } },
    ]);
    const topViewedCars = await Car.find()
      .sort({ views: -1 })
      .limit(5)
      .select("name views price");

    const stats = {
      totalCars,
      activeCars,
      soldCars,
      totalValue: totalValue[0]?.total || 0,
      averagePrice: Math.round(averagePrice[0]?.average || 0),
      topViewedCars,
    };

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching dashboard statistics",
      error: error.message,
    });
  }
};

// Helper function to update statistics
const updateStatistics = async () => {
  try {
    const totalCars = await Car.countDocuments();
    const totalValueResult = await Car.aggregate([
      { $group: { _id: null, total: { $sum: "$price" } } },
    ]);
    const averagePriceResult = await Car.aggregate([
      { $group: { _id: null, average: { $avg: "$price" } } },
    ]);

    const carsByStatus = await Car.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const priceRange = await Car.aggregate([
      {
        $group: {
          _id: null,
          under50k: { $sum: { $cond: [{ $lte: ["$price", 50000] }, 1, 0] } },
          under100k: { $sum: { $cond: [{ $lte: ["$price", 100000] }, 1, 0] } },
          under200k: { $sum: { $cond: [{ $lte: ["$price", 200000] }, 1, 0] } },
          over200k: { $sum: { $cond: [{ $gt: ["$price", 200000] }, 1, 0] } },
        },
      },
    ]);

    const topViewedCars = await Car.find()
      .sort({ views: -1 })
      .limit(5)
      .select("name views");

    const statusObj = { active: 0, sold: 0, pending: 0 };
    carsByStatus.forEach((item) => {
      statusObj[item._id] = item.count;
    });

    await Statistic.findOneAndUpdate(
      {},
      {
        totalCars,
        totalValue: totalValueResult[0]?.total || 0,
        averagePrice: Math.round(averagePriceResult[0]?.average || 0),
        carsByStatus: statusObj,
        priceRange: priceRange[0] || {},
        topViewedCars,
        lastUpdated: new Date(),
      },
      { upsert: true, new: true }
    );
  } catch (error) {
    console.error("Error updating statistics:", error);
  }
};
