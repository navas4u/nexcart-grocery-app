// src/components/ShopOwnerDashboard.jsx - MOBILE RESPONSIVE VERSION
import { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import ShopSetup from './ShopSetup';
import InventoryManager from './InventoryManager';
import OrderManagement from './OrderManagement';
import { useLanguage } from '../contexts/LanguageContext'; // IMPORT LANGUAGE CONTEXT


const ShopOwnerDashboard = () => {
  const [currentView, setCurrentView] = useState('overview');
  const [shopData, setShopData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const auth = getAuth();
  const { language, changeLanguage, isMalayalam } = useLanguage(); // USE LANGUAGE CONTEXT 
  
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
      case 'orders':
        return <OrderManagement shopId={auth.currentUser.uid} />;
      case 'customers':
        return <CustomerCreditManager shopId={auth.currentUser.uid} />;
      default:
        return <DashboardOverview shopData={shopData} shopId={auth.currentUser?.uid} />;
    }
  };

  // Mobile menu toggle
  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleViewChange = (view) => {
    setCurrentView(view);
    setIsMobileMenuOpen(false); // Close mobile menu after selection
  };

  if (loading) return <div style={styles.loading}>Loading Dashboard...</div>;

  return (
    <div style={styles.dashboard}>
      {/* header with language support */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <button 
            onClick={toggleMobileMenu}
            style={styles.mobileMenuButton}
          >
            ☰
          </button>
          <h1>🏪 My Store Dashboard</h1>
          <div style={styles.languageSwitch}>
            <button 
              onClick={() => changeLanguage('en')}
              style={!isMalayalam ? styles.langBtnActive : styles.langBtn}
            >
              EN
            </button>
            <button 
              onClick={() => changeLanguage('ml')}
              style={isMalayalam ? styles.langBtnActive : styles.langBtn}
            >
              ML
            </button>
          </div>
        </div>
        <div style={styles.userInfo}>
          <span style={styles.userEmail}>{auth.currentUser?.email}</span>
          <button 
            onClick={() => auth.signOut()}
            style={styles.logoutBtn}
          >
            Logout
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div style={{
        ...styles.mobileNav,
        ...(isMobileMenuOpen && styles.mobileNavOpen)
      }}>
        <button 
          onClick={() => handleViewChange('overview')}
          style={currentView === 'overview' ? styles.mobileNavBtnActive : styles.mobileNavBtn}
        >
          <span style={styles.mobileNavIcon}>📊</span>
          <span style={styles.mobileNavText}>Overview</span>
        </button>
        <button 
          onClick={() => handleViewChange('inventory')}
          style={currentView === 'inventory' ? styles.mobileNavBtnActive : styles.mobileNavBtn}
        >
          <span style={styles.mobileNavIcon}>📦</span>
          <span style={styles.mobileNavText}>Inventory</span>
        </button>
        <button 
          onClick={() => handleViewChange('orders')}
          style={currentView === 'orders' ? styles.mobileNavBtnActive : styles.mobileNavBtn}
        >
          <span style={styles.mobileNavIcon}>📋</span>
          <span style={styles.mobileNavText}>Orders</span>
        </button>
        <button 
          onClick={() => handleViewChange('customers')}
          style={currentView === 'customers' ? styles.mobileNavBtnActive : styles.mobileNavBtn}
        >
          <span style={styles.mobileNavIcon}>👥</span>
          <span style={styles.mobileNavText}>Customers</span>
        </button>
      </div>

      {/* Desktop Navigation */}
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
          onClick={() => setCurrentView('orders')}
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

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          style={styles.overlay}
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </div>
  );
};

// Dashboard Overview Component (Updated for mobile)
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
    setStats({
      totalProducts: 25,
      pendingOrders: 8,
      activeCustomers: 45,
      totalRevenue: 15420.50
    });
  };

  return (
    <div style={styles.overview}>
      <h2>Store Overview</h2>
      
      {/* Stats Grid - Responsive */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statIcon}>📦</div>
          <div style={styles.statNumber}>{stats.totalProducts}</div>
          <div style={styles.statLabel}>Total Products</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statIcon}>⏳</div>
          <div style={styles.statNumber}>{stats.pendingOrders}</div>
          <div style={styles.statLabel}>Pending Orders</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statIcon}>👥</div>
          <div style={styles.statNumber}>{stats.activeCustomers}</div>
          <div style={styles.statLabel}>Active Customers</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statIcon}>💰</div>
          <div style={styles.statNumber}>${stats.totalRevenue.toLocaleString()}</div>
          <div style={styles.statLabel}>Total Revenue</div>
        </div>
      </div>
      
      <div style={styles.storeInfo}>
        <h3>Store Information</h3>
        <div style={styles.infoGrid}>
          <div style={styles.infoItem}>
            <strong>Name:</strong> {shopData?.shopName || 'Not set'}
          </div>
          <div style={styles.infoItem}>
            <strong>Description:</strong> {shopData?.description || 'Not set'}
          </div>
          <div style={styles.infoItem}>
            <strong>Address:</strong> {shopData?.address || 'Not set'}
          </div>
          <div style={styles.infoItem}>
            <strong>Phone:</strong> {shopData?.phone || 'Not set'}
          </div>
          <div style={styles.infoItem}>
            <strong>Category:</strong> {shopData?.category || 'Not set'}
          </div>
          <div style={styles.infoItem}>
            <strong>Opening Hours:</strong> {shopData?.openingHours || 'Not set'}
          </div>
        </div>
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

