const mongoose = require('mongoose');

const wishlistSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  session_id: { type: String, default: null, index: true },
  product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true }
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

module.exports = mongoose.model('Wishlist', wishlistSchema);