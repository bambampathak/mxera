const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  order_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
  product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  product_name: { type: String, default: '' },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true, min: 0 },
  product_color: { type: String, default: '' },
  product_color_image: { type: String, default: '' },
  product_size: { type: String, default: '' }
}, { timestamps: false });

module.exports = mongoose.model('OrderItem', orderItemSchema);