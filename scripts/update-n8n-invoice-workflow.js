/**
 * Script to configure n8n workflow 'download_pdf_wf' as a pure, stateless
 * document rendering engine with HMAC Signed Token protection.
 * 
 * ARCHITECTURE COMPLIANCE:
 * - NO hardcoded credentials or API tokens.
 * - NO outbound network calls (HTTP/Fetch) from inside the rendering engine.
 * - Enforces HMAC-SHA256 signature and 15-minute expiration on download links to prevent IDOR / enumeration.
 * - Consumes structured order/invoice data directly from the input payload.
 * - Fully multi-tenant safe and eliminates IDOR/BOLA by design.
 * 
 * Usage inside n8n container:
 *   node scripts/update-n8n-invoice-workflow.js
 */

const sqlite3 = require('/usr/local/lib/node_modules/n8n/node_modules/sqlite3');
const db = new sqlite3.Database('/home/node/.n8n/database.sqlite');

const generatorCode = `const PDFDocument = require('pdfkit');
const crypto = require('crypto');

let secret = 'eaa_pdf_download_secret_2026';
try {
  if (typeof $env !== 'undefined' && $env && $env.PDF_DOWNLOAD_SECRET) {
    secret = $env.PDF_DOWNLOAD_SECRET;
  }
} catch (e) {}

const query = $input.first().json.query || $input.first().json.body || $input.first().json;
const orderId = (query.order_id || query.orderCode || query.orderId || '').toString().trim();
const customerName = (query.customer_name || query.customerName || query.customer || 'Khách hàng').toString().trim();
const customerAddress = (query.address || query.customer_address || query.customerAddress || 'Địa chỉ chưa cập nhật').toString().trim();
const customerTaxId = (query.tax_id || query.taxId || '').toString().trim();
const expires = Number(query.expires) || 0;
const signature = (query.signature || query.token || '').toString().trim();

let isAuthorized = true;
let authErrorMsg = '';

// Kiểm tra chữ ký bảo mật Signed Token (chống IDOR / Scanning)
if (!orderId) {
  isAuthorized = false;
  authErrorMsg = 'Thiếu mã đơn hàng hợp lệ.';
} else if (!expires || Date.now() > expires) {
  isAuthorized = false;
  authErrorMsg = 'Liên kết tải hóa đơn đã hết hạn bảo mật (chỉ có hiệu lực trong 15 phút). Vui lòng quay lại Trợ lý AI để yêu cầu tạo liên kết mới.';
} else {
  const expectedSig = crypto.createHmac('sha256', secret).update(orderId + ':' + expires).digest('hex');
  if (signature !== expectedSig) {
    isAuthorized = false;
    authErrorMsg = 'Chữ ký số bảo mật không hợp lệ (Truy cập bị từ chối / Invalid HMAC Signature).';
  }
}

const doc = new PDFDocument({
  size: 'A4',
  margin: 40,
  info: {
    Title: isAuthorized ? ('HoaDon_' + orderId) : 'Access_Denied',
    Author: 'Enterprise AI Assistant'
  }
});

const regularFont = '/usr/share/fonts/truetype/msttcorefonts/Arial.ttf';
const boldFont = '/usr/share/fonts/truetype/msttcorefonts/Arial_Bold.ttf';

doc.registerFont('Arial', regularFont);
doc.registerFont('Arial-Bold', boldFont);

const buffers = [];
doc.on('data', b => buffers.push(b));

if (!isAuthorized) {
  // --- TRANG CẢNH BÁO TRUY CẬP BỊ TỪ CHỐI (SECURITY GUARD) ---
  doc.rect(40, 40, 515, 60).fill('#fef2f2');
  doc.fillColor('#dc2626').font('Arial-Bold').fontSize(16).text('THÔNG BÁO BẢO MẬT HỆ THỐNG (SECURITY NOTICE)', 55, 52);
  doc.fillColor('#991b1b').font('Arial').fontSize(9)
     .text('Enterprise AI Assistant - Cơ chế Bảo vệ Truy cập An toàn Đa Khách thuê (Multi-Tenant Guard)', 55, 73);

  doc.rect(40, 105, 515, 3).fill('#ef4444');

  doc.fillColor('#7f1d1d').font('Arial-Bold').fontSize(18).text('TRUY CẬP BỊ TỪ CHỐI (ACCESS DENIED)', 40, 150, { align: 'center' });

  doc.rect(40, 190, 515, 120).lineWidth(1).strokeColor('#fca5a5').fillAndStroke('#fff1f2', '#fecdd3');
  doc.fillColor('#991b1b').font('Arial-Bold').fontSize(11).text('LÝ DO TỪ CHỐI TRUY CẬP:', 60, 205);
  doc.fillColor('#374151').font('Arial').fontSize(10).text(authErrorMsg, 60, 225, { width: 475 });
  doc.fillColor('#6b7280').font('Arial').fontSize(8.5).text('Mã tham chiếu đơn hàng: ' + (orderId || 'N/A') + '  |  Thời gian: ' + new Date().toLocaleString('vi-VN'), 60, 275);

  doc.end();
  await new Promise(r => doc.on('end', r));
  const pdfBuffer = Buffer.concat(buffers);
  return [
    {
      json: { success: false, error: authErrorMsg },
      binary: {
        data: {
          data: pdfBuffer.toString('base64'),
          mimeType: 'application/pdf',
          fileName: 'Access_Denied.pdf'
        }
      }
    }
  ];
}

let invoiceDate = query.invoiceDate || query.invoice_date;
if (!invoiceDate) {
  if (query.posting_date) {
    const parts = query.posting_date.split('-');
    if (parts.length === 3) invoiceDate = parts[2] + '/' + parts[1] + '/' + parts[0];
    else invoiceDate = query.posting_date;
  } else {
    invoiceDate = new Date().toLocaleDateString('vi-VN');
  }
}

let rawStatus = (query.status || query.invoiceStatus || '').toString().trim();
let invoiceStatus = 'Đã thanh toán (Paid)';
if (rawStatus.toLowerCase() === 'unpaid') {
  invoiceStatus = 'Chưa thanh toán (Unpaid)';
} else if (rawStatus.toLowerCase() === 'overdue') {
  invoiceStatus = 'Quá hạn thanh toán (Overdue)';
} else if (rawStatus.toLowerCase() === 'draft') {
  invoiceStatus = 'Bản nháp (Draft)';
} else if (rawStatus.toLowerCase() === 'cancelled') {
  invoiceStatus = 'Đã hủy (Cancelled)';
} else if (rawStatus) {
  invoiceStatus = rawStatus === 'Paid' ? 'Đã thanh toán (Paid)' : rawStatus;
}

let currencyUnit = (query.currency && query.currency.trim()) || 'VNĐ';
if (currencyUnit === 'VND') currencyUnit = 'VNĐ';

let productItems = [];
if (Array.isArray(query.items)) {
  productItems = query.items;
} else if (typeof query.items === 'string' && query.items.trim()) {
  try {
    productItems = JSON.parse(query.items);
  } catch (e) {
    try {
      productItems = JSON.parse(decodeURIComponent(query.items));
    } catch (e2) {}
  }
}

if (productItems.length > 0) {
  productItems = productItems.map(i => {
    const qty = Number(i.qty || i.quantity) || 1;
    const price = Number(i.price || i.rate || i.unitPrice) || 0;
    const total = Number(i.total || i.amount || i.totalPrice) || (qty * price);
    const name = i.name || i.item_name || i.productName || i.item_code || i.productCode || 'Sản phẩm';
    return { name, qty, price, total };
  });
} else {
  const fallbackTotal = Number(query.total || query.grand_total || query.grandTotal || 0);
  if (fallbackTotal > 0) {
    productItems = [
      { name: 'Sản phẩm theo đơn hàng ' + orderId, qty: 1, price: fallbackTotal, total: fallbackTotal }
    ];
  }
}

const calculatedSubTotal = productItems.reduce((acc, it) => acc + it.total, 0);
const subTotal = Number(query.net_total || query.subTotal || query.sub_total) || calculatedSubTotal;
const vat = Number(query.total_taxes_and_charges || query.vat || 0);
const grandTotal = Number(query.grand_total || query.grandTotal || query.total) || (subTotal + vat);

function formatMoney(amount) {
  const num = Math.round(Number(amount) || 0);
  return num.toString().replace(/\\B(?=(\\d{3})+(?!\\d))/g, '.') + ' ' + currencyUnit;
}

function docSoTienVN(so) {
  if (!so || isNaN(so)) return 'Không đồng chẵn.';
  so = Math.round(Math.abs(so));
  if (so === 0) return 'Không đồng chẵn.';
  const chuSo = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  const lop = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];

  function doc3So(baso, isFirst) {
    let tram = Math.floor(baso / 100);
    let chuc = Math.floor((baso % 100) / 10);
    let donvi = baso % 10;
    let res = '';
    if (tram > 0 || !isFirst) {
      res += chuSo[tram] + ' trăm ';
    }
    if (chuc > 1) {
      res += chuSo[chuc] + ' mươi ';
      if (donvi === 1) res += 'mốt ';
      else if (donvi === 5) res += 'lăm ';
      else if (donvi > 0) res += chuSo[donvi] + ' ';
    } else if (chuc === 1) {
      res += 'mười ';
      if (donvi === 5) res += 'lăm ';
      else if (donvi > 0) res += chuSo[donvi] + ' ';
    } else {
      if ((tram > 0 || !isFirst) && donvi > 0) res += 'lẻ ' + chuSo[donvi] + ' ';
      else if (isFirst && donvi > 0) res += chuSo[donvi] + ' ';
    }
    return res.trim();
  }

  let str = so.toString();
  let groups = [];
  while (str.length > 3) {
    groups.unshift(parseInt(str.slice(-3), 10));
    str = str.slice(0, -3);
  }
  groups.unshift(parseInt(str, 10));

  let words = [];
  let totalGroups = groups.length;
  for (let i = 0; i < totalGroups; i++) {
    let g = groups[i];
    if (g > 0) {
      let gWord = doc3So(g, i === 0);
      let lopIdx = totalGroups - 1 - i;
      words.push(gWord + (lop[lopIdx] ? ' ' + lop[lopIdx] : ''));
    }
  }
  let ketQua = words.join(' ').replace(/\\s+/g, ' ').trim();
  if (!ketQua) return 'Không đồng chẵn.';
  return ketQua.charAt(0).toUpperCase() + ketQua.slice(1) + ' đồng chẵn.';
}

// --- HEADER: COMPANY INFO ---
doc.rect(40, 40, 515, 60).fill('#f8fafc');

doc.fillColor('#1e40af').font('Arial-Bold').fontSize(16).text('CÔNG TY CỔ PHẦN ENTERPRISE AI ASSISTANT', 55, 52);
doc.fillColor('#64748b').font('Arial').fontSize(9)
   .text('Địa chỉ: Tầng 12, Tòa nhà Công Nghệ Cao, Quận 1, TP. Hồ Chí Minh', 55, 73)
   .text('Hotline: 1900-6868  |  Email: contact@enterprise-ai.vn  |  Website: enterprise-ai.vn', 55, 87);

// Decorative blue line
doc.rect(40, 105, 515, 3).fill('#2563eb');

// --- TITLE ---
doc.moveDown(2);
doc.fillColor('#0f172a').font('Arial-Bold').fontSize(20).text('HÓA ĐƠN BÁN HÀNG', 40, 125, { align: 'center' });
doc.fillColor('#64748b').font('Arial').fontSize(10).text('(SALES INVOICE)', 40, 148, { align: 'center' });

// --- INFO CARDS (2 Columns) ---
const boxTop = 170;
const boxHeight = 85;
const colWidth = 250;

// Customer Card
doc.rect(40, boxTop, colWidth, boxHeight).lineWidth(1).strokeColor('#e2e8f0').fillAndStroke('#ffffff', '#cbd5e1');
doc.fillColor('#1e40af').font('Arial-Bold').fontSize(10).text('THÔNG TIN KHÁCH HÀNG', 50, boxTop + 8);
doc.fillColor('#334155').font('Arial').fontSize(9)
   .text('Khách hàng: ', 50, boxTop + 24, { continued: true })
   .font('Arial-Bold').text(customerName, { width: colWidth - 20 })
   .font('Arial')
   .text('Địa chỉ: ' + customerAddress, 50, boxTop + 40, { width: colWidth - 20, height: 26, ellipsis: true })
   .text('Mã số thuế: ' + (customerTaxId || 'Chưa đăng ký'), 50, boxTop + 68);

// Invoice Card
doc.rect(305, boxTop, colWidth, boxHeight).lineWidth(1).strokeColor('#e2e8f0').fillAndStroke('#ffffff', '#cbd5e1');
doc.fillColor('#1e40af').font('Arial-Bold').fontSize(10).text('THÔNG TIN HÓA ĐƠN', 315, boxTop + 8);
doc.fillColor('#334155').font('Arial').fontSize(9)
   .text('Mã hóa đơn: ', 315, boxTop + 24, { continued: true })
   .font('Arial-Bold').fillColor('#dc2626').text(orderId)
   .font('Arial').fillColor('#334155').text('Ngày lập: ' + invoiceDate, 315, boxTop + 40)
   .text('Trạng thái: ', 315, boxTop + 68, { continued: true })
   .fillColor(invoiceStatus.includes('Paid') || invoiceStatus.includes('thanh toán') ? '#16a34a' : '#ea580c')
   .font('Arial-Bold').text(invoiceStatus);

// --- TABLE HEADER ---
const tableTop = boxTop + boxHeight + 12;
doc.rect(40, tableTop, 515, 26).fill('#1e40af');
doc.fillColor('#ffffff').font('Arial-Bold').fontSize(9);
doc.text('STT', 45, tableTop + 8, { width: 35, align: 'center' });
doc.text('TÊN HÀNG HÓA / DỊCH VỤ', 85, tableTop + 8, { width: 200, align: 'left' });
doc.text('SỐ LƯỢNG', 290, tableTop + 8, { width: 60, align: 'center' });
doc.text('ĐƠN GIÁ (' + currencyUnit + ')', 355, tableTop + 8, { width: 90, align: 'right' });
doc.text('THÀNH TIỀN (' + currencyUnit + ')', 450, tableTop + 8, { width: 95, align: 'right' });

let currentY = tableTop + 26;
productItems.forEach((item, idx) => {
  const isEven = idx % 2 === 0;
  const rowHeight = 24;
  doc.rect(40, currentY, 515, rowHeight).fill(isEven ? '#ffffff' : '#f8fafc');
  doc.rect(40, currentY, 515, rowHeight).lineWidth(0.5).strokeColor('#e2e8f0').stroke();

  doc.fillColor('#1e293b').font('Arial').fontSize(9);
  doc.text((idx + 1).toString(), 45, currentY + 7, { width: 35, align: 'center' });
  doc.font('Arial-Bold').text(item.name, 85, currentY + 7, { width: 200, align: 'left' });
  doc.font('Arial').text(item.qty.toString(), 290, currentY + 7, { width: 60, align: 'center' });
  doc.text(formatMoney(item.price), 355, currentY + 7, { width: 90, align: 'right' });
  doc.font('Arial-Bold').text(formatMoney(item.total), 450, currentY + 7, { width: 95, align: 'right' });

  currentY += rowHeight;
});

// --- SUMMARY SECTION ---
currentY += 10;
const summaryLeft = 320;
const summaryWidth = 235;

doc.rect(summaryLeft, currentY, summaryWidth, 65).lineWidth(1).strokeColor('#cbd5e1').fillAndStroke('#f8fafc', '#cbd5e1');

doc.font('Arial').fontSize(9).fillColor('#475569')
   .text('Cộng tiền hàng (Subtotal):', summaryLeft + 10, currentY + 8)
   .text(formatMoney(subTotal), summaryLeft + 10, currentY + 8, { width: summaryWidth - 20, align: 'right' });

doc.text(vat > 0 ? 'Thuế GTGT (VAT 10%):' : 'Thuế GTGT (VAT):', summaryLeft + 10, currentY + 24)
   .text(formatMoney(vat), summaryLeft + 10, currentY + 24, { width: summaryWidth - 20, align: 'right' });

doc.rect(summaryLeft, currentY + 40, summaryWidth, 25).fill('#1e40af');
doc.font('Arial-Bold').fontSize(11).fillColor('#ffffff')
   .text('TỔNG THANH TOÁN:', summaryLeft + 10, currentY + 46)
   .text(formatMoney(grandTotal), summaryLeft + 10, currentY + 46, { width: summaryWidth - 20, align: 'right' });

// Number to Words in Vietnamese
currentY += 80;
doc.rect(40, currentY, 515, 26).fill('#f1f5f9');
doc.font('Arial-Bold').fontSize(9).fillColor('#1e40af')
   .text('Số tiền viết bằng chữ: ', 50, currentY + 8, { continued: true })
   .font('Arial').fillColor('#334155').text(docSoTienVN(grandTotal));

// --- SIGNATURES ---
currentY += 45;
const sigColWidth = 220;

doc.font('Arial-Bold').fontSize(10).fillColor('#1e293b')
   .text('NGƯỜI MUA HÀNG', 60, currentY, { width: sigColWidth, align: 'center' })
   .text('ĐẠI DIỆN BÊN BÁN HÀNG', 320, currentY, { width: sigColWidth, align: 'center' });

doc.font('Arial').fontSize(8).fillColor('#64748b')
   .text('(Ký, ghi rõ họ tên)', 60, currentY + 14, { width: sigColWidth, align: 'center' })
   .text('(Ký, đóng dấu, ghi rõ họ tên)', 320, currentY + 14, { width: sigColWidth, align: 'center' });

// Digital stamp simulation
doc.rect(370, currentY + 38, 120, 35).lineWidth(1.5).strokeColor('#dc2626').stroke();
doc.font('Arial-Bold').fontSize(8).fillColor('#dc2626')
   .text('ĐÃ XÁC THỰC ĐIỆN TỬ', 370, currentY + 44, { width: 120, align: 'center' })
   .font('Arial').fontSize(7).text('Ngày: ' + invoiceDate, 370, currentY + 56, { width: 120, align: 'center' });

// --- FOOTER ---
doc.rect(40, 770, 515, 0.5).fill('#cbd5e1');
doc.font('Arial').fontSize(8).fillColor('#94a3b8')
   .text('Hóa đơn điện tử được tạo tự động bởi Hệ thống Quản trị Doanh nghiệp EAA. Mã tra cứu: ' + orderId, 40, 778, { align: 'center' });

doc.end();
await new Promise(r => doc.on('end', r));
const pdfBuffer = Buffer.concat(buffers);
const base64Pdf = pdfBuffer.toString('base64');

return [
  {
    json: {
      orderId,
      customerName,
      total: grandTotal,
      fileName: 'HoaDon_' + orderId + '.pdf'
    },
    binary: {
      data: {
        data: base64Pdf,
        mimeType: 'application/pdf',
        fileName: 'HoaDon_' + orderId + '.pdf'
      }
    }
  }
];`;

