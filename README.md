# MXERA - E-commerce Backend

Full-stack e-commerce web application with Node.js + Express backend, MongoDB database, and vanilla HTML/CSS/JS frontend.

## Prerequisites

1. **Node.js** (v14 or higher)
2. **MongoDB** (local instance or [MongoDB Atlas](https://www.mongodb.com/atlas) cloud URI)
3. **npm** package manager
4. **Gmail App Password** (for transactional emails — see [Google App Passwords](https://support.google.com/accounts/answer/185833))

## Setup Steps

### 1. Clone & Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy the template below into `.env` (located at project root) and fill in your values:

```env
# Database Configuration (MongoDB)
MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/mxera?retryWrites=true&w=majority&appName=Cluster0
DB_NAME=mxera

# Server Configuration
PORT=5000
JWT_SECRET=your_generated_secret_here

# Email Configuration (Gmail SMTP example)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=yourapp@gmail.com
EMAIL_PASS=your_gmail_app_password
EMAIL_FROM=MXERA <yourapp@gmail.com>

# Admin Configuration
ADMIN_BOOTSTRAP_NAME=MXERA Owner
ADMIN_BOOTSTRAP_EMAIL=owner@example.com
ADMIN_BOOTSTRAP_PASSWORD=change-this-before-starting
ADMIN_EMAILS=owner@example.com,ops@example.com
```

- `MONGODB_URI` — Connection string to your MongoDB instance (local or Atlas). The database is created automatically on first connection.
- `JWT_SECRET` — A random string used to sign JSON Web Tokens. Generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
- `EMAIL_USER` / `EMAIL_PASS` — Gmail address and [App Password](https://support.google.com/accounts/answer/185833) used for sending order confirmations, password-reset emails, and OTP verification.
- `EMAIL_ADMIN` — *(optional)* Separate address that receives new-order notifications. Falls back to `EMAIL_USER` if not set.
- `ADMIN_EMAILS` — Comma-separated list of registered user emails that are allowed to access the admin panel. Falls back to `EMAIL_ADMIN`, then `EMAIL_USER`.
- `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD` — Creates the first admin user on server start if that email does not already exist in the database. The password is **only applied once**; subsequent restarts will not overwrite an existing user.

### 3. Start the Server

```bash
npm start
```

The server runs on the port specified in `.env` (`PORT`), defaulting to **`http://localhost:5000`**.

### 4. Open the Frontend

- **Customer storefront** — open [`frontend/index.html`](frontend/index.html) in your browser (use a local dev server like [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) for best results).
- **Admin panel** — open [`admin/admin.html`](admin/admin.html). Log in with a registered account whose email is included in `ADMIN_EMAILS`.

### 5. Static File Serving

The server automatically serves:

| Path | Directory served |
|---|---|
| `/` | [`frontend/`](frontend/) (index.html, styles.css, script.js, etc.) |
| `/admin` | [`admin/`](admin/) (admin.html, admin.css, admin.js) |
| `/uploads` | [`backend/uploads/`](backend/uploads/) (product images uploaded via the admin panel) |

Because the back-end serves all static files, there is no need to open HTML files directly as `file://` — the server handles everything.

---

## Admin Accounts

**First-time setup:**

1. Set `ADMIN_BOOTSTRAP_EMAIL`, `ADMIN_BOOTSTRAP_NAME`, and `ADMIN_BOOTSTRAP_PASSWORD` in `.env`.
2. Start (or restart) the server. An admin user is created automatically.
3. Log in at [`/admin/admin.html`](admin/admin.html).

**Adding more admins:**

1. Create each account through the normal sign-up flow on the storefront.
2. Add each admin email to the `ADMIN_EMAILS` list (comma-separated).
3. Restart the server so the allowlist is reloaded.

Example:

```env
ADMIN_EMAILS=owner@example.com,ops@example.com,warehouse@example.com
```

---

## API Endpoints

### Products

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/products` | List all products (with optional `?category=` filter) | Public |
| GET | `/api/products/:id` | Get a single product by ID | Public |

### Cart

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/cart` | Get current user's cart items (merges guest cart via `guestCartId`) | Optional |
| POST | `/api/cart` | Add item to cart | Optional |
| PUT | `/api/cart/:id` | Update cart item quantity | Optional |
| DELETE | `/api/cart/:id` | Remove single item from cart | Optional |
| DELETE | `/api/cart` | Clear entire cart | Optional |

### Wishlist

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/wishlist` | Get wishlist items | Optional |
| POST | `/api/wishlist` | Add product to wishlist | Optional |
| DELETE | `/api/wishlist/:productId` | Remove product from wishlist | Optional |

### Orders

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/orders` | Create a new order (from cart) | Required |
| GET | `/api/orders` | Get current user's orders | Required |

### User Authentication & Profile

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/register` | Register a new user | Public |
| POST | `/api/login` | Log in (returns JWT + user info) | Public |
| GET | `/api/user` | Get current user's profile | Required |
| PUT | `/api/user` | Update current user's profile | Required |
| POST | `/api/request-otp` | Request email OTP for password reset | Public |
| POST | `/api/verify-otp` | Verify OTP code | Public |
| POST | `/api/request-password-reset` | Request password reset email | Public |
| POST | `/api/reset-password` | Reset password (with token) | Public |

### Saved Addresses

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/saved-addresses` | Get saved addresses for current user | Required |
| POST | `/api/saved-addresses` | Save a new address | Required |
| PUT | `/api/saved-addresses/:id` | Update a saved address | Required |
| DELETE | `/api/saved-addresses/:id` | Delete a saved address | Required |

### Admin

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/admin/summary` | Dashboard metrics (sales, orders, users, products) | Admin |
| GET | `/api/admin/products` | List all products with stock info | Admin |
| POST | `/api/admin/products` | Create a new product | Admin |
| PUT | `/api/admin/products/:id` | Update product details / stock | Admin |
| DELETE | `/api/admin/products/:id` | Delete a product (if no orders reference it) | Admin |
| GET | `/api/admin/orders` | List all orders with payment info | Admin |
| DELETE | `/api/admin/orders` | Delete all orders (clear database) | Admin |
| PATCH | `/api/admin/orders/:id` | Update order/payment status | Admin |
| POST | `/api/admin/upload` | Upload a product image | Admin |
| GET | `/api/admin/saved-addresses` | View all saved addresses | Admin |
| DELETE | `/api/admin/saved-addresses` | Clear all saved addresses | Admin |

### Other

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/health` | Health-check endpoint | Public |
| POST | `/api/submit-query` | Submit a contact / support query (emails admin) | Public |

---

## Project Structure

```
mxera/
├── backend/
│   ├── server.js              # Express server (all routes, middleware, logic)
│   ├── models/
│   │   ├── User.js            # User schema (name, email, password, etc.)
│   │   ├── Product.js         # Product schema (name, price, category, image, stock)
│   │   ├── Cart.js            # Cart schema (user/guest, items with quantities)
│   │   ├── Wishlist.js        # Wishlist schema (user, product references)
│   │   ├── Order.js           # Order schema (items, shipping, payment, status)
│   │   ├── OrderItem.js       # Individual order line-item schema
│   │   ├── PasswordReset.js   # Password-reset token schema (OTP, expiry)
│   │   └── SavedAddress.js    # Saved shipping-address schema
│   └── uploads/               # Uploaded product images (auto-created)
├── frontend/
│   ├── index.html             # Main storefront page
│   ├── reset.html             # Password-reset page
│   ├── styles.css             # Full storefront styles
│   ├── styles.min.css         # Minified CSS
│   ├── script.js              # Full storefront JavaScript
│   └── script.min.js          # Minified JS
├── admin/
│   ├── admin.html             # Admin dashboard page
│   ├── admin.css              # Admin styles
│   └── admin.js               # Admin interactions
├── .env                       # Environment variables (not committed)
├── .gitignore
├── package.json               # NPM dependencies & scripts
└── README.md                  # This file
```

---

## Tech Stack

- **Backend:** Node.js, Express.js, Mongoose (MongoDB ODM)
- **Database:** MongoDB (local or Atlas)
- **Authentication:** JWT (JSON Web Tokens) + bcryptjs password hashing
- **Email:** Nodemailer (Gmail SMTP)
- **File Uploads:** Multer (image uploads to `backend/uploads/`)
- **Session:** express-session (guest cart tracking)
- **Frontend:** Vanilla HTML / CSS / JavaScript (no framework)
