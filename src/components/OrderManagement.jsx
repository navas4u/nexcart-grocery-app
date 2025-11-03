// src/components/OrderManagement.jsx - OPTIMIZED VERSION
import { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, query, where, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

// Utility functions for consistent calculations
const calculateItemTotal = (item) => {
  return (item.price * item.quantity).toFixed(2);
};

const normalizeOrderItems = (items) => {
  return items.map(item => ({
    ...item,
    total: calculateItemTotal(item)
  }));
};

const OrderManagement = ({ shopId }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [updatingOrder, setUpdatingOrder] = useState(null);
  const auth = getAuth();

  // Real-time listener for orders
  useEffect(() => {
    if (!shopId) return;

    setLoading(true);
    console.log('🔄 Setting up real-time listener for shop:', shopId);

    const ordersQuery = query(
      collection(db, 'orders'),
      where('shopId', '==', shopId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(ordersQuery, 
      (snapshot) => {
        const ordersList = [];
        snapshot.forEach((doc) => {
          const orderData = doc.data();
          ordersList.push({ 
            id: doc.id, 
            ...orderData,
            items: normalizeOrderItems(orderData.items || [])
          });
        });
        
        console.log('✅ Real-time update - Shop orders:', ordersList.length);
        setOrders(ordersList);
        setLoading(false);
        setError(null);
      },
      (error) => {
        console.error('❌ Real-time listener error:', error);
        setError('Failed to load orders. Please refresh the page.');
        setLoading(false);
      }
    );

    // Cleanup listener on unmount
    return () => {
      console.log('🧹 Cleaning up real-time listener');
      unsubscribe();
    };
  }, [shopId]);

  const updateOrderStatus = async (orderId, status, creditApproved = null) => {
    if (updatingOrder === orderId) return; // Prevent duplicate updates
    
    setUpdatingOrder(orderId);
    
    try {
      const updateData = {
        status: status,
        updatedAt: new Date()
      };
      
      if (creditApproved !== null) {
        updateData.creditApproved = creditApproved;
        if (creditApproved && status === 'pending_approval') {
          updateData.status = 'confirmed';
        }
      }

      await updateDoc(doc(db, 'orders', orderId), updateData);
      console.log(`✅ Order ${orderId} updated to ${status}`);
      
    } catch (error) {
      console.error('Error updating order:', error);
      alert('Error updating order. Please try again.');
    } finally {
      setUpdatingOrder(null);
    }
  };

  const getStatusBadge = (status, creditRequested, creditApproved) => {
    const statusConfig = {
      'pending_approval': { color: '#f39c12', label: '⏳ Pending Approval' },
      'confirmed': { color: '#27ae60', label: '✅ Confirmed' },
      'preparing': { color: '#3498db', label: '👨‍🍳 Preparing' },
      'ready': { color: '#9b59b6', label: '📦 Ready for Pickup' },
      'completed': { color: '#2c3e50', label: '🎉 Completed' },
      'cancelled': { color: '#e74c3c', label: '❌ Cancelled' }
    };

    let statusInfo = statusConfig[status] || { color: '#95a5a6', label: status };
    
    if (creditRequested && !creditApproved && status === 'pending_approval') {
      statusInfo = { color: '#e67e22', label: '💳 Credit Review Needed' };
    }

    return (
      <span style={{
        backgroundColor: statusInfo.color,
        color: 'white',
        padding: '0.5rem 1rem',
        borderRadius: '20px',
        fontSize: '0.9rem',
        fontWeight: '600',
        display: 'inline-block',
      }}>
        {statusInfo.label}
      </span>
    );
  };

  const getPaymentBadge = (paymentMethod, creditAmount, cashAmount) => {
    const paymentConfig = {
      'cash': { emoji: '💵', label: 'Cash' },
      'credit': { emoji: '🪙', label: 'Full Credit' },
      'split': { emoji: '💰', label: `Split (Credit: $${creditAmount?.toFixed(2)})` }
    };

    const paymentInfo = paymentConfig[paymentMethod] || { emoji: '💳', label: 'Payment' };

    return (
      <span style={styles.paymentBadge}>
        {paymentInfo.emoji} {paymentInfo.label}
      </span>
    );
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Date not available';
    
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  };

  const getOrderStats = () => {
    const stats = {
      total: orders.length,
      pending: orders.filter(o => o.status === 'pending_approval').length,
      creditReview: orders.filter(o => o.creditRequested && !o.creditApproved).length,
      active: orders.filter(o => ['confirmed', 'preparing', 'ready'].includes(o.status)).length,
      completed: orders.filter(o => o.status === 'completed').length
    };
    return stats;
  };

  if (loading) {
    return (
      <div style={styles.loading}>
        <h3>Loading Orders...</h3>
        <p>Fetching your store orders...</p>
        <div style={styles.loadingSpinner}>⏳</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.errorContainer}>
        <h3>❌ Error Loading Orders</h3>
        <p>{error}</p>
        <button 
          onClick={() => window.location.reload()}
          style={styles.refreshButton}
        >
          🔄 Reload Page
        </button>
      </div>
    );
  }

  const stats = getOrderStats();

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h2>📦 Order Management</h2>
        <div style={styles.headerActions}>
          <div style={styles.realTimeIndicator}>
            <span style={styles.liveDot}>●</span>
            Live Updates
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statNumber}>{stats.total}</div>
          <div style={styles.statLabel}>Total Orders</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statNumber}>{stats.pending}</div>
          <div style={styles.statLabel}>Pending Approval</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statNumber}>{stats.creditReview}</div>
          <div style={styles.statLabel}>Credit Review</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statNumber}>{stats.active}</div>
          <div style={styles.statLabel}>Active Orders</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statNumber}>{stats.completed}</div>
          <div style={styles.statLabel}>Completed</div>
        </div>
      </div>

      {orders.length === 0 ? (
        <div style={styles.emptyState}>
          <h3>No orders yet</h3>
          <p>Orders from customers will appear here.</p>
          <div style={styles.emptyTips}>
            <p>💡 <strong>When orders come in:</strong></p>
            <ul style={styles.tipsList}>
              <li>Review credit requests and approve/decline</li>
              <li>Update order status as you prepare items</li>
              <li>Mark orders ready when complete</li>
              <li>Complete orders after pickup/delivery</li>
            </ul>
          </div>
        </div>
      ) : (
        <div style={styles.ordersGrid}>
          {orders.map(order => (
            <div key={order.id} style={styles.orderCard}>
              <div style={styles.orderHeader}>
                <div style={styles.orderInfo}>
                  <h3 style={styles.orderTitle}>Order #{order.id.slice(-8).toUpperCase()}</h3>
                  <div style={styles.customerInfo}>
                    <span>👤 {order.customerEmail}</span>
                    <span>📅 {formatDate(order.createdAt)}</span>
                  </div>
                </div>
                <div style={styles.orderStatus}>
                  {getStatusBadge(order.status, order.creditRequested, order.creditApproved)}
                  {getPaymentBadge(order.paymentMethod, order.creditAmount, order.cashAmount)}
                </div>
              </div>

              {/* Order Items */}
              <div style={styles.orderItems}>
                <h4>🛍️ Items:</h4>
                <div style={styles.itemsList}>
                  {order.items.map((item, index) => (
                    <div key={index} style={styles.orderItem}>
                      <span style={styles.itemName}>{item.name}</span>
                      <span style={styles.itemQuantity}>{item.quantity} {item.unit}</span>
                      <span style={styles.itemPrice}>${calculateItemTotal(item)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order Total */}
              <div style={styles.orderTotal}>
                <strong>Total: ${order.orderTotal?.toFixed(2)}</strong>
                {order.paymentMethod !== 'cash' && (
                  <span style={styles.creditInfo}>
                    Credit: ${order.creditAmount?.toFixed(2)} | Cash: ${order.cashAmount?.toFixed(2)}
                  </span>
                )}
              </div>

              {/* Order Notes */}
              {order.orderNotes && (
                <div style={styles.orderNotes}>
                  <strong>📝 Customer Notes:</strong> 
                  <p style={styles.notesText}>{order.orderNotes}</p>
                </div>
              )}

              {/* Order Actions */}
              <div style={styles.orderActions}>
                {/* Credit Approval Actions */}
                {order.creditRequested && !order.creditApproved && order.status === 'pending_approval' && (
                  <div style={styles.actionGroup}>
                    <h4>💳 Credit Approval Required:</h4>
                    <div style={styles.actionButtons}>
                      <button 
                        onClick={() => updateOrderStatus(order.id, 'confirmed', true)}
                        disabled={updatingOrder === order.id}
                        style={updatingOrder === order.id ? styles.buttonDisabled : styles.approveButton}
                      >
                        {updatingOrder === order.id ? '⏳ Approving...' : '✅ Approve Credit'}
                      </button>
                      <button 
                        onClick={() => updateOrderStatus(order.id, 'cancelled', false)}
                        disabled={updatingOrder === order.id}
                        style={updatingOrder === order.id ? styles.buttonDisabled : styles.rejectButton}
                      >
                        ❌ Decline Credit
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Order Progress Actions */}
                <div style={styles.actionGroup}>
                  <h4>Update Status:</h4>
                  <div style={styles.actionButtons}>
                    {order.status === 'confirmed' && (
                      <button 
                        onClick={() => updateOrderStatus(order.id, 'preparing')}
                        disabled={updatingOrder === order.id}
                        style={updatingOrder === order.id ? styles.buttonDisabled : styles.actionButton}
                      >
                        {updatingOrder === order.id ? '⏳ Updating...' : '👨‍🍳 Start Preparing'}
                      </button>
                    )}
                    
                    {order.status === 'preparing' && (
                      <button 
                        onClick={() => updateOrderStatus(order.id, 'ready')}
                        disabled={updatingOrder === order.id}
                        style={updatingOrder === order.id ? styles.buttonDisabled : styles.actionButton}
                      >
                        {updatingOrder === order.id ? '⏳ Updating...' : '📦 Mark Ready'}
                      </button>
                    )}
                    
                    {order.status === 'ready' && (
                      <button 
                        onClick={() => updateOrderStatus(order.id, 'completed')}
                        disabled={updatingOrder === order.id}
                        style={updatingOrder === order.id ? styles.buttonDisabled : styles.completeButton}
                      >
                        {updatingOrder === order.id ? '⏳ Completing...' : '✅ Complete Order'}
                      </button>
                    )}
                    
                    {/* Cancel Order */}
                    {(order.status === 'pending_approval' || order.status === 'confirmed' || order.status === 'preparing') && (
                      <button 
                        onClick={() => {
                          if (window.confirm('Are you sure you want to cancel this order?')) {
                            updateOrderStatus(order.id, 'cancelled');
                          }
                        }}
                        disabled={updatingOrder === order.id}
                        style={updatingOrder === order.id ? styles.buttonDisabled : styles.cancelButton}
                      >
                        ❌ Cancel Order
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Update Indicator */}
              {updatingOrder === order.id && (
                <div style={styles.updatingIndicator}>
                  ⏳ Updating order status...
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            {/* Modal content for detailed order view */}
            <div style={styles.modalHeader}>
              <h3>Order Details</h3>
              <button 
                onClick={() => setSelectedOrder(null)}
                style={styles.closeButton}
              >
                ✕
              </button>
            </div>
            {/* Add detailed order view here */}
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    padding: '0',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2rem',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '2rem',
  },
  realTimeIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.8rem',
    color: '#27ae60',
    fontWeight: '600',
  },
  liveDot: {
    color: '#27ae60',
    fontSize: '1.2rem',
    animation: 'pulse 1.5s infinite',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '1rem',
    marginBottom: '2rem',
  },
  statCard: {
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    textAlign: 'center',
    border: '1px solid #ecf0f1',
  },
  statNumber: {
    fontSize: '2rem',
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: '0.5rem',
  },
  statLabel: {
    fontSize: '0.9rem',
    color: '#7f8c8d',
    fontWeight: '600',
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '3rem',
    textAlign: 'center',
    gap: '1rem',
  },
  loadingSpinner: {
    fontSize: '2rem',
    animation: 'spin 1s linear infinite',
  },
  errorContainer: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '3rem',
    textAlign: 'center',
    gap: '1rem',
    backgroundColor: '#f8d7da',
    color: '#721c24',
    borderRadius: '8px',
    margin: '2rem',
  },
  refreshButton: {
    backgroundColor: '#3498db',
    color: 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '1rem',
  },
  emptyState: {
    textAlign: 'center',
    padding: '3rem',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  emptyTips: {
    textAlign: 'left',
    maxWidth: '500px',
    margin: '0 auto',
  },
  tipsList: {
    textAlign: 'left',
    marginTop: '1rem',
    lineHeight: '1.6',
    paddingLeft: '1.5rem',
  },
  ordersGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  orderCard: {
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    border: '1px solid #ecf0f1',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  },
  orderHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '1.5rem',
    flexWrap: 'wrap',
    gap: '1rem',
    borderBottom: '2px solid #f8f9fa',
    paddingBottom: '1rem',
  },
  orderInfo: {
    flex: 1,
  },
  orderTitle: {
    margin: '0 0 0.5rem 0',
    color: '#2c3e50',
  },
  customerInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    fontSize: '0.9rem',
    color: '#7f8c8d',
  },
  orderStatus: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    alignItems: 'flex-end',
    minWidth: '200px',
  },
  paymentBadge: {
    backgroundColor: '#e8f4fd',
    color: '#3498db',
    padding: '0.5rem 1rem',
    borderRadius: '20px',
    fontSize: '0.9rem',
    fontWeight: '600',
    textAlign: 'center',
  },
  orderItems: {
    marginBottom: '1rem',
  },
  itemsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    marginTop: '0.5rem',
  },
  orderItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.75rem',
    backgroundColor: '#f8f9fa',
    borderRadius: '4px',
    transition: 'background-color 0.2s ease',
  },
  itemName: {
    flex: 2,
    fontWeight: '500',
  },
  itemQuantity: {
    flex: 1,
    textAlign: 'center',
    color: '#7f8c8d',
  },
  itemPrice: {
    flex: 1,
    textAlign: 'right',
    fontWeight: '600',
    color: '#2c3e50',
  },
  orderTotal: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 0',
    borderTop: '2px solid #ecf0f1',
    borderBottom: '2px solid #ecf0f1',
    marginBottom: '1rem',
    fontWeight: 'bold',
    fontSize: '1.1rem',
  },
  creditInfo: {
    fontSize: '0.9rem',
    color: '#7f8c8d',
    fontWeight: 'normal',
  },
  orderNotes: {
    padding: '1rem',
    backgroundColor: '#fff3cd',
    border: '1px solid #ffeaa7',
    borderRadius: '4px',
    marginBottom: '1rem',
  },
  notesText: {
    margin: '0.5rem 0 0 0',
    fontStyle: 'italic',
    color: '#856404',
  },
  orderActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  actionGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  actionButtons: {
    display: 'flex',
    gap: '0.75rem',
    flexWrap: 'wrap',
  },
  approveButton: {
    backgroundColor: '#27ae60',
    color: 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: '600',
  },
  rejectButton: {
    backgroundColor: '#e74c3c',
    color: 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: '600',
  },
  actionButton: {
    backgroundColor: '#3498db',
    color: 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: '600',
  },
  completeButton: {
    backgroundColor: '#2c3e50',
    color: 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#95a5a6',
    color: 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: '600',
  },
  buttonDisabled: {
    backgroundColor: '#bdc3c7',
    color: 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '4px',
    cursor: 'not-allowed',
    fontSize: '0.9rem',
    fontWeight: '600',
  },
  updatingIndicator: {
    padding: '0.75rem',
    backgroundColor: '#e8f4fd',
    color: '#3498db',
    borderRadius: '4px',
    textAlign: 'center',
    fontSize: '0.9rem',
    fontWeight: '600',
    marginTop: '1rem',
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
  },
  modal: {
    backgroundColor: 'white',
    padding: '2rem',
    borderRadius: '8px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    width: '90%',
    maxWidth: '600px',
    maxHeight: '90vh',
    overflowY: 'auto',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.5rem',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '1.5rem',
    cursor: 'pointer',
    color: '#666',
  },
};
export default OrderManagement;