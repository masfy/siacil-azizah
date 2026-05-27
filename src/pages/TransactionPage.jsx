import { useState, useEffect } from 'react';
import { Button, Input, Card, Modal } from '../components/ui';
import { PlusIcon, TrashIcon, MinusIcon, WhatsAppIcon, PrinterIcon, CheckIcon, DocumentTextIcon } from '../components/Icons';
import { useAuth } from '../context/AuthContext';
import { addInvoice, getProducts } from '../services/api';
import { generateInvoicePdf, previewInvoicePdf } from '../utils/pdfGenerator';
import { generateWhatsAppLink } from '../utils/whatsapp';

export default function TransactionPage() {
    const { user } = useAuth();
    const [items, setItems] = useState([]);
    const [customerName, setCustomerName] = useState('');
    const [customerWa, setCustomerWa] = useState('');
    const [notes, setNotes] = useState('');
    const [loading, setSaving] = useState(false);
    const [showAddItem, setShowAddItem] = useState(false);
    const [showCheckout, setShowCheckout] = useState(false);
    const [checkoutSuccess, setCheckoutSuccess] = useState(false);
    const [savedInvoice, setSavedInvoice] = useState(null);

    const [catalog, setCatalog] = useState([]);
    const [showCatalog, setShowCatalog] = useState(false);

    const [newItem, setNewItem] = useState({ name: '', price: '', qty: 1 });

    useEffect(() => {
        loadCatalog();
    }, []);

    const loadCatalog = async () => {
        try {
            const response = await getProducts();
            if (response.success && response.data) {
                setCatalog(response.data);
            }
        } catch (error) {
            console.error('Failed to load catalog:', error);
        }
    };

    const total = items.reduce((sum, item) => sum + (item.price * item.qty), 0);

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
        }).format(amount || 0);
    };

    const handleAddItem = () => {
        if (!newItem.name.trim() || !newItem.price) return;

        setItems([...items, {
            id: Date.now(),
            name: newItem.name.trim(),
            price: parseInt(newItem.price) || 0,
            qty: parseInt(newItem.qty) || 1,
        }]);

        setNewItem({ name: '', price: '', qty: 1 });
        setShowAddItem(false);
    };

    const handleAddFromCatalog = (product) => {
        setItems([...items, {
            id: Date.now(),
            name: product.product_name,
            price: parseInt(product.price) || 0,
            qty: 1,
        }]);
        setShowCatalog(false);
    };

    const removeItem = (id) => {
        setItems(items.filter(item => item.id !== id));
    };

    const updateQty = (id, delta) => {
        setItems(items.map(item => {
            if (item.id === id) {
                const newQty = Math.max(1, item.qty + delta);
                return { ...item, qty: newQty };
            }
            return item;
        }));
    };

    const handleSaveInvoice = async () => {
        if (items.length === 0) return;

        setSaving(true);
        try {
            const invoiceData = {
                customer_name: customerName || 'Pelanggan',
                customer_wa: customerWa || '',
                notes: notes || '',
                items_json: JSON.stringify(items),
                total_amount: total,
                date: new Date().toISOString(),
            };

            const response = await addInvoice(invoiceData);

            if (response.success) {
                setSavedInvoice({
                    ...invoiceData,
                    invoice_id: response.invoice_id || `INV-${Date.now()}`,
                });
                setCheckoutSuccess(true);
            }
        } catch (error) {
            console.error('Failed to save invoice:', error);
            setSavedInvoice({
                invoice_id: `INV-${Date.now()}`,
                customer_name: customerName || 'Pelanggan',
                customer_wa: customerWa || '',
                notes: notes || '',
                items_json: JSON.stringify(items),
                total_amount: total,
                date: new Date().toISOString(),
            });
            setCheckoutSuccess(true);
        } finally {
            setSaving(false);
        }
    };

    const handleGeneratePdf = () => {
        if (!savedInvoice) return;
        generateInvoicePdf(savedInvoice, user);
    };

    const handlePreviewPdf = () => {
        if (!savedInvoice) return;
        previewInvoicePdf(savedInvoice, user);
    };

    const handleWhatsApp = () => {
        if (!savedInvoice) return;
        const link = generateWhatsAppLink(savedInvoice, user, customerWa);
        window.open(link, '_blank');
    };

    const handleNewTransaction = () => {
        setItems([]);
        setCustomerName('');
        setCustomerWa('');
        setNotes('');
        setShowCheckout(false);
        setCheckoutSuccess(false);
        setSavedInvoice(null);
    };

    const handlePhoneChange = (e) => {
        let val = e.target.value;
        // Remove single quote and spaces/dashes for processing
        val = val.replace(/['\s-]/g, '');
        // Replace +62 or 62 at the beginning with 0
        if (val.startsWith('+62')) {
            val = '0' + val.substring(3);
        } else if (val.startsWith('62')) {
            val = '0' + val.substring(2);
        }
        // Remove any remaining non-digit characters
        val = val.replace(/\D/g, '');
        
        // Add single quote if starts with 0
        if (val.startsWith('0')) {
            val = "'" + val;
        }
        
        setCustomerWa(val);
    };

    return (
        <div className="p-5 space-y-4 page-enter">
            {/* Header */}
            <div className="pt-2">
                <h1 className="text-2xl font-bold text-gray-900">Transaksi Baru</h1>
                <p className="text-gray-500 text-sm">Tambah item dan checkout</p>
            </div>

            {/* Customer Info */}
            <Card padding="md" className="animate-slide-up">
                <div className="space-y-3">
                    <Input
                        label="Nama Pelanggan"
                        placeholder="Opsional"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                    />
                    <Input
                        label="No. WhatsApp"
                        placeholder="08123456789"
                        value={customerWa}
                        onChange={handlePhoneChange}
                    />
                </div>
            </Card>

            {/* Quick Add */}
            <div className="flex gap-2 animate-slide-up" style={{ animationDelay: '0.1s' }}>
                <Button variant="secondary" onClick={() => setShowAddItem(true)} className="flex-1">
                    <PlusIcon className="w-4 h-4" />
                    Manual
                </Button>
                {catalog.length > 0 && (
                    <Button variant="gradient" onClick={() => setShowCatalog(true)} className="flex-1">
                        📋 Katalog
                    </Button>
                )}
            </div>

            {/* Items List */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-gray-900 font-semibold">Daftar Item</h2>
                    <span className="text-gray-400 text-sm">{items.length} item</span>
                </div>

                {items.length === 0 ? (
                    <Card padding="lg" className="animate-fade-in">
                        <div className="text-center text-gray-400">
                            <span className="text-4xl mb-3 block">🛒</span>
                            <p className="text-gray-600">Belum ada item</p>
                            <p className="text-sm text-gray-400">Tekan tombol di atas untuk menambah</p>
                        </div>
                    </Card>
                ) : (
                    <div className="space-y-2">
                        {items.map((item, index) => (
                            <Card
                                key={item.id}
                                padding="sm"
                                className="animate-scale-in"
                                style={{ animationDelay: `${index * 0.05}s` }}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="flex-1">
                                        <p className="text-gray-900 font-medium">{item.name}</p>
                                        <p className="text-gray-500 text-sm">{formatCurrency(item.price)}</p>
                                    </div>

                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => updateQty(item.id, -1)}
                                            className="w-8 h-8 bg-gray-100 rounded-xl flex items-center justify-center hover:bg-gray-200 transition-all active:scale-90"
                                        >
                                            <MinusIcon className="w-4 h-4 text-gray-600" />
                                        </button>
                                        <span className="text-gray-900 font-semibold w-8 text-center">{item.qty}</span>
                                        <button
                                            onClick={() => updateQty(item.id, 1)}
                                            className="w-8 h-8 bg-gray-100 rounded-xl flex items-center justify-center hover:bg-gray-200 transition-all active:scale-90"
                                        >
                                            <PlusIcon className="w-4 h-4 text-gray-600" />
                                        </button>
                                    </div>

                                    <button
                                        onClick={() => removeItem(item.id)}
                                        className="w-8 h-8 bg-red-50 rounded-xl flex items-center justify-center hover:bg-red-100 transition-all active:scale-90"
                                    >
                                        <TrashIcon className="w-4 h-4 text-red-500" />
                                    </button>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {/* Catatan, Total & Checkout */}
            {items.length > 0 && (
                <div className="space-y-3">
                    <Card padding="md" className="animate-slide-up">
                        <Input
                            label="Catatan (Opsional)"
                            placeholder="Contoh: Jangan pedas / Dibungkus"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </Card>

                    <Card padding="md" className="animate-slide-up bg-gray-900 border-0">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-gray-400">Total</span>
                        <span className="text-2xl font-bold text-white">{formatCurrency(total)}</span>
                    </div>
                    <Button variant="success" fullWidth onClick={() => setShowCheckout(true)}>
                        <CheckIcon className="w-5 h-5" />
                        Checkout
                    </Button>
                    </Card>
                </div>
            )}

            {/* Add Item Modal */}
            <Modal isOpen={showAddItem} onClose={() => setShowAddItem(false)} title="Tambah Item">
                <div className="space-y-4">
                    <Input
                        label="Nama Item / Jasa"
                        placeholder="Contoh: Nasi Goreng"
                        value={newItem.name}
                        onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                    />
                    <Input
                        label="Harga (Rp)"
                        type="number"
                        placeholder="15000"
                        value={newItem.price}
                        onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                    />
                    <Input
                        label="Jumlah"
                        type="number"
                        min="1"
                        value={newItem.qty}
                        onChange={(e) => setNewItem({ ...newItem, qty: e.target.value })}
                    />
                    <Button variant="primary" fullWidth onClick={handleAddItem}>
                        Tambah ke Keranjang
                    </Button>
                </div>
            </Modal>

            {/* Catalog Modal */}
            <Modal isOpen={showCatalog} onClose={() => setShowCatalog(false)} title="Pilih dari Katalog" size="lg">
                <div className="space-y-2 max-h-80 overflow-y-auto">
                    {catalog.length === 0 ? (
                        <p className="text-gray-400 text-center py-4">Belum ada produk di katalog.</p>
                    ) : (
                        catalog.map((product) => (
                            <button
                                key={product.sku}
                                onClick={() => handleAddFromCatalog(product)}
                                className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-gray-50 transition-colors text-left border border-gray-100"
                            >
                                <div>
                                    <p className="font-medium text-gray-900">{product.product_name}</p>
                                    <p className="text-sm text-gray-400">SKU: {product.sku}</p>
                                </div>
                                <span className="font-bold text-violet-600">{formatCurrency(product.price)}</span>
                            </button>
                        ))
                    )}
                </div>
            </Modal>

            {/* Checkout Modal */}
            <Modal
                isOpen={showCheckout}
                onClose={() => !checkoutSuccess && setShowCheckout(false)}
                title={checkoutSuccess ? "Berhasil! ✨" : "Konfirmasi Checkout"}
                showClose={!checkoutSuccess}
            >
                {!checkoutSuccess ? (
                    <div className="space-y-4">
                        <div className="bg-gray-50 rounded-2xl p-4 space-y-2">
                            <div className="flex justify-between">
                                <span className="text-gray-500">Pelanggan</span>
                                <span className="font-medium text-gray-900">{customerName || 'Pelanggan'}</span>
                            </div>
                            {customerWa && (
                                <div className="flex justify-between">
                                    <span className="text-gray-500">WhatsApp</span>
                                    <span className="font-medium text-gray-900">{customerWa}</span>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span className="text-gray-500">Jumlah Item</span>
                                <span className="font-medium text-gray-900">{items.length} item</span>
                            </div>
                            {notes && (
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Catatan</span>
                                    <span className="font-medium text-gray-900 text-right max-w-[60%]">{notes}</span>
                                </div>
                            )}
                            <div className="h-px bg-gray-200 my-2" />
                            <div className="flex justify-between">
                                <span className="font-semibold text-gray-900">Total</span>
                                <span className="text-xl font-bold text-violet-600">{formatCurrency(total)}</span>
                            </div>
                        </div>

                        <Button variant="primary" fullWidth onClick={handleSaveInvoice} loading={loading}>
                            Simpan & Selesaikan
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="text-center">
                            <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-3">
                                <CheckIcon className="w-8 h-8 text-green-600" />
                            </div>
                            <p className="text-gray-500 mb-4">
                                Invoice <span className="font-mono text-gray-900">#{savedInvoice?.invoice_id}</span> tersimpan!
                            </p>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <Button variant="success" onClick={handleWhatsApp}>
                                <WhatsAppIcon className="w-5 h-5" />
                                WA
                            </Button>
                            <Button variant="secondary" onClick={handlePreviewPdf}>
                                <DocumentTextIcon className="w-5 h-5" />
                                Preview
                            </Button>
                            <Button variant="gradient" onClick={handleGeneratePdf}>
                                <PrinterIcon className="w-5 h-5" />
                                Cetak
                            </Button>
                        </div>

                        <Button variant="secondary" fullWidth onClick={handleNewTransaction}>
                            Transaksi Baru
                        </Button>
                    </div>
                )}
            </Modal>
        </div>
    );
}
