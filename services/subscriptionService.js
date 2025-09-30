const subscriptionService = require('../services/subscriptionService');

class SubscriptionController {
  // CREATE
  async subscribe(req, res) {
    try {
      const { email, source = 'website_footer', metadata = {} } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email is required'
        });
      }

      const result = await subscriptionService.subscribe(email, source, metadata);

      if (result.success) {
        return res.status(201).json(result);
      } else {
        return res.status(400).json(result);
      }

    } catch (error) {
      console.error('Subscription controller error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // READ - All subscriptions
  async getSubscriptions(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        source,
        search,
        sortBy = 'subscribedAt',
        sortOrder = 'desc'
      } = req.query;

      const result = await subscriptionService.getSubscriptions({
        page: parseInt(page),
        limit: parseInt(limit),
        status,
        source,
        search,
        sortBy,
        sortOrder
      });

      return res.status(200).json(result);

    } catch (error) {
      console.error('Get subscriptions controller error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // READ - Single subscription by ID
  async getSubscriptionById(req, res) {
    try {
      const { id } = req.params;
      const result = await subscriptionService.getSubscriptionById(id);

      if (result.success) {
        return res.status(200).json(result);
      } else {
        return res.status(404).json(result);
      }

    } catch (error) {
      console.error('Get subscription by ID controller error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // READ - Subscription by email
  async getSubscriptionByEmail(req, res) {
    try {
      const { email } = req.params;
      const result = await subscriptionService.getSubscriptionByEmail(email);

      return res.status(200).json(result);

    } catch (error) {
      console.error('Get subscription by email controller error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // UPDATE
  async updateSubscription(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const result = await subscriptionService.updateSubscription(id, updateData);

      if (result.success) {
        return res.status(200).json(result);
      } else {
        return res.status(400).json(result);
      }

    } catch (error) {
      console.error('Update subscription controller error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // DELETE
  async deleteSubscription(req, res) {
    try {
      const { id } = req.params;
      const result = await subscriptionService.deleteSubscription(id);

      if (result.success) {
        return res.status(200).json(result);
      } else {
        return res.status(404).json(result);
      }

    } catch (error) {
      console.error('Delete subscription controller error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // BULK Operations
  async bulkUpdateStatus(req, res) {
    try {
      const { emails, status } = req.body;

      if (!emails || !Array.isArray(emails) || !status) {
        return res.status(400).json({
          success: false,
          message: 'Emails array and status are required'
        });
      }

      const result = await subscriptionService.bulkUpdateStatus(emails, status);
      return res.status(200).json(result);

    } catch (error) {
      console.error('Bulk update controller error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  async bulkDelete(req, res) {
    try {
      const { emails } = req.body;

      if (!emails || !Array.isArray(emails)) {
        return res.status(400).json({
          success: false,
          message: 'Emails array is required'
        });
      }

      const result = await subscriptionService.bulkDelete(emails);
      return res.status(200).json(result);

    } catch (error) {
      console.error('Bulk delete controller error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // STATISTICS
  async getStatistics(req, res) {
    try {
      const result = await subscriptionService.getStatistics();
      return res.status(200).json(result);

    } catch (error) {
      console.error('Get statistics controller error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // EXPORT
  async exportSubscriptions(req, res) {
    try {
      const { status = 'active' } = req.query;
      const result = await subscriptionService.exportSubscriptions(status);

      if (result.success) {
        // Set headers for CSV download
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=subscriptions-${status}-${Date.now()}.csv`);
        
        // Convert to CSV
        const csvHeaders = 'Email,Source,Subscribed At\n';
        const csvRows = result.data.map(item => 
          `"${item.email}","${item.source}","${item.subscribedAt}"`
        ).join('\n');
        
        const csv = csvHeaders + csvRows;
        return res.send(csv);
      } else {
        return res.status(400).json(result);
      }

    } catch (error) {
      console.error('Export subscriptions controller error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

module.exports = SubscriptionService();