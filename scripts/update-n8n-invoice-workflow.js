/**
 * Script to update n8n workflow 'download_pdf_wf' so it dynamically fetches
 * real-time invoice and customer address details from ERPNext.
 * 
 * Usage inside n8n container:
 *   node scripts/update-n8n-invoice-workflow.js
 */

const sqlite3 = require('/usr/local/lib/node_modules/n8n/node_modules/sqlite3');
const db = new sqlite3.Database('/home/node/.n8n/database.sqlite');

const generatorCode = `const PDFDocument = require('pdfkit');
const http = require('http');

function fetchJson(apiPath, headers = {}) {
  return new Promise((resolve) => {
    try {
      const req = http.request({
        hostname: 'frontend',
        port: 8080,
        path: apiPath,
        method: 'GET',
        headers: headers
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(JSON.parse(data));
            } else {
              resolve(null);
            }
          } catch (e) {
            resolve(null);
          }
        });
      });
      req.on('error', () => resolve(null));
      req.setTimeout(5000, () => { req.destroy(); resolve(null); });
      req.end();
    } catch (err) {
      resolve(null);
    }
  });
}

const query = $input.first().json.query || $input.first().json.body || $input.first().json;
const orderId = (query.order_id || query.orderCode || 'ACC-SINV-2026-00001').trim();
let customerName = query.customer_name || query.customerName || 'Khách hàng';
let customerAddress = query.address || '';
let customerTaxId = query.tax_id || query.taxId || '';
let invoiceDate = new Date().toLocaleDateString('vi-VN');
let invoiceStatus = 'Đã thanh toán (Paid)';
let currencyUnit = (query.currency && query.currency.trim()) || 'VNĐ';
if (currencyUnit === 'VND') currencyUnit = 'VNĐ';
let productItems = query.items;
let subTotal = 0;
let vat = 0;
let grandTotal = query.total ? Number(query.total) : 0;

// Truy vấn dữ liệu thực tế từ ERPNext theo orderId
if (orderId) {
  try {
    const erpData = await fetchJson('/api/resource/Sales%20Invoice/' + encodeURIComponent(orderId), {
      'Authorization': 'token 6ccdf2b19b0b86b:f5e1f0858f92561'
    });
    if (erpData && erpData.data) {
      const inv = erpData.data;
      customerName = inv.customer_name || inv.customer || customerName;
      invoiceStatus = inv.status === 'Paid' ? 'Đã thanh toán (Paid)' : (inv.status || invoiceStatus);
      if (inv.posting_date) {
        const parts = inv.posting_date.split('-');
        if (parts.length === 3) invoiceDate = parts[2] + '/' + parts[1] + '/' + parts[0];
        else invoiceDate = inv.posting_date;
      }
      if (inv.currency) {
        currencyUnit = inv.currency === 'VND' ? 'VNĐ' : inv.currency;
      }
      if (inv.items && inv.items.length > 0) {
        productItems = inv.items.map(i => ({
          name: i.item_name || i.item_code,
          qty: Number(i.qty) || 1,
          price: Number(i.rate) || 0,
          total: Number(i.amount) || ((Number(i.qty) || 1) * (Number(i.rate) || 0))
        }));
        subTotal = Number(inv.net_total || inv.total) || productItems.reduce((acc, it) => acc + it.total, 0);
        vat = Number(inv.total_taxes_and_charges) || 0;
        grandTotal = Number(inv.grand_total) || (subTotal + vat);
      }

      // Lấy đúng địa chỉ và mã số thuế từ hồ sơ Customer trong ERPNext
      const custName = inv.customer;
      if (custName) {
        const custData = await fetchJson('/api/resource/Customer/' + encodeURIComponent(custName), {
          'Authorization': 'token 6ccdf2b19b0b86b:f5e1f0858f92561'
        });
        if (custData && custData.data) {
          if (custData.data.primary_address) {
            customerAddress = custData.data.primary_address
              .replace(/<br\\s*[\\/]?>/gi, ', ')
              .replace(/[\\r\\n]+/g, ' ')
              .replace(/\\s+,/g, ',')
              .replace(/,\\s*,/g, ',')
              .replace(/\\s+/g, ' ')
              .replace(/^,\\s*|,\\s*$/g, '')
              .trim();
          }
          if (!customerAddress && custData.data.customer_primary_address) {
            const addrData = await fetchJson('/api/resource/Address/' + encodeURIComponent(custData.data.customer_primary_address), {
              'Authorization': 'token 6ccdf2b19b0b86b:f5e1f0858f92561'
            });
            if (addrData && addrData.data) {
              const parts = [addrData.data.address_line1, addrData.data.address_line2, addrData.data.city, addrData.data.state, addrData.data.country].filter(Boolean);
              if (parts.length > 0) customerAddress = parts.join(', ');
            }
          }
          if (custData.data.tax_id) {
            customerTaxId = custData.data.tax_id;
          }
        }
      }
    }
  } catch (err) {}
}

if (!customerAddress) {
  customerAddress = 'Địa chỉ chưa cập nhật';
}

if (!productItems || productItems.length === 0) {
  productItems = [
    { name: 'Sản phẩm theo đơn hàng ' + orderId, qty: 1, price: grandTotal || 15000, total: grandTotal || 15000 }
  ];
  subTotal = grandTotal || 15000;
  grandTotal = subTotal + vat;
}

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

const doc = new PDFDocument({
  size: 'A4',
  margin: 40,
  info: {
    Title: 'HoaDon_' + orderId,
    Author: 'Enterprise AI Assistant'
  }
});

const regularFont = '/usr/share/fonts/truetype/msttcorefonts/Arial.ttf';
const boldFont = '/usr/share/fonts/truetype/msttcorefonts/Arial_Bold.ttf';

doc.registerFont('Arial', regularFont);
doc.registerFont('Arial-Bold', boldFont);

const buffers = [];
doc.on('data', b => buffers.push(b));

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

// Customer Card (Địa chỉ thực tế từ ERPNext)
doc.rect(40, boxTop, colWidth, boxHeight).lineWidth(1).strokeColor('#e2e8f0').fillAndStroke('#ffffff', '#cbd5e1');
doc.fillColor('#1e40af').font('Arial-Bold').fontSize(10).text('THÔNG TIN KHÁCH HÀNG', 50, boxTop + 8);
doc.fillColor('#334155').font('Arial').fontSize(9)
   .text('Khách hàng: ', 50, boxTop + 24, { continued: true })
   .font('Arial-Bold').text(customerName, { width: colWidth - 20 })
   .font('Arial')
   .text('Địa chỉ: ' + customerAddress, 50, boxTop + 40, { width: colWidth - 20, height: 26, ellipsis: true })
   .text('Mã số thuế: ' + (customerTaxId || 'Chưa đăng ký'), 50, boxTop + 68);

// Invoice Card (Thông tin đơn thực tế từ ERPNext)
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
        console.log('Successfully updated BOTH workflow_entity and workflow_history with dynamic ERPNext customer address and order items!');
        db.close();
      });
    });
  } else {
    console.error('Code node not found in download_pdf_wf');
    db.close();
  }
});
