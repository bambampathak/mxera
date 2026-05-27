const ADMIN_API = '/api/admin';
const loginSection = document.getElementById('admin-login');
const adminShell = document.getElementById('admin-shell');
const loginStatus = document.getElementById('admin-login-status');
const productStatus = document.getElementById('product-status');
const metricsRoot = document.getElementById('admin-metrics');
const productBody = document.getElementById('admin-products-body');
const orderBody = document.getElementById('admin-orders-body');
const productForm = document.getElementById('product-form');
const tokenKey = 'mxera_admin_token';
let adminToken = localStorage.getItem(tokenKey) || '';
let adminProducts = [];
let adminOrders = [];
let adminSavedAddresses = [];
let adminInvoices = [];

const money = value => `INR ${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const text = value => String(value == null ? '' : value);
const escaped = value => text(value).replace(/[&<>"']/g, function(ch) {
  var amp = '&amp;', lt = '<', gt = '>', quot = '"';
  var apos = '&#' + '39;';
  if (ch === '&') return amp;
  if (ch === '<') return lt;
  if (ch === '>') return gt;
  if (ch === '"') return quot;
  return apos;
});

function toast(message) {
  const node = document.getElementById('admin-toast');
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove('show'), 2800);
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Admin request failed');
  }
  return data;
}

function showLogin(message = '') {
  loginSection.hidden = false;
  adminShell.hidden = true;
  loginStatus.textContent = message;
}

function showAdmin() {
  loginSection.hidden = true;
  adminShell.hidden = false;
}

function renderMetrics(summary) {
  const metrics = [
    ['Products', summary.product_count],
    ['Units In Stock', summary.units_in_stock],
    ['Low Stock', summary.low_stock_count],
    ['Orders', summary.order_count],
    ['Open Orders', summary.open_orders],
    ['Gross Sales', money(summary.gross_sales)],
    ['Paid Sales', money(summary.paid_sales)],
    ['Customers', summary.customer_count],
    ['Saved Addresses', summary.saved_addresses_count],
    ['Invoices', summary.invoice_count]
  ];
  metricsRoot.innerHTML = metrics.map(([label, value]) => `
    <article class="metric"><span>${escaped(label)}</span><strong>${escaped(value)}</strong></article>
  `).join('');
}

// --- Dynamic Row Helpers for Specs, Colors, Sizes ---
function addSpecRow(spec = {}) {
  const container = document.getElementById('specs-container');
  const div = document.createElement('div');
  div.className = 'dynamic-row';
  div.innerHTML = `
    <input class="spec-key" placeholder="Key (e.g. Material)" value="${escaped(spec.key || '')}">
    <input class="spec-value" placeholder="Value (e.g. Cotton)" value="${escaped(spec.value || '')}">
    <button type="button" class="remove-row-btn" onclick="this.parentElement.remove()">✕</button>
  `;
  container.appendChild(div);
}

function addColorRow(color = {}) {
  const container = document.getElementById('colors-container');
  const div = document.createElement('div');
  div.className = 'dynamic-row color-row';

  const swatchId = `swatch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  div.innerHTML = `
    <input class="color-name" placeholder="Color name" value="${escaped(color.name || '')}">
    <div class="color-hex-wrap">
      <input class="color-hex" placeholder="Hex code" value="${escaped(color.hex || '')}" style="width:86px" data-swatch="${swatchId}">
      <span class="color-swatch" id="${swatchId}" style="background:${color.hex || '#cccccc'}"></span>
    </div>
    <div class="color-image-group">
      <div class="color-image-inputs">
        <input class="color-image" placeholder="Image URL" value="${escaped(color.image || '')}">
        <label class="color-upload-btn" title="Upload image">
          <input type="file" accept="image/*" hidden>
          Upload
        </label>
      </div>
      <div class="color-image-preview" id="preview-${swatchId}">
        ${color.image ? `<img src="${escaped(color.image)}" alt="">` : ''}
      </div>
    </div>
    <button type="button" class="remove-row-btn" title="Remove color" onclick="this.parentElement.remove()">✕</button>
  `;

  // --- Hex input → live swatch update ---
  const hexInput = div.querySelector('.color-hex');
  const swatch = div.querySelector('.color-swatch');
  hexInput.addEventListener('input', () => {
    swatch.style.background = hexInput.value || '#cccccc';
  });
  // Click swatch to launch browser color picker
  swatch.addEventListener('click', () => {
    const picker = document.createElement('input');
    picker.type = 'color';
    picker.value = hexInput.value || '#cccccc';
    picker.addEventListener('input', () => {
      hexInput.value = picker.value;
      swatch.style.background = picker.value;
    });
    picker.click();
  });

  // --- Upload handler for color image ---
  const fileInput = div.querySelector('input[type="file"]');
  const urlInput = div.querySelector('.color-image');
  const preview = div.querySelector('.color-image-preview');
  fileInput.addEventListener('change', async function () {
    const file = this.files[0];
    if (!file) return;
    preview.innerHTML = '<span class="color-uploading">Uploading…</span>';
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch(`${ADMIN_API}/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      urlInput.value = data.url;
      preview.innerHTML = `<img src="${data.url}" alt="">`;
      toast('Color image uploaded');
    } catch (e) {
      preview.innerHTML = `<span class="color-uploading" style="color:var(--red)">${escaped(e.message)}</span>`;
    }
  });

  // --- URL input → preview update ---
  urlInput.addEventListener('input', () => {
    const val = urlInput.value.trim();
    preview.innerHTML = val
      ? `<img src="${escaped(val)}" alt="" onerror="this.closest('.color-image-preview').innerHTML='<span class=\\'color-uploading\\' style=\\'color:var(--red)\\'>Bad URL</span>'">`
      : '';
  });

  container.appendChild(div);
}

function addSizeRow(size = '') {
  const container = document.getElementById('sizes-container');
  const div = document.createElement('div');
  div.className = 'dynamic-row';
  div.innerHTML = `
    <input class="size-value" placeholder="e.g. S, M, L, XL" value="${escaped(text(size))}" style="flex:1">
    <button type="button" class="remove-row-btn" onclick="this.parentElement.remove()">✕</button>
  `;
  container.appendChild(div);
}

// --- File Upload & Preview Handler ---
document.getElementById('product-image-upload').addEventListener('change', async function() {
  const file = this.files[0];
  if (!file) return;
  const preview = document.getElementById('upload-preview');
  preview.textContent = 'Uploading…';
  try {
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch(`${ADMIN_API}/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    document.getElementById('product-image').value = data.url;
    preview.innerHTML = `<img src="${data.url}" alt="">`;
    toast('Image uploaded');
  } catch (e) {
    preview.textContent = 'Upload failed: ' + e.message;
  }
});

