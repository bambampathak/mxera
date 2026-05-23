const mongoose = require('mongoose');

const savedAddressSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  label: { type: String, default: 'Home' },
  customer_name: { type: String, default: '' },
  customer_email: { type: String, default: '' },
  address: { type: String, default: '' },
  house_no: { type: String, default: '' },
  street: { type: String, default: '' },
  locality: { type: String, default: '' },
  city: { type: String, default: '' },
  state: { type: String, default: '' },
  pincode: { type: String, default: '' },
  landmark: { type: String, default: '' },
  phone: { type: String, default: '' },
  is_default: { type: Number, default: 0 }
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

// Compound index for deduplication
savedAddressSchema.index({ user_id: 1, address: 1, city: 1, pincode: 1 }, { unique: true, partialFilterExpression: { address: { $ne: '' }, city: { $ne: '' }, pincode: { $ne: '' } } });

module.exports = mongoose.model('SavedAddress', savedAddressSchema);