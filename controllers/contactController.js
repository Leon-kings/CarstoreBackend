const Contact = require('../models/contact');
const User = require('../models/User');
const emailService = require('../mails/sendEmail');

class ContactController {
  

 async createContact(req, res) {
    try {
      const contact = new Contact(req.body);
      await contact.save();

      // Send confirmation email to user 
      try {
        await emailService.sendContactConfirmation(contact);
      } catch (emailError) {
        console.error('Email confirmation failed:', emailError);
      }

      // Send notification to admins - FIXED: changed 'status' to 'role'
      try {
        const admins = await User.find({ status: 'admin'});
        const adminEmails = admins.map(admin => admin.email);
        if (adminEmails.length > 0) {
          await emailService.sendAdminNotification(contact, adminEmails);
        }
      } catch (notificationError) {
        console.error('Admin notification failed:', notificationError);
      }

      res.status(201).json({
        success: true,
        message: 'Contact submitted successfully',
        data: contact
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: 'Error creating contact',
        error: error.message
      });
    }
  }

  // GET MONTHLY STATISTICS
  async getMonthlyStatistics(req, res) {
    try {
      const { year = new Date().getFullYear(), months = 12 } = req.query;
      
      const monthlyStats = await Contact.aggregate([
        {
          $match: {
            createdAt: {
              $gte: new Date(`${year}-01-01`),
              $lte: new Date(`${year}-12-31`)
            }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" }
            },
            totalContacts: { $sum: 1 },
            byStatus: {
              $push: {
                status: "$status",
                count: 1
              }
            },
            byInterest: {
              $push: {
                interest: "$interest",
                count: 1
              }
            },
            byPriority: {
              $push: {
                priority: "$priority",
                count: 1
              }
            }
          }
        },
        {
          $project: {
            _id: 0,
            year: "$_id.year",
            month: "$_id.month",
            totalContacts: 1,
            statusBreakdown: {
              $arrayToObject: {
                $map: {
                  input: "$byStatus",
                  as: "status",
                  in: {
                    k: "$$status.status",
                    v: {
                      $sum: {
                        $filter: {
                          input: "$byStatus",
                          as: "s",
                          cond: { $eq: ["$$s.status", "$$status.status"] }
                        }.count
                      }
                    }
                  }
                }
              }
            },
            interestBreakdown: {
              $arrayToObject: {
                $map: {
                  input: "$byInterest",
                  as: "interest",
                  in: {
                    k: "$$interest.interest",
                    v: {
                      $sum: {
                        $filter: {
                          input: "$byInterest",
                          as: "i",
                          cond: { $eq: ["$$i.interest", "$$interest.interest"] }
                        }.count
                      }
                    }
                  }
                }
              }
            },
            priorityBreakdown: {
              $arrayToObject: {
                $map: {
                  input: "$byPriority",
                  as: "priority",
                  in: {
                    k: "$$priority.priority",
                    v: {
                      $sum: {
                        $filter: {
                          input: "$byPriority",
                          as: "p",
                          cond: { $eq: ["$$p.priority", "$$priority.priority"] }
                        }.count
                      }
                    }
                  }
                }
              }
            }
          }
        },
        { $sort: { year: 1, month: 1 } }
      ]);

      // Format the response with all months (even those with 0 contacts)
      const allMonths = Array.from({ length: 12 }, (_, i) => i + 1);
      const formattedStats = allMonths.map(month => {
        const monthData = monthlyStats.find(stat => stat.month === month);
        
        if (monthData) {
          return monthData;
        }
        
        return {
          year: parseInt(year),
          month: month,
          totalContacts: 0,
          statusBreakdown: { new: 0, 'in-progress': 0, resolved: 0, archived: 0 },
          interestBreakdown: { general: 0, support: 0, sales: 0, partnership: 0, other: 0, '': 0 },
          priorityBreakdown: { low: 0, medium: 0, high: 0 }
        };
      });

      // Calculate summary statistics
      const summary = {
        totalYearlyContacts: monthlyStats.reduce((sum, month) => sum + month.totalContacts, 0),
        averageMonthlyContacts: monthlyStats.length > 0 
          ? Math.round(monthlyStats.reduce((sum, month) => sum + month.totalContacts, 0) / monthlyStats.length)
          : 0,
        busiestMonth: monthlyStats.length > 0 
          ? monthlyStats.reduce((max, month) => month.totalContacts > max.totalContacts ? month : max, monthlyStats[0])
          : null,
        mostCommonInterest: this.getMostCommonValue(monthlyStats, 'interestBreakdown'),
        mostCommonStatus: this.getMostCommonValue(monthlyStats, 'statusBreakdown')
      };

      res.json({
        success: true,
        data: {
          year: parseInt(year),
          monthlyStats: formattedStats,
          summary: summary
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching monthly statistics',
        error: error.message
      });
    }
  }

