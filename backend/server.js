require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const mongoose = require('mongoose');
const cors = require('cors');
const compression = require('compression');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const nodemailer = require('nodemailer');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Mongoose Models
const User = require('./models/User');
const Product = require('./models/Product');
const Cart = require('./models/Cart');
const Wishlist = require('./models/Wishlist');
const Order = require('./models/Order');
const OrderItem = require('./models/OrderItem');
const PasswordReset = require('./models/PasswordReset');
const SavedAddress = require('./models/SavedAddress');

// Multer configuration for file uploads
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|svg/;
    const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = allowed.test(file.mimetype.split('/')[1]);
    cb(null, extOk && mimeOk);
  }
});

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'mxera_secret_key_2024';
const ADMIN_BOOTSTRAP_EMAIL = String(process.env.ADMIN_BOOTSTRAP_EMAIL || '').trim().toLowerCase();
const ADMIN_EMAILS = [
  ...(process.env.ADMIN_EMAILS || process.env.EMAIL_ADMIN || process.env.EMAIL_USER || '').split(','),
  ADMIN_BOOTSTRAP_EMAIL
]
  .map(email => email.trim().toLowerCase())
  .filter((email, index, emails) => email && emails.indexOf(email) === index);

// Middleware
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files with caching headers for Lighthouse performance
const oneYear = 365 * 24 * 60 * 60 * 1000;
app.use(express.static(path.join(__dirname, '..', 'frontend'), {
  maxAge: oneYear,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    } else if (filePath.endsWith('.css') || filePath.endsWith('.js')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (filePath.match(/\.(png|jpg|jpeg|gif|ico|svg|webp|avif)$/i)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (filePath.endsWith('.woff2')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));
app.use(express.static(path.join(__dirname, '..', 'admin'), {
  maxAge: oneYear,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.css') || filePath.endsWith('.js')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));
app.use(session({
  secret: JWT_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mxera';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch(err => console.error('MongoDB Connection Error:', err.message));

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.example.com',
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER || 'user@example.com',
    pass: process.env.EMAIL_PASS || 'password'
  }
});

// Helper to validate ObjectId values
const isValidObjectId = (id) => {
  try {
    return mongoose.Types.ObjectId.isValid(String(id));
  } catch (e) {
    return false;
  }
};

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&')
  .replace(/</g, '<')
  .replace(/>/g, '>')
  .replace(/"/g, '"')
  .replace(/'/g, '&#39;');

const formatOrderAmount = (value) => `INR ${Number(value || 0).toLocaleString('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})}`;

const renderOrderItemsEmail = (items) => items.map(item => {
  const productImageHtml = item.image
    ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name || '')}" style="width:60px;height:60px;object-fit:cover;border-radius:4px;vertical-align:middle;margin-right:8px;">`
    : '';
  const colorHtml = item.product_color
    ? `<br><small style="color:#888;">Color: ${escapeHtml(item.product_color)}</small>`
    : '';
  const colorImageHtml = item.product_color_image
    ? `<img src="${escapeHtml(item.product_color_image)}" alt="${escapeHtml(item.product_color || '')}" style="width:20px;height:20px;border-radius:4px;vertical-align:middle;margin-left:4px;">`
    : '';
  const sizeHtml = item.product_size
    ? `<br><small style="color:#888;">Size: ${escapeHtml(item.product_size)}</small>`
    : '';
  return `
  <tr>
    <td style="padding:8px;border-bottom:1px solid #ddd;">
      ${productImageHtml}${escapeHtml(item.name || `Product #${item.product_id}`)}${colorImageHtml}${colorHtml}${sizeHtml}
    </td>
    <td style="padding:8px;border-bottom:1px solid #ddd;text-align:center;">${escapeHtml(item.quantity)}</td>
    <td style="padding:8px;border-bottom:1px solid #ddd;text-align:right;">${formatOrderAmount(item.price)}</td>
  </tr>
`;
}).join('');

transporter.verify((error, success) => {
  if (error) {
    console.error('SMTP configuration error:', error.message);
  } else {
    console.log('SMTP transporter is ready');
  }
});

const otpStore = {};

// Sample product data
const sampleProducts = [
  { name: "Stealth Cooling Jacket", tag: "MXERA PERFORMANCE", description: "Temperature adaptive smart fabric engineered for high-intensity mobility.", price: 4999, original_price: 6999, rating: 4.9, reviews: 234, badge: "HOT", image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=1600&auto=format&fit=crop", category: "clothing" },
  { name: "Anti-Loss Tracker Pro", tag: "SMART TECH", description: "Ultra compact encrypted tracking system with real-time sync technology.", price: 1499, original_price: 2499, rating: 4.7, reviews: 156, badge: "NEW", image: "https://images.unsplash.com/photo-1511499767150-a48a237f0083?q=80&w=1600&auto=format&fit=crop", category: "tech" },
  { name: "Riding Chest Rig X", tag: "TACTICAL SERIES", description: "Lightweight tactical storage platform optimized for urban riders.", price: 2899, original_price: 3999, rating: 4.8, reviews: 89, badge: "LIMITED", image: "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?q=80&w=1600&auto=format&fit=crop", category: "gear" },
  { name: "Phantom Smart Watch", tag: "Wearable Tech", description: "Advanced biometric monitoring with holographic display interface.", price: 8999, original_price: 12999, rating: 4.9, reviews: 412, badge: "BEST", image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=1600&auto=format&fit=crop", category: "tech" },
  { name: "Stealth Runner Pro", tag: "ATHLETIC", description: "Zero-gravity cushioning with adaptive strike technology.", price: 5999, original_price: 8999, rating: 4.8, reviews: 321, badge: "SALE", image: "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?q=80&w=1600&auto=format&fit=crop", category: "clothing" },
  { name: "Urban Messenger Bag", tag: "TACTICAL SERIES", description: "Water-resistant modular design with anti-theft protection.", price: 3499, original_price: 4999, rating: 4.6, reviews: 178, badge: null, image: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?q=80&w=1600&auto=format&fit=crop", category: "gear" },
  { name: "Quantum Headphones", tag: "AUDIO", description: "Premium noise-cancelling with spatial audio technology.", price: 7999, original_price: 9999, rating: 4.9, reviews: 567, badge: "HOT", image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=1600&auto=format&fit=crop", category: "tech" },
  { name: "Titanium Frame Sunglasses", tag: "ACCESSORIES", description: "Ultra-lightweight titanium frames with polarized lenses.", price: 2499, original_price: 3999, rating: 4.7, reviews: 198, badge: "SALE", image: "https://images.unsplash.com/photo-1572635196237-14b3f281503f?q=80&w=1600&auto=format&fit=crop", category: "gear" }
];

// Initialize Database — seed sample products and bootstrap admin
async function initDatabase() {
  try {
    // Seed sample products if the collection is empty
    const productCount = await Product.countDocuments();
    if (productCount === 0) {
      await Product.insertMany(sampleProducts);
      console.log('Sample products inserted');
    }

    // Bootstrap admin user
    if (ADMIN_BOOTSTRAP_EMAIL && process.env.ADMIN_BOOTSTRAP_PASSWORD) {
      const existingAdmin = await User.findOne({ email: ADMIN_BOOTSTRAP_EMAIL });
      if (!existingAdmin) {
        const adminName = String(process.env.ADMIN_BOOTSTRAP_NAME || 'MXERA Admin').trim() || 'MXERA Admin';
        const hashedPassword = await bcrypt.hash(process.env.ADMIN_BOOTSTRAP_PASSWORD, 10);
        await User.create({ name: adminName, email: ADMIN_BOOTSTRAP_EMAIL, password: hashedPassword, gender: 'other' });
        console.log(`Bootstrap admin created for ${ADMIN_BOOTSTRAP_EMAIL}`);
      }
    }
  } catch (err) {
    console.error('Database initialization error:', err.message);
  }
}

// Auth Middleware
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

const optionalAuth = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return next();

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (!err) req.user = user;
    next();
  });
};

const requireAdmin = (req, res, next) => authenticateToken(req, res, () => {
  const email = String(req.user?.email || '').toLowerCase();
  if (!ADMIN_EMAILS.length) {
    return res.status(503).json({ error: 'Admin access is not configured. Set ADMIN_EMAILS.' });
  }
  if (!ADMIN_EMAILS.includes(email)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
});

const mergeSessionCartToUser = async (sessionId, userId) => {
  if (!sessionId || !userId) return;

  const sessionCartItems = await Cart.find({ session_id: sessionId, user_id: null });
  for (const item of sessionCartItems) {
    const existing = await Cart.findOne({
      user_id: userId,
      product_id: item.product_id,
      product_color: item.product_color || '',
      product_size: item.product_size || ''
    });
    if (existing) {
      existing.quantity += item.quantity;
      await existing.save();
      await Cart.deleteOne({ _id: item._id });
    } else {
      item.user_id = userId;
      item.session_id = undefined;
      await item.save();
    }
  }
};

const mergeSessionWishlistToUser = async (sessionId, userId) => {
  if (!sessionId || !userId) return;

  const sessionWishlistItems = await Wishlist.find({ session_id: sessionId, user_id: null });
  for (const item of sessionWishlistItems) {
    const existing = await Wishlist.findOne({ user_id: userId, product_id: item.product_id });
    if (existing) {
      await Wishlist.deleteOne({ _id: item._id });
    } else {
      item.user_id = userId;
      item.session_id = undefined;
      await item.save();
    }
  }
};

const mergeSessionToUser = async (sessionId, userId) => {
  await mergeSessionCartToUser(sessionId, userId);
  await mergeSessionWishlistToUser(sessionId, userId);
};

// ============ API ROUTES ============

// Get all products
app.get('/api/products', async (req, res) => {
  try {
    const { category, search } = req.query;
    const filter = {};

    if (category && category !== 'all') {
      filter.category = category;
    }

    if (search) {
      const regex = new RegExp(search, 'i');
      filter.$or = [
        { name: regex },
        { tag: regex },
        { description: regex }
      ];
    }

    const products = await Product.find(filter).sort({ created_at: -1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single product
app.get('/api/products/:id', async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid product id' });
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const normalizeProductInput = (body) => ({
  name: String(body.name || '').trim(),
  tag: String(body.tag || '').trim() || null,
  description: String(body.description || '').trim() || null,
  price: Number(body.price),
  original_price: body.original_price === '' || body.original_price == null ? null : Number(body.original_price),
  rating: body.rating === '' || body.rating == null ? 4.5 : Number(body.rating),
  reviews: body.reviews === '' || body.reviews == null ? 0 : Number(body.reviews),
  badge: String(body.badge || '').trim() || null,
  image: String(body.image || '').trim() || null,
  category: String(body.category || '').trim(),
  stock: body.stock === '' || body.stock == null ? 0 : Number(body.stock),
  specifications: body.specifications ? (typeof body.specifications === 'string' ? body.specifications : JSON.stringify(body.specifications)) : null,
  colors: body.colors ? (typeof body.colors === 'string' ? body.colors : JSON.stringify(body.colors)) : null,
  sizes: body.sizes ? (typeof body.sizes === 'string' ? body.sizes : JSON.stringify(body.sizes)) : null,
  images: body.images ? (typeof body.images === 'string' ? body.images : JSON.stringify(body.images)) : null,
  out_of_stock: body.out_of_stock ? 1 : 0
});

const validateProductInput = (product) => {
  if (!product.name || !product.category || !Number.isFinite(product.price) || product.price < 0) {
    return 'Name, category, and a valid price are required';
  }
  if (
    (product.original_price != null && (!Number.isFinite(product.original_price) || product.original_price < 0)) ||
    !Number.isFinite(product.rating) ||
    product.rating < 0 ||
    !Number.isFinite(product.reviews) ||
    product.reviews < 0 ||
    !Number.isFinite(product.stock) ||
    product.stock < 0
  ) {
    return 'Product price, rating, reviews, and stock must be valid non-negative numbers';
  }
  return '';
};

app.get('/api/admin/summary', requireAdmin, async (req, res) => {
  try {
    const productCount = await Product.countDocuments();
    const products = await Product.find({}, { stock: 1 });
    const unitsInStock = products.reduce((sum, p) => sum + (p.stock || 0), 0);
    const lowStockCount = products.filter(p => p.stock <= 10).length;

    const orderCount = await Order.countDocuments();
    const openOrders = await Order.countDocuments({ status: { $in: ['pending', 'processing'] } });
    const nonCancelledOrders = await Order.find({ status: { $ne: 'cancelled' } }, { total_amount: 1 });
    const grossSales = nonCancelledOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const paidOrders = await Order.find({ payment_status: 'paid' }, { total_amount: 1 });
    const paidSales = paidOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);

    let customerCount;
    if (ADMIN_EMAILS.length) {
      customerCount = await User.countDocuments({ email: { $nin: ADMIN_EMAILS.map(e => new RegExp(`^${e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')) } });
    } else {
      customerCount = await User.countDocuments();
    }

    const savedAddressesCount = await SavedAddress.countDocuments();

    res.json({
      product_count: productCount,
      units_in_stock: unitsInStock,
      low_stock_count: lowStockCount,
      order_count: orderCount,
      open_orders: openOrders,
      gross_sales: grossSales,
      paid_sales: paidSales,
      customer_count: customerCount,
      saved_addresses_count: savedAddressesCount
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/products', requireAdmin, async (req, res) => {
  try {
    const products = await Product.find().sort({ created_at: -1, _id: -1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/products', requireAdmin, async (req, res) => {
  const product = normalizeProductInput(req.body);
  const validationError = validateProductInput(product);
  if (validationError) return res.status(400).json({ error: validationError });

  try {
    const created = await Product.create(product);
    res.status(201).json(created);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/products/:id', requireAdmin, async (req, res) => {
  const product = normalizeProductInput(req.body);
  const validationError = validateProductInput(product);
  if (validationError) return res.status(400).json({ error: validationError });

  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid product id' });
    const updated = await Product.findByIdAndUpdate(req.params.id, product, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ error: 'Product not found' });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/admin/products/:id', requireAdmin, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid product id' });
    // Check if product is referenced in orders before deleting
    const orderItemCount = await OrderItem.countDocuments({ product_id: req.params.id });
    if (orderItemCount > 0) {
      return res.status(409).json({ error: 'This product is used by orders and cannot be deleted' });
    }
    const result = await Product.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ error: 'Product not found' });
    res.json({ message: 'Product deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/orders', requireAdmin, async (req, res) => {
  try {
    const orders = await Order.aggregate([
      {
        $lookup: {
          from: 'orderitems',
          localField: '_id',
          foreignField: 'order_id',
          as: 'items'
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'user_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          customer_name_display: { $ifNull: ['$customer_name', { $ifNull: ['$user.name', 'Guest'] }] },
          customer_email_display: { $ifNull: ['$customer_email', { $ifNull: ['$user.email', ''] }] },
          customer_phone_display: { $ifNull: ['$customer_phone', { $ifNull: ['$user.phone', ''] }] }
        }
      },
      {
        $project: {
          _id: 1,
          id: '$_id',
          total_amount: 1,
          status: 1,
          payment_method: 1,
          payment_status: 1,
          delivery_address: 1,
          created_at: 1,
          customer_name: '$customer_name_display',
          customer_email: '$customer_email_display',
          customer_phone: '$customer_phone_display',
          items: 1
        }
      },
      { $sort: { created_at: -1, _id: -1 } },
      { $limit: 250 }
    ]);

    // Enrich items with product names
    const enrichedOrders = await Promise.all(orders.map(async (order) => {
      const enrichedItems = await Promise.all(order.items.map(async (item) => {
        let productName = item.product_name;
        if (!productName) {
          const product = await Product.findById(item.product_id).select('name');
          productName = product ? product.name : `Product #${item.product_id}`;
        }
        return {
          product_id: item.product_id,
          product_name: productName,
          quantity: item.quantity,
          price: item.price,
          product_color: item.product_color || '',
          product_color_image: item.product_color_image || '',
          product_size: item.product_size || ''
        };
      }));
      return { ...order, items: enrichedItems };
    }));

    res.json(enrichedOrders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete all orders (admin only)
app.delete('/api/admin/orders', requireAdmin, async (req, res) => {
  try {
    await OrderItem.deleteMany({});
    await Order.deleteMany({});
    res.json({ message: 'All orders have been deleted.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/admin/orders/:id', requireAdmin, async (req, res) => {
  const allowedOrderStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
  const allowedPaymentStatuses = ['pending', 'awaiting', 'paid', 'failed', 'refunded'];
  const update = {};

  if (req.body.status != null) {
    if (!allowedOrderStatuses.includes(req.body.status)) {
      return res.status(400).json({ error: 'Invalid order status' });
    }
    update.status = req.body.status;
  }
  if (req.body.payment_status != null) {
    if (!allowedPaymentStatuses.includes(req.body.payment_status)) {
      return res.status(400).json({ error: 'Invalid payment status' });
    }
    update.payment_status = req.body.payment_status;
  }
  if (req.body.customer_name != null) {
    update.customer_name = String(req.body.customer_name).trim();
  }
  if (req.body.customer_email != null) {
    update.customer_email = String(req.body.customer_email).trim();
  }
  if (req.body.customer_phone != null) {
    update.customer_phone = String(req.body.customer_phone).trim();
  }
  if (req.body.delivery_address != null) {
    update.delivery_address = String(req.body.delivery_address).trim();
  }
  if (!Object.keys(update).length) {
    return res.status(400).json({ error: 'No order fields to update' });
  }

  try {
    const updated = await Order.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!updated) return res.status(404).json({ error: 'Order not found' });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// File upload endpoint (admin only)
app.post('/api/admin/upload', requireAdmin, upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ url: fileUrl, filename: req.file.filename });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: List all saved addresses
app.get('/api/admin/saved-addresses', requireAdmin, async (req, res) => {
  try {
    const addresses = await SavedAddress.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'user_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          user_name: '$user.name',
          user_email: '$user.email'
        }
      },
      { $project: { user: 0 } },
      { $sort: { created_at: -1 } }
    ]);
    res.json(addresses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Delete ALL saved addresses
app.delete('/api/admin/saved-addresses', requireAdmin, async (req, res) => {
  try {
    const result = await SavedAddress.deleteMany({});
    res.json({ message: 'All saved addresses deleted', count: result.deletedCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Saved Addresses CRUD
app.get('/api/saved-addresses', authenticateToken, async (req, res) => {
  try {
    const addresses = await SavedAddress.find({ user_id: req.user.id }).sort({ is_default: -1, created_at: -1 });
    res.json(addresses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete ALL saved addresses for the current user
app.delete('/api/saved-addresses', authenticateToken, async (req, res) => {
  try {
    const result = await SavedAddress.deleteMany({ user_id: req.user.id });
    res.json({ message: 'All saved addresses deleted', count: result.deletedCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/saved-addresses', authenticateToken, async (req, res) => {
  const { label, address, house_no, street, locality, city, pincode, landmark, phone, is_default, customer_name, customer_email, state } = req.body;
  if (!address && !house_no) return res.status(400).json({ error: 'Address or house number is required' });
  if (!pincode) return res.status(400).json({ error: 'PIN code is required' });
  if (!city) return res.status(400).json({ error: 'City is required' });

  try {
    if (is_default) {
      await SavedAddress.updateMany({ user_id: req.user.id }, { is_default: 0 });
    }

    // Check for duplicate
    const existing = await SavedAddress.findOne({
      user_id: req.user.id,
      address: address || '',
      city: city,
      pincode: pincode
    });

    if (existing) {
      // Update existing record with new fields
      const updateFields = {};
      if (label) updateFields.label = label;
      if (is_default) updateFields.is_default = 1;
      if (customer_name) updateFields.customer_name = customer_name;
      if (customer_email) updateFields.customer_email = customer_email;
      if (state) updateFields.state = state;
      if (house_no) updateFields.house_no = house_no;
      if (street) updateFields.street = street;
      if (locality) updateFields.locality = locality;
      if (landmark) updateFields.landmark = landmark;
      if (phone) updateFields.phone = phone;
      if (Object.keys(updateFields).length > 0) {
        await SavedAddress.updateOne({ _id: existing._id }, updateFields);
      }
      return res.json(existing);
    }

    const created = await SavedAddress.create({
      user_id: req.user.id,
      label: label || 'Home',
      customer_name: customer_name || '',
      customer_email: customer_email || '',
      address: address || '',
      house_no: house_no || '',
      street: street || '',
      locality: locality || '',
      city,
      state: state || '',
      pincode,
      landmark: landmark || '',
      phone: phone || '',
      is_default: is_default ? 1 : 0
    });
    res.status(201).json(created);
  } catch (error) {
    if (error.code === 11000) {
      // Duplicate key error — compound index violation, return existing
      const existing = await SavedAddress.findOne({
        user_id: req.user.id,
        address: address || '',
        city: city,
        pincode: pincode
      });
      if (existing) return res.json(existing);
    }
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/saved-addresses/:id', authenticateToken, async (req, res) => {
  const { label, address, house_no, street, locality, city, pincode, landmark, phone, is_default, customer_name, customer_email, state } = req.body;

  try {
    if (is_default) {
      await SavedAddress.updateMany({ user_id: req.user.id }, { is_default: 0 });
    }

    const updates = {};
    if (label !== undefined) updates.label = label;
    if (address !== undefined) updates.address = address;
    if (house_no !== undefined) updates.house_no = house_no;
    if (street !== undefined) updates.street = street;
    if (locality !== undefined) updates.locality = locality;
    if (city !== undefined) updates.city = city;
    if (pincode !== undefined) updates.pincode = pincode;
    if (landmark !== undefined) updates.landmark = landmark;
    if (phone !== undefined) updates.phone = phone;
    if (customer_name !== undefined) updates.customer_name = customer_name;
    if (customer_email !== undefined) updates.customer_email = customer_email;
    if (state !== undefined) updates.state = state;
    updates.is_default = is_default ? 1 : 0;

    const updated = await SavedAddress.findOneAndUpdate(
      { _id: req.params.id, user_id: req.user.id },
      updates,
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Address not found' });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/saved-addresses/:id', authenticateToken, async (req, res) => {
  try {
    const result = await SavedAddress.findOneAndDelete({ _id: req.params.id, user_id: req.user.id });
    if (!result) return res.status(404).json({ error: 'Address not found' });
    res.json({ message: 'Address deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Request OTP for signup
app.post('/api/request-otp', async (req, res) => {
  const { name, email, phone, method } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required to send OTP' });

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered. Please login instead.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore[email] = {
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000,
      name: name || 'MXERA User',
      phone,
      method: method || 'email'
    };

    const deliveryMethod = method === 'whatsapp' ? 'WhatsApp' : 'Email';
    const mailText = `Hello ${otpStore[email].name},<br><br>Your MXERA signup OTP is <strong>${otp}</strong>.<br>This code will expire in 5 minutes.<br><br>Thank you,<br>MXERA Team`;

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: email,
      subject: 'MXERA Verification Code',
      html: mailText
    });
    res.json({ message: `OTP sent to ${deliveryMethod.toLowerCase()} ${email}`, target: 'email' });
  } catch (error) {
    console.error('OTP email error:', error);
    res.status(500).json({ error: `Unable to send OTP email: ${error.message}` });
  }
});

// Verify OTP
app.post('/api/verify-otp', (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required' });

  const record = otpStore[email];
  if (!record || record.expiresAt < Date.now()) {
    return res.status(400).json({ error: 'OTP expired or not found' });
  }
  if (record.otp !== otp) {
    return res.status(400).json({ error: 'Invalid OTP code' });
  }

  res.json({ verified: true });
});

// Request Password Reset
app.post('/api/request-password-reset', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.json({ message: 'If that email exists, a reset link has been sent.' });
    }

    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour

    await PasswordReset.create({ user_id: user._id, token, expires_at: expiresAt });

    const clientUrl = process.env.CLIENT_URL || `http://localhost:${PORT}`;
    const resetLink = `${clientUrl.replace(/\/$/, '')}/reset.html?token=${token}`;
    const mailText = `Hello ${user.name || 'MXERA User'},<br><br>Click the link below to reset your password (valid for 1 hour):<br><a href="${resetLink}">${resetLink}</a><br><br>If you didn't request this, ignore this email.<br><br>Thanks,<br>MXERA Team`;

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: email,
      subject: 'MXERA Password Reset',
      html: mailText
    });
    res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (error) {
    console.error('Password reset email error:', error);
    res.status(500).json({ error: 'Failed to send reset email' });
  }
});

// Reset Password
app.post('/api/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Token and password are required' });

  try {
    const resetRecord = await PasswordReset.findOne({ token }).populate('user_id');
    if (!resetRecord) return res.status(400).json({ error: 'Invalid or expired token' });
    if (resetRecord.expires_at < Date.now()) return res.status(400).json({ error: 'Token expired' });

    const hashed = await bcrypt.hash(password, 10);
    await User.updateOne({ _id: resetRecord.user_id._id }, { password: hashed });
    await PasswordReset.deleteOne({ _id: resetRecord._id });
    res.json({ message: 'Password reset successful' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// User Registration
app.post('/api/register', async (req, res) => {
  const sessionId = req.headers['x-session-id'] || req.sessionID;
  const { name, email, password, phone, gender } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      phone,
      gender: gender || 'other'
    });

    delete otpStore[email];
    await mergeSessionToUser(sessionId, user._id);
    res.json({ message: 'Registration successful', userId: user._id });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    res.status(500).json({ error: error.message });
  }
});

// User Login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const sessionId = req.headers['x-session-id'] || req.sessionID;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
    await mergeSessionToUser(sessionId, user._id);
    res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get User Profile
app.get('/api/user', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('id name email phone address');
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update User Profile
app.put('/api/user', authenticateToken, async (req, res) => {
  const { name, phone, address } = req.body;
  try {
    await User.updateOne({ _id: req.user.id }, { name, phone, address });
    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Cart
app.get('/api/cart', optionalAuth, async (req, res) => {
  const sessionId = req.headers['x-session-id'] || req.sessionID;
  const userId = req.user?.id || null;

  try {
    let cartItems;
    if (userId) {
      cartItems = await Cart.find({
        $or: [
          { user_id: userId },
          { session_id: sessionId, user_id: null }
        ]
      }).populate('product_id', 'name price original_price image tag');
    } else {
      cartItems = await Cart.find({ session_id: sessionId, user_id: null })
        .populate('product_id', 'name price original_price image tag');
    }

    const result = cartItems.map(c => ({
      id: c._id,
      quantity: c.quantity,
      product_id: c.product_id?._id || c.product_id,
      name: c.product_id?.name,
      price: c.product_id?.price,
      original_price: c.product_id?.original_price,
      image: c.product_id?.image,
      tag: c.product_id?.tag,
      product_color: c.product_color,
      product_color_image: c.product_color_image,
      product_size: c.product_size
    }));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add to Cart
app.post('/api/cart', optionalAuth, async (req, res) => {
  const { productId, quantity = 1, colorName = '', colorImage = '', sizeName = '' } = req.body;
  const sessionId = req.headers['x-session-id'] || req.sessionID;
  const userId = req.user?.id || null;

  try {
    if (!isValidObjectId(productId)) return res.status(400).json({ error: 'Invalid product id' });
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    // Check if already in cart (match by product_id AND color AND size)
    let existing;
    if (userId) {
      existing = await Cart.findOne({
        $or: [
          { session_id: sessionId, user_id: userId },
          { user_id: userId }
        ],
        product_id: productId,
        product_color: colorName,
        product_size: sizeName
      });
    } else {
      existing = await Cart.findOne({
        session_id: sessionId,
        product_id: productId,
        product_color: colorName,
        product_size: sizeName
      });
    }

    if (existing) {
      existing.quantity += quantity;
      await existing.save();
      res.json({ message: 'Cart updated' });
    } else {
      await Cart.create({
        session_id: sessionId,
        user_id: userId || null,
        product_id: productId,
        quantity,
        product_color: colorName,
        product_color_image: colorImage,
        product_size: sizeName
      });
      res.json({ message: 'Added to cart' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update Cart Quantity
app.put('/api/cart/:id', optionalAuth, async (req, res) => {
  const { quantity } = req.body;
  const sessionId = req.headers['x-session-id'] || req.sessionID;
  const userId = req.user?.id || null;

  try {
    if (quantity <= 0) {
      await Cart.findOneAndDelete({
        _id: req.params.id,
        $or: [
          { session_id: sessionId },
          { user_id: userId }
        ]
      });
      res.json({ message: 'Item removed' });
    } else {
      await Cart.findOneAndUpdate(
        {
          _id: req.params.id,
          $or: [
            { session_id: sessionId },
            { user_id: userId }
          ]
        },
        { quantity }
      );
      res.json({ message: 'Cart updated' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove from Cart
app.delete('/api/cart/:id', optionalAuth, async (req, res) => {
  const sessionId = req.headers['x-session-id'] || req.sessionID;
  const userId = req.user?.id || null;

  try {
    await Cart.findOneAndDelete({
      _id: req.params.id,
      $or: [
        { session_id: sessionId },
        { user_id: userId }
      ]
    });
    res.json({ message: 'Item removed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clear Cart
app.delete('/api/cart', optionalAuth, async (req, res) => {
  const sessionId = req.headers['x-session-id'] || req.sessionID;
  const userId = req.user?.id || null;

  try {
    await Cart.deleteMany({
      $or: [
        { session_id: sessionId },
        { user_id: userId }
      ]
    });
    res.json({ message: 'Cart cleared' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Wishlist
app.get('/api/wishlist', optionalAuth, async (req, res) => {
  const sessionId = req.headers['x-session-id'] || req.sessionID;
  const userId = req.user?.id || null;

  try {
    let wishlistItems;
    if (userId) {
      wishlistItems = await Wishlist.find({
        $or: [
          { user_id: userId },
          { session_id: sessionId, user_id: null }
        ]
      }).populate('product_id', 'name price original_price image tag rating');
    } else {
      wishlistItems = await Wishlist.find({ session_id: sessionId, user_id: null })
        .populate('product_id', 'name price original_price image tag rating');
    }

    const result = wishlistItems.map(w => ({
      id: w._id,
      product_id: w.product_id?._id || w.product_id,
      name: w.product_id?.name,
      price: w.product_id?.price,
      original_price: w.product_id?.original_price,
      image: w.product_id?.image,
      tag: w.product_id?.tag,
      rating: w.product_id?.rating
    }));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add to Wishlist
app.post('/api/wishlist', optionalAuth, async (req, res) => {
  const { productId } = req.body;
  const sessionId = req.headers['x-session-id'] || req.sessionID;
  const userId = req.user?.id || null;

  try {
    if (!isValidObjectId(productId)) return res.status(400).json({ error: 'Invalid product id' });
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    let existing;
    if (userId) {
      existing = await Wishlist.findOne({
        $or: [
          { session_id: sessionId, user_id: userId },
          { user_id: userId }
        ],
        product_id: productId
      });
    } else {
      existing = await Wishlist.findOne({
        session_id: sessionId,
        product_id: productId
      });
    }

    if (existing) {
      if (userId && !existing.user_id) {
        existing.user_id = userId;
        await existing.save();
        return res.json({ message: 'Added to wishlist' });
      }
      return res.json({ message: 'Already in wishlist' });
    }

    await Wishlist.create({
      session_id: sessionId,
      user_id: userId || null,
      product_id: productId
    });
    res.json({ message: 'Added to wishlist' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove from Wishlist
app.delete('/api/wishlist/:productId', optionalAuth, async (req, res) => {
  const sessionId = req.headers['x-session-id'] || req.sessionID;
  const userId = req.user?.id || null;

  try {
    if (!isValidObjectId(req.params.productId)) return res.status(400).json({ error: 'Invalid product id' });
    await Wishlist.findOneAndDelete({
      product_id: req.params.productId,
      $or: [
        { session_id: sessionId },
        { user_id: userId }
      ]
    });
    res.json({ message: 'Removed from wishlist' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create Order
app.post('/api/orders', authenticateToken, async (req, res) => {
  const {
    items,
    address,
    streetAddress,
    house_no,
    street,
    locality,
    city,
    pincode,
    landmark,
    state,
    customerName,
    customerPhone,
    customerEmail,
    paymentMethod
  } = req.body;
  const sessionId = req.headers['x-session-id'] || req.sessionID;
  const orderKey = String(req.headers['x-order-key'] || '').trim().slice(0, 100) || null;

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'Cart is empty' });
  }
  if (!address || !customerName || !customerPhone || !customerEmail) {
    return res.status(400).json({ error: 'Name, phone, email, and address are required' });
  }

  const orderItems = items.map(item => ({
    product_id: item.product_id || item.id,
    name: item.name,
    quantity: Number(item.quantity),
    price: Number(item.price),
    product_color: item.product_color || '',
    product_color_image: item.product_color_image || '',
    product_size: item.product_size || '',
    image: item.image || ''
  }));

  if (orderItems.some(item =>
    !item.product_id ||
    !Number.isFinite(item.quantity) ||
    item.quantity <= 0 ||
    !Number.isFinite(item.price) ||
    item.price < 0
  )) {
    return res.status(400).json({ error: 'Order contains invalid items' });
  }
  const totalAmount = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  // Start a MongoDB session for transaction
  const mongoSession = await mongoose.startSession();
  let orderId;

  try {
    await mongoSession.withTransaction(async () => {
      // Check for duplicate idempotency key
      if (orderKey) {
        const existingOrder = await Order.findOne({ idempotency_key: orderKey }).session(mongoSession);
        if (existingOrder) {
          // Return existing order ID without error
          orderId = existingOrder._id;
          return;
        }
      }

      const order = await Order.create([{
        user_id: req.user?.id || null,
        idempotency_key: orderKey,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        payment_method: paymentMethod || 'cod',
        payment_status: paymentMethod === 'cod' ? 'pending' : 'awaiting',
        total_amount: totalAmount,
        delivery_address: address
      }], { session: mongoSession });
      orderId = order[0]._id;

      // Create order items and update stock
      for (const item of orderItems) {
        const product = await Product.findById(item.product_id).session(mongoSession);
        if (!product || product.stock < item.quantity) {
          throw new Error(`Insufficient stock for product ${item.product_id}`);
        }
        await Product.updateOne(
          { _id: item.product_id, stock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity } },
          { session: mongoSession }
        );

        await OrderItem.create([{
          order_id: orderId,
          product_id: item.product_id,
          product_name: item.name || `Product #${item.product_id}`,
          quantity: item.quantity,
          price: item.price,
          product_color: item.product_color,
          product_color_image: item.product_color_image,
          product_size: item.product_size
        }], { session: mongoSession });
      }

      // Clear cart
      await Cart.deleteMany({
        $or: [
          { session_id: sessionId },
          { user_id: req.user?.id || null }
        ]
      }).session(mongoSession);

      // Auto-save delivery address
      if (req.user?.id && address) {
        const savedAddress = streetAddress || address;
        try {
          await SavedAddress.create([{
            user_id: req.user.id,
            label: 'Order Address',
            customer_name: customerName || '',
            customer_email: customerEmail || '',
            address: savedAddress,
            house_no: house_no || '',
            street: street || '',
            locality: locality || '',
            city: city || '',
            state: state || '',
            pincode: pincode || '',
            landmark: landmark || '',
            phone: customerPhone || ''
          }], { session: mongoSession });
        } catch (dupErr) {
          // Silently fail on duplicate address
        }
      }
    });

    if (!orderId) {
      throw new Error('Order could not be created');
    }

    // Send notification emails
    const safeCustomerName = escapeHtml(customerName);
    const safeCustomerPhone = escapeHtml(customerPhone);
    const safeCustomerEmail = escapeHtml(customerEmail);
    const safeAddress = escapeHtml(address);
    const safePaymentMethod = escapeHtml(paymentMethod || 'cod');
    const itemRows = renderOrderItemsEmail(orderItems);
    const itemsTable = `
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <thead>
          <tr>
            <th style="padding:8px;border-bottom:2px solid #222;text-align:left;">Item</th>
            <th style="padding:8px;border-bottom:2px solid #222;text-align:center;">Qty</th>
            <th style="padding:8px;border-bottom:2px solid #222;text-align:right;">Price</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
    `;
    const fromAddress = process.env.EMAIL_FROM || process.env.EMAIL_USER;
    const adminEmail = process.env.EMAIL_ADMIN || process.env.EMAIL_USER;
    const customerMessage = `
      <p>Hello ${safeCustomerName},</p>
      <p>Your MXERA order <strong>#${orderId}</strong> has been placed successfully.</p>
      ${itemsTable}
      <p><strong>Total:</strong> ${formatOrderAmount(totalAmount)}</p>
      <p><strong>Payment Method:</strong> ${safePaymentMethod}</p>
      <p><strong>Delivery address:</strong><br>${safeAddress}</p>
      <p>Thank you,<br>MXERA Team</p>
    `;
    const adminMessage = `
      <p>New MXERA order <strong>#${orderId}</strong> was placed.</p>
      <p>
        <strong>Customer:</strong> ${safeCustomerName}<br>
        <strong>Email:</strong> ${safeCustomerEmail}<br>
        <strong>Phone:</strong> ${safeCustomerPhone}<br>
        <strong>Payment:</strong> ${safePaymentMethod}
      </p>
      ${itemsTable}
      <p><strong>Total:</strong> ${formatOrderAmount(totalAmount)}</p>
      <p><strong>Delivery address:</strong><br>${safeAddress}</p>
    `;

    const notificationTasks = [
      transporter.sendMail({
        from: fromAddress,
        to: customerEmail,
        subject: `MXERA Order Confirmation #${orderId}`,
        html: customerMessage
      })
    ];

    if (adminEmail) {
      notificationTasks.push(transporter.sendMail({
        from: fromAddress,
        to: adminEmail,
        replyTo: customerEmail,
        subject: `New MXERA Order #${orderId}`,
        html: adminMessage
      }));
    }

    const notificationResults = await Promise.allSettled(notificationTasks);
    const notificationFailures = notificationResults.filter(result => result.status === 'rejected');
    if (!adminEmail) {
      console.error(`Order #${orderId} admin notification skipped: EMAIL_ADMIN or EMAIL_USER is required.`);
    }
    notificationFailures.forEach(result => {
      console.error(`Order #${orderId} notification email error:`, result.reason?.message || result.reason);
    });

    res.json({
      message: 'Order placed successfully',
      orderId,
      notificationWarning: notificationFailures.length || !adminEmail
        ? 'Order placed, but one or more notification emails could not be sent.'
        : undefined
    });
  } catch (error) {
    console.error('Order placement error:', error.message);
    if (orderKey && error.message && error.message.includes('E11000')) {
      const existingOrder = await Order.findOne({ idempotency_key: orderKey });
      if (existingOrder) {
        return res.json({
          message: 'Order already placed',
          orderId: existingOrder._id,
          duplicate: true
        });
      }
    }
    res.status(500).json({ error: 'Unable to place order. Please try again later.' });
  } finally {
    mongoSession.endSession();
  }
});

// Get Orders
app.get('/api/orders', authenticateToken, async (req, res) => {
  try {
    const orders = await Order.aggregate([
      { $match: { user_id: new mongoose.Types.ObjectId(req.user.id) } },
      {
        $lookup: {
          from: 'orderitems',
          localField: '_id',
          foreignField: 'order_id',
          as: 'items'
        }
      },
      { $sort: { created_at: -1 } }
    ]);

    // Enrich items with product names
    const enrichedOrders = await Promise.all(orders.map(async (order) => {
      const enrichedItems = await Promise.all(order.items.map(async (item) => {
        let productName = item.product_name;
        if (!productName) {
          const product = await Product.findById(item.product_id).select('name');
          productName = product ? product.name : `Product #${item.product_id}`;
        }
        return {
          product_name: productName,
          quantity: item.quantity,
          price: item.price,
          product_color: item.product_color || '',
          product_color_image: item.product_color_image || '',
          product_size: item.product_size || ''
        };
      }));
      return {
        id: order._id,
        total_amount: order.total_amount,
        status: order.status,
        created_at: order.created_at,
        items: enrichedItems
      };
    }));

    res.json(enrichedOrders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Submit Query Form
app.post('/api/submit-query', async (req, res) => {
  const { name, email, message } = req.body;

  console.log('[/api/submit-query] Incoming request from', req.ip || req.connection.remoteAddress);
  console.log('[/api/submit-query] Headers:', {
    origin: req.headers.origin,
    referer: req.headers.referer,
    host: req.headers.host,
    'user-agent': req.headers['user-agent']
  });
  console.log('[/api/submit-query] Body:', { name, email, message });

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const mailText = `New Query from MXERA Website<br><br>
    <strong>Name:</strong> ${name}<br>
    <strong>Email:</strong> ${email}<br>
    <strong>Question:</strong><br>${message}<br><br>
    This query was submitted through the contact form.`;

  try {
    console.log('Sending email with config:', {
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      user: process.env.EMAIL_USER
    });

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: process.env.EMAIL_USER,
      cc: 'supportmxera@gmail.com',
      replyTo: email,
      subject: `New Query from ${name}`,
      html: mailText
    });

    console.log('Query email sent successfully');
    res.json({ message: 'Query submitted successfully' });
  } catch (error) {
    console.error('Query email error:', error.message);
    res.status(500).json({ error: 'Failed to send query: ' + error.message });
  }
});

// Initialize and Start Server
const server = app.listen(PORT, async () => {
  console.log(`MXERA Server running on http://localhost:${PORT}`);

  // Wait for MongoDB connection before initializing
  mongoose.connection.once('connected', async () => {
    await initDatabase();
  });

  // Also try if already connected
  if (mongoose.connection.readyState === 1) {
    await initDatabase();
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. If you want to use a different port, update PORT in .env or stop the process currently using port ${PORT}.`);
    process.exit(1);
  }
  throw err;
});
