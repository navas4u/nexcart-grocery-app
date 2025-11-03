// src/components/ShopOwnerDashboard.jsx - ORIGINAL STYLING
import { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import ShopSetup from './ShopSetup';
import InventoryManager from './InventoryManager';
import OrderManagement from './OrderManagement';

const ShopOwnerDashboard = () => {
  const [currentView, setCurrentView] = useState('overview');
  const [shopData, setShopData] = useState(null);
  const [loading, setLoading] = useState(true);
  const auth = getAuth();

  useEffect(() => {
    checkShopSetup();
  }, []);

  const checkShopSetup = async () => {
    try {
      const user = auth.currentUser;
      const shopDoc = await getDoc(doc(db, 'shops', user.uid));
      
      if (shopDoc.exists()) {
        setShopData(shopDoc.data());
        setCurrentView('overview');
      } else {
        setCurrentView('setup');
      }
    } catch (error) {
      console.error('Error checking shop setup:', error);
      setCurrentView('setup');
    } finally {
      setLoading(false);
    }
  };

  const renderView = () => {
  switch (currentView) {
    case 'overview':
      return <DashboardOverview shopData={shopData} shopId={auth.currentUser?.uid} />;
    case 'setup':
      return <ShopSetup onSetupComplete={checkShopSetup} />;
    case 'inventory':
      return <InventoryManager shopId={auth.currentUser.uid} />;
    case 'orders': // ✅ ADD THIS NEW CASE
      return <OrderManagement shopId={auth.currentUser.uid} />;
    case 'customers':
      return <CustomerCreditManager shopId={auth.currentUser.uid} />;
    default:
      return <DashboardOverview shopData={shopData} shopId={auth.currentUser?.uid} />;
  }
};


  if (loading) return <div style={styles.loading}>Loading Dashboard...</div>;

  return (
    <div style={styles.dashboard}>
      {/* Header */}
      <div style={styles.header}>
        <h1>🛒 My Store Dashboard</h1>
        <div style={styles.userInfo}>
          <span>Welcome, {auth.currentUser?.email}</span>
          <button 
            onClick={() => auth.signOut()}
            style={styles.logoutBtn}
          >
            Logout
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav style={styles.nav}>
  <button 
    onClick={() => setCurrentView('overview')}
    style={currentView === 'overview' ? styles.navBtnActive : styles.navBtn}
  >
    📊 Overview
  </button>
  <button 
    onClick={() => setCurrentView('inventory')}
    style={currentView === 'inventory' ? styles.navBtnActive : styles.navBtn}
  >
    📦 Inventory
  </button>
  <button 
    onClick={() => setCurrentView('orders')} // ✅ ADD THIS BUTTON
    style={currentView === 'orders' ? styles.navBtnActive : styles.navBtn}
  >
    📋 Orders
  </button>
  <button 
    onClick={() => setCurrentView('customers')}
    style={currentView === 'customers' ? styles.navBtnActive : styles.navBtn}
  >
    👥 Customer Credits
  </button>
</nav>
      {/* Main Content */}
      <main style={styles.main}>
        {renderView()}
      </main>
    </div>
  );
};

// Dashboard Overview Component
const DashboardOverview = ({ shopData, shopId }) => {
  const [stats, setStats] = useState({
    totalProducts: 0,
    pendingOrders: 0,
    activeCustomers: 0,
    totalRevenue: 0
  });

  useEffect(() => {
    if (shopId) {
      fetchDashboardStats();
    }
  }, [shopId]);

  const fetchDashboardStats = async () => {
    // This would query Firestore for actual stats
    // For now, using placeholder data
  };

  return (
    <div style={styles.overview}>
      <h2>Store Overview</h2>
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <h3>Total Products</h3>
          <p style={styles.statNumber}>{stats.totalProducts}</p>
        </div>
        <div style={styles.statCard}>
          <h3>Pending Orders</h3>
          <p style={styles.statNumber}>{stats.pendingOrders}</p>
        </div>
        <div style={styles.statCard}>
          <h3>Active Customers</h3>
          <p style={styles.statNumber}>{stats.activeCustomers}</p>
        </div>
        <div style={styles.statCard}>
          <h3>Total Revenue</h3>
          <p style={styles.statNumber}>${stats.totalRevenue}</p>
        </div>
      </div>
      
      <div style={styles.storeInfo}>
        <h3>Store Information</h3>
        <p><strong>Name:</strong> {shopData?.shopName || 'Not set'}</p>
        <p><strong>Description:</strong> {shopData?.description || 'Not set'}</p>
        <p><strong>Address:</strong> {shopData?.address || 'Not set'}</p>
        <p><strong>Phone:</strong> {shopData?.phone || 'Not set'}</p>
        <p><strong>Category:</strong> {shopData?.category || 'Not set'}</p>
        <p><strong>Opening Hours:</strong> {shopData?.openingHours || 'Not set'}</p>
      </div>

      <div style={styles.quickActions}>
        <h3>Quick Actions</h3>
        <div style={styles.actionButtons}>
          <button style={styles.actionBtn}>Add Products</button>
          <button style={styles.actionBtn}>View Orders</button>
          <button style={styles.actionBtn}>Manage Customers</button>
        </div>
      </div>
    </div>
  );
};

// Placeholder Components
const CustomerCreditManager = ({ shopId }) => {
  return (
    <div style={styles.comingSoon}>
      <h2>👥 Customer Credit Management</h2>
      <p>This feature is coming soon!</p>
    </div>
  );
};

// ORIGINAL COOL STYLES
const styles = {
  dashboard: {
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#2c3e50',
    color: 'white',
    padding: '1rem 2rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  logoutBtn: {
    backgroundColor: '#e74c3c',
    color: 'white',
    border: 'none',
    padding: '0.5rem 1rem',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  nav: {
    backgroundColor: 'white',
    padding: '1rem 2rem',
    borderBottom: '1px solid #ddd',
    display: 'flex',
    gap: '1rem',
  },
  navBtn: {
    padding: '0.5rem 1rem',
    border: '1px solid #ddd',
    backgroundColor: 'white',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  navBtnActive: {
    padding: '0.5rem 1rem',
    border: '1px solid #3498db',
    backgroundColor: '#3498db',
    color: 'white',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  main: {
    padding: '2rem',
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    fontSize: '1.2rem',
  },
  overview: {
    backgroundColor: 'white',
    padding: '2rem',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1rem',
    marginBottom: '2rem',
  },
  statCard: {
    backgroundColor: '#f8f9fa',
    padding: '1.5rem',
    borderRadius: '8px',
    textAlign: 'center',
    border: '1px solid #e9ecef',
  },
  statNumber: {
    fontSize: '2rem',
    fontWeight: 'bold',
    color: '#2c3e50',
    margin: '0.5rem 0 0 0',
  },
  storeInfo: {
    marginTop: '2rem',
    padding: '1.5rem',
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
  },
  quickActions: {
    marginTop: '2rem',
    padding: '1.5rem',
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
  },
  actionButtons: {
    display: 'flex',
    gap: '1rem',
    marginTop: '1rem',
  },
  actionBtn: {
    backgroundColor: '#3498db',
    color: 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  comingSoon: {
    backgroundColor: 'white',
    padding: '3rem',
    borderRadius: '8px',
    textAlign: 'center',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
};

export default ShopOwnerDashboard;