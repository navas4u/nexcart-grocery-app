// ==============================================
// 🏢 ADMIN DASHBOARD WITH LOGOUT BUTTON
// ==============================================

import React, { useState, useEffect } from 'react';
import { getAuth, signOut } from 'firebase/auth';
import { useAdmin } from '../contexts/AdminContext';
import { getCommissionStats, getAllCommissions } from '../utils/commissionCalculations';

const AdminDashboard = () => {
  const { adminUser } = useAdmin();
  const [commissionStats, setCommissionStats] = useState(null);
  const [recentCommissions, setRecentCommissions] = useState([]);
  const [paymentBreakdown, setPaymentBreakdown] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load commission statistics
      const stats = await getCommissionStats();
      setCommissionStats(stats);
      
      // Load recent commissions
      const commissions = await getAllCommissions(10);
      setRecentCommissions(commissions);
      
      // Load payment breakdown
      await loadPaymentBreakdown();
      
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPaymentBreakdown = async () => {
    try {
      const commissions = await getAllCommissions(100);
      
      const breakdown = commissions.reduce((acc, commission) => {
        const method = commission.paymentMethod || 'unknown';
        acc[method] = (acc[method] || 0) + 1;
        return acc;
      }, {});
      
      setPaymentBreakdown(breakdown);
    } catch (error) {
      console.error('Error loading payment breakdown:', error);
    }
  };

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      console.log('👋 Admin logging out...');
      
      await signOut(getAuth());
      console.log('✅ Admin logged out successfully');
      
      // Redirect to admin login page
      window.location.href = '/admin-login';
      
    } catch (error) {
      console.error('❌ Logout error:', error);
      alert('Logout failed. Please try again.');
      setLoggingOut(false);
    }
  };

  const refreshDashboard = async () => {
    setLoading(true);
    await loadDashboardData();
  };

  if (loading) {
    return (
      <div style={styles.loading}>
        <div style={styles.loadingSpinner}></div>
        <h3>Loading Dashboard...</h3>
        <p>Please wait while we load platform data...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* ============================================== */}
      {/* 🏢 DASHBOARD HEADER WITH LOGOUT */}
      {/* ============================================== */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <h1>👑 Nexcart Admin Dashboard</h1>
          <p style={styles.welcomeText}>
            Welcome, <strong>{adminUser?.name || adminUser?.email}</strong>
          </p>
        </div>
        
        <div style={styles.headerRight}>
          <button 
            onClick={refreshDashboard}
            disabled={loading}
            style={styles.refreshButton}
            title="Refresh Dashboard Data"
          >
            🔄 Refresh
          </button>
          
          <button 
            onClick={handleLogout}
            disabled={loggingOut}
            style={loggingOut ? styles.logoutButtonDisabled : styles.logoutButton}
          >
            {loggingOut ? (
              <>
                <div style={styles.loadingSpinnerSmall}></div>
                Logging Out...
              </>
            ) : (
              <>
                🚪 Logout
              </>
            )}
          </button>
        </div>
      </div>

      {/* ============================================== */}
      {/* 💰 COMMISSION METRICS */}
      {/* ============================================== */}
      <div style={styles.metricsGrid}>
        <div style={styles.metricCard}>
          <div style={styles.metricIcon}>💰</div>
          <h3>₹{(commissionStats?.platformRevenue || 0).toLocaleString()}</h3>
          <p>Total Platform Revenue</p>
        </div>
        
        <div style={styles.metricCard}>
          <div style={styles.metricIcon}>📦</div>
          <h3>{commissionStats?.totalProcessedSales || 0}</h3>
          <p>Processed Sales</p>
        </div>
        
        <div style={styles.metricCard}>
          <div style={styles.metricIcon}>📈</div>
          <h3>{((commissionStats?.defaultCommissionRate || 0) * 100)}%</h3>
          <p>Commission Rate</p>
        </div>
        
        <div style={styles.metricCard}>
          <div style={styles.metricIcon}>🔄</div>
          <h3>{recentCommissions.length}</h3>
          <p>Recent Commissions</p>
        </div>
      </div>

      {/* ============================================== */}
      {/* 📊 RECENT COMMISSIONS */}
      {/* ============================================== */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <h2>Recent Commissions</h2>
          <span style={styles.badge}>{recentCommissions.length} records</span>
        </div>
        
        {recentCommissions.length > 0 ? (
          <div style={styles.commissionsList}>
            {recentCommissions.map(commission => (
              <div key={commission.id} style={styles.commissionItem}>
                <div style={styles.commissionHeader}>
                  <div style={styles.commissionShop}>
                    <span style={styles.shopName}>{commission.shopName}</span>
                    <span style={styles.customerName}> - {commission.customerName}</span>
                  </div>
                  <span style={styles.commissionAmount}>
                    ₹{commission.commissionAmount?.toFixed(2)}
                  </span>
                </div>
                <div style={styles.commissionDetails}>
                  <span>Order: {commission.orderId?.slice(-8)}</span>
                  <span>Sale: ₹{commission.saleAmount?.toFixed(2)}</span>
                  <span style={getStatusStyle(commission.status)}>
                    {commission.status}
                  </span>
                  <span style={styles.paymentMethod}>
                    {commission.paymentMethod?.toUpperCase()}
                  </span>
                </div>
                {commission.saleDate && (
                  <div style={styles.commissionDate}>
                    {new Date(commission.saleDate?.toDate()).toLocaleString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>💸</div>
            <p>No commissions recorded yet.</p>
            <p style={styles.emptySubtext}>
              Commissions will appear here when shops process sales.
            </p>
          </div>
        )}
      </div>

      {/* ============================================== */}
      {/* 💳 PAYMENT METHOD BREAKDOWN */}
      {/* ============================================== */}
      {paymentBreakdown && Object.keys(paymentBreakdown).length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2>Payment Method Breakdown</h2>
            <span style={styles.badge}>
              {Object.values(paymentBreakdown).reduce((a, b) => a + b, 0)} total sales
            </span>
          </div>
          
          <div style={styles.paymentGrid}>
            {Object.entries(paymentBreakdown).map(([method, count]) => (
              <div key={method} style={styles.paymentItem}>
                <span style={styles.paymentMethod}>{method.toUpperCase()}</span>
                <span style={styles.paymentCount}>{count} sales</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================== */}
      {/* ⚙️ PLATFORM INFORMATION */}
      {/* ============================================== */}
      <div style={styles.section}>
        <h2>Platform Information</h2>
        <div style={styles.infoGrid}>
          <div style={styles.infoItem}>
            <strong>Default Commission Rate:</strong> {(commissionStats?.defaultCommissionRate * 100) || 5}%
          </div>
          <div style={styles.infoItem}>
            <strong>Commission Due Days:</strong> {commissionStats?.commissionDueDays || 30} days
          </div>
          <div style={styles.infoItem}>
            <strong>Minimum Rate:</strong> {(commissionStats?.minCommissionRate * 100) || 2}%
          </div>
          <div style={styles.infoItem}>
            <strong>Maximum Rate:</strong> {(commissionStats?.maxCommissionRate * 100) || 10}%
          </div>
          <div style={styles.infoItem}>
            <strong>Last Updated:</strong> {commissionStats?.updatedAt ? new Date(commissionStats.updatedAt.toDate()).toLocaleString() : 'Never'}
          </div>
          <div style={styles.infoItem}>
            <strong>Admin Email:</strong> {adminUser?.email}
          </div>
        </div>
      </div>

      {/* ============================================== */}
      {/* 🚀 QUICK ACTIONS */}
      {/* ============================================== */}
      <div style={styles.section}>
        <h2>Quick Actions</h2>
        <div style={styles.actionsGrid}>
          <button 
            onClick={() => window.location.href = '/admin/commissions'}
            style={styles.actionButton}
          >
            📊 Commission Management
          </button>
          <button style={styles.actionButton}>
            ⚙️ Platform Settings
          </button>
          <button style={styles.actionButton}>
            👥 Shop Management
          </button>
          <button style={styles.actionButton}>
            📧 Export Data
          </button>
        </div>
      </div>
    </div>
  );
};

// ==============================================
// 🎨 ENHANCED STYLES
// ==============================================

const styles = {
  container: {
    padding: '20px',
    fontFamily: 'Arial, sans-serif',
    backgroundColor: '#f8f9fa',
    minHeight: '100vh'
  },
  
  // Header Styles
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '30px',
    paddingBottom: '20px',
    borderBottom: '2px solid #e0e0e0',
    flexWrap: 'wrap',
    gap: '20px'
  },
  headerLeft: {
    flex: 1
  },
  headerRight: {
    display: 'flex',
    gap: '15px',
    alignItems: 'center'
  },
  welcomeText: {
    color: '#7f8c8d',
    margin: '5px 0 0 0',
    fontSize: '16px'
  },
  
  // Button Styles
  refreshButton: {
    background: '#3498db',
    color: 'white',
    border: 'none',
    padding: '10px 16px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.3s ease'
  },
  logoutButton: {
    background: '#e74c3c',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.3s ease'
  },
  logoutButtonDisabled: {
    background: '#bdc3c7',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '6px',
    cursor: 'not-allowed',
    fontSize: '14px',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  
  // Metrics Grid
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '20px',
    marginBottom: '30px'
  },
  metricCard: {
    background: 'white',
    padding: '25px',
    borderRadius: '12px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    textAlign: 'center',
    transition: 'transform 0.2s ease',
    border: '1px solid #e0e0e0'
  },
  metricIcon: {
    fontSize: '32px',
    marginBottom: '15px',
    display: 'block'
  },
  
  // Section Styles
  section: {
    background: 'white',
    padding: '25px',
    borderRadius: '12px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    marginBottom: '20px',
    border: '1px solid #e0e0e0'
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    flexWrap: 'wrap',
    gap: '10px'
  },
  badge: {
    background: '#3498db',
    color: 'white',
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '600'
  },
  
  // Commissions List
  commissionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  commissionItem: {
    padding: '18px',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    transition: 'all 0.3s ease',
    backgroundColor: '#f8f9fa'
  },
  commissionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
    flexWrap: 'wrap',
    gap: '10px'
  },
  commissionShop: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap'
  },
  shopName: {
    fontWeight: 'bold',
    color: '#2c3e50'
  },
  customerName: {
    color: '#7f8c8d',
    fontSize: '14px'
  },
  commissionAmount: {
    fontWeight: 'bold',
    color: '#27ae60',
    fontSize: '18px'
  },
  commissionDetails: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '14px',
    color: '#7f8c8d',
    flexWrap: 'wrap',
    gap: '15px'
  },
  paymentMethod: {
    background: '#e3f2fd',
    color: '#1976d2',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '600'
  },
  commissionDate: {
    fontSize: '12px',
    color: '#95a5a6',
    marginTop: '8px',
    fontStyle: 'italic'
  },
  
  // Payment Breakdown
  paymentGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '15px'
  },
  paymentItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '15px',
    background: '#f8f9fa',
    borderRadius: '8px',
    border: '1px solid #e0e0e0'
  },
  paymentMethod: {
    fontWeight: 'bold',
    color: '#2c3e50'
  },
  paymentCount: {
    color: '#7f8c8d',
    fontWeight: '600'
  },
  
  // Info Grid
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '15px'
  },
  infoItem: {
    padding: '15px',
    background: '#f8f9fa',
    borderRadius: '6px',
    borderLeft: '4px solid #3498db'
  },
  
  // Actions Grid
  actionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '15px'
  },
  actionButton: {
    background: '#3498db',
    color: 'white',
    border: 'none',
    padding: '15px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    transition: 'all 0.3s ease'
  },
  
  // Loading States
  loading: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '50vh',
    textAlign: 'center'
  },
  loadingSpinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #f3f3f3',
    borderTop: '4px solid #3498db',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: '20px'
  },
  loadingSpinnerSmall: {
    width: '16px',
    height: '16px',
    border: '2px solid transparent',
    borderTop: '2px solid white',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  
  // Empty States
  emptyState: {
    textAlign: 'center',
    padding: '40px 20px',
    color: '#7f8c8d'
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '15px'
  },
  emptySubtext: {
    fontSize: '14px',
    marginTop: '5px'
  }
};

// Status style helper
const getStatusStyle = (status) => {
  const baseStyle = {
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 'bold'
  };
  
  switch (status) {
    case 'pending':
      return { ...baseStyle, background: '#fff3cd', color: '#856404' };
    case 'paid':
      return { ...baseStyle, background: '#d1edff', color: '#0c5460' };
    case 'overdue':
      return { ...baseStyle, background: '#f8d7da', color: '#721c24' };
    case 'disputed':
      return { ...baseStyle, background: '#ffeaa7', color: '#e17055' };
    default:
      return baseStyle;
  }
};

// Add CSS animation
const spinnerStyle = document.createElement('style');
spinnerStyle.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(spinnerStyle);

export default AdminDashboard;