  // Helper method to find most common value
  getMostCommonValue(monthlyStats, field) {
    const counts = {};
    monthlyStats.forEach(month => {
      Object.entries(month[field] || {}).forEach(([key, value]) => {
        counts[key] = (counts[key] || 0) + value;
      });
    });
    
    const mostCommon = Object.entries(counts).reduce((max, [key, value]) => {
      return value > max.value ? { key, value } : max;
    }, { key: '', value: 0 });
    
    return mostCommon.key || 'No data';
  }

  // GET CONTACTS BY DATE RANGE
  async getContactsByDateRange(req, res) {
    try {
      const { startDate, endDate, page = 1, limit = 50 } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Start date and end date are required'
        });
      }

      const filter = {
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };

      const contacts = await Contact.find(filter)
        .populate('assignedTo', 'name email')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await Contact.countDocuments(filter);

      res.json({
        success: true,
        data: contacts,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        },
        dateRange: {
          startDate,
          endDate,
          totalContacts: total
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching contacts by date range',
        error: error.message
      });
    }
  }


  // READ - Get all contacts (Admin only)
  async getContacts(req, res) {
    try {
      const { 
        page = 1, 
        limit = 10, 
        status, 
        priority, 
        interest,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      // Build filter object
      const filter = {};
      if (status) filter.status = status;
      if (priority) filter.priority = priority;
      if (interest) filter.interest = interest;

      // Search functionality
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { message: { $regex: search, $options: 'i' } }
        ];
      }

      // Sort configuration
      const sortConfig = {};
      sortConfig[sortBy] = sortOrder === 'desc' ? -1 : 1;

      const contacts = await Contact.find(filter)
        .populate('assignedTo', 'name email')
        .populate('notes.addedBy', 'name')
        .populate('adminReply.repliedBy', 'name')
        .sort(sortConfig)
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit));

      const total = await Contact.countDocuments(filter);
      const totalPages = Math.ceil(total / parseInt(limit));

      res.json({
        success: true,
        data: contacts,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalContacts: total,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching contacts',
        error: error.message
      });
    }
  }

  // READ - Get single contact by ID
  async getContact(req, res) {
    try {
      const contact = await Contact.findById(req.params.id)
        .populate('assignedTo', 'name email')
        .populate('notes.addedBy', 'name')
        .populate('adminReply.repliedBy', 'name');

      if (!contact) {
        return res.status(404).json({
          success: false,
          message: 'Contact not found'
        });
      }

      res.json({
        success: true,
        data: contact
      });

    } catch (error) {
      if (error.kind === 'ObjectId') {
        return res.status(400).json({
          success: false,
          message: 'Invalid contact ID'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Error fetching contact',
        error: error.message
      });
    }
  }

  // UPDATE - Update contact
  async updateContact(req, res) {
    try {
      const { name, email, phone, interest, message, status, priority, assignedTo } = req.body;

      const allowedUpdates = {
        name, email, phone, interest, message, status, priority, assignedTo
      };

      // Remove undefined fields
      Object.keys(allowedUpdates).forEach(key => {
        if (allowedUpdates[key] === undefined) {
          delete allowedUpdates[key];
        }
      });

      const contact = await Contact.findByIdAndUpdate(
        req.params.id,
        allowedUpdates,
        { 
          new: true, 
          runValidators: true,
          context: 'query'
        }
      ).populate('assignedTo', 'name email')
       .populate('notes.addedBy', 'name');

      if (!contact) {
        return res.status(404).json({
          success: false,
          message: 'Contact not found'
        });
      }

      res.json({
        success: true,
        message: 'Contact updated successfully',
        data: contact
      });

    } catch (error) {
      if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(err => err.message);
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors
        });
      }

      if (error.kind === 'ObjectId') {
        return res.status(400).json({
          success: false,
          message: 'Invalid contact ID'
        });
      }

      res.status(400).json({
        success: false,
        message: 'Error updating contact',
        error: error.message
      });
    }
  }

  // DELETE - Delete contact
  async deleteContact(req, res) {
    try {
      const contact = await Contact.findByIdAndDelete(req.params.id);

      if (!contact) {
        return res.status(404).json({
          success: false,
          message: 'Contact not found'
        });
      }

      res.json({
        success: true,
        message: 'Contact deleted successfully',
        data: {
          id: req.params.id,
          name: contact.name,
          email: contact.email
        }
      });

    } catch (error) {
      if (error.kind === 'ObjectId') {
        return res.status(400).json({
          success: false,
          message: 'Invalid contact ID'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Error deleting contact',
        error: error.message
      });
    }
  }

  // BULK OPERATIONS - Update multiple contacts
  async bulkUpdateContacts(req, res) {
    try {
      const { contactIds, updates } = req.body;

      if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Contact IDs array is required'
        });
      }

      const allowedUpdates = {};
      Object.keys(updates).forEach(key => {
        if (['status', 'priority', 'assignedTo'].includes(key)) {
          allowedUpdates[key] = updates[key];
        }
      });

      const result = await Contact.updateMany(
        { _id: { $in: contactIds } },
        allowedUpdates,
        { runValidators: true }
      );

      res.json({
        success: true,
        message: `${result.modifiedCount} contacts updated successfully`,
        data: {
          modifiedCount: result.modifiedCount,
          matchedCount: result.matchedCount
        }
      });

    } catch (error) {
      res.status(400).json({
        success: false,
        message: 'Error updating contacts',
        error: error.message
      });
    }
  }

  // BULK OPERATIONS - Delete multiple contacts
  async bulkDeleteContacts(req, res) {
    try {
      const { contactIds } = req.body;

      if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Contact IDs array is required'
        });
      }

      const result = await Contact.deleteMany({ _id: { $in: contactIds } });

      res.json({
        success: true,
        message: `${result.deletedCount} contacts deleted successfully`,
        data: {
          deletedCount: result.deletedCount
        }
      });

    } catch (error) {
      res.status(400).json({
        success: false,
        message: 'Error deleting contacts',
        error: error.message
      });
    }
  }

  // Get contacts by status
  async getContactsByStatus(req, res) {
    try {
      const { status } = req.params;
      const { limit = 50 } = req.query;

      const validStatuses = ['new', 'in-progress', 'resolved', 'archived'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status value'
        });
      }

      const contacts = await Contact.getByStatus(status)
        .limit(parseInt(limit))
        .sort({ createdAt: -1 });

      const count = await Contact.countDocuments({ status });

      res.json({
        success: true,
        data: contacts,
        count
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching contacts by status',
        error: error.message
      });
    }
  }

  // Search contacts
  async searchContacts(req, res) {
    try {
      const { q: searchTerm, field = 'all' } = req.query;

      if (!searchTerm) {
        return res.status(400).json({
          success: false,
          message: 'Search term is required'
        });
      }

      let searchFilter = {};

      switch (field) {
        case 'name':
          searchFilter.name = { $regex: searchTerm, $options: 'i' };
          break;
        case 'email':
          searchFilter.email = { $regex: searchTerm, $options: 'i' };
          break;
        case 'message':
          searchFilter.message = { $regex: searchTerm, $options: 'i' };
          break;
        default:
          searchFilter.$or = [
            { name: { $regex: searchTerm, $options: 'i' } },
            { email: { $regex: searchTerm, $options: 'i' } },
            { message: { $regex: searchTerm, $options: 'i' } },
            { phone: { $regex: searchTerm, $options: 'i' } }
          ];
      }

      const contacts = await Contact.find(searchFilter)
        .populate('assignedTo', 'name email')
        .sort({ createdAt: -1 })
        .limit(50);

      res.json({
        success: true,
        data: contacts,
        count: contacts.length
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error searching contacts',
        error: error.message
      });
    }
  }
}

module.exports = new ContactController();