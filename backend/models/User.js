const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  phone: { type: String, default: '' },
  gender: { type: String, enum: ['male', 'female', 'other'], default: 'other' },
  address: { type: String, default: '' }
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

module.exports = mongoose.model('User', userSchema);