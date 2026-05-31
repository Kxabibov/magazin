import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  History, 
  Coins, 
  UserPlus, 
  ChevronRight, 
  ArrowLeft, 
  Check, 
  Plus, 
  AlertTriangle, 
  ShieldCheck, 
  TrendingUp, 
  Activity, 
  CreditCard,
  LogOut
} from 'lucide-react';

declare global {
  interface Window {
    Telegram?: any;
  }
}

// Product interface
interface Product {
  id: string;
  name: string;
}

// Purchase record interface
interface PurchaseRecord {
  id: string;
  productId: string;
  date: string;
  quantityKg: number;
  pricePerKg: number;
  totalPrice: number;
  amountPaid: number;
  remainingDebt: number;
  status: 'Paid' | 'Partially Paid' | 'Debt';
  phone: string;
}



export default function App() {
  // Authentication states
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<{ name: string; phone: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [phoneInput, setPhoneInput] = useState<string>('');
  
  // App navigation and view states
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productSubTab, setProductSubTab] = useState<'buy' | 'history' | 'debt'>('buy');
  const [adminTab, setAdminTab] = useState<'users' | 'analytics' | 'transactions'>('users');
  const [showAdminMenu, setShowAdminMenu] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  // Form states - Buy
  const [buyWeight, setBuyWeight] = useState<string>('');
  const [buyPrice, setBuyPrice] = useState<string>('');
  const [buyPaidAmount, setBuyPaidAmount] = useState<string>('');
  const [isDebtMode, setIsDebtMode] = useState<boolean>(false);
  const [paymentType, setPaymentType] = useState<'full_paid' | 'partial_paid' | 'full_debt'>('full_paid');

  // Form states - Pay Debt
  const [payAmount, setPayAmount] = useState<{ [purchaseId: string]: string }>({});
  const [payingPurchaseId, setPayingPurchaseId] = useState<string | null>(null);

  // Form states - Add User
  const [newUserName, setNewUserName] = useState<string>('');
  const [newUserPhone, setNewUserPhone] = useState<string>('');

  // Data states
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseRecord[]>([]);
  const [debtsList, setDebtsList] = useState<PurchaseRecord[]>([]);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'month' | 'year'>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  // Admin data states
  const [allUsers, setAllUsers] = useState<{ phone: string; name: string; status: string }[]>([]);
  const [allTransactions, setAllTransactions] = useState<PurchaseRecord[]>([]);
  const [adminSearchQuery, setAdminSearchQuery] = useState<string>('');

  // Admin edit states
  const [editingPurchase, setEditingPurchase] = useState<PurchaseRecord | null>(null);
  const [editWeight, setEditWeight] = useState<string>('');
  const [editPrice, setEditPrice] = useState<string>('');
  const [editPaid, setEditPaid] = useState<string>('');

  const formatCurrency = (amount: number | string) => {
    const num = Math.round(Number(amount) || 0);
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' UZS';
  };

  const cleanDate = (dateVal: any): string => {
    if (!dateVal) return '';
    const dateStr = String(dateVal);
    if (dateStr.includes('T')) {
      return dateStr.replace('T', ' ').replace(/\.\d+Z$/, '').substring(0, 16);
    }
    return dateStr;
  };

  const formatNumberInput = (value: string) => {
    const clean = value.replace(/\D/g, '');
    if (!clean) return '';
    return clean.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };

  const parseFormattedNumber = (value: string): number => {
    if (!value) return 0;
    return Number(value.replace(/\s/g, '')) || 0;
  };

  const cleanPhoneNumber = (phone: any) => {
    if (!phone) return '';
    return String(phone).replace(/[\s\-\(\)\+]/g, '');
  };

  const getUserName = (phone: any) => {
    if (!phone) return '';
    const cleanP = cleanPhoneNumber(phone);
    const found = allUsers.find(u => cleanPhoneNumber(u.phone) === cleanP);
    return found ? found.name : String(phone);
  };

  // Language state
  const [lang, setLang] = useState<'uz' | 'en'>('uz');

  // Initialize Telegram Web App SDK and check login parameters
  useEffect(() => {
    // 1. Alert Telegram that WebApp is ready
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
      
      // Theme matching
      const tgTheme = tg.colorScheme;
      console.log('Telegram Color Scheme:', tgTheme);
    }

    // 2. Parse URL parameters for auto-authentication from Telegram
    const params = new URLSearchParams(window.location.search);
    const paramPhone = params.get('phone');
    const paramName = params.get('name');

    if (paramPhone) {
      verifyUserAuth(paramPhone, paramName || 'User');
    } else {
      // Check if we already have it in localStorage
      const savedPhone = localStorage.getItem('laziz_user_phone');
      const savedName = localStorage.getItem('laziz_user_name');
      if (savedPhone) {
        verifyUserAuth(savedPhone, savedName || 'User');
      } else {
        setAuthChecking(false);
      }
    }
  }, []);

  // Fetch products and active database items once authorized
  useEffect(() => {
    if (isAuthenticated && currentUser) {
      fetchProducts();
    }
  }, [isAuthenticated, currentUser]);

  // If a product is selected, refresh its context data (history, debts)
  useEffect(() => {
    if (selectedProduct && currentUser) {
      refreshProductData();
    }
  }, [selectedProduct, productSubTab]);

  // Trigger admin list fetches when admin is active
  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      fetchAdminUsers();
      fetchAdminTransactions();
    }
  }, [isAuthenticated, isAdmin, adminTab]);

  const verifyUserAuth = async (phone: string, fallbackName: string) => {
    setAuthChecking(true);
    setErrorMessage('');
    try {
      // Use clean phone
      const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
      const response = await fetch(`/api/check-auth?phone=${encodeURIComponent(cleanPhone)}`);
      const authData = await response.json();

      if (authData.allowed) {
        setIsAuthenticated(true);
        setCurrentUser({
          name: authData.name || fallbackName,
          phone: cleanPhone
        });
        // Save to localStorage for convenience outside Telegram
        localStorage.setItem('laziz_user_phone', cleanPhone);
        localStorage.setItem('laziz_user_name', authData.name || fallbackName);

        // Simple Admin check: if name contains 'owner' or 'admin', or specific phone
        // Can be customized based on database attributes too
        if (
          authData.name.toLowerCase().includes('owner') || 
          authData.name.toLowerCase().includes('admin') ||
          cleanPhone === '+998991234567'
        ) {
          setIsAdmin(true);
        }
      } else {
        setErrorMessage(
          lang === 'uz' 
            ? 'Kechirasiz, ushbu telefon raqami tizimga kiritilmagan.' 
            : 'Sorry, this phone number is not authorized.'
        );
        setIsAuthenticated(false);
      }
    } catch (err) {
      console.error('Auth verification failed:', err);
      // Fallback for offline/local development without full server running
      setErrorMessage(
        lang === 'uz'
          ? 'Server bilan bog\'lanishda xatolik yuz berdi.'
          : 'Failed to communicate with the server.'
      );
    } finally {
      setAuthChecking(false);
    }
  };

  const handleManualLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneInput.trim()) return;
    verifyUserAuth(phoneInput, 'Test User');
  };

  const handleLogout = () => {
    localStorage.removeItem('laziz_user_phone');
    localStorage.removeItem('laziz_user_name');
    setIsAuthenticated(false);
    setCurrentUser(null);
    setIsAdmin(false);
    setSelectedProduct(null);
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      if (data.success) {
        setProducts(data.products);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshProductData = async () => {
    if (!selectedProduct || !currentUser) return;
    setLoading(true);
    try {
      const historyRes = await fetch(`/api/history?productId=${selectedProduct.id}&phone=${currentUser.phone}`);
      const historyData = await historyRes.json();
      if (historyData.success) {
        setPurchaseHistory(historyData.history);
      }

      const debtsRes = await fetch(`/api/debts?productId=${selectedProduct.id}&phone=${currentUser.phone}`);
      const debtsData = await debtsRes.json();
      if (debtsData.success) {
        setDebtsList(debtsData.debts);
      }
    } catch (err) {
      console.error('Error refreshing product data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Auto-calculate values for purchasing
  const weightVal = parseFloat(buyWeight) || 0;
  const priceVal = parseFormattedNumber(buyPrice);
  const finalPrice = Math.round(weightVal * priceVal);
  
  // Set paid amount automatically based on selector
  useEffect(() => {
    if (paymentType === 'full_paid') {
      setBuyPaidAmount(formatNumberInput(finalPrice.toString()));
      setIsDebtMode(false);
    } else if (paymentType === 'full_debt') {
      setBuyPaidAmount('0');
      setIsDebtMode(true);
    } else {
      // Partial paid
      setIsDebtMode(true);
    }
  }, [paymentType, finalPrice]);

  const handleBuySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !currentUser) return;
    if (!buyWeight || !buyPrice) {
      setErrorMessage(lang === 'uz' ? 'Iltimos, barcha maydonlarni to\'ldiring.' : 'Please fill in all fields.');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    const paidVal = parseFormattedNumber(buyPaidAmount);

    const payload = {
      productId: selectedProduct.id,
      quantityKg: weightVal,
      pricePerKg: priceVal,
      totalPrice: finalPrice,
      amountPaid: paidVal,
      phone: currentUser.phone
    };

    try {
      const res = await fetch('/api/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        setSuccessMessage(
          lang === 'uz' 
            ? 'Xarid muvaffaqiyatli saqlandi!' 
            : 'Purchase recorded successfully!'
        );
        // Reset inputs
        setBuyWeight('');
        setBuyPrice('');
        setBuyPaidAmount('');
        setPaymentType('full_paid');
        
        // Refresh values
        await refreshProductData();
        
        // Clear message after 3 seconds
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setErrorMessage(data.error || 'Submit error');
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Server connection error.');
    } finally {
      setLoading(false);
    }
  };

  const handlePayDebt = async (purchaseId: string) => {
    if (!currentUser) return;
    const amountStr = payAmount[purchaseId];
    const amount = parseFormattedNumber(amountStr) || 0;
    
    if (amount <= 0) return;

    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await fetch('/api/pay-debt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchaseId,
          amountPaid: amount,
          phone: currentUser.phone
        })
      });
      const data = await res.json();

      if (data.success) {
        setSuccessMessage(
          lang === 'uz'
            ? 'To\'lov muvaffaqiyatli qabul qilindi!'
            : 'Payment processed successfully!'
        );
        setPayAmount(prev => ({ ...prev, [purchaseId]: '' }));
        setPayingPurchaseId(null);
        await refreshProductData();
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setErrorMessage(data.error || 'Payment error');
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Server error.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserPhone.trim()) return;

    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      // Normalize number
      let cleanPhone = newUserPhone.replace(/[\s\-\(\)]/g, '');
      if (!cleanPhone.startsWith('+')) {
        if (cleanPhone.startsWith('998')) {
          cleanPhone = '+' + cleanPhone;
        } else {
          cleanPhone = '+' + cleanPhone;
        }
      }

      const res = await fetch('/api/add-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: cleanPhone,
          name: newUserName
        })
      });
      const data = await res.json();

      if (data.success) {
        setSuccessMessage(
          lang === 'uz'
            ? `Foydalanuvchi muvaffaqiyatli qo'shildi!`
            : 'User added successfully!'
        );
        setNewUserName('');
        setNewUserPhone('');
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setErrorMessage(data.error || 'Failed to add user');
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Server connection error.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminUsers = async () => {
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (data.success) {
        setAllUsers(data.users);
      }
    } catch (err) {
      console.error('Error fetching admin users:', err);
    }
  };

  const handleDeleteUser = async (phone: string) => {
    if (!window.confirm(lang === 'uz' ? `Haqiqatan ham ushbu foydalanuvchidan ruxsatni olib tashlamoqchimisiz?` : `Are you sure you want to revoke access for this user?`)) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMessage(lang === 'uz' ? "Ruxsat muvaffaqiyatli o'chirildi!" : "Access revoked successfully!");
        await fetchAdminUsers();
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setErrorMessage(data.error || 'Delete user error');
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Server connection error.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminTransactions = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/history');
      const data = await res.json();
      if (data.success) {
        setAllTransactions(data.history);
      }
    } catch (err) {
      console.error('Error fetching admin transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPurchase) return;
    const newWeight = parseFloat(editWeight) || 0;
    const newPrice = parseFormattedNumber(editPrice);
    const newPaid = parseFormattedNumber(editPaid);

    if (newWeight <= 0 || newPrice <= 0) {
      alert(lang === 'uz' ? 'Og\'irlik va narx noldan katta bo\'lishi kerak' : 'Weight and price must be greater than zero');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/admin/update-purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingPurchase.id,
          quantityKg: newWeight,
          pricePerKg: newPrice,
          amountPaid: newPaid
        })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMessage(lang === 'uz' ? "Xarid muvaffaqiyatli yangilandi!" : "Purchase updated successfully!");
        setEditingPurchase(null);
        await fetchAdminTransactions();
        if (selectedProduct) {
          await refreshProductData();
        }
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setErrorMessage(data.error || 'Update purchase error');
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Server connection error.');
    } finally {
      setLoading(false);
    }
  };

  // Translations
  const t = {
    uz: {
      title: 'dukon Daftari',
      subtitle: 'Mahsulotlar hisob-kitobi',
      phoneVerify: 'Telefon raqamni tasdiqlash',
      phoneLabel: 'Telefon raqamingiz (+998...)',
      phonePlaceholder: 'Masalan: +998901234567',
      verifyBtn: 'Kirish / Verify',
      checking: 'Tizim tekshirilmoqda...',
      guestAlert: 'Faqat ruxsat berilgan raqamlar kira oladi.',
      allProducts: 'Mahsulotlar ro\'yxati',
      loading: 'Yuklanmoqda...',
      buy: 'Xarid qilish',
      history: 'Xarid tarixi',
      debt: 'Qarzni to\'lash',
      weightKg: 'Og\'irligi (kg)',
      pricePerKg: 'Kilogramm narxi (UZS)',
      totalPrice: 'Umumiy summasi',
      paidAmount: 'To\'langan summa (UZS)',
      isDebt: 'Qarzga qolmoqdami?',
      debtAmount: 'Qarz summasi',
      savePurchase: 'Xaridni saqlash',
      lastPurchased: 'Oxirgi marta',
      status: 'Holati',
      paid: 'To\'landi',
      partial: 'Qisman qarz',
      onlyDebt: 'Qarz',
      paidDetails: 'To\'langan: ${paid} / Jami: ${total}',
      remainingDebt: 'Qolgan qarz',
      noHistory: 'Hozircha xaridlar tarixi mavjud emas.',
      noDebts: 'Ushbu mahsulot bo\'yicha qarzdorlik yo\'q. 👍',
      date: 'Sana',
      payBtn: 'To\'lash',
      cancelBtn: 'Bekor qilish',
      enterAmount: 'Summani kiriting',
      confirmPay: 'To\'lovni tasdiqlash',
      adminPanel: 'Admin Panel',
      addUser: 'Yangi foydalanuvchi qo\'shish',
      userName: 'Foydalanuvchi ismi',
      userPhone: 'Telefon raqami',
      saveUser: 'Foydalanuvchini qo\'shish',
      logout: 'Chiqish',
      adminStatus: 'Siz tizim boshqaruvchisisiz',
      back: 'Orqaga',
      ownerAccessOnly: 'Kirish faqat bot egasi uchun',
      quickAdd: 'Tezkor og\'irlik (+ kg)',
      paymentType: 'To\'lov turi',
      fullPaid: 'Hammasi to\'landi',
      partialPaid: 'Qisman to\'lash',
      fullDebt: 'To\'liq qarzga',
      simulateBtn: 'Sinov rejimi (Simulyator)'
    },
    en: {
      title: 'dukon Daftari',
      subtitle: 'Product Tracking Ledger',
      phoneVerify: 'Phone Authentication',
      phoneLabel: 'Your Phone Number (+998...)',
      phonePlaceholder: 'e.g. +998901234567',
      verifyBtn: 'Verify Account',
      checking: 'Verifying identity...',
      guestAlert: 'Only authorized phone numbers can log in.',
      allProducts: 'Product Catalog',
      loading: 'Loading ledger data...',
      buy: 'Purchase',
      history: 'History',
      debt: 'Pay Debt',
      weightKg: 'Quantity (kg)',
      pricePerKg: 'Price per kg (UZS)',
      totalPrice: 'Grand Total',
      paidAmount: 'Amount Paid (UZS)',
      isDebt: 'Is it on debt?',
      debtAmount: 'Debt Outstanding',
      savePurchase: 'Record Purchase',
      lastPurchased: 'Last Purchased',
      status: 'Status',
      paid: 'Fully Paid',
      partial: 'Partial Debt',
      onlyDebt: 'Unpaid Debt',
      paidDetails: 'Paid: ${paid} / Total: ${total}',
      remainingDebt: 'Remaining Debt',
      noHistory: 'No purchase records found.',
      noDebts: 'No outstanding debt for this product. 👍',
      date: 'Date',
      payBtn: 'Pay',
      cancelBtn: 'Cancel',
      enterAmount: 'Enter payment amount',
      confirmPay: 'Confirm Payment',
      adminPanel: 'Admin Panel',
      addUser: 'Authorize New Phone Number',
      userName: 'Full Name',
      userPhone: 'Phone Number',
      saveUser: 'Add to Allowed List',
      logout: 'Disconnect',
      adminStatus: 'Administrator Mode',
      back: 'Back',
      ownerAccessOnly: 'Owner access restriction active',
      quickAdd: 'Quick weight (+ kg)',
      paymentType: 'Payment Method',
      fullPaid: 'Cash / Full Paid',
      partialPaid: 'Partially Paid',
      fullDebt: 'Add to Debt Ledger',
      simulateBtn: 'Simulate Auth (Dev)'
    }
  }[lang];

  if (authChecking) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0b0f19] px-6 text-center">
        <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin glow-cyan mb-6"></div>
        <p className="font-medium text-gray-400 tracking-wider animate-pulse">{t.checking}</p>
      </div>
    );
  }

  // AUTH SCREEN (IF NOT LOGGED IN)
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col justify-between bg-[#0b0f19] px-6 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mt-4">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg shadow-cyan-500/20">
              D
            </div>
            <span className="font-serif text-lg tracking-wider font-light uppercase">dukon Daftari</span>
          </div>
          <button 
            onClick={() => setLang(lang === 'uz' ? 'en' : 'uz')}
            className="text-xs font-semibold px-3 py-1 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-colors uppercase tracking-wider"
          >
            {lang === 'uz' ? 'English' : 'Uzbek'}
          </button>
        </div>

        {/* Card */}
        <div className="my-auto space-y-8 max-w-sm w-full mx-auto">
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
              {t.title}
            </h1>
            <p className="text-sm text-gray-400 font-light">{t.subtitle}</p>
          </div>

          <form onSubmit={handleManualLogin} className="glass-panel p-6 rounded-2xl glow-cyan space-y-6">
            <div className="flex items-center space-x-2 border-b border-white/10 pb-3">
              <ShieldCheck className="text-cyan-400 w-5 h-5" />
              <h2 className="text-sm font-semibold tracking-wider uppercase text-gray-200">{t.phoneVerify}</h2>
            </div>

            {errorMessage && (
              <div className="flex items-center space-x-2 bg-rose-500/10 border border-rose-500/20 p-3 rounded-lg text-xs text-rose-400">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs text-gray-400 font-medium">{t.phoneLabel}</label>
              <input
                type="text"
                placeholder={t.phonePlaceholder}
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-500 transition-colors placeholder:text-gray-600"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 font-bold rounded-xl text-sm transition-all duration-300 transform active:scale-[0.98] shadow-lg shadow-cyan-500/10 hover:shadow-cyan-500/20"
            >
              {t.verifyBtn}
            </button>
            
            {/* Developer Simulator Link */}
            <button
              type="button"
              onClick={() => verifyUserAuth('+998991234567', 'Laziz Owner (Simulated)')}
              className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/5 text-[10px] uppercase font-bold text-cyan-400 rounded-xl tracking-wider transition-all"
            >
              🚀 {t.simulateBtn}
            </button>
          </form>

          <p className="text-center text-[10px] text-gray-500 leading-relaxed font-light">
            {t.guestAlert}
          </p>
        </div>

        {/* Footer */}
        <div className="text-center text-[9px] uppercase tracking-widest text-gray-600 font-semibold">
          © {new Date().getFullYear()} dukon Daftari
        </div>
      </div>
    );
  }

  // Calculate filtered history and totals
  const filteredHistory = purchaseHistory.filter(item => {
    if (historyFilter === 'all') return true;
    if (!item.date) return true;
    
    const itemDateStr = String(item.date);
    const itemYear = itemDateStr.substring(0, 4);
    const itemMonth = itemDateStr.substring(5, 7);
    
    const today = new Date();
    const currentYear = today.getFullYear().toString();
    const currentMonth = (today.getMonth() + 1).toString().padStart(2, '0');
    
    if (historyFilter === 'year') {
      return itemYear === currentYear;
    }
    if (historyFilter === 'month') {
      return itemYear === currentYear && itemMonth === currentMonth;
    }
    return true;
  });

  const totalPurchased = filteredHistory.reduce((sum, item) => sum + item.totalPrice, 0);
  const totalPaid = filteredHistory.reduce((sum, item) => sum + item.amountPaid, 0);
  const totalDebt = filteredHistory.reduce((sum, item) => sum + item.remainingDebt, 0);

  // MAIN APPLICATION (AUTHORIZED SCREEN)
  return (
    <div className="min-h-screen bg-[#0b0f19] flex flex-col justify-between max-w-md mx-auto relative border-x border-white/5">
      
      {/* Header Banner */}
      <header className="glass-panel sticky top-0 z-30 px-4 py-3 flex justify-between items-center shadow-lg border-b border-white/5">
        <div className="flex items-center space-x-3">
          {selectedProduct ? (
            <button 
              onClick={() => setSelectedProduct(null)}
              className="p-1 hover:bg-white/10 rounded-lg transition-colors text-gray-400 active:scale-90"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : showAdminMenu ? (
            <button 
              onClick={() => setShowAdminMenu(false)}
              className="p-1 hover:bg-white/10 rounded-lg transition-colors text-gray-400 active:scale-90"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center font-bold text-white">
              D
            </div>
          )}
          
          <div>
            <h1 className="text-sm font-bold tracking-wider text-gray-100 uppercase">
              {selectedProduct ? selectedProduct.name : showAdminMenu ? t.adminPanel : t.title}
            </h1>
            <p className="text-[10px] text-gray-400 font-light flex items-center">
              <span className="inline-block w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5 animate-pulse"></span>
              {currentUser?.name}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {isAdmin && !selectedProduct && !showAdminMenu && (
            <button
              onClick={() => setShowAdminMenu(true)}
              className="p-2 bg-gradient-to-r from-purple-500/20 to-cyan-500/20 border border-cyan-500/30 hover:border-cyan-500/50 rounded-xl text-cyan-400 text-xs font-bold transition-all uppercase tracking-wider flex items-center space-x-1"
            >
              <span>{t.adminPanel}</span>
            </button>
          )}

          <button 
            onClick={() => setLang(lang === 'uz' ? 'en' : 'uz')}
            className="text-[10px] font-bold px-2 py-1 bg-white/5 border border-white/10 rounded-full text-gray-400 hover:bg-white/10 transition-colors uppercase tracking-wider"
          >
            {lang === 'uz' ? 'en' : 'uz'}
          </button>
          
          <button 
            onClick={handleLogout}
            className="p-2 hover:bg-rose-500/10 border border-white/5 rounded-xl text-rose-400 transition-colors active:scale-95"
            title={t.logout}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-grow p-4 space-y-4 overflow-y-auto safe-padding-bottom">
        
        {/* Global Notifications */}
        {successMessage && (
          <div className="flex items-center space-x-2 bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl text-xs text-emerald-400 animate-fadeIn glow-emerald">
            <Check className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}
        
        {errorMessage && (
          <div className="flex items-center space-x-2 bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl text-xs text-rose-400 animate-fadeIn glow-rose">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* LOADING INDICATOR */}
        {loading && (
          <div className="flex items-center justify-center py-4 bg-white/2 border border-white/5 rounded-2xl">
            <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mr-2"></div>
            <span className="text-xs text-gray-400">{t.loading}</span>
          </div>
        )}

        {/* VIEW 1: PRODUCT LIST PAGE */}
        {!selectedProduct && !showAdminMenu && (
          <div className="space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">{t.allProducts}</span>
              <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">4 Items</span>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {products.length > 0 ? (
                products.map((product, idx) => (
                  <button
                    key={product.id}
                    onClick={() => {
                      setSelectedProduct(product);
                      setProductSubTab('buy');
                    }}
                    className="glass-panel p-5 rounded-2xl flex justify-between items-center text-left hover:border-cyan-500/30 transition-all duration-300 group hover:translate-x-1"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-500/10 to-purple-600/10 border border-cyan-500/20 flex items-center justify-center font-bold text-cyan-400 group-hover:scale-110 transition-transform">
                        {idx + 1}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-100 group-hover:text-cyan-400 transition-colors">
                          {product.name}
                        </h3>
                        <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-0.5">
                          {lang === 'uz' ? 'Ochish uchun bosing' : 'Tap to open Ledger'}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-cyan-400 transition-colors" />
                  </button>
                ))
              ) : (
                // Mock products fallback in case spreadsheet connection is not established yet
                [
                  { id: 'p1', name: 'Product One' },
                  { id: 'p2', name: 'Product Two' },
                  { id: 'p3', name: 'Product Three' },
                  { id: 'p4', name: 'Product Four' }
                ].map((product, idx) => (
                  <button
                    key={product.id}
                    onClick={() => {
                      setSelectedProduct(product);
                      setProductSubTab('buy');
                    }}
                    className="glass-panel p-5 rounded-2xl flex justify-between items-center text-left hover:border-cyan-500/30 transition-all duration-300 group hover:translate-x-1"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-500/10 to-purple-600/10 border border-cyan-500/20 flex items-center justify-center font-bold text-cyan-400 group-hover:scale-110 transition-transform">
                        {idx + 1}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-100 group-hover:text-cyan-400 transition-colors">
                          {product.name}
                        </h3>
                        <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-0.5">
                          {lang === 'uz' ? 'Ochish uchun bosing' : 'Tap to open Ledger'}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-cyan-400 transition-colors" />
                  </button>
                ))
              )}
            </div>

            {/* Quick Analytics Cards for User */}
            <div className="glass-panel p-4 rounded-2xl flex items-center justify-between bg-gradient-to-r from-cyan-950/20 to-purple-950/20 border-cyan-500/10">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs text-gray-400 font-light">{lang === 'uz' ? 'Sizning xaridlaringiz' : 'Your Purchases'}</h4>
                  <p className="text-sm font-bold text-gray-200">{currentUser?.phone}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: PRODUCT DETAIL PAGE (WITH 3 SUB-TABS) */}
        {selectedProduct && (
          <div className="space-y-4 animate-fadeIn">
            
            {/* Sub-Tab Navigation Bar */}
            <div className="flex bg-white/5 border border-white/10 p-1 rounded-xl">
              <button
                onClick={() => setProductSubTab('buy')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center space-x-1 ${
                  productSubTab === 'buy' 
                    ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white shadow-md' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>{t.buy}</span>
              </button>
              <button
                onClick={() => setProductSubTab('history')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center space-x-1 ${
                  productSubTab === 'history' 
                    ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white shadow-md' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>{t.history}</span>
              </button>
              <button
                onClick={() => setProductSubTab('debt')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center space-x-1 ${
                  productSubTab === 'debt' 
                    ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white shadow-md' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Coins className="w-3.5 h-3.5" />
                <span>{t.debt}</span>
              </button>
            </div>

            {/* SUB-TAB 1: BUY PRODUCT FORM */}
            {productSubTab === 'buy' && (
              <form onSubmit={handleBuySubmit} className="glass-panel p-5 rounded-2xl glow-cyan space-y-5 animate-slideDown">
                
                {/* Weight Input */}
                <div className="space-y-2">
                  <label className="text-xs text-gray-400 font-medium">{t.weightKg}</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      placeholder="0.00"
                      value={buyWeight}
                      onChange={(e) => setBuyWeight(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-500 transition-colors pr-10 font-bold"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-500 font-bold">KG</span>
                  </div>
                  
                  {/* Quick Add buttons */}
                  <div className="flex gap-2 pt-1 overflow-x-auto">
                    {[0.5, 1, 5, 10, 20].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => {
                          const curr = parseFloat(buyWeight) || 0;
                          setBuyWeight((curr + v).toString());
                        }}
                        className="text-[10px] font-bold px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/5 text-cyan-400 rounded-lg shrink-0 transition-colors"
                      >
                        +{v}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setBuyWeight('')}
                      className="text-[10px] font-bold px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 rounded-lg shrink-0 transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Price input */}
                <div className="space-y-2">
                  <label className="text-xs text-gray-400 font-medium">{t.pricePerKg}</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="0"
                      value={buyPrice}
                      onChange={(e) => setBuyPrice(formatNumberInput(e.target.value))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-500 transition-colors pr-10 font-bold"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-500 font-bold">UZS</span>
                  </div>
                </div>

                {/* Grand Total Show */}
                <div className="bg-white/3 border border-white/5 p-4 rounded-xl flex justify-between items-center">
                  <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">{t.totalPrice}</span>
                  <span className="text-xl font-extrabold text-cyan-400">{formatCurrency(finalPrice)}</span>
                </div>

                {/* Payment Type Selector */}
                <div className="space-y-2">
                  <label className="text-xs text-gray-400 font-medium">{t.paymentType}</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'full_paid', label: t.fullPaid },
                      { id: 'partial_paid', label: t.partialPaid },
                      { id: 'full_debt', label: t.fullDebt }
                    ].map((type) => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setPaymentType(type.id as any)}
                        className={`py-2 text-[10px] font-bold rounded-lg border transition-all ${
                          paymentType === type.id
                            ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400 glow-cyan'
                            : 'bg-white/2 border-white/5 text-gray-400 hover:text-white'
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Amount Paid (Shows when not full debt) */}
                {paymentType === 'partial_paid' && (
                  <div className="space-y-2 animate-fadeIn">
                    <label className="text-xs text-gray-400 font-medium">{t.paidAmount}</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="0"
                        value={buyPaidAmount}
                        onChange={(e) => setBuyPaidAmount(formatNumberInput(e.target.value))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-500 transition-colors pr-10 font-bold"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-500 font-bold">UZS</span>
                    </div>
                  </div>
                )}

                {/* Debt Summary Preview */}
                {isDebtMode && (
                  <div className="bg-rose-500/5 border border-rose-500/20 p-4 rounded-xl flex justify-between items-center text-rose-400 animate-fadeIn">
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">{t.debtAmount}</span>
                    </div>
                    <span className="text-lg font-extrabold">{formatCurrency(Math.max(0, finalPrice - parseFormattedNumber(buyPaidAmount)))}</span>
                  </div>
                )}

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 font-bold rounded-xl text-sm transition-all duration-300 transform active:scale-[0.98] shadow-lg shadow-cyan-500/10 flex justify-center items-center space-x-2 disabled:opacity-50"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>{t.savePurchase}</span>
                </button>
              </form>
            )}

            {/* SUB-TAB 2: PURCHASE HISTORY */}
            {productSubTab === 'history' && (
              <div className="space-y-4 animate-slideDown">
                {/* Pinned Summary Card */}
                {purchaseHistory.length > 0 && (
                  <div className="glass-panel p-4 rounded-2xl bg-gradient-to-tr from-cyan-500/10 to-purple-600/10 border-cyan-500/20 grid grid-cols-3 gap-2 shadow-lg glow-cyan/5">
                    <div className="col-span-3 text-center border-b border-white/5 pb-2">
                      <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">
                        {lang === 'uz' ? 'Jami Sarhisob' : 'Summary'} ({historyFilter === 'all' ? (lang === 'uz' ? 'Hammasi' : 'All') : historyFilter === 'month' ? (lang === 'uz' ? `${selectedMonth}-oy` : `Month: ${selectedMonth}`) : (lang === 'uz' ? 'Shu yil' : 'This Year')})
                      </span>
                    </div>
                    <div className="text-center border-r border-white/5">
                      <div className="text-[8px] text-gray-400 uppercase tracking-widest">{lang === 'uz' ? 'Jami' : 'Total'}</div>
                      <div className="text-[11px] font-extrabold text-cyan-400 mt-1">{formatCurrency(totalPurchased)}</div>
                    </div>
                    <div className="text-center border-r border-white/5">
                      <div className="text-[8px] text-gray-400 uppercase tracking-widest">{lang === 'uz' ? "To'langan" : 'Total Paid'}</div>
                      <div className="text-[11px] font-extrabold text-emerald-400 mt-1">{formatCurrency(totalPaid)}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[8px] text-gray-400 uppercase tracking-widest">{lang === 'uz' ? 'Qolgan Qarz' : 'Remaining Debt'}</div>
                      <div className="text-[11px] font-extrabold text-rose-400 mt-1">{formatCurrency(totalDebt)}</div>
                    </div>
                  </div>
                )}

                {/* Filter Selector */}
                {purchaseHistory.length > 0 && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setHistoryFilter('all'); setSelectedMonth(''); }}
                      className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${
                        historyFilter === 'all'
                          ? 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-400'
                          : 'text-gray-400 hover:text-white bg-white/5 border border-white/5'
                      }`}
                    >
                      {lang === 'uz' ? 'Hammasi' : 'All'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setHistoryFilter('year'); setSelectedMonth(''); }}
                      className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${
                        historyFilter === 'year'
                          ? 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-400'
                          : 'text-gray-400 hover:text-white bg-white/5 border border-white/5'
                      }`}
                    >
                      {lang === 'uz' ? 'Shu yil' : 'This Year'}
                    </button>
                    <div className="flex-1 relative">
                      <select
                        value={selectedMonth}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedMonth(val);
                          if (val) {
                            setHistoryFilter('month');
                          } else {
                            setHistoryFilter('all');
                          }
                        }}
                        className={`w-full py-1.5 px-2 text-[10px] font-bold rounded-lg bg-white/5 border text-gray-400 focus:outline-none focus:border-cyan-500 transition-colors ${
                          historyFilter === 'month' ? 'border-cyan-500 text-cyan-400 bg-cyan-500/5' : 'border-white/5'
                        }`}
                      >
                        <option value="" className="bg-[#0b0f19] text-gray-400">
                          {lang === 'uz' ? 'Oylar' : 'Months'}
                        </option>
                        {[
                          { val: '01', label: lang === 'uz' ? 'Yanvar' : 'January' },
                          { val: '02', label: lang === 'uz' ? 'Fevral' : 'February' },
                          { val: '03', label: lang === 'uz' ? 'Mart' : 'March' },
                          { val: '04', label: lang === 'uz' ? 'Aprel' : 'April' },
                          { val: '05', label: lang === 'uz' ? 'May' : 'May' },
                          { val: '06', label: lang === 'uz' ? 'Iyun' : 'June' },
                          { val: '07', label: lang === 'uz' ? 'Iyul' : 'July' },
                          { val: '08', label: lang === 'uz' ? 'Avgust' : 'August' },
                          { val: '09', label: lang === 'uz' ? 'Sentyabr' : 'September' },
                          { val: '10', label: lang === 'uz' ? 'Oktyabr' : 'October' },
                          { val: '11', label: lang === 'uz' ? 'Noyabr' : 'November' },
                          { val: '12', label: lang === 'uz' ? 'Dekabr' : 'December' }
                        ].map((m) => (
                          <option key={m.val} value={m.val} className="bg-[#0b0f19] text-gray-300">
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">{t.history}</span>
                
                {filteredHistory.length > 0 ? (
                  <div className="space-y-3">
                    {filteredHistory.map((item) => (
                      <div key={item.id} className="glass-panel p-4 rounded-2xl space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">ID: {item.id}</span>
                            <div className="text-xs text-gray-400 mt-0.5">{cleanDate(item.date)}</div>
                          </div>

                          {/* Status Badge */}
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            item.status === 'Paid' 
                              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                              : item.status === 'Partially Paid'
                              ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                              : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                          }`}>
                            {item.status === 'Paid' ? t.paid : item.status === 'Partially Paid' ? t.partial : t.onlyDebt}
                          </span>
                        </div>

                        {/* Calculations summary */}
                        <div className="grid grid-cols-3 gap-2 border-t border-b border-white/5 py-2.5 text-center">
                          <div>
                            <div className="text-[9px] text-gray-500 uppercase tracking-widest">{lang === 'uz' ? 'Og\'irlik' : 'Weight'}</div>
                            <div className="text-xs font-bold text-gray-200">{item.quantityKg} kg</div>
                          </div>
                          <div>
                            <div className="text-[9px] text-gray-500 uppercase tracking-widest">{lang === 'uz' ? 'Narxi' : 'Price'}</div>
                            <div className="text-xs font-bold text-gray-200">{formatCurrency(item.pricePerKg)}/kg</div>
                          </div>
                          <div>
                            <div className="text-[9px] text-gray-500 uppercase tracking-widest">{lang === 'uz' ? 'Jami' : 'Total'}</div>
                            <div className="text-xs font-extrabold text-cyan-400">{formatCurrency(item.totalPrice)}</div>
                          </div>
                        </div>

                        {/* Paid/Remaining Debt details */}
                        <div className="flex justify-between text-xs font-medium">
                          <span className="text-gray-400">
                            {lang === 'uz' 
                              ? `To'langan: ${formatCurrency(item.amountPaid)} / Jami: ${formatCurrency(item.totalPrice)}` 
                              : `Paid: ${formatCurrency(item.amountPaid)} / Total: ${formatCurrency(item.totalPrice)}`}
                          </span>
                          {item.remainingDebt > 0 && (
                            <span className="text-rose-400 font-bold">
                              {t.remainingDebt}: {formatCurrency(item.remainingDebt)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-white/2 border border-white/5 rounded-2xl text-gray-500 text-xs font-light">
                    {historyFilter === 'all' 
                      ? t.noHistory 
                      : (lang === 'uz' ? 'Tanlangan davr uchun xaridlar mavjud emas.' : 'No purchases found for the selected period.')}
                  </div>
                )}
              </div>
            )}

            {/* SUB-TAB 3: DEBTS PAYMENTS */}
            {productSubTab === 'debt' && (
              <div className="space-y-3 animate-slideDown">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">{t.remainingDebt}</span>
                  <span className="text-xs font-extrabold text-rose-400">
                    Jami: {formatCurrency(debtsList.reduce((sum, item) => sum + item.remainingDebt, 0))}
                  </span>
                </div>

                {debtsList.length > 0 ? (
                  <div className="space-y-3">
                    {debtsList.map((item) => (
                      <div key={item.id} className="glass-panel p-4 rounded-2xl space-y-4 border-rose-500/10">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[10px] text-rose-400 font-bold uppercase tracking-wider">{t.date}: {cleanDate(item.date)}</span>
                            <div className="text-xs text-gray-200 mt-1 font-bold">
                              {item.quantityKg} kg x {formatCurrency(item.pricePerKg)} = {formatCurrency(item.totalPrice)}
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <span className="text-[9px] text-gray-500 block uppercase tracking-widest">{t.remainingDebt}</span>
                            <span className="text-sm font-extrabold text-rose-400">{formatCurrency(item.remainingDebt)}</span>
                          </div>
                        </div>

                        {/* Inline Pay Panel toggle */}
                        {payingPurchaseId === item.id ? (
                          <div className="space-y-3 bg-white/3 p-3 rounded-xl border border-white/5 animate-fadeIn">
                            <div className="space-y-2">
                              <label className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{t.enterAmount} (UZS)</label>
                              <div className="relative">
                                <input
                                  type="text"
                                  placeholder={formatNumberInput(item.remainingDebt.toString())}
                                  value={payAmount[item.id] || ''}
                                  onChange={(e) => {
                                    const val = formatNumberInput(e.target.value);
                                    setPayAmount(prev => ({ ...prev, [item.id]: val }));
                                  }}
                                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-cyan-500 transition-colors pr-10 font-bold"
                                />
                                <button 
                                  type="button"
                                  onClick={() => setPayAmount(prev => ({ ...prev, [item.id]: formatNumberInput(item.remainingDebt.toString()) }))}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] uppercase font-bold text-cyan-400 px-1.5 py-0.5 bg-cyan-500/10 rounded"
                                >
                                  Max
                                </button>
                              </div>
                            </div>

                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handlePayDebt(item.id)}
                                className="flex-1 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 font-bold rounded-lg text-xs hover:from-emerald-400 active:scale-95 transition-all text-white shadow-md shadow-emerald-500/10"
                              >
                                {t.confirmPay}
                              </button>
                              <button
                                type="button"
                                onClick={() => setPayingPurchaseId(null)}
                                className="px-3 py-2 bg-white/5 border border-white/10 font-semibold rounded-lg text-xs text-gray-400 hover:text-white"
                              >
                                {t.cancelBtn}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setPayingPurchaseId(item.id);
                              // Auto-fill default debt amount
                              setPayAmount(prev => ({ ...prev, [item.id]: item.remainingDebt.toString() }));
                            }}
                            className="w-full py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl text-xs font-bold text-rose-400 transition-colors flex items-center justify-center space-x-1"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>{t.payBtn} ({t.remainingDebt}: {formatCurrency(item.remainingDebt)})</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-white/2 border border-white/5 rounded-2xl text-gray-500 text-xs font-light">
                    {t.noDebts}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* VIEW 3: ADMIN ACCESS MANAGEMENT PANEL */}
        {showAdminMenu && !selectedProduct && (
          <div className="space-y-4 animate-fadeIn">
            
            {/* Admin Tabs */}
            <div className="flex bg-white/5 border border-white/10 p-1 rounded-xl gap-1">
              <button
                type="button"
                onClick={() => setAdminTab('users')}
                className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center space-x-1 ${
                  adminTab === 'users' 
                    ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-md' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <UserPlus className="w-3 h-3" />
                <span>{lang === 'uz' ? 'Ishchilar' : 'Workers'}</span>
              </button>
              <button
                type="button"
                onClick={() => setAdminTab('transactions')}
                className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center space-x-1 ${
                  adminTab === 'transactions' 
                    ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-md' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <History className="w-3 h-3" />
                <span>{lang === 'uz' ? 'Xaridlar' : 'Ledger'}</span>
              </button>
              <button
                type="button"
                onClick={() => setAdminTab('analytics')}
                className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center space-x-1 ${
                  adminTab === 'analytics' 
                    ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-md' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <TrendingUp className="w-3 h-3" />
                <span>{lang === 'uz' ? 'Tahlil' : 'Stats'}</span>
              </button>
            </div>

            {/* TAB 1: ADD AUTHORIZED PHONE */}
            {adminTab === 'users' && (
              <div className="space-y-4 animate-slideDown">
                <form onSubmit={handleAddUser} className="glass-panel p-5 rounded-2xl glow-purple space-y-4">
                  <div className="flex items-center space-x-2 border-b border-white/10 pb-3">
                    <UserPlus className="text-purple-400 w-5 h-5" />
                    <h2 className="text-sm font-semibold tracking-wider uppercase text-gray-200">{t.addUser}</h2>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs text-gray-400 font-medium">{t.userName}</label>
                    <input
                      type="text"
                      placeholder="e.g. Komron Xabibov"
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-purple-500 transition-colors"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs text-gray-400 font-medium">{t.userPhone}</label>
                    <input
                      type="text"
                      placeholder="e.g. +998901234567"
                      value={newUserPhone}
                      onChange={(e) => setNewUserPhone(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-purple-500 transition-colors font-bold"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 font-bold rounded-xl text-xs transition-all duration-300 transform active:scale-[0.98] shadow-lg shadow-purple-500/10 flex justify-center items-center space-x-2 text-white"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{t.saveUser}</span>
                  </button>
                </form>

                {/* Directory / Access List */}
                <div className="glass-panel p-5 rounded-2xl space-y-4">
                  <div className="flex justify-between items-center border-b border-white/10 pb-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-200">
                      {lang === 'uz' ? 'Ruxsat berilgan ishchilar' : 'Allowed Workers'}
                    </span>
                    <span className="text-[10px] text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2.5 py-0.5 rounded-full font-extrabold">{allUsers.length}</span>
                  </div>

                  {allUsers.length > 0 ? (
                    <div className="space-y-2.5 max-h-60 overflow-y-auto">
                      {allUsers.map((u) => (
                        <div key={u.phone} className="flex justify-between items-center p-3 bg-white/3 rounded-xl border border-white/5">
                          <div>
                            <div className="text-xs font-bold text-gray-200">{u.name}</div>
                            <div className="text-[10px] text-gray-500 mt-0.5">{u.phone}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(u.phone)}
                            className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg text-[10px] font-bold border border-rose-500/10 active:scale-95 transition-all"
                          >
                            {lang === 'uz' ? "O'chirish" : 'Delete'}
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-xs text-gray-500 font-light">
                      {lang === 'uz' ? 'Ishchilar ro\'yxati bo\'sh' : 'No allowed workers found.'}
                    </div>
                  )}
                </div>

                <div className="glass-panel p-4 rounded-2xl space-y-2 bg-purple-950/5 border-purple-500/10">
                  <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center">
                    <ShieldCheck className="w-4 h-4 mr-1.5" />
                    {lang === 'uz' ? 'Qo\'llanma' : 'Security Policy'}
                  </h3>
                  <p className="text-[10px] text-gray-400 leading-relaxed font-light">
                    {lang === 'uz' 
                      ? 'Tizimga faqat shu yerda kiritilgan telefon raqamlari orqali kirish mumkin. Agar raqam kiritilmagan bo\'lsa, Telegram bot ularga dastur havolasini taqdim etmaydi.'
                      : 'Only phone numbers recorded here can log in. Unauthorized users are blocked automatically.'}
                  </p>
                </div>
              </div>
            )}

            {/* TAB 2: TRANSACTIONS LIST FOR ADMIN */}
            {adminTab === 'transactions' && (
              <div className="space-y-4 animate-slideDown">
                {/* Search input */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder={lang === 'uz' ? 'Ishchi yoki mahsulot nomi bo\'yicha qidirish...' : 'Search by worker or product...'}
                    value={adminSearchQuery}
                    onChange={(e) => setAdminSearchQuery(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-4 pr-10 py-2.5 text-xs text-gray-200 focus:outline-none focus:border-purple-500 transition-colors font-semibold"
                  />
                  {adminSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setAdminSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs hover:text-white font-bold"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Live stats card for filtered list */}
                <div className="glass-panel p-4 rounded-2xl bg-gradient-to-tr from-cyan-500/5 to-purple-600/5 border-white/5 grid grid-cols-3 gap-2 text-center shadow-lg">
                  <div className="border-r border-white/5">
                    <div className="text-[8px] text-gray-400 uppercase tracking-widest">{lang === 'uz' ? 'Jami Sotuv' : 'Total Sales'}</div>
                    <div className="text-[11px] font-extrabold text-cyan-400 mt-1">
                      {formatCurrency(
                        allTransactions
                          .filter(item => {
                            const name = getUserName(item.phone).toLowerCase();
                            const prod = (products.find(p => p.id === item.productId)?.name || '').toLowerCase();
                            const query = adminSearchQuery.toLowerCase();
                            return name.includes(query) || prod.includes(query) || item.phone.toLowerCase().includes(query);
                          })
                          .reduce((sum, item) => sum + item.totalPrice, 0)
                      )}
                    </div>
                  </div>
                  <div className="border-r border-white/5">
                    <div className="text-[8px] text-gray-400 uppercase tracking-widest">{lang === 'uz' ? "To'langan" : 'Total Paid'}</div>
                    <div className="text-[11px] font-extrabold text-emerald-400 mt-1">
                      {formatCurrency(
                        allTransactions
                          .filter(item => {
                            const name = getUserName(item.phone).toLowerCase();
                            const prod = (products.find(p => p.id === item.productId)?.name || '').toLowerCase();
                            const query = adminSearchQuery.toLowerCase();
                            return name.includes(query) || prod.includes(query) || item.phone.toLowerCase().includes(query);
                          })
                          .reduce((sum, item) => sum + item.amountPaid, 0)
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-[8px] text-gray-400 uppercase tracking-widest">{lang === 'uz' ? 'Qolgan Qarz' : 'Total Debt'}</div>
                    <div className="text-[11px] font-extrabold text-rose-400 mt-1">
                      {formatCurrency(
                        allTransactions
                          .filter(item => {
                            const name = getUserName(item.phone).toLowerCase();
                            const prod = (products.find(p => p.id === item.productId)?.name || '').toLowerCase();
                            const query = adminSearchQuery.toLowerCase();
                            return name.includes(query) || prod.includes(query) || item.phone.toLowerCase().includes(query);
                          })
                          .reduce((sum, item) => sum + item.remainingDebt, 0)
                      )}
                    </div>
                  </div>
                </div>

                {/* List of transactions */}
                <div className="space-y-3">
                  {allTransactions
                    .filter(item => {
                      const name = getUserName(item.phone).toLowerCase();
                      const prod = (products.find(p => p.id === item.productId)?.name || '').toLowerCase();
                      const query = adminSearchQuery.toLowerCase();
                      return name.includes(query) || prod.includes(query) || item.phone.toLowerCase().includes(query);
                    })
                    .map((item) => (
                      <div key={item.id} className="glass-panel p-4 rounded-2xl space-y-3 border-white/5">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[9px] text-purple-400 font-bold uppercase tracking-wider bg-purple-500/10 px-2.5 py-0.5 rounded-md">
                              {getUserName(item.phone)}
                            </span>
                            <div className="text-[11px] font-bold text-gray-200 mt-1.5">
                              {products.find(p => p.id === item.productId)?.name || item.productId}
                            </div>
                            <div className="text-[10px] text-gray-500 mt-0.5">{cleanDate(item.date)}</div>
                          </div>

                          <div className="text-right">
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                              item.status === 'Paid'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : item.status === 'Partially Paid'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}>
                              {item.status === 'Paid' ? t.paid : item.status === 'Partially Paid' ? t.partial : t.onlyDebt}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPurchase(item);
                                setEditWeight(item.quantityKg.toString());
                                setEditPrice(formatNumberInput(item.pricePerKg.toString()));
                                setEditPaid(formatNumberInput(item.amountPaid.toString()));
                              }}
                              className="block mt-2 text-[10px] font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-1 rounded-lg hover:bg-cyan-500/20 active:scale-95 transition-all ml-auto"
                            >
                              {lang === 'uz' ? 'Tahrirlash' : 'Edit'}
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 border-t border-b border-white/5 py-2 text-center text-[10px]">
                          <div>
                            <div className="text-[8px] text-gray-500 uppercase tracking-widest">{lang === 'uz' ? 'Og\'irlik' : 'Weight'}</div>
                            <div className="font-bold text-gray-300">{item.quantityKg} kg</div>
                          </div>
                          <div>
                            <div className="text-[8px] text-gray-500 uppercase tracking-widest">{lang === 'uz' ? 'Narxi' : 'Price'}</div>
                            <div className="font-bold text-gray-300">{formatCurrency(item.pricePerKg)}/kg</div>
                          </div>
                          <div>
                            <div className="text-[8px] text-gray-500 uppercase tracking-widest">{lang === 'uz' ? 'Jami' : 'Total'}</div>
                            <div className="font-extrabold text-cyan-400">{formatCurrency(item.totalPrice)}</div>
                          </div>
                        </div>

                        <div className="flex justify-between text-[11px] font-medium text-gray-400">
                          <span>
                            {lang === 'uz'
                              ? `To'langan: ${formatCurrency(item.amountPaid)}`
                              : `Paid: ${formatCurrency(item.amountPaid)}`}
                          </span>
                          {item.remainingDebt > 0 && (
                            <span className="text-rose-400 font-bold">
                              {t.remainingDebt}: {formatCurrency(item.remainingDebt)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* TAB 3: ANALYTICS / STATS OVERVIEW */}
            {adminTab === 'analytics' && (
              <div className="space-y-4 animate-slideDown">
                <div className="grid grid-cols-2 gap-3">
                  <div className="glass-panel p-4 rounded-2xl space-y-1">
                    <span className="text-[9px] text-gray-500 uppercase tracking-widest">{lang === 'uz' ? 'Sotilgan mahsulotlar' : 'Products Ledger'}</span>
                    <div className="text-2xl font-extrabold text-cyan-400">4 Items</div>
                  </div>
                  <div className="glass-panel p-4 rounded-2xl space-y-1">
                    <span className="text-[9px] text-gray-500 uppercase tracking-widest">{lang === 'uz' ? 'Server status' : 'System Status'}</span>
                    <div className="text-xs font-bold text-emerald-400 uppercase flex items-center pt-1.5">
                      <span className="inline-block w-2 h-2 bg-emerald-500 rounded-full mr-1.5 animate-pulse"></span>
                      ONLINE
                    </div>
                  </div>
                </div>

                <div className="glass-panel p-4 rounded-2xl space-y-2">
                  <span className="text-[9px] text-gray-500 uppercase tracking-widest block">{lang === 'uz' ? 'Ma\'lumotlar manbasi' : 'Data Integrity'}</span>
                  <div className="text-xs text-gray-300 leading-relaxed font-light">
                    {lang === 'uz'
                      ? 'Barcha hisob-kitoblar real vaqt rejimida Google Sheets bilan sinxronlangan. Administrator istalgan vaqtda to\'g\'ridan-to\'g\'ri Google Jadval orqali hisobotlarni Excel shaklida ko\'chirib olishi mumkin.'
                      : 'All transactions are logged live to Google Sheets. You can download invoices, generate charts, and view logs inside the linked Google Spreadsheet.'
                    }
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ADMIN TRANSACTION EDITING MODAL OVERLAY */}
        {editingPurchase && (
          <div className="fixed inset-0 z-50 bg-[#000]/80 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
            <form onSubmit={handleUpdatePurchase} className="glass-panel p-6 rounded-2xl w-full max-w-sm space-y-4 border border-cyan-500/30 glow-cyan">
              <div className="flex justify-between items-center border-b border-white/10 pb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                  {lang === 'uz' ? "Xaridni tahrirlash" : "Edit Purchase"}
                </span>
                <span className="text-[10px] text-gray-500">ID: {editingPurchase.id}</span>
              </div>

              <div className="text-[10px] text-gray-400 space-y-0.5">
                <div>{lang === 'uz' ? "Ishchi" : "Worker"}: <span className="font-bold text-gray-200">{getUserName(editingPurchase.phone)}</span></div>
                <div>{lang === 'uz' ? "Mahsulot" : "Product"}: <span className="font-bold text-gray-200">{products.find(p => p.id === editingPurchase.productId)?.name || editingPurchase.productId}</span></div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-400 font-semibold uppercase">{lang === 'uz' ? 'Og\'irlik (KG)' : 'Weight (KG)'}</label>
                <input
                  type="number"
                  step="any"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-gray-200 font-bold focus:outline-none focus:border-cyan-500"
                  value={editWeight}
                  onChange={(e) => setEditWeight(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-400 font-semibold uppercase">{lang === 'uz' ? 'Narx (UZS)' : 'Price (UZS)'}</label>
                <input
                  type="text"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-gray-200 font-bold focus:outline-none focus:border-cyan-500"
                  value={editPrice}
                  onChange={(e) => setEditPrice(formatNumberInput(e.target.value))}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-400 font-semibold uppercase">{lang === 'uz' ? 'To\'langan (UZS)' : 'Amount Paid (UZS)'}</label>
                <input
                  type="text"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-gray-200 font-bold focus:outline-none focus:border-cyan-500"
                  value={editPaid}
                  onChange={(e) => setEditPaid(formatNumberInput(e.target.value))}
                />
              </div>

              <div className="bg-white/3 p-3 rounded-xl border border-white/5 text-[11px] space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-400">{lang === 'uz' ? 'Yangi Jami' : 'New Total'}:</span>
                  <span className="font-bold text-cyan-400">
                    {formatCurrency((parseFloat(editWeight) || 0) * parseFormattedNumber(editPrice))}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">{lang === 'uz' ? 'Yangi Qarz' : 'New Debt'}:</span>
                  <span className="font-bold text-rose-400">
                    {formatCurrency(Math.max(0, ((parseFloat(editWeight) || 0) * parseFormattedNumber(editPrice)) - parseFormattedNumber(editPaid)))}
                  </span>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 font-bold rounded-xl text-xs transition-all text-white shadow-md active:scale-95"
                >
                  {lang === 'uz' ? 'Saqlash' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingPurchase(null)}
                  className="px-4 py-2.5 bg-white/5 border border-white/10 text-xs font-semibold rounded-xl text-gray-400 hover:text-white"
                >
                  {lang === 'uz' ? 'Bekor qilish' : 'Cancel'}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>

      {/* Footer / Copyright */}
      <footer className="glass-panel px-4 py-2 border-t border-white/5 text-center text-[9px] text-gray-500 font-semibold tracking-wide flex justify-between items-center">
        <span>{lang === 'uz' ? 'dukon Daftari' : 'dukon Daftari Ledger'}</span>
        <span>v1.0.0</span>
      </footer>
    </div>
  );
}
