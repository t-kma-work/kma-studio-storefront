/**
 * KMA STUDIO — Storefront Application Logic (Vanilla ES6, Zero-Build)
 * Silk Jade & Pearl V1.1 · Art Gallery + Heritage Transition · Handoff V1.0 (Clause 62)
 * Preserves Backend API Contract (doGet / doPost) strictly.
 */
(function () {
  'use strict';

  const CONFIG = window.KMA_CONFIG || {};
  const DESIGNS_META = CONFIG.DESIGNS || {};

  const COLOR_META = {
    BLK: { code: 'BLK', label: 'สีดำ', hex: '#1D1C1A', border: '#1D1C1A' },
    WHT: { code: 'WHT', label: 'สีขาว', hex: '#FFFFFF', border: '#82766E' }
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
    designs: [],         // Ordered array of Design Collection objects (IP-SH01, IP-SH02)
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
      fallbackImages: [],
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

    // Semantic separation: errors use dark rose; confirmations use Deep Ink on Gallery White or Silk Jade with Deep Ink
    const classes =
      type === 'error'
        ? 'bg-rose-900 text-white border-rose-700'
        : 'bg-deepInk text-galleryWhite border-deepInk';

    const el = document.createElement('div');
    el.className =
      'pointer-events-auto max-w-md w-full px-4 py-3 rounded-xl border shadow-lg text-[14px] font-medium text-center transition-all duration-300 ' +
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
  function normalizeImageUrl(rawUrl) {
    let url = String(rawUrl || '').trim().replace(/[\r\n\t]+/g, '');
    if (!url) return '';
    if (/^(https?:)?\/\//i.test(url) || /^data:/i.test(url)) {
      return url;
    }
    url = url.replace(/^\.?\//, '').replace(/\/{2,}/g, '/');
    return './' + url;
  }

  function parseImageList(imageUrlStr) {
    return String(imageUrlStr || '')
      .split(',')
      .map((s) => normalizeImageUrl(s))
      .filter(Boolean)
      .slice(0, 5);
  }

  function swapJpgExtensionCase(url) {
    if (/\.jpg(\?.*)?$/.test(url)) return url.replace(/\.jpg(\?.*)?$/, '.JPG$1');
    if (/\.JPG(\?.*)?$/.test(url)) return url.replace(/\.JPG(\?.*)?$/, '.jpg$1');
    return '';
  }

  function renderStyledImagePlaceholder(container) {
    if (!container || container.querySelector('[data-kma-placeholder="1"]')) return;
    const holder = document.createElement('div');
    holder.setAttribute('data-kma-placeholder', '1');
    holder.className =
      'w-full h-full min-h-[160px] flex flex-col items-center justify-center text-center px-5 py-10 bg-pearlGrey/70 text-readingTaupe select-none';
    holder.innerHTML =
      '<span class="font-serif text-[16px] font-semibold tracking-[0.12em] text-deepInk uppercase">KMA STUDIO</span>' +
      '<span class="text-[13px] text-readingTaupe mt-1">กำลังเตรียมภาพสินค้า</span>';
    container.appendChild(holder);
  }

  // Defensive global image error handler: retries .jpg <-> .JPG once, optional V10 fallback once, then styled placeholder
  window.kmaHandleImgError = function (imgEl) {
    if (!imgEl) return;
    const step = imgEl.getAttribute('data-img-step') || '0';
    const currentSrc = imgEl.getAttribute('src') || '';
    const fallbackSrc = imgEl.getAttribute('data-fallback-src') || '';

    if (step === '0') {
      const altCase = swapJpgExtensionCase(currentSrc);
      if (altCase && altCase !== currentSrc) {
        imgEl.setAttribute('data-img-step', '1');
        imgEl.src = altCase;
        return;
      }
      if (fallbackSrc && fallbackSrc !== currentSrc) {
        imgEl.setAttribute('data-img-step', '2');
        imgEl.src = fallbackSrc;
        return;
      }
    } else if (step === '1') {
      if (fallbackSrc && fallbackSrc !== currentSrc) {
        imgEl.setAttribute('data-img-step', '2');
        imgEl.src = fallbackSrc;
        return;
      }
    } else if (step === '2') {
      const altFallbackCase = swapJpgExtensionCase(currentSrc);
      if (altFallbackCase && altFallbackCase !== currentSrc) {
        imgEl.setAttribute('data-img-step', '3');
        imgEl.src = altFallbackCase;
        return;
      }
    }

    imgEl.onerror = null;
    imgEl.style.display = 'none';
    const stage = imgEl.closest('[data-img-stage]') || imgEl.parentElement;
    renderStyledImagePlaceholder(stage);
  };

  function detectBaseDesignKey(raw) {
    const ref = String(raw.IP_Design_Ref || '').trim().toUpperCase();
    const sku = String(raw.SKU_ID || '').trim().toUpperCase();
    const name = String(raw.Product_Name || '').trim();

    if (
      ref.includes('IP-SH01') ||
      ref.includes('SH01') ||
      sku.includes('SH01') ||
      name.includes('พี่ทศ') ||
      name.includes('ทศกัณฐ์') ||
      name.toUpperCase().includes('FLOAT')
    ) {
      return 'IP-SH01';
    }
    if (
      ref.includes('IP-SH02') ||
      ref.includes('SH02') ||
      sku.includes('SH02') ||
      name.includes('พี่สหัส') ||
      name.includes('จินตนาการ') ||
      name.toUpperCase().includes('OVERFLOW')
    ) {
      return 'IP-SH02';
    }
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

    const kidNumMatch =
      rawLabel.match(/(?:เด็ก|kid|k)?\s*(12|13|14|15)\b/i) ||
      String(skuId || '').match(/K(12|13|14|15)\b/i);
    if (kidNumMatch) {
      const n = kidNumMatch[1];
      return {
        group: 'KID',
        sizeKey: 'KID_' + n,
        displayLabel: 'เด็ก ' + n,
        rank: 10 + Number(n)
      };
    }

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

  function normalizeParagraphs(meta) {
    if (Array.isArray(meta.artistNoteParagraphs) && meta.artistNoteParagraphs.length > 0) {
      return meta.artistNoteParagraphs.map((p) => String(p || '').trim()).filter(Boolean);
    }
    if (meta.story) {
      return String(meta.story)
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean);
    }
    return [];
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

      // Enforce approved Display Name consistently across all screens
      const approvedDisplayName =
        meta.displayName ||
        meta.thaiName ||
        String(raw.Product_Name || designKey).replace(/\s*\([^)]*\)\s*$/, '').trim();

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
        Product_Name: String(raw.Product_Name || approvedDisplayName).trim(),
        displayName: approvedDisplayName,
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
          displayName: approvedDisplayName,
          shortDescription: meta.shortDescription || '',
          artistNoteParagraphs: normalizeParagraphs(meta),
          colors: {},
          colorOrder: [],
          minPrice: Infinity,
          maxPrice: 0,
          hasPreOrder: false,
          hasAvailableInStock: false
        };
      }

      const design = map[designKey];
      if (!design.colors[colorCode]) {
        const cm = COLOR_META[colorCode] || { code: colorCode, label: colorCode, hex: '#1D1C1A', border: '#82766E' };
        design.colors[colorCode] = {
          code: cm.code,
          label: cm.label,
          hex: cm.hex,
          border: cm.border,
          images: [],
          fallbackImages: [],
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
      if (sku.Sale_Mode === 'IN_STOCK' && sku.Stock_Qty > 0) design.hasAvailableInStock = true;
    });

    const list = Object.keys(map)
      .map((k) => map[k])
      .sort((a, b) => a.order - b.order);

    list.forEach((design) => {
      design.colorOrder.sort((a, b) => (a === 'BLK' ? -1 : b === 'BLK' ? 1 : a.localeCompare(b)));

      const meta = DESIGNS_META[design.designKey] || {};
      design.colorOrder.forEach((colorCode) => {
        const cb = design.colors[colorCode];
        cb.skus.sort((a, b) => a.sizeRank - b.sizeRank);

        const defaultImgs = ((meta.defaultImages && meta.defaultImages[colorCode]) || []).map((u) =>
          normalizeImageUrl(u)
        );
        cb.fallbackImages = defaultImgs.slice(0, 5);
        if (cb.images.length === 0 && cb.fallbackImages.length > 0) {
          cb.images = cb.fallbackImages.slice(0, 5);
        }
      });

      if (design.minPrice === Infinity) design.minPrice = 0;
    });

    state.designs = list;
    state.designMap = map;
  }

  function getDesignStatusBadgeText(design) {
    if (design.hasPreOrder) return 'สั่งจองล่วงหน้า (Pre-order)';
    if (design.hasAvailableInStock) return 'พร้อมส่ง';
    return 'สินค้าหมดชั่วคราว';
  }

  function getSkuStatusBadgeText(sku) {
    if (!sku) return '';
    if (sku.Sale_Mode === 'PRE_ORDER') return 'สั่งจองล่วงหน้า (Pre-order)';
    if (isSkuSoldOut(sku)) return 'สินค้าหมดชั่วคราว';
    return 'พร้อมส่ง';
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
        const fallbackThumb = (colorBucket && colorBucket.fallbackImages && colorBucket.fallbackImages[0]) || '';
        return {
          sku,
          qty,
          thumb,
          fallbackThumb,
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
    return type === 'DELIVERY' ? 'จัดส่งพัสดุ' : 'รับเองที่ KMA STUDIO';
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
      showToast(`สั่งซื้อได้สูงสุด ${maxQty} ชิ้น`, 'error');
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
      showToast(`สั่งซื้อได้สูงสุด ${maxQty} ชิ้น`, 'error');
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

    const badge = $('header-cart-badge');
    if (count > 0) {
      badge.textContent = String(count);
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }

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
        // Silk Jade active step with STRICT Deep Ink text & border
        item.className =
          'flex items-center justify-center gap-1 sm:gap-1.5 px-1.5 py-1.5 rounded-xl text-center bg-silkJade text-deepInk border border-deepInk font-semibold';
        numEl.className =
          'step-num w-5 h-5 rounded-full text-[11px] font-semibold tabular-nums flex items-center justify-center shrink-0 bg-deepInk text-galleryWhite';
      } else if (n < activeStep) {
        item.className =
          'flex items-center justify-center gap-1 sm:gap-1.5 px-1.5 py-1.5 rounded-xl text-center bg-galleryWhite text-deepInk border border-pearlDivider';
        numEl.className =
          'step-num w-5 h-5 rounded-full text-[11px] font-semibold tabular-nums flex items-center justify-center shrink-0 bg-silkJade text-deepInk border border-deepInk/60';
      } else {
        item.className =
          'flex items-center justify-center gap-1 sm:gap-1.5 px-1.5 py-1.5 rounded-xl text-center bg-galleryWhite/60 text-readingTaupe border border-pearlDivider/70';
        numEl.className =
          'step-num w-5 h-5 rounded-full text-[11px] font-semibold tabular-nums flex items-center justify-center shrink-0 bg-dustyPearl text-deepInk';
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

    // Generous bottom spacing so sticky bar NEVER overlaps content or primary buttons
    const main = $('main-container');
    if (viewName === 'catalog' || viewName === 'detail') {
      main.className = 'flex-1 w-full max-w-4xl mx-auto px-4 pt-6 pb-32';
    } else {
      main.className = 'flex-1 w-full max-w-4xl mx-auto px-4 pt-6 pb-16';
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
      console.error('KMA Storefront configuration missing API_URL.');
      showStatusView(
        'ไม่สามารถโหลดคอลเลกชันได้ในขณะนี้',
        'กรุณาตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง',
        true
      );
      return;
    }

    try {
      const response = await fetch(CONFIG.API_URL, { method: 'GET' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!data || data.ok === false) {
        throw new Error((data && data.error) || 'Catalog fetch returned not ok');
      }
      applyLoadedData(data);
    } catch (err) {
      console.error('KMA Storefront load error:', err);
      // Never expose raw API/HTTP/config details in customer-facing text
      showStatusView(
        'ไม่สามารถโหลดคอลเลกชันได้ในขณะนี้',
        'กรุณาตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง',
        true
      );
    }
  }

  function applyLoadedData(data) {
    const settings = (data && data.settings) || {};
    state.settings = {
      Store_Status: String(settings.Store_Status || 'OPEN').trim().toUpperCase(),
      Delivery_Fee: Number(settings.Delivery_Fee || 0),
      Free_Shipping_Min: Number(settings.Free_Shipping_Min || 0),
      QR_Image_URL: String(
        settings.QR_Image_URL || CONFIG.FALLBACK_PAYMENT_CARD_IMAGE || 'images/sys-qr-pay.png'
      ).trim(),
      Bank_Account_Info: String(settings.Bank_Account_Info || '').trim(),
      Default_Terms: String(settings.Default_Terms || '').trim()
    };

    if (state.settings.Store_Status !== 'OPEN') {
      showStatusView(
        'ปิดรับคำสั่งซื้อชั่วคราว',
        'ขอบคุณที่สนใจผลงานของเรา ติดตามการเปิดรับคำสั่งซื้อครั้งถัดไปผ่านช่องทางของ KMA STUDIO',
        false
      );
      return;
    }

    const products = Array.isArray(data && data.products) ? data.products : [];
    buildDesignCollections(products);

    if (state.designs.length === 0) {
      showStatusView(
        'ยังไม่มีผลงานเปิดจำหน่ายในขณะนี้',
        'ติดตามผลงานใหม่ผ่านช่องทางของ KMA STUDIO',
        false
      );
      return;
    }

    state.payment.transferDate = getTodayLocalISO();
    state.payment.transferTime = getNowLocalTimeHHMM();
    $('input-transfer-date').value = state.payment.transferDate;
    $('input-transfer-time').value = state.payment.transferTime;

    renderSizeChartModal();
    navigateTo('catalog');
  }

  function showStatusView(title, message, showRetry) {
    $('view-loading').classList.add('hidden');
    hideAllViews();
    $('checkout-progress-nav').classList.add('hidden');
    $('sticky-cart-bar').classList.add('hidden');
    $('closed-title').textContent = title;
    $('closed-message').textContent = message;
    if (showRetry) {
      $('closed-retry-wrap').classList.remove('hidden');
    } else {
      $('closed-retry-wrap').classList.add('hidden');
    }
    $('view-closed').classList.remove('hidden');
  }

  // ==================== VIEW 1: COLLECTION CATALOG ====================
  function renderCatalogView() {
    const grid = $('catalog-grid');
    if (!grid) return;

    grid.innerHTML = state.designs
      .map((design) => {
        const primaryColor = design.colors[design.colorOrder[0]];
        const heroImg = (primaryColor && primaryColor.images && primaryColor.images[0]) || '';
        const heroFallback = (primaryColor && primaryColor.fallbackImages && primaryColor.fallbackImages[0]) || '';
        const statusBadge = getDesignStatusBadgeText(design);

        const priceLabel =
          design.minPrice === design.maxPrice
            ? `${formatMoney(design.minPrice)} บาท`
            : `เริ่มต้น ${formatMoney(design.minPrice)} บาท`;

        const swatchesHtml = design.colorOrder
          .map((cCode) => {
            const c = design.colors[cCode];
            return `
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pearlGrey border border-pearlDivider text-[13px] font-medium text-deepInk">
                <span
                  class="kma-swatch-dot w-3.5 h-3.5 rounded-full shrink-0"
                  style="background-color: ${escapeHtml(c.hex)}; border: 1px solid ${escapeHtml(c.border)};"
                ></span>
                <span>${escapeHtml(c.label)}</span>
              </span>
            `;
          })
          .join('');

        return `
          <article
            data-action="open-design"
            data-design="${escapeHtml(design.designKey)}"
            class="cursor-pointer group bg-galleryWhite rounded-[28px] border border-pearlDivider overflow-hidden shadow-gallery hover:shadow-galleryHover hover:-translate-y-0.5 transition-all duration-300 flex flex-col"
          >
            <!-- Gallery White Front Cover Stage -->
            <div
              data-img-stage="1"
              class="relative bg-galleryWhite aspect-[4/5] sm:aspect-square flex items-center justify-center overflow-hidden border-b border-pearlDivider/60"
            >
              <span class="kma-status-pill absolute top-3.5 left-3.5 z-10 px-3 py-1 rounded-full text-[12px] font-medium shadow-xs">
                ${escapeHtml(statusBadge)}
              </span>

              ${
                heroImg
                  ? `<img
                      src="${escapeHtml(heroImg)}"
                      data-fallback-src="${escapeHtml(heroFallback)}"
                      alt="${escapeHtml(design.displayName)}"
                      onerror="window.kmaHandleImgError(this)"
                      class="w-full h-full object-contain p-3 sm:p-4 group-hover:scale-[1.02] transition-transform duration-500 ease-out"
                      loading="lazy"
                    />`
                  : `<div data-kma-placeholder="1" class="w-full h-full flex flex-col items-center justify-center text-center px-6 py-12 bg-pearlGrey/70 text-readingTaupe">
                      <span class="font-serif text-[16px] font-semibold tracking-[0.12em] text-deepInk uppercase">KMA STUDIO</span>
                      <span class="text-[13px] text-readingTaupe mt-1">กำลังเตรียมภาพสินค้า</span>
                    </div>`
              }
            </div>

            <!-- Gallery Card Body (Full Short Description — No Truncation/Clamping) -->
            <div class="p-5 sm:p-6 flex-1 flex flex-col justify-between gap-5">
              <div class="space-y-3">
                <h2 class="text-[20px] sm:text-[22px] font-semibold text-deepInk leading-[1.4]">
                  ${escapeHtml(design.displayName)}
                </h2>

                ${
                  design.shortDescription
                    ? `<p class="text-[15px] sm:text-[16px] font-normal text-readingTaupe leading-[1.65]">${escapeHtml(design.shortDescription)}</p>`
                    : ''
                }

                <div class="flex flex-wrap items-center gap-2 pt-0.5">
                  ${swatchesHtml}
                </div>
              </div>

              <div class="pt-4 border-t border-pearlDivider flex items-center justify-between gap-3">
                <div>
                  <div class="text-[13px] text-readingTaupe">ราคา</div>
                  <div class="text-[20px] sm:text-[22px] font-semibold text-deepInk tabular-nums leading-tight mt-0.5">
                    ${escapeHtml(priceLabel)}
                  </div>
                </div>

                <button
                  type="button"
                  data-action="open-design"
                  data-design="${escapeHtml(design.designKey)}"
                  class="kma-btn-jade min-h-[44px] inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-[15px] font-semibold active:scale-95 transition shrink-0"
                >
                  <span>ดูรายละเอียดสินค้า</span>
                </button>
              </div>
            </div>
          </article>
        `;
      })
      .join('');
  }

  // ==================== VIEW 2: PRODUCT DETAIL ====================
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
    const fallbackImages = colorBucket.fallbackImages || [];
    const imgIdx = Math.min(Math.max(0, state.detailSelection.imageIndex), Math.max(0, images.length - 1));
    state.detailSelection.imageIndex = imgIdx;
    const activeImg = images[imgIdx] || '';
    const activeFallback = fallbackImages[imgIdx] || '';

    const statusBadge = getSkuStatusBadgeText(selectedSku);

    // Color Pills (Selected = Silk Jade + Deep Ink text & border; Unselected = Gallery White + Functional Border #82766E)
    const colorPillsHtml = design.colorOrder
      .map((cCode) => {
        const c = design.colors[cCode];
        const isActive = cCode === colorBucket.code;
        return `
          <button
            type="button"
            data-action="detail-color"
            data-color="${escapeHtml(cCode)}"
            class="min-h-[44px] inline-flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[15px] font-semibold transition ${
              isActive
                ? 'bg-silkJade text-deepInk border-deepInk shadow-xs'
                : 'bg-galleryWhite text-deepInk border-controlBorder hover:bg-pearlGrey'
            }"
          >
            <span
              class="kma-swatch-dot w-4 h-4 rounded-full shrink-0"
              style="background-color: ${escapeHtml(c.hex)}; border: 1.5px solid ${escapeHtml(c.border)};"
            ></span>
            <span>${escapeHtml(c.label)}</span>
          </button>
        `;
      })
      .join('');

    // Size Rows: Kid & Adult
    const kidSkus = colorBucket.skus.filter((s) => s.sizeGroup === 'KID');
    const adultSkus = colorBucket.skus.filter((s) => s.sizeGroup === 'ADULT');

    function renderSizeButtons(skuList) {
      return skuList
        .map((sku) => {
          const isSelected = selectedSku && sku.SKU_ID === selectedSku.SKU_ID;
          const soldOut = isSkuSoldOut(sku);
          let cls = 'min-h-[44px] px-3 py-2 rounded-xl border text-[14px] sm:text-[15px] font-medium text-center transition ';
          if (soldOut) {
            cls += isSelected
              ? 'border-rose-600 bg-rose-50 text-readingTaupe line-through'
              : 'border-pearlDivider bg-pearlGrey text-readingTaupe line-through';
          } else if (isSelected) {
            cls += 'bg-silkJade text-deepInk border-deepInk font-semibold';
          } else {
            cls += 'bg-galleryWhite text-deepInk border-controlBorder hover:bg-pearlGrey';
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

    // 5-Image Thumbnail Strip
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
                    data-img-stage="1"
                    aria-label="ภาพที่ ${i + 1}"
                    class="rounded-xl bg-galleryWhite p-1 border-2 aspect-square overflow-hidden flex items-center justify-center transition ${
                      i === imgIdx ? 'border-deepInk' : 'border-pearlDivider hover:border-controlBorder'
                    }"
                  >
                    <img
                      src="${escapeHtml(url)}"
                      data-fallback-src="${escapeHtml(fallbackImages[i] || '')}"
                      alt="${escapeHtml(design.displayName)} ภาพที่ ${i + 1}"
                      onerror="window.kmaHandleImgError(this)"
                      class="w-full h-full object-contain"
                      loading="lazy"
                    />
                  </button>
                `
              )
              .join('')}
          </div>
        `
        : '';

    // Artist's Note — Strictly rendered as 3 distinct <p> paragraphs (never flattened)
    const paragraphs = design.artistNoteParagraphs || [];
    let artistNoteHtml = '';
    if (paragraphs.length > 0) {
      const visibleParagraphs = state.detailSelection.storyExpanded ? paragraphs : [paragraphs[0]];
      const hasMore = paragraphs.length > 1;
      artistNoteHtml = `
        <div class="rounded-2xl bg-galleryWhite border border-pearlDivider p-5 sm:p-6 space-y-3.5">
          <div class="flex items-baseline justify-between gap-3">
            <h2 class="font-serif text-[20px] sm:text-[22px] font-semibold text-deepInk">
              Artist’s Note
            </h2>
            ${
              hasMore
                ? `<button
                    type="button"
                    data-action="toggle-story"
                    class="min-h-[36px] px-2 text-[14px] font-medium text-deepInk underline underline-offset-4 decoration-controlBorder hover:decoration-deepInk shrink-0"
                  >
                    ${state.detailSelection.storyExpanded ? 'ย่อเรื่องราว' : 'อ่านเพิ่มเติม'}
                  </button>`
                : ''
            }
          </div>
          <div class="space-y-4 text-[16px] font-normal text-deepInk leading-[1.82]">
            ${visibleParagraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('')}
          </div>
        </div>
      `;
    }

    // Dynamic Purchase Info Block (Strictly from real settings & SKU mode)
    const deliveryFee = Number(state.settings.Delivery_Fee || 0);
    const freeMin = Number(state.settings.Free_Shipping_Min || 0);
    let shippingInfoLine = 'รับเองที่ KMA STUDIO หรือจัดส่งพัสดุ';
    if (deliveryFee > 0) {
      shippingInfoLine += ` (ค่าจัดส่ง ${formatMoney(deliveryFee)} บาท${
        freeMin > 0 ? ` · ส่งฟรีเมื่อยอดรวมสินค้าครบ ${formatMoney(freeMin)} บาท` : ''
      })`;
    }

    const modeInfoLine =
      selectedSku && selectedSku.Sale_Mode === 'IN_STOCK'
        ? isSkuSoldOut(selectedSku)
          ? 'ขนาดนี้สินค้าหมดชั่วคราว'
          : 'สินค้ารายการนี้พร้อมส่ง'
        : 'สินค้ารายการนี้เปิดรับสั่งจองล่วงหน้า (Pre-order)';

    const soldOutSelected = isSkuSoldOut(selectedSku);
    const stockHelper =
      selectedSku && selectedSku.Sale_Mode === 'IN_STOCK'
        ? soldOutSelected
          ? '<div class="text-[13px] text-rose-800 font-medium mt-0.5">ขนาดนี้สินค้าหมดชั่วคราว</div>'
          : `<div class="text-[13px] text-readingTaupe mt-0.5">ขนาดนี้เหลือ ${selectedSku.Stock_Qty} ชิ้น</div>`
        : '';

    container.innerHTML = `
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        <!-- 1. Gallery Column -->
        <div class="lg:col-span-6">
          <div
            id="detail-gallery-viewport"
            data-gallery-count="${images.length}"
            class="relative rounded-[28px] bg-galleryWhite border border-pearlDivider p-3 sm:p-5 shadow-gallery overflow-hidden touch-pan-y"
          >
            <div data-img-stage="1" class="relative aspect-square flex items-center justify-center bg-galleryWhite">
              ${
                activeImg
                  ? `<img
                      id="detail-hero-img"
                      data-action="open-lightbox"
                      src="${escapeHtml(activeImg)}"
                      data-fallback-src="${escapeHtml(activeFallback)}"
                      alt="${escapeHtml(design.displayName)} (${escapeHtml(colorBucket.label)})"
                      onerror="window.kmaHandleImgError(this)"
                      class="w-full h-full object-contain cursor-zoom-in select-none"
                      draggable="false"
                    />`
                  : `<div data-kma-placeholder="1" class="text-[14px] text-readingTaupe">กำลังเตรียมภาพสินค้า</div>`
              }
            </div>

            ${
              images.length > 1
                ? `
                  <button
                    type="button"
                    data-action="detail-prev-img"
                    aria-label="ภาพก่อนหน้า"
                    class="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-galleryWhite/95 border border-controlBorder text-deepInk shadow-xs flex items-center justify-center hover:bg-pearlGrey active:scale-95 transition"
                  >
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    data-action="detail-next-img"
                    aria-label="ภาพถัดไป"
                    class="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-galleryWhite/95 border border-controlBorder text-deepInk shadow-xs flex items-center justify-center hover:bg-pearlGrey active:scale-95 transition"
                  >
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                `
                : ''
            }

            <div class="mt-2 flex items-center justify-between text-[13px] text-readingTaupe px-1">
              <button
                type="button"
                data-action="open-lightbox"
                class="min-h-[36px] inline-flex items-center gap-1.5 hover:text-deepInk transition"
              >
                <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                </svg>
                <span>แตะภาพเพื่อชมรายละเอียด</span>
              </button>
              ${images.length > 1 ? `<span class="tabular-nums">${imgIdx + 1} / ${images.length}</span>` : ''}
            </div>
          </div>

          ${thumbsHtml}
        </div>

        <!-- 2. Details, Artist's Note & Configuration Column -->
        <div class="lg:col-span-6 space-y-5">
          <div class="space-y-3">
            <span class="inline-block px-3 py-1 rounded-full bg-galleryWhite border border-pearlDivider text-deepInk text-[13px] font-medium">
              ${escapeHtml(statusBadge)}
            </span>

            <h1 class="text-[28px] sm:text-[32px] font-semibold text-deepInk leading-[1.35]">
              ${escapeHtml(design.displayName)}
            </h1>

            ${
              design.shortDescription
                ? `<p class="text-[15px] sm:text-[16px] font-normal text-readingTaupe leading-[1.65]">${escapeHtml(design.shortDescription)}</p>`
                : ''
            }
          </div>

          ${artistNoteHtml}

          <!-- Configuration Card -->
          <div class="bg-galleryWhite rounded-3xl border border-pearlDivider p-5 sm:p-6 shadow-gallery space-y-5">
            <!-- Color -->
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-[14px] sm:text-[15px] font-medium text-deepInk">เลือกสี</span>
                <span class="text-[13px] sm:text-[14px] text-readingTaupe">${escapeHtml(colorBucket.label)}</span>
              </div>
              <div class="flex flex-wrap gap-2.5">
                ${colorPillsHtml}
              </div>
            </div>

            <!-- Size + Size Chart -->
            <div class="space-y-3">
              <div class="flex items-center justify-between gap-2">
                <span class="text-[14px] sm:text-[15px] font-medium text-deepInk">เลือกขนาด</span>
                <button
                  type="button"
                  data-action="open-size-chart"
                  class="min-h-[36px] inline-flex items-center gap-1.5 text-[14px] font-medium text-deepInk underline underline-offset-4 decoration-controlBorder hover:decoration-deepInk"
                >
                  <svg class="w-4 h-4 text-readingTaupe" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3 7h18M3 12h18M3 17h18" />
                  </svg>
                  <span>ดูตารางขนาด</span>
                </button>
              </div>

              ${
                kidSkus.length > 0
                  ? `
                    <div class="space-y-1.5">
                      <div class="text-[13px] text-readingTaupe font-medium">ไซซ์เด็ก</div>
                      <div class="grid grid-cols-4 gap-2">${renderSizeButtons(kidSkus)}</div>
                    </div>
                  `
                  : ''
              }

              ${
                adultSkus.length > 0
                  ? `
                    <div class="space-y-1.5">
                      <div class="text-[13px] text-readingTaupe font-medium">ไซซ์ผู้ใหญ่</div>
                      <div class="grid grid-cols-3 sm:grid-cols-6 gap-2">${renderSizeButtons(adultSkus)}</div>
                    </div>
                  `
                  : ''
              }
            </div>

            <!-- Dynamic Price & Quantity -->
            <div class="rounded-2xl bg-pearlGrey border border-pearlDivider px-4 py-3.5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div class="text-[13px] sm:text-[14px] text-readingTaupe">
                  ราคา (${escapeHtml(colorBucket.label)} · ${escapeHtml(selectedSku ? selectedSku.sizeDisplay : '')})
                </div>
                <div class="text-[22px] sm:text-[24px] font-semibold text-deepInk tabular-nums mt-0.5">
                  ${selectedSku ? `${formatMoney(selectedSku.Unit_Price)} บาท` : '—'}
                </div>
                ${stockHelper}
              </div>

              <div class="space-y-1">
                <div class="text-[13px] text-readingTaupe text-right">จำนวน</div>
                <div class="inline-flex items-center rounded-xl border border-controlBorder bg-galleryWhite overflow-hidden shrink-0">
                  <button
                    type="button"
                    data-action="detail-qty-dec"
                    aria-label="ลดจำนวน"
                    class="w-11 h-11 flex items-center justify-center text-deepInk font-semibold hover:bg-pearlGrey active:bg-dustyPearl"
                  >−</button>
                  <span class="w-10 text-center text-[16px] font-semibold text-deepInk tabular-nums">${state.detailSelection.qty}</span>
                  <button
                    type="button"
                    data-action="detail-qty-inc"
                    aria-label="เพิ่มจำนวน"
                    class="w-11 h-11 flex items-center justify-center text-deepInk font-semibold hover:bg-pearlGrey active:bg-dustyPearl"
                  >+</button>
                </div>
              </div>
            </div>

            <!-- Primary CTA (Silk Jade + Deep Ink Text & Border) -->
            <button
              type="button"
              data-action="detail-add-to-cart"
              ${soldOutSelected || !selectedSku ? 'disabled' : ''}
              class="kma-btn-jade w-full min-h-[48px] py-3.5 px-5 rounded-xl text-[15px] sm:text-[16px] font-semibold active:scale-[0.99] transition disabled:opacity-45 disabled:cursor-not-allowed"
            >
              ${soldOutSelected ? 'ขนาดนี้สินค้าหมดชั่วคราว' : 'เพิ่มลงตะกร้า'}
            </button>
          </div>

          <!-- Purchase Info Block -->
          <div class="rounded-2xl bg-galleryWhite border border-pearlDivider p-5 space-y-2.5 text-[14px] sm:text-[15px] text-readingTaupe">
            <h3 class="text-[15px] font-semibold text-deepInk">การสั่งซื้อและการรับสินค้า</h3>
            <ul class="space-y-1.5 list-disc pl-4 marker:text-warmTaupe">
              <li>${escapeHtml(modeInfoLine)}</li>
              <li>${escapeHtml(shippingInfoLine)}</li>
              <li>หากต้องการเปลี่ยนขนาด กรุณาติดต่อเราก่อนปิดรอบการผลิต</li>
            </ul>
          </div>
        </div>
      </div>
    `;
  }

  // ==================== VIEW 3 (CHECKOUT STEP 1): SHOPPING CART ====================
  function renderCartPage() {
    const body = $('cart-page-body');
    const summary = $('cart-page-summary');
    const items = getCartItems();

    if (items.length === 0) {
      summary.classList.add('hidden');
      body.innerHTML = `
        <div class="p-8 sm:p-10 text-center space-y-4">
          <div class="w-12 h-12 mx-auto rounded-full bg-pearlGrey border border-pearlDivider text-deepInk flex items-center justify-center">
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </div>
          <div class="space-y-1">
            <p class="text-[18px] font-semibold text-deepInk">ยังไม่มีสินค้าในตะกร้า</p>
            <p class="text-[14px] text-readingTaupe">เลือกชมคอลเลกชัน แล้วพบกับผลงานที่คุณชื่นชอบ</p>
          </div>
          <button
            type="button"
            data-action="go-catalog"
            class="kma-btn-jade min-h-[44px] px-6 py-2.5 rounded-xl text-[15px] font-semibold transition"
          >
            สำรวจคอลเลกชัน
          </button>
        </div>
      `;
      return;
    }

    summary.classList.remove('hidden');
    $('cart-page-subtotal').textContent = `${formatMoney(getCartSubtotal())} บาท`;

    body.innerHTML = `
      <div class="divide-y divide-pearlDivider">
        ${items
          .map(
            ({ sku, qty, thumb, fallbackThumb, lineTotal }) => `
              <div class="p-4 sm:p-5 flex items-start gap-3.5">
                <div data-img-stage="1" class="w-18 h-18 sm:w-20 sm:h-20 rounded-xl bg-galleryWhite border border-pearlDivider p-1 shrink-0 flex items-center justify-center overflow-hidden">
                  ${
                    thumb
                      ? `<img
                          src="${escapeHtml(thumb)}"
                          data-fallback-src="${escapeHtml(fallbackThumb)}"
                          alt="${escapeHtml(sku.displayName)}"
                          onerror="window.kmaHandleImgError(this)"
                          class="w-16 h-16 sm:w-18 sm:h-18 object-contain"
                        />`
                      : `<span class="text-[11px] text-readingTaupe font-serif">KMA</span>`
                  }
                </div>

                <div class="min-w-0 flex-1 space-y-1">
                  <div class="flex items-start justify-between gap-2">
                    <h3 class="text-[16px] font-semibold text-deepInk leading-snug">${escapeHtml(sku.displayName)}</h3>
                    <button
                      type="button"
                      data-action="cart-remove"
                      data-sku="${escapeHtml(sku.SKU_ID)}"
                      aria-label="ลบ"
                      class="min-h-[36px] px-2 text-[13px] font-medium text-readingTaupe hover:text-rose-800 shrink-0"
                    >
                      ลบ
                    </button>
                  </div>
                  <div class="text-[13px] sm:text-[14px] text-readingTaupe tabular-nums">
                    ${escapeHtml(sku.colorLabel)} · ${escapeHtml(sku.sizeDisplay)} · ${formatMoney(sku.Unit_Price)} บาท/ชิ้น
                  </div>

                  <div class="pt-2 flex items-center justify-between gap-3">
                    <div class="inline-flex items-center rounded-xl border border-controlBorder bg-galleryWhite overflow-hidden">
                      <button
                        type="button"
                        data-action="cart-dec"
                        data-sku="${escapeHtml(sku.SKU_ID)}"
                        aria-label="ลดจำนวน"
                        class="w-10 h-10 flex items-center justify-center text-deepInk font-semibold hover:bg-pearlGrey"
                      >−</button>
                      <span class="w-9 text-center text-[14px] font-semibold text-deepInk tabular-nums">${qty}</span>
                      <button
                        type="button"
                        data-action="cart-inc"
                        data-sku="${escapeHtml(sku.SKU_ID)}"
                        aria-label="เพิ่มจำนวน"
                        class="w-10 h-10 flex items-center justify-center text-deepInk font-semibold hover:bg-pearlGrey"
                      >+</button>
                    </div>

                    <div class="text-[16px] font-semibold text-deepInk tabular-nums">
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

  // ==================== VIEW 4 (CHECKOUT STEP 2): CUSTOMER & VALIDATION ====================
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
              <div class="font-medium text-deepInk">${escapeHtml(sku.displayName)}</div>
              <div class="text-[13px] text-readingTaupe tabular-nums">
                ${escapeHtml(sku.colorLabel)} · ${escapeHtml(sku.sizeDisplay)} · ${qty} × ${formatMoney(sku.Unit_Price)} บาท
              </div>
            </div>
            <div class="font-semibold text-deepInk tabular-nums shrink-0">${formatMoney(lineTotal)} บาท</div>
          </div>
        `
      )
      .join('');

    if (freeMin > 0 && subtotal >= freeMin) {
      $('delivery-fee-pill').textContent = '0 บาท';
      $('delivery-fee-hint').textContent = `จัดส่งไปยังที่อยู่ที่คุณระบุ (ครบ ${formatMoney(freeMin)} บาท ส่งฟรี)`;
    } else {
      $('delivery-fee-pill').textContent = deliveryFee > 0 ? `${formatMoney(deliveryFee)} บาท` : '0 บาท';
      $('delivery-fee-hint').textContent =
        freeMin > 0
          ? `จัดส่งไปยังที่อยู่ที่คุณระบุ (สั่งเพิ่ม ${formatMoney(Math.max(0, freeMin - subtotal))} บาท ส่งฟรี)`
          : 'จัดส่งไปยังที่อยู่ที่คุณระบุ';
    }

    const isDelivery = state.customer.fulfillmentType === 'DELIVERY';
    $('fulfill-card-pickup').className = isDelivery
      ? 'cursor-pointer rounded-xl border border-controlBorder bg-galleryWhite p-4 flex items-start gap-3 transition'
      : 'cursor-pointer rounded-xl border-2 border-deepInk bg-silkJade/25 p-4 flex items-start gap-3 transition';

    $('fulfill-card-delivery').className = isDelivery
      ? 'cursor-pointer rounded-xl border-2 border-deepInk bg-silkJade/25 p-4 flex items-start gap-3 transition'
      : 'cursor-pointer rounded-xl border border-controlBorder bg-galleryWhite p-4 flex items-start gap-3 transition';

    if (isDelivery) {
      $('shipping-address-wrapper').classList.remove('hidden');
    } else {
      $('shipping-address-wrapper').classList.add('hidden');
      setFieldError('shipping-address', '');
    }

    $('customer-summary-subtotal').textContent = `${formatMoney(subtotal)} บาท`;
    $('customer-summary-fulfill').textContent = getFulfillmentLabel(state.customer.fulfillmentType);
    $('customer-summary-shipping').textContent = `${formatMoney(shipping)} บาท`;
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
          <p class="${idx > 0 ? 'pt-2 border-t border-pearlDivider' : ''}">
            ${uniqueTexts.length > 1 ? `<span class="font-semibold text-deepInk">${idx + 1}.</span> ` : ''}${escapeHtml(text)}
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
        inputEl.classList.add('border-rose-700');
        inputEl.classList.remove('border-controlBorder');
      } else {
        inputEl.classList.remove('border-rose-700');
        inputEl.classList.add('border-controlBorder');
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
      const err = !val
        ? 'กรุณากรอกเบอร์โทรศัพท์'
        : digits.length < 9 || digits.length > 10
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
        ? 'กรุณาตรวจสอบรูปแบบอีเมล'
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
      const err = val.length < 8 ? 'กรุณากรอกที่อยู่จัดส่งให้ครบถ้วน' : '';
      if (forceShow || state.touched.shippingAddress) setFieldError('shipping-address', err);
      return !err;
    }

    if (fieldName === 'acceptedTerms') {
      const checked = $('checkbox-accept-terms').checked;
      state.customer.acceptedTerms = checked;
      const err = !checked ? 'กรุณายอมรับเงื่อนไขการสั่งซื้อก่อนดำเนินการต่อ' : '';
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

  // ==================== VIEW 5 (CHECKOUT STEP 3): PAYMENT V1.1 ====================
  function renderPaymentView() {
    const subtotal = getCartSubtotal();
    const shipping = getShippingFee(subtotal, state.customer.fulfillmentType);
    const grandTotal = subtotal + shipping;

    $('payment-grand-total').textContent = `${formatMoney(grandTotal)} บาท`;
    $('payment-breakdown').textContent = `ยอดรวมสินค้า ${formatMoney(subtotal)} บาท + ค่าจัดส่ง ${formatMoney(
      shipping
    )} บาท`;

    const refCardImg = $('payment-ref-card-img');
    refCardImg.style.display = '';
    refCardImg.src = normalizeImageUrl(
      state.settings.QR_Image_URL || CONFIG.FALLBACK_PAYMENT_CARD_IMAGE || 'images/sys-qr-pay.png'
    );
    refCardImg.onerror = function () {
      if (this.src.indexOf('sys-qr-pay.png') === -1) {
        this.src = './images/sys-qr-pay.png';
      } else {
        this.style.display = 'none';
      }
    };

    $('payment-bank-info').textContent =
      state.settings.Bank_Account_Info || 'กรุณาติดต่อ KMA STUDIO เพื่อสอบถามข้อมูลบัญชีสำหรับโอนเงิน';

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
      else showToast('ไม่สามารถคัดลอกได้ กรุณาคัดลอกด้วยตนเอง', 'error');
    };

    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(text).then(onSuccess, fallbackCopy);
    } else {
      fallbackCopy();
    }
  }

  function compressSlipImage(file) {
    return new Promise((resolve, reject) => {
      const mime = String((file && file.type) || '').toLowerCase();
      const name = String((file && file.name) || '').toLowerCase();
      const isJpgOrPng =
        mime === 'image/jpeg' ||
        mime === 'image/jpg' ||
        mime === 'image/png' ||
        /\.(jpe?g|png)$/.test(name);

      if (!file || !isJpgOrPng) {
        reject(new Error('กรุณาเลือกไฟล์ JPG หรือ PNG'));
        return;
      }

      const reader = new FileReader();
      reader.onerror = () => reject(new Error('ไม่สามารถเปิดรูปสลิปได้ กรุณาเลือกภาพใหม่'));
      reader.onload = (ev) => {
        const img = new Image();
        img.onerror = () => reject(new Error('ไม่สามารถเปิดรูปสลิปได้ กรุณาเลือกภาพใหม่'));
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
            reject(new Error('ไม่สามารถเปิดรูปสลิปได้ กรุณาเลือกภาพใหม่'));
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
      $('slip-size-info').textContent = `แนบแล้ว (${result.compressedKB} KB)`;
      $('slip-empty-state').classList.add('hidden');
      $('slip-preview-state').classList.remove('hidden');
      showToast('แนบหลักฐานเรียบร้อยแล้ว', 'success');
    } catch (err) {
      const msg = err.message || 'ไม่สามารถเปิดรูปสลิปได้ กรุณาเลือกภาพใหม่';
      setFieldError('slip-file', msg);
      showToast(msg, 'error');
    }
  }

  function setSubmitting(isSubmitting) {
    state.submitting = isSubmitting;
    $('btn-submit-order').disabled = isSubmitting;
    $('btn-payment-back').disabled = isSubmitting;
    if (isSubmitting) {
      $('btn-submit-spinner').classList.remove('hidden');
      $('btn-submit-label').textContent = 'กำลังส่งคำสั่งซื้อและหลักฐานการชำระเงิน…';
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
          email_status: 'PENDING',
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
        throw new Error(`HTTP_${response.status}`);
      }

      const data = await response.json();
      if (!data || !data.ok) {
        const backendErr = new Error((data && data.error) || 'SUBMIT_REJECTED');
        backendErr.isBusinessError = Boolean(data && data.error);
        throw backendErr;
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
        order_pdf_url: String(data.order_pdf_url || '').trim(),
        email_status: String(data.email_status || '').trim().toUpperCase(),
        items_snapshot: itemsSnapshot
      };

      navigateTo('confirmation');
    } catch (err) {
      console.error('KMA Order Submit Error:', err);
      const safeGuidance = 'กรุณาตรวจสอบสถานะคำสั่งซื้อก่อนส่งอีกครั้ง หากไม่แน่ใจ ติดต่อ KMA STUDIO';
      $('submit-error-text').textContent = err && err.isBusinessError
        ? `${err.message} — ${safeGuidance}`
        : safeGuidance;
      $('submit-error-box').classList.remove('hidden');
      $('submit-error-box').scrollIntoView({ behavior: 'smooth', block: 'center' });
    } finally {
      setSubmitting(false);
    }
  }

  // ==================== VIEW 6 (CHECKOUT STEP 4): ORDER CONFIRMATION ====================
  function renderConfirmationView() {
    const res = state.orderResult;
    if (!res) return;

    $('confirm-order-id').textContent = res.order_id || '-';

    // Strictly handle ALL 4 real backend email states (Clause 18–19)
    const emailStatusEl = $('confirm-email-status-text');
    const st = String(res.email_status || '').trim().toUpperCase();
    if (st === 'SENT') {
      emailStatusEl.textContent = `ส่งเอกสารยืนยันคำสั่งซื้อไปยัง ${state.customer.email} แล้ว หากไม่พบ กรุณาตรวจสอบจดหมายขยะ (Spam)`;
    } else if (st === 'PENDING' || st === 'QUEUED_QUOTA') {
      emailStatusEl.textContent = 'เอกสารยืนยันคำสั่งซื้ออยู่ระหว่างรอจัดส่งทางอีเมล';
    } else if (st === 'FAILED') {
      emailStatusEl.textContent =
        'ยังไม่สามารถส่งเอกสารทางอีเมลได้ กรุณาติดต่อ KMA STUDIO พร้อมหมายเลขคำสั่งซื้อ';
    } else {
      emailStatusEl.textContent = 'ยังไม่สามารถยืนยันสถานะการส่งอีเมลได้';
    }

    const itemsRows = (res.items_snapshot || [])
      .map(
        ({ sku, qty, lineTotal }) => `
          <div class="flex justify-between gap-3">
            <span>${escapeHtml(sku.displayName)} (${escapeHtml(sku.colorLabel)} · ${escapeHtml(sku.sizeDisplay)}) × ${qty}</span>
            <span class="font-medium tabular-nums shrink-0">${formatMoney(lineTotal)} บาท</span>
          </div>
        `
      )
      .join('');

    $('confirm-details').innerHTML = `
      <div class="flex justify-between gap-3">
        <span class="text-readingTaupe">ผู้สั่งซื้อ</span>
        <span class="font-medium text-deepInk text-right">${escapeHtml(state.customer.name)}</span>
      </div>
      <div class="flex justify-between gap-3">
        <span class="text-readingTaupe">วิธีรับสินค้า</span>
        <span class="font-medium text-deepInk text-right">${escapeHtml(getFulfillmentLabel(state.customer.fulfillmentType))}</span>
      </div>
      <div class="flex justify-between gap-3">
        <span class="text-readingTaupe">วันที่และเวลาที่โอน</span>
        <span class="font-medium text-deepInk tabular-nums text-right">${escapeHtml(formatISOToDDMMYYYY(state.payment.transferDate))} ${escapeHtml(state.payment.transferTime)} น.</span>
      </div>
      <div class="pt-3 border-t border-pearlDivider space-y-1.5">${itemsRows}</div>
      <div class="pt-3 border-t border-pearlDivider flex justify-between items-baseline text-[16px] font-semibold text-deepInk">
        <span>ยอดรวมคำสั่งซื้อ</span>
        <span class="tabular-nums text-[20px]">${formatMoney(res.grand_total)} บาท</span>
      </div>
    `;

    const validPdf = /^https?:\/\//i.test(res.order_pdf_url || '');
    if (validPdf) {
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
    const imgSrc = normalizeImageUrl(CONFIG.SIZE_CHART_IMAGE || 'images/chart-shirt.jpg');
    body.innerHTML = `
      <div data-img-stage="1" class="rounded-2xl bg-galleryWhite border border-pearlDivider p-2 sm:p-3">
        <img
          src="${escapeHtml(imgSrc)}"
          alt="ตารางขนาดเสื้อ KMA STUDIO"
          onerror="window.kmaHandleImgError(this)"
          class="w-full h-auto block rounded-xl object-contain"
        />
      </div>
    `;
  }

  function openSizeChartModal() {
    $('modal-size-chart').classList.remove('hidden');
  }

  function closeSizeChartModal() {
    $('modal-size-chart').classList.add('hidden');
  }

  function openLightbox() {
    const ctx = getActiveDetailContext();
    if (!ctx || !ctx.colorBucket.images.length) return;

    state.lightbox.open = true;
    state.lightbox.zoomed = false;
    state.lightbox.images = ctx.colorBucket.images;
    state.lightbox.fallbackImages = ctx.colorBucket.fallbackImages || [];
    state.lightbox.index = state.detailSelection.imageIndex || 0;
    state.lightbox.title = `${ctx.design.displayName} (${ctx.colorBucket.label})`;

    renderLightbox();
    $('modal-lightbox').classList.remove('hidden');
  }

  function renderLightbox() {
    const lb = state.lightbox;
    const imgEl = $('lightbox-img');
    const url = lb.images[lb.index] || '';
    const fbUrl = (lb.fallbackImages && lb.fallbackImages[lb.index]) || '';

    $('lightbox-caption').textContent = lb.title;
    $('lightbox-counter').textContent = `${lb.index + 1} / ${lb.images.length}`;
    $('btn-lightbox-zoom-toggle').textContent = lb.zoomed ? 'พอดีหน้าจอ' : 'ขยายภาพ';

    imgEl.style.display = '';
    imgEl.removeAttribute('data-img-step');
    imgEl.setAttribute('data-fallback-src', fbUrl);
    imgEl.onerror = function () {
      window.kmaHandleImgError(this);
    };
    const oldPlaceholder = $('lightbox-scroll-area').querySelector('[data-kma-placeholder="1"]');
    if (oldPlaceholder) oldPlaceholder.remove();

    imgEl.src = url;
    imgEl.alt = lb.title;

    if (lb.zoomed) {
      imgEl.className = 'w-[175vw] sm:w-[1100px] max-w-none h-auto rounded-xl bg-galleryWhite object-contain shadow-2xl';
    } else {
      imgEl.className = 'max-w-full max-h-full rounded-xl bg-galleryWhite object-contain transition-all duration-200 shadow-2xl';
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
          state.detailSelection.imageIndex = 0;
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
          showToast(`สั่งซื้อได้สูงสุด ${maxQ} ชิ้น`, 'error');
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
            showToast(`เพิ่ม ${ctx.design.displayName} ลงตะกร้าแล้ว`, 'success');
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

    // Real-time Inline Validation Listeners
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

    // Payment V1.1 Copy & Submit Actions
    $('btn-copy-amount').addEventListener('click', () => {
      const amt = String(getGrandTotal());
      copyWithButtonFeedback(amt, 'btn-copy-amount-label', 'คัดลอกยอดโอน', 'คัดลอกยอดโอนแล้ว');
    });

    $('btn-copy-bank').addEventListener('click', () => {
      const acc = extractAccountNumber(state.settings.Bank_Account_Info);
      copyWithButtonFeedback(acc, 'btn-copy-bank-label', 'คัดลอกเลขบัญชี', 'คัดลอกเลขบัญชีแล้ว');
    });

    $('input-slip-file').addEventListener('change', handleSlipFileChange);
    $('btn-payment-back').addEventListener('click', () => navigateTo('customer'));
    $('btn-submit-order').addEventListener('click', submitOrder);

    // Order Confirmation Actions
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

    $('btn-retry-load').addEventListener('click', loadStoreData);
  }

  // ==================== BOOTSTRAP ====================
  document.addEventListener('DOMContentLoaded', () => {
    bindEvents();
    loadStoreData();
  });
})();
