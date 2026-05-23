// API Base URL — prefer same origin, fallback to localhost:5000
const API_URL = (window.location && window.location.origin && window.location.origin !== 'null')
  ? `${window.location.origin}/api`
  : 'http://localhost:5000/api';

// Session ID for guest users
let sessionId = localStorage.getItem('mxera_session_id');
if (!sessionId) {
  sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  localStorage.setItem('mxera_session_id', sessionId);
}

// Global State
let products = [];
let cart = [];
let wishlist = [];
let currentLocation = "Select Location";
let isLoggedIn = false;
let authToken = localStorage.getItem('mxera_token');
let isOrderSubmitting = false;
let checkoutOrderKey = '';

// DOM Elements
const productGrid = document.getElementById('product-grid');
const cartOverlay = document.getElementById('cart-overlay');
const cartSidebar = document.getElementById('cart-sidebar');
const cartItemsContainer = document.getElementById('cart-items');
const cartCount = document.getElementById('cart-count');
const cartTotal = document.getElementById('cart-total');
const notification = document.getElementById('notification');
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const navLinks = document.querySelector('.nav-links');
const filterBtns = document.querySelectorAll('.filter-btn');
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
const locationBar = document.getElementById('location-bar');
const locationModal = document.getElementById('location-modal');
const locationOptions = document.getElementById('location-options');
const loginOverlay = document.getElementById('login-overlay');
const loginTabs = document.querySelectorAll('.login-tab');
const loginNameField = document.getElementById('login-name-field');
const signupGenderField = document.getElementById('signup-gender-field');
const loginPhoneField = document.getElementById('login-phone-field');
const loginRememberRow = document.getElementById('login-remember-row');
const loginHeaderTitle = document.querySelector('.login-header h2');
const loginSubmitBtn = document.querySelector('.login-submit');
const authEmailInput = document.getElementById('auth-email-input');
const authPasswordInput = document.getElementById('auth-password-input');
const signupConfirmPasswordField = document.getElementById('signup-password-confirm-field');
const signupConfirmPasswordInput = document.getElementById('signup-confirm-password-input');
const signupGenderSelect = document.getElementById('signup-gender');
const signupPhoneInput = document.getElementById('signup-phone-input');
const otpSection = document.getElementById('signup-otp-section');
const otpInput = document.getElementById('signup-otp-input');
const otpInstructions = document.getElementById('signup-otp-instructions');
const resendOtpBtn = document.getElementById('resend-otp-btn');
const navUserName = document.getElementById('nav-user-name');
let authMode = 'login';
let otpSent = false;
const wishlistSidebar = document.getElementById('wishlist-sidebar');
const wishlistOverlay = document.getElementById('wishlist-overlay');
const wishlistItems = document.getElementById('wishlist-items');
const wishlistCount = document.getElementById('wishlist-count');

// HTML escaping utility
function escaped(value) {
  if (value == null) return '';
  var amp = '&', lt = '<', gt = '>', quot = '"';
  var apos = '&#' + '39;';
  return String(value).replace(/[&<>"']/g, function(ch) {
    if (ch === '&') return amp;
    if (ch === '<') return lt;
    if (ch === '>') return gt;
    if (ch === '"') return quot;
    return apos;
  });
}

// Popular Cities
const popularCities = [
  { name: "Mumbai, Maharashtra" },
  { name: "Delhi, NCR" },
  { name: "Bangalore, Karnataka" },
  { name: "Chennai, Tamil Nadu" },
  { name: "Hyderabad, Telangana" },
  { name: "Kolkata, West Bengal" },
  { name: "Pune, Maharashtra" },
  { name: "Ahmedabad, Gujarat" }
];

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await fetchProducts();
  await fetchCart();
  await fetchWishlist();
  renderLocationOptions();

  const savedLocation = localStorage.getItem('mxera_location');
  if (savedLocation) {
    currentLocation = savedLocation;
    locationBar.querySelector('strong').textContent = savedLocation;
  }

  checkLoginState();
});