// --- Live Image URL Preview ---
document.getElementById('product-image').addEventListener('input', function() {
  const preview = document.getElementById('upload-preview');
  const val = this.value.trim();
  preview.innerHTML = val
    ? `<img src="${escaped(val)}" alt="" onerror="this.parentElement.textContent='Invalid URL'">`
    : '';
});

// --- Product Table Rendering ---
function renderProducts() {
  const query = document.getElementById('product-filter').value.trim().toLowerCase();
  const products = adminProducts.filter(product =>
    `${product.name} ${product.category} ${product.tag || ''}`.toLowerCase().includes(query)
  );
  productBody.innerHTML = products.map(product => {
    const outOfStock = product.out_of_stock == 1;
    const lowStock = Number(product.stock) <= 10 && !outOfStock;
    return `
    <tr class="${outOfStock ? 'row-out-of-stock' : ''}">
      <td>
        <div class="product-cell">
          <strong>${escaped(product.name)}</strong>
          <small>${escaped(product.tag || 'No tag')}</small>
        </div>
      </td>
      <td>${escaped(product.category)}</td>
      <td>${money(product.price)}</td>
      <td class="${lowStock ? 'stock-low' : outOfStock ? 'stock-out' : ''}">${outOfStock ? 'OUT OF STOCK' : escaped(product.stock)}</td>
      <td>${outOfStock ? '<span class="pill pill-danger">Out of Stock</span>' : '<span class="pill pill-ok">In Stock</span>'}</td>
      <td>
        <div class="row-actions">
          <button type="button" data-edit-product="${product.id}">Edit</button>
          <button type="button" class="danger" data-delete-product="${product.id}">Delete</button>
        </div>
      </td>
    </tr>
  `}).join('') || '<tr><td colspan="6">No products found.</td></tr>';
}