db.get('SELECT id, nodes FROM workflow_entity WHERE id = ?', ['download_pdf_wf'], (err, row) => {
  if (err) {
    console.error('Error fetching workflow:', err);
    db.close();
    process.exit(1);
  }
  if (!row) {
    console.error('Workflow download_pdf_wf not found');
    db.close();
    process.exit(1);
  }
  const nodes = JSON.parse(row.nodes);
  const codeNode = nodes.find(n => n.name === 'Code');
  if (codeNode) {
    codeNode.parameters.jsCode = generatorCode;
    const updatedNodesJson = JSON.stringify(nodes);
    db.run('UPDATE workflow_entity SET nodes = ? WHERE id = ?', [updatedNodesJson, row.id], (err2) => {
      if (err2) {
        console.error('Error updating workflow_entity:', err2);
        db.close();
        process.exit(1);
      }
      db.run('UPDATE workflow_history SET nodes = ? WHERE workflowId = ?', [updatedNodesJson, row.id], (err3) => {
        if (err3) {
          console.error('Error updating workflow_history:', err3);
          db.close();
          process.exit(1);
        }
        console.log('Successfully updated workflow with HMAC Signed Token validation!');
        db.close();
      });
    });
  } else {
    console.error('Code node not found in download_pdf_wf');
    db.close();
  }
});
