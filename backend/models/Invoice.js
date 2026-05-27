const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  invoice_number: { type: String, required: true, unique: true, index: true },
  order_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },

  // Customer details (snapshot from order)
  customer_name: { type: String, default: '' },
  customer_email: { type: String, default: '' },
  customer_phone: { type: String, default: '' },
  delivery_address: { type: String, default: '' },

  // Order snapshot
  payment_method: { type: String, default: 'cod' },
  payment_status: { type: String, default: 'pending' },
  order_status: { type: String, default: 'pending' },
  total_amount: { type: Number, required: true, min: 0 },

  // Invoice metadata
  invoice_date: { type: Date, default: Date.now },
  due_date: { type: Date },
  notes: { type: String, default: '' },
  terms: { type: String, default: 'Thank you for your business.' },

  // Company info (snapshot at time of generation)
  company_name: { type: String, default: 'MXERA' },
  company_address: { type: String, default: '' },
  company_email: { type: String, default: '' },
  company_phone: { type: String, default: '' },
  company_gst: { type: String, default: '' },

  // Items snapshot
  items: [{
    product_name: { type: String, default: '' },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    product_color: { type: String, default: '' },
    product_size: { type: String, default: '' }
  }],

  // Subtotal, tax, grand total
  subtotal: { type: Number, default: 0 },
  tax_percentage: { type: Number, default: 0 },
  tax_amount: { type: Number, default: 0 },
  grand_total: { type: Number, default: 0 }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = mongoose.model('Invoice', invoiceSchema);