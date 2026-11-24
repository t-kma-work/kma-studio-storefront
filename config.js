/**
 * KMA STUDIO — Storefront Configuration, Brand Metadata & Fallback Mock Data
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
    'สินค้าเป็นรายการเปิดรับจองล่วงหน้า (Pre-order) กรุณาตรวจสอบสีและขนาดจากตารางขนาดก่อนยืนยันคำสั่งซื้อ หากต้องการเปลี่ยนแปลงขนาดสามารถติดต่อทีมงานได้ก่อนปิดรอบการผลิต';

  var MOCK_PRODUCTS = []
    .concat(
      buildMockDesignSkus(
        'IP-SH01',
        'KMA-SH01',
        'พี่ทศ | ทศกัณฐ์เล่นศิลป์',
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
        'พี่ทศ | ทศกัณฐ์เล่นศิลป์',
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
        'พี่สหัส | งานเลี้ยงแห่งจินตนาการ',
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
        'พี่สหัส | งานเลี้ยงแห่งจินตนาการ',
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

    // ข้อมูลแบรนด์และการติดต่อทางการของ KMA STUDIO
    BRAND_NAME: 'KMA STUDIO',
    BRAND_TAGLINE: 'Crafting Culture, Redefining Artistry',
    STUDIO_EMAIL: 'kmastudio.th@gmail.com',
    STUDIO_FACEBOOK_LABEL: 'facebook.com/KMAStudio.TH/',
    STUDIO_FACEBOOK_URL: 'https://www.facebook.com/KMAStudio.TH/',
    STUDIO_LINE_OA: '@560rvliy',
    STUDIO_LINE_URL: 'https://line.me/R/ti/p/@560rvliy',

    // ไฟล์ภาพระบบหลัก
    BRAND_LOGO: 'images/brand-logo.png',
    SIZE_CHART_IMAGE: 'images/chart-shirt.jpg',
    FALLBACK_QR_IMAGE: 'images/sys-qr-pay.png',

    // ข้อมูลคอลเลกชันและเรื่องราวผลงาน (Founder-Approved Copy & V10 Image Mapping)
    DESIGNS: {
      'IP-SH01': {
        designKey: 'IP-SH01',
        order: 1,
        thaiName: 'พี่ทศ | ทศกัณฐ์เล่นศิลป์',
        englishSubtitle: 'THOTSAKAN MULTI ARTS',
        shortDescription:
          'จะเป็นอย่างไรเมื่อทศกัณฐ์ไม่ได้มาออกรบ แต่มาเล่นศิลป์? พบกับพี่ทศในมุมสดใส สนุกสนาน และเต็มไปด้วยจินตนาการ ผ่านลวดลายที่นำเอกลักษณ์ศิลปะไทยมาพบกับความคิดสร้างสรรค์ร่วมสมัย',
        story:
          'ใครว่าทศกัณฐ์ต้องอยู่แต่ในฉากโขนหรือเรื่องราวการต่อสู้? ครั้งนี้ “พี่ทศ” ชวนเรามองตัวละครที่คุ้นเคยในอีกมุมหนึ่ง จากทศกัณฐ์ผู้มีหลายกรและเครื่องทรงอันวิจิตร สู่โลกแห่งสีสัน ความสนุก และการเล่นกับจินตนาการ ทศกัณฐ์สีฟ้าครามปรากฏตัวท่ามกลางเมฆสีพาสเทล พร้อมลูกโป่งสีม่วงและธง KID’S MULTI ARTS CAMP รายละเอียดที่ดูเป็นมิตรช่วยสร้างบุคลิกใหม่ให้ตัวละคร โดยยังรักษาเอกลักษณ์ที่เชื่อมโยงกับศิลปะไทย พี่ทศจึงไม่ใช่เพียงภาพทศกัณฐ์บนเสื้อ แต่เป็นการนำตัวละครจากโลกศิลปวัฒนธรรมไทยมาสู่บรรยากาศแห่งการเล่น การเรียนรู้ และความคิดสร้างสรรค์ เพราะศิลปะไทยไม่ได้มีไว้ให้ชื่นชมเพียงอย่างเดียว แต่ยังสนุกไปกับมันได้ในทุกวัน',
        defaultImages: {
          BLK: buildV10Images('sh01-blk'),
          WHT: buildV10Images('sh01-wht')
        }
      },
      'IP-SH02': {
        designKey: 'IP-SH02',
        order: 2,
        thaiName: 'พี่สหัส | งานเลี้ยงแห่งจินตนาการ',
        englishSubtitle: 'TS01 — KMA STUDIO',
        shortDescription:
          'งานเลี้ยงแฟนตาซีแห่งจินตนาการที่ซ่อนความสนุกไว้ทั้งสองด้าน จากหมูน้อยบนจานลายครามบริเวณอกเสื้อ สู่ภาพงานเลี้ยงศิลปะไทยที่เต็มไปด้วยตัวละคร สีสัน และรายละเอียดชวนค้นพบ',
        story:
          'ลองจินตนาการถึงงานเลี้ยงหนึ่ง ที่ตัวละครในโลกศิลปะไทยมาพบกันท่ามกลางบรรยากาศแสนสนุก “พี่สหัส” ถ่ายทอดภาพงานเลี้ยงแฟนตาซีไทยผ่านรายละเอียดของตัวละคร เครื่องประดับ และองค์ประกอบที่ชวนให้มองสำรวจ ตั้งแต่งานศิลป์ขนาดเล็กบริเวณอกซ้าย ไปจนถึงภาพขนาดใหญ่บนด้านหลัง ด้านหน้ามีหมูน้อยแก้มชมพูบนจานลายคราม ประดับด้วยเส้นโค้งสีดำ–ทองและดอกทอง เป็นรายละเอียดเล็ก ๆ ที่สะดุดตา ก่อนจะพบกับภาพงานเลี้ยงด้านหลังซึ่งเต็มไปด้วยบรรยากาศและเรื่องราวแห่งจินตนาการ เสน่ห์ของพี่สหัสอยู่ที่ความแตกต่างของทั้งสองด้าน ด้านหน้าเรียบง่ายแต่มีลูกเล่น ขณะที่ด้านหลังเต็มไปด้วยรายละเอียดที่ชวนให้กลับมามองอีกครั้ง ผลงานนี้นำบรรยากาศการเล่าเรื่องของศิลปะไทยมาสร้างสรรค์เป็นดีไซน์ที่มีทั้งความสนุก อารมณ์ขัน และเอกลักษณ์ในการสวมใส่ เพราะบางเรื่องราวไม่ได้จบลงเมื่อมองครั้งแรก แต่ยิ่งมองก็ยิ่งมีรายละเอียดให้ค้นพบ',
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
          'กรุณาตรวจสอบรายละเอียดสี ขนาด และจำนวนสินค้าให้ถูกต้องก่อนยืนยันคำสั่งซื้อ หากต้องการเปลี่ยนแปลงขนาดสามารถติดต่อทีมงานได้ก่อนปิดรอบการผลิต'
      },
      products: MOCK_PRODUCTS
    }
  };
})();
