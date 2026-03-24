'use client'

import { useState, useEffect } from 'react'
import { db } from '../lib/firebase'
import { doc, onSnapshot, collection, query, orderBy } from 'firebase/firestore'

function App() {
  // Firebase states
  const [hadiths, setHadiths] = useState([]);
  const [loadingHadiths, setLoadingHadiths] = useState(true);
  const [currentHadithIndex, setCurrentHadithIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(15);
  const [currentTime, setCurrentTime] = useState(new Date()); // Start with current date - no hydration issue now
  const [isClient, setIsClient] = useState(false);
  
  // Firebase state for saldo and transactions (independent from hadiths)
  const [saldoMasjid, setSaldoMasjid] = useState(0);
  const [loadingSaldo, setLoadingSaldo] = useState(true);
  const [transactions, setTransactions] = useState([]);

  // Fetch hadiths from Firestore (INDEPENDENT - doesn't wait for anything)
  useEffect(() => {
    // Mark component as mounted on client FIRST
    setIsClient(true);
    
    console.log('📖 Fetching hadiths from Firestore...');
    setLoadingHadiths(true);
    
    // Use sub-collection under correct MasjidBakrie document ID
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
  }, []); // Remove isClient dependency - only run once on mount

  // Efek untuk rotasi hadith dan waktu (ONLY runs when hadiths are loaded)
  useEffect(() => {
    // Only start rotation AFTER hadiths are loaded
    if (loadingHadiths || hadiths.length === 0) {
      if (!loadingHadiths && hadiths.length === 0) {
        console.log('⚠️ No hadiths available, skipping rotation');
      }
      return;
    }
    
    console.log('▶️ Starting hadith rotation with', hadiths.length, 'hadiths');
    
    const interval = setInterval(() => {
      setCurrentHadithIndex((prevIndex) => 
        (prevIndex + 1) % hadiths.length
      );
      setTimeLeft(15);
    }, 15000);

    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 15));
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(timer);
    };
  }, [hadiths.length, loadingHadiths]);

  // Update current time every second
  useEffect(() => {
    setIsClient(true);
    
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  // Efek untuk fetch saldo dari Firestore secara real-time
  useEffect(() => {
    console.log('🔍 Fetching saldo from Firestore...');
    setLoadingSaldo(true);
    
    // Subscribe to real-time updates for the main cash document
    const cashDocRef = doc(db, 'MasjidBakrie', '12S687VkZHdxufuD6Uzj');
    
    const unsubscribe = onSnapshot(cashDocRef, (docSnap) => {
      console.log('📄 Document snapshot received:', docSnap.exists());
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        console.log('💰 Saldo data:', data.saldo);
        setSaldoMasjid(data.saldo || 0);
        setTransactions(data.transactions || []);
      } else {
        console.log('⚠️ Document does not exist yet');
        // Document doesn't exist yet, set to 0
        setSaldoMasjid(0);
        setTransactions([]);
      }
      setLoadingSaldo(false);
      const data = docSnap.exists() ? docSnap.data() : null;
      console.log('✅ Loading complete, saldo:', data?.saldo || 0);
    }, (error) => {
      console.error('❌ Error fetching saldo:', error);
      setSaldoMasjid(0);
      setTransactions([]);
      setLoadingSaldo(false);
    });

    return () => {
      console.log('🧹 Cleaning up Firestore listener');
      unsubscribe();
    };
  }, []); // Run once on mount - independent of isClient
  
  // Get current date
  const getCurrentDate = () => {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return new Date().toLocaleDateString('id-ID', options);
  };
  
  const formatRupiah = (angka) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(angka);
  };

  // Get latest income transaction
  const getLatestIncome = () => {
    const incomeTransactions = transactions.filter(t => t.type === 'income');
    return incomeTransactions.length > 0 ? incomeTransactions[0] : null;
  };

  // Get latest expense transaction
  const getLatestExpense = () => {
    const expenseTransactions = transactions.filter(t => t.type === 'expense');
    return expenseTransactions.length > 0 ? expenseTransactions[0] : null;
  };

  // Format date for display
  const formatTransactionDate = (transaction) => {
    if (!transaction) return '-';
    
    // Try using the date field first (new format)
    if (transaction.date) {
      return transaction.date;
    }
    
    // Fallback to createdAt
    if (transaction.createdAt) {
      try {
        // Check if it's a Firestore timestamp
        if (typeof transaction.createdAt.toDate === 'function') {
          return transaction.createdAt.toDate().toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          });
        }
        // Otherwise parse as ISO string
        return new Date(transaction.createdAt).toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        });
      } catch (e) {
        return '-';
      }
    }
    
    return '-';
  };

  const formatTime = (date) => {
    if (!date) return '00:00:00';
    return date.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="min-h-screen w-screen overflow-hidden bg-emerald-900 font-sans relative" style={{ background: 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)' }}>
      
      {/* Islamic Pattern Background - Premium Gold */}
      <div className="absolute inset-0 opacity-15">
        <div className="absolute top-0 left-0 w-full h-full" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='120' height='120' viewBox='0 0 120 120' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M60 20L95 55L60 90L25 55L60 20Z' fill='none' stroke='%23FFD700' stroke-width='1.5'/%3E%3C/svg%3E")`,
          backgroundSize: '140px 140px',
          backgroundRepeat: 'repeat'
        }}></div>
      </div>

      {/* Ambient Light Orbs - Gold & Emerald - Simplified for WebOS */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-amber-500 rounded-full" style={{ opacity: 0.15, filter: 'blur(100px)' }}></div>
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-emerald-600 rounded-full" style={{ opacity: 0.15, filter: 'blur(100px)' }}></div>

      {/* Header */}
      <header className="relative h-[12vh] lg:h-[14vh] px-4 lg:px-8 pt-2 lg:pt-4 z-10">
        <div className="flex items-start justify-between flex-wrap gap-3">
          {/* Logo and Title */}
          <div className="flex items-center gap-3 lg:gap-4 min-w-[250px]">
            <div className="relative flex-shrink-0">
              <div className="w-12 h-12 lg:w-14 lg:h-14 xl:w-16 xl:h-16 bg-gradient-to-br from-amber-500 to-amber-700 rounded-2xl shadow-2xl flex items-center justify-center border-2 border-amber-300">
                <span className="text-2xl lg:text-3xl text-white drop-shadow-lg">🕌</span>
              </div>
              <div className="absolute -top-1 -right-1 w-2 h-2 lg:w-3 lg:h-3 bg-emerald-400 rounded-full animate-pulse"></div>
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-sm sm:text-base lg:text-xl xl:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-400 tracking-wide truncate">
                MASJID AL IHSAN BAKRIE PT.CPM
              </h1>
              <p className="text-[10px] sm:text-xs lg:text-sm text-emerald-300 tracking-wider mt-0.5 truncate">BERKAH • ISTIQOMAH • BERDAYA</p>
            </div>
          </div>

          {/* Date and Time Card */}
          <div className="rounded-2xl lg:rounded-3xl px-4 lg:px-6 xl:px-8 py-2 lg:py-3 shadow-2xl border-2 border-amber-500" style={{ backgroundColor: 'rgba(6, 78, 59, 0.95)' }}>
            {isClient && currentTime ? (
              <>
                <div 
                  className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-light text-amber-300 tabular-nums drop-shadow-lg"
                  suppressHydrationWarning
                >
                  {formatTime(currentTime)}
                </div>
                <div 
                  className="text-[9px] sm:text-xs lg:text-sm text-emerald-200 text-right font-light mt-0.5 lg:mt-1"
                  suppressHydrationWarning
                >
                  {getCurrentDate()}
                </div>
              </>
            ) : (
              // Placeholder to prevent hydration mismatch
              <>
                <div className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-light text-amber-300 tabular-nums drop-shadow-lg">
                  00:00:00
                </div>
                <div className="text-[9px] sm:text-xs lg:text-sm text-emerald-200 text-right font-light mt-0.5 lg:mt-1">
                  Memuat...
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="h-[76vh] lg:h-[78vh] xl:h-[80vh] px-3 lg:px-6 xl:px-8 flex flex-col lg:flex-row gap-3 lg:gap-5 xl:gap-6 z-10 relative">
        
        {/* Left Column - Hadits Card */}
        <div className="w-full lg:w-[70%] flex flex-col h-full">
          {/* Section Label */}
          <div className="flex items-center gap-2 lg:gap-3 mb-2 lg:mb-3 flex-shrink-0">
            <div className="w-1 h-4 lg:h-5 bg-amber-500 rounded-full"></div>
            <h2 className="text-[10px] sm:text-xs lg:text-sm font-medium text-amber-400 uppercase" style={{ letterSpacing: '0.2em' }}>
              HADITS PILIHAN
            </h2>
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, rgb(245, 158, 11), transparent)' }}></div>
            
            {/* Progress Indicator */}
            <div className="flex items-center gap-1 lg:gap-2">
              <span className="text-[9px] sm:text-[10px] lg:text-xs text-amber-300">Next in</span>
              <div className="w-12 sm:w-16 lg:w-20 h-2 bg-emerald-800 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full"
                  style={{ 
                    width: `${(timeLeft / 15) * 100}%`,
                    background: 'linear-gradient(to right, rgb(245, 158, 11), rgb(217, 119, 6))',
                    transition: 'width 1s linear'
                  }}
                ></div>
              </div>
              <span className="text-[9px] sm:text-[10px] lg:text-xs text-amber-400 font-mono font-medium">{timeLeft}s</span>
            </div>
          </div>

          {/* Hadits Card */}
          <div className="flex-1 rounded-2xl lg:rounded-[2rem] shadow-2xl border-2 border-amber-500 overflow-hidden min-h-0" style={{ backgroundColor: 'rgba(6, 78, 59, 0.85)' }}>
            
            <div className="h-full flex flex-col">
              {/* Category Badge */}
              <div className="px-4 sm:px-6 lg:px-8 pt-4 lg:pt-6 flex-shrink-0">
                {hadiths[currentHadithIndex] ? (
                  <span className="inline-block px-3 sm:px-4 lg:px-5 py-1 sm:py-1.5 lg:py-2 rounded-full text-amber-50 text-[10px] sm:text-xs lg:text-sm font-semibold shadow-xl border-2 border-amber-400" style={{ backgroundColor: 'rgb(245, 158, 11)' }}>
                    {hadiths[currentHadithIndex].category.toUpperCase()}
                  </span>
                ) : (
                  <span className="inline-block px-3 sm:px-4 lg:px-5 py-1 sm:py-1.5 lg:py-2 rounded-full text-amber-50 text-[10px] sm:text-xs lg:text-sm font-semibold shadow-xl border-2 border-amber-400" style={{ backgroundColor: 'rgb(245, 158, 11)' }}>
                    HADITS PILIHAN
                  </span>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 px-4 sm:px-6 lg:px-8 py-4 lg:py-6 overflow-y-auto min-h-0">
                {loadingHadiths || hadiths.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="inline-block w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                      <p className="text-amber-300 text-lg font-medium">Memuat hadits...</p>
                    </div>
                  </div>
                ) : hadiths[currentHadithIndex] ? (
                  <>
                    {/* Arabic Text */}
                    <div className="text-right mb-4 lg:mb-6">
                      <p className="text-amber-300 break-words"
                         style={{ 
                           fontFamily: "'Amiri', 'Traditional Arabic', serif",
                           direction: 'rtl',
                           fontSize: '2.5rem',
                           lineHeight: '2',
                           wordSpacing: '0.05em',
                           textShadow: '2px 2px 4px rgba(0,0,0,0.5)'
                         }}>
                        {hadiths[currentHadithIndex].arabic}
                      </p>
                    </div>

                    {/* Translation - Diperbesar tanpa bold */}
                    <div className="mb-4 lg:mb-6">
                      <p className="text-2xl sm:text-3xl lg:text-4xl text-amber-200 leading-relaxed italic font-normal"
                         style={{ 
                           borderLeft: '4px solid rgb(245, 158, 11)',
                           paddingLeft: '1.25rem'
                         }}>
                        "{hadiths[currentHadithIndex].translation}"
                      </p>
                    </div>

                    {/* Source & Pagination */}
                    <div className="mt-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <span className="text-[10px] sm:text-xs lg:text-sm text-amber-400 px-2 sm:px-3 lg:px-4 py-1 sm:py-1.5 lg:py-2 rounded-full border border-amber-500" style={{ backgroundColor: 'rgba(6, 78, 59, 0.5)' }}>
                        {hadiths[currentHadithIndex].source}
                      </span>
                      
                      {/* Pagination Dots */}
                      <div className="flex items-center gap-1 sm:gap-1.5 lg:gap-2 flex-wrap">
                        {hadiths.map((_, index) => (
                          <button
                            key={index}
                            className={`rounded-full transition-all duration-500 ${
                              index === currentHadithIndex 
                                ? 'w-4 sm:w-5 lg:w-6 h-2 shadow-md' 
                                : 'w-2 h-2'
                            }`}
                            style={{
                              backgroundColor: index === currentHadithIndex ? 'rgb(245, 158, 11)' : 'rgba(6, 78, 59, 0.5)',
                              boxShadow: index === currentHadithIndex ? '0 2px 4px rgba(0,0,0,0.3)' : 'none'
                            }}
                            onClick={() => {
                              setCurrentHadithIndex(index);
                              setTimeLeft(15);
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-amber-300 text-lg">Tidak ada hadits tersedia</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Info & Finance */}
        <div className="w-full lg:w-[30%] flex flex-col gap-3 lg:gap-4 h-auto lg:h-full">
          
          {/* Quick Info Card */}
          <div className="rounded-xl lg:rounded-2xl shadow-2xl border-2 border-amber-500 p-3 lg:p-4 xl:p-5 flex-shrink-0" style={{ backgroundColor: 'rgba(6, 78, 59, 0.85)' }}>
            <div className="flex items-center gap-2 lg:gap-3 mb-2 lg:mb-3 xl:mb-4">
              <div className="w-6 h-6 lg:w-7 lg:h-7 rounded-xl flex items-center justify-center shadow-lg" style={{ backgroundColor: 'rgb(245, 158, 11)' }}>
                <span className="text-xs lg:text-sm text-white">📊</span>
              </div>
              <h3 className="text-[10px] sm:text-xs lg:text-sm font-semibold text-amber-300 uppercase" style={{ letterSpacing: '0.1em' }}>
                Informasi Masjid
              </h3>
            </div>
            
            <div className="space-y-2 lg:space-y-3">
              <div className="flex justify-between items-center text-[10px] sm:text-xs lg:text-sm">
                <span className="text-emerald-200">Jumlah Hadits</span>
                <span className="text-amber-300 font-bold text-xs sm:text-sm lg:text-base">
                  {loadingHadiths ? '-' : hadiths.length}
                </span>
              </div>
              <div className="flex justify-between items-center text-[10px] sm:text-xs lg:text-sm">
                <span className="text-emerald-200">Rotasi</span>
                <span className="text-amber-300 font-bold text-xs sm:text-sm lg:text-base">15 detik</span>
              </div>
              <div className="flex justify-between items-center text-[10px] sm:text-xs lg:text-sm">
                <span className="text-emerald-200">Status</span>
                <span className="text-amber-300 font-bold text-xs sm:text-sm lg:text-base flex items-center gap-2">
                  {loadingHadiths ? (
                    <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-amber-400 rounded-full animate-pulse"></span>
                  ) : (
                    <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                  )}
                  {loadingHadiths ? 'Memuat...' : 'Aktif'}
                </span>
              </div>
            </div>
          </div>

          {/* Finance Card */}
          <div className="flex-1 rounded-xl lg:rounded-2xl shadow-2xl border-2 border-amber-500 overflow-hidden flex flex-col" style={{ backgroundColor: 'rgba(6, 78, 59, 0.85)' }}>
            
            {/* Card Header */}
            <div className="px-3 lg:px-4 xl:px-5 py-2 lg:py-3 xl:py-4 border-b-2 border-amber-500 flex-shrink-0" style={{ backgroundColor: 'rgb(217, 119, 6)' }}>
              <div className="flex items-center gap-2 lg:gap-3">
                <div className="w-6 h-6 lg:w-7 lg:h-7 bg-amber-500 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-xs lg:text-sm text-white">💰</span>
                </div>
                <div>
                  <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-amber-100 uppercase tracking-wider">
                    Kas Masjid
                  </h3>
                  <p className="text-[10px] sm:text-xs lg:text-sm text-amber-200 font-light">Hari ini</p>
                </div>
              </div>
            </div>

            {/* Card Content */}
            <div className="flex-1 p-3 lg:p-4 xl:p-5 overflow-y-auto scrollbar-thin scrollbar-thumb-amber-500 scrollbar-track-emerald-800">
              <div className="mb-3 lg:mb-4">
                <p className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold text-amber-300 mb-1 lg:mb-2 drop-shadow-lg">
                  {loadingSaldo ? 'Memuat...' : formatRupiah(saldoMasjid)}
                </p>
                <p className="text-xs sm:text-sm lg:text-base text-emerald-200 font-light">
                  {loadingSaldo ? 'Mengambil data dari Firestore...' : 'Total saldo tersedia'}
                </p>
              </div>

              {/* Latest Transactions Section */}
              <div className="space-y-2.5 lg:space-y-3 mb-3 lg:mb-4">
                {/* Latest Income */}
                {loadingSaldo ? (
                  <div className="rounded-lg lg:rounded-xl p-2 lg:p-3 border border-amber-500" style={{ backgroundColor: 'rgba(6, 78, 59, 0.5)' }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">📥</span>
                        <p className="text-xs sm:text-sm lg:text-base text-emerald-200 font-light">Pemasukan Terakhir</p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-sm sm:text-base lg:text-lg text-amber-300 font-bold">Memuat...</p>
                      <p className="text-[10px] sm:text-xs text-emerald-300">-</p>
                    </div>
                  </div>
                ) : getLatestIncome() ? (
                  <div className="rounded-lg lg:rounded-xl p-2 lg:p-3 border border-emerald-500 shadow-lg" style={{ backgroundColor: 'rgba(6, 78, 59, 0.6)' }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <span className="text-base sm:text-lg">📥</span>
                        <p className="text-xs sm:text-sm lg:text-base text-emerald-200 font-medium">Pemasukan Terakhir</p>
                      </div>
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-xs sm:text-[10px] text-emerald-300 mb-0.5 truncate max-w-[120px] sm:max-w-none">
                          {getLatestIncome()?.description || 'Tanpa judul'}
                        </p>
                        <p className="text-base sm:text-lg lg:text-xl text-emerald-400 font-bold">
                          +{formatRupiah(getLatestIncome()?.amount || 0)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] sm:text-xs text-emerald-300 leading-tight">
                          {formatTransactionDate(getLatestIncome())}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg lg:rounded-xl p-2 lg:p-3 border border-amber-500" style={{ backgroundColor: 'rgba(6, 78, 59, 0.5)' }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">📥</span>
                        <p className="text-xs sm:text-sm lg:text-base text-emerald-200 font-light">Pemasukan Terakhir</p>
                      </div>
                    </div>
                    <div className="mt-2 text-center">
                      <p className="text-sm sm:text-base text-amber-300/60 italic">Belum ada pemasukan</p>
                    </div>
                  </div>
                )}

                {/* Latest Expense */}
                {loadingSaldo ? (
                  <div className="rounded-lg lg:rounded-xl p-2 lg:p-3 border border-amber-500" style={{ backgroundColor: 'rgba(6, 78, 59, 0.5)' }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">📤</span>
                        <p className="text-xs sm:text-sm lg:text-base text-emerald-200 font-light">Pengeluaran Terakhir</p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-sm sm:text-base lg:text-lg text-amber-300 font-bold">Memuat...</p>
                      <p className="text-[10px] sm:text-xs text-emerald-300">-</p>
                    </div>
                  </div>
                ) : getLatestExpense() ? (
                  <div className="rounded-lg lg:rounded-xl p-2 lg:p-3 border border-red-500 shadow-lg" style={{ backgroundColor: 'rgba(153, 27, 27, 0.4)' }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <span className="text-base sm:text-lg">📤</span>
                        <p className="text-xs sm:text-sm lg:text-base text-red-200 font-medium">Pengeluaran Terakhir</p>
                      </div>
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-xs sm:text-[10px] text-red-300 mb-0.5 truncate max-w-[120px] sm:max-w-none">
                          {getLatestExpense()?.description || 'Tanpa judul'}
                        </p>
                        <p className="text-base sm:text-lg lg:text-xl text-red-400 font-bold">
                          -{formatRupiah(getLatestExpense()?.amount || 0)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] sm:text-xs text-red-300 leading-tight">
                          {formatTransactionDate(getLatestExpense())}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg lg:rounded-xl p-2 lg:p-3 border border-amber-500" style={{ backgroundColor: 'rgba(6, 78, 59, 0.5)' }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">📤</span>
                        <p className="text-xs sm:text-sm lg:text-base text-emerald-200 font-light">Pengeluaran Terakhir</p>
                      </div>
                    </div>
                    <div className="mt-2 text-center">
                      <p className="text-sm sm:text-base text-amber-300/60 italic">Belum ada pengeluaran</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-1 relative border-t-2 border-amber-500 py-2 lg:py-3 z-10" style={{ backgroundColor: 'rgb(6, 78, 59)' }}>
        <div className="px-3 lg:px-6 xl:px-8 flex items-center justify-between text-[8px] sm:text-[9px] lg:text-xs">
          <p className="text-amber-300 truncate">
            © 2026 Masjid Al Ihsan Bakrie PT.CPM
          </p>
          <div className="flex items-center gap-1 lg:gap-2 flex-shrink-0">
            <span className="w-0.5 h-0.5 bg-amber-400 rounded-full"></span>
            <p className="text-amber-400 font-bold text-[8px] sm:text-[9px] lg:text-xs">
              Team ITE CPM
            </p>
            <span className="w-0.5 h-0.5 bg-amber-400 rounded-full"></span>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App