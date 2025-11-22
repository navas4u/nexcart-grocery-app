// src/components/CustomerCreditManager.jsx - ENHANCED WITH PENDING PAYMENTS
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
  getDoc,
  setDoc,
  addDoc  // ADD THIS IMPORT
} from 'firebase/firestore';
import { db } from '../firebase';

const CustomerCreditManager = ({ shopId }) => {
  const [creditData, setCreditData] = useState({
    customers: [],
    summary: {
      totalOutstanding: 0,
      totalLimit: 0,
      utilizationPercent: 0,
      customerCount: 0
    }
  });
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showSetLimitModal, setShowSetLimitModal] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = fetchCreditData();
    return () => unsubscribe && unsubscribe();
  }, [shopId]);

  const fetchCreditData = () => {
  try {
    setLoading(true);
    
    const creditsQuery = query(
      collection(db, 'customer_credits'),
      where('shopId', '==', shopId)
    );
    
    const unsubscribe = onSnapshot(creditsQuery, async (querySnapshot) => {
      const customers = [];
      let totalOutstanding = 0;
      let totalLimit = 0;

      // Process customers sequentially to avoid race conditions
      for (const doc of querySnapshot.docs) {
        const data = doc.data();
        
        // If shopName is missing, try to fetch it from shops collection
        let shopName = data.shopName;
        if (!shopName || shopName === 'Unknown Shop') {
          try {
            const shopDoc = await getDoc(doc(db, 'shops', data.shopId));
            if (shopDoc.exists()) {
              shopName = shopDoc.data().name || 'Unknown Shop';
              
              // Update the credit document with shop name for future
              await updateDoc(doc(db, 'customer_credits', doc.id), {
                shopName: shopName
              });
            } else {
              shopName = 'Shop Not Found';
            }
          } catch (error) {
            console.log('Could not fetch shop name:', error);
            shopName = 'Unknown Shop';
          }
        }

        const customerData = {
          id: doc.id,
          ...data,
          shopName: shopName, // Use the fetched shop name
          availableCredit: data.creditLimit - data.currentBalance,
          utilizationPercent: Math.round((data.currentBalance / data.creditLimit) * 100) || 0
        };
        
        customers.push(customerData);
        totalOutstanding += data.currentBalance;
        totalLimit += data.creditLimit;
      }

      setCreditData({
        customers: customers.sort((a, b) => b.currentBalance - a.currentBalance),
        summary: {
          totalOutstanding,
          totalLimit,
          utilizationPercent: totalLimit > 0 ? Math.round((totalOutstanding / totalLimit) * 100) : 0,
          customerCount: customers.length
        }
      });
      setLoading(false);
    });

    return unsubscribe;
    
  } catch (error) {
    console.error('Error fetching credit data:', error);
    setLoading(false);
  }
};


  // ENHANCED RECORD PAYMENT - CREATES PENDING PAYMENTS
  const recordPayment = async (customerId, paymentAmount, paymentNote = '') => {
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;

      if (!currentUser) {
        alert('❌ You must be logged in to record payments');
        return;
      }

      // GET CUSTOMER CREDIT DATA FOR VALIDATION
      const creditRef = doc(db, 'customer_credits', customerId);
      const creditDoc = await getDoc(creditRef);
      
      if (!creditDoc.exists()) {
        alert('❌ Customer credit account not found');
        return;
      }

      const creditData = creditDoc.data();
      
      // VALIDATE PAYMENT AMOUNT
      if (paymentAmount > creditData.currentBalance) {
        alert(`❌ Payment amount (₹${paymentAmount}) exceeds current balance (₹${creditData.currentBalance})`);
        return;
      }

      // CREATE PENDING PAYMENT RECORD
      const pendingPaymentData = {
        type: 'pending_payment',
        customerId: creditData.customerId,
        shopId: shopId,
        customerEmail: creditData.customerEmail,
        customerName: creditData.customerName,
        amount: paymentAmount,
        note: paymentNote,
        recordedBy: currentUser.uid,
        recordedByEmail: currentUser.email,
        recordedAt: new Date(),
        status: 'pending_approval',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        currentBalance: creditData.currentBalance,
        newBalance: creditData.currentBalance - paymentAmount
      };

      // SAVE TO pending_payments COLLECTION
      await addDoc(collection(db, 'pending_payments'), pendingPaymentData);
      
      alert('💰 Payment recorded! Waiting for customer approval...\n\n' +
            `Amount: ₹${paymentAmount}\n` +
            `Customer: ${creditData.customerName}\n` +
            `Note: ${paymentNote || 'No description'}\n\n` +
            'Customer has 24 hours to approve or dispute.');
      
      // Close the payment modal
      setShowRecordPaymentModal(false);
      setSelectedCustomer(null);
      
    } catch (error) {
      console.error('Error recording payment:', error);
      alert('❌ Error recording payment');
    }
  };

  // UPDATE CREDIT LIMIT FUNCTION (existing)
  const updateCreditLimit = async (customerId, newLimit) => {
    try {
      await updateDoc(doc(db, 'customer_credits', customerId), {
        creditLimit: Number(newLimit),
        availableCredit: Number(newLimit) - creditData.customers.find(c => c.id === customerId)?.currentBalance,
        updatedAt: new Date()
      });
      alert('✅ Credit limit updated successfully!');
      setShowSetLimitModal(false);
    } catch (error) {
      console.error('Error updating credit limit:', error);
      alert('❌ Error updating credit limit');
    }
  };

  // EXPORT CREDIT REPORT FUNCTION (existing)
  const exportCreditReport = async () => {
    try {
      setExportLoading(true);
      
      let csvContent = "Customer Email,Current Balance,Credit Limit,Available Credit,Utilization %\n";
      
      creditData.customers.forEach(customer => {
        csvContent += `"${customer.customerEmail}",${customer.currentBalance},${customer.creditLimit},${customer.availableCredit},${customer.utilizationPercent}%\n`;
      });

      csvContent += `\nSUMMARY\n`;
      csvContent += `Total Outstanding,${creditData.summary.totalOutstanding}\n`;
      csvContent += `Total Credit Limit,${creditData.summary.totalLimit}\n`;
      csvContent += `Utilization Percentage,${creditData.summary.utilizationPercent}%\n`;
      csvContent += `Total Customers,${creditData.summary.customerCount}\n`;
      csvContent += `Export Date,${new Date().toLocaleDateString()}\n`;

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `credit-report-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      alert('✅ Credit report exported successfully!');
      
    } catch (error) {
      console.error('Error exporting report:', error);
      alert('❌ Error exporting credit report');
    } finally {
      setExportLoading(false);
    }
  };

  // PENDING PAYMENTS SECTION COMPONENT
  const PendingPaymentsSection = () => {
    const [pendingPayments, setPendingPayments] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      fetchPendingPayments();
    }, []);

    const fetchPendingPayments = async () => {
      try {
        const pendingQuery = query(
          collection(db, 'pending_payments'),
          where('shopId', '==', shopId),
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

    const cancelPendingPayment = async (paymentId) => {
      if (window.confirm('Are you sure you want to cancel this pending payment?')) {
        try {
          await updateDoc(doc(db, 'pending_payments', paymentId), {
            status: 'cancelled',
            cancelledAt: new Date()
          });
          fetchPendingPayments(); // Refresh list
          alert('✅ Payment cancelled');
        } catch (error) {
          console.error('Error cancelling payment:', error);
          alert('❌ Error cancelling payment');
        }
      }
    };

    if (loading) return <div style={styles.loading}>Loading pending payments...</div>;
    
    return (
      <div style={styles.pendingSection}>
        <div style={styles.sectionHeader}>
          <h3>⏳ Pending Payment Approvals</h3>
          <span style={styles.badge}>{pendingPayments.length} waiting</span>
        </div>

        {pendingPayments.length === 0 ? (
          <div style={styles.emptyState}>
            <div>✅</div>
            <p>No pending payments</p>
            <small>All payments have been approved or cancelled</small>
          </div>
        ) : (
          <div style={styles.pendingList}>
            {pendingPayments.map(payment => (
              <div key={payment.id} style={styles.pendingItem}>
                <div style={styles.paymentMain}>
                  <div style={styles.customerInfo}>
                    <strong>{payment.customerName}</strong>
                    <small>{payment.customerEmail}</small>
                  </div>
                  <div style={styles.amountInfo}>
                    <strong style={styles.amount}>₹{payment.amount}</strong>
                    <small>{payment.note || 'No description'}</small>
                  </div>
                  <div style={styles.timeInfo}>
                    <div style={styles.timeRemaining}>
                      ⏰ {payment.timeRemaining}h left
                    </div>
                    <small>
                      Recorded: {payment.recordedAt?.toDate().toLocaleDateString()}
                    </small>
                  </div>
                </div>
                
                <div style={styles.balanceInfo}>
                  <div style={styles.balanceRow}>
                    <span>Current:</span>
                    <span>₹{payment.currentBalance}</span>
                  </div>
                  <div style={styles.balanceRow}>
                    <span>After Payment:</span>
                    <span style={styles.newBalance}>₹{payment.newBalance}</span>
                  </div>
                </div>

                <button 
                  onClick={() => cancelPendingPayment(payment.id)}
                  style={styles.cancelButton}
                >
                  🗑️ Cancel
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Missing SummaryCard component - ADD THIS
  const SummaryCard = ({ title, value, subtitle, type, percent }) => {
    let cardStyle = { ...styles.summaryCard };
    
    if (type === 'percent' && percent >= 90) {
      cardStyle = { ...cardStyle, ...styles.summaryCardCritical };
    } else if (type === 'percent' && percent >= 80) {
      cardStyle = { ...cardStyle, ...styles.summaryCardWarning };
    }

    return (
      <div style={cardStyle}>
        <div style={styles.summaryValue}>{value}</div>
        <div style={styles.summaryTitle}>{title}</div>
        <div style={styles.summarySubtitle}>{subtitle}</div>
      </div>
    );
  };

  // BULLETPROOF UTILIZATION CALCULATION
  const calculateUtilization = (customer) => {
    // Safety checks for all possible edge cases
    if (!customer || 
        customer.currentBalance === undefined || 
        customer.currentBalance === null ||
        !customer.creditLimit || 
        customer.creditLimit === 0) {
      return 0;
    }
    
    const percent = Math.round((customer.currentBalance / customer.creditLimit) * 100);
    return isNaN(percent) ? 0 : Math.min(percent, 100); // Cap at 100%
  };

  // Missing CustomerCreditsTable component
  const CustomerCreditsTable = ({ customers, onViewDetails, onSetLimit, onViewTransactions }) => {
    if (customers.length === 0) {
      return (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>💳</div>
          <h4>No Customers with Credit</h4>
          <p>Customer credit accounts will appear here once created.</p>
        </div>
      );
    }

    return (
      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Customer</th>
              <th style={styles.th}>Current Balance</th>
              <th style={styles.th}>Credit Limit</th>
              <th style={styles.th}>Available Credit</th>
              <th style={styles.th}>Utilization</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {customers.map(customer => (
              <tr key={customer.id} style={styles.tr}>
                <td style={styles.td}>
                  <div style={styles.customerInfo}>
                    <strong>{customer.customerName || 'Unknown Customer'}</strong>
                    <div style={styles.customerEmail}>{customer.customerEmail}</div>
                  </div>
                </td>
                <td style={styles.td}>
                  <span style={styles.balanceAmount}>₹{customer.currentBalance?.toLocaleString()}</span>
                </td>
                <td style={styles.td}>₹{customer.creditLimit?.toLocaleString()}</td>
                <td style={styles.td}>
                  <span style={styles.availableCredit}>₹{customer.availableCredit?.toLocaleString()}</span>
                </td>
                <td style={styles.td}>
                <div style={styles.utilizationContainer}>
                  <div style={styles.utilizationBar}>
                    <div 
                      style={{
                        ...styles.utilizationFill,
                        width: `${calculateUtilization(customer)}%`,
                        ...getStatusStyle(calculateUtilization(customer))
                      }}
                    />
                  </div>
                  <span style={styles.utilizationText}>
                    {calculateUtilization(customer)}%
                  </span>
                </div>
              </td>
                <td style={styles.td}>
                  <div style={styles.actionButtons}>
                    <button 
                      onClick={() => onViewDetails(customer)}
                      style={styles.viewButton}
                    >
                      👁️ View
                    </button>
                    <button 
                      onClick={() => onSetLimit(customer)}
                      style={styles.limitButton}
                    >
                      ⚙️ Limit
                    </button>
                    <button 
                      onClick={() => onViewTransactions(customer)}
                      style={styles.transactionButton}
                    >
                      📋 History
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  if (loading) {
    return <div style={styles.loading}>Loading credit analytics...</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2>👥 Customer Credit Management</h2>
        <p>Set credit limits and track customer balances</p>
      </div>

      {/* Summary Cards */}
      <div style={styles.summaryGrid}>
        <SummaryCard 
          title="Total Outstanding"
          value={`₹${creditData.summary.totalOutstanding.toLocaleString()}`}
          subtitle="Across all customers"
          type="money"
        />
        <SummaryCard 
          title="Credit Limit Used"
          value={`${creditData.summary.utilizationPercent}%`}
          subtitle="Of total available credit"
          type="percent"
          percent={creditData.summary.utilizationPercent}
        />
        <SummaryCard 
          title="Customers with Credit"
          value={creditData.summary.customerCount}
          subtitle="Active credit accounts"
          type="count"
        />
        <SummaryCard 
          title="Available Credit"
          value={`₹${(creditData.summary.totalLimit - creditData.summary.totalOutstanding).toLocaleString()}`}
          subtitle="Remaining across all customers"
          type="available"
        />
      </div>

      {/* Quick Actions */}
      <div style={styles.quickActions}>
        <h3>Quick Actions</h3>
        <div style={styles.actionButtons}>
          <button 
            onClick={() => {
              // View All Transactions logic
              if (creditData.customers.length === 0) {
                alert('No customers with credit accounts');
                return;
              }
              setSelectedCustomer(creditData.customers[0]);
              setShowTransactionModal(true);
            }}
            style={styles.actionBtn}
            disabled={creditData.customers.length === 0}
          >
            📋 View All Transactions
          </button>
          <button 
            onClick={exportCreditReport}
            style={styles.actionBtn}
            disabled={exportLoading || creditData.customers.length === 0}
          >
            {exportLoading ? '⏳ Exporting...' : '📤 Export Credit Report'}
          </button>
        </div>
      </div>
      

      {/* Customer Credits Table */}
      <div style={styles.tableSection}>
        <div style={styles.tableHeader}>
          <h3>Customer Credit Limits & Balances</h3>
          <div style={styles.tableStats}>
            Showing {creditData.customers.length} customer{creditData.customers.length !== 1 ? 's' : ''}
          </div>
        </div>
        
        <CustomerCreditsTable 
          customers={creditData.customers}
          onViewDetails={setSelectedCustomer}
          onSetLimit={(customer) => {
            setSelectedCustomer(customer);
            setShowSetLimitModal(true);
          }}
          onViewTransactions={(customer) => {
            setSelectedCustomer(customer);
            setShowTransactionModal(true);
          }}
        />
      </div>

      {/* ALL YOUR EXISTING MODALS */}
      {selectedCustomer && !showSetLimitModal && !showTransactionModal && !showRecordPaymentModal && (
        <CustomerDetailView 
          customer={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
          onSetLimit={() => setShowSetLimitModal(true)}
          onRecordPayment={() => setShowRecordPaymentModal(true)}
          onViewTransactions={() => setShowTransactionModal(true)}
        />
      )}

      {selectedCustomer && showSetLimitModal && (
        <SetCreditLimitModal 
          customer={selectedCustomer}
          onClose={() => {
            setSelectedCustomer(null);
            setShowSetLimitModal(false);
          }}
          onUpdateLimit={updateCreditLimit}
        />
      )}

      {selectedCustomer && showTransactionModal && (
        <TransactionHistoryModal 
          customer={selectedCustomer}
          onClose={() => {
            setSelectedCustomer(null);
            setShowTransactionModal(false);
          }}
        />
      )}

      {selectedCustomer && showRecordPaymentModal && (
        <RecordPaymentModal 
          customer={selectedCustomer}
          onClose={() => {
            setSelectedCustomer(null);
            setShowRecordPaymentModal(false);
          }}
          onRecordPayment={recordPayment}
        />
      )}
    </div>
  );
};

// Customer Detail View Component (UPDATED)
const CustomerDetailView = ({ customer, onClose, onSetLimit, onRecordPayment, onViewTransactions }) => {
  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalContent}>
        <div style={styles.modalHeader}>
          <h3>Customer Credit Details</h3>
          <button onClick={onClose} style={styles.closeButton}>✕</button>
        </div>
        
        <div style={styles.customerDetail}>
          <div style={styles.detailGrid}>
            <div style={styles.detailItem}>
              <label>Customer Name:</label>
              <span>{customer.customerName || 'Unknown Customer'}</span>
            </div>
            <div style={styles.detailItem}>
              <label>Email:</label>
              <span>{customer.customerEmail || 'Not provided'}</span>
            </div>
            <div style={styles.detailItem}>
              <label>Current Balance:</label>
              <span style={styles.balance}>₹{customer.currentBalance.toLocaleString()}</span>
            </div>
            <div style={styles.detailItem}>
              <label>Credit Limit:</label>
              <span>₹{customer.creditLimit.toLocaleString()}</span>
            </div>
            <div style={styles.detailItem}>
              <label>Available Credit:</label>
              <span style={styles.available}>₹{customer.availableCredit.toLocaleString()}</span>
            </div>
            <div style={styles.detailItem}>
              <label>Credit Utilization:</label>
              <span style={getUtilizationStyle(customer.utilizationPercent)}>
                {customer.utilizationPercent}%
              </span>
            </div>
          </div>
          
          <div style={styles.creditHealth}>
            <h4>Credit Health</h4>
            <div style={styles.healthIndicator}>
              <div 
                style={{
                  ...styles.healthBar,
                  width: `${customer.utilizationPercent}%`,
                  ...getStatusStyle(customer.utilizationPercent)
                }}
              />
            </div>
            <div style={styles.healthLabels}>
              <span>Good</span>
              <span>Warning</span>
              <span>Critical</span>
            </div>
          </div>
          
          <div style={styles.modalActions}>
            <button onClick={onSetLimit} style={styles.primaryButton}>
              ⚙️ Adjust Credit Limit
            </button>
            <button onClick={onRecordPayment} style={styles.secondaryButton}>
              💳 Record Payment
            </button>
            <button onClick={onViewTransactions} style={styles.secondaryButton}>
              📋 Transaction History
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Set Credit Limit Modal Component (keep existing)
const SetCreditLimitModal = ({ customer, onClose, onUpdateLimit }) => {
  const [newLimit, setNewLimit] = useState(customer.creditLimit);
  const [updating, setUpdating] = useState(false);

  const handleUpdate = async () => {
    if (newLimit < customer.currentBalance) {
      alert('❌ Credit limit cannot be less than current balance');
      return;
    }
    
    setUpdating(true);
    await onUpdateLimit(customer.id, newLimit);
    setUpdating(false);
  };

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalContent}>
        <div style={styles.modalHeader}>
          <h3>Set Credit Limit</h3>
          <button onClick={onClose} style={styles.closeButton}>✕</button>
        </div>
        
        <div style={styles.limitModal}>
          <div style={styles.customerInfo}>
            <strong>{customer.customerName || 'Unknown Customer'}</strong>
            <div>Current Balance: ₹{customer.currentBalance.toLocaleString()}</div>
          </div>
          
          <div style={styles.inputGroup}>
            <label>New Credit Limit (₹)</label>
            <input
              type="number"
              value={newLimit}
              onChange={(e) => setNewLimit(Number(e.target.value))}
              style={styles.limitInput}
              min={customer.currentBalance}
              step="100"
            />
            <div style={styles.limitHelp}>
              Minimum: ₹{customer.currentBalance.toLocaleString()} (current balance)
            </div>
          </div>
          
          <div style={styles.limitPreview}>
            <div style={styles.previewItem}>
              <span>Current Limit:</span>
              <span>₹{customer.creditLimit.toLocaleString()}</span>
            </div>
            <div style={styles.previewItem}>
              <span>New Limit:</span>
              <span style={styles.newLimit}>₹{newLimit.toLocaleString()}</span>
            </div>
            <div style={styles.previewItem}>
              <span>Available Credit:</span>
              <span style={styles.available}>
                ₹{(newLimit - customer.currentBalance).toLocaleString()}
              </span>
            </div>
            <div style={styles.previewItem}>
              <span>Utilization:</span>
              <span>
                {Math.round((customer.currentBalance / newLimit) * 100)}%
              </span>
            </div>
          </div>
          
          <div style={styles.modalActions}>
            <button onClick={onClose} style={styles.cancelButton}>
              Cancel
            </button>
            <button 
              onClick={handleUpdate}
              disabled={updating || newLimit === customer.creditLimit}
              style={updating ? styles.updateButtonDisabled : styles.updateButton}
            >
              {updating ? 'Updating...' : 'Update Credit Limit'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Transaction History Modal Component (NEW)
const TransactionHistoryModal = ({ customer, onClose }) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (customer && customer.paymentHistory) {
      setTransactions(customer.paymentHistory.sort((a, b) => 
        new Date(b.date?.toDate()) - new Date(a.date?.toDate())
      ));
      setLoading(false);
    } else {
      setTransactions([]);
      setLoading(false);
    }
  }, [customer]);

  const getTransactionColor = (amount) => {
    return amount < 0 ? '#27ae60' : '#e74c3c'; // Green for payments, Red for purchases
  };

  const getTransactionType = (amount, type) => {
    if (amount < 0) return '💰 Payment Received';
    if (type === 'credit_purchase') return '🛍️ Credit Purchase';
    if (type === 'return_refund') return '🔄 Return Refund';
    return '💳 Transaction';
  };

  return (
    <div style={styles.modalOverlay}>
      <div style={{...styles.modalContent, maxWidth: '800px'}}>
        <div style={styles.modalHeader}>
          <h3>📊 Transaction History - {customer.customerName}</h3>
          <button onClick={onClose} style={styles.closeButton}>✕</button>
        </div>

        <div style={styles.transactionSummary}>
          <div style={styles.summaryItem}>
            <span>Current Balance:</span>
            <span style={styles.balance}>₹{customer.currentBalance?.toLocaleString()}</span>
          </div>
          <div style={styles.summaryItem}>
            <span>Credit Limit:</span>
            <span>₹{customer.creditLimit?.toLocaleString()}</span>
          </div>
          <div style={styles.summaryItem}>
            <span>Total Transactions:</span>
            <span>{transactions.length}</span>
          </div>
        </div>

        {loading ? (
          <div style={styles.loading}>Loading transactions...</div>
        ) : transactions.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>📝</div>
            <h4>No Transactions Yet</h4>
            <p>Transaction history will appear here once payments or purchases are made.</p>
          </div>
        ) : (
          <div style={styles.transactionsList}>
            <h4>Recent Transactions ({transactions.length})</h4>
            {transactions.map((transaction, index) => (
              <div key={index} style={styles.transactionItem}>
                <div style={styles.transactionLeft}>
                  <div style={styles.transactionType}>
                    {getTransactionType(transaction.amount, transaction.type)}
                  </div>
                  <div style={styles.transactionDesc}>
                    {transaction.description}
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
        )}

        <div style={styles.modalActions}>
          <button onClick={onClose} style={styles.cancelButton}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// Record Payment Modal Component (NEW)
const RecordPaymentModal = ({ customer, onClose, onRecordPayment }) => {
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [processing, setProcessing] = useState(false);

  const handleRecordPayment = async () => {
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      alert('Please enter a valid payment amount');
      return;
    }

    if (amount > customer.currentBalance) {
      alert(`Payment amount cannot exceed current balance of ₹${customer.currentBalance}`);
      return;
    }

    setProcessing(true);
    await onRecordPayment(customer.id, amount, paymentNote);
    setProcessing(false);
    onClose();
  };

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalContent}>
        <div style={styles.modalHeader}>
          <h3>💰 Record Payment</h3>
          <button onClick={onClose} style={styles.closeButton}>✕</button>
        </div>

        <div style={styles.paymentModal}>
          <div style={styles.customerInfo}>
            <strong>{customer.customerName}</strong>
            <div>Current Balance: ₹{customer.currentBalance?.toLocaleString()}</div>
          </div>

          <div style={styles.inputGroup}>
            <label>Payment Amount (₹)</label>
            <input
              type="number"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              style={styles.limitInput}
              min="1"
              max={customer.currentBalance}
              step="1"
              placeholder="Enter payment amount"
            />
            <div style={styles.limitHelp}>
              Maximum: ₹{customer.currentBalance?.toLocaleString()}
            </div>
          </div>

          <div style={styles.inputGroup}>
            <label>Payment Note (Optional)</label>
            <textarea
              value={paymentNote}
              onChange={(e) => setPaymentNote(e.target.value)}
              style={styles.textarea}
              placeholder="e.g., Cash payment, Bank transfer, etc."
              rows="3"
            />
          </div>

          <div style={styles.paymentPreview}>
            <div style={styles.previewItem}>
              <span>Current Balance:</span>
              <span>₹{customer.currentBalance?.toLocaleString()}</span>
            </div>
            <div style={styles.previewItem}>
              <span>Payment Amount:</span>
              <span style={styles.paymentAmount}>-₹{paymentAmount || '0'}</span>
            </div>
            <div style={styles.previewItem}>
              <span>New Balance:</span>
              <span style={styles.newBalance}>
                ₹{Math.max(0, customer.currentBalance - (parseFloat(paymentAmount) || 0)).toLocaleString()}
              </span>
            </div>
          </div>

          <div style={styles.modalActions}>
            <button onClick={onClose} style={styles.cancelButton}>
              Cancel
            </button>
            <button 
              onClick={handleRecordPayment}
              disabled={processing || !paymentAmount || parseFloat(paymentAmount) <= 0}
              style={processing ? styles.updateButtonDisabled : styles.updateButton}
            >
              {processing ? 'Processing...' : 'Record Payment'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper functions
const getStatusStyle = (percent) => {
  if (percent >= 90) return { backgroundColor: '#e74c3c' };
  if (percent >= 80) return { backgroundColor: '#f39c12' };
  return { backgroundColor: '#27ae60' };
};

const getUtilizationStyle = (percent) => {
  if (percent >= 90) return { color: '#e74c3c', fontWeight: 'bold' };
  if (percent >= 80) return { color: '#f39c12', fontWeight: 'bold' };
  return { color: '#27ae60', fontWeight: 'bold' };
};

// COMPLETE STYLES (UPDATED WITH NEW STYLES)
const styles = {
  pendingSection: {
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    marginBottom: '2rem',
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
  badge: {
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
  pendingItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem',
    border: '1px solid #ffeaa7',
    borderRadius: '8px',
    backgroundColor: '#fffdf6',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  paymentMain: {
    flex: 1,
    display: 'flex',
    gap: '1rem',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  customerInfo: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: '150px',
  },
  amountInfo: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    minWidth: '100px',
  },
  amount: {
    fontSize: '1.2rem',
    fontWeight: 'bold',
    color: '#27ae60',
  },
  timeInfo: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    minWidth: '120px',
  },
  timeRemaining: {
    color: '#e67e22',
    fontWeight: '600',
    fontSize: '0.9rem',
  },
  balanceInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    minWidth: '150px',
  },
  balanceRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.9rem',
  },
  newBalance: {
    color: '#27ae60',
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#e74c3c',
    color: 'white',
    border: 'none',
    padding: '0.5rem 1rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.8rem',
  },
  container: {
    padding: '1rem',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  header: {
    marginBottom: '2rem',
    borderBottom: '1px solid #ecf0f1',
    paddingBottom: '1rem',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1rem',
    marginBottom: '2rem',
  },
  summaryCard: {
    backgroundColor: '#f8f9fa',
    padding: '1.5rem',
    borderRadius: '8px',
    border: '1px solid #e9ecef',
    textAlign: 'center',
  },
  summaryCardWarning: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffeaa7',
  },
  summaryCardCritical: {
    backgroundColor: '#f8d7da',
    borderColor: '#f5c6cb',
  },
  summaryValue: {
    fontSize: '1.8rem',
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: '0.5rem',
  },
  summaryTitle: {
    fontSize: '1rem',
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: '0.25rem',
  },
  summarySubtitle: {
    fontSize: '0.8rem',
    color: '#7f8c8d',
  },
  quickActions: {
    marginBottom: '2rem',
    padding: '1.5rem',
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
  },
  actionButtons: {
    display: 'flex',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  actionBtn: {
    backgroundColor: '#3498db',
    color: 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.9rem',
  },
  tableSection: {
    backgroundColor: 'white',
    borderRadius: '8px',
    border: '1px solid #e9ecef',
  },
  tableHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1.5rem 1.5rem 0.5rem 1.5rem',
  },
  tableStats: {
    color: '#7f8c8d',
    fontSize: '0.9rem',
  },
  tableContainer: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    padding: '1rem',
    textAlign: 'left',
    backgroundColor: '#f8f9fa',
    borderBottom: '1px solid #dee2e6',
    fontWeight: '600',
    color: '#2c3e50',
  },
  tr: {
    borderBottom: '1px solid #ecf0f1',
    '&:hover': {
      backgroundColor: '#f8f9fa',
    },
  },
  td: {
    padding: '1rem',
    verticalAlign: 'middle',
  },
  customerEmail: {
    fontSize: '0.8rem',
    color: '#7f8c8d',
    marginTop: '0.25rem',
  },
  balanceAmount: {
    color: '#e74c3c',
  },
  availableCredit: {
    color: '#27ae60',
    fontWeight: '600',
  },
  utilizationContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  utilizationBar: {
    flex: 1,
    height: '8px',
    backgroundColor: '#ecf0f1',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  utilizationFill: {
    height: '100%',
    borderRadius: '4px',
    transition: 'width 0.3s ease',
  },
  utilizationText: {
    fontSize: '0.8rem',
    fontWeight: '600',
    minWidth: '35px',
    textAlign: 'right',
  },
  viewButton: {
    backgroundColor: '#3498db',
    color: 'white',
    border: 'none',
    padding: '0.4rem 0.8rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.8rem',
  },
  limitButton: {
    backgroundColor: '#95a5a6',
    color: 'white',
    border: 'none',
    padding: '0.4rem 0.8rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.8rem',
  },
  transactionButton: {
    backgroundColor: '#9b59b6',
    color: 'white',
    border: 'none',
    padding: '0.4rem 0.8rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.8rem',
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
  loading: {
    textAlign: 'center',
    padding: '3rem',
    color: '#7f8c8d',
    fontSize: '1.1rem',
  },
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
  customerDetail: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  detailGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1rem',
  },
  detailItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  balance: {
    color: '#e74c3c',
    fontWeight: 'bold',
  },
  available: {
    color: '#27ae60',
    fontWeight: 'bold',
  },
  creditHealth: {
    padding: '1rem',
    backgroundColor: '#f8f9fa',
    borderRadius: '6px',
  },
  healthIndicator: {
    height: '8px',
    backgroundColor: '#ecf0f1',
    borderRadius: '4px',
    overflow: 'hidden',
    margin: '0.5rem 0',
  },
  healthBar: {
    height: '100%',
    borderRadius: '4px',
  },
  healthLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.7rem',
    color: '#7f8c8d',
  },
  modalActions: {
    display: 'flex',
    gap: '0.5rem',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
  },
  primaryButton: {
    backgroundColor: '#3498db',
    color: 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.9rem',
  },
  secondaryButton: {
    backgroundColor: '#95a5a6',
    color: 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.9rem',
  },
  limitModal: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  limitInput: {
    padding: '0.75rem',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '1rem',
  },
  limitHelp: {
    fontSize: '0.8rem',
    color: '#7f8c8d',
  },
  limitPreview: {
    padding: '1rem',
    backgroundColor: '#e8f4fd',
    borderRadius: '6px',
    border: '1px solid #b3d9ff',
  },
  previewItem: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '0.5rem',
  },
  newLimit: {
    color: '#3498db',
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: '#95a5a6',
    color: 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  updateButton: {
    backgroundColor: '#27ae60',
    color: 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  updateButtonDisabled: {
    backgroundColor: '#bdc3c7',
    color: 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '6px',
    cursor: 'not-allowed',
  },

  // NEW STYLES FOR TRANSACTIONS AND PAYMENTS
  transactionSummary: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '1rem',
    marginBottom: '1.5rem',
    padding: '1rem',
    backgroundColor: '#f8f9fa',
    borderRadius: '6px',
  },
  summaryItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
  },
  transactionsList: {
    marginBottom: '1.5rem',
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
  paymentModal: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  paymentPreview: {
    padding: '1rem',
    backgroundColor: '#e8f4fd',
    borderRadius: '6px',
    border: '1px solid #b3d9ff',
  },
  paymentAmount: {
    color: '#27ae60',
    fontWeight: 'bold',
  },
  newBalance: {
    color: '#3498db',
    fontWeight: 'bold',
  },
  textarea: {
    width: '100%',
    padding: '0.75rem',
    border: '1px solid #ced4da',
    borderRadius: '4px',
    fontSize: '1rem',
    resize: 'vertical',
    fontFamily: 'inherit',
    minHeight: '80px',
  },
  statusNormal: { backgroundColor: '#27ae60' },
  statusWarning: { backgroundColor: '#f39c12' },
  statusCritical: { backgroundColor: '#e74c3c' },
};

export default CustomerCreditManager;