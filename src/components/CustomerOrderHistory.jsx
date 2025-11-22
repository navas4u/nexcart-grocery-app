// src/components/CustomerOrderHistory.jsx - ENHANCED WITH PENDING PAYMENTS
import { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc,
  getDocs,
  orderBy,
  arrayUnion,
  increment,
  getDoc
} from 'firebase/firestore';
import { db } from '../firebase';

const CustomerOrderHistory = () => {
  const [activeTab, setActiveTab] = useState('orders');
  const [orders, setOrders] = useState([]);
  const [creditData, setCreditData] = useState(null);
  const [loading, setLoading] = useState(true);

  const auth = getAuth();
  const user = auth.currentUser;

  useEffect(() => {
    if (user) {
      const unsubscribe = fetchCustomerData();
      return () => unsubscribe && unsubscribe();
    }
  }, [user]);

  const fetchCustomerData = () => {
    try {
      setLoading(true);
      
      // Fetch orders
      const ordersQuery = query(
        collection(db, 'orders'),
        where('customerId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      
      const unsubscribe = onSnapshot(ordersQuery, (snapshot) => {
        const ordersData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setOrders(ordersData);
        setLoading(false);
      });

      // Fetch credit data
      fetchCreditData();
      
      return unsubscribe;
    } catch (error) {
      console.error('Error fetching customer data:', error);
      setLoading(false);
    }
  };

  const fetchCreditData = async () => {
  try {
    const auth = getAuth();
    const user = auth.currentUser;
    
    if (!user) return;

    // Query all shops where this customer has credit accounts
    const creditsQuery = query(
      collection(db, 'customer_credits'),
      where('customerId', '==', user.uid)
    );
    
    const snapshot = await getDocs(creditsQuery);
    const creditAccounts = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const creditData = {
          id: doc.id,
          ...doc.data(),
          // Calculate utilization percentage for each account
          utilizationPercent: doc.data().creditLimit > 0 
            ? Math.round((doc.data().currentBalance / doc.data().creditLimit) * 100)
            : 0,
          // Also ensure availableCredit is calculated
          availableCredit: (doc.data().creditLimit || 0) - (doc.data().currentBalance || 0)
        };
        
        // If shopName is missing, try to fetch it from shops collection
        if (!creditData.shopName || creditData.shopName === 'Unknown Shop') {
          try {
            const shopDoc = await getDoc(doc(db, 'shops', creditData.shopId));
            if (shopDoc.exists()) {
              creditData.shopName = shopDoc.data().name || 'Unknown Shop';
              
              // Update the credit document with shop name for future
              await updateDoc(doc(db, 'customer_credits', doc.id), {
                shopName: creditData.shopName
              });
            } else {
              creditData.shopName = 'Shop Not Found';
            }
          } catch (error) {
            console.log('Could not fetch shop name:', error);
            creditData.shopName = 'Unknown Shop';
          }
        }
        
        return creditData;
      })
    );
    
    setCreditData({
      accounts: creditAccounts,
      totalBalance: creditAccounts.reduce((sum, account) => sum + (account.currentBalance || 0), 0),
      totalLimit: creditAccounts.reduce((sum, account) => sum + (account.creditLimit || 0), 0)
    });
  } catch (error) {
    console.error('Error fetching credit data:', error);
  }
};

  if (loading) {
    return <div style={styles.loading}>Loading your data...</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2>📊 Your Account</h2>
        <p>Manage your orders and credit accounts</p>
      </div>

      {/* Navigation Tabs */}
      <div style={styles.tabContainer}>
        <button 
          style={activeTab === 'orders' ? styles.activeTab : styles.tab}
          onClick={() => setActiveTab('orders')}
        >
          🛍️ Orders ({orders.length})
        </button>
        <button 
          style={activeTab === 'credit' ? styles.activeTab : styles.tab}
          onClick={() => setActiveTab('credit')}
        >
          💳 Credit Accounts ({creditData?.accounts.length || 0})
        </button>
      </div>

      {/* Tab Content */}
      <div style={styles.tabContent}>
        {activeTab === 'orders' && (
          <OrdersTab orders={orders} />
        )}
        
        {activeTab === 'credit' && (
          <CreditTab 
            creditData={creditData} 
            onRefresh={fetchCreditData}
          />
        )}
      </div>
    </div>
  );
};

