require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const mysql = require('mysql2');
const cors = require('cors');
const compression = require('compression');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const nodemailer = require('nodemailer');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

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
app.use(compression()); // Enable gzip/brotli compression
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

// MySQL Connection
const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'mxera',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.example.com',
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER || 'user@example.com',
    pass: process.env.EMAIL_PASS || 'password'
  }
});

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
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

db.connect((err) => {
  if (err) {
    console.error('MySQL Connection Error:', err.message);
  } else {
    console.log('Connected to MySQL Database');
  }
});

// Initialize Database Tables
function initDatabase() {
  const queries = [
    `CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      phone VARCHAR(20),
      gender ENUM('male', 'female', 'other') DEFAULT 'other',
      address TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      tag VARCHAR(100),
      description TEXT,
      price DECIMAL(10,2) NOT NULL,
      original_price DECIMAL(10,2),
      rating DECIMAL(3,2) DEFAULT 4.5,
      reviews INT DEFAULT 0,
      badge VARCHAR(50),
      image VARCHAR(500),
      category VARCHAR(50),
      stock INT DEFAULT 100,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS cart (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT,
      session_id VARCHAR(100),
      product_id INT NOT NULL,
      quantity INT DEFAULT 1,
      product_color VARCHAR(100) DEFAULT '',
      product_color_image VARCHAR(500) DEFAULT '',
      product_size VARCHAR(50) DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id)
    )`,
    `CREATE TABLE IF NOT EXISTS wishlist (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT,
      session_id VARCHAR(100),
      product_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id)
    )`,
    `CREATE TABLE IF NOT EXISTS password_resets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      token VARCHAR(255) NOT NULL,
      expires_at BIGINT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX (token),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT,
      idempotency_key VARCHAR(100) UNIQUE,
      customer_name VARCHAR(150),
      customer_email VARCHAR(255),
      customer_phone VARCHAR(30),
      payment_method VARCHAR(50) DEFAULT 'cod',
      payment_status VARCHAR(50) DEFAULT 'pending',
      total_amount DECIMAL(10,2) NOT NULL,
      status VARCHAR(50) DEFAULT 'pending',
      delivery_address TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS order_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id INT NOT NULL,
      product_id INT NOT NULL,
      quantity INT NOT NULL,
      price DECIMAL(10,2) NOT NULL,
      product_color VARCHAR(100) DEFAULT '',
      product_color_image VARCHAR(500) DEFAULT '',
      product_size VARCHAR(50) DEFAULT '',
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    )`,
    `CREATE TABLE IF NOT EXISTS saved_addresses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      label VARCHAR(50) DEFAULT 'Home',
      address TEXT NOT NULL,
      house_no VARCHAR(100) DEFAULT '',
      street VARCHAR(255) DEFAULT '',
      locality VARCHAR(255) DEFAULT '',
      city VARCHAR(100) DEFAULT '',
      state VARCHAR(100) DEFAULT '',
      pincode VARCHAR(20) DEFAULT '',
      landmark VARCHAR(255) DEFAULT '',
      phone VARCHAR(20) DEFAULT '',
      is_default TINYINT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  ];

  queries.forEach((query) => {
    db.query(query, (err) => {
      if (err) console.error('Table creation error:', err.message);
    });
  });

  db.query("SHOW COLUMNS FROM users LIKE 'gender'", (err, results) => {
    if (err) {
      console.error('Show columns error:', err.message);
      return;
    }
    if (results.length === 0) {
      db.query("ALTER TABLE users ADD gender ENUM('male','female','other') DEFAULT 'other'", (alterErr) => {
        if (alterErr && alterErr.code !== 'ER_DUP_FIELDNAME') {
          console.error('Add gender column error:', alterErr.message);
        }
      });
    }
  });

  db.query("SHOW COLUMNS FROM orders LIKE 'idempotency_key'", (err, results) => {
    if (err) {
      console.error('Show order columns error:', err.message);
      return;
    }
    if (results.length === 0) {
      db.query('ALTER TABLE orders ADD idempotency_key VARCHAR(100) UNIQUE AFTER user_id', (alterErr) => {
        if (alterErr && alterErr.code !== 'ER_DUP_FIELDNAME') {
          console.error('Add order idempotency column error:', alterErr.message);
        }
      });
    }
  });

  if (ADMIN_BOOTSTRAP_EMAIL && process.env.ADMIN_BOOTSTRAP_PASSWORD) {
    const adminName = String(process.env.ADMIN_BOOTSTRAP_NAME || 'MXERA Admin').trim() || 'MXERA Admin';
    db.query('SELECT id FROM users WHERE email = ? LIMIT 1', [ADMIN_BOOTSTRAP_EMAIL], async (err, results) => {
      if (err) {
        console.error('Bootstrap admin lookup error:', err.message);
        return;
      }
      if (results.length > 0) {
        return;
      }
      try {
        const password = await bcrypt.hash(process.env.ADMIN_BOOTSTRAP_PASSWORD, 10);
        db.query(
          'INSERT INTO users (name, email, password, gender) VALUES (?, ?, ?, ?)',
          [adminName, ADMIN_BOOTSTRAP_EMAIL, password, 'other'],
          (insertErr) => {
            if (insertErr && insertErr.code !== 'ER_DUP_ENTRY') {
              console.error('Bootstrap admin creation error:', insertErr.message);
              return;
            }
            if (!insertErr) {
              console.log(`Bootstrap admin created for ${ADMIN_BOOTSTRAP_EMAIL}`);
            }
          }
        );
      } catch (hashError) {
        console.error('Bootstrap admin password error:', hashError.message);
      }
    });
  }

  const orderColumns = [
    ['customer_name', 'ALTER TABLE orders ADD customer_name VARCHAR(150) AFTER idempotency_key'],
    ['customer_email', 'ALTER TABLE orders ADD customer_email VARCHAR(255) AFTER customer_name'],
    ['customer_phone', 'ALTER TABLE orders ADD customer_phone VARCHAR(30) AFTER customer_email'],
    ['payment_method', "ALTER TABLE orders ADD payment_method VARCHAR(50) DEFAULT 'cod' AFTER customer_phone"],
    ['payment_status', "ALTER TABLE orders ADD payment_status VARCHAR(50) DEFAULT 'pending' AFTER payment_method"]
  ];
  orderColumns.forEach(([column, query]) => {
    db.query(`SHOW COLUMNS FROM orders LIKE '${column}'`, (err, results) => {
      if (err) {
        console.error(`Show orders ${column} column error:`, err.message);
        return;
      }
      if (results.length === 0) {
        db.query(query, (alterErr) => {
          if (alterErr && alterErr.code !== 'ER_DUP_FIELDNAME') {
            console.error(`Add orders ${column} column error:`, alterErr.message);
          }
        });
      }
    });
  });

  // Add new product columns for enhanced features
  const productColumns = [
    ['specifications', "ALTER TABLE products ADD specifications TEXT AFTER description"],
    ['colors', "ALTER TABLE products ADD colors TEXT AFTER image"],
    ['sizes', "ALTER TABLE products ADD sizes TEXT AFTER colors"],
    ['out_of_stock', "ALTER TABLE products ADD out_of_stock TINYINT DEFAULT 0 AFTER stock"],
    ['images', "ALTER TABLE products ADD images TEXT AFTER image"]
  ];
  productColumns.forEach(([column, query]) => {
    db.query(`SHOW COLUMNS FROM products LIKE '${column}'`, (err, results) => {
      if (err) {
        console.error(`Show products ${column} column error:`, err.message);
        return;
      }
      if (results.length === 0) {
        db.query(query, (alterErr) => {
          if (alterErr && alterErr.code !== 'ER_DUP_FIELDNAME') {
            console.error(`Add products ${column} column error:`, alterErr.message);
          }
        });
      }
    });
  });

  // Add product_name column to order_items (preserves name even if product is later renamed/deleted)
  db.query("SHOW COLUMNS FROM order_items LIKE 'product_name'", (err, results) => {
    if (err) {
      console.error('Show order_items column error:', err.message);
      return;
    }
    if (results.length === 0) {
      db.query("ALTER TABLE order_items ADD product_name VARCHAR(255) AFTER product_id", (alterErr) => {
        if (alterErr && alterErr.code !== 'ER_DUP_FIELDNAME') {
          console.error('Add order_items product_name column error:', alterErr.message);
        }
      });
    }
  });

  // Add color columns to cart table for existing databases
  db.query("SHOW COLUMNS FROM cart LIKE 'product_color'", (err, results) => {
    if (err) {
      console.error('Show cart product_color column error:', err.message);
      return;
    }
    if (results.length === 0) {
      db.query("ALTER TABLE cart ADD product_color VARCHAR(100) DEFAULT '' AFTER quantity", (alterErr) => {
        if (alterErr && alterErr.code !== 'ER_DUP_FIELDNAME') {
          console.error('Add cart product_color column error:', alterErr.message);
        }
      });
      db.query("ALTER TABLE cart ADD product_color_image VARCHAR(500) DEFAULT '' AFTER product_color", (alterErr) => {
        if (alterErr && alterErr.code !== 'ER_DUP_FIELDNAME') {
          console.error('Add cart product_color_image column error:', alterErr.message);
        }
      });
    }
  });

  // Add color columns to order_items table for existing databases
  db.query("SHOW COLUMNS FROM order_items LIKE 'product_color'", (err, results) => {
    if (err) {
      console.error('Show order_items product_color column error:', err.message);
      return;
    }
    if (results.length === 0) {
      db.query("ALTER TABLE order_items ADD product_color VARCHAR(100) DEFAULT '' AFTER price", (alterErr) => {
        if (alterErr && alterErr.code !== 'ER_DUP_FIELDNAME') {
          console.error('Add order_items product_color column error:', alterErr.message);
        }
      });
      db.query("ALTER TABLE order_items ADD product_color_image VARCHAR(500) DEFAULT '' AFTER product_color", (alterErr) => {
        if (alterErr && alterErr.code !== 'ER_DUP_FIELDNAME') {
          console.error('Add order_items product_color_image column error:', alterErr.message);
        }
      });
    }
  });

  // Add product_size column to cart table for existing databases
  db.query("SHOW COLUMNS FROM cart LIKE 'product_size'", (err, results) => {
    if (err) {
      console.error('Show cart product_size column error:', err.message);
      return;
    }
    if (results.length === 0) {
      db.query("ALTER TABLE cart ADD product_size VARCHAR(50) DEFAULT '' AFTER product_color_image", (alterErr) => {
        if (alterErr && alterErr.code !== 'ER_DUP_FIELDNAME') {
          console.error('Add cart product_size column error:', alterErr.message);
        }
      });
    }
  });

  // Add product_size column to order_items table for existing databases
  db.query("SHOW COLUMNS FROM order_items LIKE 'product_size'", (err, results) => {
    if (err) {
      console.error('Show order_items product_size column error:', err.message);
      return;
    }
    if (results.length === 0) {
      db.query("ALTER TABLE order_items ADD product_size VARCHAR(50) DEFAULT '' AFTER product_color_image", (alterErr) => {
        if (alterErr && alterErr.code !== 'ER_DUP_FIELDNAME') {
          console.error('Add order_items product_size column error:', alterErr.message);
        }
      });
    }
  });

  // Add name, email, state columns, house_no, street, locality, landmark to saved_addresses
  const savedAddressColumns = [
    ['customer_name', "ALTER TABLE saved_addresses ADD customer_name VARCHAR(150) DEFAULT '' AFTER label"],
    ['customer_email', "ALTER TABLE saved_addresses ADD customer_email VARCHAR(255) DEFAULT '' AFTER customer_name"],
    ['state', "ALTER TABLE saved_addresses ADD state VARCHAR(100) DEFAULT '' AFTER city"],
    ['house_no', "ALTER TABLE saved_addresses ADD house_no VARCHAR(100) DEFAULT '' AFTER address"],
    ['street', "ALTER TABLE saved_addresses ADD street VARCHAR(255) DEFAULT '' AFTER house_no"],
    ['locality', "ALTER TABLE saved_addresses ADD locality VARCHAR(255) DEFAULT '' AFTER street"],
    ['landmark', "ALTER TABLE saved_addresses ADD landmark VARCHAR(255) DEFAULT '' AFTER pincode"]
  ];
  savedAddressColumns.forEach(([column, query]) => {
    db.query(`SHOW COLUMNS FROM saved_addresses LIKE '${column}'`, (err, results) => {
      if (err) {
        console.error(`Show saved_addresses ${column} column error:`, err.message);
        return;
      }
      if (results.length === 0) {
        db.query(query, (alterErr) => {
          if (alterErr && alterErr.code !== 'ER_DUP_FIELDNAME') {
            console.error(`Add saved_addresses ${column} column error:`, alterErr.message);
          }
        });
      }
    });
  });

  // Add UNIQUE constraint on (user_id, address, city, pincode) to prevent duplicate saved addresses
  db.query("SHOW INDEX FROM saved_addresses WHERE Column_name = 'address' AND Key_name = 'uq_user_address'", (err, results) => {
    if (err) {
      console.error('Check saved_addresses index error:', err.message);
      return;
    }
    if (results.length === 0) {
      db.query("ALTER IGNORE TABLE saved_addresses ADD UNIQUE INDEX uq_user_address (user_id, address(255), city, pincode)", (idxErr) => {
        if (idxErr && idxErr.code !== 'ER_DUP_KEYNAME') {
          // ALTER IGNORE may not work in strict MySQL 8+; try a different approach
          db.query("CREATE UNIQUE INDEX uq_user_address ON saved_addresses (user_id, address(255), city, pincode)", (createErr) => {
            if (createErr && createErr.code !== 'ER_DUP_KEYNAME') {
              console.error('Add saved_addresses UNIQUE index error:', createErr.message);
            }
          });
        }
      });
    }
  });

  // Insert sample products if not exist
  db.query('SELECT COUNT(*) as count FROM products', (err, result) => {
    if (result[0].count === 0) {
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

      sampleProducts.forEach(product => {
        db.query('INSERT INTO products SET ?', product);
      });
      console.log('Sample products inserted');
    }
  });
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

const mergeSessionCartToUser = (sessionId, userId, callback) => {
  if (!sessionId || !userId) return callback();

  db.query('SELECT id, product_id, quantity, product_color, product_size FROM cart WHERE session_id = ? AND user_id IS NULL', [sessionId], (err, rows) => {
    if (err) return callback(err);
    let remaining = rows.length;
    if (remaining === 0) return callback();

    rows.forEach(row => {
      // Match by product_id AND product_color AND product_size so different colors/sizes stay separate
      db.query('SELECT id, quantity FROM cart WHERE user_id = ? AND product_id = ? AND product_color = ? AND product_size = ?', [userId, row.product_id, row.product_color || '', row.product_size || ''], (err, existing) => {
        if (err) return callback(err);

        if (existing.length > 0) {
          const newQty = existing[0].quantity + row.quantity;
          db.query('UPDATE cart SET quantity = ? WHERE id = ?', [newQty, existing[0].id], (err) => {
            if (err) return callback(err);
            db.query('DELETE FROM cart WHERE id = ?', [row.id], (err) => {
              if (err) return callback(err);
              remaining -= 1;
              if (remaining === 0) callback();
            });
          });
        } else {
          db.query('UPDATE cart SET user_id = ? WHERE id = ?', [userId, row.id], (err) => {
            if (err) return callback(err);
            remaining -= 1;
            if (remaining === 0) callback();
          });
        }
      });
    });
  });
};

const mergeSessionWishlistToUser = (sessionId, userId, callback) => {
  if (!sessionId || !userId) return callback();

  db.query('SELECT id, product_id FROM wishlist WHERE session_id = ? AND user_id IS NULL', [sessionId], (err, rows) => {
    if (err) return callback(err);
    let remaining = rows.length;
    if (remaining === 0) return callback();

    rows.forEach(row => {
      db.query('SELECT id FROM wishlist WHERE user_id = ? AND product_id = ?', [userId, row.product_id], (err, existing) => {
        if (err) return callback(err);

        if (existing.length > 0) {
          db.query('DELETE FROM wishlist WHERE id = ?', [row.id], (err) => {
            if (err) return callback(err);
            remaining -= 1;
            if (remaining === 0) callback();
          });
        } else {
          db.query('UPDATE wishlist SET user_id = ? WHERE id = ?', [userId, row.id], (err) => {
            if (err) return callback(err);
            remaining -= 1;
            if (remaining === 0) callback();
          });
        }
      });
    });
  });
};

const mergeSessionToUser = (sessionId, userId, callback) => {
  mergeSessionCartToUser(sessionId, userId, (err) => {
    if (err) return callback(err);
    mergeSessionWishlistToUser(sessionId, userId, callback);
  });
};

// ============ API ROUTES ============

// Get all products
app.get('/api/products', (req, res) => {
  const { category, search } = req.query;
  let query = 'SELECT * FROM products WHERE 1=1';
  const params = [];

  if (category && category !== 'all') {
    query += ' AND category = ?';
    params.push(category);
  }

  if (search) {
    query += ' AND (name LIKE ? OR tag LIKE ? OR description LIKE ?)';
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }

  query += ' ORDER BY created_at DESC';

  db.query(query, params, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Get single product
app.get('/api/products/:id', (req, res) => {
  db.query('SELECT * FROM products WHERE id = ?', [req.params.id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ error: 'Product not found' });
    res.json(results[0]);
  });
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
    const connection = db.promise();
    const [[productStats]] = await connection.query(`
      SELECT COUNT(*) AS product_count,
        COALESCE(SUM(stock), 0) AS units_in_stock,
        COALESCE(SUM(CASE WHEN stock <= 10 THEN 1 ELSE 0 END), 0) AS low_stock_count
      FROM products
    `);
    const [[orderStats]] = await connection.query(`
      SELECT COUNT(*) AS order_count,
        COALESCE(SUM(CASE WHEN status IN ('pending', 'processing') THEN 1 ELSE 0 END), 0) AS open_orders,
        COALESCE(SUM(CASE WHEN status <> 'cancelled' THEN total_amount ELSE 0 END), 0) AS gross_sales,
        COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END), 0) AS paid_sales
      FROM orders
    `);
    const customerSql = ADMIN_EMAILS.length
      ? 'SELECT COUNT(*) AS customer_count FROM users WHERE LOWER(email) NOT IN (?)'
      : 'SELECT COUNT(*) AS customer_count FROM users';
    const [[customerStats]] = await connection.query(customerSql, ADMIN_EMAILS.length ? [ADMIN_EMAILS] : []);
    const [[savedAddressStats]] = await connection.query(`
      SELECT COUNT(*) AS saved_addresses_count FROM saved_addresses
    `);
    res.json({ ...productStats, ...orderStats, ...customerStats, ...savedAddressStats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/products', requireAdmin, (req, res) => {
  db.query('SELECT * FROM products ORDER BY created_at DESC, id DESC', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.post('/api/admin/products', requireAdmin, async (req, res) => {
  const product = normalizeProductInput(req.body);
  const validationError = validateProductInput(product);
  if (validationError) return res.status(400).json({ error: validationError });

  try {
    const [result] = await db.promise().query('INSERT INTO products SET ?', product);
    const [[created]] = await db.promise().query('SELECT * FROM products WHERE id = ?', [result.insertId]);
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
    const [result] = await db.promise().query('UPDATE products SET ? WHERE id = ?', [product, req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Product not found' });
    const [[updated]] = await db.promise().query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/admin/products/:id', requireAdmin, async (req, res) => {
  try {
    const [result] = await db.promise().query('DELETE FROM products WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Product not found' });
    res.json({ message: 'Product deleted' });
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.code === 'ER_ROW_IS_REFERENCED') {
      return res.status(409).json({ error: 'This product is used by orders and cannot be deleted' });
    }
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/orders', requireAdmin, (req, res) => {
  db.query(`
    SELECT o.id, o.total_amount, o.status, o.payment_method, o.payment_status,
      o.delivery_address, o.created_at,
      COALESCE(o.customer_name, u.name, 'Guest') AS customer_name,
      COALESCE(o.customer_email, u.email, '') AS customer_email,
      COALESCE(o.customer_phone, u.phone, '') AS customer_phone,
      JSON_ARRAYAGG(JSON_OBJECT(
        'product_id', oi.product_id,
        'product_name', COALESCE(oi.product_name, p.name, CONCAT('Product #', oi.product_id)),
        'quantity', oi.quantity,
        'price', oi.price,
        'product_color', oi.product_color,
        'product_color_image', oi.product_color_image,
        'product_size', oi.product_size
      )) AS items
    FROM orders o
    LEFT JOIN users u ON o.user_id = u.id
    LEFT JOIN order_items oi ON o.id = oi.order_id
    LEFT JOIN products p ON oi.product_id = p.id
    GROUP BY o.id
    ORDER BY o.created_at DESC, o.id DESC
    LIMIT 250
  `, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Delete all orders (admin only) — clears order_items first due to FK constraints
app.delete('/api/admin/orders', requireAdmin, (req, res) => {
  db.query('DELETE FROM order_items', (err) => {
    if (err) return res.status(500).json({ error: err.message });
    db.query('DELETE FROM orders', (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'All orders have been deleted.' });
    });
  });
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
  // Allow updating customer info fields (name, email, phone, delivery address)
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
    const [result] = await db.promise().query('UPDATE orders SET ? WHERE id = ?', [update, req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Order not found' });
    const [[updated]] = await db.promise().query(
      'SELECT id, customer_name, customer_email, customer_phone, delivery_address, status, payment_status, total_amount, created_at FROM orders WHERE id = ?',
      [req.params.id]
    );
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
app.get('/api/admin/saved-addresses', requireAdmin, (req, res) => {
  db.query(`
    SELECT sa.*, u.name AS user_name, u.email AS user_email
    FROM saved_addresses sa
    LEFT JOIN users u ON sa.user_id = u.id
    ORDER BY sa.created_at DESC
  `, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Admin: Delete ALL saved addresses
app.delete('/api/admin/saved-addresses', requireAdmin, (req, res) => {
  db.query('DELETE FROM saved_addresses', (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'All saved addresses deleted', count: result.affectedRows });
  });
});

// Saved Addresses CRUD
app.get('/api/saved-addresses', authenticateToken, (req, res) => {
  db.query('SELECT * FROM saved_addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC', [req.user.id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Delete ALL saved addresses for the current user
app.delete('/api/saved-addresses', authenticateToken, (req, res) => {
  db.query('DELETE FROM saved_addresses WHERE user_id = ?', [req.user.id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'All saved addresses deleted', count: result.affectedRows });
  });
});

app.post('/api/saved-addresses', authenticateToken, (req, res) => {
  const { label, address, house_no, street, locality, city, pincode, landmark, phone, is_default, customer_name, customer_email, state } = req.body;
  if (!address && !house_no) return res.status(400).json({ error: 'Address or house number is required' });
  if (!pincode) return res.status(400).json({ error: 'PIN code is required' });
  if (!city) return res.status(400).json({ error: 'City is required' });

  // Deduplication: use INSERT IGNORE with the UNIQUE constraint on (user_id, address, city, pincode)
  const saveAddress = (makeDefault) => {
    db.query(
      `INSERT IGNORE INTO saved_addresses (user_id, label, customer_name, customer_email, address, house_no, street, locality, city, state, pincode, landmark, phone, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, label || 'Home', customer_name || '', customer_email || '', address || '', house_no || '', street || '', locality || '', city, state || '', pincode, landmark || '', phone || '', makeDefault ? 1 : 0],
      (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) {
          // Duplicate — return the existing one
          db.query(
            'SELECT * FROM saved_addresses WHERE user_id = ? AND address = ? AND house_no = ? AND city = ? AND pincode = ? LIMIT 1',
            [req.user.id, address || '', house_no || '', city, pincode],
            (err2, existing) => {
              if (err2) return res.status(500).json({ error: err2.message });
              // Update fields on the existing record
              const updateFields = {};
              if (label) updateFields.label = label;
              if (makeDefault) updateFields.is_default = 1;
              if (customer_name) updateFields.customer_name = customer_name;
              if (customer_email) updateFields.customer_email = customer_email;
              if (state) updateFields.state = state;
              if (house_no) updateFields.house_no = house_no;
              if (street) updateFields.street = street;
              if (locality) updateFields.locality = locality;
              if (landmark) updateFields.landmark = landmark;
              if (phone) updateFields.phone = phone;
              if (Object.keys(updateFields).length > 0) {
                db.query('UPDATE saved_addresses SET ? WHERE id = ?', [updateFields, existing[0].id]);
              }
              res.json(existing[0]);
            }
          );
        } else {
          db.query('SELECT * FROM saved_addresses WHERE id = ?', [result.insertId], (err2, created) => {
            if (err2) return res.status(500).json({ error: err2.message });
            res.status(201).json(created[0]);
          });
        }
      }
    );
  };

  if (is_default) {
    db.query('UPDATE saved_addresses SET is_default = 0 WHERE user_id = ?', [req.user.id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      saveAddress(true);
    });
  } else {
    saveAddress(false);
  }
});