function parseItems(items) {
  if (Array.isArray(items)) return items;
  try {
    return JSON.parse(items || '[]');
  } catch (error) {
    return [];
  }
}

function orderMatches(order, query) {
  const items = parseItems(order.items).map(item => item.product_name).join(' ');
  return `${order.id} ${order.customer_name} ${order.customer_email} ${items}`.toLowerCase().includes(query);
}

function option(value, current, label = value) {
  return `<option value="${value}" ${value === current ? 'selected' : ''}>${label}</option>`;
}

function renderOrders() {
  const query = document.getElementById('order-filter').value.trim().toLowerCase();
  const orders = adminOrders.filter(order => orderMatches(order, query));
  orderBody.innerHTML = orders.map(order => {
    const items = parseItems(order.items);
    return `
      <tr>
        <td>
          <div class="order-title">#${order.id}</div>
          <div class="subtle">${escaped(new Date(order.created_at).toLocaleString())}</div>
        </td>
        <td>
          <strong>${escaped(order.customer_name)}</strong>
          <div class="subtle">${escaped(order.customer_email)}</div>
          <div class="subtle">${escaped(order.customer_phone)}</div>
          <div class="subtle">${escaped(order.delivery_address)}</div>
        </td>
        <td>
          <div class="order-items">
            ${items.map(item => {
              const colorImg = item.product_color_image
                ? `<img src="${escaped(item.product_color_image)}" alt="" style="width:20px;height:20px;border-radius:3px;vertical-align:middle;margin-right:4px;">`
                : '';
              const colorText = item.product_color ? `, Color: ${escaped(item.product_color)}` : '';
              const sizeText = item.product_size ? `, Size: ${escaped(item.product_size)}` : '';
              return `<span style="display:block;margin-bottom:4px;">${colorImg}${escaped(item.product_name || `Product #${item.product_id}`)} x ${escaped(item.quantity)}${colorText}${sizeText}</span>`;
            }).join('')}
          </div>
        </td>
        <td>${money(order.total_amount)}</td>
        <td>
          <div class="payment-cell">
            <span class="pill">${escaped(order.payment_method || 'cod')}</span>
            <select class="status-select" data-payment-status="${order.id}">
              ${option('pending', order.payment_status)}
              ${option('awaiting', order.payment_status)}
              ${option('paid', order.payment_status)}
              ${option('failed', order.payment_status)}
              ${option('refunded', order.payment_status)}
            </select>
          </div>
        </td>
        <td>
          <div class="fulfillment-cell">
            <select class="status-select" data-order-status="${order.id}">
              ${option('pending', order.status)}
              ${option('processing', order.status)}
              ${option('shipped', order.status)}
              ${option('delivered', order.status)}
              ${option('cancelled', order.status)}
            </select>
          </div>
        </td>
      </tr>
    `;
  }).join('') || '<tr><td colspan="6">No orders found.</td></tr>';
}

