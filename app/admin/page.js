'use client'

import { useState, useEffect } from 'react'
import { db } from '../../lib/firebase'
import { collection, addDoc, updateDoc, deleteDoc, doc, getDoc, getDocs, query, orderBy, onSnapshot, serverTimestamp, increment } from 'firebase/firestore'

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  
  // Firebase states
  const [saldoMasjid, setSaldoMasjid] = useState(0)
  const [transactions, setTransactions] = useState([])
  const [hadiths, setHadiths] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingHadiths, setLoadingHadiths] = useState(true)
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    notes: '',
    type: 'income' // 'income' or 'expense'
  })
  const [editingId, setEditingId] = useState(null)
  const [showConfirmDelete, setShowConfirmDelete] = useState(null)
  
  // Hadith form state
  const [hadithForm, setHadithForm] = useState({
    arabic: '',
    translation: '',
    source: '',
    category: '',
    position: ''
  })
  const [editingHadithId, setEditingHadithId] = useState(null)

  // Fetch saldo and transactions from Firebase
  useEffect(() => {
    // Subscribe to real-time updates for the main cash document
    const cashDocRef = doc(db, 'MasjidBakrie', '12S687VkZHdxufuD6Uzj')
    
    const unsubscribe = onSnapshot(cashDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data()
        setSaldoMasjid(data.saldo || 0)
        setTransactions(data.transactions || [])
      } else {
        // Document doesn't exist yet, initialize with empty data
        setSaldoMasjid(0)
        setTransactions([])
      }
      setLoading(false)
    }, (error) => {
      console.error('Error fetching cash data:', error)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  // Fetch hadiths from Firestore
  useEffect(() => {
    setLoadingHadiths(true);
      
    // Use sub-collection under MasjidBakrie document with correct ID
    const hadithsRef = collection(db, 'MasjidBakrie', 'yHXCuejUUlzeO6yMLTey', 'hadiths');
    const q = query(hadithsRef, orderBy('position', 'asc'));
      
    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log('📚 Hadiths snapshot received:', snapshot.size);
      const hadithsData = [];
      snapshot.forEach((doc) => {
        hadithsData.push({ id: doc.id, ...doc.data() });
      });
      setHadiths(hadithsData);
      setLoadingHadiths(false);
      console.log('✅ Hadiths loaded:', hadithsData.length);
    }, (error) => {
      console.error('❌ Error fetching hadiths:', error);
      setHadiths([]);
      setLoadingHadiths(false);
    });
  
    return () => {
      console.log('🧹 Cleaning up hadiths listener');
      unsubscribe();
    };
  }, []);

  // Add transaction
  const handleAddTransaction = async (e, type) => {
    e.preventDefault()
    try {
      const amount = parseFloat(formData.amount)
      if (!formData.description || isNaN(amount) || amount <= 0) {
        alert('Mohon isi data dengan benar!')
        return
      }

      const cashDocRef = doc(db, 'MasjidBakrie', '12S687VkZHdxufuD6Uzj')
      
      // Create new transaction object with proper date fields
      const now = new Date()
      const newTransaction = {
        id: Date.now().toString(),
        description: formData.description,
        amount: amount,
        notes: formData.notes || '',
        type: type,
        createdAt: now.toISOString(), // ISO format for sorting/filtering
        date: now.toLocaleDateString('id-ID', { // Readable Indonesian format
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        time: now.toLocaleTimeString('id-ID', { // Time format
          hour: '2-digit',
          minute: '2-digit'
        })
      }

      // Get current saldo
      const docSnap = await getDoc(cashDocRef)
      const currentData = docSnap.exists() ? docSnap.data() : { saldo: 0, transactions: [] }
      const currentSaldo = currentData.saldo || 0
      const currentTransactions = currentData.transactions || []
      
      // Calculate new saldo
      const newSaldo = type === 'income' 
        ? currentSaldo + amount 
        : currentSaldo - amount

      // Update document with new transaction and saldo
      await updateDoc(cashDocRef, {
        saldo: newSaldo,
        transactions: [newTransaction, ...currentTransactions]
      })

      // Reset form
      setFormData({ description: '', amount: '', notes: '', type: 'income' })
      alert('Transaksi berhasil ditambahkan!')
    } catch (error) {
      console.error('Error adding transaction:', error)
      alert('Gagal menambahkan transaksi. Silakan coba lagi.')
    }
  }

  // Update transaction
  const handleUpdateTransaction = async (e, id, currentType) => {
    e.preventDefault()
    try {
      const amount = parseFloat(formData.amount)
      if (!formData.description || isNaN(amount) || amount <= 0) {
        alert('Mohon isi data dengan benar!')
        return
      }

      const cashDocRef = doc(db, 'MasjidBakrie', '12S687VkZHdxufuD6Uzj')
      
      // Find old transaction
      const oldTransaction = transactions.find(t => t.id === id)
      const oldAmount = parseFloat(oldTransaction?.amount) || 0
      
      // Get current saldo from Firestore
      const docSnap = await getDoc(cashDocRef)
      const currentData = docSnap.exists() ? docSnap.data() : { saldo: 0, transactions: [] }
      let currentSaldo = currentData.saldo || 0
      
      // Adjust saldo based on changes
      // First, remove old transaction effect
      currentSaldo = currentType === 'income' 
        ? currentSaldo - oldAmount 
        : currentSaldo + oldAmount
      
      // Then add new transaction effect
      currentSaldo = formData.type === 'income' 
        ? currentSaldo + amount 
        : currentSaldo - amount

      // Update transaction in array
      const updatedTransactions = transactions.map(t => 
        t.id === id 
          ? { ...t, description: formData.description, amount: amount, notes: formData.notes || '', type: formData.type }
          : t
      )

      // Update document
      await updateDoc(cashDocRef, {
        saldo: currentSaldo,
        transactions: updatedTransactions
      })

      // Reset form
      setFormData({ description: '', amount: '', notes: '', type: 'income' })
      setEditingId(null)
      alert('Transaksi berhasil diupdate!')
    } catch (error) {
      console.error('Error updating transaction:', error)
      alert('Gagal mengupdate transaksi. Silakan coba lagi.')
    }
  }

  // Delete transaction
  const handleDeleteTransaction = async (id) => {
    if (!confirm('Apakah Anda yakin ingin menghapus transaksi ini?')) {
      return
    }

    try {
      const cashDocRef = doc(db, 'MasjidBakrie', '12S687VkZHdxufuD6Uzj')
      
      // Find transaction to get amount and type
      const transactionToDelete = transactions.find(t => t.id === id)
      const amount = parseFloat(transactionToDelete?.amount) || 0
      const type = transactionToDelete?.type
      
      // Get current saldo from Firestore
      const docSnap = await getDoc(cashDocRef)
      const currentData = docSnap.exists() ? docSnap.data() : { saldo: 0, transactions: [] }
      let currentSaldo = currentData.saldo || 0
      
      // Adjust saldo: reverse the effect of deleted transaction
      currentSaldo = type === 'income' 
        ? currentSaldo - amount 
        : currentSaldo + amount

      // Remove transaction from array
      const updatedTransactions = transactions.filter(t => t.id !== id)

      // Update document
      await updateDoc(cashDocRef, {
        saldo: currentSaldo,
        transactions: updatedTransactions
      })
      
      alert('Transaksi berhasil dihapus!')
      setShowConfirmDelete(null)
    } catch (error) {
      console.error('Error deleting transaction:', error)
      alert('Gagal menghapus transaksi. Silakan coba lagi.')
    }
  }

  // Edit transaction setup
  const handleEditClick = (transaction) => {
    setFormData({
      description: transaction.description,
      amount: transaction.amount.toString(),
      notes: transaction.notes || '',
      type: transaction.type
    })
    setEditingId(transaction.id)
    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Cancel edit
  const handleCancelEdit = () => {
    setFormData({ description: '', amount: '', notes: '', type: 'income' })
    setEditingId(null)
  }

  // Add/Update Hadith
  const handleAddHadith = async (e) => {
    e.preventDefault()
    try {
      console.log('📝 Saving hadith...', hadithForm);
      
      if (!hadithForm.arabic || !hadithForm.translation || !hadithForm.source || !hadithForm.category) {
        alert('Mohon lengkapi semua data hadits!')
        return
      }

      // Use sub-collection under correct MasjidBakrie document ID
      const hadithsRef = collection(db, 'MasjidBakrie', 'yHXCuejUUlzeO6yMLTey', 'hadiths');
      
      const hadithData = {
        arabic: hadithForm.arabic,
        translation: hadithForm.translation,
        source: hadithForm.source,
        category: hadithForm.category,
        position: parseInt(hadithForm.position) || 0,
        createdAt: new Date().toISOString()
      }

      console.log('💾 Hadith data to save:', hadithData);

      if (editingHadithId) {
        // Update existing hadith
        console.log('✏️ Updating hadith ID:', editingHadithId);
        const docRef = doc(db, 'MasjidBakrie', 'yHXCuejUUlzeO6yMLTey', 'hadiths', editingHadithId)
        await updateDoc(docRef, hadithData)
        alert('Hadits berhasil diupdate!')
      } else {
        // Add new hadith
        console.log('➕ Adding new hadith');
        const docRef = await addDoc(hadithsRef, hadithData)
        console.log('✅ Hadith saved with ID:', docRef.id);
        alert('Hadits berhasil ditambahkan!')
      }

      // Reset form
      setHadithForm({
        arabic: '',
        translation: '',
        source: '',
        category: '',
        position: ''
      })
      setEditingHadithId(null)
    } catch (error) {
      console.error('❌ Error saving hadith:', error)
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        stack: error.stack
      });
      alert(`Gagal menyimpan hadits.\n\nError: ${error.message}\n\nSilakan periksa console untuk detail.`);
    }
  }

  // Edit hadith setup
  const handleEditHadithClick = (hadith) => {
    setHadithForm({
      arabic: hadith.arabic,
      translation: hadith.translation,
      source: hadith.source,
      category: hadith.category,
      position: hadith.position?.toString() || ''
    })
    setEditingHadithId(hadith.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Delete hadith
  const handleDeleteHadith = async (id) => {
    if (!confirm('Apakah Anda yakin ingin menghapus hadits ini?')) {
      return
    }

    try {
      console.log('🗑️ Deleting hadith ID:', id);
      // Use sub-collection under correct MasjidBakrie document ID
      const docRef = doc(db, 'MasjidBakrie', 'yHXCuejUUlzeO6yMLTey', 'hadiths', id)
      await deleteDoc(docRef)
      console.log('✅ Hadith deleted successfully');
      alert('Hadits berhasil dihapus!')
    } catch (error) {
      console.error('❌ Error deleting hadith:', error)
      console.error('Error details:', {
        code: error.code,
        message: error.message
      });
      alert(`Gagal menghapus hadits.\n\nError: ${error.message}`);
    }
  }

  // Cancel edit hadith
  const handleCancelEditHadith = () => {
    setHadithForm({
      arabic: '',
      translation: '',
      source: '',
      category: '',
      position: ''
    })
    setEditingHadithId(null)
  }

  // Mock data
  const stats = {
    totalHadiths: hadiths.length,
    totalInfaq: transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0),
    totalExpenses: transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0)
  }

  const recentTransactions = transactions.slice(0, 5)

  const formatRupiah = (angka) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(angka)
  }

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'hadiths', label: 'Manajemen Hadits', icon: '📖' },
    { id: 'finance', label: 'Keuangan', icon: '💰' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 h-full w-[280px] max-w-[85vw] bg-slate-900 border-r border-slate-700 transform transition-transform duration-300 ease-in-out z-50 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        {/* Logo */}
        <div className="h-16 flex items-center px-4 sm:px-6 border-b border-slate-700">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-xl text-white">🕌</span>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-sm font-bold text-white truncate">Admin Panel</h1>
              <p className="text-xs text-slate-400 truncate">Masjid Al Ihsan</p>
            </div>
          </div>
        </div>

        {/* Navigation - Scrollable on mobile */}
        <nav className="p-3 sm:p-4 space-y-1.5 sm:space-y-2 overflow-y-auto max-h-[calc(100vh-180px)]">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id)
                setSidebarOpen(false)
              }}
              className={`w-full flex items-center gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl transition-all text-sm sm:text-base ${
                activeTab === item.id
                  ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-lg shadow-emerald-500/30'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className="text-xl flex-shrink-0">{item.icon}</span>
              <span className="font-medium truncate">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 bg-gradient-to-t from-slate-900 to-transparent">
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-all text-sm sm:text-base">
            <span className="text-xl">🚪</span>
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:ml-64 min-h-screen">
        {/* Top Bar */}
        <header className="h-14 sm:h-16 bg-slate-900/50 backdrop-blur-xl border-b border-slate-700 sticky top-0 z-30">
          <div className="h-full px-3 sm:px-4 lg:px-6 flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              aria-label="Toggle menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="flex items-center gap-2 sm:gap-4">
              <div className="hidden xs:flex items-center gap-2 px-2.5 py-1.5 bg-slate-800 rounded-lg">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                <span className="text-xs sm:text-sm text-slate-300">Online</span>
              </div>
              <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-full flex items-center justify-center text-white font-semibold text-xs sm:text-sm flex-shrink-0">
                A
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6">
          {activeTab === 'dashboard' && (
            <div className="space-y-4 sm:space-y-6">
              {/* Page Header */}
              <div>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-1 sm:mb-2">Dashboard</h2>
                <p className="text-xs sm:text-sm text-slate-400">Ringkasan aktivitas masjid hari ini</p>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
                <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-slate-700">
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-xl flex items-center justify-center">
                      <span className="text-xl sm:text-2xl">📖</span>
                    </div>
                    <span className="text-[10px] sm:text-xs text-emerald-400 font-medium whitespace-nowrap ml-2">+2 mgg</span>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-bold text-white mb-1">{stats.totalHadiths}</h3>
                  <p className="text-xs sm:text-sm text-slate-400">Total Hadits</p>
                </div>

                <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-slate-700">
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-amber-500 to-amber-700 rounded-xl flex items-center justify-center">
                      <span className="text-xl sm:text-2xl">💰</span>
                    </div>
                    <span className="text-[10px] sm:text-xs text-emerald-400 font-medium whitespace-nowrap ml-2">+12%</span>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-bold text-white mb-1">{formatRupiah(stats.totalInfaq)}</h3>
                  <p className="text-xs sm:text-sm text-slate-400">Pemasukan</p>
                </div>

                <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-slate-700">
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-red-500 to-red-700 rounded-xl flex items-center justify-center">
                      <span className="text-xl sm:text-2xl">💳</span>
                    </div>
                    <span className="text-[10px] sm:text-xs text-red-400 font-medium whitespace-nowrap ml-2">-3%</span>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-bold text-white mb-1">{formatRupiah(stats.totalExpenses)}</h3>
                  <p className="text-xs sm:text-sm text-slate-400">Pengeluaran</p>
                </div>
              </div>

              {/* Recent Transactions */}
              <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-slate-700 overflow-hidden">
                <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-700">
                  <h3 className="text-base sm:text-lg font-semibold text-white">Transaksi Terakhir</h3>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1">5 transaksi terakhir</p>
                </div>
                
                {/* Mobile Card View */}
                <div className="lg:hidden divide-y divide-slate-700">
                  {recentTransactions.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-sm">
                      📭 Belum ada transaksi
                    </div>
                  ) : (
                    recentTransactions.map((transaction) => (
                      <div key={transaction.id} className="p-4 hover:bg-slate-800/50 transition-colors">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white break-words">{transaction.description}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                              {transaction.date || (transaction.createdAt?.toDate ? transaction.createdAt.toDate().toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : transaction.createdAt ? new Date(transaction.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '-')}
                            </p>
                          </div>
                          <span className={`inline-flex px-2 py-1 rounded-full text-[10px] font-medium whitespace-nowrap ${
                            transaction.type === 'income'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}>
                            {transaction.type === 'income' ? '📥' : '📤'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className={`text-sm font-bold ${
                            transaction.type === 'income' ? 'text-emerald-400' : 'text-red-400'
                          }`}>
                            {transaction.type === 'income' ? '+' : '-'}{formatRupiah(Math.abs(transaction.amount))}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                
                {/* Desktop Table View */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-900/50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Deskripsi</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Tanggal</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Tipe</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Jumlah</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                      {recentTransactions.length === 0 ? (
                        <tr>
                          <td colSpan="4" className="px-6 py-8 text-center text-slate-400 text-sm">
                            📭 Belum ada transaksi
                          </td>
                        </tr>
                      ) : (
                        recentTransactions.map((transaction) => (
                          <tr key={transaction.id} className="hover:bg-slate-800/50 transition-colors">
                            <td className="px-6 py-4 text-sm text-white break-words max-w-[200px]">{transaction.description}</td>
                            <td className="px-6 py-4 text-sm text-slate-400 whitespace-nowrap">
                              {transaction.date || (transaction.createdAt?.toDate ? transaction.createdAt.toDate().toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : transaction.createdAt ? new Date(transaction.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '-')}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                                transaction.type === 'income'
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : 'bg-red-500/20 text-red-400'
                              }`}>
                                {transaction.type === 'income' ? '📥 Pemasukan' : '📤 Pengeluaran'}
                              </span>
                            </td>
                            <td className={`px-6 py-4 text-right text-sm font-semibold whitespace-nowrap ${
                              transaction.type === 'income' ? 'text-emerald-400' : 'text-red-400'
                            }`}>
                              {transaction.type === 'income' ? '+' : '-'}{formatRupiah(Math.abs(transaction.amount))}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'hadiths' && (
            <div className="space-y-4 sm:space-y-6">
              {/* Page Header */}
              <div>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-1 sm:mb-2">Manajemen Hadits</h2>
                <p className="text-xs sm:text-sm text-slate-400">Kelola konten hadits yang ditampilkan</p>
              </div>

              {/* Add/Edit Form */}
              <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-slate-700 p-4 sm:p-6">
                <div className="flex items-center gap-3 mb-4 sm:mb-6">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-lg sm:text-xl">📖</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base sm:text-lg font-semibold text-white truncate">{editingHadithId ? 'Edit Hadits' : 'Tambah Hadits Baru'}</h3>
                    <p className="text-xs sm:text-sm text-slate-400">{editingHadithId ? 'Update data hadits' : 'Tambahkan hadits baru untuk ditampilkan'}</p>
                  </div>
                </div>

                <form onSubmit={handleAddHadith} className="space-y-3 sm:space-y-4">
                  <div>
                    <label className="block text-xs sm:text-sm text-slate-400 mb-2">Teks Arab</label>
                    <textarea 
                      value={hadithForm.arabic}
                      onChange={(e) => setHadithForm({ ...hadithForm, arabic: e.target.value })}
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-sm sm:text-base" 
                      rows="3" 
                      placeholder="اِتَّقِ اللّٰهَ حَيْثُمَا كُنْتَ"
                      dir="rtl"
                      style={{ fontFamily: "'Amiri', serif" }}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm text-slate-400 mb-2">Terjemahan</label>
                    <textarea 
                      value={hadithForm.translation}
                      onChange={(e) => setHadithForm({ ...hadithForm, translation: e.target.value })}
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-sm sm:text-base" 
                      rows="3" 
                      placeholder="Bertakwalah kepada Allah di mana saja engkau berada."
                      required
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-xs sm:text-sm text-slate-400 mb-2">Perawi (Source)</label>
                      <input 
                        type="text" 
                        value={hadithForm.source}
                        onChange={(e) => setHadithForm({ ...hadithForm, source: e.target.value })}
                        className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-sm sm:text-base" 
                        placeholder="HR. Tirmidzi"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm text-slate-400 mb-2">Kategori</label>
                      <input 
                        type="text" 
                        value={hadithForm.category}
                        onChange={(e) => setHadithForm({ ...hadithForm, category: e.target.value })}
                        className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-sm sm:text-base" 
                        placeholder="Takwa"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm text-slate-400 mb-2">Urutan Tampilan (Position)</label>
                    <input 
                      type="number" 
                      value={hadithForm.position}
                      onChange={(e) => setHadithForm({ ...hadithForm, position: e.target.value })}
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-sm sm:text-base" 
                      placeholder="1"
                      min="0"
                    />
                    <p className="text-[10px] sm:text-xs text-slate-400 mt-1">Semakin kecil angka, semakin awal ditampilkan</p>
                  </div>
                  <div className="flex flex-col xs:flex-row gap-2.5">
                    <button 
                      type="submit" 
                      className="flex-1 py-2.5 sm:py-3 rounded-xl font-medium transition-all text-xs sm:text-base whitespace-nowrap bg-gradient-to-r from-emerald-600 to-emerald-700 text-white hover:shadow-lg hover:shadow-emerald-500/30"
                    >
                      {editingHadithId ? '💾 Update Hadits' : '➕ Simpan Hadits'}
                    </button>
                    {editingHadithId && (
                      <button
                        type="button"
                        onClick={handleCancelEditHadith}
                        className="px-4 sm:px-6 py-2.5 sm:py-3 bg-slate-700 text-white rounded-xl hover:bg-slate-600 transition-all text-xs sm:text-base"
                      >
                        ❌ Batal
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Hadiths List */}
              <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-slate-700 p-4 sm:p-6">
                <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-3 mb-4 sm:mb-6">
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold text-white">Daftar Hadits</h3>
                    <p className="text-xs sm:text-sm text-slate-400 mt-1">Total {hadiths.length} hadits tersedia</p>
                  </div>
                </div>

                {loadingHadiths ? (
                  <div className="p-8 text-center">
                    <div className="inline-block w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-400 mt-3 text-sm sm:text-base">Memuat hadits...</p>
                  </div>
                ) : hadiths.length === 0 ? (
                  <div className="p-8 text-center">
                    <span className="text-4xl mb-3 block">📭</span>
                    <p className="text-slate-400 text-sm sm:text-base">Belum ada hadits</p>
                  </div>
                ) : (
                  <div className="space-y-2.5 sm:space-y-3">
                    {hadiths.map((hadith) => (
                      <div key={hadith.id} className="p-3 sm:p-4 bg-slate-900/50 rounded-xl border border-slate-700 hover:border-emerald-500/50 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-arabic text-right text-base sm:text-lg text-amber-300 mb-2 break-words" style={{ fontFamily: "'Amiri', serif", direction: 'rtl' }}>
                              {hadith.arabic}
                            </p>
                            <p className="text-xs sm:text-sm text-slate-300 mb-2 leading-relaxed">{hadith.translation}</p>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-[10px] sm:text-xs whitespace-nowrap">{hadith.category}</span>
                              <span className="text-[10px] sm:text-xs text-slate-500">{hadith.source}</span>
                              {hadith.position !== undefined && (
                                <span className="text-[10px] sm:text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">Posisi: {hadith.position}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                              onClick={() => handleEditHadithClick(hadith)}
                              className="p-1.5 sm:p-2 text-slate-400 hover:text-blue-400 transition-colors rounded-lg hover:bg-slate-800"
                              title="Edit"
                            >
                              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteHadith(hadith.id)}
                              className="p-1.5 sm:p-2 text-slate-400 hover:text-red-400 transition-colors rounded-lg hover:bg-slate-800"
                              title="Hapus"
                            >
                              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'finance' && (
            <div className="space-y-4 sm:space-y-6">
              <div>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-1 sm:mb-2">Keuangan</h2>
                <p className="text-xs sm:text-sm text-slate-400">Kelola pemasukan dan pengeluaran masjid</p>
              </div>

              {/* Saldo Card */}
              <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-xl">
                <div className="flex items-start justify-between gap-3 sm:gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-emerald-100 text-xs sm:text-sm mb-1 truncate">Saldo Saat Ini</p>
                    <h3 className="text-2xl xs:text-3xl sm:text-4xl font-bold text-white break-words">{loading ? 'Memuat...' : formatRupiah(saldoMasjid)}</h3>
                  </div>
                  <div className="w-14 h-14 xs:w-16 xs:h-16 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl xs:text-3xl">💰</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 text-emerald-100 text-xs sm:text-sm mt-3">
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full animate-pulse"></span>
                  <span className="truncate">{transactions.length} transaksi tercatat</span>
                </div>
              </div>

              {/* Add/Edit Transaction Form */}
              <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-slate-700 p-4 sm:p-6">
                <div className="flex items-start gap-2.5 sm:gap-3 mb-4 sm:mb-6">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-lg sm:text-xl">✏️</span>
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <h3 className="text-base sm:text-lg font-semibold text-white truncate">{editingId ? 'Edit Transaksi' : 'Tambah Transaksi Baru'}</h3>
                    <p className="text-xs sm:text-sm text-slate-400 mt-0.5">{editingId ? 'Update data transaksi' : 'Catat pemasukan atau pengeluaran baru'}</p>
                  </div>
                </div>
                <form onSubmit={(e) => editingId ? handleUpdateTransaction(e, editingId, transactions.find(t => t.id === editingId)?.type) : handleAddTransaction(e, formData.type)} className="space-y-3 sm:space-y-4">
                  <div>
                    <label className="block text-xs sm:text-sm text-slate-400 mb-2">Jenis Transaksi</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, type: 'income' })}
                        className={`flex-1 py-2.5 sm:py-3 px-2 sm:px-4 rounded-xl font-medium transition-all text-xs sm:text-base ${
                          formData.type === 'income'
                            ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-lg shadow-emerald-500/30'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        📥 Pemasukan
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, type: 'expense' })}
                        className={`flex-1 py-2.5 sm:py-3 px-2 sm:px-4 rounded-xl font-medium transition-all text-xs sm:text-base ${
                          formData.type === 'expense'
                            ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg shadow-red-500/30'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        📤 Pengeluaran
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm text-slate-400 mb-2">Sumber Dana / Keperluan</label>
                    <input 
                      type="text" 
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm sm:text-base" 
                      placeholder={formData.type === 'income' ? 'Cth: Infaq Jumat' : 'Cth: Pembelian air wudhu'}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm text-slate-400 mb-2">Jumlah (Rp)</label>
                    <input 
                      type="number" 
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm sm:text-base" 
                      placeholder="0"
                      min="1"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm text-slate-400 mb-2">Keterangan</label>
                    <textarea 
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm sm:text-base" 
                      rows="3" 
                      placeholder="Catatan tambahan..."
                    ></textarea>
                  </div>
                  <div className="flex flex-col xs:flex-row gap-2.5">
                    <button 
                      type="submit" 
                      className={`flex-1 py-2.5 sm:py-3 rounded-xl font-medium transition-all text-xs sm:text-base whitespace-nowrap ${
                        formData.type === 'income'
                          ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white hover:shadow-lg hover:shadow-emerald-500/30'
                          : 'bg-gradient-to-r from-red-600 to-red-700 text-white hover:shadow-lg hover:shadow-red-500/30'
                      }`}
                    >
                      {editingId ? '💾 Update' : (formData.type === 'income' ? '➕ Simpan Pemasukan' : '➖ Simpan Pengeluaran')}
                    </button>
                    {editingId && (
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="px-4 sm:px-6 py-2.5 sm:py-3 bg-slate-700 text-white rounded-xl hover:bg-slate-600 transition-all text-xs sm:text-base"
                      >
                        ❌ Batal
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Transactions List */}
              <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-slate-700 overflow-hidden">
                <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-700">
                  <h3 className="text-base sm:text-lg font-semibold text-white">Riwayat Transaksi</h3>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1">Semua transaksi pemasukan dan pengeluaran</p>
                </div>
                {loading ? (
                  <div className="p-6 sm:p-8 text-center">
                    <div className="inline-block w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-400 mt-3 text-sm sm:text-base">Memuat data...</p>
                  </div>
                ) : transactions.length === 0 ? (
                  <div className="p-6 sm:p-8 text-center">
                    <span className="text-4xl mb-3 block">📭</span>
                    <p className="text-slate-400 text-sm sm:text-base">Belum ada transaksi</p>
                  </div>
                ) : (
                  <>
                    {/* Mobile Card View */}
                    <div className="lg:hidden divide-y divide-slate-700">
                      {transactions.map((transaction) => (
                        <div key={transaction.id} className="p-4 hover:bg-slate-800/50 transition-colors">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-white break-words">{transaction.description}</p>
                              <p className="text-[10px] text-slate-400 mt-1 truncate">{transaction.notes || '-'}</p>
                              <p className="text-[10px] text-slate-500 mt-1">
                                {transaction.date || (transaction.createdAt?.toDate ? transaction.createdAt.toDate().toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : transaction.createdAt ? new Date(transaction.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-')}
                                {' • '}
                                {transaction.time || (transaction.createdAt?.toDate ? transaction.createdAt.toDate().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : transaction.createdAt ? new Date(transaction.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-')}
                              </p>
                            </div>
                            <span className={`inline-flex px-2 py-1 rounded-full text-[10px] font-medium whitespace-nowrap ${
                              transaction.type === 'income'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}>
                              {transaction.type === 'income' ? '📥' : '📤'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-700/50">
                            <p className={`text-lg font-bold ${
                              transaction.type === 'income' ? 'text-emerald-400' : 'text-red-400'
                            }`}>
                              {transaction.type === 'income' ? '+' : '-'}{formatRupiah(transaction.amount)}
                            </p>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleEditClick(transaction)}
                                className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors"
                                title="Edit"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDeleteTransaction(transaction.id)}
                                className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                                title="Hapus"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Desktop Table View */}
                    <div className="hidden lg:block overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-slate-900/50 sticky top-0">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider whitespace-nowrap">Deskripsi</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider whitespace-nowrap hidden md:table-cell">Keterangan</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider whitespace-nowrap">Tanggal</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider whitespace-nowrap hidden lg:table-cell">Waktu</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider whitespace-nowrap">Tipe</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider whitespace-nowrap">Jumlah</th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider whitespace-nowrap">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                          {transactions.map((transaction) => (
                            <tr key={transaction.id} className="hover:bg-slate-800/50 transition-colors">
                              <td className="px-6 py-4 text-sm text-white font-medium break-words max-w-[200px] align-top">
                                <div className="font-medium">{transaction.description}</div>
                                {transaction.notes && (
                                  <div className="text-slate-400 text-xs mt-1 truncate max-w-[180px]">{transaction.notes}</div>
                                )}
                              </td>
                              <td className="px-6 py-4 text-sm text-slate-400 align-top hidden md:table-cell">
                                <div className="max-w-[200px] truncate">{transaction.notes || '-'}</div>
                              </td>
                              <td className="px-6 py-4 text-sm text-slate-400 whitespace-nowrap align-top">
                                {transaction.date || (transaction.createdAt?.toDate ? transaction.createdAt.toDate().toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : transaction.createdAt ? new Date(transaction.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-')}
                              </td>
                              <td className="px-6 py-4 text-sm text-slate-400 whitespace-nowrap align-top hidden lg:table-cell">
                                {transaction.time || (transaction.createdAt?.toDate ? transaction.createdAt.toDate().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : transaction.createdAt ? new Date(transaction.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-')}
                              </td>
                              <td className="px-6 py-4 align-top">
                                <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                                  transaction.type === 'income'
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : 'bg-red-500/20 text-red-400'
                                }`}>
                                  {transaction.type === 'income' ? '📥 Pemasukan' : '📤 Pengeluaran'}
                                </span>
                              </td>
                              <td className={`px-6 py-4 text-right text-sm font-bold whitespace-nowrap align-top ${
                                transaction.type === 'income' ? 'text-emerald-400' : 'text-red-400'
                              }`}>
                                {transaction.type === 'income' ? '+' : '-'}{formatRupiah(transaction.amount)}
                              </td>
                              <td className="px-6 py-4 align-top">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => handleEditClick(transaction)}
                                    className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors"
                                    title="Edit"
                                    aria-label="Edit transaction"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => handleDeleteTransaction(transaction.id)}
                                    className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                                    title="Hapus"
                                    aria-label="Delete transaction"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