app.put('/api/saved-addresses/:id', authenticateToken, (req, res) => {
  const { label, address, house_no, street, locality, city, pincode, landmark, phone, is_default, customer_name, customer_email, state } = req.body;

  const updateAddress = (makeDefault) => {
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
    updates.is_default = makeDefault ? 1 : 0;

    db.query('UPDATE saved_addresses SET ? WHERE id = ? AND user_id = ?', [updates, req.params.id, req.user.id], (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Address not found' });
      db.query('SELECT * FROM saved_addresses WHERE id = ?', [req.params.id], (err2, updated) => {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json(updated[0]);
      });
    });
  };

  if (is_default) {
    db.query('UPDATE saved_addresses SET is_default = 0 WHERE user_id = ?', [req.user.id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      updateAddress(true);
    });
  } else {
    updateAddress(false);
  }
});

app.delete('/api/saved-addresses/:id', authenticateToken, (req, res) => {
  db.query('DELETE FROM saved_addresses WHERE id = ? AND user_id = ?', [req.params.id, req.user.id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Address not found' });
    res.json({ message: 'Address deleted' });
  });
});

// Request OTP for signup
app.post('/api/request-otp', async (req, res) => {
  const { name, email, phone, method } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required to send OTP' });

  // Check if email already registered
  db.query('SELECT id FROM users WHERE email = ?', [email], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length > 0) {
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

    transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: email,
      subject: 'MXERA Verification Code',
      html: mailText
    }).then(() => {
      res.json({ message: `OTP sent to ${deliveryMethod.toLowerCase()} ${email}`, target: 'email' });
    }).catch(error => {
      console.error('OTP email error:', error);
      res.status(500).json({ error: `Unable to send OTP email: ${error.message}` });
    });
  });
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

  db.query('SELECT id, name FROM users WHERE email = ?', [email], async (err, results) => {
    if (err) return res.status(500).json({ error: err.message });

    if (results.length === 0) {
      // respond success to avoid account enumeration
      return res.json({ message: 'If that email exists, a reset link has been sent.' });
    }

    const user = results[0];
    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour

    db.query('INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)', [user.id, token, expiresAt], (err) => {
      if (err) return res.status(500).json({ error: err.message });

      const clientUrl = process.env.CLIENT_URL || `http://localhost:${PORT}`;
      const resetLink = `${clientUrl.replace(/\/$/, '')}/reset.html?token=${token}`;
      const mailText = `Hello ${user.name || 'MXERA User'},<br><br>Click the link below to reset your password (valid for 1 hour):<br><a href="${resetLink}">${resetLink}</a><br><br>If you didn't request this, ignore this email.<br><br>Thanks,<br>MXERA Team`;

      transporter.sendMail({
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to: email,
        subject: 'MXERA Password Reset',
        html: mailText
      }).then(() => {
        res.json({ message: 'If that email exists, a reset link has been sent.' });
      }).catch(error => {
        console.error('Password reset email error:', error);
        res.status(500).json({ error: 'Failed to send reset email' });
      });
    });
  });
});

