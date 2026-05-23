const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  idempotency_key: { type: String, default: null, unique: true, sparse: true },
  customer_name: { type: String, default: '' },
  customer_email: { type: String, default: '' },
  customer_phone: { type: String, default: '' },
  payment_method: { type: String, default: 'cod' },
  payment_status: { type: String, default: 'pending' },
  total_amount: { type: Number, required: true, min: 0 },
  status: { type: String, default: 'pending' },
  delivery_address: { type: String, default: '' }
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

module.exports = mongoose.model('Order', orderSchema);