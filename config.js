/**
 * KMA STUDIO — Storefront Configuration, Brand Metadata & Fallback Mock Data (V1.1)
 * Zero-Build Static Architecture (Loaded via standard <script> tag for file:// and GitHub Pages compatibility)
 */
(function () {
  'use strict';

  function buildV10Images(prefix) {
    return [1, 2, 3, 4, 5].map(function (n) {
      return 'images/' + prefix + '-0' + n + '.jpg';
    });
  }

  function buildMockDesignSkus(designRefPrefix, skuPrefix, productName, colorCode, colorLabel, imgPrefix, kidPrice, adultPrice, terms) {
    var imgStr = buildV10Images(imgPrefix).join(', ');
    var sizes = [
      { code: 'K12', label: 'เด็ก 12', price: kidPrice },
      { code: 'K13', label: 'เด็ก 13', price: kidPrice },
      { code: 'K14', label: 'เด็ก 14', price: kidPrice },
      { code: 'K15', label: 'เด็ก 15', price: kidPrice },
      { code: 'AS', label: 'ผู้ใหญ่ S', price: adultPrice },
      { code: 'AM', label: 'ผู้ใหญ่ M', price: adultPrice },
      { code: 'AL', label: 'ผู้ใหญ่ L', price: adultPrice },
      { code: 'AXL', label: 'ผู้ใหญ่ XL', price: adultPrice },
      { code: 'A2XL', label: 'ผู้ใหญ่ 2XL', price: adultPrice },
      { code: 'A3XL', label: 'ผู้ใหญ่ 3XL', price: adultPrice }
    ];

    return sizes.map(function (s) {
      return {
        SKU_ID: skuPrefix + '-' + colorCode + '-' + s.code,
        IP_Design_Ref: designRefPrefix + '-' + colorCode,
        Product_Name: productName + ' (' + colorLabel + ')',
        Size_Label: s.label,
        Sale_Mode: 'PRE_ORDER',
        Unit_Price: s.price,
        Stock_Qty: 0,
        Product_Terms: terms,
        Image_URL: imgStr,
        Is_Active: true,
        Version: 1
      };
    });
  }

  var COMMON_PREORDER_TERMS =
    'สินค้ารายการนี้เปิดรับสั่งจองล่วงหน้า (Pre-order) กรุณาตรวจสอบสีและขนาดจากตารางขนาดก่อนยืนยันคำสั่งซื้อ หากต้องการเปลี่ยนขนาด กรุณาติดต่อเราก่อนปิดรอบการผลิต';

  var MOCK_PRODUCTS = []
    .concat(
      buildMockDesignSkus(
        'IP-SH01',
        'KMA-SH01',
        'พี่ทศ | FLOAT',
        'BLK',
        'สีดำ',
        'sh01-blk',
        369,
        369,
        COMMON_PREORDER_TERMS
      )
    )
    .concat(
      buildMockDesignSkus(
        'IP-SH01',
        'KMA-SH01',
        'พี่ทศ | FLOAT',
        'WHT',
        'สีขาว',
        'sh01-wht',
        369,
        369,
        COMMON_PREORDER_TERMS
      )
    )
    .concat(
      buildMockDesignSkus(
        'IP-SH02',
        'KMA-SH02',
        'พี่สหัส | OVERFLOW',
        'BLK',
        'สีดำ',
        'sh02-blk',
        290,
        350,
        COMMON_PREORDER_TERMS
      )
    )
    .concat(
      buildMockDesignSkus(
        'IP-SH02',
        'KMA-SH02',
        'พี่สหัส | OVERFLOW',
        'WHT',
        'สีขาว',
        'sh02-wht',
        290,
        350,
        COMMON_PREORDER_TERMS
      )
    );

  window.KMA_CONFIG = {
    // URL ของ Google Apps Script Web App หลัง Deploy (ลงท้ายด้วย /exec)
    API_URL: 'https://script.google.com/macros/s/AKfycbw-l1Pe526j3Rys85dwTLkZnOI6_G4vZNjh-ziKPuHO78XgZgtdoxBSdFdAJ07a9ClV/exec',

    // เชื่อมต่อ Google Sheet จริงผ่าน API_URL (false)
    MOCK_MODE: false,

    // ข้อมูลแบรนด์และช่องทางติดต่อทางการของ KMA STUDIO
    BRAND_NAME: 'KMA STUDIO',
    BRAND_TAGLINE: 'Crafting Culture, Redefining Artistry',
    STUDIO_EMAIL: 'kmastudio.th@gmail.com',
    STUDIO_FACEBOOK_LABEL: 'KMAStudio.TH',
    STUDIO_FACEBOOK_URL: 'https://www.facebook.com/KMAStudio.TH/',
    STUDIO_LINE_OA: '@560rvliy',
    STUDIO_LINE_URL: 'https://line.me/R/ti/p/@560rvliy',

    // ไฟล์ภาพระบบหลัก
    BRAND_LOGO: 'images/brand-logo.png',
    SIZE_CHART_IMAGE: 'images/chart-shirt.jpg',
    FALLBACK_PAYMENT_CARD_IMAGE: 'images/sys-qr-pay.png',

    // ข้อมูลคอลเลกชันและ Artist’s Note (Founder-Approved Integrated Handoff V1.0)
    DESIGNS: {
      'IP-SH01': {
        designKey: 'IP-SH01',
        order: 1,
        displayName: 'พี่ทศ | FLOAT',
        shortDescription:
          'ยักษ์ใหญ่ในวันที่ไม่ต้องยิ่งใหญ่ ปล่อยให้ความซน ความสุข และเด็กที่ยังอยู่ข้างในได้ออกมาเล่นอีกครั้ง',
        artistNoteParagraphs: [
          'ผมไม่ได้อยากให้ทศกัณฐ์เลิกเป็นยักษ์ แค่อยากให้เขามีวันหยุดจากการเป็นยักษ์บ้าง สำหรับผม เขาเป็นตัวละครที่โคตรจะมนุษย์ ทั้งความรัก ความดื้อรั้น และความเปราะบางที่ซ่อนอยู่ใต้เครื่องทรงอันยิ่งใหญ่ ผมเลยลองวางอาวุธในมือของเขาลง แล้วแทนที่ด้วยลูกโป่ง ธง KID’S Multi Arts Camp และรอยยิ้มที่ไม่ต้องห่วงหล่อ',
          'พี่ทศยังเป็นยักษ์ตัวเดิม เพียงแต่สีเขียวที่เคยขรึมถูกบิดให้สดขึ้นเป็นฟ้าอมเขียว สัดส่วนที่เคยสง่าถูกทอนให้ป้อมกลม แล้วปล่อยให้เขาลอยอยู่บนเมฆไทยอย่างสบายใจ รายละเอียดของชฎา ลายกนก และเครื่องทรงยังอยู่ตรงนั้น แต่วันนี้เขาไม่ต้องใช้ความน่าเกรงขามเพื่อบอกว่าเขาเป็นใคร',
          'งานชิ้นนี้เป็นพื้นที่เล็ก ๆ ให้ความเป็นเด็กในตัวเราได้กลับมาหายใจ และเป็นวิธีของผมในการพาศิลปะไทยออกมาเดินเล่นกับเด็ก ๆ อีกครั้ง'
        ],
        defaultImages: {
          BLK: buildV10Images('sh01-blk'),
          WHT: buildV10Images('sh01-wht')
        }
      },
      'IP-SH02': {
        designKey: 'IP-SH02',
        order: 2,
        displayName: 'พี่สหัส | OVERFLOW',
        shortDescription:
          'ความสุขแบบเกินพอดี เมื่อเหล่ายักษ์วางเกราะ สวมสูท และปล่อยให้ค่ำคืนเป็นของพวกเขาเอง',
        artistNoteParagraphs: [
          'ผมชอบความเยอะของสหัสเดชะ เศียรซ้อน หลายมือ และซิลลูเอตที่อลังการจนแทบไม่มีที่ว่างให้ความพอดี ผมเลยอยากลองพาลูกพี่ใหญ่คนนี้ออกจากสนามรบ มาอยู่ในอีกพื้นที่หนึ่งที่เขาไม่ต้องใช้บารมีกับใคร — โต๊ะอาหาร',
          'สูทขาว โบว์แดง และบัลลังก์สีน้ำเงินตัดทอง กลายเป็นฉากของค่ำคืนที่เหล่ายักษ์ได้ใช้หลายมือไปกับความสุขแทนอาวุธ ทั้งชนแก้ว หยิบพิซซ่า และกินของอร่อยกับพวกพ้อง ผมจงใจเอาความคลาสสิกของดินเนอร์แบบตะวันตกมาชนกับความจัดจ้านของศิลปะไทย โดยมีนางวิเสทในลุคใหม่เข้ามาเติมความกวนให้วงเลี้ยง',
          'ลายเล็ก ๆ ที่อกซ้ายคือออเดิร์ฟ ส่วนด้านหลังคือเรื่องราวที่เฉลยว่าจานนั้นมาจากไหน ผมอยากให้คนดูสนุกกับการค้นพบรายละเอียดเหมือนเป็นแขกอีกคนในงานเลี้ยง เพราะบางครั้ง ตำนานก็ไม่ต้องยิ่งใหญ่ไปกว่าช่วงเวลาที่เราได้อยู่กับคนของเรา'
        ],
        defaultImages: {
          BLK: buildV10Images('sh02-blk'),
          WHT: buildV10Images('sh02-wht')
        }
      }
    },

    // ข้อมูลจำลองสำรอง (ใช้เฉพาะเมื่อตั้งค่า MOCK_MODE: true)
    MOCK_DATA: {
      settings: {
        Store_Status: 'OPEN',
        Delivery_Fee: 50,
        Free_Shipping_Min: 0,
        QR_Image_URL: 'images/sys-qr-pay.png',
        Bank_Account_Info: 'ธนาคารกสิกรไทย (KBANK) | เลขบัญชี 123-4-56789-0 | ชื่อบัญชี KMA STUDIO THAILAND',
        Default_Terms:
          'กรุณาตรวจสอบรายละเอียดสี ขนาด และจำนวนสินค้าให้ถูกต้องก่อนยืนยันคำสั่งซื้อ หากต้องการเปลี่ยนขนาด กรุณาติดต่อเราก่อนปิดรอบการผลิต'
      },
      products: MOCK_PRODUCTS
    }
  };
})();