// Reset Password
app.post('/api/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Token and password are required' });

  db.query('SELECT pr.id, pr.user_id, pr.expires_at, u.email FROM password_resets pr JOIN users u ON pr.user_id = u.id WHERE pr.token = ?', [token], async (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(400).json({ error: 'Invalid or expired token' });

    const record = results[0];
    if (record.expires_at < Date.now()) return res.status(400).json({ error: 'Token expired' });

    try {
      const hashed = await bcrypt.hash(password, 10);
      db.query('UPDATE users SET password = ? WHERE id = ?', [hashed, record.user_id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        db.query('DELETE FROM password_resets WHERE id = ?', [record.id]);
        res.json({ message: 'Password reset successful' });
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to reset password' });
    }
  });
});

// User Registration
app.post('/api/register', async (req, res) => {
  const sessionId = req.headers['x-session-id'] || req.sessionID;
  const { name, email, password, phone, gender } = req.body;

  // Check if email already exists
  db.query('SELECT id FROM users WHERE email = ?', [email], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Email doesn't exist, proceed with registration
    bcrypt.hash(password, 10, (hashErr, hashedPassword) => {
      if (hashErr) return res.status(500).json({ error: 'Registration failed' });

      db.query('INSERT INTO users (name, email, password, phone, gender) VALUES (?, ?, ?, ?, ?)',
        [name, email, hashedPassword, phone, gender || 'other'],
        (insertErr, result) => {
          if (insertErr) {
            if (insertErr.code === 'ER_DUP_ENTRY') {
              return res.status(400).json({ error: 'Email already registered' });
            }
            return res.status(500).json({ error: insertErr.message });
          }
          delete otpStore[email];
          mergeSessionToUser(sessionId, result.insertId, (mergeErr) => {
            if (mergeErr) console.error('Session merge error:', mergeErr);
            res.json({ message: 'Registration successful', userId: result.insertId });
          });
        }
      );
    });
  });
});