// Sample Products Fallback — enriched with product detail data
const sampleProducts = [
  {
    id: 1, name: "MX-01 TACTICAL JACKET", tag: "BEST SELLER", category: "clothing",
    image: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400&h=500&fit=crop",
    price: 8999, original_price: 12999, rating: 4.8, reviews: 234,
    description: "Premium tactical jacket with water-resistant technology", badge: "40% OFF",
    images: [
      "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600&h=700&fit=crop",
      "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600&h=700&fit=crop",
      "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=600&h=700&fit=crop",
      "https://images.unsplash.com/photo-1544923246-77307dd270b6?w=600&h=700&fit=crop"
    ],
    sizes: ["S", "M", "L", "XL", "XXL"],
    colors: ["Black", "Olive Green", "Charcoal"],
    color_hex: ["#0a0a0a", "#556b2f", "#36454f"],
    specifications: [
      { label: "Material", value: "Premium Nylon Blend with Water-Resistant Coating" },
      { label: "Fit", value: "Regular Fit" },
      { label: "Closure", value: "YKK Zipper Front" },
      { label: "Pockets", value: "6 External, 4 Internal" },
      { label: "Weight", value: "850g" },
      { label: "Care", value: "Machine Wash Cold" }
    ],
    reviews_data: [
      { name: "Arjun M.", rating: 5, date: "2026-03-15", comment: "Absolutely premium quality! The water resistance is incredible." },
      { name: "Priya S.", rating: 4, date: "2026-02-28", comment: "Great jacket, fits perfectly. Love the tactical look." },
      { name: "Rahul K.", rating: 5, date: "2026-01-20", comment: "Best purchase this year. Worth every penny!" }
    ]
  },
  {
    id: 2, name: "STEALTH PRO HOODIE", tag: "NEW ARRIVAL", category: "clothing",
    image: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400&h=500&fit=crop",
    price: 4599, original_price: 6999, rating: 4.9, reviews: 189,
    description: "Premium cotton blend hoodie with minimalist design", badge: "NEW",
    images: [
      "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=600&h=700&fit=crop",
      "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=600&h=700&fit=crop",
      "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&h=700&fit=crop"
    ],
    sizes: ["S", "M", "L", "XL"],
    colors: ["Black", "White", "Grey"],
    color_hex: ["#0a0a0a", "#f0f0f0", "#808080"],
    specifications: [
      { label: "Material", value: "Premium 400GSM Organic Cotton" },
      { label: "Fit", value: "Oversized Relaxed Fit" },
      { label: "Hood", value: "Adjustable Drawstring Hood" },
      { label: "Weight", value: "620g" },
      { label: "Care", value: "Machine Wash Cold, Tumble Dry Low" }
    ],
    reviews_data: [
      { name: "Neha V.", rating: 5, date: "2026-03-10", comment: "Super soft and fits great! The oversized look is perfect." },
      { name: "Vikram D.", rating: 5, date: "2026-02-14", comment: "Best hoodie I've ever owned. Quality is unmatched." }
    ]
  },
  {
    id: 3, name: "QUANTUM SMART WATCH", tag: "TECH", category: "tech",
    image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=500&fit=crop",
    price: 12999, original_price: 17999, rating: 4.7, reviews: 412,
    description: "Advanced smartwatch with health monitoring", badge: "28% OFF",
    images: [
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&h=700&fit=crop",
      "https://images.unsplash.com/photo-1546868871-af0de0ae72f3?w=600&h=700&fit=crop",
      "https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=600&h=700&fit=crop"
    ],
    colors: ["Midnight Black", "Silver", "Titanium"],
    color_hex: ["#1a1a2e", "#c0c0c0", "#8a7f6e"],
    specifications: [
      { label: "Display", value: "1.5\" AMOLED, Always-On Display" },
      { label: "Processor", value: "Snapdragon W5+ Gen 1" },
      { label: "Battery", value: "500mAh — 7 Days Typical Use" },
      { label: "Water Resistance", value: "5 ATM / IP68" },
      { label: "Sensors", value: "Heart Rate, SpO2, Accelerometer, Gyroscope" },
      { label: "Compatibility", value: "Android 8+ / iOS 15+" }
    ],
    reviews_data: [
      { name: "Amit P.", rating: 5, date: "2026-03-20", comment: "Incredible battery life and the display is stunning!" },
      { name: "Sneha R.", rating: 4, date: "2026-02-05", comment: "Great smartwatch, health tracking is very accurate." },
      { name: "Karan J.", rating: 5, date: "2026-01-12", comment: "Worth every rupee. Premium build quality." }
    ]
  },
  {
    id: 4, name: "NEXUS WIRELESS BUDS", tag: "TECH", category: "tech",
    image: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400&h=500&fit=crop",
    price: 2999, original_price: 4999, rating: 4.5, reviews: 567,
    description: "Premium noise-cancelling wireless earbuds", badge: "40% OFF",
    images: [
      "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&h=700&fit=crop",
      "https://images.unsplash.com/photo-1598331668826-20cecc596b9b?w=600&h=700&fit=crop",
      "https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=600&h=700&fit=crop"
    ],
    colors: ["Matte Black", "Pearl White"],
    color_hex: ["#1c1c1c", "#f5f5f0"],
    specifications: [
      { label: "Driver", value: "12mm Dynamic Drivers" },
      { label: "Noise Cancellation", value: "Adaptive ANC up to 40dB" },
      { label: "Battery Life", value: "8H (Buds) + 32H (Case)" },
      { label: "Connectivity", value: "Bluetooth 5.3, Multipoint Connection" },
      { label: "Water Resistance", value: "IPX5" },
      { label: "Charging", value: "USB-C & Wireless Charging" }
    ],
    reviews_data: [
      { name: "Divya K.", rating: 5, date: "2026-03-25", comment: "Amazing sound quality and the ANC is top-notch!" },
      { name: "Rohit S.", rating: 4, date: "2026-02-18", comment: "Great value for money. Battery lasts really long." },
      { name: "Ananya M.", rating: 4, date: "2026-01-30", comment: "Comfortable fit, great for workouts too." }
    ]
  },
  {
    id: 5, name: "TACTICAL BACKPACK", tag: "GEAR", category: "gear",
    image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=500&fit=crop",
    price: 3499, original_price: 4999, rating: 4.6, reviews: 321,
    description: "Durable backpack with laptop compartment", badge: "30% OFF",
    images: [
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&h=700&fit=crop",
      "https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?w=600&h=700&fit=crop",
      "https://images.unsplash.com/photo-1581605405669-fcdf81165afa?w=600&h=700&fit=crop"
    ],
    colors: ["Tactical Black", "Coyote Brown"],
    color_hex: ["#0d0d0d", "#8b7355"],
    specifications: [
      { label: "Capacity", value: "35L — Ideal for Daily & Travel" },
      { label: "Laptop Compartment", value: "Fits up to 16\" Laptop" },
      { label: "Material", value: "1680D Ballistic Nylon" },
      { label: "Pockets", value: "12 Organizer Pockets + Hidden Security Pocket" },
      { label: "Weight", value: "1.2kg" },
      { label: "Water Resistance", value: "Water-Repellent Coating + Rain Cover Included" }
    ],
    reviews_data: [
      { name: "Siddharth G.", rating: 5, date: "2026-03-08", comment: "Incredible build quality. So many compartments!" },
      { name: "Meera L.", rating: 4, date: "2026-02-22", comment: "Perfect for college and travel. Very comfortable." }
    ]
  },
  {
    id: 6, name: "CARBON FIBER WALLET", tag: "GEAR", category: "gear",
    image: "https://images.unsplash.com/photo-1627123424574-724758594e93?w=400&h=500&fit=crop",
    price: 1899, original_price: 2499, rating: 4.4, reviews: 156,
    description: "Slim wallet with RFID protection", badge: "24% OFF",
    images: [
      "https://images.unsplash.com/photo-1627123424574-724758594e93?w=600&h=700&fit=crop",
      "https://images.unsplash.com/photo-1606503825008-909a67e63c3d?w=600&h=700&fit=crop",
      "https://images.unsplash.com/photo-1607025964793-36fa9cb76186?w=600&h=700&fit=crop"
    ],
    colors: ["Carbon Black", "Silver Weave"],
    color_hex: ["#1a1a1a", "#a8a8a8"],
    specifications: [
      { label: "Material", value: "Forged Carbon Fiber / Aerospace-Grade Aluminum" },
      { label: "Capacity", value: "Holds 8-12 Cards + Cash" },
      { label: "RFID Protection", value: "Yes — Blocks RFID/NFC Scanning" },
      { label: "Weight", value: "38g — Ultra Lightweight" },
      { label: "Dimensions", value: "4.1\" x 2.6\" x 0.3\"" }
    ],
    reviews_data: [
      { name: "Tanmay B.", rating: 5, date: "2026-03-05", comment: "So sleek and lightweight. RFID protection gives peace of mind." },
      { name: "Isha T.", rating: 4, date: "2026-01-15", comment: "Beautiful design, fits perfectly in front pocket." }
    ]
  },
  {
    id: 7, name: "PHANTOM RUNNERS", tag: "NEW ARRIVAL", category: "clothing",
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=500&fit=crop",
    price: 6599, original_price: 8999, rating: 4.8, reviews: 278,
    description: "Performance running shoes with adaptive fit", badge: "27% OFF",
    images: [
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&h=700&fit=crop",
      "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=600&h=700&fit=crop",
      "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=600&h=700&fit=crop"
    ],
    sizes: ["UK 7", "UK 8", "UK 9", "UK 10", "UK 11", "UK 12"],
    colors: ["Phantom Black", "Storm White", "Neon Red"],
    color_hex: ["#121212", "#e8e8e8", "#ff2a2a"],
    specifications: [
      { label: "Sole Technology", value: "ReactX Foam + Carbon Fiber Plate" },
      { label: "Upper Material", value: "Engineered Mesh with Flywire Cables" },
      { label: "Closure", value: "Lace-Up with Quick-Lock System" },
      { label: "Weight", value: "240g (UK 9)" },
      { label: "Drop", value: "8mm Heel-to-Toe Drop" },
      { label: "Best For", value: "Road Running, Gym Training, Casual Wear" }
    ],
    reviews_data: [
      { name: "Arjun T.", rating: 5, date: "2026-03-28", comment: "Most comfortable running shoes I've ever worn! The carbon plate gives amazing energy return." },
      { name: "Riya S.", rating: 5, date: "2026-03-01", comment: "Look stunning and perform even better. My PB improved by 30 seconds!" },
      { name: "Dhruv M.", rating: 4, date: "2026-02-10", comment: "Great shoes, very lightweight and responsive." }
    ]
  },
  {
    id: 8, name: "SMART WATER BOTTLE", tag: "TECH", category: "tech",
    image: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=400&h=500&fit=crop",
    price: 1999, original_price: 2999, rating: 4.3, reviews: 189,
    description: "Temperature-controlled smart bottle", badge: "33% OFF",
    images: [
      "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600&h=700&fit=crop",
      "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=600&h=700&fit=crop",
      "https://images.unsplash.com/photo-1570831739435-6601aa3fa4fb?w=600&h=700&fit=crop"
    ],
    colors: ["Obsidian Black", "Frost White", "Ocean Blue"],
    color_hex: ["#0f0f0f", "#f8f8ff", "#1e90ff"],
    specifications: [
      { label: "Capacity", value: "750ml / 25 oz" },
      { label: "Temperature Retention", value: "24H Cold / 12H Hot (Double-Wall Vacuum)" },
      { label: "Material", value: "18/8 Stainless Steel (Interior) + BPA-Free Tritan (Smart Cap)" },
      { label: "Smart Features", value: "LED Temperature Display, Drink Reminder, App Connectivity" },
      { label: "Battery", value: "Built-in 200mAh — Lasts 30 Days Per Charge" },
      { label: "Charging", value: "Wireless Charging Base Included" }
    ],
    reviews_data: [
      { name: "Kavya N.", rating: 5, date: "2026-03-18", comment: "Love the temperature display! Keeps water cold all day." },
      { name: "Vivek P.", rating: 4, date: "2026-02-08", comment: "Great bottle, the drink reminder feature is a nice touch." }
    ]
  }
];

