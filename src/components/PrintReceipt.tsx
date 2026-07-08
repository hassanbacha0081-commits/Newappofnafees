import React, { forwardRef, useState, useEffect } from 'react';
import { Sale, Order, Repair, KarigarRecord, StockItem, GoldPurchase, db } from '../db';
import { formatDate } from '../lib/utils';
import { translations } from '../translations';

const WHATSAPP_ICON = "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22448%22%20height%3D%22512%22%20viewBox%3D%220%200%20448%20512%22%3E%3Cpath%20fill%3D%22%2325D366%22%20d%3D%22M380.9%2097.1C339%2055.1%20283.2%2032%20223.9%2032c-122.4%200-222%2099.6-222%20222%200%2039.1%2010.2%2077.3%2029.6%20111L0%20480l117.7-30.9c32.4%2017.7%2068.9%2027%20106.1%2027h.1c122.3%200%20224.1-99.6%20224.1-222%200-59.3-25.2-115-67.1-157zm-157%20341.6c-33.1%200-65.6-8.9-94-25.7l-6.7-4-69.8%2018.3L72%20359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2%200-101.7%2082.8-184.5%20184.6-184.5%2049.3%200%2095.6%2019.2%20130.4%2054.1%2034.8%2034.9%2056.2%2081.2%2056.1%20130.5%200%20101.8-84.9%20184.6-186.6%20184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5%202.8-3.7%205.6-14.3%2018-17.6%2021.8-3.2%203.7-6.5%204.2-12%201.4-5.5-2.8-23.4-8.6-44.6-27.6-16.5-14.7-27.6-32.8-30.8-38.4-3.2-5.6-.3-8.6%202.5-11.4%202.5-2.5%205.5-6.5%208.3-9.7%202.8-3.2%203.7-5.5%205.6-9.2%201.9-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7%200-9.7%201.4-14.8%206.9-5.1%205.6-19.4%2019-19.4%2046.3%200%2027.3%2019.9%2053.7%2022.6%2057.4%202.8%203.7%2039.1%2059.7%2094.8%2083.8%2013.3%205.7%2023.7%209.1%2031.7%2011.7%2013.3%204.2%2025.5%203.6%2035.1%202.2%2010.7-1.6%2032.8-13.4%2037.4-26.4%204.6-13%204.6-24.1%203.2-26.4-1.3-2.5-5-3.9-10.5-6.6z%22%20%2F%3E%3C%2Fsvg%3E";

interface PrintReceiptProps {
  type: 'sale' | 'order' | 'repair' | 'karigar' | 'stock' | 'purchase';
  data: Sale | Order | Repair | KarigarRecord | StockItem | GoldPurchase;
  id?: number;
}