// User Login
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const sessionId = req.headers['x-session-id'] || req.sessionID;

  db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(400).json({ error: 'Invalid credentials' });

    const user = results[0];
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
    mergeSessionToUser(sessionId, user.id, (mergeErr) => {
      if (mergeErr) console.error('Session merge error:', mergeErr);
      res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
    });
  });
});

// Get User Profile
app.get('/api/user', authenticateToken, (req, res) => {
  db.query('SELECT id, name, email, phone, address FROM users WHERE id = ?', [req.user.id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results[0]);
  });
});

// Update User Profile
app.put('/api/user', authenticateToken, (req, res) => {
  const { name, phone, address } = req.body;
  db.query('UPDATE users SET name = ?, phone = ?, address = ? WHERE id = ?',
    [name, phone, address, req.user.id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Profile updated successfully' });
    }
  );
});

// Get Cart
app.get('/api/cart', optionalAuth, (req, res) => {
  const sessionId = req.headers['x-session-id'] || req.sessionID;
  const userId = req.user?.id || null;

  db.query(`
    SELECT c.id, c.quantity, p.id as product_id, p.name, p.price, p.original_price, p.image, p.tag,
      c.product_color, c.product_color_image, c.product_size
    FROM cart c
    JOIN products p ON c.product_id = p.id
    WHERE ${userId ? '(c.user_id = ? OR (c.session_id = ? AND c.user_id IS NULL))' : '(c.session_id = ? AND c.user_id IS NULL)'}
  `, userId ? [userId, sessionId] : [sessionId], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Add to Cart
app.post('/api/cart', optionalAuth, (req, res) => {
  const { productId, quantity = 1, colorName = '', colorImage = '', sizeName = '' } = req.body;
  const sessionId = req.headers['x-session-id'] || req.sessionID;
  const userId = req.user?.id || null;

  // Check if product exists
  db.query('SELECT id FROM products WHERE id = ?', [productId], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ error: 'Product not found' });

    // Check if already in cart (match by product_id AND color AND size so same product different color/size = separate entry)
    db.query('SELECT id, quantity FROM cart WHERE (session_id = ? OR user_id = ?) AND product_id = ? AND product_color = ? AND product_size = ?',
      [sessionId, userId, productId, colorName, sizeName],
      (err, existing) => {
        if (err) return res.status(500).json({ error: err.message });

        if (existing.length > 0) {
          db.query('UPDATE cart SET quantity = quantity + ? WHERE id = ?',
            [quantity, existing[0].id],
            (err) => {
              if (err) return res.status(500).json({ error: err.message });
              res.json({ message: 'Cart updated' });
            }
          );
        } else {
          db.query('INSERT INTO cart (session_id, user_id, product_id, quantity, product_color, product_color_image, product_size) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [sessionId, userId || null, productId, quantity, colorName, colorImage, sizeName],
            (err) => {
              if (err) return res.status(500).json({ error: err.message });
              res.json({ message: 'Added to cart' });
            }
          );
        }
      }
    );
  });
});

