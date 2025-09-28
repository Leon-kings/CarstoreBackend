const nodemailer = require("nodemailer");
const User = require("../models/User");

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || "smtp.gmail.com",
      port: process.env.EMAIL_PORT || 587,
      secure: process.env.EMAIL_PORT === '465' || false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  // CAR LISTING EMAIL METHODS (ADDED FROM ORIGINAL)
  async sendCarPostConfirmation({ carName, price, description, imageUrl, userEmail }) {
    try {
      const mailOptions = {
        from: `"${process.env.FROM_NAME || 'Car Marketplace'}" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
        to: userEmail,
        subject: '🚗 Car Listing Posted Successfully!',
        html: this.getCarPostConfirmationTemplate({ carName, price, description, imageUrl })
      };

      await this.transporter.sendMail(mailOptions);
      console.log('Confirmation email sent successfully');
    } catch (error) {
      console.error('Error sending confirmation email:', error);
      throw new Error('Failed to send confirmation email');
    }
  }

  async sendStatusUpdate({ carName, oldStatus, newStatus, userEmail }) {
    try {
      const mailOptions = {
        from: `"${process.env.FROM_NAME || 'Car Marketplace'}" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
        to: userEmail,
        subject: `Car Status Updated - ${carName}`,
        html: this.getStatusUpdateTemplate({ carName, oldStatus, newStatus })
      };

      await this.transporter.sendMail(mailOptions);
      console.log('Status update email sent successfully');
    } catch (error) {
      console.error('Error sending status update email:', error);
    }
  }

  // CAR LISTING TEMPLATE METHODS (ADDED FROM ORIGINAL)
  getCarPostConfirmationTemplate({ carName, price, description, imageUrl }) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
          <style>
              body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f4; }
              .container { max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; }
              .header { background: #007bff; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { padding: 20px; }
              .car-image { max-width: 100%; height: auto; border-radius: 10px; margin: 20px 0; }
              .details { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0; }
              .success-message { color: #28a745; font-weight: bold; text-align: center; margin: 20px 0; }
              .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 20px 0; }
              .stat-card { background: #e9ecef; padding: 15px; border-radius: 5px; text-align: center; }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>🚗 Car Listed Successfully!</h1>
              </div>
              <div class="content">
                  <p class="success-message">✅ Your car has been listed successfully and is now live on our platform!</p>
                  
                  <h2>${carName}</h2>
                  
                  <img src="${imageUrl}" alt="${carName}" class="car-image" />
                  
                  <div class="details">
                      <h3>📋 Listing Details:</h3>
                      <p><strong>Price:</strong> $${price.toLocaleString()}</p>
                      <p><strong>Description:</strong> ${description}</p>
                  </div>
                  
                  <div class="stats">
                      <div class="stat-card">
                          <h4>👁️ Views</h4>
                          <p>0</p>
                      </div>
                      <div class="stat-card">
                          <h4>❤️ Likes</h4>
                          <p>0</p>
                      </div>
                  </div>
                  
                  <p>📊 Your car is now visible to potential buyers. You can track its performance in your dashboard.</p>
                  
                  <p>Thank you for using our service!</p>
                  
                  <p>Best regards,<br>Car Marketplace Team</p>
              </div>
          </div>
      </body>
      </html>
    `;
  }

  getStatusUpdateTemplate({ carName, oldStatus, newStatus }) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
          <style>
              body { font-family: Arial, sans-serif; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #ffc107; color: white; padding: 20px; text-align: center; }
              .status-badge { padding: 5px 10px; border-radius: 15px; color: white; }
              .status-active { background: #28a745; }
              .status-sold { background: #dc3545; }
              .status-pending { background: #ffc107; }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>Car Status Updated</h1>
              </div>
              <p>Your car listing <strong>${carName}</strong> status has been updated:</p>
              <p>From: <span class="status-badge status-${oldStatus}">${oldStatus}</span></p>
              <p>To: <span class="status-badge status-${newStatus}">${newStatus}</span></p>
          </div>
      </body>
      </html>
    `;
  }

  // CONTACT FORM EMAIL METHODS
  async sendContactConfirmation(contact) {
    const emailHtml = this.getConfirmationTemplate(contact);

    const mailOptions = {
      from: `"${process.env.FROM_NAME || 'Support'}" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
      to: contact.email,
      subject: 'Thank You for Contacting Us',
      html: emailHtml
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Contact confirmation email sent to ${contact.email}`);
    } catch (error) {
      console.error("Error sending contact confirmation email:", error);
      throw error;
    }
  }

  async sendAdminNotification(contact, adminEmails) {
    const mailOptions = {
      from: `"${process.env.FROM_NAME || 'Support'}" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
      to: adminEmails.join(','),
      subject: `New Contact Form Submission - ${contact.name}`,
      html: this.getAdminNotificationTemplate(contact)
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Admin notification sent for contact from ${contact.name}`);
    } catch (error) {
      console.error("Error sending admin notification:", error);
      throw error;
    }
  }

  async sendAdminReply(contact, replyMessage, adminName) {
    const mailOptions = {
      from: `"${adminName}" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
      to: contact.email,
      subject: `Re: Your Contact Form Submission`,
      html: this.getReplyTemplate(contact, replyMessage, adminName)
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Admin reply sent to ${contact.email}`);
    } catch (error) {
      console.error("Error sending admin reply:", error);
      throw error;
    }
  }

  // TESTIMONIAL EMAIL METHODS (NEW)
  async sendTestimonialEmail(userEmail, userName, content, rating) {
    try {
      const mailOptions = {
        from: `"${process.env.FROM_NAME || 'Support'}" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
        to: userEmail,
        subject: 'Thank You for Your Testimonial!',
        html: this.getTestimonialTemplate(userName, content, rating)
      };

      await this.transporter.sendMail(mailOptions);
      console.log('Testimonial email sent to user');
      
    } catch (error) {
      console.error('Error sending email to user:', error);
      throw error;
    }
  }

  async sendMonthlyStatsEmail(adminEmail, stats, month, year) {
    try {
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];

      const mailOptions = {
        from: `"${process.env.FROM_NAME || 'Support'}" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
        to: adminEmail,
        subject: `Monthly Testimonials Statistics - ${monthNames[month-1]} ${year}`,
        html: this.getMonthlyStatsTemplate(stats, month, year, monthNames)
      };

      await this.transporter.sendMail(mailOptions);
      console.log('Monthly statistics email sent to admin');
      
    } catch (error) {
      console.error('Error sending monthly stats email:', error);
      throw error;
    }
  }

  // NEW FEATURE NOTIFICATION METHODS
  async sendNewFeatureNotification(feature, adminUser) {
    const mailOptions = {
      from: `"${process.env.FROM_NAME || 'Car Features System'}" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
      to: process.env.ADMIN_EMAIL || adminUser.email,
      subject: `🚀 New Feature Added: ${feature.title}`,
      html: this.getNewFeatureTemplate(feature, adminUser)
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`New feature notification sent for: ${feature.title}`);
    } catch (error) {
      console.error("Error sending new feature notification:", error);
      throw error;
    }
  }

  // TEMPLATE METHODS
  getConfirmationTemplate(contact) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #007bff; color: white; padding: 20px; text-align: center; }
          .content { background: #f8f9fa; padding: 20px; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Thank You for Contacting Us!</h1>
          </div>
          <p>Dear ${contact.name},</p>
          <p>We've received your message and will get back to you within 24-48 hours.</p>
          <div class="content">
            <h3>Your Message Details:</h3>
            <p><strong>Interest:</strong> ${contact.interest || 'Not specified'}</p>
            <p><strong>Message:</strong> ${contact.message}</p>
          </div>
          <p>Best regards,<br>Support Team</p>
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getAdminNotificationTemplate(contact) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .alert { background: #d9534f; color: white; padding: 15px; text-align: center; }
          .content { background: #f8f9fa; padding: 20px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container>
          <div class="alert">
            <h2>New Contact Form Submission</h2>
          </div>
          <div class="content">
            <h3>Contact Details:</h3>
            <p><strong>Name:</strong> ${contact.name}</p>
            <p><strong>Email:</strong> ${contact.email}</p>
            <p><strong>Phone:</strong> ${contact.phone || 'Not provided'}</p>
            <p><strong>Interest:</strong> ${contact.interest || 'Not specified'}</p>
            <p><strong>Message:</strong> ${contact.message}</p>
            <p><strong>Submitted:</strong> ${new Date(contact.createdAt).toLocaleString()}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getReplyTemplate(contact, replyMessage, adminName) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #28a745; color: white; padding: 20px; text-align: center; }
          .response { background: #e9ecef; padding: 15px; margin: 20px 0; }
          .original { background: #f8f9fa; padding: 15px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Response to Your Inquiry</h2>
          </div>
          <p>Dear ${contact.name},</p>
          <p>Thank you for contacting us. Here's our response to your inquiry:</p>
          <div class="response">
            <p><strong>Our Response:</strong></p>
            <p>${replyMessage}</p>
          </div>
          <div class="original">
            <p><strong>Your Original Message:</strong></p>
            <p>${contact.message}</p>
          </div>
          <p>Best regards,<br>${adminName}<br>Support Team</p>
        </div>
      </body>
      </html>
    `;
  }

  // TESTIMONIAL TEMPLATE METHODS (NEW)
  getTestimonialTemplate(userName, content, rating) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #28a745; color: white; padding: 20px; text-align: center; }
          .content { background: #f8f9fa; padding: 20px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Thank You for Your Testimonial!</h1>
          </div>
          <h2>Thank You, ${userName}!</h2>
          <p>We appreciate you taking the time to share your experience with us.</p>
          <div class="content">
            <p><strong>Your Rating:</strong> ${'⭐'.repeat(rating)}</p>
            <p><strong>Your Message:</strong> "${content}"</p>
          </div>
          <p>Thank you for your feedback!</p>
          <p>Best regards,<br>Support Team</p>
        </div>
      </body>
      </html>
    `;
  }

  getMonthlyStatsTemplate(stats, month, year, monthNames) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #007bff; color: white; padding: 20px; text-align: center; }
          .stats { background: #f8f9fa; padding: 20px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Monthly Testimonials Report - ${monthNames[month-1]} ${year}</h1>
          </div>
          <h2>Monthly Testimonials Report - ${monthNames[month-1]} ${year}</h2>
          <div class="stats">
            <h3>Statistics Summary:</h3>
            <ul>
              <li><strong>Total Testimonials:</strong> ${stats.total}</li>
              <li><strong>Approved:</strong> ${stats.approved}</li>
              <li><strong>Pending Review:</strong> ${stats.pending}</li>
              <li><strong>Average Rating:</strong> ${stats.averageRating ? stats.averageRating.toFixed(1) : 0}/5</li>
            </ul>
            <p>This is an automated monthly statistics report.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // NEW FEATURE TEMPLATE METHOD
  getNewFeatureTemplate(feature, adminUser) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px; border-radius: 10px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; margin: -20px -20px 20px -20px; }
          .content { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
          .feature-info { background: #e8f5e8; padding: 15px; border-left: 4px solid #28a745; margin: 15px 0; }
          .stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin: 20px 0; }
          .stat-card { background: white; padding: 15px; border-radius: 5px; text-align: center; border: 1px solid #ddd; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚀 New Feature Added</h1>
            <p>A new car feature has been added to the system</p>
          </div>
          
          <div class="feature-info">
            <h2 style="margin-top: 0; color: #2c3e50;">${feature.title}</h2>
            <div class="stats">
              <div class="stat-card">
                <strong>Category</strong><br>
                <span style="color: #667eea; font-weight: bold;">${feature.category}</span>
              </div>
              <div class="stat-card">
                <strong>Status</strong><br>
                <span style="color: #28a745; font-weight: bold;">${feature.status}</span>
              </div>
            </div>
            <p><strong>Release Date:</strong> ${new Date(feature.releaseDate).toLocaleDateString()}</p>
          </div>
          
          <div class="content">
            <h3 style="color: #2c3e50;">📝 Description</h3>
            <p>${feature.description}</p>
            
            <h3 style="color: #2c3e50;">📖 Detailed Overview</h3>
            <p>${feature.longDescription}</p>
            
            ${feature.benefits && feature.benefits.length > 0 ? `
            <h3 style="color: #2c3e50;">✅ Benefits</h3>
            <ul>
              ${feature.benefits.map(benefit => `<li>${benefit}</li>`).join('')}
            </ul>
            ` : ''}
            
            ${feature.availableIn && feature.availableIn.length > 0 ? `
            <h3 style="color: #2c3e50;">🚗 Available In</h3>
            <ul>
              ${feature.availableIn.map(model => `<li>${model}</li>`).join('')}
            </ul>
            ` : ''}
          </div>
          
          <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin-top: 20px;">
            <p><strong>Added by:</strong> ${adminUser.name} (${adminUser.email})</p>
            <p><strong>Added on:</strong> ${new Date().toLocaleString()}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Test email configuration
  async testEmailConfig() {
    try {
      await this.transporter.verify();
      return { success: true, message: 'Email configuration is valid' };
    } catch (error) {
      return { success: false, message: 'Email configuration error: ' + error.message };
    }
  }

  // ORIGINAL USER MANAGEMENT EMAIL METHODS (UNCHANGED)
  async sendWelcomeEmail(user) {
    const mailOptions = {
      from: `"${process.env.FROM_NAME || 'Support'}" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
      to: user.email,
      subject: "🎉 Welcome to Our Community!",
      html: this.getWelcomeTemplate(user),
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Welcome email sent to ${user.email}`);
    } catch (error) {
      console.error("Error sending welcome email:", error);
      throw error;
    }
  }

  async sendNewUserNotificationToAdmin(user, adminEmail) {
    const mailOptions = {
      from: `"${process.env.FROM_NAME || 'Support'}" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
      to: adminEmail,
      subject: "👤 New User Registration",
      html: this.getNewUserNotificationTemplate(user),
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`New user notification sent to admin`);
    } catch (error) {
      console.error("Error sending admin notification:", error);
      throw error;
    }
  }

  async sendMonthlyReportToAdmin(adminEmail, reportData) {
    const mailOptions = {
      from: `"${process.env.FROM_NAME || 'Support'}" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
      to: adminEmail,
      subject: `📊 Monthly User Activity Report - ${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}`,
      html: this.getMonthlyReportTemplate(reportData),
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Monthly report sent to admin`);
    } catch (error) {
      console.error("Error sending monthly report:", error);
      throw error;
    }
  }

  async sendEmailChangeNotification(user, oldEmail) {
    const mailOptions = {
      from: `"${process.env.FROM_NAME || 'Support'}" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
      to: oldEmail,
      subject: "📧 Email Address Changed",
      html: this.getEmailChangeTemplate(user, oldEmail),
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Email change notification sent to ${oldEmail}`);
    } catch (error) {
      console.error("Error sending email change notification:", error);
      throw error;
    }
  }

  async sendPasswordChangeNotification(user) {
    const mailOptions = {
      from: `"${process.env.FROM_NAME || 'Support'}" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
      to: user.email,
      subject: "🔒 Password Changed Successfully",
      html: this.getPasswordChangeTemplate(user),
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Password change notification sent to ${user.email}`);
    } catch (error) {
      console.error("Error sending password change notification:", error);
      throw error;
    }
  }

  // ORIGINAL TEMPLATE GENERATORS (UNCHANGED)
  getWelcomeTemplate(user) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333; text-align: center;">Welcome to Our Community, ${user.name}! 🎉</h2>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 10px;">
          <p style="color: #555; line-height: 1.6;">
            We're thrilled to have you on board! Your account has been successfully created.
          </p>
          <p style="color: #555; line-height: 1.6;">
            <strong>Account Details:</strong><br>
            Name: ${user.name}<br>
            Email: ${user.email}<br>
            Phone: ${user.phone}<br>
            Join Date: ${new Date(user.createdAt).toLocaleDateString()}
          </p>
          <p style="color: #555; line-height: 1.6;">
            If you have any questions, feel free to reach out to our support team.
          </p>
        </div>
        <div style="text-align: center; margin-top: 20px;">
        </div>
      </div>
    `;
  }

  getNewUserNotificationTemplate(user) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h3 style="color: #333;">New User Registration 👤</h3>
        <div style="background: #fff3cd; padding: 15px; border-radius: 5px; border-left: 4px solid #ffc107;">
          <p><strong>New user joined the platform:</strong></p>
          <ul style="color: #856404;">
            <li><strong>Name:</strong> ${user.name}</li>
            <li><strong>Email:</strong> ${user.email}</li>
            <li><strong>Phone:</strong> ${user.phone}</li>
            <li><strong>Registration Date:</strong> ${new Date(user.createdAt).toLocaleString()}</li>
          </ul>
        </div>
      </div>
    `;
  }

  getMonthlyReportTemplate(reportData) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
        <h2 style="color: #333; text-align: center;">📊 Monthly Activity Report</h2>
        <div style="background: #e7f3ff; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
          <h3 style="color: #0056b3;">Platform Overview</h3>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
            <div style="background: white; padding: 15px; border-radius: 5px; text-align: center;">
              <h4 style="margin: 0; color: #28a745;">${reportData.totalUsers}</h4>
              <p style="margin: 5px 0 0 0; color: #666;">Total Users</p>
            </div>
            <div style="background: white; padding: 15px; border-radius: 5px; text-align: center;">
              <h4 style="margin: 0; color: #17a2b8;">${reportData.newUsersThisMonth}</h4>
              <p style="margin: 5px 0 0 0; color: #666;">New Users This Month</p>
            </div>
            <div style="background: white; padding: 15px; border-radius: 5px; text-align: center;">
              <h4 style="margin: 0; color: #ffc107;">${reportData.activeUsersThisMonth}</h4>
              <p style="margin: 5px 0 0 0; color: #666;">Active Users</p>
            </div>
            <div style="background: white; padding: 15px; border-radius: 5px; text-align: center;">
              <h4 style="margin: 0; color: #dc3545;">${reportData.totalLogins}</h4>
              <p style="margin: 5px 0 0 0; color: #666;">Total Logins</p>
            </div>
          </div>
        </div>
        
        ${reportData.recentUsers && reportData.recentUsers.length > 0 ? `
        <div style="background: #f8f9fa; padding: 15px; border-radius: 5px;">
          <h4 style="color: #495057;">Recent Registrations</h4>
          <ul style="color: #6c757d;">
            ${reportData.recentUsers.map(user => `
              <li>${user.name} (${user.email}) - ${new Date(user.createdAt).toLocaleDateString()}</li>
            `).join('')}
          </ul>
        </div>
        ` : ''}
        
        <p style="color: #6c757d; font-size: 14px; text-align: center; margin-top: 20px;">
          Report generated on ${new Date().toLocaleString()}
        </p>
      </div>
    `;
  }

  getEmailChangeTemplate(user, oldEmail) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h3 style="color: #333;">Email Address Changed 📧</h3>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 10px;">
          <p style="color: #555;">Hello,</p>
          <p style="color: #555;">
            This is to confirm that the email address associated with your account has been changed.
          </p>
          <div style="background: #fff; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <p style="margin: 5px 0;"><strong>Old Email:</strong> ${oldEmail}</p>
            <p style="margin: 5px 0;"><strong>New Email:</strong> ${user.email}</p>
            <p style="margin: 5px 0;"><strong>Change Date:</strong> ${new Date().toLocaleString()}</p>
          </div>
          <p style="color: #555;">
            If you did not make this change, please contact our support team immediately.
          </p>
        </div>
      </div>
    `;
  }

  getPasswordChangeTemplate(user) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h3 style="color: #333;">Password Updated Successfully 🔒</h3>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 10px;">
          <p style="color: #555;">Hello ${user.name},</p>
          <p style="color: #555;">
            This is to confirm that your password was successfully changed on ${new Date().toLocaleString()}.
          </p>
          <div style="background: #d4edda; color: #155724; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <p style="margin: 0;">✅ Your account security has been updated successfully.</p>
          </div>
          <p style="color: #555;">
            If you did not make this change, please contact our support team immediately to secure your account.
          </p>
        </div>
      </div>
    `;
  }
}

module.exports = EmailService;