const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  tag: { type: String, default: null },
  description: { type: String, default: null },
  price: { type: Number, required: true, min: 0 },
  original_price: { type: Number, default: null },
  rating: { type: Number, default: 4.5, min: 0 },
  reviews: { type: Number, default: 0, min: 0 },
  badge: { type: String, default: null },
  image: { type: String, default: null },
  images: { type: String, default: null },
  category: { type: String, required: true, trim: true },
  stock: { type: Number, default: 100, min: 0 },
  out_of_stock: { type: Number, default: 0 },
  specifications: { type: String, default: null },
  colors: { type: String, default: null },
  sizes: { type: String, default: null }
}, { timestamps: { createdAt: 'created_at', updatedAt: false }, toJSON: { virtuals: true } });

module.exports = mongoose.model('Product', productSchema);