function renderSavedAddresses() {
  const body = document.getElementById('admin-saved-addresses-body');
  if (!adminSavedAddresses.length) {
    body.innerHTML = '<tr><td colspan="10">No saved addresses found.</td></tr>';
    return;
  }
  body.innerHTML = adminSavedAddresses.map(addr => `
    <tr>
      <td>${addr.id}</td>
      <td>
        <strong>${escaped(addr.user_name || 'Unknown')}</strong>
        <div class="subtle">${escaped(addr.user_email || '')}</div>
      </td>
      <td>${escaped(addr.label)}</td>
      <td>
        <div class="address-preview">
          ${escaped(addr.house_no || addr.address || '')}${addr.street ? ', ' + escaped(addr.street) : ''}${addr.locality ? ', ' + escaped(addr.locality) : ''}
        </div>
      </td>
      <td>${escaped(addr.city || '')}</td>
      <td>${escaped(addr.state || '')}</td>
      <td>${escaped(addr.pincode || '')}</td>
      <td>${escaped(addr.phone || '')}</td>
      <td>${addr.is_default ? '<span class="pill pill-ok">Yes</span>' : '<span class="pill">No</span>'}</td>
      <td class="subtle">${escaped(new Date(addr.created_at).toLocaleString())}</td>
    </tr>
  `).join('');
}

function parseJSONField(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch (e) { return null; }
}

function productPayload() {
  // Collect specifications
  const specRows = document.querySelectorAll('#specs-container .dynamic-row');
  const specifications = [];
  specRows.forEach(row => {
    const key = row.querySelector('.spec-key')?.value.trim();
    const value = row.querySelector('.spec-value')?.value.trim();
    if (key && value) specifications.push({ key, value });
  });

  // Collect colors
  const colorRows = document.querySelectorAll('#colors-container .dynamic-row');
  const colors = [];
  colorRows.forEach(row => {
    const name = row.querySelector('.color-name')?.value.trim();
    const hex = row.querySelector('.color-hex')?.value.trim();
    const image = row.querySelector('.color-image')?.value.trim();
    if (name) colors.push({ name, hex: hex || null, image: image || null });
  });

  // Collect sizes
  const sizeRows = document.querySelectorAll('#sizes-container .dynamic-row');
  const sizes = [];
  sizeRows.forEach(row => {
    const val = row.querySelector('.size-value')?.value.trim();
    if (val) sizes.push(val);
  });

  return {
    name: document.getElementById('product-name').value.trim(),
    category: document.getElementById('product-category').value,
    stock: document.getElementById('product-stock').value,
    price: document.getElementById('product-price').value,
    original_price: document.getElementById('product-original-price').value,
    rating: document.getElementById('product-rating').value,
    reviews: document.getElementById('product-reviews').value,
    tag: document.getElementById('product-tag').value.trim(),
    badge: document.getElementById('product-badge').value.trim(),
    image: document.getElementById('product-image').value.trim(),
    description: document.getElementById('product-description').value.trim(),
    out_of_stock: document.getElementById('product-out-of-stock').checked ? 1 : 0,
    specifications: specifications.length > 0 ? JSON.stringify(specifications) : null,
    colors: colors.length > 0 ? JSON.stringify(colors) : null,
    sizes: sizes.length > 0 ? JSON.stringify(sizes) : null
  };
}

function fillProductForm(product) {
  document.getElementById('product-form-title').textContent = product ? 'Edit Product' : 'Add Product';
  document.getElementById('product-id').value = product?.id || '';
  document.getElementById('product-name').value = product?.name || '';
  document.getElementById('product-category').value = product?.category || 'clothing';
  document.getElementById('product-stock').value = product?.stock ?? 0;
  document.getElementById('product-price').value = product?.price || '';
  document.getElementById('product-original-price').value = product?.original_price || '';
  document.getElementById('product-rating').value = product?.rating || 4.5;
  document.getElementById('product-reviews').value = product?.reviews || 0;
  document.getElementById('product-tag').value = product?.tag || '';
  document.getElementById('product-badge').value = product?.badge || '';
  document.getElementById('product-image').value = product?.image || '';
  document.getElementById('product-description').value = product?.description || '';
  document.getElementById('product-out-of-stock').checked = product?.out_of_stock == 1;
  productStatus.textContent = '';

  // Fill specifications
  document.getElementById('specs-container').innerHTML = '';
  const specs = parseJSONField(product?.specifications);
  if (specs && Array.isArray(specs)) {
    specs.forEach(s => addSpecRow(s));
  }

  // Fill colors
  document.getElementById('colors-container').innerHTML = '';
  const colors = parseJSONField(product?.colors);
  if (colors && Array.isArray(colors)) {
    colors.forEach(c => addColorRow(c));
  }

  // Fill sizes
  document.getElementById('sizes-container').innerHTML = '';
  const sizes = parseJSONField(product?.sizes);
  if (sizes && Array.isArray(sizes)) {
    sizes.forEach(s => addSizeRow(s));
  }

  // Upload preview
  const preview = document.getElementById('upload-preview');
  if (product?.image) {
    preview.innerHTML = `<img src="${product.image}" alt="Preview" style="max-width:100px;max-height:60px">`;
  } else {
    preview.innerHTML = '';
  }
}