// MOBILE-RESPONSIVE STYLES
// UPDATED STYLES WITH LANGUAGE SWITCHER
const styles = {
  dashboard: {
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
    paddingBottom: '0',
  },
  header: {
    backgroundColor: '#2c3e50',
    color: 'white',
    padding: '1rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  languageSwitch: {
    display: 'flex',
    backgroundColor: '#ecf0f1',
    borderRadius: '6px',
    overflow: 'hidden',
  },
  langBtn: {
    padding: '0.4rem 0.8rem',
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    fontSize: '0.8rem',
    color: '#2c3e50',
    transition: 'all 0.3s ease',
  },
  langBtnActive: {
    padding: '0.4rem 0.8rem',
    border: 'none',
    backgroundColor: '#3498db',
    color: 'white',
    cursor: 'pointer',
    fontSize: '0.8rem',
  },
  mobileMenuButton: {
    background: 'none',
    border: 'none',
    color: 'white',
    fontSize: '1.5rem',
    cursor: 'pointer',
    padding: '0.5rem',
    display: 'none',
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  userEmail: {
    fontSize: '0.9rem',
    opacity: 0.8,
  },
  logoutBtn: {
    backgroundColor: '#e74c3c',
    color: 'white',
    border: 'none',
    padding: '0.5rem 1rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.9rem',
  },

  // Mobile Navigation
  mobileNav: {
    position: 'fixed',
    top: 0,
    left: '-100%',
    width: '80%',
    maxWidth: '300px',
    height: '100vh',
    backgroundColor: 'white',
    zIndex: 1001,
    transition: 'left 0.3s ease',
    padding: '2rem 1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    boxShadow: '2px 0 10px rgba(0,0,0,0.1)',
  },
  mobileNavOpen: {
    left: 0,
  },
  mobileNavBtn: {
    background: 'none',
    border: 'none',
    padding: '1rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    fontSize: '1rem',
    color: '#7f8c8d',
    borderRadius: '8px',
    transition: 'all 0.3s ease',
  },
  mobileNavBtnActive: {
    background: 'none',
    border: 'none',
    padding: '1rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    fontSize: '1rem',
    color: '#3498db',
    backgroundColor: '#e8f4fd',
    borderRadius: '8px',
    fontWeight: '600',
  },
  mobileNavIcon: {
    fontSize: '1.2rem',
    width: '24px',
    textAlign: 'center',
  },
  mobileNavText: {
    fontSize: '1rem',
  },

  // Desktop Navigation
  nav: {
    backgroundColor: 'white',
    padding: '1rem',
    borderBottom: '1px solid #ddd',
    display: 'flex',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  navBtn: {
    padding: '0.75rem 1.5rem',
    border: '1px solid #ddd',
    backgroundColor: 'white',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '1rem',
  },
  navBtnActive: {
    padding: '0.75rem 1.5rem',
    border: '1px solid #3498db',
    backgroundColor: '#3498db',
    color: 'white',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '1rem',
  },

  // Main Content
  main: {
    padding: '1rem',
    minHeight: 'calc(100vh - 150px)',
  },

  // Overview Styles
  overview: {
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '1rem',
    marginBottom: '2rem',
  },
  statCard: {
    backgroundColor: '#f8f9fa',
    padding: '1.5rem',
    borderRadius: '8px',
    textAlign: 'center',
    border: '1px solid #e9ecef',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.5rem',
  },
  statIcon: {
    fontSize: '2rem',
    marginBottom: '0.5rem',
  },
  statNumber: {
    fontSize: '1.8rem',
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  statLabel: {
    fontSize: '0.9rem',
    color: '#7f8c8d',
    fontWeight: '600',
  },
  storeInfo: {
    marginTop: '2rem',
    padding: '1.5rem',
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '1rem',
    marginTop: '1rem',
  },
  infoItem: {
    padding: '0.75rem',
    backgroundColor: 'white',
    borderRadius: '4px',
    border: '1px solid #e9ecef',
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
    flexWrap: 'wrap',
  },
  actionBtn: {
    backgroundColor: '#3498db',
    color: 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '1rem',
    minHeight: '44px', // Touch target
  },

  // Coming Soon
  comingSoon: {
    backgroundColor: 'white',
    padding: '3rem',
    borderRadius: '8px',
    textAlign: 'center',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },

  // Loading
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    fontSize: '1.2rem',
  },

  // Overlay
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 1000,
  },

  // Media Queries for Desktop
  '@media (max-width: 767px)': {
    mobileMenuButton: {
      display: 'block', // Show on mobile
    },
    nav: {
      display: 'none', // Hide desktop nav on mobile
    },
    statsGrid: {
      gridTemplateColumns: '1fr 1fr', // 2 columns on mobile
      gap: '0.75rem',
    },
    statCard: {
      padding: '1rem',
    },
    statNumber: {
      fontSize: '1.5rem',
    },
    actionButtons: {
      flexDirection: 'column',
    },
    actionBtn: {
      width: '100%',
    },
    infoGrid: {
      gridTemplateColumns: '1fr', // Stack on mobile
    },
  },

  '@media (min-width: 768px)': {
    mobileNav: {
      display: 'none', // Hide mobile nav on desktop
    },
    nav: {
      display: 'flex', // Show desktop nav
    },
  },
};

export default ShopOwnerDashboard;