// Helper: normalize a product fetched from the DB (JSON strings → arrays, admin format → PDP format)
function normalizeProduct(p) {
  if (!p) return p;
  // Images
  if (typeof p.images === 'string') {
    try { p.images = JSON.parse(p.images); } catch (e) { p.images = null; }
  }
  // Sizes — stored as JSON array of strings
  if (typeof p.sizes === 'string') {
    try { p.sizes = JSON.parse(p.sizes); } catch (e) { p.sizes = null; }
  }
  // Colors — may be stored as [{name, hex, image}]; PDP expects string[] + color_hex[] + color_images[]
  if (typeof p.colors === 'string') {
    try {
      const parsed = JSON.parse(p.colors);
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object') {
        p.colors = parsed.map(c => c.name);
        p.color_hex = parsed.map(c => c.hex || '#ccc');
        p.color_images = parsed.map(c => c.image || null);
      } else {
        p.colors = parsed;
      }
    } catch (e) { p.colors = null; }
  }
  // Specifications — stored as [{key, value}]; PDP expects [{label, value}]
  if (typeof p.specifications === 'string') {
    try {
      const parsed = JSON.parse(p.specifications);
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object') {
        p.specifications = parsed.map(s => ({ label: s.key || s.label, value: s.value }));
      } else {
        p.specifications = parsed;
      }
    } catch (e) { p.specifications = null; }
  }
  // Ensure `id` is available (map MongoDB `_id` to `id`)
  if (p._id) p.id = String(p._id);
  return p;
}

// API Functions
async function fetchProducts(category = 'all', search = '') {
  try {
    const params = new URLSearchParams();
    if (category !== 'all') params.append('category', category);
    if (search) params.append('search', search);

    const response = await fetch(`${API_URL}/products?${params}`);
    if (!response.ok) throw new Error('API error');
    products = (await response.json()).map(normalizeProduct);
    renderProducts(products);
  } catch (error) {
    console.warn('API unavailable, using sample products:', error);
    // Filter sample products locally
    let filtered = [...sampleProducts];
    if (category !== 'all') {
      filtered = filtered.filter(p => p.category === category);
    }
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
      );
    }
    products = filtered;
    renderProducts(products);
  }
}

async function fetchCart() {
  try {
    const response = await fetch(`${API_URL}/cart`, {
      headers: buildHeaders()
    });
    cart = await response.json();
    updateCartUI();
  } catch (error) {
    console.error('Error fetching cart:', error);
  }
}

async function fetchWishlist() {
  try {
    const response = await fetch(`${API_URL}/wishlist`, {
      headers: buildHeaders()
    });
    wishlist = await response.json();
    updateWishlistUI();
  } catch (error) {
    console.error('Error fetching wishlist:', error);
  }
}