async function loadDashboard() {
  try {
    const [summary, products, orders, savedAddresses, invoices] = await Promise.all([
      request(`${ADMIN_API}/summary`),
      request(`${ADMIN_API}/products`),
      request(`${ADMIN_API}/orders`),
      request(`${ADMIN_API}/saved-addresses`),
      request(`${ADMIN_API}/invoices`)
    ]);
    adminProducts = products;
    adminOrders = orders;
    adminSavedAddresses = savedAddresses;
    adminInvoices = invoices;
    showAdmin();
    renderMetrics(summary);
    renderProducts();
    renderOrders();
    renderSavedAddresses();
    renderInvoices();
  } catch (error) {
    if (/access|admin/i.test(error.message)) {
      adminToken = '';
      localStorage.removeItem(tokenKey);
      showLogin(error.message);
      return;
    }
    toast(error.message);
  }
}

document.getElementById('admin-login-form').addEventListener('submit', async event => {
  event.preventDefault();
  loginStatus.textContent = '';
  try {
    const auth = await request('/api/login', {
      method: 'POST',
      body: JSON.stringify({
        email: document.getElementById('admin-email').value.trim(),
        password: document.getElementById('admin-password').value
      })
    });
    adminToken = auth.token;
    localStorage.setItem(tokenKey, adminToken);
    await loadDashboard();
  } catch (error) {
    loginStatus.textContent = error.message;
  }
});

productForm.addEventListener('submit', async event => {
  event.preventDefault();
  const id = document.getElementById('product-id').value;
  productStatus.textContent = '';
  try {
    await request(id ? `${ADMIN_API}/products/${id}` : `${ADMIN_API}/products`, {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(productPayload())
    });
    fillProductForm();
    toast(id ? 'Product updated.' : 'Product created.');
    await loadDashboard();
  } catch (error) {
    productStatus.textContent = error.message;
  }
});

productBody.addEventListener('click', async event => {
  const editId = event.target.dataset.editProduct;
  const deleteId = event.target.dataset.deleteProduct;
  if (editId) {
    fillProductForm(adminProducts.find(product => String(product.id) === editId));
  }
  if (deleteId && confirm('Delete this product?')) {
    try {
      await request(`${ADMIN_API}/products/${deleteId}`, { method: 'DELETE' });
      toast('Product deleted.');
      await loadDashboard();
    } catch (error) {
      toast(error.message);
    }
  }
});

