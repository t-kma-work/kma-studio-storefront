/**
 * KMA STUDIO — Storefront Application Logic (Vanilla ES6, Zero-Build)
 * Warm Contemporary Art Design System · Redbubble-Inspired Architecture
 * Preserves Backend API Contract (doGet / doPost) strictly.
 */
(function () {
  'use strict';

  const CONFIG = window.KMA_CONFIG || {};
  const DESIGNS_META = CONFIG.DESIGNS || {};

  const COLOR_META = {
    BLK: { code: 'BLK', label: 'สีดำ', hex: '#1D1C1A', ring: '#1D1C1A' },
    WHT: { code: 'WHT', label: 'สีขาว', hex: '#FFFFFF', ring: '#A08E83' }
  };

  const state = {
    // 'catalog' | 'detail' | 'cart' | 'customer' | 'payment' | 'confirmation'
    view: 'catalog',
    submitting: false,
    settings: {
      Store_Status: 'OPEN',
      Delivery_Fee: 0,
      Free_Shipping_Min: 0,
      QR_Image_URL: '',
      Bank_Account_Info: '',
      Default_Terms: ''
    },
    skuMap: {},          // SKU_ID -> enriched SKU object
    designs: [],         // Ordered array of Design Collection objects (e.g. IP-SH01, IP-SH02)
    designMap: {},       // designKey -> Design Collection object
    activeDesignKey: '', // Currently opened Design in Product Detail view
    detailSelection: {
      colorCode: 'BLK',
      sizeKey: '',
      qty: 1,
      imageIndex: 0,
      storyExpanded: false
    },
    lightbox: {
      open: false,
      zoomed: false,
      images: [],
      index: 0,
      title: ''
    },
    cart: {},            // SKU_ID -> positive integer qty
    customer: {
      fulfillmentType: 'STUDIO_PICKUP', // 'STUDIO_PICKUP' | 'DELIVERY'
      shippingAddress: '',
      name: '',
      phone: '',
      email: '',
      lineId: '',
      campGroupNote: '',
      acceptedTerms: false
    },
    touched: {
      name: false,
      phone: false,
      email: false,
      shippingAddress: false,
      acceptedTerms: false
    },
    payment: {
      transferDate: '',
      transferTime: '',
      slipBase64: '',
      slipMimeType: 'image/jpeg',
      slipFileName: '',
      slipPreviewUrl: '',
      originalKB: 0,
      compressedKB: 0
    },
    orderResult: null
  };

  // ==================== DOM & FORMAT HELPERS ====================
  const $ = (id) => document.getElementById(id);

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatMoney(num) {
    return Number(num || 0).toLocaleString('th-TH');
  }

  function showToast(message, type) {
    const container = $('toast-container');
    if (!container) return;

    const classes =
      type === 'error'
        ? 'bg-rose-900 text-white border-rose-700'
        : 'bg-ink text-ivory border-taupe/40';

    const el = document.createElement('div');
    el.className =
      'pointer-events-auto max-w-md w-full px-4 py-2.5 rounded-xl border shadow-lg text-xs sm:text-sm font-medium text-center transition-all duration-300 ' +
      classes;
    el.textContent = message;
    container.appendChild(el);

    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(-6px)';
      setTimeout(() => el.remove(), 280);
    }, 3000);
  }

  function getTodayLocalISO() {
    const now = new Date();
    return (
      now.getFullYear() +
      '-' +
      String(now.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(now.getDate()).padStart(2, '0')
    );
  }

  function getNowLocalTimeHHMM() {
    const now = new Date();
    return String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  }

  function formatISOToDDMMYYYY(isoDate) {
    if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate || '-';
    const p = isoDate.split('-');
    return `${p[2]}/${p[1]}/${p[0]}`;
  }

  // ==================== DESIGN / COLOR / SIZE NORMALIZATION ====================
  function parseImageList(imageUrlStr) {
    return String(imageUrlStr || '')
      .split(',')
      .map((u) => u.trim())
      .filter(Boolean)
      .slice(0, 5);
  }

  function detectBaseDesignKey(raw) {
    const ref = String(raw.IP_Design_Ref || '').trim().toUpperCase();
    const sku = String(raw.SKU_ID || '').trim().toUpperCase();
    const name = String(raw.Product_Name || '').trim();

    if (ref.includes('IP-SH01') || ref.includes('SH01') || sku.includes('SH01') || name.includes('พี่ทศ') || name.includes('ทศกัณฐ์')) {
      return 'IP-SH01';
    }
    if (ref.includes('IP-SH02') || ref.includes('SH02') || sku.includes('SH02') || name.includes('พี่สหัส') || name.includes('จินตนาการ')) {
      return 'IP-SH02';
    }
    // Strip trailing -BLK / -WHT if a future design follows the same convention
    if (ref) {
      return ref.replace(/-(BLK|WHT|BLACK|WHITE)$/i, '');
    }
    return name || sku;
  }

  function detectColorCode(raw) {
    const combined = (
      String(raw.IP_Design_Ref || '') +
      ' ' +
      String(raw.SKU_ID || '') +
      ' ' +
      String(raw.Product_Name || '') +
      ' ' +
      String(raw.Image_URL || '')
    ).toUpperCase();

    if (
      combined.includes('WHT') ||
      combined.includes('WHITE') ||
      combined.includes('สีขาว') ||
      combined.includes('ขาว')
    ) {
      return 'WHT';
    }
    return 'BLK';
  }

  function parseSizeInfo(sizeLabel, skuId) {
    const rawLabel = String(sizeLabel || '').trim();
    const upper = (rawLabel + ' ' + String(skuId || '')).toUpperCase();

    // Check Kid sizes: 12, 13, 14, 15
    const kidNumMatch = rawLabel.match(/(?:เด็ก|kid|k)?\s*(12|13|14|15)\b/i) || String(skuId || '').match(/K(12|13|14|15)\b/i);
    if (kidNumMatch) {
      const n = kidNumMatch[1];
      return {
        group: 'KID',
        sizeKey: 'KID_' + n,
        displayLabel: 'เด็ก ' + n,
        rank: 10 + Number(n)
      };
    }

    // Check Adult sizes: 3XL, 2XL, XL, L, M, S (order matters: check 3XL/2XL/XL before L/S)
    const adultTokens = [
      { key: '3XL', label: 'ผู้ใหญ่ 3XL', rank: 106, regex: /\b3XL\b|A3XL/i },
      { key: '2XL', label: 'ผู้ใหญ่ 2XL', rank: 105, regex: /\b2XL\b|A2XL/i },
      { key: 'XL', label: 'ผู้ใหญ่ XL', rank: 104, regex: /\bXL\b|AXL/i },
      { key: 'L', label: 'ผู้ใหญ่ L', rank: 103, regex: /(?:ผู้ใหญ่|adult)?\s*\bL\b|-AL$/i },
      { key: 'M', label: 'ผู้ใหญ่ M', rank: 102, regex: /(?:ผู้ใหญ่|adult)?\s*\bM\b|-AM$/i },
      { key: 'S', label: 'ผู้ใหญ่ S', rank: 101, regex: /(?:ผู้ใหญ่|adult)?\s*\bS\b|-AS$/i }
    ];

    for (let i = 0; i < adultTokens.length; i++) {
      const tok = adultTokens[i];
      if (tok.regex.test(rawLabel) || tok.regex.test(upper)) {
        return {
          group: 'ADULT',
          sizeKey: 'ADULT_' + tok.key,
          displayLabel: tok.label,
          rank: tok.rank
        };
      }
    }

    // Fallback for any other label
    const isKidFallback = rawLabel.includes('เด็ก') || upper.includes('KID');
    return {
      group: isKidFallback ? 'KID' : 'ADULT',
      sizeKey: (isKidFallback ? 'KID_' : 'ADULT_') + rawLabel,
      displayLabel: rawLabel || String(skuId || ''),
      rank: isKidFallback ? 50 : 200
    };
  }

  function isSkuSoldOut(sku) {
    return sku && sku.Sale_Mode === 'IN_STOCK' && Number(sku.Stock_Qty || 0) <= 0;
  }

  function getMaxQtyForSku(sku) {
    if (!sku) return 0;
    if (sku.Sale_Mode === 'IN_STOCK') return Math.max(0, Number(sku.Stock_Qty || 0));
    return 99;
  }

  function buildDesignCollections(products) {
    const map = {};
    state.skuMap = {};

    products.forEach((raw) => {
      if (raw.Is_Active === false || String(raw.Is_Active || '').trim().toUpperCase() === 'FALSE') {
        return;
      }

      const skuId = String(raw.SKU_ID || '').trim();
      if (!skuId) return;

      const designKey = detectBaseDesignKey(raw);
      const colorCode = detectColorCode(raw);
      const sizeInfo = parseSizeInfo(raw.Size_Label, skuId);
      const meta = DESIGNS_META[designKey] || {};

      const sku = {
        SKU_ID: skuId,
        IP_Design_Ref: String(raw.IP_Design_Ref || '').trim(),
        designKey: designKey,
        colorCode: colorCode,
        colorLabel: (COLOR_META[colorCode] && COLOR_META[colorCode].label) || colorCode,
        sizeGroup: sizeInfo.group,
        sizeKey: sizeInfo.sizeKey,
        sizeDisplay: sizeInfo.displayLabel,
        sizeRank: sizeInfo.rank,
        Product_Name: String(raw.Product_Name || meta.thaiName || designKey).trim(),
        thaiDesignName: meta.thaiName || String(raw.Product_Name || designKey).trim(),
        Size_Label: String(raw.Size_Label || sizeInfo.displayLabel).trim(),
        Sale_Mode: String(raw.Sale_Mode || 'PRE_ORDER').trim().toUpperCase(),
        Unit_Price: Number(raw.Unit_Price || 0),
        Stock_Qty: Number(raw.Stock_Qty || 0),
        Product_Terms: String(raw.Product_Terms || '').trim(),
        Image_URL: String(raw.Image_URL || '').trim(),
        Version: Number(raw.Version || 1)
      };

      state.skuMap[sku.SKU_ID] = sku;

      if (!map[designKey]) {
        map[designKey] = {
          designKey: designKey,
          order: meta.order || 99,
          thaiName: meta.thaiName || sku.Product_Name,
          englishSubtitle: meta.englishSubtitle || designKey,
          shortDescription: meta.shortDescription || '',
          story: meta.story || '',
          colors: {},     // colorCode -> { code, label, hex, images: [], skus: [] }
          colorOrder: [],
          minPrice: Infinity,
          maxPrice: 0,
          hasPreOrder: false,
          hasInStock: false
        };
      }

      const design = map[designKey];
      if (!design.colors[colorCode]) {
        const cm = COLOR_META[colorCode] || { code: colorCode, label: colorCode, hex: '#1D1C1A', ring: '#A08E83' };
        design.colors[colorCode] = {
          code: cm.code,
          label: cm.label,
          hex: cm.hex,
          ring: cm.ring,
          images: [],
          skus: []
        };
        design.colorOrder.push(colorCode);
      }

      const colorBucket = design.colors[colorCode];
      colorBucket.skus.push(sku);

      const parsedImages = parseImageList(sku.Image_URL);
      parsedImages.forEach((imgUrl) => {
        if (colorBucket.images.length < 5 && !colorBucket.images.includes(imgUrl)) {
          colorBucket.images.push(imgUrl);
        }
      });

      if (sku.Unit_Price < design.minPrice) design.minPrice = sku.Unit_Price;
      if (sku.Unit_Price > design.maxPrice) design.maxPrice = sku.Unit_Price;
      if (sku.Sale_Mode === 'PRE_ORDER') design.hasPreOrder = true;
      if (sku.Sale_Mode === 'IN_STOCK') design.hasInStock = true;
    });

    // Finalize sorting & V10 image guarantees per color
    const list = Object.keys(map)
      .map((k) => map[k])
      .sort((a, b) => a.order - b.order);

    list.forEach((design) => {
      // Ensure BLK comes before WHT consistently
      design.colorOrder.sort((a, b) => (a === 'BLK' ? -1 : b === 'BLK' ? 1 : a.localeCompare(b)));

      const meta = DESIGNS_META[design.designKey] || {};
      design.colorOrder.forEach((colorCode) => {
        const cb = design.colors[colorCode];
        cb.skus.sort((a, b) => a.sizeRank - b.sizeRank);

        // If Sheet didn't provide all 5 V10 jpgs or is empty, use approved V10 images for that design+color
        const defaultImgs = meta.defaultImages && meta.defaultImages[colorCode];
        if (cb.images.length === 0 && Array.isArray(defaultImgs)) {
          cb.images = defaultImgs.slice(0, 5);
        }
      });

      if (design.minPrice === Infinity) design.minPrice = 0;
    });

    state.designs = list;
    state.designMap = map;
  }

  // ==================== CART & PRICING ====================
  function getCartItems() {
    return Object.keys(state.cart)
      .map((skuId) => {
        const sku = state.skuMap[skuId];
        const qty = Number(state.cart[skuId] || 0);
        if (!sku || qty <= 0) return null;
        const design = state.designMap[sku.designKey];
        const colorBucket = design && design.colors[sku.colorCode];
        const thumb = (colorBucket && colorBucket.images && colorBucket.images[0]) || '';
        return {
          sku,
          qty,
          thumb,
          lineTotal: Number(sku.Unit_Price || 0) * qty
        };
      })
      .filter(Boolean);
  }

  function getCartItemCount() {
    return getCartItems().reduce((sum, item) => sum + item.qty, 0);
  }

  function getCartSubtotal() {
    return getCartItems().reduce((sum, item) => sum + item.lineTotal, 0);
  }

  function getShippingFee(subtotal, fulfillmentType) {
    if (fulfillmentType !== 'DELIVERY') return 0;
    const deliveryFee = Number(state.settings.Delivery_Fee || 0);
    const freeMin = Number(state.settings.Free_Shipping_Min || 0);
    if (freeMin > 0 && subtotal >= freeMin) return 0;
    return deliveryFee;
  }

  function getGrandTotal() {
    const subtotal = getCartSubtotal();
    return subtotal + getShippingFee(subtotal, state.customer.fulfillmentType);
  }

  function getFulfillmentLabel(type) {
    return type === 'DELIVERY' ? 'จัดส่งพัสดุ' : 'รับเองที่สตูดิโอ';
  }

  function addToCart(skuId, qtyToAdd) {
    const sku = state.skuMap[skuId];
    if (!sku) return false;
    if (isSkuSoldOut(sku)) {
      showToast('ขนาดนี้สินค้าหมดชั่วคราว', 'error');
      return false;
    }

    const current = Number(state.cart[skuId] || 0);
    const maxQty = getMaxQtyForSku(sku);
    let nextQty = current + Number(qtyToAdd || 1);
    if (nextQty > maxQty) {
      nextQty = maxQty;
      showToast(`สินค้าพร้อมส่งขนาดนี้มีคงเหลือ ${maxQty} ชิ้น`, 'error');
    }
    state.cart[skuId] = nextQty;
    updateCartIndicators();
    return true;
  }

  function setCartQty(skuId, delta) {
    const sku = state.skuMap[skuId];
    if (!sku) return;
    const current = Number(state.cart[skuId] || 0);
    const maxQty = getMaxQtyForSku(sku);
    let next = current + delta;

    if (next > maxQty) {
      next = maxQty;
      showToast(`สินค้าพร้อมส่งขนาดนี้มีคงเหลือ ${maxQty} ชิ้น`, 'error');
    }

    if (next <= 0) {
      delete state.cart[skuId];
    } else {
      state.cart[skuId] = next;
    }

    updateCartIndicators();
    if (state.view === 'cart') renderCartPage();
    if (state.view === 'customer') {
      renderCustomerSummary();
      renderDynamicTerms();
    }
  }

  function removeCartItem(skuId) {
    delete state.cart[skuId];
    updateCartIndicators();
    if (state.view === 'cart') renderCartPage();
    if (state.view === 'customer') {
      if (getCartItemCount() === 0) {
        navigateTo('cart');
      } else {
        renderCustomerSummary();
        renderDynamicTerms();
      }
    }
  }

  function updateCartIndicators() {
    const count = getCartItemCount();
    const subtotal = getCartSubtotal();

    // Header badge
    const badge = $('header-cart-badge');
    if (count > 0) {
      badge.textContent = String(count);
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }

    // Sticky cart bar (ONLY on catalog & detail when cart has items)
    const stickyBar = $('sticky-cart-bar');
    const isBrowsing = state.view === 'catalog' || state.view === 'detail';
    if (isBrowsing && count > 0) {
      $('sticky-item-count').textContent = String(count);
      $('sticky-subtotal').textContent = formatMoney(subtotal);
      stickyBar.classList.remove('hidden');
    } else {
      stickyBar.classList.add('hidden');
    }
  }

  // ==================== NAVIGATION ====================
  const VIEW_IDS = ['view-catalog', 'view-detail', 'view-cart', 'view-customer', 'view-payment', 'view-confirmation'];

  function hideAllViews() {
    VIEW_IDS.forEach((id) => {
      const el = $(id);
      if (el) el.classList.add('hidden');
    });
  }

  function updateCheckoutProgress(viewName) {
    const nav = $('checkout-progress-nav');
    const stepMap = { cart: 1, customer: 2, payment: 3, confirmation: 4 };
    const activeStep = stepMap[viewName] || 0;

    if (activeStep === 0) {
      nav.classList.add('hidden');
      return;
    }

    nav.classList.remove('hidden');
    document.querySelectorAll('#step-indicator [data-checkout-step]').forEach((item) => {
      const n = Number(item.getAttribute('data-checkout-step'));
      const numEl = item.querySelector('.step-num');
      if (n === activeStep) {
        item.className = 'flex items-center justify-center sm:justify-start gap-1.5 px-2 py-1.5 rounded-xl bg-ink text-ivory';
        numEl.className = 'step-num w-5 h-5 rounded-full text-[11px] font-semibold flex items-center justify-center shrink-0 bg-blush text-ink';
      } else if (n < activeStep) {
        item.className = 'flex items-center justify-center sm:justify-start gap-1.5 px-2 py-1.5 rounded-xl bg-blush/70 text-ink';
        numEl.className = 'step-num w-5 h-5 rounded-full text-[11px] font-semibold flex items-center justify-center shrink-0 bg-ink text-ivory';
      } else {
        item.className = 'flex items-center justify-center sm:justify-start gap-1.5 px-2 py-1.5 rounded-xl bg-ivory text-taupe';
        numEl.className = 'step-num w-5 h-5 rounded-full text-[11px] font-semibold flex items-center justify-center shrink-0 bg-taupeLight text-ink/70';
      }
    });
  }

  function navigateTo(viewName) {
    state.view = viewName;
    $('view-loading').classList.add('hidden');
    $('view-closed').classList.add('hidden');
    hideAllViews();

    const target = $('view-' + viewName);
    if (target) target.classList.remove('hidden');

    // Adjust bottom spacing cleanly so sticky bar never overlaps content/buttons
    const main = $('main-container');
    if (viewName === 'catalog' || viewName === 'detail') {
      main.className = 'max-w-4xl mx-auto px-4 pt-5 pb-36';
    } else {
      main.className = 'max-w-4xl mx-auto px-4 pt-5 pb-16';
    }

    updateCheckoutProgress(viewName);
    updateCartIndicators();

    if (viewName === 'catalog') {
      renderCatalogView();
    } else if (viewName === 'detail') {
      renderProductDetailView();
    } else if (viewName === 'cart') {
      renderCartPage();
    } else if (viewName === 'customer') {
      renderCustomerSummary();
      renderDynamicTerms();
    } else if (viewName === 'payment') {
      renderPaymentView();
    } else if (viewName === 'confirmation') {
      renderConfirmationView();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openDesignDetail(designKey) {
    const design = state.designMap[designKey];
    if (!design) return;

    state.activeDesignKey = designKey;
    const defaultColor = design.colorOrder[0] || 'BLK';
    const colorBucket = design.colors[defaultColor];
    const firstSku =
      (colorBucket && colorBucket.skus.find((s) => !isSkuSoldOut(s) && s.sizeKey === 'ADULT_M')) ||
      (colorBucket && colorBucket.skus.find((s) => !isSkuSoldOut(s))) ||
      (colorBucket && colorBucket.skus[0]);

    state.detailSelection = {
      colorCode: defaultColor,
      sizeKey: firstSku ? firstSku.sizeKey : '',
      qty: 1,
      imageIndex: 0,
      storyExpanded: false
    };

    navigateTo('detail');
  }

  // ==================== DATA LOADING ====================
  async function loadStoreData() {
    $('view-loading').classList.remove('hidden');
    $('view-closed').classList.add('hidden');
    hideAllViews();
    $('checkout-progress-nav').classList.add('hidden');
    $('sticky-cart-bar').classList.add('hidden');

    if (CONFIG.MOCK_MODE) {
      $('mock-banner').classList.remove('hidden');
      applyLoadedData(CONFIG.MOCK_DATA);
      return;
    }

    $('mock-banner').classList.add('hidden');
    if (!CONFIG.API_URL || CONFIG.API_URL.includes('YOUR_DEPLOYMENT_ID')) {
      showClosedView(
        'ยังไม่ได้ตั้งค่า API_URL',
        'กรุณาตรวจสอบการตั้งค่า API_URL ในไฟล์ config.js ก่อนเปิดใช้งานหน้าร้าน'
      );
      return;
    }

    try {
      const response = await fetch(CONFIG.API_URL, { method: 'GET' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!data || data.ok === false) {
        throw new Error((data && data.error) || 'ไม่สามารถโหลดข้อมูลร้านค้าได้');
      }
      applyLoadedData(data);
    } catch (err) {
      showClosedView(
        'ไม่สามารถเชื่อมต่อระบบร้านค้าได้',
        `กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่อีกครั้ง (${err.message})`
      );
    }
  }

  function applyLoadedData(data) {
    const settings = (data && data.settings) || {};
    state.settings = {
      Store_Status: String(settings.Store_Status || 'OPEN').trim().toUpperCase(),
      Delivery_Fee: Number(settings.Delivery_Fee || 0),
      Free_Shipping_Min: Number(settings.Free_Shipping_Min || 0),
      QR_Image_URL: String(settings.QR_Image_URL || CONFIG.FALLBACK_QR_IMAGE || 'images/sys-qr-pay.png').trim(),
      Bank_Account_Info: String(settings.Bank_Account_Info || '').trim(),
      Default_Terms: String(settings.Default_Terms || '').trim()
    };

    if (state.settings.Store_Status !== 'OPEN') {
      showClosedView(
        'ปิดรับคำสั่งซื้อชั่วคราว',
        'ขณะนี้ร้านค้า KMA STUDIO อยู่ระหว่างปิดรอบการสั่งซื้อ ขอบคุณที่ให้ความสนใจและติดตามผลงานของเรา'
      );
      return;
    }

    const products = Array.isArray(data && data.products) ? data.products : [];
    buildDesignCollections(products);

    if (state.designs.length === 0) {
      showClosedView('ยังไม่มีสินค้าเปิดจำหน่ายในขณะนี้', 'กรุณากลับมาตรวจสอบอีกครั้งเร็ว ๆ นี้');
      return;
    }

    // Default transfer date & time
    state.payment.transferDate = getTodayLocalISO();
    state.payment.transferTime = getNowLocalTimeHHMM();
    $('input-transfer-date').value = state.payment.transferDate;
    $('input-transfer-time').value = state.payment.transferTime;

    renderSizeChartModal();
    navigateTo('catalog');
  }

  function showClosedView(title, message) {
    $('view-loading').classList.add('hidden');
    hideAllViews();
    $('checkout-progress-nav').classList.add('hidden');
    $('sticky-cart-bar').classList.add('hidden');
    $('closed-title').textContent = title;
    $('closed-message').textContent = message;
    $('view-closed').classList.remove('hidden');
  }

  // ==================== VIEW A: COLLECTION CATALOG ====================
  function renderCatalogView() {
    const grid = $('catalog-grid');
    if (!grid) return;

    grid.innerHTML = state.designs
      .map((design) => {
        const primaryColor = design.colors[design.colorOrder[0]];
        const heroImg = (primaryColor && primaryColor.images && primaryColor.images[0]) || '';
        const statusBadge = design.hasPreOrder
          ? 'เปิดรับจองล่วงหน้า (Pre-order)'
          : 'พร้อมส่ง';

        const priceLabel =
          design.minPrice === design.maxPrice
            ? `${formatMoney(design.minPrice)} บาท`
            : `เริ่มต้น ${formatMoney(design.minPrice)} บาท`;

        const swatchesHtml = design.colorOrder
          .map((cCode) => {
            const c = design.colors[cCode];
            return `
              <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-ivory border border-taupeLight text-[11px] font-medium text-ink">
                <span class="w-3 h-3 rounded-full border border-taupe/70 shrink-0" style="background-color: ${escapeHtml(c.hex)};"></span>
                <span>${escapeHtml(c.label)}</span>
              </span>
            `;
          })
          .join('');

        return `
          <article
            data-action="open-design"
            data-design="${escapeHtml(design.designKey)}"
            class="cursor-pointer group bg-white rounded-3xl border border-taupeLight overflow-hidden shadow-art hover:border-taupe transition flex flex-col"
          >
            <!-- Clean White Image Canvas preserving aspect ratio -->
            <div class="relative bg-white p-4 sm:p-5 border-b border-taupeLight/60 flex items-center justify-center aspect-[4/4]">
              ${
                heroImg
                  ? `<img
                      src="${escapeHtml(heroImg)}"
                      alt="${escapeHtml(design.thaiName)}"
                      class="w-full h-full object-contain group-hover:scale-[1.02] transition-transform duration-300"
                      loading="lazy"
                    />`
                  : `<div class="text-xs text-taupe font-serif tracking-widest">KMA STUDIO</div>`
              }
              <span class="absolute top-3.5 left-3.5 px-3 py-1 rounded-full bg-blush text-ink text-[11px] font-medium">
                ${escapeHtml(statusBadge)}
              </span>
            </div>

            <!-- Card Body -->
            <div class="p-5 sm:p-6 flex-1 flex flex-col justify-between gap-4">
              <div class="space-y-2.5">
                <div>
                  <p class="font-serif text-xs sm:text-sm tracking-[0.12em] uppercase text-taupe font-semibold">
                    ${escapeHtml(design.englishSubtitle)}
                  </p>
                  <h2 class="text-lg sm:text-xl font-semibold text-ink leading-snug mt-0.5">
                    ${escapeHtml(design.thaiName)}
                  </h2>
                </div>

                ${
                  design.shortDescription
                    ? `<p class="text-xs sm:text-sm text-ink/75 leading-relaxed line-clamp-3">${escapeHtml(design.shortDescription)}</p>`
                    : ''
                }

                <div class="flex flex-wrap items-center gap-2 pt-1">
                  ${swatchesHtml}
                </div>
              </div>

              <div class="pt-3 border-t border-taupeLight/70 flex items-center justify-between gap-3">
                <div>
                  <div class="text-[11px] text-taupe">ราคา</div>
                  <div class="text-base sm:text-lg font-semibold text-ink">${escapeHtml(priceLabel)}</div>
                </div>

                <button
                  type="button"
                  data-action="open-design"
                  data-design="${escapeHtml(design.designKey)}"
                  class="px-4 py-2.5 rounded-xl bg-ink text-ivory text-xs sm:text-sm font-medium group-hover:opacity-90 active:scale-95 transition"
                >
                  ดูรายละเอียดสินค้า
                </button>
              </div>
            </div>
          </article>
        `;
      })
      .join('');
  }

  // ==================== VIEW B: PRODUCT DETAIL ====================
  function getActiveDetailContext() {
    const design = state.designMap[state.activeDesignKey];
    if (!design) return null;
    const colorBucket = design.colors[state.detailSelection.colorCode] || design.colors[design.colorOrder[0]];
    if (!colorBucket) return null;

    let selectedSku = colorBucket.skus.find((s) => s.sizeKey === state.detailSelection.sizeKey);
    if (!selectedSku) {
      selectedSku = colorBucket.skus.find((s) => !isSkuSoldOut(s)) || colorBucket.skus[0];
      if (selectedSku) state.detailSelection.sizeKey = selectedSku.sizeKey;
    }

    return { design, colorBucket, selectedSku };
  }

  function renderProductDetailView() {
    const container = $('detail-content');
    const ctx = getActiveDetailContext();
    if (!container || !ctx) return;

    const { design, colorBucket, selectedSku } = ctx;
    const images = colorBucket.images || [];
    const imgIdx = Math.min(Math.max(0, state.detailSelection.imageIndex), Math.max(0, images.length - 1));
    state.detailSelection.imageIndex = imgIdx;
    const activeImg = images[imgIdx] || '';

    const statusBadge =
      selectedSku && selectedSku.Sale_Mode === 'IN_STOCK'
        ? isSkuSoldOut(selectedSku)
          ? 'สินค้าหมดชั่วคราว'
          : `พร้อมส่ง (คงเหลือ ${selectedSku.Stock_Qty} ชิ้น)`
        : 'เปิดรับจองล่วงหน้า (Pre-order)';

    // Color Pills
    const colorPillsHtml = design.colorOrder
      .map((cCode) => {
        const c = design.colors[cCode];
        const isActive = cCode === colorBucket.code;
        return `
          <button
            type="button"
            data-action="detail-color"
            data-color="${escapeHtml(cCode)}"
            class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition ${
              isActive
                ? 'border-ink bg-ink text-ivory shadow-xs'
                : 'border-taupeLight bg-white text-ink hover:border-taupe'
            }"
          >
            <span
              class="w-4 h-4 rounded-full border shrink-0"
              style="background-color: ${escapeHtml(c.hex)}; border-color: ${isActive ? '#FAF7F2' : '#A08E83'};"
            ></span>
            <span>${escapeHtml(c.label)}</span>
          </button>
        `;
      })
      .join('');

    // Size Rows: Kid & Adult (clean labels without repeated prices)
    const kidSkus = colorBucket.skus.filter((s) => s.sizeGroup === 'KID');
    const adultSkus = colorBucket.skus.filter((s) => s.sizeGroup === 'ADULT');

    function renderSizeButtons(skuList) {
      return skuList
        .map((sku) => {
          const isSelected = selectedSku && sku.SKU_ID === selectedSku.SKU_ID;
          const soldOut = isSkuSoldOut(sku);
          let cls = 'px-3 py-2.5 rounded-xl border text-xs sm:text-sm font-medium text-center transition ';
          if (soldOut) {
            cls += isSelected
              ? 'border-rose-400 bg-rose-50 text-taupe line-through'
              : 'border-taupeLight bg-ivory text-taupe/70 line-through';
          } else if (isSelected) {
            cls += 'border-ink bg-ink text-ivory';
          } else {
            cls += 'border-taupeLight bg-white text-ink hover:border-taupe';
          }

          return `
            <button
              type="button"
              data-action="detail-size"
              data-size-key="${escapeHtml(sku.sizeKey)}"
              class="${cls}"
            >
              ${escapeHtml(sku.sizeDisplay)}
            </button>
          `;
        })
        .join('');
    }

    // Thumbnail Strip (5 V10 images)
    const thumbsHtml =
      images.length > 1
        ? `
          <div class="grid grid-cols-5 gap-2 mt-3">
            ${images
              .map(
                (url, i) => `
                  <button
                    type="button"
                    data-action="detail-thumb"
                    data-index="${i}"
                    aria-label="ดูภาพที่ ${i + 1}"
                    class="rounded-xl bg-white p-1 border-2 aspect-square overflow-hidden transition ${
                      i === imgIdx ? 'border-ink' : 'border-taupeLight hover:border-taupe'
                    }"
                  >
                    <img src="${escapeHtml(url)}" alt="${escapeHtml(design.thaiName)} ภาพที่ ${i + 1}" class="w-full h-full object-contain" loading="lazy" />
                  </button>
                `
              )
              .join('')}
          </div>
        `
        : '';

    // Dynamic Shipping Policy bullet (Strictly from 00_Settings — NO hardcoded amounts!)
    const deliveryFee = Number(state.settings.Delivery_Fee || 0);
    const freeMin = Number(state.settings.Free_Shipping_Min || 0);
    let shippingLine =
      deliveryFee > 0
        ? `เลือกได้ทั้งรับเองที่สตูดิโอ (0 บาท) หรือจัดส่งพัสดุ (ค่าจัดส่ง ${formatMoney(deliveryFee)} บาท)`
        : 'เลือกได้ทั้งรับเองที่สตูดิโอ หรือจัดส่งพัสดุ';
    if (freeMin > 0 && deliveryFee > 0) {
      shippingLine += ` · ส่งฟรีเมื่อยอดสินค้าครบ ${formatMoney(freeMin)} บาท`;
    }

    const soldOutSelected = isSkuSoldOut(selectedSku);
    const livePriceText = selectedSku ? `ราคา ${formatMoney(selectedSku.Unit_Price)} บาท` : '—';

    container.innerHTML = `
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        <!-- 1. Product Gallery Column -->
        <div class="lg:col-span-6">
          <div
            id="detail-gallery-viewport"
            data-gallery-count="${images.length}"
            class="relative rounded-3xl bg-white border border-taupeLight p-3 sm:p-5 shadow-art overflow-hidden touch-pan-y"
          >
            <div class="relative aspect-square flex items-center justify-center bg-white">
              ${
                activeImg
                  ? `<img
                      id="detail-hero-img"
                      data-action="open-lightbox"
                      src="${escapeHtml(activeImg)}"
                      alt="${escapeHtml(design.thaiName)} (${escapeHtml(colorBucket.label)})"
                      class="w-full h-full object-contain cursor-zoom-in select-none"
                      draggable="false"
                    />`
                  : `<div class="text-sm text-taupe font-serif">KMA STUDIO</div>`
              }
            </div>

            ${
              images.length > 1
                ? `
                  <button
                    type="button"
                    data-action="detail-prev-img"
                    aria-label="ภาพก่อนหน้า"
                    class="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 border border-taupeLight text-ink shadow flex items-center justify-center hover:bg-ivory active:scale-95 transition"
                  >
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    data-action="detail-next-img"
                    aria-label="ภาพถัดไป"
                    class="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 border border-taupeLight text-ink shadow flex items-center justify-center hover:bg-ivory active:scale-95 transition"
                  >
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                `
                : ''
            }

            <div class="mt-2 flex items-center justify-between text-[11px] text-taupe px-1">
              <button
                type="button"
                data-action="open-lightbox"
                class="inline-flex items-center gap-1 hover:text-ink transition"
              >
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                </svg>
                <span>แตะภาพเพื่อขยายดูรายละเอียดลาย</span>
              </button>
              ${images.length > 1 ? `<span>${imgIdx + 1} / ${images.length}</span>` : ''}
            </div>
          </div>

          ${thumbsHtml}
        </div>

        <!-- 2 & 3. Story + Configuration Column -->
        <div class="lg:col-span-6 space-y-5">
          <!-- Title, Subtitle & Short Description -->
          <div class="space-y-2.5">
            <span class="inline-block px-3 py-1 rounded-full bg-blush text-ink text-xs font-medium">
              ${escapeHtml(statusBadge)}
            </span>

            <div>
              <p class="font-serif text-sm tracking-[0.14em] uppercase text-taupe font-semibold">
                ${escapeHtml(design.englishSubtitle)}
              </p>
              <h1 class="text-2xl sm:text-3xl font-semibold text-ink leading-snug mt-0.5">
                ${escapeHtml(design.thaiName)}
              </h1>
            </div>

            ${
              design.shortDescription
                ? `<p class="text-sm text-ink/80 leading-relaxed">${escapeHtml(design.shortDescription)}</p>`
                : ''
            }

            ${
              design.story
                ? `
                  <div class="pt-1">
                    <button
                      type="button"
                      data-action="toggle-story"
                      class="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-2xl bg-white border border-taupeLight text-left hover:border-taupe transition"
                    >
                      <span class="text-xs sm:text-sm font-medium text-ink">เรื่องราวเบื้องหลังผลงาน (Product Story)</span>
                      <span class="text-xs text-taupe shrink-0">${state.detailSelection.storyExpanded ? 'ซ่อน ▲' : 'อ่านเพิ่มเติม ▼'}</span>
                    </button>
                    ${
                      state.detailSelection.storyExpanded
                        ? `<div class="mt-2 rounded-2xl bg-white border border-taupeLight/80 p-4 text-xs sm:text-sm text-ink/80 leading-relaxed">${escapeHtml(design.story)}</div>`
                        : ''
                    }
                  </div>
                `
                : ''
            }
          </div>

          <!-- Configuration Card: Color -> Size -> Live Price -> Qty -> Add to Cart -->
          <div class="bg-white rounded-3xl border border-taupeLight p-5 shadow-art space-y-5">
            <!-- Color Selection -->
            <div class="space-y-2">
              <div class="flex items-center justify-between text-sm">
                <span class="font-semibold text-ink">เลือกสี</span>
                <span class="text-xs text-taupe">${escapeHtml(colorBucket.label)}</span>
              </div>
              <div class="flex flex-wrap gap-2.5">
                ${colorPillsHtml}
              </div>
            </div>

            <!-- Size Selection + Size Chart Trigger -->
            <div class="space-y-3">
              <div class="flex items-center justify-between gap-2">
                <span class="text-sm font-semibold text-ink">เลือกขนาด</span>
                <button
                  type="button"
                  data-action="open-size-chart"
                  class="inline-flex items-center gap-1.5 text-xs font-medium text-ink underline underline-offset-4 decoration-taupe hover:decoration-ink"
                >
                  <svg class="w-3.5 h-3.5 text-taupe" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3 7h18M3 12h18M3 17h18" />
                  </svg>
                  <span>ดูตารางขนาด</span>
                </button>
              </div>

              ${
                kidSkus.length > 0
                  ? `
                    <div class="space-y-1.5">
                      <div class="text-xs text-taupe font-medium">ไซซ์เด็ก</div>
                      <div class="grid grid-cols-4 gap-2">${renderSizeButtons(kidSkus)}</div>
                    </div>
                  `
                  : ''
              }

              ${
                adultSkus.length > 0
                  ? `
                    <div class="space-y-1.5">
                      <div class="text-xs text-taupe font-medium">ไซซ์ผู้ใหญ่</div>
                      <div class="grid grid-cols-3 sm:grid-cols-6 gap-2">${renderSizeButtons(adultSkus)}</div>
                    </div>
                  `
                  : ''
              }
            </div>

            <!-- Live Price Display for Selected Color + Size -->
            <div class="rounded-2xl bg-ivory border border-taupeLight px-4 py-3.5 flex items-center justify-between gap-3">
              <div>
                <div class="text-xs text-taupe">
                  ${escapeHtml(colorBucket.label)} · ${escapeHtml(selectedSku ? selectedSku.sizeDisplay : '')}
                </div>
                <div class="text-xl sm:text-2xl font-semibold text-ink mt-0.5">${escapeHtml(livePriceText)}</div>
              </div>

              <!-- Quantity Stepper -->
              <div class="inline-flex items-center rounded-xl border border-taupeLight bg-white overflow-hidden shrink-0">
                <button
                  type="button"
                  data-action="detail-qty-dec"
                  aria-label="ลดจำนวน"
                  class="w-10 h-10 flex items-center justify-center text-ink font-semibold hover:bg-ivory active:bg-taupeSoft"
                >−</button>
                <span class="w-10 text-center text-sm font-semibold text-ink">${state.detailSelection.qty}</span>
                <button
                  type="button"
                  data-action="detail-qty-inc"
                  aria-label="เพิ่มจำนวน"
                  class="w-10 h-10 flex items-center justify-center text-ink font-semibold hover:bg-ivory active:bg-taupeSoft"
                >+</button>
              </div>
            </div>

            <!-- Primary Deep Ink CTA -->
            <button
              type="button"
              data-action="detail-add-to-cart"
              ${soldOutSelected || !selectedSku ? 'disabled' : ''}
              class="w-full py-3.5 px-5 rounded-xl bg-ink text-ivory text-sm sm:text-base font-medium hover:opacity-90 active:scale-[0.99] transition disabled:opacity-45 disabled:cursor-not-allowed"
            >
              ${soldOutSelected ? 'ขนาดนี้สินค้าหมดชั่วคราว' : 'เพิ่มลงตะกร้า'}
            </button>
          </div>

          <!-- Concise Purchase Info Block (Verified Facts Only) -->
          <div class="rounded-2xl bg-white border border-taupeLight p-4 sm:p-5 space-y-2.5 text-xs sm:text-sm text-ink/80">
            <h3 class="text-sm font-semibold text-ink">ข้อมูลการสั่งจองและการรับสินค้า</h3>
            <ul class="space-y-1.5 list-disc pl-4 marker:text-taupe">
              <li>สถานะการจำหน่าย: ${escapeHtml(design.hasPreOrder ? 'เปิดรับจองล่วงหน้า (Pre-order)' : 'พร้อมส่ง')}</li>
              <li>${escapeHtml(shippingLine)}</li>
              <li>กรณีต้องการเปลี่ยนขนาด สามารถติดต่อทีมงานได้ก่อนปิดรอบการผลิต</li>
            </ul>
          </div>
        </div>
      </div>
    `;
  }

  // ==================== CHECKOUT STEP 1: CART PAGE ====================
  function renderCartPage() {
    const body = $('cart-page-body');
    const summary = $('cart-page-summary');
    const items = getCartItems();

    if (items.length === 0) {
      summary.classList.add('hidden');
      body.innerHTML = `
        <div class="p-8 sm:p-10 text-center space-y-4">
          <div class="w-12 h-12 mx-auto rounded-full bg-blush text-ink flex items-center justify-center">
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </div>
          <div class="space-y-1">
            <p class="text-base font-semibold text-ink">ยังไม่มีสินค้าในตะกร้า</p>
            <p class="text-xs text-taupe">เลือกชมคอลเลกชันและเพิ่มสินค้าที่ต้องการลงตะกร้าก่อนดำเนินการต่อ</p>
          </div>
          <button
            type="button"
            data-action="go-catalog"
            class="px-5 py-2.5 rounded-xl bg-ink text-ivory text-sm font-medium hover:opacity-90 transition"
          >
            สำรวจคอลเลกชัน KMA STUDIO
          </button>
        </div>
      `;
      return;
    }

    summary.classList.remove('hidden');
    $('cart-page-subtotal').textContent = `${formatMoney(getCartSubtotal())} บาท`;

    body.innerHTML = `
      <div class="divide-y divide-taupeLight">
        ${items
          .map(
            ({ sku, qty, thumb, lineTotal }) => `
              <div class="p-4 sm:p-5 flex items-start gap-3.5">
                <div class="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-ivory border border-taupeLight p-1 shrink-0 flex items-center justify-center overflow-hidden">
                  ${
                    thumb
                      ? `<img src="${escapeHtml(thumb)}" alt="${escapeHtml(sku.thaiDesignName)}" class="w-full h-full object-contain" />`
                      : `<span class="text-[10px] text-taupe font-serif">KMA</span>`
                  }
                </div>

                <div class="min-w-0 flex-1 space-y-1">
                  <div class="flex items-start justify-between gap-2">
                    <h3 class="text-sm sm:text-base font-semibold text-ink leading-snug">${escapeHtml(sku.thaiDesignName)}</h3>
                    <button
                      type="button"
                      data-action="cart-remove"
                      data-sku="${escapeHtml(sku.SKU_ID)}"
                      aria-label="ลบรายการ"
                      class="text-xs text-taupe hover:text-rose-700 shrink-0 px-1"
                    >
                      ลบ
                    </button>
                  </div>
                  <div class="text-xs text-taupe">
                    ${escapeHtml(sku.colorLabel)} · ${escapeHtml(sku.sizeDisplay)} · ${formatMoney(sku.Unit_Price)} บาท/ชิ้น
                  </div>

                  <div class="pt-2 flex items-center justify-between gap-3">
                    <div class="inline-flex items-center rounded-lg border border-taupeLight bg-ivory overflow-hidden">
                      <button
                        type="button"
                        data-action="cart-dec"
                        data-sku="${escapeHtml(sku.SKU_ID)}"
                        class="w-8 h-8 flex items-center justify-center text-ink font-semibold hover:bg-taupeSoft"
                      >−</button>
                      <span class="w-8 text-center text-xs font-semibold text-ink">${qty}</span>
                      <button
                        type="button"
                        data-action="cart-inc"
                        data-sku="${escapeHtml(sku.SKU_ID)}"
                        class="w-8 h-8 flex items-center justify-center text-ink font-semibold hover:bg-taupeSoft"
                      >+</button>
                    </div>

                    <div class="text-sm sm:text-base font-semibold text-ink">
                      ${formatMoney(lineTotal)} บาท
                    </div>
                  </div>
                </div>
              </div>
            `
          )
          .join('')}
      </div>
    `;
  }

  // ==================== CHECKOUT STEP 2: CUSTOMER & REAL-TIME VALIDATION ====================
  function renderCustomerSummary() {
    const items = getCartItems();
    const subtotal = getCartSubtotal();
    const deliveryFee = Number(state.settings.Delivery_Fee || 0);
    const freeMin = Number(state.settings.Free_Shipping_Min || 0);
    const shipping = getShippingFee(subtotal, state.customer.fulfillmentType);
    const grandTotal = subtotal + shipping;

    $('customer-summary-items').innerHTML = items
      .map(
        ({ sku, qty, lineTotal }) => `
          <div class="py-2.5 flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="font-medium text-ink">${escapeHtml(sku.thaiDesignName)}</div>
              <div class="text-xs text-taupe">
                ${escapeHtml(sku.colorLabel)} · ${escapeHtml(sku.sizeDisplay)} · ${qty} × ${formatMoney(sku.Unit_Price)} บาท
              </div>
            </div>
            <div class="font-semibold text-ink shrink-0">${formatMoney(lineTotal)} บาท</div>
          </div>
        `
      )
      .join('');

    // Dynamic Delivery Pill & Hint from 00_Settings
    if (freeMin > 0 && subtotal >= freeMin) {
      $('delivery-fee-pill').textContent = 'ส่งฟรี';
      $('delivery-fee-pill').className =
        'text-xs font-medium text-ink bg-blush border border-taupeLight px-2 py-0.5 rounded-full';
      $('delivery-fee-hint').textContent = `ยอดสินค้าครบ ${formatMoney(freeMin)} บาท ได้รับสิทธิ์จัดส่งฟรี`;
    } else {
      $('delivery-fee-pill').textContent = deliveryFee > 0 ? `${formatMoney(deliveryFee)} บาท` : '0 บาท';
      $('delivery-fee-pill').className =
        'text-xs font-medium text-ink bg-taupeSoft border border-taupeLight px-2 py-0.5 rounded-full';
      $('delivery-fee-hint').textContent =
        freeMin > 0
          ? `สั่งเพิ่มอีก ${formatMoney(Math.max(0, freeMin - subtotal))} บาท เพื่อรับสิทธิ์ส่งฟรี`
          : 'จัดส่งพัสดุตามที่อยู่ที่ระบุ';
    }

    const isDelivery = state.customer.fulfillmentType === 'DELIVERY';
    $('fulfill-card-pickup').className = isDelivery
      ? 'cursor-pointer rounded-xl border border-taupeLight bg-white p-4 flex items-start gap-3 transition'
      : 'cursor-pointer rounded-xl border-2 border-ink bg-blush/35 p-4 flex items-start gap-3 transition';

    $('fulfill-card-delivery').className = isDelivery
      ? 'cursor-pointer rounded-xl border-2 border-ink bg-blush/35 p-4 flex items-start gap-3 transition'
      : 'cursor-pointer rounded-xl border border-taupeLight bg-white p-4 flex items-start gap-3 transition';

    if (isDelivery) {
      $('shipping-address-wrapper').classList.remove('hidden');
    } else {
      $('shipping-address-wrapper').classList.add('hidden');
      setFieldError('shipping-address', '');
    }

    $('customer-summary-subtotal').textContent = `${formatMoney(subtotal)} บาท`;
    $('customer-summary-fulfill').textContent = getFulfillmentLabel(state.customer.fulfillmentType);
    $('customer-summary-shipping').textContent = shipping === 0 ? '0 บาท' : `${formatMoney(shipping)} บาท`;
    $('customer-summary-grand').textContent = `${formatMoney(grandTotal)} บาท`;
  }

  function renderDynamicTerms() {
    const box = $('dynamic-terms-box');
    const items = getCartItems();
    const uniqueTexts = [];
    const seen = new Set();

    const addTerm = (rawText) => {
      const normalized = String(rawText || '').trim().replace(/\s+/g, ' ');
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      uniqueTexts.push(normalized);
    };

    addTerm(state.settings.Default_Terms);
    items.forEach(({ sku }) => addTerm(sku.Product_Terms));

    if (uniqueTexts.length === 0) {
      box.innerHTML = '<p>กรุณาตรวจสอบรายละเอียดสินค้า สี และขนาดให้ถูกต้องก่อนยืนยันคำสั่งซื้อ</p>';
      return;
    }

    box.innerHTML = uniqueTexts
      .map(
        (text, idx) => `
          <p class="${idx > 0 ? 'pt-2 border-t border-taupeLight/70' : ''}">
            ${uniqueTexts.length > 1 ? `<span class="font-semibold text-ink">${idx + 1}.</span> ` : ''}${escapeHtml(text)}
          </p>
        `
      )
      .join('');
  }

  function setFieldError(fieldKey, msg) {
    const errEl = $('err-' + fieldKey);
    const inputEl = $('input-' + fieldKey);
    if (errEl) {
      if (msg) {
        errEl.textContent = msg;
        errEl.classList.remove('hidden');
      } else {
        errEl.textContent = '';
        errEl.classList.add('hidden');
      }
    }
    if (inputEl) {
      if (msg) {
        inputEl.classList.add('border-rose-500');
        inputEl.classList.remove('border-taupeLight');
      } else {
        inputEl.classList.remove('border-rose-500');
        inputEl.classList.add('border-taupeLight');
      }
    }
  }

  function validateCustomerField(fieldName, forceShow) {
    if (fieldName === 'name') {
      const val = $('input-customer-name').value.trim();
      state.customer.name = val;
      const err = !val ? 'กรุณากรอกชื่อ–นามสกุลผู้สั่งซื้อ' : '';
      if (forceShow || state.touched.name) setFieldError('customer-name', err);
      return !err;
    }

    if (fieldName === 'phone') {
      const val = $('input-phone').value.trim();
      state.customer.phone = val;
      const digits = val.replace(/\D/g, '');
      const err =
        !val
          ? 'กรุณากรอกเบอร์โทรศัพท์'
          : digits.length < 9 || digits.length > 12
          ? 'กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง (9–10 หลัก)'
          : '';
      if (forceShow || state.touched.phone) setFieldError('phone', err);
      return !err;
    }

    if (fieldName === 'email') {
      const val = $('input-email').value.trim();
      state.customer.email = val;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const err = !val
        ? 'กรุณากรอกอีเมลสำหรับรับเอกสาร'
        : !emailRegex.test(val)
        ? 'รูปแบบอีเมลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง'
        : '';
      if (forceShow || state.touched.email) setFieldError('email', err);
      return !err;
    }

    if (fieldName === 'shippingAddress') {
      const val = $('input-shipping-address').value.trim();
      state.customer.shippingAddress = val;
      if (state.customer.fulfillmentType !== 'DELIVERY') {
        setFieldError('shipping-address', '');
        return true;
      }
      const err =
        val.length < 8 ? 'กรุณากรอกที่อยู่จัดส่งให้ครบถ้วน (บ้านเลขที่ แขวง/ตำบล จังหวัด รหัสไปรษณีย์)' : '';
      if (forceShow || state.touched.shippingAddress) setFieldError('shipping-address', err);
      return !err;
    }

    if (fieldName === 'acceptedTerms') {
      const checked = $('checkbox-accept-terms').checked;
      state.customer.acceptedTerms = checked;
      const err = !checked ? 'กรุณาติ๊กยอมรับเงื่อนไขการสั่งซื้อก่อนดำเนินการต่อ' : '';
      if (forceShow || state.touched.acceptedTerms) setFieldError('accept-terms', err);
      return !err;
    }

    return true;
  }

  function validateCustomerStepAll() {
    if (getCartItemCount() === 0) {
      showToast('ยังไม่มีสินค้าในตะกร้า', 'error');
      navigateTo('cart');
      return false;
    }

    // Sync optional fields without required validation
    state.customer.lineId = $('input-line-id').value.trim();
    state.customer.campGroupNote = $('input-camp-note').value.trim();

    state.touched.name = true;
    state.touched.phone = true;
    state.touched.email = true;
    state.touched.shippingAddress = true;
    state.touched.acceptedTerms = true;

    const checks = [
      { ok: validateCustomerField('shippingAddress', true), focusId: 'input-shipping-address' },
      { ok: validateCustomerField('name', true), focusId: 'input-customer-name' },
      { ok: validateCustomerField('phone', true), focusId: 'input-phone' },
      { ok: validateCustomerField('email', true), focusId: 'input-email' },
      { ok: validateCustomerField('acceptedTerms', true), focusId: 'checkbox-accept-terms' }
    ];

    const firstFail = checks.find((c) => !c.ok);
    if (firstFail) {
      const el = $(firstFail.focusId);
      if (el) el.focus();
      showToast('กรุณาตรวจสอบข้อมูลที่จำเป็นให้ครบถ้วน', 'error');
      return false;
    }
    return true;
  }

  // ==================== CHECKOUT STEP 3: PAYMENT & SLIP ====================
  function renderPaymentView() {
    const subtotal = getCartSubtotal();
    const shipping = getShippingFee(subtotal, state.customer.fulfillmentType);
    const grandTotal = subtotal + shipping;

    $('payment-grand-total').textContent = `${formatMoney(grandTotal)} บาท`;
    $('payment-breakdown').textContent = `ยอดสินค้า ${formatMoney(subtotal)} บาท + ค่าจัดส่ง ${
      shipping === 0 ? '0 บาท' : formatMoney(shipping) + ' บาท'
    } (${getFulfillmentLabel(state.customer.fulfillmentType)})`;

    const qrImg = $('payment-qr-img');
    qrImg.src = state.settings.QR_Image_URL || CONFIG.FALLBACK_QR_IMAGE || 'images/sys-qr-pay.png';
    qrImg.onerror = function () {
      if (this.src.indexOf('images/sys-qr-pay.png') === -1) {
        this.src = 'images/sys-qr-pay.png';
      }
    };

    $('payment-bank-info').textContent =
      state.settings.Bank_Account_Info || 'กรุณาติดต่อ KMA STUDIO เพื่อสอบถามข้อมูลบัญชีรับโอน';

    $('submit-error-box').classList.add('hidden');
  }

  function extractAccountNumber(bankInfo) {
    const match = String(bankInfo || '').match(/\d[\d-]{7,}\d/);
    return match ? match[0].replace(/-/g, '') : String(bankInfo || '').trim();
  }

  function copyWithButtonFeedback(text, buttonLabelId, defaultLabel, toastMsg) {
    if (!text) return;

    const onSuccess = () => {
      const labelEl = buttonLabelId ? $(buttonLabelId) : null;
      if (labelEl) {
        labelEl.textContent = 'คัดลอกแล้ว';
        setTimeout(() => {
          labelEl.textContent = defaultLabel;
        }, 2000);
      }
      if (toastMsg) showToast(toastMsg, 'success');
    };

    const fallbackCopy = () => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      let ok = false;
      try {
        ok = document.execCommand('copy');
      } catch (e) {
        ok = false;
      }
      document.body.removeChild(ta);
      if (ok) onSuccess();
      else showToast('ไม่สามารถคัดลอกอัตโนมัติได้ กรุณากดคัดลอกด้วยตนเอง', 'error');
    };

    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(text).then(onSuccess, fallbackCopy);
    } else {
      fallbackCopy();
    }
  }

  function compressSlipImage(file) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith('image/')) {
        reject(new Error('กรุณาเลือกไฟล์รูปภาพเท่านั้น (JPG / PNG)'));
        return;
      }

      const reader = new FileReader();
      reader.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์รูปภาพได้ กรุณาลองใหม่'));
      reader.onload = (ev) => {
        const img = new Image();
        img.onerror = () =>
          reject(new Error('รูปแบบภาพไม่รองรับ กรุณาแคปหน้าจอสลิปเป็น JPG/PNG แล้วลองใหม่อีกครั้ง'));
        img.onload = () => {
          try {
            const MAX_WIDTH = 1200;
            let targetW = img.naturalWidth || img.width;
            let targetH = img.naturalHeight || img.height;

            if (targetW > MAX_WIDTH) {
              const ratio = MAX_WIDTH / targetW;
              targetW = MAX_WIDTH;
              targetH = Math.round(targetH * ratio);
            }

            const canvas = document.createElement('canvas');
            canvas.width = targetW;
            canvas.height = targetH;

            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, targetW, targetH);
            ctx.drawImage(img, 0, 0, targetW, targetH);

            const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
            const base64 = dataUrl.split(',')[1] || '';
            const compressedBytes = Math.round((base64.length * 3) / 4);

            resolve({
              dataUrl,
              base64,
              mimeType: 'image/jpeg',
              originalKB: Math.max(1, Math.round(file.size / 1024)),
              compressedKB: Math.max(1, Math.round(compressedBytes / 1024))
            });
          } catch (err) {
            reject(new Error('เกิดข้อผิดพลาดขณะย่อขนาดรูปภาพ กรุณาลองเลือกภาพใหม่อีกครั้ง'));
          }
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function handleSlipFileChange(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    setFieldError('slip-file', '');
    try {
      const result = await compressSlipImage(file);
      state.payment.slipBase64 = result.base64;
      state.payment.slipMimeType = result.mimeType;
      state.payment.slipFileName = file.name || 'slip.jpg';
      state.payment.slipPreviewUrl = result.dataUrl;
      state.payment.originalKB = result.originalKB;
      state.payment.compressedKB = result.compressedKB;

      $('slip-preview-img').src = result.dataUrl;
      $('slip-size-info').textContent = `พร้อมส่ง (${result.compressedKB} KB)`;
      $('slip-empty-state').classList.add('hidden');
      $('slip-preview-state').classList.remove('hidden');
      showToast('แนบหลักฐานการโอนเงินเรียบร้อยแล้ว', 'success');
    } catch (err) {
      setFieldError('slip-file', err.message || 'ไม่สามารถประมวลผลรูปภาพได้');
    }
  }

  function setSubmitting(isSubmitting) {
    state.submitting = isSubmitting;
    $('btn-submit-order').disabled = isSubmitting;
    $('btn-payment-back').disabled = isSubmitting;
    if (isSubmitting) {
      $('btn-submit-spinner').classList.remove('hidden');
      $('btn-submit-label').textContent = 'กำลังส่งคำสั่งซื้อและหลักฐานการชำระเงิน...';
    } else {
      $('btn-submit-spinner').classList.add('hidden');
      $('btn-submit-label').textContent = 'ส่งคำสั่งซื้อและหลักฐานการชำระเงิน';
    }
  }

  async function submitOrder() {
    if (state.submitting) return;

    $('submit-error-box').classList.add('hidden');
    state.payment.transferDate = $('input-transfer-date').value;
    state.payment.transferTime = $('input-transfer-time').value;

    let valid = true;
    if (!state.payment.transferDate || !state.payment.transferTime) {
      setFieldError('transfer-datetime', 'กรุณาระบุวันที่และเวลาที่โอนเงินตามสลิป');
      valid = false;
    } else {
      setFieldError('transfer-datetime', '');
    }

    if (!state.payment.slipBase64) {
      setFieldError('slip-file', 'กรุณาแนบหลักฐานการโอนเงินก่อนส่งคำสั่งซื้อ');
      valid = false;
    } else {
      setFieldError('slip-file', '');
    }

    if (!valid) {
      showToast('กรุณาตรวจสอบข้อมูลการโอนเงินและสลิปให้ครบถ้วน', 'error');
      return;
    }

    const itemsSnapshot = getCartItems();
    const payload = {
      action: 'CREATE_ORDER',
      customer_name: state.customer.name,
      phone: state.customer.phone,
      email: state.customer.email,
      line_id: state.customer.lineId || '',
      camp_group_note: state.customer.campGroupNote || '',
      fulfillment_type: state.customer.fulfillmentType,
      shipping_address:
        state.customer.fulfillmentType === 'DELIVERY' ? state.customer.shippingAddress : '',
      accepted_terms: true,
      items: itemsSnapshot.map(({ sku, qty }) => ({ sku_id: sku.SKU_ID, qty })),
      transfer_date: state.payment.transferDate,
      transfer_time: state.payment.transferTime,
      slip_base64: state.payment.slipBase64,
      slip_mime_type: state.payment.slipMimeType
    };

    // Duplicate Submission Guard: lock immediately
    setSubmitting(true);

    try {
      if (CONFIG.MOCK_MODE) {
        await new Promise((r) => setTimeout(r, 850));
        const now = new Date();
        const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
        const rand = String(Math.floor(1000 + Math.random() * 9000));
        state.orderResult = {
          order_id: `KMA-ST-${ym}-${rand}`,
          txn_id: `TXN-${ym}-${rand}`,
          status: 'UNVERIFIED',
          grand_total: getGrandTotal(),
          subtotal: getCartSubtotal(),
          shipping_fee: getShippingFee(getCartSubtotal(), state.customer.fulfillmentType),
          order_pdf_url: '',
          email_status: 'QUEUED_QUOTA',
          items_snapshot: itemsSnapshot
        };
        navigateTo('confirmation');
        return;
      }

      const response = await fetch(CONFIG.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`การเชื่อมต่อขัดข้อง (HTTP ${response.status})`);
      }

      const data = await response.json();
      if (!data || !data.ok) {
        throw new Error((data && data.error) || 'ระบบไม่สามารถบันทึกคำสั่งซื้อได้ กรุณาลองใหม่อีกครั้ง');
      }

      state.orderResult = {
        order_id: data.order_id,
        txn_id: data.txn_id || '',
        status: data.status || 'UNVERIFIED',
        grand_total: Number(data.grand_total != null ? data.grand_total : getGrandTotal()),
        subtotal: Number(data.subtotal != null ? data.subtotal : getCartSubtotal()),
        shipping_fee: Number(
          data.shipping_fee != null
            ? data.shipping_fee
            : getShippingFee(getCartSubtotal(), state.customer.fulfillmentType)
        ),
        order_pdf_url: data.order_pdf_url || '',
        email_status: String(data.email_status || '').trim().toUpperCase(),
        items_snapshot: itemsSnapshot
      };

      navigateTo('confirmation');
    } catch (err) {
      $('submit-error-text').textContent = err.message || 'เกิดข้อผิดพลาดในการส่งข้อมูล กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่';
      $('submit-error-box').classList.remove('hidden');
      $('submit-error-box').scrollIntoView({ behavior: 'smooth', block: 'center' });
    } finally {
      setSubmitting(false);
    }
  }

  // ==================== CHECKOUT STEP 4: CONFIRMATION ====================
  function renderConfirmationView() {
    const res = state.orderResult;
    if (!res) return;

    $('confirm-order-id').textContent = res.order_id || '-';

    // Strictly bind email status message to real backend response
    const emailStatusEl = $('confirm-email-status-text');
    if (res.email_status === 'SENT') {
      emailStatusEl.innerHTML =
        `ส่งเอกสารยืนยันคำสั่งซื้อไปยัง <span class="font-semibold text-ink">${escapeHtml(state.customer.email)}</span> ` +
        `จาก <span class="font-semibold text-ink">${escapeHtml(CONFIG.STUDIO_EMAIL || 'kmastudio.th@gmail.com')}</span> แล้ว ` +
        `(หากไม่พบ กรุณาตรวจสอบในโฟลเดอร์จดหมายขยะ / Spam)`;
    } else {
      // Never claim delivered if QUEUED_QUOTA, PENDING, FAILED, or unknown
      emailStatusEl.textContent = 'ระบบบันทึกคำสั่งซื้อแล้ว และกำลังจัดส่งเอกสารยืนยันทางอีเมล';
    }

    const itemsRows = (res.items_snapshot || [])
      .map(
        ({ sku, qty, lineTotal }) => `
          <div class="flex justify-between gap-2">
            <span>${escapeHtml(sku.thaiDesignName)} (${escapeHtml(sku.colorLabel)} · ${escapeHtml(sku.sizeDisplay)}) × ${qty}</span>
            <span class="font-medium shrink-0">${formatMoney(lineTotal)} บาท</span>
          </div>
        `
      )
      .join('');

    $('confirm-details').innerHTML = `
      <div class="flex justify-between gap-2">
        <span class="text-taupe">ผู้สั่งซื้อ</span>
        <span class="font-medium text-ink">${escapeHtml(state.customer.name)}</span>
      </div>
      <div class="flex justify-between gap-2">
        <span class="text-taupe">รูปแบบการรับสินค้า</span>
        <span class="font-medium text-ink">${escapeHtml(getFulfillmentLabel(state.customer.fulfillmentType))}</span>
      </div>
      <div class="flex justify-between gap-2">
        <span class="text-taupe">วัน–เวลาโอนเงิน</span>
        <span class="font-medium text-ink">${escapeHtml(formatISOToDDMMYYYY(state.payment.transferDate))} ${escapeHtml(state.payment.transferTime)} น.</span>
      </div>
      <div class="pt-2.5 border-t border-taupeLight space-y-1.5">${itemsRows}</div>
      <div class="pt-2.5 border-t border-taupeLight flex justify-between text-sm font-semibold text-ink">
        <span>ยอดสุทธิ</span>
        <span>${formatMoney(res.grand_total)} บาท</span>
      </div>
    `;

    if (res.order_pdf_url) {
      $('confirm-pdf-link').href = res.order_pdf_url;
      $('confirm-pdf-wrapper').classList.remove('hidden');
    } else {
      $('confirm-pdf-wrapper').classList.add('hidden');
    }
  }

  function resetAfterOrder() {
    state.cart = {};
    state.customer.acceptedTerms = false;
    state.touched = {
      name: false,
      phone: false,
      email: false,
      shippingAddress: false,
      acceptedTerms: false
    };
    state.payment.slipBase64 = '';
    state.payment.slipPreviewUrl = '';
    state.payment.transferDate = getTodayLocalISO();
    state.payment.transferTime = getNowLocalTimeHHMM();
    state.orderResult = null;

    $('checkbox-accept-terms').checked = false;
    $('input-slip-file').value = '';
    $('slip-preview-img').src = '';
    $('slip-empty-state').classList.remove('hidden');
    $('slip-preview-state').classList.add('hidden');
    $('input-transfer-date').value = state.payment.transferDate;
    $('input-transfer-time').value = state.payment.transferTime;

    navigateTo('catalog');
  }

  // ==================== MODALS: SIZE CHART & ARTWORK LIGHTBOX ====================
  function renderSizeChartModal() {
    const body = $('size-chart-body');
    const imgSrc = String(CONFIG.SIZE_CHART_IMAGE || 'images/chart-shirt.jpg').trim();
    body.innerHTML = `
      <div class="rounded-2xl bg-white border border-taupeLight p-2 sm:p-3">
        <img
          src="${escapeHtml(imgSrc)}"
          alt="ตารางขนาดเสื้อ KMA STUDIO"
          class="w-full h-auto block rounded-xl object-contain"
        />
      </div>
    `;
  }

  function openSizeChartModal() {
    $('modal-size-chart').classList.remove('hidden');
  }

  function closeSizeChartModal() {
    // Strictly closes modal without mutating detailSelection (Color, Size, Qty preserved)
    $('modal-size-chart').classList.add('hidden');
  }

  function openLightbox() {
    const ctx = getActiveDetailContext();
    if (!ctx || !ctx.colorBucket.images.length) return;

    state.lightbox.open = true;
    state.lightbox.zoomed = false;
    state.lightbox.images = ctx.colorBucket.images;
    state.lightbox.index = state.detailSelection.imageIndex || 0;
    state.lightbox.title = `${ctx.design.thaiName} (${ctx.colorBucket.label})`;

    renderLightbox();
    $('modal-lightbox').classList.remove('hidden');
  }

  function renderLightbox() {
    const lb = state.lightbox;
    const imgEl = $('lightbox-img');
    const url = lb.images[lb.index] || '';

    $('lightbox-caption').textContent = lb.title;
    $('lightbox-counter').textContent = `${lb.index + 1} / ${lb.images.length}`;
    $('btn-lightbox-zoom-toggle').textContent = lb.zoomed ? 'พอดีหน้าจอ' : 'ขยายภาพ';

    imgEl.src = url;
    imgEl.alt = lb.title;

    if (lb.zoomed) {
      imgEl.className = 'w-[175vw] sm:w-[1100px] max-w-none h-auto rounded-xl bg-white object-contain shadow-2xl';
    } else {
      imgEl.className = 'max-w-full max-h-full rounded-xl bg-white object-contain transition-all duration-200 shadow-2xl';
    }

    if (lb.images.length <= 1) {
      $('lightbox-nav-bar').classList.add('hidden');
    } else {
      $('lightbox-nav-bar').classList.remove('hidden');
    }
  }

  function stepLightbox(delta) {
    const lb = state.lightbox;
    if (!lb.images.length) return;
    lb.index = (lb.index + delta + lb.images.length) % lb.images.length;
    lb.zoomed = false;
    state.detailSelection.imageIndex = lb.index;
    renderLightbox();
    if (state.view === 'detail') renderProductDetailView();
  }

  function closeLightbox() {
    state.lightbox.open = false;
    state.lightbox.zoomed = false;
    $('modal-lightbox').classList.add('hidden');
  }

  // ==================== EVENT BINDINGS ====================
  function bindEvents() {
    // Global delegated clicks
    document.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;

      const action = target.getAttribute('data-action');

      if (action === 'open-design') {
        const key = target.getAttribute('data-design');
        if (key) openDesignDetail(key);
      } else if (action === 'go-catalog') {
        navigateTo('catalog');
      } else if (action === 'detail-color') {
        const newColor = target.getAttribute('data-color');
        if (newColor && newColor !== state.detailSelection.colorCode) {
          state.detailSelection.colorCode = newColor;
          state.detailSelection.imageIndex = 0; // Reset to hero image index 0 on color swap
          state.detailSelection.qty = 1;
          renderProductDetailView();
        }
      } else if (action === 'detail-size') {
        const sizeKey = target.getAttribute('data-size-key');
        if (sizeKey) {
          state.detailSelection.sizeKey = sizeKey;
          state.detailSelection.qty = 1;
          renderProductDetailView();
        }
      } else if (action === 'detail-thumb') {
        const idx = Number(target.getAttribute('data-index') || 0);
        state.detailSelection.imageIndex = idx;
        renderProductDetailView();
      } else if (action === 'detail-prev-img') {
        const ctx = getActiveDetailContext();
        if (ctx && ctx.colorBucket.images.length > 1) {
          const len = ctx.colorBucket.images.length;
          state.detailSelection.imageIndex = (state.detailSelection.imageIndex - 1 + len) % len;
          renderProductDetailView();
        }
      } else if (action === 'detail-next-img') {
        const ctx = getActiveDetailContext();
        if (ctx && ctx.colorBucket.images.length > 1) {
          const len = ctx.colorBucket.images.length;
          state.detailSelection.imageIndex = (state.detailSelection.imageIndex + 1) % len;
          renderProductDetailView();
        }
      } else if (action === 'detail-qty-inc') {
        const ctx = getActiveDetailContext();
        const maxQ = ctx && ctx.selectedSku ? getMaxQtyForSku(ctx.selectedSku) : 99;
        if (state.detailSelection.qty < maxQ) {
          state.detailSelection.qty += 1;
          renderProductDetailView();
        } else {
          showToast(`สามารถสั่งซื้อได้สูงสุด ${maxQ} ชิ้น`, 'error');
        }
      } else if (action === 'detail-qty-dec') {
        if (state.detailSelection.qty > 1) {
          state.detailSelection.qty -= 1;
          renderProductDetailView();
        }
      } else if (action === 'detail-add-to-cart') {
        const ctx = getActiveDetailContext();
        if (ctx && ctx.selectedSku) {
          const added = addToCart(ctx.selectedSku.SKU_ID, state.detailSelection.qty);
          if (added) {
            showToast(
              `เพิ่ม ${ctx.design.thaiName} (${ctx.colorBucket.label} · ${ctx.selectedSku.sizeDisplay}) × ${state.detailSelection.qty} ลงตะกร้าแล้ว`,
              'success'
            );
            state.detailSelection.qty = 1;
            renderProductDetailView();
          }
        }
      } else if (action === 'toggle-story') {
        state.detailSelection.storyExpanded = !state.detailSelection.storyExpanded;
        renderProductDetailView();
      } else if (action === 'open-size-chart') {
        openSizeChartModal();
      } else if (action === 'open-lightbox') {
        openLightbox();
      } else if (action === 'cart-inc') {
        setCartQty(target.getAttribute('data-sku'), 1);
      } else if (action === 'cart-dec') {
        setCartQty(target.getAttribute('data-sku'), -1);
      } else if (action === 'cart-remove') {
        removeCartItem(target.getAttribute('data-sku'));
      }
    });

    // Touch swipe on Product Detail gallery
    let swipeStartX = 0;
    let swipeStartY = 0;
    let swipeActive = false;

    document.addEventListener(
      'touchstart',
      (e) => {
        const vp = e.target.closest('#detail-gallery-viewport');
        if (!vp || Number(vp.getAttribute('data-gallery-count') || 0) <= 1) {
          swipeActive = false;
          return;
        }
        const t = e.changedTouches && e.changedTouches[0];
        if (!t) return;
        swipeStartX = t.clientX;
        swipeStartY = t.clientY;
        swipeActive = true;
      },
      { passive: true }
    );

    document.addEventListener(
      'touchend',
      (e) => {
        if (!swipeActive) return;
        swipeActive = false;
        const t = e.changedTouches && e.changedTouches[0];
        if (!t) return;
        const dx = t.clientX - swipeStartX;
        const dy = t.clientY - swipeStartY;
        if (Math.abs(dx) > 36 && Math.abs(dx) > Math.abs(dy)) {
          const ctx = getActiveDetailContext();
          if (ctx && ctx.colorBucket.images.length > 1) {
            const len = ctx.colorBucket.images.length;
            state.detailSelection.imageIndex =
              (state.detailSelection.imageIndex + (dx < 0 ? 1 : -1) + len) % len;
            renderProductDetailView();
          }
        }
      },
      { passive: true }
    );

    // Header & View Navigation
    $('btn-brand-home').addEventListener('click', () => {
      if (state.designs.length > 0) navigateTo('catalog');
    });
    $('btn-header-cart').addEventListener('click', () => {
      if (state.designs.length > 0) navigateTo('cart');
    });
    $('btn-sticky-view-cart').addEventListener('click', () => navigateTo('cart'));
    $('btn-back-to-collection').addEventListener('click', () => navigateTo('catalog'));
    $('btn-cart-continue-shopping').addEventListener('click', () => navigateTo('catalog'));
    $('btn-cart-to-customer').addEventListener('click', () => {
      if (getCartItemCount() > 0) navigateTo('customer');
    });
    $('btn-customer-edit-cart').addEventListener('click', () => navigateTo('cart'));
    $('btn-customer-back').addEventListener('click', () => navigateTo('cart'));
    $('btn-customer-next').addEventListener('click', () => {
      if (validateCustomerStepAll()) navigateTo('payment');
    });

    // Fulfillment Toggle
    document.querySelectorAll('input[name="fulfillment"]').forEach((radio) => {
      radio.addEventListener('change', (e) => {
        state.customer.fulfillmentType = e.target.value;
        renderCustomerSummary();
        if (state.touched.shippingAddress) validateCustomerField('shippingAddress', false);
      });
    });

    // Real-time Inline Validation Listeners (Step 2)
    const bindInlineValidation = (inputId, fieldName, eventName) => {
      const el = $(inputId);
      if (!el) return;
      el.addEventListener('blur', () => {
        state.touched[fieldName] = true;
        validateCustomerField(fieldName, false);
      });
      el.addEventListener(eventName || 'input', () => {
        if (state.touched[fieldName] || eventName === 'change') {
          state.touched[fieldName] = true;
          validateCustomerField(fieldName, false);
        }
      });
    };

    bindInlineValidation('input-customer-name', 'name', 'input');
    bindInlineValidation('input-phone', 'phone', 'input');
    bindInlineValidation('input-email', 'email', 'input');
    bindInlineValidation('input-shipping-address', 'shippingAddress', 'input');
    bindInlineValidation('checkbox-accept-terms', 'acceptedTerms', 'change');

    // Step 3 Payment Actions
    $('btn-copy-amount').addEventListener('click', () => {
      const amt = String(getGrandTotal());
      copyWithButtonFeedback(amt, 'btn-copy-amount-label', 'คัดลอกยอดโอน', `คัดลอกยอดโอน ${formatMoney(amt)} บาทแล้ว`);
    });

    $('btn-copy-bank').addEventListener('click', () => {
      const acc = extractAccountNumber(state.settings.Bank_Account_Info);
      copyWithButtonFeedback(acc, 'btn-copy-bank-label', 'คัดลอกเลขบัญชี', `คัดลอกเลขบัญชี ${acc} แล้ว`);
    });

    $('input-slip-file').addEventListener('change', handleSlipFileChange);
    $('btn-payment-back').addEventListener('click', () => navigateTo('customer'));
    $('btn-submit-order').addEventListener('click', submitOrder);

    // Step 4 Confirmation Actions
    $('btn-copy-order-id').addEventListener('click', () => {
      if (state.orderResult && state.orderResult.order_id) {
        copyWithButtonFeedback(
          state.orderResult.order_id,
          'btn-copy-order-id-label',
          'คัดลอกหมายเลขคำสั่งซื้อ',
          'คัดลอกหมายเลขคำสั่งซื้อแล้ว'
        );
      }
    });
    $('btn-new-order').addEventListener('click', resetAfterOrder);

    // Modals
    $('btn-close-size-chart').addEventListener('click', closeSizeChartModal);
    $('modal-size-chart').addEventListener('click', (e) => {
      if (e.target === $('modal-size-chart')) closeSizeChartModal();
    });

    $('btn-close-lightbox').addEventListener('click', closeLightbox);
    $('btn-lightbox-prev').addEventListener('click', () => stepLightbox(-1));
    $('btn-lightbox-next').addEventListener('click', () => stepLightbox(1));
    $('btn-lightbox-zoom-toggle').addEventListener('click', () => {
      state.lightbox.zoomed = !state.lightbox.zoomed;
      renderLightbox();
    });
    $('lightbox-scroll-area').addEventListener('click', (e) => {
      if (e.target === $('lightbox-scroll-area')) closeLightbox();
    });

    // Retry
    $('btn-retry-load').addEventListener('click', loadStoreData);
  }

  // ==================== BOOTSTRAP ====================
  document.addEventListener('DOMContentLoaded', () => {
    bindEvents();
    loadStoreData();
  });
})();