// Render Products
function renderProducts(productsToRender) {
  productGrid.innerHTML = productsToRender.map(product => {
    const isInWishlist = wishlist.some(item => item.product_id === product.id);
    const isOutOfStock = product.out_of_stock == 1;
    return `
      <div class="product-card ${isOutOfStock ? 'out-of-stock' : ''}" data-category="${product.category}" onclick="openProductDetail(${JSON.stringify(product.id)})" style="cursor:pointer;">
        <div class="product-image">
          <img src="${product.image}" alt="${product.name}" loading="lazy" width="400" height="500">
          ${product.badge ? `<span class="product-badge">${product.badge}</span>` : ''}
          ${isOutOfStock ? '<div class="out-of-stock-overlay"><span>OUT OF STOCK</span></div>' : ''}
          <div class="product-actions" onclick="event.stopPropagation();">
            <button class="product-action-btn ${isInWishlist ? 'active' : ''}" onclick="toggleWishlist(${JSON.stringify(product.id)})" title="${isInWishlist ? 'Remove from Wishlist' : 'Add to Wishlist'}">
              <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" ${isInWishlist ? 'fill="currentColor"' : ''}></path></svg>
            </button>
            <button class="product-action-btn" onclick="quickView(${JSON.stringify(product.id)})" title="Quick View">
              <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            </button>
          </div>
        </div>
        <div class="product-info">
          <span class="tag">${product.tag}</span>
          <h3>${product.name}</h3>
          <div class="rating">
            <div class="rating-stars">${renderStars(product.rating)}</div>
            <span>${product.rating} (${product.reviews} reviews)</span>
          </div>
          <p>${product.description}</p>
          <div class="product-bottom">
            <div>
              <span class="price">₹${parseInt(product.price).toLocaleString()}</span>
              ${product.original_price ? `<span class="price-original">₹${parseInt(product.original_price).toLocaleString()}</span>` : ''}
            </div>
            <button class="buy-btn" onclick="event.stopPropagation();${isOutOfStock ? 'showNotification(\'This product is out of stock\')' : 'addToCart(' + JSON.stringify(product.id) + ')'}">${isOutOfStock ? 'OUT OF STOCK' : 'ADD TO CART'}</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Add to Cart
async function addToCart(productId, colorName, colorImage, sizeName) {
  try {
    const response = await fetch(`${API_URL}/cart`, {
      method: 'POST',
      headers: {
        ...buildHeaders()
      },
      body: JSON.stringify({ productId, quantity: 1, colorName, colorImage, sizeName: sizeName || '' })
    });

    const data = await response.json();
    if (response.ok) {
      await fetchCart();
      const product = products.find(p => p.id === productId);
      showNotification(`${product.name} added to cart!`);
    } else {
      showNotification(data.error || 'Failed to add to cart');
    }
  } catch (error) {
    console.error('Error adding to cart:', error);
    showNotification('Failed to add to cart');
  }
}

// Update Cart UI
function updateCartUI() {
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  cartCount.textContent = totalItems;
  cartTotal.textContent = `₹${totalPrice.toLocaleString()}`;

  if (cart.length === 0) {
    cartItemsContainer.innerHTML = `
      <div class="cart-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="9" cy="21" r="1"></circle>
          <circle cx="20" cy="21" r="1"></circle>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
        </svg>
        <p>Your cart is empty</p>
      </div>
    `;
  } else {
    cartItemsContainer.innerHTML = cart.map(item => `
      <div class="cart-item">
        <div class="cart-item-image">
          <img src="${item.image}" alt="${item.name}" loading="lazy" width="80" height="80">
        </div>
        <div class="cart-item-info">
          <h3>${item.name}</h3>
          ${item.product_color ? `<p class="cart-item-color" style="font-size:12px;color:#888;">${item.product_color_image ? `<img src="${escaped(item.product_color_image)}" alt="" loading="lazy" style="width:20px;height:20px;border-radius:3px;vertical-align:middle;margin-right:4px;">` : ''}Color: ${escaped(item.product_color)}</p>` : ''}
          ${item.product_size ? `<p class="cart-item-size" style="font-size:12px;color:#888;">Size: ${escaped(item.product_size)}</p>` : ''}
          <p>₹${parseInt(item.price).toLocaleString()}</p>
          <div class="cart-item-qty">
            <button class="qty-btn" onclick="updateQuantity(${item.id}, -1)">
              <svg viewBox="0 0 24 24"><path d="M5 12h14"></path></svg>
            </button>
            <span>${item.quantity}</span>
            <button class="qty-btn" onclick="updateQuantity(${item.id}, 1)">
              <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"></path></svg>
            </button>
          </div>
        </div>
        <button class="cart-item-remove" onclick="removeFromCart(${item.id})">
          <svg viewBox="0 0 24 24"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </div>
    `).join('');
  }
}

// Update Quantity
async function updateQuantity(cartId, change) {
  const item = cart.find(i => i.id === cartId);
  if (item) {
    const newQty = item.quantity + change;
    try {
      const response = await fetch(`${API_URL}/cart/${cartId}`, {
        method: 'PUT',
        headers: {
          ...buildHeaders()
        },
        body: JSON.stringify({ quantity: newQty })
      });
      if (response.ok) {
        await fetchCart();
      }
    } catch (error) {
      console.error('Error updating quantity:', error);
    }
  }
}

// Remove from Cart
async function removeFromCart(cartId) {
  try {
    const response = await fetch(`${API_URL}/cart/${cartId}`, {
      method: 'DELETE',
      headers: buildHeaders()
    });
    if (response.ok) {
      await fetchCart();
    }
  } catch (error) {
    console.error('Error removing from cart:', error);
  }
}

// Cart Toggle
function openCart() {
  closeWishlist();
  closeLogin();
  cartOverlay.classList.add('active');
  cartSidebar.classList.add('active');
}

function closeCart() {
  cartOverlay.classList.remove('active');
  cartSidebar.classList.remove('active');
}

// Checkout Functions
function openCheckout() {
  if (cart.length === 0) {
    showNotification('Your cart is empty!');
    return;
  }
  
  // Require login to proceed to checkout
  if (!authToken) {
    showNotification('Please login to place an order');
    openLogin();
    return;
  }
  
  closeCart();
  checkoutOrderKey = createOrderKey();
  setOrderSubmitState(false);
  
  // Populate checkout form with cart items
  const checkoutItemsDiv = document.getElementById('checkout-items');
  checkoutItemsDiv.innerHTML = cart.map(item => `
    <div class="checkout-item">
      <div class="checkout-item-details">
        <div class="checkout-item-name">${item.name}</div>
        ${item.product_color ? `<div class="checkout-item-color" style="font-size:12px;color:#888;">${item.product_color_image ? `<img src="${escaped(item.product_color_image)}" alt="" loading="lazy" style="width:20px;height:20px;border-radius:3px;vertical-align:middle;margin-right:4px;">` : ''}Color: ${escaped(item.product_color)}</div>` : ''}
        ${item.product_size ? `<div class="checkout-item-size" style="font-size:12px;color:#888;">Size: ${escaped(item.product_size)}</div>` : ''}
        <div class="checkout-item-qty">Qty: ${item.quantity}</div>
      </div>
      <div class="checkout-item-price">₹${(item.price * item.quantity).toLocaleString()}</div>
    </div>
  `).join('');
  
  // Calculate totals
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  document.getElementById('checkout-subtotal').textContent = `₹${subtotal.toLocaleString()}`;
  document.getElementById('checkout-total').textContent = `₹${subtotal.toLocaleString()}`;
  
  // Load saved addresses if logged in
  loadSavedAddresses();
  
  // Show checkout modal
  document.getElementById('checkout-overlay').classList.add('active');
}


// Load saved addresses for the current user
async function loadSavedAddresses() {
  const section = document.getElementById('saved-addresses-section');
  const list = document.getElementById('saved-addresses-list');
  
  // Hide section if not logged in
  if (!authToken) {
    section.style.display = 'none';
    return;
  }
  
  try {
    const response = await fetch(`${API_URL}/saved-addresses`, {
      headers: buildHeaders()
    });
    
    if (!response.ok) {
      section.style.display = 'none';
      return;
    }
    
    const addresses = await response.json();
    
    if (!addresses.length) {
      section.style.display = 'none';
      return;
    }
    
    section.style.display = 'block';
    list.innerHTML = addresses.map(addr => `
      <label class="saved-address-item ${addr.is_default ? 'default' : ''}"
             data-customer-name="${escaped(addr.customer_name || '')}"
             data-customer-email="${escaped(addr.customer_email || '')}"
             data-phone="${escaped(addr.phone || '')}"
             data-address="${escaped(addr.address)}"
             data-house-no="${escaped(addr.house_no || '')}"
             data-street="${escaped(addr.street || '')}"
             data-locality="${escaped(addr.locality || '')}"
             data-city="${escaped(addr.city || '')}"
             data-pincode="${escaped(addr.pincode || '')}"
             data-state="${escaped(addr.state || '')}"
             data-landmark="${escaped(addr.landmark || '')}">
        <input type="radio" name="saved-address" value="${addr.id}" ${addr.is_default ? 'checked' : ''} onchange="fillFromSavedAddress(${addr.id})">
        <div class="saved-address-details">
          <div class="saved-address-label">${escaped(addr.label)} ${addr.is_default ? '<span class="default-badge">DEFAULT</span>' : ''}</div>
          <div class="saved-address-text">${escaped(addr.house_no || addr.address)}${addr.street ? ', ' + escaped(addr.street) : ''}${addr.locality ? ', ' + escaped(addr.locality) : ''}</div>
          <div class="saved-address-meta">
            ${addr.customer_name ? escaped(addr.customer_name) + ' &middot; ' : ''}
            ${escaped(addr.city)} - ${escaped(addr.pincode)}
            ${addr.phone ? ' | ' + escaped(addr.phone) : ''}
          </div>
          <div class="saved-address-state">
            ${escaped(addr.state)}${addr.landmark ? ' | ' + escaped(addr.landmark) : ''}
          </div>
        </div>
      </label>
    `).join('');
    
    // Auto-fill from the default address
    const defaultAddr = addresses.find(a => a.is_default) || addresses[0];
    if (defaultAddr) {
      fillFromSavedAddress(defaultAddr.id);
    }
  } catch (err) {
    console.error('Failed to load saved addresses:', err);
    section.style.display = 'none';
  }
}

// Fill checkout form from a saved address
function fillFromSavedAddress(addressId) {
  if (!addressId) return;
  
  const selectedLabel = document.querySelector(`input[name="saved-address"][value="${addressId}"]`);
  if (!selectedLabel) return;
  
  const item = selectedLabel.closest('.saved-address-item');
  if (!item) return;
  
  // Read from data attributes for accuracy
  const name = item.getAttribute('data-customer-name') || '';
  const email = item.getAttribute('data-customer-email') || '';
  const phone = item.getAttribute('data-phone') || '';
  const house_no = item.getAttribute('data-house-no') || '';
  const street = item.getAttribute('data-street') || '';
  const locality = item.getAttribute('data-locality') || '';
  const city = item.getAttribute('data-city') || '';
  const pincode = item.getAttribute('data-pincode') || '';
  const state = item.getAttribute('data-state') || '';
  const landmark = item.getAttribute('data-landmark') || '';
  
  document.getElementById('checkout-name').value = name;
  document.getElementById('checkout-email').value = email;
  document.getElementById('checkout-phone').value = phone;
  document.getElementById('checkout-house-no').value = house_no;
  document.getElementById('checkout-street').value = street;
  document.getElementById('checkout-locality').value = locality;
  document.getElementById('checkout-city').value = city;
  document.getElementById('checkout-pincode').value = pincode;
  document.getElementById('checkout-state').value = state;
  document.getElementById('checkout-landmark').value = landmark;
}

function closeCheckout(event) {
  if (event && event.target !== event.currentTarget) return;
  document.getElementById('checkout-overlay').classList.remove('active');
}

function createOrderKey() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return `order_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function setOrderSubmitState(isSubmitting) {
  isOrderSubmitting = isSubmitting;
  const placeOrderBtn = document.getElementById('place-order-btn');
  if (!placeOrderBtn) return;

  placeOrderBtn.disabled = isSubmitting;
  placeOrderBtn.textContent = isSubmitting ? 'PLACING ORDER...' : 'PLACE ORDER';
}

async function handleCheckoutSubmit(e) {
  e.preventDefault();

  if (isOrderSubmitting) {
    return;
  }
  
  const name = document.getElementById('checkout-name').value;
  const phone = document.getElementById('checkout-phone').value;
  const email = document.getElementById('checkout-email').value.trim();
  const house_no = document.getElementById('checkout-house-no').value;
  const street = document.getElementById('checkout-street').value;
  const locality = document.getElementById('checkout-locality').value;
  const city = document.getElementById('checkout-city').value;
  const pincode = document.getElementById('checkout-pincode').value;
  const state = document.getElementById('checkout-state').value;
  const landmark = document.getElementById('checkout-landmark').value;
  const paymentMethod = document.querySelector('input[name="payment"]:checked').value;
  
  const fullAddress = `${house_no}, ${street}, ${locality}, ${city}, ${state} - ${pincode}${landmark ? ', ' + landmark : ''}`;
  
  if (!cart.length) {
    showNotification('Cart is empty!');
    return;
  }

  if (!checkoutOrderKey) {
    checkoutOrderKey = createOrderKey();
  }
  setOrderSubmitState(true);
  
  try {
    const orderHeaders = buildHeaders();
    orderHeaders['x-order-key'] = checkoutOrderKey;
    const response = await fetch(`${API_URL}/orders`, {
      method: 'POST',
      headers: orderHeaders,
      body: JSON.stringify({
        items: cart,
        address: fullAddress,
        streetAddress: `${house_no}, ${street}, ${locality}`,
        house_no: house_no,
        street: street,
        locality: locality,
        city: city,
        pincode: pincode,
        state: state,
        landmark: landmark,
        customerName: name,
        customerPhone: phone,
        customerEmail: email,
        paymentMethod: paymentMethod
      })
    });

    const data = await response.json();

    if (response.ok) {
      showNotification(`Order placed successfully! Order ID: ${data.orderId}`);
      if (data.notificationWarning) {
        console.warn(data.notificationWarning);
      }
      cart = [];
      await updateCartUI();
      closeCheckout();
      
      // Clear cart from database
      await fetch(`${API_URL}/cart`, {
        method: 'DELETE',
        headers: buildHeaders()
      });
      
      // Reset form
      document.getElementById('checkout-form').reset();
      checkoutOrderKey = '';
      
      // Redirect or show order confirmation after 2 seconds
      setTimeout(() => {
        showNotification('Thank you for your purchase!');
      }, 1000);
    } else {
      showNotification('Unable to place order. Please try again later.');
    }
  } catch (error) {
    console.error('Checkout error:', error);
    showNotification('Unable to place order. Please try again later.');
  } finally {
    setOrderSubmitState(false);
  }
}

// Wishlist Functions
async function toggleWishlist(productId) {
  const product = products.find(p => p.id === productId);
  const existing = wishlist.find(item => item.product_id === productId);

  try {
    if (existing) {
      await fetch(`${API_URL}/wishlist/${productId}`, {
        method: 'DELETE',
        headers: buildHeaders()
      });
      showNotification(`${product.name} removed from wishlist!`);
    } else {
      await fetch(`${API_URL}/wishlist`, {
        method: 'POST',
        headers: {
          ...buildHeaders()
        },
        body: JSON.stringify({ productId })
      });
      showNotification(`${product.name} added to wishlist!`);
    }
    await fetchWishlist();
    await fetchProducts();
  } catch (error) {
    console.error('Error toggling wishlist:', error);
  }
}

function updateWishlistUI() {
  wishlistCount.textContent = wishlist.length;

  if (wishlist.length === 0) {
    wishlistItems.innerHTML = `
      <div class="wishlist-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
        </svg>
        <p>Your wishlist is empty</p>
      </div>
    `;
  } else {
    wishlistItems.innerHTML = wishlist.map(item => `
      <div class="wishlist-item">
        <div class="wishlist-item-image">
          <img src="${item.image}" alt="${item.name}" loading="lazy" width="80" height="80">
        </div>
        <div class="wishlist-item-info">
          <h3>${item.name}</h3>
          <p>₹${parseInt(item.price).toLocaleString()}</p>
          <div class="wishlist-item-actions">
            <button class="wishlist-item-btn add-cart" onclick="addToCartFromWishlist(${item.product_id})">ADD TO CART</button>
            <button class="wishlist-item-btn remove" onclick="toggleWishlist(${item.product_id})">REMOVE</button>
          </div>
        </div>
      </div>
    `).join('');
  }
}

function addToCartFromWishlist(productId) {
  addToCart(productId);
}

function openWishlist() {
  closeCart();
  closeLogin();
  wishlistOverlay.classList.add('active');
  wishlistSidebar.classList.add('active');
}

function closeWishlist() {
  wishlistOverlay.classList.remove('active');
  wishlistSidebar.classList.remove('active');
}

// Login Functions
function updateUserUI(name) {
  navUserName.textContent = name ? `Hi, ${name}` : '';
  if (name) {
    document.getElementById('nav-login-btn').style.display = 'none';
    document.getElementById('nav-user-btn').style.display = 'inline-flex';
  } else {
    document.getElementById('nav-login-btn').style.display = 'flex';
    document.getElementById('nav-user-btn').style.display = 'none';
  }
  updateCartWishlistContext();
}

function checkLoginState() {
  if (authToken) {
    isLoggedIn = true;
    const savedName = localStorage.getItem('mxera_user_name');
    updateUserUI(savedName || 'User');
  } else {
    updateUserUI(null);
  }
}

function updateCartWishlistContext() {
  const cartCtx = document.getElementById('cart-context');
  const wishCtx = document.getElementById('wishlist-context');
  const savedName = localStorage.getItem('mxera_user_name');
  const label = isLoggedIn ? (savedName ? `Account: ${savedName}` : 'Account') : 'Guest';
  if (cartCtx) cartCtx.textContent = label;
  if (wishCtx) wishCtx.textContent = label;
}

function setLoginMode(mode) {
  mode = mode.trim().toLowerCase().replace(/\s+/g, '');
  authMode = mode;
  loginTabs.forEach(tab => {
    const isActive = tab.dataset.mode === mode || tab.textContent.trim().toLowerCase().replace(/\s+/g, '') === mode;
    tab.classList.toggle('active', isActive);
  });

  if (mode === 'signup') {
    loginHeaderTitle.textContent = 'Create Account';
    loginSubmitBtn.textContent = 'REQUEST OTP';
    loginNameField.style.display = 'block';
    signupGenderField.style.display = 'block';
    loginPhoneField.style.display = 'block';
    signupConfirmPasswordField.style.display = 'block';
    loginRememberRow.style.display = 'none';
    otpSection.style.display = 'none';
    otpSent = false;
  } else {
    loginHeaderTitle.textContent = 'Welcome Back';
    loginSubmitBtn.textContent = 'LOGIN';
    loginNameField.style.display = 'none';
    signupGenderField.style.display = 'none';
    loginPhoneField.style.display = 'none';
    signupConfirmPasswordField.style.display = 'none';
    loginRememberRow.style.display = 'flex';
    otpSection.style.display = 'none';
    otpSent = false;
  }
}

function resetSignupFlow() {
  authEmailInput.value = '';
  authPasswordInput.value = '';
  signupConfirmPasswordInput.value = '';
  otpInput.value = '';
  otpInstructions.textContent = '';
  otpSection.style.display = 'none';
  otpSent = false;
}

function openLogin() {
  closeCart();
  closeWishlist();
  setLoginMode('login');
  resetSignupFlow();
  loginOverlay.classList.add('active');
}

function buildHeaders() {
  const headers = {
    'Content-Type': 'application/json',
    'x-session-id': sessionId
  };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }
  return headers;
}

function closeLogin() {
  loginOverlay.classList.remove('active');
  resetSignupFlow();
}

// Forgot password modal (inline, simple)
function openForgotModal() {
  const overlayId = 'forgot-overlay';
  if (document.getElementById(overlayId)) return;
  const overlay = document.createElement('div');
  overlay.id = overlayId;
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:9999;backdrop-filter:blur(4px)';
  overlay.innerHTML = `
    <div style="background:#101010;border:1px solid rgba(255,255,255,0.08);padding:32px;max-width:420px;width:90%;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,0.55);">
      <div style="font-size:28px;font-weight:800;letter-spacing:2px;margin-bottom:8px;background:linear-gradient(135deg,#f3d36b 0%,#d4af37 35%,#8f6a11 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">MXERA</div>
      <h3 style="font-size:22px;font-weight:600;margin-bottom:8px;color:#fff;">Reset Password</h3>
      <p style="color:#9d9d9d;font-size:14px;margin-bottom:24px;">Enter your account email to receive a password reset link.</p>
      <input id="forgot-email-input" type="email" placeholder="Enter your email" style="width:100%;padding:14px 16px;background:#181818;border:1px solid rgba(255,255,255,0.08);border-radius:8px;color:#fff;font-size:15px;font-family:'Inter',sans-serif;margin-bottom:16px;box-sizing:border-box;" />
      <div style="display:flex;gap:12px;">
        <button id="send-reset-btn" style="flex:1;padding:14px;background:linear-gradient(135deg,#f3d36b 0%,#d4af37 35%,#8f6a11 100%);border:none;border-radius:8px;color:#060606;font-size:15px;font-weight:600;font-family:'Inter',sans-serif;cursor:pointer;">Send Reset Link</button>
        <button id="close-forgot-btn" style="flex:1;padding:14px;background:#181818;border:1px solid rgba(255,255,255,0.08);border-radius:8px;color:#9d9d9d;font-size:15px;font-weight:500;font-family:'Inter',sans-serif;cursor:pointer;">Close</button>
      </div>
      <p id="forgot-status" style="margin-top:16px;font-size:14px;text-align:center;display:none;"></p>
    </div>
  `;
  document.body.appendChild(overlay);

  // Add focus styles
  const emailInput = document.getElementById('forgot-email-input');
  emailInput.addEventListener('focus', () => {
    emailInput.style.borderColor = '#d4af37';
    emailInput.style.boxShadow = '0 0 0 3px rgba(212,175,55,0.15)';
  });
  emailInput.addEventListener('blur', () => {
    emailInput.style.borderColor = 'rgba(255,255,255,0.08)';
    emailInput.style.boxShadow = 'none';
  });

  document.getElementById('close-forgot-btn').addEventListener('click', () => { overlay.remove(); });
  document.getElementById('send-reset-btn').addEventListener('click', async () => {
    const email = document.getElementById('forgot-email-input').value.trim();
    const status = document.getElementById('forgot-status');
    status.style.display = 'none';
    if (!email) {
      status.style.display = 'block';
      status.style.color = '#ef4444';
      status.textContent = 'Please enter your email';
      return;
    }
    try {
      const res = await fetch(`${API_URL}/request-password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (res.ok) {
        status.style.display = 'block';
        status.style.color = '#22c55e';
        status.textContent = data.message || 'If that email exists, a reset link was sent.';
      } else {
        status.style.display = 'block';
        status.style.color = '#ef4444';
        status.textContent = data.error || 'Failed';
      }
    } catch (err) {
      status.style.display = 'block';
      status.style.color = '#ef4444';
      status.textContent = 'Network error';
    }
  });
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  if (authMode === 'signup') {
    if (!otpSent) {
      return requestSignupOtp();
    }
    return verifyOtpAndRegister();
  }
  return handleLogin();
}

async function handleLogin() {
  const email = authEmailInput.value;
  const password = authPasswordInput.value;

  try {
    const response = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (response.ok) {
      authToken = data.token;
      localStorage.setItem('mxera_token', data.token);
      localStorage.setItem('mxera_user_name', data.user.name);
      isLoggedIn = true;
      showNotification('Successfully logged in!');
      closeLogin();
      updateUserUI(data.user.name);
      await fetchCart();
      await fetchWishlist();
    } else {
      showNotification(data.error || 'Login failed');
    }
  } catch (error) {
    console.error('Login error:', error);
    showNotification('Login failed. Is the server running?');
  }
}

async function requestSignupOtp() {
  const name = document.getElementById('signup-name-input').value.trim();
  const phone = signupPhoneInput.value.trim();
  const email = authEmailInput.value.trim();
  const password = authPasswordInput.value;
  const confirmPassword = signupConfirmPasswordInput.value;

  if (!name) {
    showNotification('Please enter your name.');
    return;
  }
  if (!email) {
    showNotification('Please enter your email.');
    return;
  }
  if (!password) {
    showNotification('Please enter a password.');
    return;
  }
  if (password !== confirmPassword) {
    showNotification('Passwords do not match.');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, phone, method: 'email' })
    });
    const data = await response.json();

    if (!response.ok) {
      showNotification(data.error || 'Failed to send OTP');
      return;
    }

    otpSent = true;
    otpSection.style.display = 'block';
    otpInput.value = '';
    otpInstructions.textContent = 'OTP sent to your email. Enter it below to complete registration.';
    loginSubmitBtn.textContent = 'VERIFY OTP';
    showNotification(data.message || 'OTP sent.');
  } catch (error) {
    console.error('OTP request error:', error);
    showNotification('Failed to request OTP. Please try again.');
  }
}

async function verifyOtpAndRegister() {
  const email = authEmailInput.value.trim();
  const otp = otpInput.value.trim();
  const name = document.getElementById('signup-name-input').value.trim();
  const phone = signupPhoneInput.value.trim();
  const password = authPasswordInput.value;
  const gender = signupGenderSelect.value;

  if (!otp) {
    showNotification('Please enter the OTP sent to your email.');
    return;
  }

  try {
    const verifyResponse = await fetch(`${API_URL}/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp })
    });
    const verifyData = await verifyResponse.json();

    if (!verifyResponse.ok) {
      showNotification(verifyData.error || 'OTP verification failed');
      return;
    }

    const response = await fetch(`${API_URL}/register`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({ name, email, password, phone, gender })
    });
    const data = await response.json();

    if (response.ok) {
      showNotification('Registration successful! Please log in.');
      setLoginMode('login');
      resetSignupFlow();
    } else {
      showNotification(data.error || 'Registration failed');
    }
  } catch (error) {
    console.error('Registration error:', error);
    showNotification('Registration failed');
  }
}

