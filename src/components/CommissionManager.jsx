// ==============================================
// 💰 COMMISSION MANAGER COMPONENT WITH NAVIGATION
// ==============================================

import React, { useState, useEffect } from 'react';
import { getAuth, signOut } from 'firebase/auth';
import { getCommissionStats, getAllCommissions } from '../utils/commissionCalculations';
import { db } from '../firebase';
import { doc, updateDoc, collection, query, where, getDocs, getDoc, increment } from 'firebase/firestore';
import { useAdmin } from '../contexts/AdminContext';

const CommissionManager = () => {
  const { adminUser } = useAdmin();
  const [commissions, setCommissions] = useState([]);
  const [filteredCommissions, setFilteredCommissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [shopFilter, setShopFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  useEffect(() => {
    loadCommissions();
  }, []);

  useEffect(() => {
    filterCommissions();
  }, [commissions, statusFilter, dateFilter, shopFilter, searchTerm]);

  // 🆕 ADD NAVIGATION FUNCTIONS
  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      console.log('👋 Admin logging out from Commission Manager...');
      
      await signOut(getAuth());
      console.log('✅ Admin logged out successfully');
      
      window.location.href = '/admin-login';
    } catch (error) {
      console.error('❌ Logout error:', error);
      alert('Logout failed. Please try again.');
      setLoggingOut(false);
    }
  };

  const navigateToDashboard = () => {
  window.location.href = '/admin';  // Changed to /admin (not /admin/dashboard)
};

const navigateToShops = () => {
  alert('Shop Management page is coming soon!');
  // window.location.href = '/admin/shops'; // When you create this page
};

const navigateToSettings = () => {
  alert('Platform Settings page is coming soon!');
  // window.location.href = '/admin/settings'; // When you create this page
};

  const loadCommissions = async () => {
    try {
      setLoading(true);
      const commissionStats = await getCommissionStats();
      setStats(commissionStats);
      
      const allCommissions = await getAllCommissions(1000);
      setCommissions(allCommissions);
    } catch (error) {
      console.error('Error loading commissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterCommissions = () => {
    let filtered = [...commissions];

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(commission => commission.status === statusFilter);
    }

    // Date filter (simplified - you can enhance this)
    if (dateFilter !== 'all') {
      const now = new Date();
      if (dateFilter === 'today') {
        filtered = filtered.filter(commission => {
          const commissionDate = commission.saleDate?.toDate();
          return commissionDate && commissionDate.toDateString() === now.toDateString();
        });
      } else if (dateFilter === 'week') {
        const weekAgo = new Date(now.setDate(now.getDate() - 7));
        filtered = filtered.filter(commission => {
          const commissionDate = commission.saleDate?.toDate();
          return commissionDate && commissionDate >= weekAgo;
        });
      } else if (dateFilter === 'month') {
        const monthAgo = new Date(now.setMonth(now.getMonth() - 1));
        filtered = filtered.filter(commission => {
          const commissionDate = commission.saleDate?.toDate();
          return commissionDate && commissionDate >= monthAgo;
        });
      }
    }

    // Shop filter
    if (shopFilter !== 'all') {
      filtered = filtered.filter(commission => commission.shopId === shopFilter);
    }

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(commission => 
        commission.shopName?.toLowerCase().includes(term) ||
        commission.customerName?.toLowerCase().includes(term) ||
        commission.orderId?.toLowerCase().includes(term)
      );
    }

    setFilteredCommissions(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  };

  const updateCommissionStatus = async (commissionId, newStatus) => {
    try {
      console.log(`🔄 Updating commission ${commissionId} to status: ${newStatus}`);
      
      const commissionRef = doc(db, 'platform_commissions', commissionId);
      
      // 🆕 FIRST: Get the current commission data
      const commissionDoc = await getDoc(commissionRef);
      
      if (!commissionDoc.exists()) {
        alert('❌ Commission not found');
        return;
      }

      const commissionData = commissionDoc.data();
      const oldStatus = commissionData.status;
      const commissionAmount = commissionData.commissionAmount || 0;

      console.log(`📊 Commission details:`, {
        oldStatus,
        newStatus,
        amount: commissionAmount
      });

      // 🆕 UPDATE COMMISSION STATUS
      await updateDoc(commissionRef, {
        status: newStatus,
        updatedAt: new Date()
      });

      // 🆕 UPDATE PLATFORM REVENUE BASED ON STATUS CHANGE
      if ((oldStatus !== 'paid' && newStatus === 'paid') || 
          (oldStatus === 'paid' && newStatus !== 'paid')) {
        
        await updatePlatformRevenue(commissionAmount, oldStatus, newStatus);
      }

      // 🆕 UPDATE LOCAL STATE
      setCommissions(prev => prev.map(commission => 
        commission.id === commissionId 
          ? { ...commission, status: newStatus }
          : commission
      ));

      console.log(`✅ Commission ${commissionId} status updated to: ${newStatus}`);
      
      // 🆕 RELOAD COMMISSIONS TO REFRESH DATA
      setTimeout(() => {
        loadCommissions();
      }, 1000);
      
    } catch (error) {
      console.error('❌ Error updating commission status:', error);
      console.error('Error details:', error.message);
      alert(`❌ Error updating commission status: ${error.message}`);
    }
  };

  const updatePlatformRevenue = async (commissionAmount, oldStatus, newStatus) => {
    try {
      const settingsRef = doc(db, 'platform_settings', 'commission_config');
      
      console.log(`💰 Revenue update: ${oldStatus} → ${newStatus}, Amount: ₹${commissionAmount}`);
      
      if (oldStatus !== 'paid' && newStatus === 'paid') {
        // Adding to revenue (marking as paid)
        await updateDoc(settingsRef, {
          platformRevenue: increment(commissionAmount),
          updatedAt: new Date()
        });
        console.log(`💰 Added ₹${commissionAmount} to platform revenue`);
      } else if (oldStatus === 'paid' && newStatus !== 'paid') {
        // Removing from revenue (un-marking as paid)
        await updateDoc(settingsRef, {
          platformRevenue: increment(-commissionAmount),
          updatedAt: new Date()
        });
        console.log(`💰 Removed ₹${commissionAmount} from platform revenue`);
      }
    } catch (error) {
      console.error('❌ Error updating platform revenue:', error);
      throw error;
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Shop Name', 'Customer', 'Order ID', 'Sale Amount', 'Commission', 'Status', 'Date'];
    const csvData = filteredCommissions.map(commission => [
      commission.shopName || 'Unknown',
      commission.customerName || 'Unknown',
      commission.orderId?.slice(-8) || 'N/A',
      `₹${commission.saleAmount?.toFixed(2)}`,
      `₹${commission.commissionAmount?.toFixed(2)}`,
      commission.status,
      commission.saleDate ? new Date(commission.saleDate.toDate()).toLocaleDateString() : 'N/A'
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `commissions_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  // Calculate pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentCommissions = filteredCommissions.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredCommissions.length / itemsPerPage);

  // Get unique shops for filter
  const uniqueShops = [...new Set(commissions.map(commission => commission.shopId))];
  const shopNames = {};
  commissions.forEach(commission => {
    if (commission.shopName) {
      shopNames[commission.shopId] = commission.shopName;
    }
  });

  if (loading) {
    return (
      <div style={styles.loading}>
        <div style={styles.loadingSpinner}></div>
        <h3>Loading Commission Data...</h3>
        <p>Please wait while we load commission records...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* ============================================== */}
      {/* 🆕 NAVIGATION HEADER */}
      {/* ============================================== */}
      <div style={styles.navHeader}>
        <div style={styles.navLeft}>
          <h1 style={styles.navTitle}>👑 Nexcart Admin</h1>
          <div style={styles.navLinks}>
            <button 
              onClick={navigateToDashboard}
              style={styles.navButton}
            >
              📊 Dashboard
            </button>
            <button 
              style={styles.navButtonActive}
            >
              💰 Commissions
            </button>
            <button 
              onClick={navigateToShops}
              style={styles.navButton}
            >
              🏪 Shops
            </button>
            <button 
              onClick={navigateToSettings}
              style={styles.navButton}
            >
              ⚙️ Settings
            </button>
          </div>
        </div>
        
        <div style={styles.navRight}>
          <span style={styles.adminWelcome}>
            Welcome, <strong>{adminUser?.name || adminUser?.email}</strong>
          </span>
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
              '🚪 Logout'
            )}
          </button>
        </div>
      </div>

      {/* ============================================== */}
      {/* 🎯 MAIN CONTENT AREA */}
      {/* ============================================== */}
      <div style={styles.content}>
        {/* HEADER WITH STATS */}
        <div style={styles.header}>
          <div>
            <h1>💰 Commission Management</h1>
            <p>Manage and track all platform commissions</p>
          </div>
          <div style={styles.headerStats}>
            <div style={styles.statItem}>
              <span style={styles.statNumber}>{commissions.length}</span>
              <span style={styles.statLabel}>Total Commissions</span>
            </div>
            <div style={styles.statItem}>
              <span style={styles.statNumber}>
                {commissions.filter(c => c.status === 'pending').length}
              </span>
              <span style={styles.statLabel}>Pending</span>
            </div>
            <div style={styles.statItem}>
              <span style={styles.statNumber}>
                ₹{(stats?.platformRevenue || 0).toLocaleString()}
              </span>
              <span style={styles.statLabel}>Total Revenue</span>
            </div>
          </div>
        </div>

        {/* 🔍 FILTERS & CONTROLS */}
        <div style={styles.controls}>
          <div style={styles.filters}>
            {/* Status Filter */}
            <div style={styles.filterGroup}>
              <label>Status:</label>
              <select 
                value={statusFilter} 
                onChange={(e) => setStatusFilter(e.target.value)}
                style={styles.select}
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
                <option value="disputed">Disputed</option>
              </select>
            </div>

            {/* Date Filter */}
            <div style={styles.filterGroup}>
              <label>Date Range:</label>
              <select 
                value={dateFilter} 
                onChange={(e) => setDateFilter(e.target.value)}
                style={styles.select}
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
              </select>
            </div>

            {/* Shop Filter */}
            <div style={styles.filterGroup}>
              <label>Shop:</label>
              <select 
                value={shopFilter} 
                onChange={(e) => setShopFilter(e.target.value)}
                style={styles.select}
              >
                <option value="all">All Shops</option>
                {uniqueShops.map(shopId => (
                  <option key={shopId} value={shopId}>
                    {shopNames[shopId] || `Shop ${shopId.slice(-8)}`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={styles.searchExport}>
            {/* Search */}
            <div style={styles.searchGroup}>
              <input
                type="text"
                placeholder="Search shops, customers, orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={styles.searchInput}
              />
            </div>

            {/* Export Button */}
            <button 
              onClick={exportToCSV}
              disabled={filteredCommissions.length === 0}
              style={filteredCommissions.length > 0 ? styles.exportButton : styles.exportButtonDisabled}
            >
              📊 Export CSV
            </button>

            {/* Refresh Button */}
            <button 
              onClick={loadCommissions}
              style={styles.refreshButton}
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* 📊 COMMISSIONS TABLE */}
        <div style={styles.tableContainer}>
          {filteredCommissions.length > 0 ? (
            <>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Shop</th>
                    <th style={styles.th}>Customer</th>
                    <th style={styles.th}>Order ID</th>
                    <th style={styles.th}>Sale Amount</th>
                    <th style={styles.th}>Commission</th>
                    <th style={styles.th}>Rate</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Date</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentCommissions.map(commission => (
                    <tr key={commission.id} style={styles.tr}>
                      <td style={styles.td}>
                        <div style={styles.shopCell}>
                          <strong>{commission.shopName || 'Unknown Shop'}</strong>
                          <small style={styles.shopId}>{commission.shopId?.slice(-8)}</small>
                        </div>
                      </td>
                      <td style={styles.td}>{commission.customerName || 'Unknown Customer'}</td>
                      <td style={styles.td}>
                        <code style={styles.orderId}>{commission.orderId?.slice(-8)}</code>
                      </td>
                      <td style={styles.td}>₹{commission.saleAmount?.toFixed(2)}</td>
                      <td style={styles.td}>
                        <strong style={styles.commissionAmount}>
                          ₹{commission.commissionAmount?.toFixed(2)}
                        </strong>
                      </td>
                      <td style={styles.td}>{(commission.commissionRate * 100).toFixed(1)}%</td>
                      <td style={styles.td}>
                        <span style={getStatusBadgeStyle(commission.status)}>
                          {commission.status}
                        </span>
                      </td>
                      <td style={styles.td}>
                        {commission.saleDate ? 
                          new Date(commission.saleDate.toDate()).toLocaleDateString() : 
                          'N/A'
                        }
                      </td>
                      <td style={styles.td}>
                        <div style={styles.actionButtons}>
                          {commission.status === 'pending' && (
                            <button
                              onClick={() => updateCommissionStatus(commission.id, 'paid')}
                              style={styles.markPaidButton}
                              title="Mark as Paid"
                            >
                              ✅ Paid
                            </button>
                          )}
                          {commission.status === 'paid' && (
                            <button
                              onClick={() => updateCommissionStatus(commission.id, 'pending')}
                              style={styles.markPendingButton}
                              title="Mark as Pending"
                            >
                              ⏳ Pending
                            </button>
                          )}
                          <button
                            onClick={() => updateCommissionStatus(commission.id, 'disputed')}
                            style={styles.disputeButton}
                            title="Mark as Disputed"
                          >
                              ⚠️ Dispute
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* 📄 PAGINATION */}
              {totalPages > 1 && (
                <div style={styles.pagination}>
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    style={currentPage === 1 ? styles.pageButtonDisabled : styles.pageButton}
                  >
                    ← Previous
                  </button>
                  
                  <span style={styles.pageInfo}>
                    Page {currentPage} of {totalPages} 
                    ({filteredCommissions.length} commissions)
                  </span>
                  
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    style={currentPage === totalPages ? styles.pageButtonDisabled : styles.pageButton}
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          ) : (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>💸</div>
              <h3>No Commissions Found</h3>
              <p>No commission records match your current filters.</p>
              <button 
                onClick={() => {
                  setStatusFilter('all');
                  setDateFilter('all');
                  setShopFilter('all');
                  setSearchTerm('');
                }}
                style={styles.clearFiltersButton}
              >
                Clear All Filters
              </button>
            </div>
          )}
        </div>

        {/* 📈 SUMMARY STATS */}
        {filteredCommissions.length > 0 && (
          <div style={styles.summary}>
            <h3>Summary</h3>
            <div style={styles.summaryGrid}>
              <div style={styles.summaryItem}>
                <span>Total Filtered:</span>
                <strong>{filteredCommissions.length} commissions</strong>
              </div>
              <div style={styles.summaryItem}>
                <span>Total Commission:</span>
                <strong>
                  ₹{filteredCommissions.reduce((sum, c) => sum + (c.commissionAmount || 0), 0).toFixed(2)}
                </strong>
              </div>
              <div style={styles.summaryItem}>
                <span>Total Sales:</span>
                <strong>
                  ₹{filteredCommissions.reduce((sum, c) => sum + (c.saleAmount || 0), 0).toFixed(2)}
                </strong>
              </div>
              <div style={styles.summaryItem}>
                <span>Average Commission:</span>
                <strong>
                  ₹{(filteredCommissions.reduce((sum, c) => sum + (c.commissionAmount || 0), 0) / filteredCommissions.length).toFixed(2)}
                </strong>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ==============================================
// 🎨 STYLES
// ==============================================

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f8f9fa',
    fontFamily: 'Arial, sans-serif'
  },
  
  // 🆕 NAVIGATION HEADER STYLES
  navHeader: {
    background: 'white',
    padding: '15px 20px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '3px solid #3498db',
    flexWrap: 'wrap',
    gap: '15px'
  },
  navLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '30px',
    flexWrap: 'wrap'
  },
  navTitle: {
    margin: 0,
    color: '#2c3e50',
    fontSize: '24px',
    fontWeight: 'bold'
  },
  navLinks: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap'
  },
  navButton: {
    background: 'transparent',
    border: '2px solid #3498db',
    color: '#3498db',
    padding: '8px 16px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: '500',
    transition: 'all 0.3s ease'
  },
  navButtonActive: {
    background: '#3498db',
    border: '2px solid #3498db',
    color: 'white',
    padding: '8px 16px',
    borderRadius: '6px',
    fontWeight: '500',
    cursor: 'default'
  },
  navRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    flexWrap: 'wrap'
  },
  adminWelcome: {
    color: '#7f8c8d',
    fontSize: '14px'
  },
  logoutButton: {
    background: '#e74c3c',
    color: 'white',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '6px',
    cursor: 'pointer',
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
    padding: '8px 16px',
    borderRadius: '6px',
    cursor: 'not-allowed',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  
  // 🆕 CONTENT WRAPPER
  content: {
    padding: '20px'
  },
  
  // EXISTING STYLES
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '30px',
    flexWrap: 'wrap',
    gap: '20px'
  },
  headerStats: {
    display: 'flex',
    gap: '20px',
    flexWrap: 'wrap'
  },
  statItem: {
    textAlign: 'center',
    background: 'white',
    padding: '15px 20px',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    minWidth: '120px'
  },
  statNumber: {
    display: 'block',
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#2c3e50'
  },
  statLabel: {
    fontSize: '14px',
    color: '#7f8c8d',
    marginTop: '5px'
  },
  controls: {
    background: 'white',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    marginBottom: '20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    gap: '20px'
  },
  filters: {
    display: 'flex',
    gap: '15px',
    flexWrap: 'wrap'
  },
  filterGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px'
  },
  select: {
    padding: '8px 12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    minWidth: '150px'
  },
  searchExport: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    flexWrap: 'wrap'
  },
  searchGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px'
  },
  searchInput: {
    padding: '8px 12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    minWidth: '250px'
  },
  exportButton: {
    background: '#27ae60',
    color: 'white',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: '500'
  },
  exportButtonDisabled: {
    background: '#bdc3c7',
    color: 'white',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '4px',
    cursor: 'not-allowed',
    fontWeight: '500'
  },
  refreshButton: {
    background: '#3498db',
    color: 'white',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: '500'
  },
  tableContainer: {
    background: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    overflow: 'hidden',
    marginBottom: '20px'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse'
  },
  th: {
    background: '#34495e',
    color: 'white',
    padding: '12px 15px',
    textAlign: 'left',
    fontWeight: '600',
    fontSize: '14px'
  },
  tr: {
    borderBottom: '1px solid #ecf0f1'
  },
  td: {
    padding: '12px 15px',
    fontSize: '14px'
  },
  shopCell: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px'
  },
  shopId: {
    fontSize: '11px',
    color: '#7f8c8d',
    fontFamily: 'monospace'
  },
  orderId: {
    background: '#f8f9fa',
    padding: '2px 6px',
    borderRadius: '3px',
    fontFamily: 'monospace',
    fontSize: '12px'
  },
  commissionAmount: {
    color: '#27ae60',
    fontWeight: '600'
  },
  actionButtons: {
    display: 'flex',
    gap: '5px',
    flexWrap: 'wrap'
  },
  markPaidButton: {
    background: '#27ae60',
    color: 'white',
    border: 'none',
    padding: '4px 8px',
    borderRadius: '3px',
    cursor: 'pointer',
    fontSize: '12px'
  },
  markPendingButton: {
    background: '#f39c12',
    color: 'white',
    border: 'none',
    padding: '4px 8px',
    borderRadius: '3px',
    cursor: 'pointer',
    fontSize: '12px'
  },
  disputeButton: {
    background: '#e74c3c',
    color: 'white',
    border: 'none',
    padding: '4px 8px',
    borderRadius: '3px',
    cursor: 'pointer',
    fontSize: '12px'
  },
  pagination: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '15px 20px',
    background: '#f8f9fa',
    borderTop: '1px solid #e0e0e0'
  },
  pageButton: {
    background: '#3498db',
    color: 'white',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  pageButtonDisabled: {
    background: '#bdc3c7',
    color: 'white',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '4px',
    cursor: 'not-allowed'
  },
  pageInfo: {
    color: '#7f8c8d',
    fontSize: '14px'
  },
  summary: {
    background: 'white',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '15px',
    marginTop: '15px'
  },
  summaryItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 15px',
    background: '#f8f9fa',
    borderRadius: '6px'
  },
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
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px'
  },
  emptyIcon: {
    fontSize: '64px',
    marginBottom: '20px',
    opacity: 0.5
  },
  clearFiltersButton: {
    background: '#3498db',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '6px',
    cursor: 'pointer',
    marginTop: '15px'
  }
};

// Status badge styles
const getStatusBadgeStyle = (status) => {
  const baseStyle = {
    padding: '4px 8px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '600',
    textTransform: 'capitalize'
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
      return { ...baseStyle, background: '#f8f9fa', color: '#6c757d' };
  }
};

export default CommissionManager;