export const PrintReceipt = forwardRef<HTMLDivElement, PrintReceiptProps>(({ type, data, id }, ref) => {
  const [shopSettings, setShopSettings] = useState({
    name: translations.ur.shopName,
    address: translations.ur.shopAddress,
    phone: translations.ur.shopPhone,
    phone2: translations.ur.shopPhone2
  });

  useEffect(() => {
    const fetchSettings = async () => {
      const name = await db.settings.get('shopName');
      const address = await db.settings.get('shopAddress');
      const phone = await db.settings.get('shopPhone');
      const phone2 = await db.settings.get('shopPhone2');
      
      setShopSettings({
        name: name?.value || translations.ur.shopName,
        address: address?.value || translations.ur.shopAddress,
        phone: phone?.value || translations.ur.shopPhone,
        phone2: phone2?.value || translations.ur.shopPhone2
      });
    };
    fetchSettings();
  }, []);

  const isPurchase = type === 'purchase';
  const widthStr = isPurchase ? '21cm' : '14.8cm';
  const heightStr = isPurchase ? '29.7cm' : '21cm';

  const printStyles = (
    <style>
      {`
        @import url('https://fonts.cdnfonts.com/css/jameel-noori-nastaleeq');
        @import url('https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;700&family=Inter:wght@400;700&display=swap');
        
        @media print {
          @page {
            size: ${isPurchase ? 'A4' : 'A5'};
            margin: 0;
          }
          body {
            margin: 0;
            -webkit-print-color-adjust: exact;
            background: white !important;
          }
          .print-receipt-container {
            width: 100% !important;
            min-height: 100vh !important;
            height: auto !important;
            overflow: visible !important;
            margin: 0 auto !important;
            padding: ${isPurchase ? '0.5cm 0.8cm 0.8cm 0.8cm' : '0.4cm 0.6cm 0.6cm 0.6cm'} !important;
            box-sizing: border-box !important;
            background: white !important;
            position: relative !important;
          }
        }
        .print-receipt-container {
          box-sizing: border-box !important;
          position: relative !important;
        }
        .receipt-border-decor {
          position: absolute !important;
          top: 12px !important;
          bottom: 12px !important;
          left: 12px !important;
          right: 12px !important;
          border: 4px double #b8860b !important;
          outline: 1px solid #b8860b !important;
          outline-offset: -6px !important;
          border-radius: 6px !important;
          pointer-events: none !important;
          z-index: 99 !important;
        }
        .urdu-text {
          font-family: 'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif !important;
          line-height: 1.6;
        }
        .header-section {
          text-align: center;
          border-bottom: 3px double #b8860b;
          padding-bottom: ${isPurchase ? '10px' : '6px'};
          margin-bottom: ${isPurchase ? '20px' : '10px'};
          padding-top: 50px;
          
        }
        .shop-name {
          font-size: ${isPurchase ? '91px' : '74px'};
          font-weight: 900;
          color: #b8860b;
          margin: 0;
          margin-bottom: ${isPurchase ? '12px' : '6px'};
          font-family: 'Jameel Noori Nastaleeq', serif !important;
          line-height: 1.2;
        }
        .header-phone {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 10px;
          margin-top: ${isPurchase ? '10px' : '6px'};
          width: 100%;
          flex-wrap: wrap;
        }
        .phone-brand-box, .phone-brand-box-secondary {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          background: #f0fdf4;
          padding: ${isPurchase ? '6px 12px' : '4px 8px'};
          border-radius: 4px;
          border: 1.2px solid #22c55e;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
          line-height: normal;
        }
        .phone-brand-box-secondary {
          background: #fffafa;
          border-color: #b8860b;
        }
        .brand-icon {
          width: ${isPurchase ? '26px' : '20px'};
          height: ${isPurchase ? '26px' : '20px'};
          object-fit: contain;
          display: block;
        }
        .phone-number {
          color: #166534;
          font-weight: 900;
          font-size: ${isPurchase ? '20px' : '15px'};
          letter-spacing: 0.5px;
          font-family: 'Inter', sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .phone2-container {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: ${isPurchase ? '24px' : '18px'};
          font-weight: 900;
          color: #b8860b;
        }
        .receipt-footer {
          margin-top: ${isPurchase ? '50px' : '20px'};
          
          border-top: 1px solid #eee;
          text-align: center;
        }
        .footer-brand-box {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 15px;
          margin-top: 10px;
          opacity: 0.8;
        }
        .footer-icon {
          width: 24px;
          height: 24px;
          object-fit: contain;
        }
        .info-bar {
          display: flex;
          justify-content: space-between;
          margin-bottom: 20px;
          background: #f8fafc;
          padding: 18px;
          border: 1.5px solid #e2e8f0;
          font-size: 16px;
          border-radius: 8px;
        }
        .receipt-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: ${isPurchase ? '25px' : '12px'};
          border: 1.5px solid #ddd;
          background: white;
        }
        .receipt-table tr:nth-child(even) {
          background-color: #fcfcfc;
        }
        .receipt-table th {
          background: #b8860b !important;
          background-color: #b8860b !important;
          color: white !important;
          padding: ${isPurchase ? '12px' : '10px'};
          text-align: center;
          vertical-align: middle;
          border: 1px solid #ddd;
          font-size: ${isPurchase ? '18px' : '16px'};
          font-weight: bold;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          line-height: 1.6;
        }
        .receipt-table td {
          padding: ${isPurchase ? '8px 12px' : '6px 10px'};
          text-align: right;
          vertical-align: middle;
          border: 1px solid #ddd;
          font-size: ${isPurchase ? '16px' : '14px'};
          color: #333;
          line-height: 1.6;
        }
        .summary-table {
          width: ${isPurchase ? '320px' : '260px'};
          border: 2.5px solid #b8860b;
          border-radius: 12px;
          background: #fffcf5;
          margin-bottom: ${isPurchase ? '20px' : '10px'};
          padding-top: 50px;
          border-collapse: separate;
          border-spacing: 0;
          overflow: hidden;
        }
        .summary-table th, .summary-table td {
          border: none;
          padding: ${isPurchase ? '10px 15px' : '6px 10px'};
        }
        .summary-table th {
          background: transparent !important;
          color: #333 !important;
          text-align: right;
          font-weight: normal;
          width: 50%;
        }
        .summary-table td {
          text-align: right;
          font-weight: bold;
          width: 50%;
        }
        .final-total-row {
          border-top: 2px solid #b8860b !important;
          font-size: ${isPurchase ? '22px' : '18px'} !important;
          color: #c62828 !important;
        }

        .terms {
          clear: both;
          margin-top: ${isPurchase ? '40px' : '15px'};
          font-size: ${isPurchase ? '12.5px' : '10.5px'};
          border-top: 1px solid #ccc;
          padding-top: ${isPurchase ? '15px' : '8px'};
          line-height: ${isPurchase ? '1.8' : '1.5'};
        }

        .font-nastaliq {
          font-family: 'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif !important;
          line-height: 1.6;
        }
        .info-grid {
          display: grid;
          grid-template-cols: 1fr 1fr;
          gap: 15px;
          margin-bottom: 20px;
          padding: 15px;
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          font-size: 12px;
        }
      `}
    </style>
  );

  if (type === 'sale') {
    const sale = data as Sale;
    const oldGoldDeduction = Math.round(sale.items.reduce((a, b) => a + (b.t < 0 ? Math.abs(b.t) : 0), 0));
    const totalBill = sale.total + oldGoldDeduction;

    return (
      <div ref={ref} className="print-receipt-container bg-white text-zinc-900" dir="rtl" style={{ 
        fontFamily: "'Inter', sans-serif", 
        width: isPurchase ? '21cm' : '14.8cm',
        minHeight: isPurchase ? '29.7cm' : '21cm', 
        height: 'auto', 
        boxSizing: 'border-box', 
        position: 'relative', 
        padding: '0.5cm 1cm 1cm 1cm',
        paddingBottom: '2cm',
        backgroundColor: 'white'
      }}>
        {printStyles}
        <div className="receipt-border-decor" />
        <div className="header-section">
          <h1 className="shop-name text-center" style={{ width: '100%', display: 'block' }}>{shopSettings.name}</h1>
          <div style={{ height: '15px' }}></div>
          <p className="text-2xl font-bold m-1 font-nastaliq">ہمارے ہاں سنگاپور اور دبئی ورائٹی دستیاب ہے۔</p>
          <p className="text-lg m-1 font-nastaliq text-zinc-600">{shopSettings.address}</p>
          <div className="header-phone" dir="ltr">
            <div className="phone-brand-box">
              <img src={WHATSAPP_ICON} className="brand-icon" alt="WhatsApp" />
              <span className="phone-number">{shopSettings.phone}</span>
            </div>
            {shopSettings.phone2 && (
              <div className="phone-brand-box-secondary">
                <img src={WHATSAPP_ICON} className="brand-icon" alt="WhatsApp" />
                <span className="phone-number" style={{ color: '#b8860b' }}>{shopSettings.phone2}</span>
              </div>
            )}
          </div>
        </div>

          <table className="receipt-table" style={{ marginBottom: '20px' }}>
            <tbody>
              <tr>
                <th className="font-nastaliq" style={{ width: '15%', background: '#b8860b', color: 'white' }}>کسٹمر</th>
                <td className="font-nastaliq" style={{ width: '35%', paddingRight: '15px' }}>{sale.name}</td>
                <th className="font-nastaliq" style={{ width: '15%', background: '#b8860b', color: 'white' }}>موبائل</th>
                <td className="font-mono" style={{ width: '35%' }} dir="ltr">{sale.phone}</td>
              </tr>
              <tr>
                <th className="font-nastaliq" style={{ background: '#b8860b', color: 'white' }}>تاریخ</th>
                <td>{sale.date}</td>
                <th className="font-nastaliq" style={{ background: '#b8860b', color: 'white' }}>بل نمبر</th>
                <td className="font-bold text-gold">#{1000 + (id || 0)}</td>
              </tr>
              <tr>
                <th className="font-nastaliq" style={{ background: '#b8860b', color: 'white' }}>فی تولہ</th>
                <td className="font-mono">{sale.items[0]?.r ? (sale.items[0].r * 12).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '-'}</td>
                <th className="font-nastaliq" style={{ background: '#b8860b', color: 'white' }}>فی گرام</th>
                <td className="font-mono">{sale.items[0]?.r ? sale.items[0].r.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>
              </tr>
            </tbody>
          </table>

          <table className="receipt-table" style={{ tableLayout: 'fixed', width: '100%' }}>
            <thead>
              <tr style={{ background: '#b8860b' }}>
                <th className="font-nastaliq" style={{ width: '20%', background: '#b8860b', color: 'white' }}>تفصیل</th>
                <th className="font-nastaliq" style={{ width: '8%', background: '#b8860b', color: 'white' }}>تعداد</th>
                <th className="font-nastaliq" style={{ width: '12%', background: '#b8860b', color: 'white' }}>وزن</th>
                <th className="font-nastaliq" style={{ width: '10%', background: '#b8860b', color: 'white' }}>پالش</th>
                <th className="font-nastaliq" style={{ width: '14%', background: '#b8860b', color: 'white' }}>کل وزن</th>
                <th className="font-nastaliq" style={{ width: '18%', background: '#b8860b', color: 'white' }}>کل قیمت</th>
                <th className="font-nastaliq" style={{ width: '18%', background: '#b8860b', color: 'white' }}>تصویر</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((item, i) => (
                <tr key={i}>
                  <td className="text-right font-bold font-nastaliq" style={{ paddingRight: '15px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.n}</td>
                  <td className="font-mono">{item.t < 0 ? '-' : (item.p || 1)}</td>
                  <td className="font-mono font-bold">{parseFloat(Number(item.w).toFixed(2))}g</td>
                  <td className="font-mono">{parseFloat(Number(item.mk).toFixed(2))}g</td>
                  <td className="font-mono font-bold">{parseFloat(Number(item.w + item.mk).toFixed(2))}g</td>
                  <td className="font-bold font-mono">{Math.round(item.t).toLocaleString()}</td>
                  <td style={{ padding: '8px', verticalAlign: 'middle' }}>
                    {item.img ? (
                      <img 
                        src={item.img} 
                        alt="" 
                        style={{ height: '85px', maxHeight: '85px', width: 'auto', maxWidth: '100%', objectFit: 'contain', margin: '0 auto' }} 
                        className="rounded border border-zinc-200 shadow-sm"
                      />
                    ) : (
                      <span className="text-zinc-300">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-start mt-4">
            <table className="summary-table" style={{ marginLeft: 'auto' }}>
              <tbody>
                <tr>
                  <th className="font-nastaliq">کل بل رقم</th>
                  <td className="font-mono">{totalBill.toLocaleString()}</td>
                </tr>
                <tr className="text-red-700">
                  <th className="font-nastaliq">پرانا سونا منہا (-)</th>
                  <td className="font-mono">{oldGoldDeduction.toLocaleString()}</td>
                </tr>
                <tr className="text-green-700">
                  <th className="font-nastaliq">وصول شدہ رقم</th>
                  <td className="font-mono">{sale.rec.toLocaleString()}</td>
                </tr>
                <tr className="final-total-row">
                  <th className="font-nastaliq font-black">صاف بقایا</th>
                  <td className="font-black font-mono">{sale.rem.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="terms font-nastaliq" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', direction: 'rtl', marginTop: '15px' }}>
            <div style={{ flex: 1, textAlign: 'right' }}>
              <b>شرائط و ضوابط:</b><br />
              1۔ زیورات کی واپسی پر 25% کاٹ لیا جائے گا۔<br />
              2۔ کسٹمر اپنا تیار سامان 1 ہفتہ کے اندر وصول کرنے کا پابند ہوگا۔<br />
              3۔ تیار شدہ سامان چھوڑنے پر 20% کاٹ لیا جائے گا۔<br />
              4۔ فی تولہ 1 ماشہ پالش کاٹ ہوگا۔<br />
              5۔ آرڈر دیتے وقت 75-80% رقم لازمی دینا ہوگی۔<br />
              6۔ پرانے زیورات توڑ کر نئے زیورات تیار کرنے پر پانسہ 2 ماشہ اور پونڈ پانسہ 3 ماشہ فی تولہ کاٹ لیا جائے گا۔<br />
              7۔ استعمال سے پہلے بینگلز کے وزن کی تسلی کریں، گھس جانے کی وجہ سے بعد میں دکاندار ذمہ دار نہیں ہوگا۔
            </div>

            <div style={{
              width: '110px',
              height: '110px',
              border: '3px double #b8860b',
              borderRadius: '50%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              transform: 'rotate(-10deg)',
              padding: '6px',
              backgroundColor: 'rgba(184, 134, 11, 0.02)',
              boxShadow: '0 0 0 4px rgba(184, 134, 11, 0.05)',
              flexShrink: 0,
              marginLeft: '15px'
            }}>
              <div style={{
                position: 'absolute',
                inset: '4px',
                border: '1px dashed #b8860b',
                borderRadius: '50%'
              }} />
              
              <span style={{ 
                fontSize: '8px', 
                fontWeight: '900', 
                color: '#b8860b', 
                textTransform: 'uppercase', 
                letterSpacing: '0.3px',
                textAlign: 'center',
                lineHeight: '1.1',
                fontFamily: 'sans-serif'
              }}>{shopSettings.name}</span>
              
              <div style={{ 
                width: '16px', 
                height: '16px', 
                backgroundColor: '#b8860b', 
                borderRadius: '50%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: 'white',
                fontSize: '9px',
                fontWeight: 'bold',
                margin: '2px 0'
              }}>✓</div>
              
              <span style={{ 
                fontSize: '8px', 
                fontWeight: 'bold', 
                color: '#b8860b', 
                letterSpacing: '1px',
                textAlign: 'center',
                lineHeight: '1',
                fontFamily: 'sans-serif'
              }}>VERIFIED</span>
              
              <span className="urdu-text" style={{ 
                fontSize: '11px', 
                color: '#996515', 
                lineHeight: '1',
                marginTop: '1px',
                fontWeight: 'bold'
              }}>تصدیق شدہ</span>
            </div>
          </div>
          
          <div className="receipt-footer">
          </div>
        </div>
    );
  }

    if (type === 'order') {
      const order = data as Order;
      return (
        <div ref={ref} className="print-receipt-container bg-white text-zinc-900" dir="rtl" style={{ 
          fontFamily: "'Inter', sans-serif", 
          width: isPurchase ? '21cm' : '14.8cm',
        minHeight: isPurchase ? '29.7cm' : '21cm', 
          height: 'auto', 
          boxSizing: 'border-box', 
          position: 'relative', 
          padding: '0.4cm 0.6cm 0.6cm 0.6cm',
          paddingBottom: '1.5cm',
          backgroundColor: 'white'
        }}>
          {printStyles}
          <div className="receipt-border-decor" />
          <div className="header-section">
            <h1 className="shop-name text-center" style={{ width: '100%', display: 'block' }}>{shopSettings.name}</h1>
            <div style={{ height: '6px' }}></div>
            <p className="text-xl font-bold m-1 font-nastaliq" style={{ fontSize: '18px' }}>ہمارے ہاں سنگاپور اور دبئی ورائٹی دستیاب ہے۔</p>
            <p className="text-md m-1 font-nastaliq text-zinc-600" style={{ fontSize: '13px' }}>{shopSettings.address}</p>
            <div className="header-phone" dir="ltr">
              <div className="phone-brand-box">
                <img src={WHATSAPP_ICON} className="brand-icon" alt="WhatsApp" />
                <span className="phone-number">{shopSettings.phone}</span>
              </div>
              {shopSettings.phone2 && (
                <div className="phone-brand-box-secondary">
                  <img src={WHATSAPP_ICON} className="brand-icon" alt="WhatsApp" />
                  <span className="phone-number" style={{ color: '#b8860b' }}>{shopSettings.phone2}</span>
                </div>
              )}
            </div>
            <div className="bg-zinc-100 px-3 py-1 mt-2 font-bold rounded-lg text-gold text-base font-nastaliq border border-gold-20 inline-block">آرڈر بکنگ رسید</div>
          </div>

          <table className="receipt-table" style={{ marginBottom: '10px' }}>
            <tbody>
              <tr>
                <th className="font-nastaliq" style={{ width: '18%', background: '#b8860b', color: 'white', padding: '10px' }}>نام کسٹمر</th>
                <td className="font-nastaliq font-bold" style={{ width: '32%', paddingRight: '10px' }}>{order.name}</td>
                <th className="font-nastaliq" style={{ width: '18%', background: '#b8860b', color: 'white', padding: '10px' }}>فون نمبر</th>
                <td className="font-mono" style={{ width: '32%' }} dir="ltr">{order.phone}</td>
              </tr>
              <tr>
                <th className="font-nastaliq" style={{ background: '#b8860b', color: 'white', padding: '10px' }}>تاریخ بکنگ</th>
                <td className="font-mono">{order.date}</td>
                <th className="font-nastaliq" style={{ background: '#b8860b', color: 'white', padding: '10px' }}>تاریخ واپسی</th>
                <td className="font-mono font-bold text-red-600">{order.due}</td>
              </tr>
              <tr>
                <th className="font-nastaliq" style={{ background: '#b8860b', color: 'white', padding: '10px' }}>نام آئٹم</th>
                <td className="font-nastaliq font-bold" style={{ paddingRight: '10px' }}>{order.item}</td>
                <th className="font-nastaliq" style={{ background: '#b8860b', color: 'white', padding: '10px' }}>نام کاریگر</th>
                <td className="font-nastaliq" style={{ paddingRight: '10px' }}>{order.karigar}</td>
              </tr>
              <tr>
                <th className="font-nastaliq" style={{ background: '#b8860b', color: 'white', padding: '10px' }}>پیمائش</th>
                <td className="font-mono font-bold">{order.measurements || '-'}</td>
                <th className="font-nastaliq" style={{ background: '#b8860b', color: 'white', padding: '10px' }}>فی تولہ ریٹ</th>
                <td className="font-mono font-bold text-gold">{order.pricePerTola || '-'}</td>
              </tr>
            </tbody>
          </table>

          <div className="mt-2">
            <h4 className="font-bold mb-1 text-xs font-nastaliq text-right text-gold">وزن کی تفصیل:</h4>
            <table className="receipt-table" style={{ tableLayout: 'fixed', width: '100%', marginBottom: '10px' }}>
              <thead>
                <tr style={{ background: '#b8860b' }}>
                  <th className="font-nastaliq" style={{ width: '25%', background: '#b8860b', color: 'white', padding: '10px' }}>پرانا وزن</th>
                  <th className="font-nastaliq" style={{ width: '25%', background: '#b8860b', color: 'white', padding: '10px' }}>وزن / تیار وزن</th>
                  <th className="font-nastaliq" style={{ width: '25%', background: '#b8860b', color: 'white', padding: '10px' }}>پالش</th>
                  <th className="font-nastaliq" style={{ width: '25%', background: '#b8860b', color: 'white', padding: '10px' }}>ٹوٹل وزن</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="font-mono font-bold" style={{ padding: '8px' }}>{order.oldWt ? `${parseFloat(Number(order.oldWt).toFixed(2))}g` : '-'}</td>
                  <td className="font-mono font-bold" style={{ padding: '8px' }}>{order.readyWt ? `${parseFloat(Number(order.readyWt).toFixed(2))}g` : '-'}</td>
                  <td className="font-bold font-nastaliq" style={{ padding: '8px' }}>{order.makingCharges || '-'}</td>
                  <td className="font-mono font-bold" style={{ padding: '8px' }}>{order.totalWt ? `${parseFloat(Number(order.totalWt).toFixed(2))}g` : '-'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {order.img && (
            <div className="mt-2 text-center">
              <p className="font-bold text-xs font-nastaliq mb-1 text-right">تصویر:</p>
              <img src={order.img} alt="" className="max-h-36 mx-auto border border-zinc-200 rounded-lg shadow-sm" style={{ objectFit: 'contain' }} />
            </div>
          )}

          <h4 className="font-bold mt-2 mb-1 text-xs font-nastaliq text-right">ادائیگیوں کی تفصیل:</h4>
          <table className="receipt-table" style={{ tableLayout: 'fixed', width: '100%', marginBottom: '10px' }}>
            <thead>
              <tr style={{ background: '#b8860b' }}>
                <th className="font-nastaliq" style={{ width: '33%', background: '#b8860b', color: 'white', padding: '10px' }}>معطلی نمبر</th>
                <th className="font-nastaliq" style={{ width: '33%', background: '#b8860b', color: 'white', padding: '10px' }}>رقم</th>
                <th className="font-nastaliq" style={{ width: '34%', background: '#b8860b', color: 'white', padding: '10px' }}>تاریخ</th>
              </tr>
            </thead>
            <tbody>
              {order.payments.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-zinc-400 font-nastaliq py-1 text-center text-xs">کوئی ادائیگی نہیں ہوئی</td>
                </tr>
              ) : (
                order.payments.slice(0, 8).map((p, i) => (
                  <tr key={i}>
                    <td className="font-nastaliq" style={{ padding: '6px' }}>قسط {i + 1}</td>
                    <td className="font-mono font-bold" style={{ padding: '6px' }}>{p.amt.toLocaleString()}</td>
                    <td className="font-mono" style={{ padding: '6px' }}>{p.date}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="flex justify-start mt-2">
            <table className="summary-table" style={{ marginLeft: 'auto', marginBottom: '8px' }}>
              <tbody>
                <tr>
                  <td className="font-nastaliq" style={{ padding: '6px' }}>ٹوٹل</td>
                  <td className="font-mono font-bold" style={{ padding: '6px' }}>{order.total?.toLocaleString() || '-'}</td>
                </tr>
                <tr>
                  <td className="font-nastaliq" style={{ padding: '6px' }}>ایڈوانس</td>
                  <td className="font-mono" style={{ padding: '6px' }}>{(order.total - order.rem)?.toLocaleString() || '-'}</td>
                </tr>
                <tr>
                  <td className="font-nastaliq font-bold" style={{ padding: '6px', background: '#f8f9fa' }}>بقایا</td>
                  <td className="font-mono font-bold" style={{ padding: '6px', background: '#f8f9fa' }}>{order.rem?.toLocaleString() || '-'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="terms font-nastaliq" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', direction: 'rtl', marginTop: '10px', fontSize: '10px', paddingTop: '6px' }}>
            <div style={{ flex: 1, textAlign: 'right' }}>
              <b>شرائط و ضوابط:</b><br />
              1۔ زیورات کی واپسی پر 25% کاٹ لیا جائے گا۔<br />
              2۔ کسٹمر اپنا تیار سامان 1 ہفتہ کے اندر وصول کرنے کا پابند ہوگا۔<br />
              3۔ تیار شدہ سامان چھوڑنے پر 20% کاٹ لیا جائے گا۔<br />
              4۔ فی تولہ 1 ماشہ پالش کاٹ ہوگا۔<br />
              5۔ آرڈر دیتے وقت 75-80% رقم لازمی دینا ہوگی۔<br />
              6۔ پرانے زیورات توڑ کر نئے زیورات تیار کرنے پر پانسہ 2 ماشہ اور پونڈ پانسہ 3 ماشہ فی تولہ کاٹ لیا جائے گا۔<br />
              7۔ استعمال سے پہلے بینگلز کے وزن کی تسلی کریں، گھس جانے کی وجہ سے بعد میں دکاندار ذمہ دار نہیں ہوگا۔
            </div>

            <div style={{
              width: '90px',
              height: '90px',
              border: '3px double #b8860b',
              borderRadius: '50%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              transform: 'rotate(-10deg)',
              padding: '4px',
              backgroundColor: 'rgba(184, 134, 11, 0.02)',
              boxShadow: '0 0 0 3px rgba(184, 134, 11, 0.05)',
              flexShrink: 0,
              marginLeft: '15px'
            }}>
              <div style={{
                position: 'absolute',
                inset: '3px',
                border: '1px dashed #b8860b',
                borderRadius: '50%'
              }} />
              
              <span style={{ 
                fontSize: '7px', 
                fontWeight: '900', 
                color: '#b8860b', 
                textTransform: 'uppercase', 
                letterSpacing: '0.2px',
                textAlign: 'center',
                lineHeight: '1.1',
                fontFamily: 'sans-serif'
              }}>{shopSettings.name}</span>
              
              <div style={{ 
                width: '14px', 
                height: '14px', 
                backgroundColor: '#b8860b', 
                borderRadius: '50%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: 'white',
                fontSize: '8px',
                fontWeight: 'bold',
                margin: '1px 0'
              }}>✓</div>
              
              <span style={{ 
                fontSize: '7px', 
                fontWeight: 'bold', 
                color: '#b8860b', 
                letterSpacing: '0.5px',
                textAlign: 'center',
                lineHeight: '1',
                fontFamily: 'sans-serif'
              }}>VERIFIED</span>
              
              <span className="urdu-text" style={{ 
                fontSize: '9px', 
                color: '#996515', 
                lineHeight: '1',
                marginTop: '1px',
                fontWeight: 'bold'
              }}>تصدیق شدہ</span>
            </div>
          </div>
          <div className="receipt-footer">
          </div>
        </div>
    );
  }

    if (type === 'repair') {
      const repair = data as Repair;
      return (
        <div ref={ref} className="print-receipt-container bg-white text-zinc-900" dir="rtl" style={{ 
          fontFamily: "'Inter', sans-serif", 
          width: isPurchase ? '21cm' : '14.8cm',
        minHeight: isPurchase ? '29.7cm' : '21cm', 
          height: 'auto', 
          boxSizing: 'border-box', 
          position: 'relative', 
          padding: '0.5cm 1cm 1cm 1cm',
          paddingBottom: '2.5cm',
          backgroundColor: 'white'
        }}>
          {printStyles}
          <div className="receipt-border-decor" />
          <div className="header-section">
            <h1 className="shop-name text-center" style={{ width: '100%', display: 'block' }}>{shopSettings.name}</h1>
            <div style={{ height: '15px' }}></div>
            <p className="text-2xl font-bold m-1 font-nastaliq">ہمارے ہاں سنگاپور اور دبئی ورائٹی دستیاب ہے۔</p>
            <p className="text-lg m-1 font-nastaliq text-zinc-600">{shopSettings.address}</p>
            <div className="header-phone" dir="ltr">
              <div className="phone-brand-box">
                <img src={WHATSAPP_ICON} className="brand-icon" alt="WhatsApp" />
                <span className="phone-number">{shopSettings.phone}</span>
              </div>
              {shopSettings.phone2 && (
                <div className="phone-brand-box-secondary">
                  <img src={WHATSAPP_ICON} className="brand-icon" alt="WhatsApp" />
                  <span className="phone-number" style={{ color: '#b8860b' }}>{shopSettings.phone2}</span>
                </div>
              )}
            </div>
            <div className="bg-zinc-100 px-3 py-1 mt-4 font-bold rounded-lg text-gold text-lg font-nastaliq border border-gold-20 inline-block">ریپیئرنگ رسید</div>
          </div>

          <table className="receipt-table">
            <tbody>
              <tr>
                <th className="font-nastaliq" style={{ width: '20%' }}>کسٹمر</th>
                <td className="font-bold" style={{ width: '30%' }}>{repair.customerName}</td>
                <th className="font-nastaliq" style={{ width: '20%' }}>تاریخ</th>
                <td className="font-bold" style={{ width: '30%' }} dir="ltr">{formatDate(repair.date, 'ur-PK')}</td>
              </tr>
              <tr>
                <th className="font-nastaliq">فون</th>
                <td className="font-bold" dir="ltr">{repair.customerPhone}</td>
                <th className="font-nastaliq">حالت</th>
                <td className="font-bold">{repair.status === 'Done' ? 'تیار ہے' : 'انتظار'}</td>
              </tr>
            </tbody>
          </table>

          <table className="receipt-table" style={{ marginTop: '20px' }}>
            <tbody>
              <tr>
                <th className="font-nastaliq" style={{ width: '25%', background: '#f9f9f9' }}>آئٹم</th>
                <td className="font-nastaliq" style={{ width: '75%', textAlign: 'right', paddingRight: '15px' }}>{repair.item}</td>
              </tr>
              <tr>
                <th className="font-nastaliq" style={{ background: '#f9f9f9' }}>مسئلہ</th>
                <td className="font-nastaliq" style={{ textAlign: 'right', paddingRight: '15px' }}>{repair.issue}</td>
              </tr>
              <tr className="final-total-row">
                <th className="font-nastaliq font-black">رقم</th>
                <td className="font-bold text-red-700 font-mono" style={{ textAlign: 'right', paddingRight: '15px', fontSize: '20px' }}>{repair.charges.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>

          {repair.img && (
            <div className="mt-4 text-center">
              <img src={repair.img} alt="" className="max-h-48 mx-auto border border-zinc-200 rounded" />
            </div>
          )}

          <p className="mt-10 pt-4 border-t border-zinc-300 text-[14px] font-nastaliq text-zinc-600">* ریپیئرنگ کے دوران کسی بھی قسم کے نقصان کی صورت میں دکان ذمہ دار نہیں ہوگی۔</p>
          
          <div className="receipt-footer">
            <div className="footer-brand-box" dir="ltr">
              <img src={WHATSAPP_ICON} className="footer-icon" alt="WhatsApp" />
              <span className="font-mono text-xs text-zinc-600 font-bold">{shopSettings.phone}</span>
            </div>
            <div className="mt-4 text-[14px] text-zinc-400 italic font-sans">
              Software developed by Nafees Jewellers Management System
            </div>
          </div>
        </div>
    );
  }

    if (type === 'karigar') {
      const karigar = data as KarigarRecord;
      return (
        <div ref={ref} className="print-receipt-container bg-white text-zinc-900" dir="rtl" style={{ 
          fontFamily: "'Inter', sans-serif", 
          width: isPurchase ? '21cm' : '14.8cm',
        minHeight: isPurchase ? '29.7cm' : '21cm', 
          height: 'auto', 
          boxSizing: 'border-box', 
          position: 'relative', 
          padding: '0.5cm 1cm 1cm 1cm',
          paddingBottom: '2.5cm',
          backgroundColor: 'white'
        }}>
          {printStyles}
          <div className="receipt-border-decor" />
          <div className="header-section">
            <h1 className="shop-name text-center" style={{ width: '100%', display: 'block' }}>{shopSettings.name}</h1>
            <div style={{ height: '15px' }}></div>
            <p className="text-2xl font-bold m-1 font-nastaliq">ہمارے ہاں سنگاپور اور دبئی ورائٹی دستیاب ہے۔</p>
            <p className="text-lg m-1 font-nastaliq text-zinc-600">{shopSettings.address}</p>
            <div className="header-phone" dir="ltr">
              <div className="phone-brand-box">
                <img src={WHATSAPP_ICON} className="brand-icon" alt="WhatsApp" />
                <span className="phone-number">{shopSettings.phone}</span>
              </div>
              {shopSettings.phone2 && (
                <div className="phone-brand-box-secondary">
                  <img src={WHATSAPP_ICON} className="brand-icon" alt="WhatsApp" />
                  <span className="phone-number" style={{ color: '#b8860b' }}>{shopSettings.phone2}</span>
                </div>
              )}
            </div>
            <div className="bg-zinc-100 px-3 py-1 mt-4 font-bold rounded-lg text-gold text-lg font-nastaliq border border-gold-20 inline-block">کاریگر رسید</div>
          </div>

          <table className="receipt-table">
            <tbody>
              <tr>
                <th className="font-nastaliq" style={{ width: '25%' }}>کاریگر</th>
                <td className="font-nastaliq" style={{ width: '25%' }}>{karigar.name}</td>
                <th className="font-nastaliq" style={{ width: '25%' }}>تاریخ</th>
                <td className="font-mono" style={{ width: '25%' }}>{karigar.date}</td>
              </tr>
              <tr>
                <th className="font-nastaliq">فون</th>
                <td colSpan={3} className="font-mono" dir="ltr">{karigar.phone}</td>
              </tr>
            </tbody>
          </table>

          <table className="receipt-table" style={{ marginTop: '15px' }}>
            <tbody>
              <tr>
                <th className="font-nastaliq" style={{ width: '25%', background: '#f9f9f9' }}>ٹاسک (Task)</th>
                <td className="font-nastaliq" style={{ width: '75%', textAlign: 'right', paddingRight: '15px' }}>{karigar.task}</td>
              </tr>
            </tbody>
          </table>
          <div className="mt-4">
            <table className="receipt-table">
              <thead>
                <tr>
                  <th className="font-nastaliq" style={{ width: '25%' }}>دیا گیا</th>
                  <th className="font-nastaliq" style={{ width: '25%' }}>وصول</th>
                  <th className="font-nastaliq" style={{ width: '25%' }}>کاٹ</th>
                  <th className="font-nastaliq" style={{ width: '25%' }}>صاف بقایا</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="font-mono">{karigar.given}g</td>
                  <td className="font-mono">{karigar.rec}g</td>
                  <td className="font-mono">{karigar.kaat}g</td>
                  <td className="text-red-600 font-bold font-mono">{karigar.net}g</td>
                </tr>
              </tbody>
            </table>
          </div>

          {karigar.img && (
            <div className="mt-4 text-center">
              <img src={karigar.img} alt="" className="max-h-48 mx-auto border border-zinc-200 rounded" />
            </div>
          )}

          <div className="receipt-footer">
            <div className="footer-brand-box" dir="ltr">
              <img src={WHATSAPP_ICON} className="footer-icon" alt="WhatsApp" />
              <span className="font-mono text-xs text-zinc-600 font-bold">{shopSettings.phone}</span>
            </div>
            <div className="mt-4 text-[14px] text-zinc-400 italic font-sans">
              Software developed by Nafees Jewellers Management System
            </div>
          </div>
        </div>
    );
  }

    if (type === 'stock') {
      const stock = data as StockItem;
      return (
        <div ref={ref} className="print-receipt-container bg-white text-zinc-900" dir="rtl" style={{ 
          fontFamily: "'Inter', sans-serif", 
          width: isPurchase ? '21cm' : '14.8cm',
        minHeight: isPurchase ? '29.7cm' : '21cm', 
          height: 'auto', 
          boxSizing: 'border-box', 
          position: 'relative', 
          padding: '0.5cm 1cm 1cm 1cm',
          paddingBottom: '2.5cm',
          backgroundColor: 'white'
        }}>
          {printStyles}
          <div className="receipt-border-decor" />
          <div className="header-section">
            <h1 className="shop-name text-center" style={{ width: '100%', display: 'block' }}>{shopSettings.name}</h1>
            <div style={{ height: '15px' }}></div>
            <p className="text-2xl font-bold m-1 font-nastaliq">ہمارے ہاں سنگاپور اور دبئی ورائٹی دستیاب ہے۔</p>
            <p className="text-lg m-1 font-nastaliq text-zinc-600">{shopSettings.address}</p>
            <div className="header-phone" dir="ltr">
              <div className="phone-brand-box">
                <img src={WHATSAPP_ICON} className="brand-icon" alt="WhatsApp" />
                <span className="phone-number">{shopSettings.phone}</span>
              </div>
              {shopSettings.phone2 && (
                <div className="phone-brand-box-secondary">
                  <img src={WHATSAPP_ICON} className="brand-icon" alt="WhatsApp" />
                  <span className="phone-number" style={{ color: '#b8860b' }}>{shopSettings.phone2}</span>
                </div>
              )}
            </div>
            <div className="bg-zinc-100 px-3 py-1 mt-4 font-bold rounded-lg text-gold text-lg font-nastaliq border border-gold-20 inline-block">اسٹاک رسید</div>
          </div>

          <table className="receipt-table" style={{ marginTop: '20px' }}>
            <tbody>
              <tr>
                <th className="font-nastaliq" style={{ width: '25%', background: '#f9f9f9' }}>آئٹم</th>
                <td className="font-bold text-xl font-nastaliq" style={{ width: '75%' }}>{stock.name}</td>
              </tr>
            </tbody>
          </table>
          <div className="mt-4">
            <table className="receipt-table">
            <thead>
              <tr>
                <th className="font-nastaliq" style={{ width: '33%' }}>ٹائپ</th>
                <th className="font-nastaliq" style={{ width: '33%' }}>صاف وزن</th>
                <th className="font-nastaliq" style={{ width: '34%' }}>تعداد</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="font-nastaliq">{stock.type}</td>
                <td className="font-bold text-lg font-mono">{stock.quantity} {stock.unit}</td>
                <td className="font-bold text-lg font-mono">{stock.pieces || 0} pcs</td>
              </tr>
            </tbody>
          </table>
        </div>

          {stock.img && (
            <div className="mt-6 text-center">
              <img src={stock.img} alt="" className="max-h-64 mx-auto border border-zinc-200 rounded" />
            </div>
          )}

          <div className="receipt-footer">
            <div className="footer-brand-box" dir="ltr">
              <img src={WHATSAPP_ICON} className="footer-icon" alt="WhatsApp" />
              <span className="font-mono text-xs text-zinc-600 font-bold">{shopSettings.phone}</span>
            </div>
            <div className="mt-4 text-[14px] text-zinc-400 italic font-sans">
              Software developed by Nafees Jewellers Management System
            </div>
          </div>
        </div>
    );
  }

  if (type === 'purchase') {
    const purchase = data as GoldPurchase;
    return (
      <div ref={ref} className="print-receipt-container bg-white text-zinc-900" dir="rtl" style={{ 
        fontFamily: "'Inter', sans-serif", 
        width: isPurchase ? '21cm' : '14.8cm',
        minHeight: isPurchase ? '29.7cm' : '21cm', 
        height: 'auto', 
        boxSizing: 'border-box', 
        position: 'relative', 
        padding: '0.5cm 1cm 1cm 1cm',
        paddingBottom: '2.5cm',
        backgroundColor: 'white'
      }}>
        {printStyles}
        <div className="receipt-border-decor" />
        <div className="header-section">
          <h1 className="shop-name text-center" style={{ width: '100%', display: 'block' }}>{shopSettings.name}</h1>
          <div style={{ height: '15px' }}></div>
          <p className="text-2xl font-bold m-1 font-nastaliq">ہمارے ہاں سنگاپور اور دبئی ورائٹی دستیاب ہے۔</p>
          <p className="text-lg m-1 font-nastaliq text-zinc-600">{shopSettings.address}</p>
          <div className="header-phone" dir="ltr">
            <div className="phone-brand-box">
              <img src={WHATSAPP_ICON} className="brand-icon" alt="WhatsApp" />
              <span className="phone-number">{shopSettings.phone}</span>
            </div>
            {shopSettings.phone2 && (
              <div className="phone-brand-box-secondary">
                <img src={WHATSAPP_ICON} className="brand-icon" alt="WhatsApp" />
                <span className="phone-number" style={{ color: '#b8860b' }}>{shopSettings.phone2}</span>
              </div>
            )}
          </div>
          <div className="bg-zinc-100 px-3 py-1 mt-4 font-bold rounded-lg text-gold text-lg font-nastaliq border border-gold-20 inline-block">پرانا سونا خریداری رسید</div>
        </div>

        <table className="receipt-table">
          <tbody>
            <tr>
              <th className="font-nastaliq" style={{ width: '20%' }}>بیچنے والے کا نام</th>
              <td className="font-bold font-nastaliq" style={{ width: '30%' }}>{purchase.name}</td>
              <th className="font-nastaliq" style={{ width: '20%' }}>فون نمبر</th>
              <td className="font-bold" style={{ width: '30%' }} dir="ltr">{purchase.phone}</td>
            </tr>
            <tr>
              <th className="font-nastaliq">تاریخ</th>
              <td>{purchase.date}</td>
              <th className="font-nastaliq">رسید نمبر</th>
              <td className="font-bold text-gold">#{5000 + (id || 0)}</td>
            </tr>
          </tbody>
        </table>

        <table className="receipt-table" style={{ marginTop: '20px' }}>
          <thead>
            <tr>
              <th className="font-nastaliq" style={{ width: '30%', background: '#b8860b', color: 'white' }}>آئٹم</th>
              <th className="font-nastaliq" style={{ width: '20%', background: '#b8860b', color: 'white' }}>وزن</th>
              <th className="font-nastaliq" style={{ width: '25%', background: '#b8860b', color: 'white' }}>ریٹ</th>
              <th className="font-nastaliq" style={{ width: '25%', background: '#b8860b', color: 'white' }}>کل قیمت</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="font-nastaliq font-bold" style={{ paddingRight: '15px' }}>پرانا سونا</td>
              <td className="font-mono font-bold text-lg">{purchase.weight}g</td>
              <td className="font-mono">{purchase.rate.toLocaleString()}</td>
              <td className="font-mono font-bold text-lg">{purchase.total.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>

        {purchase.img && (
          <div className="mt-4 text-center">
            <h4 className="text-xs font-bold font-nastaliq mb-2">خریدے گئے سونے کی تصویر</h4>
            <img src={purchase.img} alt="" className="max-h-64 mx-auto border-2 border-zinc-200 rounded-xl shadow-sm" />
          </div>
        )}

        <div className="flex justify-start mt-6">
          <table className="summary-table" style={{ marginLeft: 'auto' }}>
            <tbody>
              <tr className="final-total-row">
                <th className="font-nastaliq font-black" style={{ fontSize: '18px' }}>نقد ادا شدہ رقم</th>
                <td className="font-black font-mono" style={{ fontSize: '24px' }}>Rs. {purchase.total.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-10 border-t-2 border-zinc-300 pt-6">
          <h3 className="text-center font-bold text-lg mb-4 font-nastaliq underline">اعلان و تصدیق</h3>
          <div className="text-[16px] leading-relaxed space-y-4 font-nastaliq text-justify mb-4">
            <p>
              فروخت کنندہ اس بات کی مکمل تصدیق کرتا/کرتی ہے کہ فروخت کیا جانے والا سونا اس کی جائز اور قانونی ملکیت ہے اور کسی بھی قسم کی چوری، گمشدگی یا غیر قانونی ذریعے سے حاصل شدہ نہیں ہے۔ فروخت کنندہ نے اپنی درست شناختی دستاویز (CNIC) فراہم کی ہے جس کی کاپی خریدار کے ریکارڈ میں محفوظ ہے۔
            </p>
            <p>
              خریدار (دکان) نے مناسب قانونی احتیاط (Due Diligence) کے طور پر شناخت، تصویر اور لین دین کا مکمل ریکارڈ محفوظ کیا ہے۔ اگر مستقبل میں یہ سونا چوری شدہ یا غیر قانونی ثابت ہوتا ہے تو اس کی مکمل قانونی ذمہ داری فروخت کنندہ پر عائد ہوگی اور وہ ہر قسم کے نقصان، دعویٰ یا قانونی کارروائی کا ذمہ دار ہوگا۔
            </p>
          </div>
          <div className="text-[14px] leading-tight space-y-3 mb-8 text-justify font-sans text-zinc-700 italic border-b border-zinc-200 pb-6">
            <p>
              The seller hereby declares that the gold being sold is his/her lawful property and is not stolen, lost, or obtained through any illegal means. A valid CNIC has been provided and a copy is retained in the buyer’s records.
            </p>
            <p>
              The buyer (shop) has exercised due diligence by recording identification details, photograph, and transaction data. In the event that the gold is later found to be stolen or illegal, full legal responsibility and liability shall rest with the seller, including compensation for any loss or legal claim.
            </p>
          </div>
          
          <div className="mt-12 grid grid-cols-2 gap-y-10 text-[13px] font-bold font-nastaliq">
            <div className="border-b border-zinc-400 pb-1">فروخت کنندہ کے دستخط:</div>
            <div className="border-b border-zinc-400 pb-1 text-left">انگوٹھے کا نشان:</div>
            <div className="border-b border-zinc-400 pb-1">شناختی کارڈ:</div>
            <div className="border-b border-zinc-400 pb-1 text-left">موبائل نمبر:</div>
            <div className="col-span-2 text-center mt-6 border-b border-zinc-400 pb-1 inline-block mx-auto px-12">تاریخ: {purchase.date}</div>
          </div>
        </div>

        <div className="receipt-footer" style={{ marginTop: '50px' }}>
          <div className="footer-brand-box" dir="ltr">
            <img src={WHATSAPP_ICON} className="footer-icon" alt="WhatsApp" />
            <span className="font-mono text-xs text-zinc-600 font-bold">{shopSettings.phone}</span>
          </div>
          <div className="mt-4 text-[14px] text-zinc-400 italic font-sans">
            Software developed by Nafees Jewellers Management System
          </div>
        </div>
      </div>
    );
  }

  return null;
});

PrintReceipt.displayName = 'PrintReceipt';