orderBody.addEventListener('change', async event => {
  const orderId = event.target.dataset.orderStatus || event.target.dataset.paymentStatus;
  if (!orderId) return;
  const payload = event.target.dataset.orderStatus
    ? { status: event.target.value }
    : { payment_status: event.target.value };
  try {
    await request(`${ADMIN_API}/orders/${orderId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
    toast('Order updated.');
    await loadDashboard();
  } catch (error) {
    toast(error.message);
  }
});

document.querySelectorAll('.admin-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.admin-tab').forEach(node => node.classList.toggle('active', node === tab));
    document.querySelectorAll('.admin-view').forEach(view => view.classList.toggle('active', view.id === `${tab.dataset.view}-view`));
  });
});

document.getElementById('product-reset-btn').addEventListener('click', () => fillProductForm());
document.getElementById('product-filter').addEventListener('input', renderProducts);
document.getElementById('order-filter').addEventListener('input', renderOrders);
document.getElementById('admin-refresh-btn').addEventListener('click', loadDashboard);

document.getElementById('clear-orders-btn').addEventListener('click', async () => {
  if (!confirm('Delete ALL orders? This action cannot be undone.')) return;
  try {
    await request(`${ADMIN_API}/orders`, { method: 'DELETE' });
    toast('All orders deleted.');
    await loadDashboard();
  } catch (error) {
    toast(error.message);
  }
});

document.getElementById('clear-saved-addresses-btn').addEventListener('click', async () => {
  if (!confirm('Delete ALL saved addresses for all users? This action cannot be undone.')) return;
  try {
    const result = await request(`${ADMIN_API}/saved-addresses`, { method: 'DELETE' });
    toast(`${result.count} saved address(es) deleted.`);
    await loadDashboard();
  } catch (error) {
    toast(error.message);
  }
});

document.getElementById('admin-logout-btn').addEventListener('click', () => {
  adminToken = '';
  localStorage.removeItem(tokenKey);
  showLogin('');
});

// ═══════════════════════════════════════════════
//  Invoices
// ═══════════════════════════════════════════════

function renderInvoices() {
  const query = document.getElementById('invoice-filter').value.trim().toLowerCase();
  const invoices = query
    ? adminInvoices.filter(inv =>
        `${inv.invoice_number} ${inv.customer_name || ''} ${inv.order_id || ''}`.toLowerCase().includes(query)
      )
    : adminInvoices;
  const body = document.getElementById('admin-invoices-body');
  body.innerHTML = invoices.map(inv => {
    const invDate = inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString('en-IN') : '—';
    const paymentPillClass = inv.payment_status === 'paid' ? 'pill-ok' : inv.payment_status === 'pending' ? '' : 'pill-danger';
    const statusPillClass = inv.order_status === 'delivered' ? 'pill-ok' : inv.order_status === 'cancelled' ? 'pill-danger' : '';
    return `
      <tr>
        <td>
          <div class="invoice-cell">
            <strong>${escaped(inv.invoice_number)}</strong>
            <small>${escaped(inv._id)}</small>
          </div>
        </td>
        <td>${escaped(inv.customer_name || '—')}</td>
        <td>${escaped(inv.order_id || '—')}</td>
        <td>${money(inv.total_amount)}</td>
        <td><span class="pill ${paymentPillClass}">${escaped(inv.payment_status)}</span></td>
        <td><span class="pill ${statusPillClass}">${escaped(inv.order_status)}</span></td>
        <td class="subtle">${invDate}</td>
        <td>
          <div class="invoice-actions">
            <button type="button" data-view-invoice="${inv._id}">View</button>
            <button type="button" class="danger" data-delete-invoice="${inv._id}">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('') || '<tr><td colspan="8">No invoices found.</td></tr>';
}

// Handle invoice actions (view, delete) via event delegation
document.getElementById('admin-invoices-body').addEventListener('click', async event => {
  const viewId = event.target.dataset.viewInvoice;
  const deleteId = event.target.dataset.deleteInvoice;

  if (viewId) {
    try {
      const invoice = await request(`${ADMIN_API}/invoices/${viewId}`);
      toast(`Invoice ${invoice.invoice_number}: ${money(invoice.grand_total || invoice.total_amount)} — ${invoice.payment_status}`);
      // Open printable version in new tab
      window.open(`/api/admin/invoices/${viewId}/print`, '_blank');
    } catch (error) {
      toast(`Error: ${error.message}`);
    }
    return;
  }

  if (deleteId && confirm('Delete this invoice? This cannot be undone.')) {
    try {
      await request(`${ADMIN_API}/invoices/${deleteId}`, { method: 'DELETE' });
      toast('Invoice deleted.');
      adminInvoices = adminInvoices.filter(inv => inv._id !== deleteId);
      renderInvoices();
    } catch (error) {
      toast(error.message);
    }
  }
});

document.getElementById('invoice-filter').addEventListener('input', renderInvoices);

fillProductForm();
if (adminToken) {
  loadDashboard();
} else {
  showLogin('');
}
