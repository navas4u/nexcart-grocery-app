// src/components/ShopOwnerDashboard.jsx - COMPLETE READY-TO-USE VERSION
import { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDoc, collection, getDocs, query, where, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import ShopSetup from './ShopSetup';
import InventoryManager from './InventoryManager';
import OrderManagement from './OrderManagement';
import CustomerCreditManager from './CustomerCreditManager';
import { useLanguage } from '../contexts/LanguageContext';
import ReturnPolicyManager from './ReturnPolicyManager';
import QuickCreditSales from './QuickCreditSales'; // New component for quick sales

// ============================================================================
// DELIVERY SETTINGS COMPONENT - Manages delivery and pickup configurations
// ============================================================================
const DeliverySettings = ({ shopId }) => {
  const [settings, setSettings] = useState({
    offersDelivery: false,
    deliveryFee: 0,
    freeDeliveryThreshold: 0,
    estimatedDeliveryTime: "30-45 minutes",
    allowsPickup: true,
    pickupInstructions: "Please come to the counter for pickup"
  });
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Load existing delivery settings when shopId changes
  useEffect(() => {
    if (shopId) {
      loadExistingSettings();
    }
  }, [shopId]);

  // Fetch current delivery settings from Firestore
  const loadExistingSettings = async () => {
    try {
      const shopDoc = await getDoc(doc(db, 'shops', shopId));
      if (shopDoc.exists()) {
        const shopData = shopDoc.data();
        
        setSettings({
          offersDelivery: shopData.deliverySettings?.offersDelivery || false,
          deliveryFee: shopData.deliverySettings?.deliveryFee || 0,
          freeDeliveryThreshold: shopData.deliverySettings?.freeDeliveryThreshold || 0,
          estimatedDeliveryTime: shopData.deliverySettings?.estimatedDeliveryTime || "30-45 minutes",
          allowsPickup: shopData.pickupSettings?.allowsPickup !== false,
          pickupInstructions: shopData.pickupSettings?.pickupInstructions || "Please come to the counter for pickup"
        });
      }
      setInitialized(true);
    } catch (error) {
      console.error('Error loading delivery settings:', error);
      setInitialized(true);
    }
  };

  // Save delivery settings to Firestore
  const saveSettings = async () => {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'shops', shopId), {
        deliverySettings: {
          offersDelivery: settings.offersDelivery,
          deliveryFee: Number(settings.deliveryFee),
          freeDeliveryThreshold: Number(settings.freeDeliveryThreshold),
          estimatedDeliveryTime: settings.estimatedDeliveryTime
        },
        pickupSettings: {
          allowsPickup: settings.allowsPickup,
          pickupInstructions: settings.pickupInstructions
        }
      });
      alert('✅ Delivery settings saved!');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('❌ Error saving settings');
    } finally {
      setLoading(false);
    }
  };

  if (!initialized) {
    return <div style={styles.loading}>Loading delivery settings...</div>;
  }

  return (
    <div style={styles.settingsContainer}>
      <h3>🚚 Delivery & Pickup Settings</h3>
      
      {/* Delivery Service Toggle Section */}
      <div style={styles.section}>
        <label style={styles.toggleLabel}>
          <input
            type="checkbox"
            checked={settings.offersDelivery}
            onChange={(e) => setSettings({...settings, offersDelivery: e.target.checked})}
          />
          Offer Delivery Service
        </label>

        {settings.offersDelivery && (
          <div style={styles.deliveryDetails}>
            <div style={styles.inputGroup}>
              <label>Delivery Fee (₹)</label>
              <input
                type="number"
                value={settings.deliveryFee}
                onChange={(e) => setSettings({...settings, deliveryFee: e.target.value})}
                style={styles.input}
                min="0"
                step="5"
              />
            </div>
            
            <div style={styles.inputGroup}>
              <label>Free Delivery Above (₹) - Optional</label>
              <input
                type="number"
                value={settings.freeDeliveryThreshold}
                onChange={(e) => setSettings({...settings, freeDeliveryThreshold: e.target.value})}
                style={styles.input}
                min="0"
                step="50"
                placeholder="0 for no free delivery"
              />
              <small style={styles.helpText}>Free delivery will be applied when order total reaches this amount</small>
            </div>
            
            <div style={styles.inputGroup}>
              <label>Estimated Delivery Time</label>
              <input
                type="text"
                value={settings.estimatedDeliveryTime}
                onChange={(e) => setSettings({...settings, estimatedDeliveryTime: e.target.value})}
                style={styles.input}
                placeholder="e.g., 30-45 minutes"
              />
              <small style={styles.helpText}>This will be shown to customers</small>
            </div>
          </div>
        )}
      </div>

      {/* Pickup Service Toggle Section */}
      <div style={styles.section}>
        <label style={styles.toggleLabel}>
          <input
            type="checkbox"
            checked={settings.allowsPickup}
            onChange={(e) => setSettings({...settings, allowsPickup: e.target.checked})}
          />
          Allow Pickup Orders
        </label>

        {settings.allowsPickup && (
          <div style={styles.inputGroup}>
            <label>Pickup Instructions</label>
            <textarea
              value={settings.pickupInstructions}
              onChange={(e) => setSettings({...settings, pickupInstructions: e.target.value})}
              style={styles.textarea}
              placeholder="Instructions for customers when picking up orders"
              rows="3"
            />
            <small style={styles.helpText}>These instructions will be shown to customers</small>
          </div>
        )}
      </div>

      <div style={styles.note}>
        <strong>💡 Note:</strong> Customers will see only the options you enable above. 
        If both are disabled, customers won't be able to place orders.
      </div>

      <button 
        onClick={saveSettings}
        disabled={loading}
        style={loading ? styles.buttonDisabled : styles.saveButton}
      >
        {loading ? '💾 Saving...' : '💾 Save Delivery Settings'}
      </button>
    </div>
  );
};

