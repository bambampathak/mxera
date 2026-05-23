# MXERA - E-commerce Backend Setup

## Prerequisites

1. **Node.js** (v14 or higher)
2. **MySQL Workbench** (or MySQL server)
3. **npm** or **yarn**

## Setup Steps

### 1. Database Setup (MySQL Workbench)

1. Open MySQL Workbench
2. Create a new connection or use existing one
3. Run the SQL commands from `database.sql`:
   - Open the file in MySQL Workbench
   - Execute all queries
   - This creates the `mxera` database with all tables

### 2. Configure Database

Edit `.env` file with your MySQL credentials:
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password_here
DB_NAME=mxera
EMAIL_ADMIN=orders@example.com
ADMIN_EMAILS=owner@example.com,ops@example.com
ADMIN_BOOTSTRAP_NAME=MXERA Owner
ADMIN_BOOTSTRAP_EMAIL=owner@example.com
ADMIN_BOOTSTRAP_PASSWORD=change-this-before-starting
```

`EMAIL_ADMIN` receives new order notifications. If it is not set, MXERA uses `EMAIL_USER`.
`ADMIN_EMAILS` is the comma-separated list of registered MXERA account emails allowed to use the admin panel. If it is not set, the server falls back to `EMAIL_ADMIN`, then `EMAIL_USER`.
`ADMIN_BOOTSTRAP_EMAIL` and `ADMIN_BOOTSTRAP_PASSWORD` create the first admin user if that email does not already exist. The bootstrap password is not reapplied after the account has been created.

### 3. Install Dependencies

```bash
npm install
```

### 4. Start the Server

```bash
npm start
```

The server will run on `http://localhost:3000`

### 5. Open the Frontend

Open `index.html` in your browser (use a local server like Live Server for best results).

Open `/admin.html` for the admin panel. Log in with a registered account whose email is included in `ADMIN_EMAILS`.

### Admin Accounts

For the first admin, set `ADMIN_BOOTSTRAP_EMAIL`, `ADMIN_BOOTSTRAP_PASSWORD`, and optionally `ADMIN_BOOTSTRAP_NAME` in `.env`, then restart the server and log in at `/admin.html`.

For additional admins:

1. Create each account through the normal MXERA sign-up flow.
2. Add each admin email to `ADMIN_EMAILS`, separated by commas.
3. Restart the server so the allowlist is reloaded.

Example:
```
ADMIN_EMAILS=owner@example.com,ops@example.com,warehouse@example.com
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/products | Get all products |
| GET | /api/products/:id | Get single product |
| GET | /api/admin/summary | Admin dashboard metrics |
| GET | /api/admin/products | Admin products and inventory |
| POST | /api/admin/products | Create product |
| PUT | /api/admin/products/:id | Update product and stock |
| DELETE | /api/admin/products/:id | Delete unused product |
| GET | /api/admin/orders | Admin orders and payment data |
| PATCH | /api/admin/orders/:id | Update order or payment status |
| POST | /api/register | User registration |
| POST | /api/login | User login |
| GET | /api/cart | Get cart items |
| POST | /api/cart | Add to cart |
| PUT | /api/cart/:id | Update cart quantity |
| DELETE | /api/cart/:id | Remove from cart |
| GET | /api/wishlist | Get wishlist |
| POST | /api/wishlist | Add to wishlist |
| DELETE | /api/wishlist/:id | Remove from wishlist |
| POST | /api/orders | Create order |

## Project Structure

```
mxera/
├── server.js          # Node.js Express server
├── package.json      # NPM dependencies
├── database.sql      # MySQL database schema
├── .env              # Environment variables
├── index.html        # Main HTML file
├── admin.html        # Admin dashboard
├── admin.css         # Admin styles
├── admin.js          # Admin interactions
├── styles.css        # CSS styles
├── script.js         # Frontend JavaScript
└── README.md        # This file
```
