const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

class StripeService {
  // Create a Stripe customer
  async createStripeCustomer(customerData) {
    try {
      const stripeCustomer = await stripe.customers.create({
        name: customerData.name,
        email: customerData.email,
        phone: customerData.phone,
        metadata: {
          mongodb_id: customerData._id.toString(),
          phone: customerData.phone,
        },
      });

      return stripeCustomer;
    } catch (error) {
      console.error("Error creating Stripe customer:", error);
      throw new Error(`Stripe customer creation failed: ${error.message}`);
    }
  }

  // Create payment intent
  async createPaymentIntent(amount, currency, customerId, metadata = {}) {
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: currency.toLowerCase(),
        customer: customerId,
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: {
          ...metadata,
          created_at: new Date().toISOString(),
        },
      });

      return paymentIntent;
    } catch (error) {
      console.error("Error creating payment intent:", error);
      throw new Error(`Payment intent creation failed: ${error.message}`);
    }
  }

  // Confirm payment intent
  async confirmPaymentIntent(paymentIntentId, paymentMethodId) {
    try {
      const paymentIntent = await stripe.paymentIntents.confirm(
        paymentIntentId,
        { payment_method: paymentMethodId }
      );

      return paymentIntent;
    } catch (error) {
      console.error("Error confirming payment intent:", error);
      throw new Error(`Payment confirmation failed: ${error.message}`);
    }
  }

  // Create setup intent for future payments
  async createSetupIntent(customerId) {
    try {
      const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ["card"],
      });

      return setupIntent;
    } catch (error) {
      console.error("Error creating setup intent:", error);
      throw new Error(`Setup intent creation failed: ${error.message}`);
    }
  }

  // Create subscription
  async createSubscription(customerId, priceId, metadata = {}) {
    try {
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: "default_incomplete",
        payment_settings: { save_default_payment_method: "on_subscription" },
        expand: ["latest_invoice.payment_intent"],
        metadata,
      });

      return subscription;
    } catch (error) {
      console.error("Error creating subscription:", error);
      throw new Error(`Subscription creation failed: ${error.message}`);
    }
  }

  // Retrieve payment intent
  async retrievePaymentIntent(paymentIntentId) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(
        paymentIntentId
      );
      return paymentIntent;
    } catch (error) {
      console.error("Error retrieving payment intent:", error);
      throw new Error(`Payment intent retrieval failed: ${error.message}`);
    }
  }

  // Refund payment
  async createRefund(paymentIntentId, amount = null) {
    try {
      const refundParams = { payment_intent: paymentIntentId };
      if (amount) {
        refundParams.amount = Math.round(amount * 100);
      }

      const refund = await stripe.refunds.create(refundParams);
      return refund;
    } catch (error) {
      console.error("Error creating refund:", error);
      throw new Error(`Refund creation failed: ${error.message}`);
    }
  }

  // Get customer's payment methods
  async getCustomerPaymentMethods(customerId) {
    try {
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type: "card",
      });

      return paymentMethods;
    } catch (error) {
      console.error("Error retrieving payment methods:", error);
      throw new Error(`Payment methods retrieval failed: ${error.message}`);
    }
  }

  // Create invoice
  async createInvoice(customerId, items, metadata = {}) {
    try {
      const invoice = await stripe.invoices.create({
        customer: customerId,
        collection_method: "send_invoice",
        days_until_due: 30,
        metadata,
      });

      // Add invoice items
      for (const item of items) {
        await stripe.invoiceItems.create({
          customer: customerId,
          invoice: invoice.id,
          amount: Math.round(item.amount * 100),
          currency: item.currency || "usd",
          description: item.description,
        });
      }

      // Finalize and send invoice
      const finalizedInvoice = await stripe.invoices.finalizeInvoice(
        invoice.id
      );
      const sentInvoice = await stripe.invoices.sendInvoice(
        finalizedInvoice.id
      );

      return sentInvoice;
    } catch (error) {
      console.error("Error creating invoice:", error);
      throw new Error(`Invoice creation failed: ${error.message}`);
    }
  }

  // Handle webhook events
  async handleWebhookEvent(payload, signature) {
    try {
      const event = stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );

      return event;
    } catch (error) {
      console.error("Webhook signature verification failed:", error);
      throw new Error(`Webhook error: ${error.message}`);
    }
  }

  // Get Stripe customer by ID
  async getStripeCustomer(customerId) {
    try {
      const customer = await stripe.customers.retrieve(customerId);
      return customer;
    } catch (error) {
      console.error("Error retrieving Stripe customer:", error);
      throw new Error(`Customer retrieval failed: ${error.message}`);
    }
  }

  // Update Stripe customer
  async updateStripeCustomer(customerId, updateData) {
    try {
      const stripeCustomer = await stripe.customers.update(
        customerId,
        updateData
      );
      return stripeCustomer;
    } catch (error) {
      console.error("Error updating Stripe customer:", error);
      throw new Error(`Stripe customer update failed: ${error.message}`);
    }
  }

  // Delete Stripe customer
  async deleteStripeCustomer(customerId) {
    try {
      const deletedCustomer = await stripe.customers.del(customerId);
      return deletedCustomer;
    } catch (error) {
      console.error("Error deleting Stripe customer:", error);
      throw new Error(`Stripe customer deletion failed: ${error.message}`);
    }
  }

  // Create refund with reason
  async createRefund(paymentIntentId, amount = null, reason = null) {
    try {
      const refundParams = { payment_intent: paymentIntentId };
      if (amount) refundParams.amount = Math.round(amount * 100);
      if (reason) refundParams.reason = reason;

      const refund = await stripe.refunds.create(refundParams);
      return refund;
    } catch (error) {
      console.error("Error creating refund:", error);
      throw new Error(`Refund creation failed: ${error.message}`);
    }
  }
}

module.exports = new StripeService();
