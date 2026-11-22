/**
 * KMA STUDIO — Storefront Application Logic (Vanilla ES6, Zero-Build)
 * Optimized for LINE & Facebook in-app browsers + Offline Mock Preview
 */
(function () {
  'use strict';

  const CONFIG = window.KMA_CONFIG || {};

  const state = {
    step: 1,
    submitting: false,
    settings: {
      Store_Status: 'OPEN',
      Delivery_Fee: 50,
      Free_Shipping_Min: 0,
      QR_Image_URL: '',
      Bank_Account_Info: '',
      Default_Terms: ''
    },
    products: [],       // Flat active SKU array
    skuMap: {},         // SKU_ID -> SKU object
    productGroups: [],  // Grouped by IP_Design_Ref / Product_Name
    selectedSkuByGroup: {}, // groupKey -> SKU_ID
    galleryIndexByGroup: {}, // groupKey -> active image index (0..4)
    cart: {},           // SKU_ID -> qty (positive integer)
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

  // ==================== DOM HELPERS ====================
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

    const colors =
      type === 'error'
        ? 'bg-rose-900 text-white border-rose-700'
        : type === 'success'
        ? 'bg-indigoDeep text-ivory border-gold'
        : 'bg-charcoal text-ivory border-slate-600';

    const el = document.createElement('div');
    el.className =
      'pointer-events-auto max-w-md w-full px-4 py-2.5 rounded-xl border shadow-lg text-xs sm:text-sm font-medium text-center transition-all duration-300 ' +
      colors;
    el.textContent = message;
    container.appendChild(el);

    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(-6px)';
      setTimeout(() => el.remove(), 300);
    }, 3200);
  }

  function getTodayLocalISO() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function getNowLocalTimeHHMM() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }

  function formatISOToDDMMYYYY(isoDate) {
    if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate || '-';
    const parts = isoDate.split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  // ==================== CART & PRICING CALCULATIONS ====================
  function getCartItems() {
    return Object.keys(state.cart)
      .map((skuId) => {
        const sku = state.skuMap[skuId];
        const qty = Number(state.cart[skuId] || 0);
        if (!sku || qty <= 0) return null;
        return {
          sku,
          qty,
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
    const shipping = getShippingFee(subtotal, state.customer.fulfillmentType);
    return subtotal + shipping;
  }

  function getFulfillmentLabel(type) {
    return type === 'DELIVERY' ? 'จัดส่งพัสดุ' : 'รับเองที่สตูดิโอ';
  }

  function isSkuSoldOut(sku) {
    return String(sku.Sale_Mode || '').toUpperCase() === 'IN_STOCK' && Number(sku.Stock_Qty || 0) <= 0;
  }

  function getMaxQtyForSku(sku) {
    if (String(sku.Sale_Mode || '').toUpperCase() === 'IN_STOCK') {
      return Math.max(0, Number(sku.Stock_Qty || 0));
    }
    return 99;
  }

  function updateCartQty(skuId, delta) {
    const sku = state.skuMap[skuId];
    if (!sku) return;

    const currentQty = Number(state.cart[skuId] || 0);
    const maxQty = getMaxQtyForSku(sku);
    let nextQty = currentQty + delta;

    if (delta > 0 && isSkuSoldOut(sku)) {
      showToast('ไซซ์นี้สินค้าหมดชั่วคราว', 'error');
      return;
    }

    if (nextQty > maxQty) {
      nextQty = maxQty;
      showToast(`สินค้าพร้อมส่งไซซ์นี้มีคงเหลือ ${maxQty} ชิ้น`, 'error');
    }

    if (nextQty <= 0) {
      delete state.cart[skuId];
    } else {
      state.cart[skuId] = nextQty;
    }

    renderCatalog();
    renderStickyCartBar();
    renderCartModalBody();
    if (state.step === 2) {
      renderStep2Summary();
      renderDynamicTerms();
    }
  }

  // ==================== PRODUCT GROUPING ====================
  function detectSizeCategory(sizeLabel) {
    const text = String(sizeLabel || '').toLowerCase();
    if (text.includes('kid') || text.includes('เด็ก')) return 'Kid';
    if (text.includes('plus') || text.includes('2xl') || text.includes('3xl') || text.includes('4xl') || text.includes('5xl')) {
      return 'Plus';
    }
    return 'Adult';
  }

  function parseImageList(imageUrlStr) {
    return String(imageUrlStr || '')
      .split(',')
      .map((u) => u.trim())
      .filter(Boolean)
      .slice(0, 5);
  }

  function buildProductGroups(products) {
    const groupsMap = {};
    const order = [];

    products.forEach((raw) => {
      // Filter out inactive products (supports mock mode where Is_Active may be false)
      if (raw.Is_Active === false || String(raw.Is_Active || '').trim().toUpperCase() === 'FALSE') {
        return;
      }

      const sku = {
        SKU_ID: String(raw.SKU_ID || '').trim(),
        IP_Design_Ref: String(raw.IP_Design_Ref || '').trim(),
        Product_Name: String(raw.Product_Name || '').trim(),
        Size_Label: String(raw.Size_Label || '').trim(),
        Sale_Mode: String(raw.Sale_Mode || 'PRE_ORDER').trim().toUpperCase(),
        Unit_Price: Number(raw.Unit_Price || 0),
        Stock_Qty: Number(raw.Stock_Qty || 0),
        Product_Terms: String(raw.Product_Terms || '').trim(),
        Image_URL: String(raw.Image_URL || '').trim(),
        Version: Number(raw.Version || 1)
      };

      if (!sku.SKU_ID) return;
      state.skuMap[sku.SKU_ID] = sku;

      const groupKey = sku.IP_Design_Ref || sku.Product_Name || sku.SKU_ID;
      if (!groupsMap[groupKey]) {
        groupsMap[groupKey] = {
          key: groupKey,
          ref: sku.IP_Design_Ref,
          name: sku.Product_Name,
          images: [],
          terms: sku.Product_Terms,
          skus: []
        };
        order.push(groupKey);
      }

      const group = groupsMap[groupKey];
      const parsedUrls = parseImageList(sku.Image_URL);
      parsedUrls.forEach((url) => {
        if (group.images.length < 5 && !group.images.includes(url)) {
          group.images.push(url);
        }
      });
      if (!group.terms && sku.Product_Terms) group.terms = sku.Product_Terms;
      group.skus.push(sku);
    });

    const catOrder = { Kid: 1, Adult: 2, Plus: 3 };
    return order.map((key) => {
      const group = groupsMap[key];
      group.skus.sort((a, b) => {
        const ca = catOrder[detectSizeCategory(a.Size_Label)] || 2;
        const cb = catOrder[detectSizeCategory(b.Size_Label)] || 2;
        if (ca !== cb) return ca - cb;
        return 0; // preserve Sheet row order within category
      });

      // Default select first available SKU (prefer Adult in-stock or first non-sold-out)
      const firstAvailable =
        group.skus.find((s) => !isSkuSoldOut(s) && detectSizeCategory(s.Size_Label) === 'Adult') ||
        group.skus.find((s) => !isSkuSoldOut(s)) ||
        group.skus[0];
      if (firstAvailable) {
        state.selectedSkuByGroup[group.key] = firstAvailable.SKU_ID;
      }
      if (state.galleryIndexByGroup[group.key] == null) {
        state.galleryIndexByGroup[group.key] = 0;
      }
      return group;
    });
  }

  // ==================== DATA LOADING ====================
  async function loadStoreData() {
    $('view-loading').classList.remove('hidden');
    $('view-closed').classList.add('hidden');
    hideAllSteps();

    if (CONFIG.MOCK_MODE) {
      $('mock-banner').classList.remove('hidden');
      applyLoadedData(CONFIG.MOCK_DATA);
      return;
    }

    $('mock-banner').classList.add('hidden');
    if (!CONFIG.API_URL || CONFIG.API_URL.includes('YOUR_DEPLOYMENT_ID')) {
      showClosedView(
        'ยังไม่ได้ตั้งค่า API_URL',
        'กรุณาใส่ลิงก์ Google Apps Script Web App ในไฟล์ config.js หรือตั้งค่า MOCK_MODE: true เพื่อทดสอบแบบออฟไลน์'
      );
      return;
    }

    try {
      const response = await fetch(CONFIG.API_URL, { method: 'GET' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      if (!data || data.ok === false) {
        throw new Error((data && data.error) || 'ไม่สามารถโหลดข้อมูลร้านค้าได้');
      }
      applyLoadedData(data);
    } catch (err) {
      showClosedView(
        'ไม่สามารถเชื่อมต่อระบบร้านค้าได้',
        `กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตหรือลองใหม่อีกครั้ง (${err.message})`
      );
    }
  }

  function applyLoadedData(data) {
    $('view-loading').classList.add('hidden');

    const settings = (data && data.settings) || {};
    state.settings = {
      Store_Status: String(settings.Store_Status || 'OPEN').trim().toUpperCase(),
      Delivery_Fee: Number(settings.Delivery_Fee || 0),
      Free_Shipping_Min: Number(settings.Free_Shipping_Min || 0),
      QR_Image_URL: String(settings.QR_Image_URL || '').trim(),
      Bank_Account_Info: String(settings.Bank_Account_Info || '').trim(),
      Default_Terms: String(settings.Default_Terms || '').trim()
    };

    if (state.settings.Store_Status !== 'OPEN') {
      showClosedView(
        'ปิดรับคำสั่งซื้อชั่วคราว',
        'ขณะนี้ร้านค้า KMA STUDIO อยู่ระหว่างปิดรอบการสั่งซื้อ ขอบคุณที่ให้ความสนใจและติดตามรอบถัดไป'
      );
      return;
    }

    const products = Array.isArray(data && data.products) ? data.products : [];
    state.products = products;
    state.skuMap = {};
    state.productGroups = buildProductGroups(products);

    if (state.productGroups.length === 0) {
      showClosedView('ยังไม่มีสินค้าเปิดจำหน่ายในขณะนี้', 'กรุณากลับมาตรวจสอบอีกครั้งเร็วๆ นี้');
      return;
    }

    // Free shipping banner in Step 1
    if (state.settings.Free_Shipping_Min > 0) {
      $('free-shipping-banner').classList.remove('hidden');
      $('free-shipping-banner-text').textContent = `สั่งซื้อครบ ${formatMoney(
        state.settings.Free_Shipping_Min
      )} บาท ส่งพัสดุฟรี!`;
    } else {
      $('free-shipping-banner').classList.add('hidden');
    }

    // Default transfer date & time
    state.payment.transferDate = getTodayLocalISO();
    state.payment.transferTime = getNowLocalTimeHHMM();
    $('input-transfer-date').value = state.payment.transferDate;
    $('input-transfer-time').value = state.payment.transferTime;

    renderSizeChart();
    renderCatalog();
    renderStickyCartBar();
    goToStep(1);
  }

  function showClosedView(title, message) {
    $('view-loading').classList.add('hidden');
    hideAllSteps();
    $('sticky-cart-bar').classList.add('hidden');
    $('closed-title').textContent = title;
    $('closed-message').textContent = message;
    $('view-closed').classList.remove('hidden');
  }

  function hideAllSteps() {
    [1, 2, 3, 4].forEach((n) => {
      const el = $(`step-${n}`);
      if (el) el.classList.add('hidden');
    });
  }

  // ==================== STEP NAVIGATION ====================
  function goToStep(stepNum) {
    state.step = stepNum;
    hideAllSteps();
    $(`step-${stepNum}`).classList.remove('hidden');

    // Update top progress indicator
    document.querySelectorAll('#step-indicator [data-step-nav]').forEach((item) => {
      const n = Number(item.getAttribute('data-step-nav'));
      const badge = item.querySelector('span:first-child');
      if (n === stepNum) {
        item.className = 'flex items-center gap-1.5 px-2 py-1 rounded-lg bg-indigoDeep text-ivory transition';
        badge.className =
          'w-4 h-4 rounded-full bg-gold text-indigoDeep font-bold text-[10px] flex items-center justify-center shrink-0';
      } else if (n < stepNum) {
        item.className = 'flex items-center gap-1.5 px-2 py-1 rounded-lg bg-goldSoft text-indigoDeep transition';
        badge.className =
          'w-4 h-4 rounded-full bg-indigoDeep text-ivory font-bold text-[10px] flex items-center justify-center shrink-0';
      } else {
        item.className = 'flex items-center gap-1.5 px-2 py-1 rounded-lg bg-cream text-slate-500 transition';
        badge.className =
          'w-4 h-4 rounded-full bg-sand text-slate-600 font-bold text-[10px] flex items-center justify-center shrink-0';
      }
    });

    // Show sticky cart bar only on Step 1
    if (stepNum === 1) {
      $('sticky-cart-bar').classList.remove('hidden');
      renderStickyCartBar();
    } else {
      $('sticky-cart-bar').classList.add('hidden');
    }

    if (stepNum === 2) {
      renderStep2Summary();
      renderDynamicTerms();
    } else if (stepNum === 3) {
      renderStep3Payment();
    } else if (stepNum === 4) {
      renderStep4Confirmation();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ==================== STEP 1: CATALOG RENDERING ====================
  function renderCatalog() {
    const container = $('catalog-list');
    if (!container) return;

    const html = state.productGroups
      .map((group) => {
        const selectedSkuId = state.selectedSkuByGroup[group.key] || (group.skus[0] && group.skus[0].SKU_ID);
        const activeSku = state.skuMap[selectedSkuId] || group.skus[0];
        const qtyInCartForSku = Number(state.cart[activeSku.SKU_ID] || 0);
        const totalQtyInGroup = group.skus.reduce((sum, s) => sum + Number(state.cart[s.SKU_ID] || 0), 0);

        const prices = group.skus.map((s) => s.Unit_Price);
        const minPrice = Math.min.apply(null, prices);
        const maxPrice = Math.max.apply(null, prices);
        const priceRangeText =
          minPrice === maxPrice ? `${formatMoney(minPrice)} บาท` : `${formatMoney(minPrice)}–${formatMoney(maxPrice)} บาท`;

        const soldOut = isSkuSoldOut(activeSku);
        const isInStock = activeSku.Sale_Mode === 'IN_STOCK';
        const modeBadge = isInStock
          ? soldOut
            ? '<span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">สินค้าหมด</span>'
            : `<span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">พร้อมส่ง (เหลือ ${activeSku.Stock_Qty})</span>`
          : '<span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-goldSoft text-goldDark border border-gold/50">Pre-order</span>';

        // Group size pills by Kid / Adult / Plus
        const buckets = { Kid: [], Adult: [], Plus: [] };
        group.skus.forEach((s) => {
          buckets[detectSizeCategory(s.Size_Label)].push(s);
        });

        const bucketLabels = {
          Kid: 'ไซซ์เด็ก (Kid)',
          Adult: 'ไซซ์ผู้ใหญ่ (Adult)',
          Plus: 'ไซซ์พิเศษ (Plus)'
        };

        const pillsHtml = ['Kid', 'Adult', 'Plus']
          .filter((cat) => buckets[cat].length > 0)
          .map((cat) => {
            const buttons = buckets[cat]
              .map((sku) => {
                const isSelected = sku.SKU_ID === activeSku.SKU_ID;
                const skuQty = Number(state.cart[sku.SKU_ID] || 0);
                const skuSoldOut = isSkuSoldOut(sku);
                const skuIsInStock = sku.Sale_Mode === 'IN_STOCK';

                let pillClasses =
                  'relative text-left px-2.5 py-2 rounded-xl border transition text-xs flex flex-col gap-0.5 ';
                if (skuSoldOut) {
                  pillClasses += isSelected
                    ? 'border-rose-400 bg-rose-50/70 text-slate-400'
                    : 'border-sand bg-slate-50 text-slate-400 opacity-70';
                } else if (isSelected) {
                  pillClasses += 'border-indigoDeep bg-indigoDeep text-ivory shadow-sm';
                } else {
                  pillClasses += 'border-sand bg-ivory/70 text-indigoDeep hover:border-gold';
                }

                const miniBadge = skuSoldOut
                  ? '<span class="text-[10px] text-rose-500">หมด</span>'
                  : skuIsInStock
                  ? `<span class="text-[10px] ${isSelected ? 'text-emerald-300' : 'text-emerald-700'}">พร้อมส่ง</span>`
                  : `<span class="text-[10px] ${isSelected ? 'text-gold' : 'text-goldDark'}">Pre-order</span>`;

                const countDot =
                  skuQty > 0
                    ? `<span class="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-gold text-indigoDeep font-bold text-[10px] flex items-center justify-center shadow-sm">${skuQty}</span>`
                    : '';

                return `
                  <button
                    type="button"
                    data-action="select-sku"
                    data-group="${escapeHtml(group.key)}"
                    data-sku="${escapeHtml(sku.SKU_ID)}"
                    class="${pillClasses}"
                  >
                    ${countDot}
                    <span class="font-semibold leading-tight">${escapeHtml(sku.Size_Label)}</span>
                    <span class="flex items-center justify-between gap-2 w-full">
                      <span class="text-[11px] ${isSelected ? 'text-ivory/90' : 'text-slate-600'}">฿${formatMoney(sku.Unit_Price)}</span>
                      ${miniBadge}
                    </span>
                  </button>
                `;
              })
              .join('');

            return `
              <div class="space-y-1.5">
                <div class="text-[11px] font-semibold text-slate-500 tracking-wide">${bucketLabels[cat]}</div>
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">${buttons}</div>
              </div>
            `;
          })
          .join('');

        const images = Array.isArray(group.images) ? group.images : [];
        const hasMultipleImages = images.length > 1;
        const currentSlide = Math.min(
          Math.max(0, Number(state.galleryIndexByGroup[group.key] || 0)),
          Math.max(0, images.length - 1)
        );
        state.galleryIndexByGroup[group.key] = currentSlide;

        let imageBlock = '';
        if (images.length === 0) {
          imageBlock = `<div class="w-full h-56 bg-cream flex items-center justify-center text-goldDark text-xs font-medium">KMA STUDIO • ${escapeHtml(group.ref || group.name)}</div>`;
        } else {
          const slidesHtml = images
            .map(
              (url, idx) => `
                <div class="w-full shrink-0 bg-cream flex items-center justify-center">
                  <img
                    src="${escapeHtml(url)}"
                    alt="${escapeHtml(group.name)} (${idx + 1}/${images.length})"
                    class="w-full aspect-[4/3] sm:aspect-[16/11] object-contain bg-cream select-none pointer-events-none"
                    loading="lazy"
                    draggable="false"
                  />
                </div>
              `
            )
            .join('');

          const controlsHtml = hasMultipleImages
            ? `
                <button
                  type="button"
                  data-action="gallery-prev"
                  data-group="${escapeHtml(group.key)}"
                  aria-label="ภาพก่อนหน้า"
                  class="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-ivory/90 text-indigoDeep border border-sand/80 shadow flex items-center justify-center hover:bg-white active:scale-95 transition"
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  type="button"
                  data-action="gallery-next"
                  data-group="${escapeHtml(group.key)}"
                  aria-label="ภาพถัดไป"
                  class="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-ivory/90 text-indigoDeep border border-sand/80 shadow flex items-center justify-center hover:bg-white active:scale-95 transition"
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <div
                  data-gallery-dots="${escapeHtml(group.key)}"
                  class="absolute bottom-2.5 inset-x-0 flex items-center justify-center gap-1.5"
                >
                  ${images
                    .map(
                      (_, idx) => `
                        <button
                          type="button"
                          data-action="gallery-dot"
                          data-group="${escapeHtml(group.key)}"
                          data-index="${idx}"
                          aria-label="ไปยังภาพที่ ${idx + 1}"
                          class="h-2 rounded-full transition-all ${
                            idx === currentSlide ? 'w-5 bg-indigoDeep ring-1 ring-ivory/90' : 'w-2 bg-ivory/85 border border-indigoDeep/30'
                          }"
                        ></button>
                      `
                    )
                    .join('')}
                </div>
              `
            : '';

          imageBlock = `
            <div
              data-gallery-viewport="${escapeHtml(group.key)}"
              data-gallery-count="${images.length}"
              class="relative overflow-hidden bg-cream touch-pan-y"
            >
              <div
                data-gallery-track="${escapeHtml(group.key)}"
                class="flex transition-transform duration-300 ease-out"
                style="transform: translateX(-${currentSlide * 100}%);"
              >
                ${slidesHtml}
              </div>
              ${controlsHtml}
            </div>
          `;
        }

        return `
          <article class="bg-white rounded-2xl border border-sand overflow-hidden shadow-card">
            <div class="relative">
              ${imageBlock}
              ${
                totalQtyInGroup > 0
                  ? `<div class="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-indigoDeep/90 text-gold text-xs font-bold border border-gold/50 shadow">ในตะกร้า ${totalQtyInGroup} ตัว</div>`
                  : ''
              }
            </div>

            <div class="p-4 sm:p-5 space-y-4">
              <div class="flex items-start justify-between gap-3">
                <div class="space-y-0.5">
                  ${group.ref ? `<span class="text-[11px] font-semibold tracking-wider text-goldDark">${escapeHtml(group.ref)}</span>` : ''}
                  <h3 class="text-base sm:text-lg font-bold text-indigoDeep leading-snug">${escapeHtml(group.name)}</h3>
                </div>
                <div class="text-right shrink-0">
                  <div class="text-xs text-slate-400">ช่วงราคา</div>
                  <div class="text-sm font-bold text-goldDark">${priceRangeText}</div>
                </div>
              </div>

              <!-- Size Pills -->
              <div class="space-y-3">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-semibold text-indigoDeep">เลือกไซซ์ที่ต้องการ</span>
                  <button type="button" data-action="open-size-chart" class="text-xs text-goldDark underline underline-offset-2">
                    ดูตารางไซซ์
                  </button>
                </div>
                ${pillsHtml}
              </div>

              <!-- Active SKU Selected Summary & Qty +/- -->
              <div class="rounded-xl bg-ivory border border-sand p-3.5 flex flex-wrap items-center justify-between gap-3">
                <div class="space-y-1 min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="text-sm font-bold text-indigoDeep">${escapeHtml(activeSku.Size_Label)}</span>
                    ${modeBadge}
                  </div>
                  <div class="text-sm font-bold text-goldDark">
                    ${formatMoney(activeSku.Unit_Price)} บาท <span class="text-[11px] font-normal text-slate-500">(${escapeHtml(activeSku.SKU_ID)})</span>
                  </div>
                </div>

                <div class="flex items-center gap-2 shrink-0">
                  ${
                    soldOut
                      ? '<span class="text-xs font-semibold text-rose-600 px-3 py-2 rounded-xl bg-rose-50 border border-rose-200">สินค้าหมด</span>'
                      : qtyInCartForSku === 0
                      ? `<button
                          type="button"
                          data-action="qty-inc"
                          data-sku="${escapeHtml(activeSku.SKU_ID)}"
                          class="px-4 py-2.5 rounded-xl bg-indigoDeep text-ivory text-xs sm:text-sm font-semibold hover:opacity-95 active:scale-95 transition"
                        >
                          + เพิ่มลงตะกร้า
                        </button>`
                      : `<div class="inline-flex items-center rounded-xl border border-indigoDeep bg-white overflow-hidden">
                          <button
                            type="button"
                            data-action="qty-dec"
                            data-sku="${escapeHtml(activeSku.SKU_ID)}"
                            aria-label="ลดจำนวน"
                            class="w-9 h-9 flex items-center justify-center text-indigoDeep font-bold hover:bg-cream active:bg-sand"
                          >−</button>
                          <span class="w-9 text-center text-sm font-bold text-indigoDeep">${qtyInCartForSku}</span>
                          <button
                            type="button"
                            data-action="qty-inc"
                            data-sku="${escapeHtml(activeSku.SKU_ID)}"
                            aria-label="เพิ่มจำนวน"
                            class="w-9 h-9 flex items-center justify-center bg-indigoDeep text-ivory font-bold hover:opacity-90"
                          >+</button>
                        </div>`
                  }
                </div>
              </div>
            </div>
          </article>
        `;
      })
      .join('');

    container.innerHTML = html;
  }

  function renderStickyCartBar() {
    const count = getCartItemCount();
    const subtotal = getCartSubtotal();
    $('sticky-item-count').textContent = String(count);
    $('sticky-subtotal').textContent = formatMoney(subtotal);
    $('btn-step1-next').disabled = count === 0;
  }

  function setGallerySlide(groupKey, targetIndex) {
    const group = state.productGroups.find((g) => g.key === groupKey);
    if (!group || !group.images || group.images.length <= 1) return;

    const count = group.images.length;
    const nextIdx = ((targetIndex % count) + count) % count;
    state.galleryIndexByGroup[groupKey] = nextIdx;

    const track = document.querySelector(`[data-gallery-track="${CSS.escape(groupKey)}"]`);
    if (track) {
      track.style.transform = `translateX(-${nextIdx * 100}%)`;
    }

    const dotsWrap = document.querySelector(`[data-gallery-dots="${CSS.escape(groupKey)}"]`);
    if (dotsWrap) {
      dotsWrap.querySelectorAll('[data-action="gallery-dot"]').forEach((dot) => {
        const idx = Number(dot.getAttribute('data-index'));
        dot.className =
          'h-2 rounded-full transition-all ' +
          (idx === nextIdx ? 'w-5 bg-indigoDeep ring-1 ring-ivory/90' : 'w-2 bg-ivory/85 border border-indigoDeep/30');
      });
    }
  }

  // ==================== SIZE CHART & CART MODALS ====================
  function renderSizeChart() {
    const body = $('size-chart-body');
    const imgSrc = String(CONFIG.SIZE_CHART_IMAGE || 'images/chart-shirt.jpg').trim();

    body.innerHTML = `
      <div class="rounded-2xl bg-white border border-sand p-2 sm:p-3 shadow-sm">
        <img
          src="${escapeHtml(imgSrc)}"
          alt="ตารางขนาดเสื้อ KMA STUDIO"
          class="w-full h-auto block rounded-xl object-contain"
          onerror="this.parentElement.innerHTML='<p class=\\'py-8 px-4 text-center text-xs text-slate-500\\'>ไม่พบไฟล์รูปตารางไซซ์ (${escapeHtml(imgSrc)})</p>'"
        />
      </div>
    `;
  }

  function renderCartModalBody() {
    const body = $('cart-modal-body');
    const items = getCartItems();
    const subtotal = getCartSubtotal();
    $('cart-modal-subtotal').textContent = `${formatMoney(subtotal)} บาท`;
    $('btn-cart-modal-proceed').disabled = items.length === 0;

    if (items.length === 0) {
      body.innerHTML = '<p class="py-8 text-center text-sm text-slate-500">ยังไม่มีสินค้าในตะกร้า</p>';
      return;
    }

    body.innerHTML = items
      .map(
        ({ sku, qty, lineTotal }) => `
          <div class="py-3 flex items-center justify-between gap-3">
            <div class="min-w-0">
              <div class="text-sm font-semibold text-indigoDeep truncate">${escapeHtml(sku.Product_Name)}</div>
              <div class="text-xs text-slate-500">
                ${escapeHtml(sku.Size_Label)} • ${formatMoney(sku.Unit_Price)} บาท
                ${sku.Sale_Mode === 'PRE_ORDER' ? '<span class="text-goldDark font-medium">(Pre-order)</span>' : '<span class="text-emerald-700 font-medium">(พร้อมส่ง)</span>'}
              </div>
              <div class="text-xs font-bold text-goldDark mt-0.5">รวม ${formatMoney(lineTotal)} บาท</div>
            </div>
            <div class="inline-flex items-center rounded-lg border border-sand bg-ivory shrink-0 overflow-hidden">
              <button type="button" data-action="qty-dec" data-sku="${escapeHtml(sku.SKU_ID)}" class="w-8 h-8 flex items-center justify-center font-bold text-indigoDeep hover:bg-cream">−</button>
              <span class="w-8 text-center text-xs font-bold text-indigoDeep">${qty}</span>
              <button type="button" data-action="qty-inc" data-sku="${escapeHtml(sku.SKU_ID)}" class="w-8 h-8 flex items-center justify-center font-bold text-indigoDeep hover:bg-cream">+</button>
            </div>
          </div>
        `
      )
      .join('');
  }

  // ==================== STEP 2: CUSTOMER & DYNAMIC TERMS ====================
  function renderStep2Summary() {
    const items = getCartItems();
    const subtotal = getCartSubtotal();
    const shipping = getShippingFee(subtotal, state.customer.fulfillmentType);
    const grandTotal = subtotal + shipping;
    const deliveryFee = Number(state.settings.Delivery_Fee || 0);
    const freeMin = Number(state.settings.Free_Shipping_Min || 0);

    $('step2-cart-items').innerHTML = items
      .map(
        ({ sku, qty, lineTotal }) => `
          <div class="py-2 flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="font-medium text-indigoDeep">${escapeHtml(sku.Product_Name)}</div>
              <div class="text-xs text-slate-500">${escapeHtml(sku.Size_Label)} × ${qty}</div>
            </div>
            <div class="font-semibold text-indigoDeep shrink-0">${formatMoney(lineTotal)} บาท</div>
          </div>
        `
      )
      .join('');

    $('step2-subtotal').textContent = `${formatMoney(subtotal)} บาท`;

    // Update delivery card pricing pill & hint
    if (freeMin > 0 && subtotal >= freeMin) {
      $('delivery-fee-pill').textContent = 'ส่งฟรี!';
      $('delivery-fee-pill').className =
        'text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full';
      $('delivery-fee-hint').textContent = `ยอดสั่งซื้อครบ ${formatMoney(freeMin)} บาท ได้รับสิทธิ์จัดส่งฟรี`;
    } else {
      $('delivery-fee-pill').textContent = deliveryFee > 0 ? `${formatMoney(deliveryFee)} บาท` : 'ฟรี';
      $('delivery-fee-pill').className =
        'text-xs font-bold text-goldDark bg-goldSoft border border-gold/40 px-2 py-0.5 rounded-full';
      $('delivery-fee-hint').textContent =
        freeMin > 0
          ? `สั่งเพิ่มอีก ${formatMoney(Math.max(0, freeMin - subtotal))} บาท เพื่อรับสิทธิ์ส่งฟรี`
          : 'จัดส่งพัสดุทั่วประเทศพร้อมแจ้งเลขติดตาม';
    }

    // Highlight active fulfillment card
    const isDelivery = state.customer.fulfillmentType === 'DELIVERY';
    $('fulfill-card-pickup').className = isDelivery
      ? 'cursor-pointer rounded-xl border border-sand bg-white p-3.5 flex items-start gap-3 transition'
      : 'cursor-pointer rounded-xl border-2 border-indigoDeep bg-goldSoft/40 p-3.5 flex items-start gap-3 transition';

    $('fulfill-card-delivery').className = isDelivery
      ? 'cursor-pointer rounded-xl border-2 border-indigoDeep bg-goldSoft/40 p-3.5 flex items-start gap-3 transition'
      : 'cursor-pointer rounded-xl border border-sand bg-white p-3.5 flex items-start gap-3 transition';

    if (isDelivery) {
      $('shipping-address-wrapper').classList.remove('hidden');
    } else {
      $('shipping-address-wrapper').classList.add('hidden');
    }

    $('step2-summary-subtotal').textContent = `${formatMoney(subtotal)} บาท`;
    $('step2-summary-fulfill').textContent = getFulfillmentLabel(state.customer.fulfillmentType);
    $('step2-summary-shipping').textContent = shipping === 0 ? 'ฟรี (0 บาท)' : `${formatMoney(shipping)} บาท`;
    $('step2-summary-grand').textContent = `${formatMoney(grandTotal)} บาท`;
  }

  function renderDynamicTerms() {
    const box = $('dynamic-terms-box');
    const items = getCartItems();
    const termsList = [];
    const seen = new Set();

    if (state.settings.Default_Terms) {
      seen.add(state.settings.Default_Terms);
      termsList.push({
        title: 'เงื่อนไขทั่วไปของ KMA STUDIO',
        text: state.settings.Default_Terms
      });
    }

    items.forEach(({ sku }) => {
      const t = String(sku.Product_Terms || '').trim();
      if (t && !seen.has(t)) {
        seen.add(t);
        termsList.push({
          title: `เงื่อนไขเฉพาะสินค้า: ${sku.Product_Name}`,
          text: t
        });
      }
    });

    if (termsList.length === 0) {
      box.innerHTML = '<p>กรุณาตรวจสอบรายละเอียดสินค้าให้ถูกต้องก่อนยืนยันคำสั่งซื้อ</p>';
      return;
    }

    box.innerHTML = termsList
      .map(
        (entry, idx) => `
          <div class="${idx > 0 ? 'pt-2 border-t border-sand/70' : ''}">
            <div class="font-semibold text-indigoDeep mb-0.5">${idx + 1}. ${escapeHtml(entry.title)}</div>
            <p class="text-slate-600">${escapeHtml(entry.text)}</p>
          </div>
        `
      )
      .join('');
  }

  function validateStep2() {
    state.customer.name = $('input-customer-name').value.trim();
    state.customer.phone = $('input-phone').value.trim();
    state.customer.email = $('input-email').value.trim();
    state.customer.lineId = $('input-line-id').value.trim();
    state.customer.campGroupNote = $('input-camp-note').value.trim();
    state.customer.shippingAddress = $('input-shipping-address').value.trim();
    state.customer.acceptedTerms = $('checkbox-accept-terms').checked;

    if (getCartItemCount() === 0) {
      showToast('กรุณาเลือกสินค้าอย่างน้อย 1 รายการ', 'error');
      goToStep(1);
      return false;
    }

    if (state.customer.fulfillmentType === 'DELIVERY' && state.customer.shippingAddress.length < 8) {
      showToast('กรุณากรอกที่อยู่จัดส่งพัสดุให้ครบถ้วน', 'error');
      $('input-shipping-address').focus();
      return false;
    }

    if (!state.customer.name) {
      showToast('กรุณากรอกชื่อ–นามสกุลผู้สั่งซื้อ', 'error');
      $('input-customer-name').focus();
      return false;
    }

    const digits = state.customer.phone.replace(/\D/g, '');
    if (digits.length < 9 || digits.length > 12) {
      showToast('กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง (9–10 หลัก)', 'error');
      $('input-phone').focus();
      return false;
    }

    if (!state.customer.lineId) {
      showToast('กรุณากรอก LINE ID สำหรับติดต่อประสานงาน', 'error');
      $('input-line-id').focus();
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(state.customer.email)) {
      showToast('กรุณากรอกอีเมลให้ถูกต้องเพื่อรับเอกสารยืนยัน PDF', 'error');
      $('input-email').focus();
      return false;
    }

    if (!state.customer.acceptedTerms) {
      showToast('กรุณาติ๊กยอมรับเงื่อนไขการสั่งซื้อสินค้าก่อนดำเนินการต่อ', 'error');
      $('checkbox-accept-terms').focus();
      return false;
    }

    return true;
  }

  // ==================== STEP 3: PAYMENT & CANVAS COMPRESSION ====================
  function renderStep3Payment() {
    const subtotal = getCartSubtotal();
    const shipping = getShippingFee(subtotal, state.customer.fulfillmentType);
    const grandTotal = subtotal + shipping;

    $('step3-grand-total').textContent = `${formatMoney(grandTotal)} บาท`;
    $('step3-breakdown').textContent = `ค่าสินค้า ${formatMoney(subtotal)} บาท + ค่าจัดส่ง ${
      shipping === 0 ? 'ฟรี' : formatMoney(shipping) + ' บาท'
    } (${getFulfillmentLabel(state.customer.fulfillmentType)})`;

    const qrImg = $('payment-qr-img');
    if (state.settings.QR_Image_URL) {
      qrImg.src = state.settings.QR_Image_URL;
      qrImg.classList.remove('hidden');
    } else {
      qrImg.classList.add('hidden');
    }

    $('payment-bank-info').textContent =
      state.settings.Bank_Account_Info || 'กรุณาติดต่อ KMA STUDIO เพื่อขอเลขบัญชีรับโอน';
  }

  function extractAccountNumber(bankInfo) {
    const match = String(bankInfo || '').match(/\d[\d-]{7,}\d/);
    return match ? match[0].replace(/-/g, '') : String(bankInfo || '').trim();
  }

  function copyTextRobust(text, successMsg) {
    if (!text) return;

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
      if (ok) {
        showToast(successMsg, 'success');
      } else {
        showToast('ไม่สามารถคัดลอกอัตโนมัติได้ กรุณากดคัดลอกด้วยตนเอง', 'error');
      }
    };

    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(text).then(
        () => showToast(successMsg, 'success'),
        () => fallbackCopy()
      );
    } else {
      fallbackCopy();
    }
  }

  /**
   * Client-side HTML5 Canvas image compression for LINE / Facebook iOS & Android WebViews
   * Max width: 1200px, JPEG quality: 0.75, Base64 output
   */
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
          reject(new Error('รูปแบบภาพไม่รองรับ กรุณาแคปหน้าจอสลิปเป็น JPG/PNG แล้วลองใหม่'));
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
            // White background prevents transparent PNGs from turning black in JPEG
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

    try {
      const result = await compressSlipImage(file);
      state.payment.slipBase64 = result.base64;
      state.payment.slipMimeType = result.mimeType;
      state.payment.slipFileName = file.name || 'slip.jpg';
      state.payment.slipPreviewUrl = result.dataUrl;
      state.payment.originalKB = result.originalKB;
      state.payment.compressedKB = result.compressedKB;

      $('slip-preview-img').src = result.dataUrl;
      $('slip-size-info').textContent = `พร้อมส่ง (${result.compressedKB} KB จากเดิม ${result.originalKB} KB)`;
      $('slip-empty-state').classList.add('hidden');
      $('slip-preview-state').classList.remove('hidden');
      showToast('แนบและบีบอัดรูปสลิปเรียบร้อยแล้ว', 'success');
    } catch (err) {
      showToast(err.message || 'ไม่สามารถประมวลผลรูปภาพได้', 'error');
    }
  }

  // ==================== ORDER SUBMISSION ====================
  function setSubmitting(isSubmitting) {
    state.submitting = isSubmitting;
    $('btn-submit-order').disabled = isSubmitting;
    $('btn-step3-back').disabled = isSubmitting;
    if (isSubmitting) {
      $('btn-submit-spinner').classList.remove('hidden');
      $('btn-submit-label').textContent = 'กำลังบันทึกคำสั่งซื้อ...';
    } else {
      $('btn-submit-spinner').classList.add('hidden');
      $('btn-submit-label').textContent = 'ยืนยันการสั่งซื้อและส่งสลิป';
    }
  }

  async function submitOrder() {
    if (state.submitting) return;

    state.payment.transferDate = $('input-transfer-date').value;
    state.payment.transferTime = $('input-transfer-time').value;

    if (!state.payment.transferDate || !state.payment.transferTime) {
      showToast('กรุณาระบุวันที่และเวลาที่โอนเงินตามสลิป', 'error');
      return;
    }

    if (!state.payment.slipBase64) {
      showToast('กรุณาแนบรูปหลักฐานการโอนเงิน (สลิป) ก่อนยืนยัน', 'error');
      return;
    }

    const itemsPayload = getCartItems().map(({ sku, qty }) => ({
      sku_id: sku.SKU_ID,
      qty: qty
    }));

    const payload = {
      action: 'CREATE_ORDER',
      customer_name: state.customer.name,
      phone: state.customer.phone,
      email: state.customer.email,
      line_id: state.customer.lineId,
      camp_group_note: state.customer.campGroupNote,
      fulfillment_type: state.customer.fulfillmentType,
      shipping_address:
        state.customer.fulfillmentType === 'DELIVERY' ? state.customer.shippingAddress : '',
      accepted_terms: true,
      items: itemsPayload,
      transfer_date: state.payment.transferDate,
      transfer_time: state.payment.transferTime,
      slip_base64: state.payment.slipBase64,
      slip_mime_type: state.payment.slipMimeType
    };

    setSubmitting(true);

    try {
      if (CONFIG.MOCK_MODE) {
        // Offline realistic simulation
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
          email_status: 'SENT_MOCK',
          items_snapshot: getCartItems()
        };
        goToStep(4);
        return;
      }

      // CORS-safe POST to Google Apps Script Web App
      const response = await fetch(CONFIG.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (!data || !data.ok) {
        throw new Error((data && data.error) || 'ไม่สามารถบันทึกคำสั่งซื้อได้ กรุณาลองใหม่อีกครั้ง');
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
        email_status: data.email_status || 'SENT',
        items_snapshot: getCartItems()
      };

      goToStep(4);
    } catch (err) {
      showToast(err.message || 'เกิดข้อผิดพลาดในการส่งคำสั่งซื้อ', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  // ==================== STEP 4: CONFIRMATION ====================
  function renderStep4Confirmation() {
    const res = state.orderResult;
    if (!res) return;

    $('confirm-order-id').textContent = res.order_id;
    $('confirm-email').textContent = state.customer.email;

    if (res.email_status === 'QUEUED_QUOTA') {
      $('confirm-email-queue-note').classList.remove('hidden');
    } else {
      $('confirm-email-queue-note').classList.add('hidden');
    }

    const itemsRows = (res.items_snapshot || [])
      .map(
        ({ sku, qty, lineTotal }) =>
          `<div class="flex justify-between gap-2"><span>${escapeHtml(sku.Product_Name)} (${escapeHtml(
            sku.Size_Label
          )}) × ${qty}</span><span class="font-medium shrink-0">${formatMoney(lineTotal)} บ.</span></div>`
      )
      .join('');

    $('confirm-details').innerHTML = `
      <div class="flex justify-between gap-2"><span class="text-slate-500">ผู้สั่งซื้อ</span><span class="font-semibold text-indigoDeep">${escapeHtml(state.customer.name)}</span></div>
      <div class="flex justify-between gap-2"><span class="text-slate-500">การรับสินค้า</span><span class="font-semibold text-indigoDeep">${escapeHtml(getFulfillmentLabel(state.customer.fulfillmentType))}</span></div>
      <div class="flex justify-between gap-2"><span class="text-slate-500">วัน–เวลาโอนเงิน</span><span class="font-semibold text-indigoDeep">${escapeHtml(formatISOToDDMMYYYY(state.payment.transferDate))} ${escapeHtml(state.payment.transferTime)} น.</span></div>
      <div class="pt-2 border-t border-sand space-y-1">${itemsRows}</div>
      <div class="pt-2 border-t border-sand flex justify-between text-sm font-bold text-indigoDeep">
        <span>ยอดสุทธิ</span>
        <span class="text-goldDark">${formatMoney(res.grand_total)} บาท</span>
      </div>
    `;

    if (res.order_pdf_url) {
      $('confirm-pdf-link').href = res.order_pdf_url;
      $('confirm-pdf-wrapper').classList.remove('hidden');
    } else {
      $('confirm-pdf-wrapper').classList.add('hidden');
    }
  }

  function resetForNewOrder() {
    state.cart = {};
    state.customer.acceptedTerms = false;
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

    renderCatalog();
    renderStickyCartBar();
    goToStep(1);
  }

  // ==================== EVENT BINDINGS ====================
  function bindEvents() {
    // Delegated clicks for Catalog & Cart Modal
    document.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;

      const action = target.getAttribute('data-action');
      const skuId = target.getAttribute('data-sku');
      const groupKey = target.getAttribute('data-group');

      if (action === 'select-sku' && groupKey && skuId) {
        state.selectedSkuByGroup[groupKey] = skuId;
        renderCatalog();
      } else if (action === 'qty-inc' && skuId) {
        updateCartQty(skuId, 1);
      } else if (action === 'qty-dec' && skuId) {
        updateCartQty(skuId, -1);
      } else if (action === 'gallery-prev' && groupKey) {
        const cur = Number(state.galleryIndexByGroup[groupKey] || 0);
        setGallerySlide(groupKey, cur - 1);
      } else if (action === 'gallery-next' && groupKey) {
        const cur = Number(state.galleryIndexByGroup[groupKey] || 0);
        setGallerySlide(groupKey, cur + 1);
      } else if (action === 'gallery-dot' && groupKey) {
        const idx = Number(target.getAttribute('data-index') || 0);
        setGallerySlide(groupKey, idx);
      } else if (action === 'open-size-chart') {
        $('modal-size-chart').classList.remove('hidden');
      }
    });

    // Touch swipe support for product image galleries (mobile LINE/FB WebViews)
    let touchStartX = 0;
    let touchStartY = 0;
    let activeSwipeGroup = null;

    document.addEventListener(
      'touchstart',
      (e) => {
        const viewport = e.target.closest('[data-gallery-viewport]');
        if (!viewport || Number(viewport.getAttribute('data-gallery-count') || 0) <= 1) {
          activeSwipeGroup = null;
          return;
        }
        const touch = e.changedTouches && e.changedTouches[0];
        if (!touch) return;
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        activeSwipeGroup = viewport.getAttribute('data-gallery-viewport');
      },
      { passive: true }
    );

    document.addEventListener(
      'touchend',
      (e) => {
        if (!activeSwipeGroup) return;
        const touch = e.changedTouches && e.changedTouches[0];
        const groupKey = activeSwipeGroup;
        activeSwipeGroup = null;
        if (!touch) return;

        const dx = touch.clientX - touchStartX;
        const dy = touch.clientY - touchStartY;
        if (Math.abs(dx) > 35 && Math.abs(dx) > Math.abs(dy)) {
          const cur = Number(state.galleryIndexByGroup[groupKey] || 0);
          setGallerySlide(groupKey, dx < 0 ? cur + 1 : cur - 1);
        }
      },
      { passive: true }
    );

    // Header & Modal Controls
    $('btn-open-size-chart-header').addEventListener('click', () => {
      $('modal-size-chart').classList.remove('hidden');
    });
    $('btn-close-size-chart').addEventListener('click', () => {
      $('modal-size-chart').classList.add('hidden');
    });
    $('modal-size-chart').addEventListener('click', (e) => {
      if (e.target === $('modal-size-chart')) $('modal-size-chart').classList.add('hidden');
    });

    $('btn-open-cart-modal').addEventListener('click', () => {
      renderCartModalBody();
      $('modal-cart').classList.remove('hidden');
    });
    $('btn-close-cart-modal').addEventListener('click', () => {
      $('modal-cart').classList.add('hidden');
    });
    $('modal-cart').addEventListener('click', (e) => {
      if (e.target === $('modal-cart')) $('modal-cart').classList.add('hidden');
    });
    $('btn-cart-modal-proceed').addEventListener('click', () => {
      $('modal-cart').classList.add('hidden');
      if (getCartItemCount() > 0) goToStep(2);
    });

    // Step 1 -> Step 2
    $('btn-step1-next').addEventListener('click', () => {
      if (getCartItemCount() === 0) {
        showToast('กรุณาเลือกสินค้าอย่างน้อย 1 ชิ้น', 'error');
        return;
      }
      goToStep(2);
    });

    // Step 2 fulfillment toggle
    document.querySelectorAll('input[name="fulfillment"]').forEach((radio) => {
      radio.addEventListener('change', (e) => {
        state.customer.fulfillmentType = e.target.value;
        renderStep2Summary();
      });
    });

    // Step 2 nav
    $('btn-back-to-catalog-top').addEventListener('click', () => goToStep(1));
    $('btn-step2-back').addEventListener('click', () => goToStep(1));
    $('btn-step2-next').addEventListener('click', () => {
      if (validateStep2()) goToStep(3);
    });

    // Step 3 actions
    $('btn-copy-bank').addEventListener('click', () => {
      const accNo = extractAccountNumber(state.settings.Bank_Account_Info);
      copyTextRobust(accNo, `คัดลอกเลขบัญชี ${accNo} เรียบร้อยแล้ว`);
    });
    $('input-slip-file').addEventListener('change', handleSlipFileChange);
    $('btn-step3-back').addEventListener('click', () => goToStep(2));
    $('btn-submit-order').addEventListener('click', submitOrder);

    // Step 4 actions
    $('btn-copy-order-id').addEventListener('click', () => {
      if (state.orderResult && state.orderResult.order_id) {
        copyTextRobust(state.orderResult.order_id, 'คัดลอกรหัสคำสั่งซื้อเรียบร้อยแล้ว');
      }
    });
    $('btn-new-order').addEventListener('click', resetForNewOrder);

    // Retry button on error
    $('btn-retry-load').addEventListener('click', loadStoreData);
  }

  // ==================== BOOTSTRAP ====================
  document.addEventListener('DOMContentLoaded', () => {
    bindEvents();
    loadStoreData();
  });
})();
