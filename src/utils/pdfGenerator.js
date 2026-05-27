import jsPDF from 'jspdf';
import QRCode from 'qrcode';

/**
 * Helper to build the PDF document
 */
async function buildInvoiceDoc(invoice, storeInfo) {
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [80, 250],
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 8;
    const lineHeight = 5;
    const margin = 5;

    // Parse items
    let items = [];
    try {
        items = JSON.parse(invoice.items_json);
    } catch {
        items = [];
    }

    // Format currency
    const formatCurrency = (amount) => {
        return 'Rp ' + new Intl.NumberFormat('id-ID').format(amount || 0);
    };

    // Format date
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    // Format phone number (handle spreadsheet removing leading 0)
    const formatPhoneNumber = (phone) => {
        if (!phone) return '';
        // Convert to string
        let phoneStr = String(phone).replace(/\D/g, '');

        // If starts with 62, convert to 0
        if (phoneStr.startsWith('62')) {
            phoneStr = '0' + phoneStr.substring(2);
        }
        // If doesn't start with 0 and length is 9-12 (lost leading 0), add it back
        else if (!phoneStr.startsWith('0') && phoneStr.length >= 9 && phoneStr.length <= 12) {
            phoneStr = '0' + phoneStr;
        }

        return phoneStr;
    };

    // ===== WATERMARK LOGO (Background) =====
    if (storeInfo?.logo_base64) {
        try {
            const logoSize = 35;
            const logoX = (pageWidth - logoSize) / 2;
            const logoY = 55;

            doc.setGState(doc.GState({ opacity: 0.06 }));
            doc.addImage(storeInfo.logo_base64, 'AUTO', logoX, logoY, logoSize, logoSize);
            doc.setGState(doc.GState({ opacity: 1 }));
        } catch (e) {
            console.error('Watermark error:', e);
        }
    }

    // ===== HEADER WITH LOGO =====
    if (storeInfo?.logo_base64) {
        try {
            const headerLogoSize = 12;
            const logoX = (pageWidth - headerLogoSize) / 2;
            doc.addImage(storeInfo.logo_base64, 'AUTO', logoX, yPos, headerLogoSize, headerLogoSize);
            yPos += headerLogoSize + 3;
        } catch (e) {
            console.error('Header logo error:', e);
        }
    }

    // Store name
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(storeInfo?.store_name || 'SI-ACIL Store', pageWidth / 2, yPos, { align: 'center' });
    yPos += lineHeight;

    // Address
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    if (storeInfo?.address) {
        const addressLines = doc.splitTextToSize(storeInfo.address, pageWidth - margin * 2);
        addressLines.forEach((line) => {
            doc.text(line, pageWidth / 2, yPos, { align: 'center' });
            yPos += lineHeight - 1.5;
        });
    }

    // Store WA
    if (storeInfo?.wa_number) {
        doc.text('WA: ' + formatPhoneNumber(storeInfo.wa_number), pageWidth / 2, yPos, { align: 'center' });
        yPos += lineHeight;
    }

    // Separator
    yPos += 2;
    doc.setDrawColor(150);
    doc.setLineDashPattern([1, 1], 0);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 5;

    // ===== INVOICE INFO =====
    doc.setDrawColor(0);
    doc.setLineDashPattern([], 0);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('#' + (invoice.invoice_id || 'INV-0000'), margin, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(formatDate(invoice.date), pageWidth - margin, yPos, { align: 'right' });
    yPos += lineHeight;

    doc.text('Pelanggan: ' + (invoice.customer_name || 'Umum'), margin, yPos);
    yPos += lineHeight;

    if (invoice.customer_wa) {
        doc.text('WA: ' + formatPhoneNumber(invoice.customer_wa), margin, yPos);
        yPos += lineHeight;
    }

    yPos += 2;

    // Separator
    doc.setDrawColor(150);
    doc.setLineDashPattern([1, 1], 0);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 5;

    // ===== ITEMS =====
    doc.setDrawColor(0);
    doc.setLineDashPattern([], 0);
    doc.setFontSize(8);

    if (items.length === 0) {
        doc.text('Tidak ada item', margin, yPos);
        yPos += lineHeight;
    } else {
        items.forEach((item) => {
            const itemTotal = (item.price || 0) * (item.qty || 1);

            doc.setFont('helvetica', 'bold');
            doc.text(item.name || 'Item', margin, yPos);
            yPos += lineHeight - 1;

            doc.setFont('helvetica', 'normal');
            const qtyText = (item.qty || 1) + ' x ' + formatCurrency(item.price || 0);
            doc.text(qtyText, margin + 2, yPos);
            doc.text(formatCurrency(itemTotal), pageWidth - margin, yPos, { align: 'right' });
            yPos += lineHeight;
        });
    }

    // Separator
    yPos += 2;
    doc.setDrawColor(150);
    doc.setLineDashPattern([1, 1], 0);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 5;

    // ===== TOTAL =====
    // Calculate total from items (in case total_amount is missing)
    const calculatedTotal = items.reduce((sum, item) => {
        return sum + ((parseInt(item.price) || 0) * (parseInt(item.qty) || 1));
    }, 0);
    const finalTotal = calculatedTotal > 0 ? calculatedTotal : (invoice.total_amount || 0);

    doc.setDrawColor(0);
    doc.setLineDashPattern([], 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL', margin, yPos);
    doc.text(formatCurrency(finalTotal), pageWidth - margin, yPos, { align: 'right' });
    yPos += lineHeight + 3;

    // ===== CATATAN =====
    if (invoice.notes) {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text('Catatan:', margin, yPos);
        yPos += lineHeight - 1;
        
        doc.setFont('helvetica', 'italic');
        const notesLines = doc.splitTextToSize(invoice.notes, pageWidth - margin * 2);
        notesLines.forEach(line => {
            doc.text(line, margin, yPos);
            yPos += lineHeight - 1;
        });
        yPos += 3;
    }

    // ===== QRIS CODE =====
    try {
        const qrUrl = 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjxRYT63BuPLq8wIkxG4rRoj1IXUG4pRu7Q8culi5TgWdTZ3VRV5-7Rr9UqaiAVcBXmbq-uhWLQUBq3UElsYJWu3HBMlvcX_WA9SrSDWe9y1SPWV9jcZyfalEu1ex1H89qc6beXRN42SnRb9EP8a7_A5-GF7PjsMKlhA2lMPUavOll52qUeHVkLMlEGwHh3/s16000/Desain%20tanpa%20judul.png';
        
        // Cek cache di localStorage agar tidak lemot
        let qrDataUrl = localStorage.getItem('qris_cache_' + qrUrl);
        
        if (!qrDataUrl) {
            qrDataUrl = await new Promise((resolve) => {
                const img = new Image();
                img.crossOrigin = 'Anonymous';
                
                // Coba ambil dari file lokal (public/qris.png) terlebih dahulu jika ada, lalu fallback ke URL Google
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    const dataURL = canvas.toDataURL('image/png');
                    try {
                        localStorage.setItem('qris_cache_' + qrUrl, dataURL);
                    } catch (e) {}
                    resolve(dataURL);
                };
                
                let isTryingLocal = true;
                
                img.onerror = () => {
                    if (isTryingLocal) {
                        // Jika lokal gagal (file tidak ada), coba URL Google
                        isTryingLocal = false;
                        img.src = qrUrl;
                        return;
                    }

                    // Fallback using multiple proxies
                    const proxies = [
                        'https://api.allorigins.win/raw?url=',
                        'https://api.codetabs.com/v1/proxy?quest='
                    ];
                    
                    const tryProxy = (index) => {
                        if (index >= proxies.length) {
                            console.error('All proxies failed to load QRIS image');
                            resolve(null);
                            return;
                        }
                        
                        fetch(proxies[index] + encodeURIComponent(qrUrl))
                            .then(res => {
                                if (!res.ok) throw new Error('Proxy failed');
                                return res.blob();
                            })
                            .then(blob => {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                    let result = reader.result;
                                    // jsPDF requires valid image mime type, some proxies return octet-stream
                                    if (result && result.startsWith('data:application/octet-stream')) {
                                        result = result.replace('data:application/octet-stream', 'data:image/png');
                                    }
                                    try {
                                        localStorage.setItem('qris_cache_' + qrUrl, result);
                                    } catch (e) {
                                        console.warn('Gagal menyimpan cache QRIS', e);
                                    }
                                    resolve(result);
                                };
                                reader.readAsDataURL(blob);
                            })
                            .catch(err => {
                                tryProxy(index + 1);
                            });
                    };
                    
                    tryProxy(0);
                };
                
                // Mulai dengan mencoba memuat dari folder public (sangat cepat jika ada)
                img.src = '/qris.png';
            });
        }

        if (qrDataUrl) {
            // Separator before QRIS
            doc.setDrawColor(150);
            doc.setLineDashPattern([1, 1], 0);
            doc.line(margin, yPos, pageWidth - margin, yPos);
            yPos += 3;

            // QRIS label
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0);
            doc.text('Scan QRIS untuk Pembayaran', pageWidth / 2, yPos, { align: 'center' });
            yPos += 2;

            // Tentukan format gambar (PNG atau JPEG)
            const isPng = qrDataUrl.includes('image/png') || qrUrl.toLowerCase().endsWith('.png');
            const imgFormat = isPng ? 'PNG' : 'JPEG';

            // Add QRIS image
            const qrWidth = 40;
            const qrHeight = 40;
            const qrX = (pageWidth - qrWidth) / 2;
            doc.addImage(qrDataUrl, imgFormat, qrX, yPos, qrWidth, qrHeight);
            yPos += qrHeight + 3;
        }

    } catch (e) {
        console.error('QRIS Code generation error:', e);
        yPos += 3;
    }

    // ===== FOOTER =====
    doc.setDrawColor(150);
    doc.setLineDashPattern([1, 1], 0);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 5;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0);
    doc.text('Terima kasih sudah mendukung produk kami!', pageWidth / 2, yPos, { align: 'center' });
    yPos += lineHeight;
    doc.text('Sampai jumpa di transaksi selanjutnya!', pageWidth / 2, yPos, { align: 'center' });
    yPos += lineHeight + 2;

    doc.setFontSize(6);
    doc.setTextColor(130);
    doc.text('Powered by SI-ACIL @masalfy', pageWidth / 2, yPos, { align: 'center' });

    return doc;
}

/**
 * Generate invoice PDF and save it (download)
 */
export async function generateInvoicePdf(invoice, storeInfo) {
    const doc = await buildInvoiceDoc(invoice, storeInfo);
    const fileName = 'Invoice_' + (invoice.invoice_id || 'nota') + '_' + Date.now() + '.pdf';
    doc.save(fileName);
}

/**
 * Generate invoice PDF and open in new tab (preview)
 */
export async function previewInvoicePdf(invoice, storeInfo) {
    const doc = await buildInvoiceDoc(invoice, storeInfo);
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
}