// Update Cart Quantity
app.put('/api/cart/:id', optionalAuth, (req, res) => {
  const { quantity } = req.body;
  const sessionId = req.headers['x-session-id'] || req.sessionID;
  const userId = req.user?.id || null;

  if (quantity <= 0) {
    db.query('DELETE FROM cart WHERE id = ? AND (session_id = ? OR user_id = ?)',
      [req.params.id, sessionId, userId],
      (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Item removed' });
      }
    );
  } else {
    db.query('UPDATE cart SET quantity = ? WHERE id = ? AND (session_id = ? OR user_id = ?)',
      [quantity, req.params.id, sessionId, userId],
      (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Cart updated' });
      }
    );
  }
});

// Remove from Cart
app.delete('/api/cart/:id', optionalAuth, (req, res) => {
  const sessionId = req.headers['x-session-id'] || req.sessionID;
  const userId = req.user?.id || null;

  db.query('DELETE FROM cart WHERE id = ? AND (session_id = ? OR user_id = ?)',
    [req.params.id, sessionId, userId],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Item removed' });
    }
  );
});

// Clear Cart
app.delete('/api/cart', optionalAuth, (req, res) => {
  const sessionId = req.headers['x-session-id'] || req.sessionID;
  const userId = req.user?.id || null;

  db.query('DELETE FROM cart WHERE session_id = ? OR user_id = ?',
    [sessionId, userId],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Cart cleared' });
    }
  );
});

