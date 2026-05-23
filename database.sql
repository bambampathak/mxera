-- MXERA Database Schema for MySQL Workbench

-- Create database
CREATE DATABASE IF NOT EXISTS mxera;
USE mxera;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  address TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
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
);

-- Cart table
CREATE TABLE IF NOT EXISTS cart (
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
);

-- Wishlist table
CREATE TABLE IF NOT EXISTS wishlist (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  session_id VARCHAR(100),
  product_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
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
);

-- Order items table
CREATE TABLE IF NOT EXISTS order_items (
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
);

-- Password resets table
CREATE TABLE IF NOT EXISTS password_resets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(255) NOT NULL,
  expires_at BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (token),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Saved addresses table
CREATE TABLE IF NOT EXISTS saved_addresses (
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
  customer_name VARCHAR(150) DEFAULT '',
  customer_email VARCHAR(255) DEFAULT '',
  is_default TINYINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Insert sample products
INSERT INTO products (name, tag, description, price, original_price, rating, reviews, badge, image, category) VALUES
('Stealth Cooling Jacket', 'MXERA PERFORMANCE', 'Temperature adaptive smart fabric engineered for high-intensity mobility.', 4999, 6999, 4.9, 234, 'HOT', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=1600&auto=format&fit=crop', 'clothing'),
('Anti-Loss Tracker Pro', 'SMART TECH', 'Ultra compact encrypted tracking system with real-time sync technology.', 1499, 2499, 4.7, 156, 'NEW', 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?q=80&w=1600&auto=format&fit=crop', 'tech'),
('Riding Chest Rig X', 'TACTICAL SERIES', 'Lightweight tactical storage platform optimized for urban riders.', 2899, 3999, 4.8, 89, 'LIMITED', 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?q=80&w=1600&auto=format&fit=crop', 'gear'),
('Phantom Smart Watch', 'Wearable Tech', 'Advanced biometric monitoring with holographic display interface.', 8999, 12999, 4.9, 412, 'BEST', 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=1600&auto=format&fit=crop', 'tech'),
('Stealth Runner Pro', 'ATHLETIC', 'Zero-gravity cushioning with adaptive strike technology.', 5999, 8999, 4.8, 321, 'SALE', 'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?q=80&w=1600&auto=format&fit=crop', 'clothing'),
('Urban Messenger Bag', 'TACTICAL SERIES', 'Water-resistant modular design with anti-theft protection.', 3499, 4999, 4.6, 178, NULL, 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?q=80&w=1600&auto=format&fit=crop', 'gear'),
('Quantum Headphones', 'AUDIO', 'Premium noise-cancelling with spatial audio technology.', 7999, 9999, 4.9, 567, 'HOT', 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=1600&auto=format&fit=crop', 'tech'),
('Titanium Frame Sunglasses', 'ACCESSORIES', 'Ultra-lightweight titanium frames with polarized lenses.', 2499, 3999, 4.7, 198, 'SALE', 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?q=80&w=1600&auto=format&fit=crop', 'gear');
