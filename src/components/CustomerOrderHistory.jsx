// src/components/CustomerOrderHistory.jsx - OPTIMIZED VERSION
import { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
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

const CustomerOrderHistory = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const auth = getAuth();

  // Real-time listener instead of polling
  useEffect(() => {
    if (!auth.currentUser?.uid) return;

    setLoading(true);
    console.log('🔄 Setting up real-time listener for customer:', auth.currentUser.uid);

    const ordersQuery = query(
      collection(db, 'orders'),
      where('customerId', '==', auth.currentUser.uid),
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
        
        console.log('✅ Real-time update - Orders found:', ordersList.length);
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
  }, [auth.currentUser?.uid]);

  const getStatusBadge = (status, creditRequested, creditApproved) => {
    const statusConfig = {
      'pending_approval': { color: '#f39c12', label: '⏳ Pending Credit Approval', description: 'Waiting for shop to approve your credit request' },
      'confirmed': { color: '#27ae60', label: '✅ Order Confirmed', description: 'Shop has accepted your order' },
      'preparing': { color: '#3498db', label: '👨‍🍳 Preparing Order', description: 'Shop is preparing your items' },
      'ready': { color: '#9b59b6', label: '📦 Ready for Pickup', description: 'Your order is ready for collection' },
      'completed': { color: '#2c3e50', label: '🎉 Order Completed', description: 'Order successfully delivered/picked up' },
      'cancelled': { color: '#e74c3c', label: '❌ Order Cancelled', description: 'Order was cancelled' }
    };

    let statusInfo = statusConfig[status] || { color: '#95a5a6', label: status, description: 'Processing your order' };
    
    if (creditRequested && !creditApproved && status === 'pending_approval') {
      statusInfo = { 
        color: '#e67e22', 
        label: '💳 Awaiting Credit Approval', 
        description: 'Shop needs to approve your credit payment' 
      };
    }

    return (
      <div style={styles.statusSection}>
        <span style={{
          backgroundColor: statusInfo.color,
          color: 'white',
          padding: '0.5rem 1rem',
          borderRadius: '20px',
          fontSize: '0.9rem',
          fontWeight: '600',
          display: 'inline-block',
          marginBottom: '0.5rem',
        }}>
          {statusInfo.label}
        </span>
        <p style={styles.statusDescription}>{statusInfo.description}</p>
      </div>
    );
  };

  const getPaymentBadge = (paymentMethod, creditAmount, cashAmount) => {
    if (paymentMethod === 'cash') {
      return <span style={styles.paymentBadge}>💵 Paid in Cash: ${cashAmount?.toFixed(2)}</span>;
    } else if (paymentMethod === 'credit') {
      return <span style={styles.paymentBadge}>🪙 Paid with Credit: ${creditAmount?.toFixed(2)}</span>;
    } else if (paymentMethod === 'split') {
      return (
        <span style={styles.paymentBadge}>
          💰 Split Payment: Credit ${creditAmount?.toFixed(2)} + Cash ${cashAmount?.toFixed(2)}
        </span>
      );
    }
    return <span style={styles.paymentBadge}>💳 Payment: ${((cashAmount || 0) + (creditAmount || 0))?.toFixed(2)}</span>;
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

  if (loading) {
    return (
      <div style={styles.loading}>
        <h3>Loading Your Orders...</h3>
        <p>Fetching your order history...</p>
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

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2>📋 My Order History</h2>
        <div style={styles.headerActions}>
          <div style={styles.stats}>
            <span>Total Orders: {orders.length}</span>
            <span>Pending: {orders.filter(o => o.status === 'pending_approval').length}</span>
            <span>Active: {orders.filter(o => ['confirmed', 'preparing', 'ready'].includes(o.status)).length}</span>
            <span>Completed: {orders.filter(o => o.status === 'completed').length}</span>
          </div>
          <div style={styles.realTimeIndicator}>
            <span style={styles.liveDot}>●</span>
            Live Updates
          </div>
        </div>
      </div>

      {orders.length === 0 ? (
        <div style={styles.emptyState}>
          <h3>No orders yet</h3>
          <p>Your orders will appear here once you place them.</p>
          <div style={styles.emptyTips}>
            <p>💡 <strong>How to get started:</strong></p>
            <ul style={styles.tipsList}>
              <li>Browse shops and add products to your cart</li>
              <li>Choose payment method (Cash, Credit, or Split)</li>
              <li>Place your order and track its status here</li>
            </ul>
          </div>
        </div>
      ) : (
        <div style={styles.ordersList}>
          {orders.map(order => (
            <div key={order.id} style={styles.orderCard}>
              <div style={styles.orderHeader}>
                <div style={styles.orderBasicInfo}>
                  <h3>Order #{order.id.slice(-8).toUpperCase()}</h3>
                  <p style={styles.shopName}>From: <strong>{order.shopName}</strong></p>
                  <p style={styles.orderDate}>Placed: {formatDate(order.createdAt)}</p>
                </div>
                <div style={styles.orderStatus}>
                  {getStatusBadge(order.status, order.creditRequested, order.creditApproved)}
                </div>
              </div>

              <div style={styles.orderDetails}>
                <div style={styles.itemsSection}>
                  <h4>🛍️ Items Ordered:</h4>
                  <div style={styles.itemsList}>
                    {order.items && order.items.map((item, index) => (
                      <div key={index} style={styles.orderItem}>
                        <span style={styles.itemName}>{item.name}</span>
                        <span style={styles.itemQuantity}>{item.quantity} {item.unit}</span>
                        <span style={styles.itemPrice}>${calculateItemTotal(item)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={styles.paymentSection}>
                  <h4>💳 Payment Information:</h4>
                  <div style={styles.paymentDetails}>
                    {getPaymentBadge(order.paymentMethod, order.creditAmount, order.cashAmount)}
                    <div style={styles.orderTotal}>
                      <strong>Total Amount: ${order.orderTotal?.toFixed(2)}</strong>
                    </div>
                  </div>
                </div>

                {order.orderNotes && (
                  <div style={styles.notesSection}>
                    <h4>📝 Order Notes:</h4>
                    <p style={styles.orderNotes}>{order.orderNotes}</p>
                  </div>
                )}

                <div style={styles.orderTimeline}>
                  <h4>📅 Order Timeline:</h4>
                  <div style={styles.timeline}>
                    <div style={styles.timelineItem}>
                      <span style={styles.timelineDot}></span>
                      <div style={styles.timelineContent}>
                        <strong>Order Placed</strong>
                        <span>{formatDate(order.createdAt)}</span>
                      </div>
                    </div>
                    {order.updatedAt && order.status !== 'pending_approval' && (
                      <div style={styles.timelineItem}>
                        <span style={styles.timelineDot}></span>
                        <div style={styles.timelineContent}>
                          <strong>Last Updated</strong>
                          <span>{formatDate(order.updatedAt)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {order.status === 'pending_approval' && (
                <div style={styles.pendingNotice}>
                  <p>⏰ <strong>Waiting for Approval:</strong> The shop needs to approve your credit request before processing your order.</p>
                </div>
              )}

              {order.status === 'ready' && (
                <div style={styles.readyNotice}>
                  <p>🎉 <strong>Ready for Pickup!</strong> Your order is ready for collection at the shop.</p>
                </div>
              )}

              {order.status === 'completed' && (
                <div style={styles.completedNotice}>
                  <p>✅ <strong>Order Completed!</strong> Thank you for your purchase.</p>
                </div>
              )}
            </div>
          ))}
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
  stats: {
    display: 'flex',
    gap: '1.5rem',
    fontSize: '0.9rem',
    color: '#7f8c8d',
    flexWrap: 'wrap',
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
  refreshButton: {
    backgroundColor: '#3498db',
    color: 'white',
    border: 'none',
    padding: '0.5rem 1rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.9rem',
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
    maxWidth: '400px',
    margin: '0 auto',
  },
  tipsList: {
    textAlign: 'left',
    marginTop: '1rem',
    lineHeight: '1.6',
    paddingLeft: '1.5rem',
  },
  ordersList: {
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
  orderBasicInfo: {
    flex: 1,
  },
  shopName: {
    color: '#3498db',
    fontSize: '1.1rem',
    margin: '0.25rem 0',
  },
  orderDate: {
    color: '#7f8c8d',
    fontSize: '0.9rem',
    margin: 0,
  },
  orderStatus: {
    minWidth: '200px',
  },
  statusSection: {
    textAlign: 'right',
  },
  statusDescription: {
    fontSize: '0.8rem',
    color: '#7f8c8d',
    margin: 0,
    fontStyle: 'italic',
  },
  orderDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  itemsSection: {
    flex: 1,
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
  paymentSection: {
    flex: 1,
  },
  paymentDetails: {
    marginTop: '0.5rem',
  },
  paymentBadge: {
    backgroundColor: '#e8f4fd',
    color: '#3498db',
    padding: '0.75rem',
    borderRadius: '6px',
    display: 'inline-block',
    fontWeight: '600',
    marginBottom: '1rem',
  },
  orderTotal: {
    padding: '1rem',
    backgroundColor: '#2c3e50',
    color: 'white',
    borderRadius: '6px',
    textAlign: 'center',
    fontSize: '1.1rem',
  },
  notesSection: {
    padding: '1rem',
    backgroundColor: '#fff3cd',
    border: '1px solid #ffeaa7',
    borderRadius: '4px',
  },
  orderNotes: {
    margin: '0.5rem 0 0 0',
    fontStyle: 'italic',
    color: '#856404',
  },
  orderTimeline: {
    padding: '1rem',
    backgroundColor: '#f8f9fa',
    borderRadius: '4px',
  },
  timeline: {
    marginTop: '0.5rem',
  },
  timelineItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    marginBottom: '0.5rem',
  },
  timelineDot: {
    width: '12px',
    height: '12px',
    backgroundColor: '#3498db',
    borderRadius: '50%',
    flexShrink: 0,
  },
  timelineContent: {
    display: 'flex',
    flexDirection: 'column',
    fontSize: '0.9rem',
  },
  pendingNotice: {
    padding: '1rem',
    backgroundColor: '#fff3cd',
    border: '1px solid #ffeaa7',
    borderRadius: '4px',
    marginTop: '1rem',
    textAlign: 'center',
  },
  readyNotice: {
    padding: '1rem',
    backgroundColor: '#d1ecf1',
    border: '1px solid #bee5eb',
    borderRadius: '4px',
    marginTop: '1rem',
    textAlign: 'center',
  },
  completedNotice: {
    padding: '1rem',
    backgroundColor: '#d4edda',
    border: '1px solid #c3e6cb',
    borderRadius: '4px',
    marginTop: '1rem',
    textAlign: 'center',
    color: '#155724',
  },
};

export default CustomerOrderHistory;