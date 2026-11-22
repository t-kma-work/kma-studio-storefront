/**
 * KMA STUDIO — Storefront Configuration & Offline Mock Data
 * Zero-Build Static Architecture (Loaded via standard <script> tag for file:// and GitHub Pages compatibility)
 */
window.KMA_CONFIG = {
  // ใส่ URL ของ Google Apps Script Web App หลัง Deploy (ลงท้ายด้วย /exec)
  API_URL: 'https://script.google.com/macros/s/AKfycbw-l1Pe526j3Rys85dwTLkZnOI6_G4vZNjh-ziKPuHO78XgZgtdoxBSdFdAJ07a9ClV/exec',

  // ตั้งค่าเป็น true เพื่อทดสอบหน้าร้านแบบออฟไลน์ได้ทันที (ดับเบิลคลิก index.html)
  // เปลี่ยนเป็น false เมื่อต้องการเชื่อมต่อกับ Google Sheet จริงผ่าน API_URL
  MOCK_MODE: false,

  // อีเมลทางการของสตูดิโอสำหรับแสดงในหน้ายืนยันคำสั่งซื้อ
  STUDIO_EMAIL: 'kmastudio.th@gmail.com',

  // รูปภาพตารางไซซ์มาตรฐาน KMA STUDIO
  SIZE_CHART_IMAGE: 'images/chart-shirt.jpg',

  // ข้อมูลจำลองสำหรับโหมดออฟไลน์ (MOCK_MODE: true) — โครงสร้างตรงกับ doGet() ของ Code.gs ทุกประการ (ไม่มี Unit_Cost)
  MOCK_DATA: {
    settings: {
      Store_Status: 'OPEN',
      Delivery_Fee: 50,
      Free_Shipping_Min: 1500,
      QR_Image_URL: 'images/sys-qr-pay.png',
      Bank_Account_Info: 'ธนาคารกสิกรไทย (KBANK) | เลขบัญชี 123-4-56789-0 | ชื่อบัญชี KMA STUDIO THAILAND',
      Default_Terms:
        'กรุณาตรวจสอบรายละเอียดไซซ์ สี และจำนวนสินค้าให้ถูกต้องก่อนยืนยันคำสั่งซื้อ สลิปการโอนเงินจะถูกตรวจสอบโดยฝ่ายการเงินภายใน 1–2 วันทำการ และส่งใบเสร็จรับเงินฉบับสมบูรณ์ทางอีเมล kmastudio.th@gmail.com'
    },

    products: [
      // ==================== สินค้าที่ 1: หงส์สุวรรณ (PRE_ORDER) ====================
      {
        SKU_ID: 'KMA-HG-KS',
        IP_Design_Ref: 'KMA-IP-01',
        Product_Name: 'เสื้อยืดลาย "หงส์สุวรรณ" (Suvarnahong Heritage)',
        Size_Label: 'Kid S (อก 26")',
        Sale_Mode: 'PRE_ORDER',
        Unit_Price: 350,
        Stock_Qty: 0,
        Product_Terms:
          'สินค้า Pre-order ลายหงส์สุวรรณ ใช้เวลาผลิต 14–21 วันทำการหลังปิดรอบ ไม่สามารถยกเลิกหรือเปลี่ยนไซซ์ได้หลังสถานะล็อกการผลิต (Production Lock)',
        Image_URL: 'images/sh01-01.png, images/sh01-02.png',
        Is_Active: true,
        Version: 1
      },
      {
        SKU_ID: 'KMA-HG-KM',
        IP_Design_Ref: 'KMA-IP-01',
        Product_Name: 'เสื้อยืดลาย "หงส์สุวรรณ" (Suvarnahong Heritage)',
        Size_Label: 'Kid M (อก 28")',
        Sale_Mode: 'PRE_ORDER',
        Unit_Price: 350,
        Stock_Qty: 0,
        Product_Terms:
          'สินค้า Pre-order ลายหงส์สุวรรณ ใช้เวลาผลิต 14–21 วันทำการหลังปิดรอบ ไม่สามารถยกเลิกหรือเปลี่ยนไซซ์ได้หลังสถานะล็อกการผลิต (Production Lock)',
        Image_URL: 'images/sh01-01.png, images/sh01-02.png',
        Is_Active: true,
        Version: 1
      },
      {
        SKU_ID: 'KMA-HG-KL',
        IP_Design_Ref: 'KMA-IP-01',
        Product_Name: 'เสื้อยืดลาย "หงส์สุวรรณ" (Suvarnahong Heritage)',
        Size_Label: 'Kid L (อก 30")',
        Sale_Mode: 'PRE_ORDER',
        Unit_Price: 370,
        Stock_Qty: 0,
        Product_Terms:
          'สินค้า Pre-order ลายหงส์สุวรรณ ใช้เวลาผลิต 14–21 วันทำการหลังปิดรอบ ไม่สามารถยกเลิกหรือเปลี่ยนไซซ์ได้หลังสถานะล็อกการผลิต (Production Lock)',
        Image_URL: 'images/sh01-01.png, images/sh01-02.png',
        Is_Active: true,
        Version: 1
      },
      {
        SKU_ID: 'KMA-HG-AS',
        IP_Design_Ref: 'KMA-IP-01',
        Product_Name: 'เสื้อยืดลาย "หงส์สุวรรณ" (Suvarnahong Heritage)',
        Size_Label: 'Adult S (อก 36")',
        Sale_Mode: 'PRE_ORDER',
        Unit_Price: 490,
        Stock_Qty: 0,
        Product_Terms:
          'สินค้า Pre-order ลายหงส์สุวรรณ ใช้เวลาผลิต 14–21 วันทำการหลังปิดรอบ ไม่สามารถยกเลิกหรือเปลี่ยนไซซ์ได้หลังสถานะล็อกการผลิต (Production Lock)',
        Image_URL: 'images/sh01-01.png, images/sh01-02.png',
        Is_Active: true,
        Version: 1
      },
      {
        SKU_ID: 'KMA-HG-AM',
        IP_Design_Ref: 'KMA-IP-01',
        Product_Name: 'เสื้อยืดลาย "หงส์สุวรรณ" (Suvarnahong Heritage)',
        Size_Label: 'Adult M (อก 38")',
        Sale_Mode: 'PRE_ORDER',
        Unit_Price: 490,
        Stock_Qty: 0,
        Product_Terms:
          'สินค้า Pre-order ลายหงส์สุวรรณ ใช้เวลาผลิต 14–21 วันทำการหลังปิดรอบ ไม่สามารถยกเลิกหรือเปลี่ยนไซซ์ได้หลังสถานะล็อกการผลิต (Production Lock)',
        Image_URL: 'images/sh01-01.png, images/sh01-02.png',
        Is_Active: true,
        Version: 1
      },
      {
        SKU_ID: 'KMA-HG-AL',
        IP_Design_Ref: 'KMA-IP-01',
        Product_Name: 'เสื้อยืดลาย "หงส์สุวรรณ" (Suvarnahong Heritage)',
        Size_Label: 'Adult L (อก 40")',
        Sale_Mode: 'PRE_ORDER',
        Unit_Price: 490,
        Stock_Qty: 0,
        Product_Terms:
          'สินค้า Pre-order ลายหงส์สุวรรณ ใช้เวลาผลิต 14–21 วันทำการหลังปิดรอบ ไม่สามารถยกเลิกหรือเปลี่ยนไซซ์ได้หลังสถานะล็อกการผลิต (Production Lock)',
        Image_URL: 'images/sh01-01.png, images/sh01-02.png',
        Is_Active: true,
        Version: 1
      },
      {
        SKU_ID: 'KMA-HG-AXL',
        IP_Design_Ref: 'KMA-IP-01',
        Product_Name: 'เสื้อยืดลาย "หงส์สุวรรณ" (Suvarnahong Heritage)',
        Size_Label: 'Adult XL (อก 42")',
        Sale_Mode: 'PRE_ORDER',
        Unit_Price: 490,
        Stock_Qty: 0,
        Product_Terms:
          'สินค้า Pre-order ลายหงส์สุวรรณ ใช้เวลาผลิต 14–21 วันทำการหลังปิดรอบ ไม่สามารถยกเลิกหรือเปลี่ยนไซซ์ได้หลังสถานะล็อกการผลิต (Production Lock)',
        Image_URL: 'images/sh01-01.png, images/sh01-02.png',
        Is_Active: true,
        Version: 1
      },
      {
        SKU_ID: 'KMA-HG-P2XL',
        IP_Design_Ref: 'KMA-IP-01',
        Product_Name: 'เสื้อยืดลาย "หงส์สุวรรณ" (Suvarnahong Heritage)',
        Size_Label: 'Plus 2XL (อก 46")',
        Sale_Mode: 'PRE_ORDER',
        Unit_Price: 550,
        Stock_Qty: 0,
        Product_Terms:
          'สินค้า Pre-order ลายหงส์สุวรรณ ใช้เวลาผลิต 14–21 วันทำการหลังปิดรอบ ไม่สามารถยกเลิกหรือเปลี่ยนไซซ์ได้หลังสถานะล็อกการผลิต (Production Lock)',
        Image_URL: 'images/sh01-01.png, images/sh01-02.png',
        Is_Active: true,
        Version: 1
      },
      {
        SKU_ID: 'KMA-HG-P3XL',
        IP_Design_Ref: 'KMA-IP-01',
        Product_Name: 'เสื้อยืดลาย "หงส์สุวรรณ" (Suvarnahong Heritage)',
        Size_Label: 'Plus 3XL (อก 50")',
        Sale_Mode: 'PRE_ORDER',
        Unit_Price: 580,
        Stock_Qty: 0,
        Product_Terms:
          'สินค้า Pre-order ลายหงส์สุวรรณ ใช้เวลาผลิต 14–21 วันทำการหลังปิดรอบ ไม่สามารถยกเลิกหรือเปลี่ยนไซซ์ได้หลังสถานะล็อกการผลิต (Production Lock)',
        Image_URL: 'images/sh01-01.png, images/sh01-02.png',
        Is_Active: true,
        Version: 1
      },

      // ==================== สินค้าที่ 2: ครามสยาม (IN_STOCK) ====================
      {
        SKU_ID: 'KMA-KS-KM',
        IP_Design_Ref: 'KMA-IP-02',
        Product_Name: 'เสื้อยืดลาย "ครามสยาม" (Siam Indigo Wave)',
        Size_Label: 'Kid M (อก 28")',
        Sale_Mode: 'IN_STOCK',
        Unit_Price: 350,
        Stock_Qty: 8,
        Product_Terms:
          'สินค้าพร้อมส่ง ลายครามสยาม จัดส่งภายใน 2–3 วันทำการหลังจากฝ่ายการเงินยืนยันยอดโอนเรียบร้อยแล้ว (หากต้องการเปลี่ยนไซซ์ กรุณาแจ้งภายใน 7 วันและสินค้าต้องอยู่ในสภาพสมบูรณ์ไม่ผ่านการซัก)',
        Image_URL: 'images/sh02-01.png, images/sh02-02.png',
        Is_Active: true,
        Version: 1
      },
      {
        SKU_ID: 'KMA-KS-KL',
        IP_Design_Ref: 'KMA-IP-02',
        Product_Name: 'เสื้อยืดลาย "ครามสยาม" (Siam Indigo Wave)',
        Size_Label: 'Kid L (อก 30")',
        Sale_Mode: 'IN_STOCK',
        Unit_Price: 350,
        Stock_Qty: 5,
        Product_Terms:
          'สินค้าพร้อมส่ง ลายครามสยาม จัดส่งภายใน 2–3 วันทำการหลังจากฝ่ายการเงินยืนยันยอดโอนเรียบร้อยแล้ว (หากต้องการเปลี่ยนไซซ์ กรุณาแจ้งภายใน 7 วันและสินค้าต้องอยู่ในสภาพสมบูรณ์ไม่ผ่านการซัก)',
        Image_URL: 'images/sh02-01.png, images/sh02-02.png',
        Is_Active: true,
        Version: 1
      },
      {
        SKU_ID: 'KMA-KS-AS',
        IP_Design_Ref: 'KMA-IP-02',
        Product_Name: 'เสื้อยืดลาย "ครามสยาม" (Siam Indigo Wave)',
        Size_Label: 'Adult S (อก 36")',
        Sale_Mode: 'IN_STOCK',
        Unit_Price: 450,
        Stock_Qty: 12,
        Product_Terms:
          'สินค้าพร้อมส่ง ลายครามสยาม จัดส่งภายใน 2–3 วันทำการหลังจากฝ่ายการเงินยืนยันยอดโอนเรียบร้อยแล้ว (หากต้องการเปลี่ยนไซซ์ กรุณาแจ้งภายใน 7 วันและสินค้าต้องอยู่ในสภาพสมบูรณ์ไม่ผ่านการซัก)',
        Image_URL: 'images/sh02-01.png, images/sh02-02.png',
        Is_Active: true,
        Version: 1
      },
      {
        SKU_ID: 'KMA-KS-AM',
        IP_Design_Ref: 'KMA-IP-02',
        Product_Name: 'เสื้อยืดลาย "ครามสยาม" (Siam Indigo Wave)',
        Size_Label: 'Adult M (อก 38")',
        Sale_Mode: 'IN_STOCK',
        Unit_Price: 450,
        Stock_Qty: 15,
        Product_Terms:
          'สินค้าพร้อมส่ง ลายครามสยาม จัดส่งภายใน 2–3 วันทำการหลังจากฝ่ายการเงินยืนยันยอดโอนเรียบร้อยแล้ว (หากต้องการเปลี่ยนไซซ์ กรุณาแจ้งภายใน 7 วันและสินค้าต้องอยู่ในสภาพสมบูรณ์ไม่ผ่านการซัก)',
        Image_URL: 'images/sh02-01.png, images/sh02-02.png',
        Is_Active: true,
        Version: 1
      },
      {
        SKU_ID: 'KMA-KS-AL',
        IP_Design_Ref: 'KMA-IP-02',
        Product_Name: 'เสื้อยืดลาย "ครามสยาม" (Siam Indigo Wave)',
        Size_Label: 'Adult L (อก 40")',
        Sale_Mode: 'IN_STOCK',
        Unit_Price: 450,
        Stock_Qty: 3,
        Product_Terms:
          'สินค้าพร้อมส่ง ลายครามสยาม จัดส่งภายใน 2–3 วันทำการหลังจากฝ่ายการเงินยืนยันยอดโอนเรียบร้อยแล้ว (หากต้องการเปลี่ยนไซซ์ กรุณาแจ้งภายใน 7 วันและสินค้าต้องอยู่ในสภาพสมบูรณ์ไม่ผ่านการซัก)',
        Image_URL: 'images/sh02-01.png, images/sh02-02.png',
        Is_Active: true,
        Version: 1
      },
      {
        SKU_ID: 'KMA-KS-AXL',
        IP_Design_Ref: 'KMA-IP-02',
        Product_Name: 'เสื้อยืดลาย "ครามสยาม" (Siam Indigo Wave)',
        Size_Label: 'Adult XL (อก 42")',
        Sale_Mode: 'IN_STOCK',
        Unit_Price: 450,
        Stock_Qty: 0,
        Product_Terms:
          'สินค้าพร้อมส่ง ลายครามสยาม จัดส่งภายใน 2–3 วันทำการหลังจากฝ่ายการเงินยืนยันยอดโอนเรียบร้อยแล้ว (หากต้องการเปลี่ยนไซซ์ กรุณาแจ้งภายใน 7 วันและสินค้าต้องอยู่ในสภาพสมบูรณ์ไม่ผ่านการซัก)',
        Image_URL: 'images/sh02-01.png, images/sh02-02.png',
        Is_Active: true,
        Version: 1
      },
      {
        SKU_ID: 'KMA-KS-P2XL',
        IP_Design_Ref: 'KMA-IP-02',
        Product_Name: 'เสื้อยืดลาย "ครามสยาม" (Siam Indigo Wave)',
        Size_Label: 'Plus 2XL (อก 46")',
        Sale_Mode: 'IN_STOCK',
        Unit_Price: 520,
        Stock_Qty: 4,
        Product_Terms:
          'สินค้าพร้อมส่ง ลายครามสยาม จัดส่งภายใน 2–3 วันทำการหลังจากฝ่ายการเงินยืนยันยอดโอนเรียบร้อยแล้ว (หากต้องการเปลี่ยนไซซ์ กรุณาแจ้งภายใน 7 วันและสินค้าต้องอยู่ในสภาพสมบูรณ์ไม่ผ่านการซัก)',
        Image_URL: 'images/sh02-01.png, images/sh02-02.png',
        Is_Active: true,
        Version: 1
      },
      {
        SKU_ID: 'KMA-KS-P3XL',
        IP_Design_Ref: 'KMA-IP-02',
        Product_Name: 'เสื้อยืดลาย "ครามสยาม" (Siam Indigo Wave)',
        Size_Label: 'Plus 3XL (อก 50")',
        Sale_Mode: 'IN_STOCK',
        Unit_Price: 540,
        Stock_Qty: 2,
        Product_Terms:
          'สินค้าพร้อมส่ง ลายครามสยาม จัดส่งภายใน 2–3 วันทำการหลังจากฝ่ายการเงินยืนยันยอดโอนเรียบร้อยแล้ว (หากต้องการเปลี่ยนไซซ์ กรุณาแจ้งภายใน 7 วันและสินค้าต้องอยู่ในสภาพสมบูรณ์ไม่ผ่านการซัก)',
        Image_URL: 'images/sh02-01.png, images/sh02-02.png',
        Is_Active: true,
        Version: 1
      },

      // ==================== สินค้าที่ 3: รัตนโกสินทร์ อิดิชัน (ปิดการแสดงผลชั่วคราว Is_Active: false) ====================
      {
        SKU_ID: 'KMA-RK-KS',
        IP_Design_Ref: 'KMA-IP-03',
        Product_Name: 'เสื้อยืดลาย "ประจำยาม รัตนโกสินทร์" (Rattanakosin Camp Edition)',
        Size_Label: 'Kid S (อก 26")',
        Sale_Mode: 'PRE_ORDER',
        Unit_Price: 390,
        Stock_Qty: 0,
        Product_Terms:
          'รุ่นพิเศษ รัตนโกสินทร์ อิดิชัน ผ้า Cotton Combed 20s หากในคำสั่งซื้อมีทั้งสินค้าพร้อมส่งและ Pre-order ระบบจะจัดส่งรวมกันเมื่อสินค้า Pre-order ผลิตเสร็จสมบูรณ์',
        Image_URL: '',
        Is_Active: false,
        Version: 1
      },
      {
        SKU_ID: 'KMA-RK-KL',
        IP_Design_Ref: 'KMA-IP-03',
        Product_Name: 'เสื้อยืดลาย "ประจำยาม รัตนโกสินทร์" (Rattanakosin Camp Edition)',
        Size_Label: 'Kid L (อก 30")',
        Sale_Mode: 'PRE_ORDER',
        Unit_Price: 390,
        Stock_Qty: 0,
        Product_Terms:
          'รุ่นพิเศษ รัตนโกสินทร์ อิดิชัน ผ้า Cotton Combed 20s หากในคำสั่งซื้อมีทั้งสินค้าพร้อมส่งและ Pre-order ระบบจะจัดส่งรวมกันเมื่อสินค้า Pre-order ผลิตเสร็จสมบูรณ์',
        Image_URL: '',
        Is_Active: false,
        Version: 1
      },
      {
        SKU_ID: 'KMA-RK-AM',
        IP_Design_Ref: 'KMA-IP-03',
        Product_Name: 'เสื้อยืดลาย "ประจำยาม รัตนโกสินทร์" (Rattanakosin Camp Edition)',
        Size_Label: 'Adult M (อก 38")',
        Sale_Mode: 'IN_STOCK',
        Unit_Price: 520,
        Stock_Qty: 10,
        Product_Terms:
          'รุ่นพิเศษ รัตนโกสินทร์ อิดิชัน ผ้า Cotton Combed 20s หากในคำสั่งซื้อมีทั้งสินค้าพร้อมส่งและ Pre-order ระบบจะจัดส่งรวมกันเมื่อสินค้า Pre-order ผลิตเสร็จสมบูรณ์',
        Image_URL: '',
        Is_Active: false,
        Version: 1
      },
      {
        SKU_ID: 'KMA-RK-AL',
        IP_Design_Ref: 'KMA-IP-03',
        Product_Name: 'เสื้อยืดลาย "ประจำยาม รัตนโกสินทร์" (Rattanakosin Camp Edition)',
        Size_Label: 'Adult L (อก 40")',
        Sale_Mode: 'IN_STOCK',
        Unit_Price: 520,
        Stock_Qty: 6,
        Product_Terms:
          'รุ่นพิเศษ รัตนโกสินทร์ อิดิชัน ผ้า Cotton Combed 20s หากในคำสั่งซื้อมีทั้งสินค้าพร้อมส่งและ Pre-order ระบบจะจัดส่งรวมกันเมื่อสินค้า Pre-order ผลิตเสร็จสมบูรณ์',
        Image_URL: '',
        Is_Active: false,
        Version: 1
      },
      {
        SKU_ID: 'KMA-RK-AXL',
        IP_Design_Ref: 'KMA-IP-03',
        Product_Name: 'เสื้อยืดลาย "ประจำยาม รัตนโกสินทร์" (Rattanakosin Camp Edition)',
        Size_Label: 'Adult XL (อก 42")',
        Sale_Mode: 'IN_STOCK',
        Unit_Price: 520,
        Stock_Qty: 4,
        Product_Terms:
          'รุ่นพิเศษ รัตนโกสินทร์ อิดิชัน ผ้า Cotton Combed 20s หากในคำสั่งซื้อมีทั้งสินค้าพร้อมส่งและ Pre-order ระบบจะจัดส่งรวมกันเมื่อสินค้า Pre-order ผลิตเสร็จสมบูรณ์',
        Image_URL: '',
        Is_Active: false,
        Version: 1
      },
      {
        SKU_ID: 'KMA-RK-P2XL',
        IP_Design_Ref: 'KMA-IP-03',
        Product_Name: 'เสื้อยืดลาย "ประจำยาม รัตนโกสินทร์" (Rattanakosin Camp Edition)',
        Size_Label: 'Plus 2XL (อก 46")',
        Sale_Mode: 'PRE_ORDER',
        Unit_Price: 590,
        Stock_Qty: 0,
        Product_Terms:
          'รุ่นพิเศษ รัตนโกสินทร์ อิดิชัน ผ้า Cotton Combed 20s หากในคำสั่งซื้อมีทั้งสินค้าพร้อมส่งและ Pre-order ระบบจะจัดส่งรวมกันเมื่อสินค้า Pre-order ผลิตเสร็จสมบูรณ์',
        Image_URL: '',
        Is_Active: false,
        Version: 1
      },
      {
        SKU_ID: 'KMA-RK-P3XL',
        IP_Design_Ref: 'KMA-IP-03',
        Product_Name: 'เสื้อยืดลาย "ประจำยาม รัตนโกสินทร์" (Rattanakosin Camp Edition)',
        Size_Label: 'Plus 3XL (อก 50")',
        Sale_Mode: 'PRE_ORDER',
        Unit_Price: 590,
        Stock_Qty: 0,
        Product_Terms:
          'รุ่นพิเศษ รัตนโกสินทร์ อิดิชัน ผ้า Cotton Combed 20s หากในคำสั่งซื้อมีทั้งสินค้าพร้อมส่งและ Pre-order ระบบจะจัดส่งรวมกันเมื่อสินค้า Pre-order ผลิตเสร็จสมบูรณ์',
        Image_URL: '',
        Is_Active: false,
        Version: 1
      },
      {
        SKU_ID: 'KMA-RK-P4XL',
        IP_Design_Ref: 'KMA-IP-03',
        Product_Name: 'เสื้อยืดลาย "ประจำยาม รัตนโกสินทร์" (Rattanakosin Camp Edition)',
        Size_Label: 'Plus 4XL (อก 54")',
        Sale_Mode: 'PRE_ORDER',
        Unit_Price: 620,
        Stock_Qty: 0,
        Product_Terms:
          'รุ่นพิเศษ รัตนโกสินทร์ อิดิชัน ผ้า Cotton Combed 20s หากในคำสั่งซื้อมีทั้งสินค้าพร้อมส่งและ Pre-order ระบบจะจัดส่งรวมกันเมื่อสินค้า Pre-order ผลิตเสร็จสมบูรณ์',
        Image_URL: '',
        Is_Active: false,
        Version: 1
      }
    ]
  }
};