// ============================================================================
// MAIN SHOP OWNER DASHBOARD COMPONENT - Central hub for shop management
// ============================================================================
const ShopOwnerDashboard = () => {
  // State management for dashboard functionality
  const [currentView, setCurrentView] = useState('overview');
  const [shopData, setShopData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  

  // 🆕 NEW: Quick Credit Sales state
  const [showQuickSales, setShowQuickSales] = useState(false); // Control sales modal visibility
  const auth = getAuth();
  const { language, changeLanguage, isMalayalam } = useLanguage();
  
  // Check if shop is setup when component mounts
  useEffect(() => {
    checkShopSetup();
  }, []);

  // Verify shop setup status and load shop data
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

  // 🆕 UPDATED: Render appropriate view component based on current selection
  const renderView = () => {
    switch (currentView) {
      case 'overview':
        return (
          <DashboardOverview 
            shopData={shopData} 
            shopId={auth.currentUser?.uid}
            // 🆕 PASS PROP FOR QUICK SALES
          onShowQuickSales={() => setShowQuickSales(true)}
          />
        );
      case 'setup':
        return <ShopSetup onSetupComplete={checkShopSetup} />;
      case 'inventory':
        return <InventoryManager shopId={auth.currentUser.uid} />;
      case 'orders':
        return <OrderManagement shopId={auth.currentUser.uid} />;
      case 'customers':
        return <CustomerCreditManager shopId={auth.currentUser.uid} />;
      case 'delivery':
        return (
          <div style={styles.deliverySection}>
            <DeliverySettings shopId={auth.currentUser.uid} />
            <div style={styles.section}>
              <ReturnPolicyManager shopId={auth.currentUser.uid} />
            </div>
          </div>
        );
      default:
        return <DashboardOverview shopData={shopData} shopId={auth.currentUser?.uid} />;
    }
  };

  // Toggle mobile navigation menu
  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  // Handle view change and close mobile menu
  const handleViewChange = (view) => {
    setCurrentView(view);
    setIsMobileMenuOpen(false);
  };

  if (loading) return <div style={styles.loading}>Loading Dashboard...</div>;

  return (
    <div style={styles.dashboard}>
      {/* Header Section with navigation and user info */}
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

      {/* Mobile Navigation Menu - Hidden on desktop */}
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
        <button 
            onClick={() => handleViewChange('delivery')}
            style={currentView === 'delivery' ? styles.mobileNavBtnActive : styles.mobileNavBtn}
          >
            <span style={styles.mobileNavIcon}>🚚</span>
            <span style={styles.mobileNavText}>Delivery & Returns</span>
          </button>
      </div>

      {/* Desktop Navigation - Hidden on mobile */}
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
        <button 
          onClick={() => setCurrentView('delivery')}
          style={currentView === 'delivery' ? styles.navBtnActive : styles.navBtn}
        >
          🚚 Delivery & Returns
        </button>
      </nav>

      {/* Main Content Area - Renders selected view component */}
      <main style={styles.main}>
        {renderView()}
      </main>

      {/* 🆕 NEW: QUICK CREDIT SALES MODAL */}
      {showQuickSales && (
        <QuickCreditSales 
          shopId={auth.currentUser?.uid} // Pass shop ID for data isolation
          onSaleCompleted={(saleData) => {
            // Handle successful sale completion
            console.log('Sale completed:', saleData);
            // You can refresh dashboard data here if needed
          }}
          onClose={() => setShowQuickSales(false)} // Close modal
        />
      )}
      
      {/* Mobile Menu Overlay - Darkens background when menu is open */}
      {isMobileMenuOpen && (
        <div 
          style={styles.overlay}
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </div>
  );
};

// ============================================================================
// DASHBOARD OVERVIEW COMPONENT - Main dashboard landing page
// ============================================================================
const DashboardOverview = ({ shopData, shopId,onShowQuickSales }) => {
  const [stats, setStats] = useState({
    totalProducts: 0,
    pendingOrders: 0,
    activeCustomers: 0,
    totalRevenue: 0
  });

  // Fetch dashboard statistics when shopId is available
  useEffect(() => {
    if (shopId) {
      fetchDashboardStats();
    }
  }, [shopId]);

  // Mock function to fetch dashboard statistics
  const fetchDashboardStats = async () => {
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
      
      {/* Statistics Grid - Shows key business metrics */}
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
          <div style={styles.statNumber}>₹{stats.totalRevenue.toLocaleString()}</div>
          <div style={styles.statLabel}>Total Revenue</div>
        </div>
      </div>
      
      {/* Store Information Section - Shows shop details */}
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

      {/* Quick Actions Section - Fast access to common tasks */}
      <div style={styles.quickActions}>
        <h3>Quick Actions</h3>
        <div style={styles.actionButtons}>
        {/* 🆕 NEW: Quick Credit Sales Button */}
        <button 
          onClick={onShowQuickSales}
          style={styles.quickSalesBtn}
        >
          💰 Quick Credit Sale
        </button>
        <button style={styles.actionBtn}>Add Products</button>
        <button style={styles.actionBtn}>View Orders</button>
        <button style={styles.actionBtn}>Manage Customers</button>
          </div>
      </div>
    </div>
  );
};

// ============================================================================
// COMPLETE STYLES OBJECT - All CSS styles for the dashboard
// ============================================================================
const styles = {
  deliverySection: {
  display: 'flex',
  flexDirection: 'column',
  gap: '2rem',
  maxWidth: '800px',
  margin: '0 auto',
  },
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
  main: {
    padding: '1rem',
    minHeight: 'calc(100vh - 150px)',
  },
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
    minHeight: '44px',
  },
  // 🆕 NEW STYLE FOR QUICK CUSTOMER REGISTRATION BUTTON
  quickActionBtn: {
    backgroundColor: '#9b59b6', // Purple color for distinction
    color: 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '1rem',
    minHeight: '44px',
    fontWeight: '600',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    transition: 'all 0.3s ease',
  },
  // 🆕 NEW STYLE FOR QUICK CREDIT SALES BUTTO
  // // 🆕 NEW: Quick Credit Sales Button Style (Green)
  quickSalesBtn: {
    backgroundColor: '#27ae60', // Green color for sales action
    color: 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '1rem',
    minHeight: '44px',
    fontWeight: '600',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    transition: 'all 0.3s ease',
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    fontSize: '1.2rem',
  },
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 1000,
  },
  // DELIVERY SETTINGS STYLES
  settingsContainer: {
    backgroundColor: 'white',
    padding: '2rem',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    maxWidth: '600px',
    margin: '0 auto',
  },
  section: {
    marginBottom: '2rem',
    paddingBottom: '1rem',
    borderBottom: '1px solid #ecf0f1',
  },
  toggleLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '1rem',
    fontWeight: '500',
    marginBottom: '1rem',
    cursor: 'pointer',
  },
  deliveryDetails: {
    padding: '1rem',
    backgroundColor: '#f8f9fa',
    borderRadius: '6px',
    marginTop: '1rem',
  },
  inputGroup: {
    marginBottom: '1rem',
  },
  input: {
    width: '100%',
    padding: '0.75rem',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '1rem',
    marginTop: '0.25rem',
  },
  textarea: {
    width: '100%',
    padding: '0.75rem',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '1rem',
    marginTop: '0.25rem',
    resize: 'vertical',
    fontFamily: 'inherit',
  },
  helpText: {
    color: '#6c757d',
    fontSize: '0.8rem',
    marginTop: '0.25rem',
    display: 'block',
  },
  note: {
    backgroundColor: '#e8f4fd',
    padding: '1rem',
    borderRadius: '6px',
    marginBottom: '1.5rem',
    fontSize: '0.9rem',
    color: '#3498db',
    border: '1px solid #b3d9ff',
  },
  saveButton: {
    backgroundColor: '#27ae60',
    color: 'white',
    border: 'none',
    padding: '1rem 2rem',
    borderRadius: '6px',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer',
    width: '100%',
  },
  buttonDisabled: {
    backgroundColor: '#bdc3c7',
    color: 'white',
    border: 'none',
    padding: '1rem 2rem',
    borderRadius: '6px',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'not-allowed',
    width: '100%',
  },
  '@media (max-width: 767px)': {
    mobileMenuButton: {
      display: 'block',
    },
    nav: {
      display: 'none',
    },
    statsGrid: {
      gridTemplateColumns: '1fr 1fr',
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
      gridTemplateColumns: '1fr',
    },
  },
  '@media (min-width: 768px)': {
    mobileNav: {
      display: 'none',
    },
    nav: {
      display: 'flex',
    },
  },
};

export default ShopOwnerDashboard;