// ORDERS TAB COMPONENT
const OrdersTab = ({ orders }) => {
  if (orders.length === 0) {
    return (
      <div style={styles.emptyState}>
        <div style={styles.emptyIcon}>📦</div>
        <h4>No Orders Yet</h4>
        <p>Your orders will appear here once you make purchases.</p>
      </div>
    );
  }

  return (
    <div style={styles.ordersSection}>
      <h3>Your Order History</h3>
      <div style={styles.ordersList}>
        {orders.map(order => (
          <div key={order.id} style={styles.orderCard}>
            <div style={styles.orderHeader}>
              <div style={styles.orderInfo}>
                <strong>Order #{order.orderNumber || order.id.substring(0, 8).toUpperCase()}</strong>
                <span style={styles.orderDate}>
                  Order Created : {order.createdAt?.toDate().toLocaleDateString()}
                </span>
              </div>
              <div style={{
                ...styles.statusBadge,
                ...getStatusStyle(order.status)
              }}>
                {order.status || 'pending'}
              </div>
            </div>
            <OrderProgressBar status={order.status} />
            <div style={styles.orderDetails}>
              <div style={styles.itemsList}>
                {order.items?.map((item, index) => (
                  <div key={index} style={styles.orderItem}>
                    <span>{item.name} x {item.quantity}</span>
                    <span>₹{item.price * item.quantity}</span>
                  </div>
                ))}
              </div>
              
              <div style={styles.orderTotal}>
                <strong>Total: ₹{order.totalAmount}</strong>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Progress Bar Component
// UPDATED Progress Bar Component - MATCHES SHOP OWNER FLOW EXACTLY
const OrderProgressBar = ({ status }) => {
  const steps = [
    { key: 'pending_approval', label: 'Credit Approval' },
    { key: 'confirmed', label: 'Confirmed' },
    { key: 'preparing', label: 'Preparing' },
    { key: 'ready', label: 'Ready' },
    { key: 'completed', label: 'Completed' }
  ];

  const currentStatus = (status || 'pending_approval').toLowerCase();
  
  // Find current step index
  const currentIndex = steps.findIndex(step => step.key === currentStatus);
  const progressPercent = Math.max(0, ((currentIndex + 1) / steps.length) * 100);

  return (
    <div style={styles.progressContainer}>
      <div style={styles.progressBar}>
        <div 
          style={{
            ...styles.progressFill,
            width: `${progressPercent}%`,
            backgroundColor: getProgressColor(currentStatus)
          }}
        />
      </div>
      <div style={styles.progressSteps}>
        {steps.map((step, index) => (
          <div 
            key={step.key}
            style={{
              ...styles.progressStep,
              color: index <= currentIndex ? getProgressColor(currentStatus) : '#bdc3c7',
              fontWeight: index <= currentIndex ? '600' : '400'
            }}
          >
            <div style={{
              ...styles.stepDot,
              backgroundColor: index <= currentIndex ? getProgressColor(currentStatus) : '#bdc3c7',
              border: index <= currentIndex ? `2px solid ${getProgressColor(currentStatus)}` : '2px solid #bdc3c7',
              color: 'white'
            }}>
              {index + 1}
            </div>
            {step.label}
          </div>
        ))}
      </div>
      
      {/* Status Message - NEW ADDITION */}
      <div style={{
        ...styles.statusMessage,
        borderLeft: `4px solid ${getProgressColor(currentStatus)}`
      }}>
        {getStatusMessage(currentStatus)}
      </div>
    </div>
  );
};

// Helper function for progress bar colors
// UPDATED Helper function for progress bar colors - MATCHES SHOP OWNER
const getProgressColor = (status) => {
  const colors = {
    completed: '#27ae60',      // Green
    ready: '#FF6B35',          // 🌟 Bright Coral Orange - HAPPY COLOR!
    preparing: '#9b59b6',      // Purple
    confirmed: '#3498db',      // Blue
    pending_approval: '#f39c12', // Orange
    cancelled: '#e74c3c',      // Red
    returned: '#95a5a6',       // Gray
    partially_returned: '#ff6b6b' // Light Red
  };
  return colors[status] || '#3498db';
};

// STATUS MESSAGES FOR CUSTOMERS - NEW FUNCTION
const getStatusMessage = (status) => {
  const messages = {
    pending_approval: '⏳ Waiting for credit approval from the shop',
    confirmed: '✅ Credit approved! Shop will start preparing your order soon',
    preparing: '👨‍🍳 Shop is preparing your items',
    ready: '🎉 Your order is ready for pickup/delivery!',
    completed: '✨ Order completed successfully!',
    cancelled: '❌ Order was cancelled',
    returned: '🔄 Order items were returned',
    partially_returned: '🔄 Some items were returned'
  };
  return messages[status] || 'Order processing...';
};

// CREDIT TAB COMPONENT - ENHANCED WITH PENDING PAYMENTS
const CreditTab = ({ creditData, onRefresh }) => {
  return (
    <div style={styles.creditSection}>
      {/* Credit Summary */}
      <CreditSummarySection creditData={creditData} />
      {/* ⭐ THIS IS THE KEY SECTION - Make sure it's here ⭐ */}
      <PendingPaymentsSection />    
      {/* Credit Accounts */}
      <CreditAccountsSection 
        accounts={creditData?.accounts || []} 
        onRefresh={onRefresh}
      />
      
      {/* Transaction History */}
      <TransactionHistoryTab accounts={creditData?.accounts || []} />
    </div>
  );
};

// CREDIT SUMMARY COMPONENT
const CreditSummarySection = ({ creditData }) => {
  if (!creditData || creditData.accounts.length === 0) {
    return (
      <div style={styles.emptyState}>
        <div style={styles.emptyIcon}>💳</div>
        <h4>No Credit Accounts</h4>
        <p>You don't have any credit accounts with shops yet.</p>
      </div>
    );
  }

  const totalAvailable = creditData.totalLimit - creditData.totalBalance;
  const overallUtilization = creditData.totalLimit > 0 
    ? Math.round((creditData.totalBalance / creditData.totalLimit) * 100) 
    : 0;

  return (
    <div style={styles.creditSummary}>
      <h3>💰 Credit Summary</h3>
      <div style={styles.summaryGrid}>
        <div style={styles.summaryCard}>
          <div style={styles.summaryValue}>₹{creditData.totalBalance.toLocaleString()}</div>
          <div style={styles.summaryLabel}>Total Balance</div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryValue}>₹{creditData.totalLimit.toLocaleString()}</div>
          <div style={styles.summaryLabel}>Total Limit</div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryValue}>₹{totalAvailable.toLocaleString()}</div>
          <div style={styles.summaryLabel}>Available Credit</div>
        </div>
        <div style={styles.summaryCard}>
          <div style={{
            ...styles.summaryValue,
            color: getUtilizationColor(overallUtilization)
          }}>
            {overallUtilization}%
          </div>
          <div style={styles.summaryLabel}>Utilization</div>
        </div>
      </div>
    </div>
  );
};

// PENDING PAYMENTS SECTION - NEW COMPONENT
const PendingPaymentsSection = () => {
  const [pendingPayments, setPendingPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showApprovalModal, setShowApprovalModal] = useState(null);

  useEffect(() => {
    fetchPendingPayments();
  }, []);

  const fetchPendingPayments = async () => {
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      
      const pendingQuery = query(
        collection(db, 'pending_payments'),
        where('customerId', '==', user.uid),
        where('status', '==', 'pending_approval'),
        orderBy('recordedAt', 'desc')
      );
      
      const snapshot = await getDocs(pendingQuery);
      const payments = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        timeRemaining: getTimeRemaining(doc.data().expiresAt)
      }));
      
      setPendingPayments(payments);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching pending payments:', error);
      setLoading(false);
    }
  };

  const getTimeRemaining = (expiresAt) => {
    const now = new Date();
    const expiry = expiresAt.toDate();
    const hoursLeft = Math.max(0, (expiry - now) / (1000 * 60 * 60));
    return Math.round(hoursLeft);
  };