// Get Wishlist
app.get('/api/wishlist', optionalAuth, (req, res) => {
  const sessionId = req.headers['x-session-id'] || req.sessionID;
  const userId = req.user?.id || null;

  db.query(`
    SELECT w.id, p.id as product_id, p.name, p.price, p.original_price, p.image, p.tag, p.rating
    FROM wishlist w
    JOIN products p ON w.product_id = p.id
    WHERE ${userId ? '(w.user_id = ? OR (w.session_id = ? AND w.user_id IS NULL))' : '(w.session_id = ? AND w.user_id IS NULL)'}
  `, userId ? [userId, sessionId] : [sessionId], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Add to Wishlist
app.post('/api/wishlist', optionalAuth, (req, res) => {
  const { productId } = req.body;
  const sessionId = req.headers['x-session-id'] || req.sessionID;
  const userId = req.user?.id || null;

  db.query('SELECT id FROM products WHERE id = ?', [productId], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ error: 'Product not found' });

    db.query('SELECT id, session_id, user_id FROM wishlist WHERE product_id = ? AND (session_id = ? OR user_id = ?)',
      [productId, sessionId, userId],
      (err, existing) => {
        if (err) return res.status(500).json({ error: err.message });

        if (existing.length > 0) {
          const entry = existing[0];
          if (userId && entry.session_id === sessionId && !entry.user_id) {
            db.query('UPDATE wishlist SET user_id = ? WHERE id = ?', [userId, entry.id], (err) => {
              if (err) return res.status(500).json({ error: err.message });
              return res.json({ message: 'Added to wishlist' });
            });
          } else {
            return res.json({ message: 'Already in wishlist' });
          }
        } else {
          db.query('INSERT INTO wishlist (session_id, user_id, product_id) VALUES (?, ?, ?)',
            [sessionId, userId || null, productId],
            (err) => {
              if (err) return res.status(500).json({ error: err.message });
              res.json({ message: 'Added to wishlist' });
            }
          );
        }
      }
    );
  });
});