function handleLogout() {
  authToken = null;
  localStorage.removeItem('mxera_token');
  localStorage.removeItem('mxera_user_name');
  isLoggedIn = false;
  showNotification('Logged out successfully!');
  updateUserUI(null);
  // Clear guest-side view immediately so logged-out users see an empty cart/wishlist
  cart = [];
  wishlist = [];
  updateCartUI();
  updateWishlistUI();
}

// Location Functions
function openLocationModal() {
  locationModal.classList.add('active');
}

function closeLocationModal() {
  locationModal.classList.remove('active');
}

function renderLocationOptions(filter = '') {
  const filtered = popularCities.filter(city =>
    city.name.toLowerCase().includes(filter.toLowerCase())
  );

  locationOptions.innerHTML = filtered.map(city => `
    <div class="location-option" onclick="selectLocation('${city.name}')">
      <svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
      <div>${city.name}</div>
    </div>
  `).join('');
}

function selectLocation(location) {
  currentLocation = location;
  localStorage.setItem('mxera_location', location);
  locationBar.querySelector('strong').textContent = location;
  showNotification(`Delivery location set to ${location}`);
  closeLocationModal();
}

function useCurrentLocation() {
  console.log('useCurrentLocation clicked');
  const btn = document.getElementById('use-location-btn');
  if (!btn) {
    console.error('Button not found');
    return;
  }
  const originalText = btn.innerHTML;
  btn.innerHTML = '<svg class="spinner" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle></svg> Detecting...';
  btn.disabled = true;

  if (navigator.geolocation) {
    console.log('Requesting geolocation...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log('Geolocation success:', position.coords);
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const city = detectCityFromCoords(lat, lng);
        console.log('Detected city:', city);
        currentLocation = city;
        localStorage.setItem('mxera_location', city);
        locationBar.querySelector('strong').textContent = city;
        showNotification(`Location set to ${city}`);
        closeLocationModal();
        btn.innerHTML = originalText;
        btn.disabled = false;
      },
      (error) => {
        console.error('Geolocation error:', error);
        let errorMsg = 'Could not get location.';
        switch(error.code) {
          case error.PERMISSION_DENIED:
            errorMsg = 'Location access denied. Please enable location permissions.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMsg = 'Location unavailable. Please try again.';
            break;
          case error.TIMEOUT:
            errorMsg = 'Location request timed out.';
            break;
        }
        showNotification(errorMsg);
        btn.innerHTML = originalText;
        btn.disabled = false;
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  } else {
    console.error('Geolocation not supported');
    showNotification('Geolocation not supported by your browser.');
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

function detectCityFromCoords(lat, lng) {
  const cities = [
    { name: "Mumbai, Maharashtra", lat: 19.076, lng: 72.8777 },
    { name: "Delhi, NCR", lat: 28.6139, lng: 77.209 },
    { name: "Bangalore, Karnataka", lat: 12.9716, lng: 77.5946 },
    { name: "Chennai, Tamil Nadu", lat: 13.0827, lng: 80.2707 },
    { name: "Hyderabad, Telangana", lat: 17.385, lng: 78.4867 },
    { name: "Kolkata, West Bengal", lat: 22.5726, lng: 88.3639 },
    { name: "Pune, Maharashtra", lat: 18.5204, lng: 73.8567 },
    { name: "Ahmedabad, Gujarat", lat: 23.0225, lng: 72.5714 },
    { name: "Jaipur, Rajasthan", lat: 26.9124, lng: 75.7873 },
    { name: "Lucknow, Uttar Pradesh", lat: 26.8467, lng: 80.9462 },
    { name: "Gurgaon, Haryana", lat: 28.4595, lng: 77.0266 },
    { name: "Noida, Uttar Pradesh", lat: 28.5355, lng: 77.3910 },
    { name: "Thane, Maharashtra", lat: 19.2183, lng: 72.9681 },
    { name: "Surat, Gujarat", lat: 21.1702, lng: 72.8311 },
    { name: "Kochi, Kerala", lat: 9.9312, lng: 76.2673 },
    { name: "Coimbatore, Tamil Nadu", lat: 11.0168, lng: 76.9558 },
    { name: "Nagpur, Maharashtra", lat: 21.1458, lng: 79.0882 },
    { name: "Indore, Madhya Pradesh", lat: 22.7196, lng: 75.8577 },
    { name: "Bhopal, Madhya Pradesh", lat: 23.2599, lng: 77.4126 },
    { name: "Visakhapatnam, Andhra Pradesh", lat: 17.6868, lng: 83.2185 }
  ];

  // Haversine formula for accurate distance calculation
  function getDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  let closestCity = "Mumbai, Maharashtra";
  let minDistance = Infinity;

  for (const city of cities) {
    const distance = getDistance(lat, lng, city.lat, city.lng);
    if (distance < minDistance) {
      minDistance = distance;
      closestCity = city.name;
    }
  }

  return closestCity;
}

// Debounce utility — limits how often a function can fire
function debounce(fn, delay) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// Search Functions
const handleSearch = debounce(function(query) {
  if (query.length < 2) {
    searchResults.classList.remove('active');
    fetchProducts();
    return;
  }

  fetchProducts('all', query).then(() => {
    if (products.length > 0) {
      searchResults.innerHTML = products.map(product => `
        <div class="search-result-item" onclick="viewProduct(${product.id})">
          <img src="${product.image}" alt="${product.name}" loading="lazy" width="50" height="60">
          <div class="search-result-info">
            <h4>${product.name}</h4>
            <p>₹${parseInt(product.price).toLocaleString()}</p>
          </div>
        </div>
      `).join('');
    } else {
      searchResults.innerHTML = '<div class="search-no-results">No products found</div>';
    }
    searchResults.classList.add('active');
  });
}, 300);

function viewProduct(productId) {
  searchResults.classList.remove('active');
  searchInput.value = '';
  const product = products.find(p => p.id === productId);
  renderProducts([product]);
  document.getElementById('products').scrollIntoView({behavior: 'smooth'});
  showNotification(`Viewing: ${product.name}`);
}

// Quick View
function quickView(productId) {
  const product = products.find(p => p.id === productId);
  showNotification(`Quick view: ${product.name}`);
}

// ================= PDP (Product Detail Page) Functions =================

// PDP state
let pdpCurrentProduct = null;
let pdpSelectedColor = null;
let pdpSelectedSize = null;

// Render star SVGs
function renderStars(rating, max = 5) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5 ? 1 : 0;
  const empty = max - full - half;
  let html = '';
  for (let i = 0; i < full; i++) {
    html += '<svg class="pdp-star filled" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>';
  }
  if (half) {
    html += '<svg class="pdp-star half" viewBox="0 0 24 24"><defs><linearGradient id="halfGrad"><stop offset="50%" stop-color="#d4af37"/><stop offset="50%" stop-color="#444"/></linearGradient></defs><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="url(#halfGrad)"></polygon></svg>';
  }
  for (let i = 0; i < empty; i++) {
    html += '<svg class="pdp-star" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="#444" stroke="#d4af37" stroke-width="1"></polygon></svg>';
  }
  return html;
}

// Open PDP modal
function openProductDetail(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) return;

  pdpCurrentProduct = product;
  pdpSelectedColor = null;
  pdpSelectedSize = null;

  const overlay = document.getElementById('pdp-overlay');

  // Breadcrumb
  document.getElementById('pdp-breadcrumb').textContent = `Home / ${product.category.charAt(0).toUpperCase() + product.category.slice(1)} / ${product.name}`;

  // Title
  document.getElementById('pdp-title').textContent = product.name;

  // Rating
  const ratingHtml = renderStars(product.rating);
  document.getElementById('pdp-rating').innerHTML = `
    <div class="pdp-rating-stars">${ratingHtml}</div>
    <span>${product.rating} (${product.reviews} reviews)</span>
  `;

  // Price
  const originalPrice = product.original_price
    ? `<span class="price-original">₹${parseInt(product.original_price).toLocaleString()}</span>`
    : '';
  document.getElementById('pdp-price-row').innerHTML = `
    <span class="price">₹${parseInt(product.price).toLocaleString()}</span>
    ${originalPrice}
  `;

  // Description
  document.getElementById('pdp-desc').textContent = product.description;

  // Images — set main image and thumbnails
  const images = product.images || [product.image];
  const pdpMainImg = document.getElementById('pdp-main-img');
  pdpMainImg.src = images[0];
  pdpMainImg.alt = product.name;
  pdpMainImg.setAttribute('loading', 'lazy');
  if (!pdpMainImg.hasAttribute('width')) pdpMainImg.setAttribute('width', '500');
  if (!pdpMainImg.hasAttribute('height')) pdpMainImg.setAttribute('height', '600');

  const thumbsContainer = document.getElementById('pdp-thumbnails');
  thumbsContainer.innerHTML = images.map((img, idx) => `
    <div class="pdp-thumb ${idx === 0 ? 'active' : ''}" onclick="pdpSwitchImage(${idx})">
      <img src="${img}" alt="${product.name} thumbnail ${idx + 1}" loading="lazy" width="80" height="100">
    </div>
  `).join('');

  // Color selector — text-based buttons with color image swap
  const colorSection = document.getElementById('pdp-color-section');
  const colorOptions = document.getElementById('pdp-color-options');
  const colorLabel = document.getElementById('pdp-color-label');
  if (product.colors && product.colors.length > 0) {
    colorSection.style.display = 'block';
    colorLabel.textContent = product.colors[0];
    // Store color_images on product for access from pdpSelectColor
    colorOptions.innerHTML = product.colors.map((color, idx) => {
      const hex = product.color_hex && product.color_hex[idx] ? product.color_hex[idx] : '#ccc';
      return `<button class="pdp-color-btn ${idx === 0 ? 'active' : ''}" data-color-idx="${idx}" onclick="pdpSelectColor(${idx})">
        <span class="pdp-color-swatch" style="background:${hex};"></span>
        ${escaped(color)}
      </button>`;
    }).join('');
    pdpSelectedColor = 0;
    // Auto-select first color's image
    pdpSelectColor(0);
  } else {
    colorSection.style.display = 'none';
  }

  // Size selector
  const sizeSection = document.getElementById('pdp-size-section');
  const sizeOptions = document.getElementById('pdp-size-options');
  const sizeLabel = document.getElementById('pdp-size-label');
  if (product.sizes && product.sizes.length > 0) {
    sizeSection.style.display = 'block';
    sizeLabel.textContent = product.sizes[0];
    sizeOptions.innerHTML = product.sizes.map((size, idx) => `
      <button class="pdp-size-btn ${idx === 0 ? 'active' : ''}" onclick="pdpSelectSize(${idx})">${size}</button>
    `).join('');
    pdpSelectedSize = 0;
  } else {
    sizeSection.style.display = 'none';
  }

  // Out of stock state
  const addCartBtn = document.getElementById('pdp-add-cart');
  if (product.out_of_stock == 1) {
    addCartBtn.textContent = 'OUT OF STOCK';
    addCartBtn.disabled = true;
    addCartBtn.style.opacity = '0.5';
    addCartBtn.style.cursor = 'not-allowed';
  } else {
    addCartBtn.textContent = 'ADD TO CART';
    addCartBtn.disabled = false;
    addCartBtn.style.opacity = '';
    addCartBtn.style.cursor = '';
  }

  // Wishlist button state
  const isInWishlist = wishlist.some(item => item.product_id === product.id);
  const wishlistBtn = document.getElementById('pdp-wishlist-btn');
  wishlistBtn.classList.toggle('active', isInWishlist);
  wishlistBtn.querySelector('span').textContent = isInWishlist ? 'SAVED' : 'SAVE';

  // Specifications tab
  const specsTable = document.getElementById('pdp-specs-table');
  if (product.specifications && product.specifications.length > 0) {
    specsTable.innerHTML = product.specifications.map(spec => `
      <tr>
        <td>${spec.label}</td>
        <td>${spec.value}</td>
      </tr>
    `).join('');
  } else {
    specsTable.innerHTML = '<tr><td colspan="2">No specifications available</td></tr>';
  }

  // Reviews tab
  const reviewsContainer = document.getElementById('pdp-reviews');
  if (product.reviews_data && product.reviews_data.length > 0) {
    reviewsContainer.innerHTML = product.reviews_data.map(review => `
      <div class="pdp-review-card">
        <div class="pdp-review-header">
          <div class="pdp-review-avatar">${review.name.charAt(0).toUpperCase()}</div>
          <div>
            <strong>${review.name}</strong>
            <div class="pdp-review-stars">${renderStars(review.rating)}</div>
          </div>
          <span class="pdp-review-date">${review.date}</span>
        </div>
        <p class="pdp-review-text">${review.comment}</p>
      </div>
    `).join('');
  } else {
    reviewsContainer.innerHTML = '<p style="color:#999;">No reviews yet.</p>';
  }

  // Default to specs tab
  switchPdpTab('specs');

  // Show modal
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

// Close PDP modal
function closeProductDetail(event) {
  if (event && event.target !== document.getElementById('pdp-overlay') && event.target !== document.querySelector('.pdp-close')) {
    return;
  }
  document.getElementById('pdp-overlay').classList.remove('active');
  document.body.style.overflow = '';
  pdpCurrentProduct = null;
}

// Switch PDP tab (specs / reviews)
function switchPdpTab(tab) {
  document.querySelectorAll('.pdp-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.pdp-tab-content').forEach(c => c.classList.remove('active'));
  document.querySelector(`.pdp-tab[data-tab="${tab}"]`).classList.add('active');
  document.getElementById(`pdp-${tab}-content`).classList.add('active');
}

// Switch main image
function pdpSwitchImage(index) {
  const product = pdpCurrentProduct;
  if (!product) return;
  const images = product.images || [product.image];
  document.getElementById('pdp-main-img').src = images[index];
  document.querySelectorAll('.pdp-thumb').forEach((t, i) => {
    t.classList.toggle('active', i === index);
  });
}

// Select color — also swap main image if color has a dedicated image
function pdpSelectColor(index) {
  pdpSelectedColor = index;
  const product = pdpCurrentProduct;
  if (!product) return;
  document.getElementById('pdp-color-label').textContent = product.colors[index];
  document.querySelectorAll('.pdp-color-btn').forEach((btn, i) => {
    btn.classList.toggle('active', i === index);
  });

  // Swap main image to the selected color's image if available
  const colorImg = product.color_images && product.color_images[index];
  if (colorImg) {
    document.getElementById('pdp-main-img').src = colorImg;
    // Also update thumbnails to show the color image as active
    const thumbs = document.querySelectorAll('.pdp-thumb');
    thumbs.forEach((t, i) => t.classList.toggle('active', i === 0));
  }
}

// Select size
function pdpSelectSize(index) {
  pdpSelectedSize = index;
  const product = pdpCurrentProduct;
  if (!product) return;
  document.getElementById('pdp-size-label').textContent = product.sizes[index];
  document.querySelectorAll('.pdp-size-btn').forEach((btn, i) => {
    btn.classList.toggle('active', i === index);
  });
}

// Add to cart from PDP
function pdpAddToCart() {
  const product = pdpCurrentProduct;
  if (!product) return;
  if (product.out_of_stock == 1) {
    showNotification('This product is out of stock');
    return;
  }
  const colorName = (product.colors && product.colors[pdpSelectedColor]) || '';
  const colorImage = (product.color_images && product.color_images[pdpSelectedColor]) || '';
  const sizeName = (product.sizes && product.sizes[pdpSelectedSize]) || '';
  addToCart(product.id, colorName, colorImage, sizeName);
  showNotification(`${product.name} added to cart!`);
}

// Toggle wishlist from PDP
function pdpToggleWishlist() {
  const product = pdpCurrentProduct;
  if (!product) return;
  toggleWishlist(product.id);
  const isInWishlist = wishlist.some(item => item.product_id === product.id);
  const btn = document.getElementById('pdp-wishlist-btn');
  btn.classList.toggle('active', isInWishlist);
  btn.querySelector('span').textContent = isInWishlist ? 'SAVED' : 'SAVE';
}

// Notification
function showNotification(message) {
  notification.querySelector('p').textContent = message;
  notification.classList.add('show');
  setTimeout(() => {
    notification.classList.remove('show');
  }, 3000);
}

// Filter Products
function filterProducts(category) {
  filterBtns.forEach(btn => {
    btn.classList.remove('active');
    if (btn.textContent.toLowerCase() === category || (category === 'all' && btn.textContent === 'ALL')) {
      btn.classList.add('active');
    }
  });

  fetchProducts(category);
}

// Mobile Menu
function toggleMobileMenu() {
  navLinks.classList.toggle('active');
}

// Event Listeners
if (document.getElementById('open-cart')) {
  document.getElementById('open-cart').addEventListener('click', openCart);
  document.getElementById('close-cart').addEventListener('click', closeCart);
  cartOverlay.addEventListener('click', closeCart);
  
  // Checkout listeners
  const checkoutBtn = document.getElementById('checkout-btn');
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', openCheckout);
  }
  
  const checkoutOverlay = document.getElementById('checkout-overlay');
  if (checkoutOverlay) {
    checkoutOverlay.addEventListener('click', closeCheckout);
  }
  
  const checkoutForm = document.getElementById('checkout-form');
  if (checkoutForm) {
    checkoutForm.addEventListener('submit', handleCheckoutSubmit);
  }
  
  mobileMenuBtn.addEventListener('click', toggleMobileMenu);
  document.getElementById('open-wishlist').addEventListener('click', openWishlist);
  document.getElementById('close-wishlist').addEventListener('click', closeWishlist);
  wishlistOverlay.addEventListener('click', closeWishlist);
  document.getElementById('nav-login-btn').addEventListener('click', openLogin);
  document.getElementById('close-login').addEventListener('click', closeLogin);
  loginOverlay.addEventListener('click', (e) => {
    if (e.target === loginOverlay) closeLogin();
  });
  loginTabs.forEach(tab => {
    tab.addEventListener('click', () => setLoginMode(tab.dataset.mode || tab.textContent.trim().toLowerCase().replace(/\s+/g, '')));
  });
  document.getElementById('login-form').addEventListener('submit', handleAuthSubmit);
  resendOtpBtn.addEventListener('click', requestSignupOtp);
  const forgotLink = document.getElementById('forgot-password-link');
  if (forgotLink) {
    forgotLink.addEventListener('click', (e) => { e.preventDefault(); openForgotModal(); });
  }
  document.getElementById('nav-logout-btn').addEventListener('click', handleLogout);
  document.getElementById('nav-user-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('nav-user-menu').classList.toggle('active');
  });
  document.addEventListener('click', () => {
    document.getElementById('nav-user-menu').classList.remove('active');
  });
  locationBar.addEventListener('click', openLocationModal);
  const closeLocationBtn = document.getElementById('close-location');
  if (closeLocationBtn) {
    closeLocationBtn.addEventListener('click', closeLocationModal);
  }
  locationModal.addEventListener('click', (e) => {
    if (e.target === locationModal) closeLocationModal();
  });
  document.getElementById('location-search-input').addEventListener('input', (e) => {
    renderLocationOptions(e.target.value);
  });
  document.getElementById('use-location-btn').addEventListener('click', useCurrentLocation);
}