const approvePayment = async (paymentId) => {
  try {
    console.log('🔍 Starting approvePayment for:', paymentId);
    
    const paymentDoc = await getDoc(doc(db, 'pending_payments', paymentId));
    if (!paymentDoc.exists()) {
      alert('Payment not found');
      return;
    }

    const paymentData = paymentDoc.data();
    const auth = getAuth();
    const user = auth.currentUser;

    console.log('🔍 Payment data:', paymentData);
    console.log('🔍 Current user:', user.uid);

    // Find the credit account by querying
    const creditsQuery = query(
      collection(db, 'customer_credits'),
      where('customerId', '==', paymentData.customerId),
      where('shopId', '==', paymentData.shopId)
    );
    
    const creditsSnapshot = await getDocs(creditsQuery);
    console.log('🔍 Found credit accounts:', creditsSnapshot.size);
    
    if (creditsSnapshot.empty) {
      alert('❌ Credit account not found for this customer and shop');
      return;
    }

    // Get the first matching credit document
    const creditDoc = creditsSnapshot.docs[0];
    const creditRef = doc(db, 'customer_credits', creditDoc.id);
    const creditData = creditDoc.data();
    
    console.log('🔍 Using credit document ID:', creditDoc.id);
    console.log('🔍 Current credit balance:', creditData.currentBalance);
    console.log('🔍 Payment amount:', paymentData.amount);

    // Validate the payment amount
    if (paymentData.amount > creditData.currentBalance) {
      alert(`❌ Payment amount (₹${paymentData.amount}) exceeds current balance (₹${creditData.currentBalance})`);
      return;
    }

    // UPDATE CREDIT ACCOUNT
    console.log('🔍 Updating credit account...');
    await updateDoc(creditRef, {
      currentBalance: increment(-paymentData.amount),
      availableCredit: increment(paymentData.amount),
      updatedAt: new Date(),
      paymentHistory: arrayUnion({
        date: new Date(),
        amount: -paymentData.amount,
        type: 'payment_received',
        description: paymentData.note || 'Payment received',
        approvedBy: user.uid,
        approvedAt: new Date(),
        pendingPaymentId: paymentId
      })
    });

    // MARK PAYMENT AS APPROVED
    console.log('🔍 Marking payment as approved...');
    await updateDoc(doc(db, 'pending_payments', paymentId), {
      status: 'approved',
      approvedAt: new Date(),
      approvedBy: user.uid
    });

    console.log('✅ Payment approved successfully!');
    alert('✅ Payment approved successfully! Your balance has been updated.');
    fetchPendingPayments(); // Refresh list
    setShowApprovalModal(null);
    
  } catch (error) {
    console.error('❌ Error approving payment:', error);
    console.error('❌ Error details:', error.message, error.code);
    alert(`❌ Error approving payment: ${error.message}`);
  }
};
//debug end

  const disputePayment = async (paymentId, reason) => {
    if (!reason) {
      reason = prompt('Please specify why you are disputing this payment:');
      if (!reason) return;
    }

    try {
      await updateDoc(doc(db, 'pending_payments', paymentId), {
        status: 'disputed',
        disputeReason: reason,
        disputedAt: new Date(),
        disputedBy: getAuth().currentUser.uid
      });

      alert('⚠️ Payment disputed. The shop owner will review your concern.');
      fetchPendingPayments(); // Refresh list
      setShowApprovalModal(null);
    } catch (error) {
      console.error('Error disputing payment:', error);
      alert('❌ Error disputing payment');
    }
  };

  if (loading) return <div style={styles.loading}>Loading pending payments...</div>;
  if (pendingPayments.length === 0) return null;

  return (
    <div style={styles.pendingPaymentsSection}>
      <div style={styles.sectionHeader}>
        <h4>⏳ Payments Waiting Your Approval</h4>
        <span style={styles.pendingBadge}>{pendingPayments.length}</span>
      </div>

      <div style={styles.pendingList}>
        {pendingPayments.map(payment => (
          <div key={payment.id} style={styles.pendingPaymentItem}>
            <div style={styles.paymentInfo}>
              <div style={styles.paymentHeader}>
                <strong style={styles.paymentAmount}>₹{payment.amount}</strong>
                <span style={styles.shopName}>from {payment.recordedByEmail}</span>
              </div>
              
              <div style={styles.paymentDetails}>
                <span>{payment.note || 'No description provided'}</span>
                <small>Recorded: {payment.recordedAt?.toDate().toLocaleString()}</small>
              </div>

              <div style={styles.timeRemaining}>
                ⏰ Auto-approves in {payment.timeRemaining} hours
              </div>
            </div>

            <div style={styles.paymentActions}>
              <button 
                onClick={() => approvePayment(payment.id)}
                style={styles.approveBtn}
              >
                ✅ Approve
              </button>
              <button 
                onClick={() => setShowApprovalModal(payment)}
                style={styles.disputeBtn}
              >
                ❌ Dispute
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* DISPUTE MODAL */}
      {showApprovalModal && (
        <DisputeModal 
          payment={showApprovalModal}
          onDispute={disputePayment}
          onClose={() => setShowApprovalModal(null)}
        />
      )}
    </div>
  );
};

// DISPUTE MODAL COMPONENT
const DisputeModal = ({ payment, onDispute, onClose }) => {
  const [disputeReason, setDisputeReason] = useState('');

  const commonReasons = [
    'Incorrect amount',
    'Already paid',
    'Payment not received',
    'Wrong customer',
    'Other reason'
  ];

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalContent}>
        <div style={styles.modalHeader}>
          <h3>❌ Dispute Payment</h3>
          <button onClick={onClose} style={styles.closeButton}>✕</button>
        </div>

        <div style={styles.disputeContent}>
          <div style={styles.paymentSummary}>
            <strong>Amount: ₹{payment.amount}</strong>
            <div>Recorded by: {payment.recordedByEmail}</div>
            <div>Date: {payment.recordedAt?.toDate().toLocaleString()}</div>
          </div>

          <div style={styles.reasonSection}>
            <label>Select reason for dispute:</label>
            <select 
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              style={styles.reasonSelect}
            >
              <option value="">Choose a reason...</option>
              {commonReasons.map(reason => (
                <option key={reason} value={reason}>{reason}</option>
              ))}
            </select>
          </div>

          {disputeReason === 'Other reason' && (
            <div style={styles.customReason}>
              <label>Please specify:</label>
              <textarea
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                placeholder="Describe why you are disputing this payment..."
                style={styles.reasonTextarea}
                rows="3"
              />
            </div>
          )}
        </div>

        <div style={styles.modalActions}>
          <button onClick={onClose} style={styles.cancelButton}>
            Cancel
          </button>
          <button 
            onClick={() => onDispute(payment.id, disputeReason)}
            disabled={!disputeReason}
            style={disputeReason ? styles.disputeConfirmButton : styles.disputeButtonDisabled}
          >
            Submit Dispute
          </button>
        </div>
      </div>
    </div>
  );
};

