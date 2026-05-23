const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  session_id: { type: String, default: null, index: true },
  product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, default: 1, min: 1 },
  product_color: { type: String, default: '' },
  product_color_image: { type: String, default: '' },
  product_size: { type: String, default: '' }
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

module.exports = mongoose.model('Cart', cartSchema);