// Remove from Wishlist
app.delete('/api/wishlist/:productId', optionalAuth, (req, res) => {
  const sessionId = req.headers['x-session-id'] || req.sessionID;
  const userId = req.user?.id || null;

  db.query('DELETE FROM wishlist WHERE product_id = ? AND (session_id = ? OR user_id = ?)',
    [req.params.productId, sessionId, userId],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Removed from wishlist' });
    }
  );
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

  // Ensure orders and order_items tables exist before placing order
  try {
    await db.promise().query(`CREATE TABLE IF NOT EXISTS orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT,
      idempotency_key VARCHAR(100) UNIQUE,
      customer_name VARCHAR(150),
      customer_email VARCHAR(255),
      customer_phone VARCHAR(30),
      payment_method VARCHAR(50) DEFAULT 'cod',
      payment_status VARCHAR(50) DEFAULT 'pending',
      total_amount DECIMAL(10,2) NOT NULL,
      status VARCHAR(50) DEFAULT 'pending',
      delivery_address TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await db.promise().query(`CREATE TABLE IF NOT EXISTS order_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id INT NOT NULL,
      product_id INT NOT NULL,
      product_name VARCHAR(255) DEFAULT '',
      quantity INT NOT NULL,
      price DECIMAL(10,2) NOT NULL,
      product_color VARCHAR(100) DEFAULT '',
      product_color_image VARCHAR(500) DEFAULT '',
      product_size VARCHAR(50) DEFAULT '',
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    )`);
  } catch (tableErr) {
    console.error('Order table creation error:', tableErr.message);
    return res.status(500).json({ error: 'Unable to place order. Please try again later.' });
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

  const connection = db.promise();
  let orderId;

  try {
    await connection.beginTransaction();
    const [result] = await connection.query(
      `INSERT INTO orders (
        user_id,
        idempotency_key,
        customer_name,
        customer_email,
        customer_phone,
        payment_method,
        payment_status,
        total_amount,
        delivery_address
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user?.id || null,
        orderKey,
        customerName,
        customerEmail,
        customerPhone,
        paymentMethod || 'cod',
        paymentMethod === 'cod' ? 'pending' : 'awaiting',
        totalAmount,
        address
      ]
    );
    orderId = result.insertId;

    for (const item of orderItems) {
      const [stockUpdate] = await connection.query(
        'UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?',
        [item.quantity, item.product_id, item.quantity]
      );
      if (stockUpdate.affectedRows === 0) {
        throw new Error(`Insufficient stock for product ${item.product_id}`);
      }
      await connection.query(
        'INSERT INTO order_items (order_id, product_id, product_name, quantity, price, product_color, product_color_image, product_size) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [orderId, item.product_id, item.name || `Product #${item.product_id}`, item.quantity, item.price, item.product_color, item.product_color_image, item.product_size]
      );
    }

    await connection.query(
      'DELETE FROM cart WHERE session_id = ? OR user_id = ?',
      [sessionId, req.user?.id || null]
    );

    // Auto-save delivery address to user's saved addresses (deduplicated)
    if (req.user?.id && address) {
      const savedAddress = streetAddress || address;
      await connection.query(
        `INSERT IGNORE INTO saved_addresses (user_id, label, customer_name, customer_email, address, house_no, street, locality, city, state, pincode, landmark, phone)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.user.id,
          'Order Address',
          customerName || '',
          customerEmail || '',
          savedAddress,
          house_no || '',
          street || '',
          locality || '',
          city || '',
          state || '',
          pincode || '',
          landmark || '',
          customerPhone || ''
        ]
      ).catch(() => {}); // Silently fail if address save fails
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    if (orderKey && error.code === 'ER_DUP_ENTRY') {
      const [existingOrders] = await connection.query(
        'SELECT id FROM orders WHERE idempotency_key = ? LIMIT 1',
        [orderKey]
      );
      if (existingOrders.length > 0) {
        return res.json({
          message: 'Order already placed',
          orderId: existingOrders[0].id,
          duplicate: true
        });
      }
    }
    console.error('Order placement error:', error.message);
    return res.status(500).json({ error: 'Unable to place order. Please try again later.' });
  }

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
});

// Get Orders
app.get('/api/orders', authenticateToken, (req, res) => {
  db.query(`
    SELECT o.id, o.total_amount, o.status, o.created_at,
    JSON_ARRAYAGG(JSON_OBJECT(
      'product_name', COALESCE(oi.product_name, p.name, CONCAT('Product #', oi.product_id)),
      'quantity', oi.quantity,
      'price', oi.price,
      'product_color', oi.product_color,
      'product_color_image', oi.product_color_image,
      'product_size', oi.product_size
    )) as items
    FROM orders o
    LEFT JOIN order_items oi ON o.id = oi.order_id
    LEFT JOIN products p ON oi.product_id = p.id
    WHERE o.user_id = ?
    GROUP BY o.id
    ORDER BY o.created_at DESC
  `, [req.user.id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Submit Query Form
app.post('/api/submit-query', async (req, res) => {
  const { name, email, message } = req.body;

  // Log incoming request details to help debug modal submissions
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
initDatabase();

const server = app.listen(PORT, () => {
  console.log(`MXERA Server running on http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. If you want to use a different port, update PORT in .env or stop the process currently using port ${PORT}.`);
    process.exit(1);
  }
  throw err;
});
