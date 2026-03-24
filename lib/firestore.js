import { db } from './firebase';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs, 
  query, 
  orderBy, 
  onSnapshot,
  serverTimestamp 
} from 'firebase/firestore';

/**
 * Add a new transaction to Firestore
 * @param {Object} transactionData - Transaction data
 * @param {string} transactionData.description - Description of the transaction
 * @param {number} transactionData.amount - Amount in Rupiah
 * @param {string} transactionData.type - 'income' or 'expense'
 * @param {string} [transactionData.notes] - Optional notes
 * @returns {Promise<string>} Document ID
 */
export const addTransaction = async (transactionData) => {
  try {
    const docRef = await addDoc(collection(db, 'transactions'), {
      description: transactionData.description,
      amount: parseFloat(transactionData.amount),
      type: transactionData.type, // 'income' or 'expense'
      notes: transactionData.notes || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    console.log('Transaction added with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error adding transaction:', error);
    throw error;
  }
};

/**
 * Update an existing transaction
 * @param {string} id - Transaction document ID
 * @param {Object} transactionData - Updated transaction data
 * @returns {Promise<void>}
 */
export const updateTransaction = async (id, transactionData) => {
  try {
    const transactionRef = doc(db, 'transactions', id);
    await updateDoc(transactionRef, {
      description: transactionData.description,
      amount: parseFloat(transactionData.amount),
      type: transactionData.type,
      notes: transactionData.notes || '',
      updatedAt: serverTimestamp()
    });
    console.log('Transaction updated successfully');
  } catch (error) {
    console.error('Error updating transaction:', error);
    throw error;
  }
};

/**
 * Delete a transaction
 * @param {string} id - Transaction document ID
 * @returns {Promise<void>}
 */
export const deleteTransaction = async (id) => {
  try {
    await deleteDoc(doc(db, 'transactions', id));
    console.log('Transaction deleted successfully');
  } catch (error) {
    console.error('Error deleting transaction:', error);
    throw error;
  }
};

/**
 * Get all transactions as a real-time stream
 * @param {Function} callback - Callback function that receives transactions array
 * @returns {Function} Unsubscribe function
 */
export const subscribeToTransactions = (callback) => {
  const q = query(collection(db, 'transactions'), orderBy('createdAt', 'desc'));
  
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const transactionsData = [];
    let totalSaldo = 0;
    
    snapshot.forEach((doc) => {
      const transaction = { id: doc.id, ...doc.data() };
      transactionsData.push(transaction);
      
      // Calculate running balance
      if (transaction.type === 'income') {
        totalSaldo += parseFloat(transaction.amount) || 0;
      } else {
        totalSaldo -= parseFloat(transaction.amount) || 0;
      }
    });
    
    callback({
      transactions: transactionsData,
      totalSaldo: totalSaldo
    });
  }, (error) => {
    console.error('Error fetching transactions:', error);
    callback({ transactions: [], totalSaldo: 0, error });
  });

  return unsubscribe;
};

/**
 * Get all transactions once (no real-time updates)
 * @returns {Promise<Array>} Array of transactions
 */
export const getAllTransactions = async () => {
  try {
    const q = query(collection(db, 'transactions'), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    
    const transactions = [];
    querySnapshot.forEach((doc) => {
      transactions.push({ id: doc.id, ...doc.data() });
    });
    
    return transactions;
  } catch (error) {
    console.error('Error getting transactions:', error);
    throw error;
  }
};

/**
 * Add a user to Firestore (example from your snippet)
 * @param {string} name - User's name
 * @param {string} email - User's email
 * @returns {Promise<string>} Document ID
 */
export const addUser = async (name, email) => {
  try {
    const docRef = await addDoc(collection(db, 'users'), {
      name: name,
      email: email,
      timestamp: serverTimestamp()
    });
    console.log('User added with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error adding user:', error);
    throw error;
  }
};