// CREDIT ACCOUNTS SECTION
const CreditAccountsSection = ({ accounts, onRefresh }) => {
  if (accounts.length === 0) return null;

  return (
    <div style={styles.accountsSection}>
      <div style={styles.sectionHeader}>
        <h3>🏪 Your Credit Accounts</h3>
        <button onClick={onRefresh} style={styles.refreshButton}>
          🔄 Refresh
        </button>
      </div>
      
      <div style={styles.accountsGrid}>
        {accounts.map(account => (
          <div key={account.id} style={styles.accountCard}>
            <div style={styles.accountHeader}>
              <strong>{account.shopName || 'Unknown Shop'}</strong>
              <span style={getUtilizationStyle(account.utilizationPercent)}>
                {(account.utilizationPercent || 0)}% used
              </span>
            </div>
            
            <div style={styles.accountDetails}>
              <div style={styles.balanceRow}>
                <span>Balance:</span>
                <span style={styles.balance}>₹{account.currentBalance?.toLocaleString()}</span>
              </div>
              <div style={styles.balanceRow}>
                <span>Limit:</span>
                <span>₹{account.creditLimit?.toLocaleString()}</span>
              </div>
              <div style={styles.balanceRow}>
                <span>Available:</span>
                <span style={styles.available}>₹{account.availableCredit?.toLocaleString()}</span>
              </div>
            </div>
            
            <div style={styles.utilizationBar}>
              <div 
                style={{
                  width: `${Math.min(account.utilizationPercent, 100)}%`,
                  backgroundColor: getUtilizationColor(account.utilizationPercent),
                  height: '6px',
                  borderRadius: '3px',
                  transition: 'width 0.3s ease'
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// TRANSACTION HISTORY TAB
const TransactionHistoryTab = ({ accounts }) => {
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    // Combine transactions from all credit accounts
    const allTransactions = accounts.flatMap(account => 
      (account.paymentHistory || []).map(transaction => ({
        ...transaction,
        shopName: account.shopName,
        accountId: account.id
      }))
    ).sort((a, b) => new Date(b.date?.toDate()) - new Date(a.date?.toDate()));

    setTransactions(allTransactions);
  }, [accounts]);

  if (transactions.length === 0) {
    return (
      <div style={styles.emptyState}>
        <div style={styles.emptyIcon}>📝</div>
        <h4>No Transactions</h4>
        <p>Your transaction history will appear here.</p>
      </div>
    );
  }

  return (
    <div style={styles.transactionsSection}>
      <h3>📊 Transaction History</h3>
      <div style={styles.transactionsList}>
        {transactions.map((transaction, index) => (
          <div key={index} style={styles.transactionItem}>
            <div style={styles.transactionLeft}>
              <div style={styles.transactionType}>
                {getTransactionType(transaction.amount, transaction.type)}
              </div>
              <div style={styles.transactionDesc}>
                {transaction.description}
                {transaction.shopName && (
                  <small> • {transaction.shopName}</small>
                )}
              </div>
              <div style={styles.transactionDate}>
                {transaction.date?.toDate()?.toLocaleDateString()} • 
                {transaction.date?.toDate()?.toLocaleTimeString()}
              </div>
            </div>
            <div style={styles.transactionRight}>
              <span style={{
                ...styles.transactionAmount,
                color: getTransactionColor(transaction.amount)
              }}>
                {transaction.amount < 0 ? '-' : '+'}₹{Math.abs(transaction.amount).toLocaleString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// HELPER FUNCTIONS
// ENHANCED Status Style Function
// UPDATED Status Style Function - MATCHES SHOP OWNER COLORS EXACTLY
const getStatusStyle = (status) => {
  const statusLower = (status || 'pending_approval').toLowerCase();
  
  const styles = {
    completed: { 
      backgroundColor: '#27ae60', 
      color: 'white',
      border: '1px solid #219a52'
    },
    ready: { 
      backgroundColor: '#FF6B35',  // 🌟 Bright Coral Orange
      color: 'white',
      border: '1px solid #E55A2B'
    },
    preparing: { 
      backgroundColor: '#9b59b6', 
      color: 'white',
      border: '1px solid #8e44ad'
    },
    confirmed: { 
      backgroundColor: '#3498db', 
      color: 'white',
      border: '1px solid #2980b9'
    },
    pending_approval: { 
      backgroundColor: '#f39c12', 
      color: 'white',
      border: '1px solid #e67e22'
    },
    cancelled: { 
      backgroundColor: '#e74c3c', 
      color: 'white',
      border: '1px solid #c0392b'
    },
    returned: { 
      backgroundColor: '#95a5a6', 
      color: 'white',
      border: '1px solid #7f8c8d'
    },
    partially_returned: { 
      backgroundColor: '#ff6b6b', 
      color: 'white',
      border: '1px solid #ff5252'
    }
  };
  
  return styles[statusLower] || { 
    backgroundColor: '#95a5a6', 
    color: 'white',
    border: '1px solid #7f8c8d'
  };
};

const getUtilizationColor = (percent) => {
  if (percent >= 90) return '#e74c3c';
  if (percent >= 80) return '#f39c12';
  return '#27ae60';
};

const getUtilizationStyle = (percent) => {
  return {
    color: getUtilizationColor(percent),
    fontWeight: '600',
    fontSize: '0.8rem'
  };
};

const getTransactionColor = (amount) => {
  return amount < 0 ? '#27ae60' : '#e74c3c'; // Green for payments, Red for purchases
};

const getTransactionType = (amount, type) => {
  if (amount < 0) return '💰 Payment Received';
  if (type === 'credit_purchase') return '🛍️ Credit Purchase';
  if (type === 'return_refund') return '🔄 Return Refund';
  return '💳 Transaction';
};

// STYLES
const styles = {
  container: {
    padding: '1rem',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  header: {
    marginBottom: '2rem',
    textAlign: 'center',
  },
  tabContainer: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '2rem',
    borderBottom: '1px solid #ecf0f1',
    paddingBottom: '0.5rem',
  },
  tab: {
    padding: '0.75rem 1.5rem',
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    borderRadius: '6px 6px 0 0',
    fontSize: '1rem',
    transition: 'all 0.3s ease',
  },
  activeTab: {
    padding: '0.75rem 1.5rem',
    border: 'none',
    backgroundColor: '#3498db',
    color: 'white',
    cursor: 'pointer',
    borderRadius: '6px 6px 0 0',
    fontSize: '1rem',
    fontWeight: '600',
  },
  tabContent: {
    minHeight: '400px',
  },
  loading: {
    textAlign: 'center',
    padding: '3rem',
    color: '#7f8c8d',
    fontSize: '1.1rem',
  },
  emptyState: {
    textAlign: 'center',
    padding: '3rem',
    color: '#7f8c8d',
  },
  emptyIcon: {
    fontSize: '3rem',
    marginBottom: '1rem',
  },

  // Progress Bar Styles
  progressContainer: {
  margin: '1rem 0',
  padding: '0.5rem 0',
  borderTop: '1px solid #ecf0f1',
  borderBottom: '1px solid #ecf0f1',
},
progressBar: {
  height: '8px',
  backgroundColor: '#ecf0f1',
  borderRadius: '4px',
  overflow: 'hidden',
  marginBottom: '1rem',
},
progressFill: {
  height: '100%',
  borderRadius: '4px',
  transition: 'width 0.5s ease',
},
progressSteps: {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  fontSize: '0.75rem',
  flexWrap: 'wrap',
  gap: '0.5rem',
},
progressStep: {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  fontSize: '0.75rem',
  minWidth: '70px',
  textAlign: 'center',
},
stepDot: {
  width: '24px',
  height: '24px',
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '0.7rem',
  fontWeight: 'bold',
  color: 'white',
  marginBottom: '0.25rem',
},
  // Orders Section Styles
  ordersSection: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '1.5rem',
  },
  ordersList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  orderCard: {
    border: '1px solid #ecf0f1',
    borderRadius: '8px',
    padding: '1rem',
    backgroundColor: '#f8f9fa',
  },
  orderHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  orderInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  orderDate: {
    color: '#7f8c8d',
    fontSize: '0.9rem',
  },
  statusBadge: {
    padding: '0.25rem 0.75rem',
    borderRadius: '12px',
    fontSize: '0.8rem',
    fontWeight: '600',
  },
  orderDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  itemsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  orderItem: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '0.25rem 0',
  },
  orderTotal: {
    textAlign: 'right',
    borderTop: '1px solid #ecf0f1',
    paddingTop: '0.5rem',
    fontSize: '1.1rem',
  },

  // Credit Section Styles
  creditSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2rem',
  },
  creditSummary: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '1.5rem',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1rem',
    marginTop: '1rem',
  },
  summaryCard: {
    backgroundColor: '#f8f9fa',
    padding: '1.5rem',
    borderRadius: '8px',
    textAlign: 'center',
    border: '1px solid #e9ecef',
  },
  summaryValue: {
    fontSize: '1.8rem',
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: '0.5rem',
  },
  summaryLabel: {
    fontSize: '0.9rem',
    color: '#7f8c8d',
    fontWeight: '600',
  },

  // Pending Payments Styles
  pendingPaymentsSection: {
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    border: '2px solid #fff3cd',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
    borderBottom: '1px solid #ecf0f1',
    paddingBottom: '1rem',
  },
  pendingBadge: {
    backgroundColor: '#f39c12',
    color: 'white',
    padding: '0.25rem 0.75rem',
    borderRadius: '12px',
    fontSize: '0.8rem',
    fontWeight: '600',
  },
  pendingList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  pendingPaymentItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem',
    border: '1px solid #ffeaa7',
    borderRadius: '8px',
    backgroundColor: '#fffdf6',
    marginBottom: '0.75rem',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  paymentHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    marginBottom: '0.5rem',
  },
  paymentAmount: {
    fontSize: '1.3rem',
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  shopName: {
    color: '#7f8c8d',
    fontSize: '0.9rem',
  },
  paymentDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  timeRemaining: {
    color: '#e67e22',
    fontWeight: '600',
    fontSize: '0.9rem',
    marginTop: '0.5rem',
  },
  paymentActions: {
    display: 'flex',
    gap: '0.5rem',
    flexShrink: 0,
  },
  approveBtn: {
    backgroundColor: '#27ae60',
    color: 'white',
    border: 'none',
    padding: '0.5rem 1rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.8rem',
  },
  disputeBtn: {
    backgroundColor: '#e74c3c',
    color: 'white',
    border: 'none',
    padding: '0.5rem 1rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.8rem',
  },

  // Accounts Section Styles
  accountsSection: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '1.5rem',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  refreshButton: {
    backgroundColor: '#3498db',
    color: 'white',
    border: 'none',
    padding: '0.5rem 1rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.8rem',
  },
  accountsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '1rem',
    marginTop: '1rem',
  },
  accountCard: {
    border: '1px solid #ecf0f1',
    borderRadius: '8px',
    padding: '1.5rem',
    backgroundColor: '#f8f9fa',
  },
  accountHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  accountDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    marginBottom: '1rem',
  },
  balanceRow: {
    display: 'flex',
    justifyContent: 'space-between',
  },
  balance: {
    color: '#e74c3c',
    fontWeight: '600',
  },
  stepDot: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.7rem',
    fontWeight: 'bold',
    color: 'white',
    marginBottom: '0.25rem',
  },

  available: {
    color: '#27ae60',
    fontWeight: '600',
  },
  utilizationBar: {
    height: '6px',
    backgroundColor: '#ecf0f1',
    borderRadius: '3px',
    overflow: 'hidden',
  },

  // Transactions Section Styles
  transactionsSection: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '1.5rem',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  transactionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    marginTop: '1rem',
  },
  transactionItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem',
    borderBottom: '1px solid #ecf0f1',
    '&:last-child': {
      borderBottom: 'none',
    },
  },
  transactionLeft: {
    flex: 1,
  },
  transactionType: {
    fontWeight: '600',
    marginBottom: '0.25rem',
  },
  transactionDesc: {
    fontSize: '0.9rem',
    color: '#7f8c8d',
    marginBottom: '0.25rem',
  },
  transactionDate: {
    fontSize: '0.8rem',
    color: '#bdc3c7',
  },
  transactionRight: {
    textAlign: 'right',
  },
  transactionAmount: {
    fontWeight: 'bold',
    fontSize: '1.1rem',
  },

  // Modal Styles
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    padding: '1rem',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: '2rem',
    borderRadius: '8px',
    width: '100%',
    maxWidth: '500px',
    maxHeight: '90vh',
    overflowY: 'auto',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.5rem',
    borderBottom: '1px solid #ecf0f1',
    paddingBottom: '1rem',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '1.5rem',
    cursor: 'pointer',
    color: '#7f8c8d',
  },
  disputeContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  paymentSummary: {
    backgroundColor: '#f8f9fa',
    padding: '1rem',
    borderRadius: '6px',
    border: '1px solid #e9ecef',
  },
  reasonSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  reasonSelect: {
    padding: '0.75rem',
    border: '1px solid #ced4da',
    borderRadius: '4px',
    fontSize: '1rem',
  },
  customReason: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  reasonTextarea: {
    padding: '0.75rem',
    border: '1px solid #ced4da',
    borderRadius: '4px',
    fontSize: '1rem',
    resize: 'vertical',
    minHeight: '80px',
    fontFamily: 'inherit',
  },
  modalActions: {
    display: 'flex',
    gap: '0.5rem',
    justifyContent: 'flex-end',
    marginTop: '1.5rem',
  },
  cancelButton: {
    backgroundColor: '#95a5a6',
    color: 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  disputeConfirmButton: {
    backgroundColor: '#e74c3c',
    color: 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  disputeButtonDisabled: {
    backgroundColor: '#bdc3c7',
    color: 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '6px',
    cursor: 'not-allowed',
  },
};

export default CustomerOrderHistory;