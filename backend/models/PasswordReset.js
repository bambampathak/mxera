const mongoose = require('mongoose');

const passwordResetSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  token: { type: String, required: true, index: true },
  expires_at: { type: Number, required: true }
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

module.exports = mongoose.model('PasswordReset', passwordResetSchema);