// Search input listeners
if (searchInput && searchResults) {
  searchInput.addEventListener('input', (e) => handleSearch(e.target.value));
  searchInput.addEventListener('focus', (e) => {
    if (e.target.value.length >= 2) {
      handleSearch(e.target.value);
    }
  });
  searchInput.addEventListener('blur', () => {
    setTimeout(() => searchResults.classList.remove('active'), 200);
  });
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchInput.value = '';
      searchResults.classList.remove('active');
      fetchProducts();
    }
  });
}

// Password toggle functionality
function togglePassword(inputId, btn) {
  const input = document.getElementById(inputId);
  if (input) {
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    btn.querySelector('.eye-icon').style.display = isPassword ? 'none' : 'block';
    btn.querySelector('.eye-off-icon').style.display = isPassword ? 'block' : 'none';
  }
}

// Make functions global
window.addToCart = addToCart;
window.updateQuantity = updateQuantity;
window.removeFromCart = removeFromCart;
window.toggleWishlist = toggleWishlist;
window.quickView = quickView;
window.filterProducts = filterProducts;
window.openCart = openCart;
window.closeCart = closeCart;
window.openCheckout = openCheckout;
window.closeCheckout = closeCheckout;
window.handleCheckoutSubmit = handleCheckoutSubmit;
window.openWishlist = openWishlist;
window.closeWishlist = closeWishlist;
window.openLogin = openLogin;
window.closeLogin = closeLogin;
window.selectLocation = selectLocation;
window.useCurrentLocation = useCurrentLocation;
window.viewProduct = viewProduct;
window.addToCartFromWishlist = addToCartFromWishlist;
window.openLocationModal = openLocationModal;
window.closeLocationModal = closeLocationModal;
window.togglePassword = togglePassword;
window.openProductDetail = openProductDetail;
window.closeProductDetail = closeProductDetail;
window.pdpAddToCart = pdpAddToCart;
window.pdpToggleWishlist = pdpToggleWishlist;
window.switchPdpTab = switchPdpTab;
window.pdpSwitchImage = pdpSwitchImage;
window.pdpSelectColor = pdpSelectColor;
window.pdpSelectSize = pdpSelectSize;
