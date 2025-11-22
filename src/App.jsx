// ==============================================
// 🏪 APP.JSX - CORRECTED VERSION
// ==============================================

import { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

// Context Providers
import { LanguageProvider } from './contexts/LanguageContext';
import { AdminProvider } from './contexts/AdminContext'; // 🆕 ADMIN PROVIDER

// Components
import Auth from './components/Auth';
import ShopOwnerDashboard from './components/ShopOwnerDashboard';
import CustomerDashboard from './components/CustomerDashboard';

// 🆕 NEW ADMIN COMPONENTS
import AdminLogin from './components/AdminLogin';
import AdminRoute from './components/AdminRoute';
import AdminDashboard from './components/AdminDashboard';
import CommissionManager from './components/CommissionManager';

import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const auth = getAuth();
    const db = getFirestore();
    
    console.log('🔍 App mounted - setting up auth listener...');

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('🔄 Auth state changed:', user ? user.email : 'No user');
      
      if (user) {
        setUser(user);
        
        try {
          console.log('📡 Fetching user data from Firestore...');
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const role = userData.role || 'customer';
            setUserRole(role);
            console.log('✅ User role from Firestore:', role);
          } else {
            console.log('❌ No user document in Firestore');
            const storedRole = localStorage.getItem(`userRole_${user.uid}`) || 'customer';
            setUserRole(storedRole);
            console.log('📦 User role from localStorage:', storedRole);
          }
        } catch (error) {
          console.error('🚨 Error fetching user role:', error);
          setError(error.message);
          const storedRole = localStorage.getItem(`userRole_${user.uid}`) || 'customer';
          setUserRole(storedRole);
        }
        
      } else {
        console.log('👤 No user - showing login page');
        setUser(null);
        setUserRole(null);
      }
      
      setLoading(false);
      console.log('🏁 Loading complete');
    });

    // Cleanup
    return () => {
      console.log('🧹 Cleaning up auth listener');
      unsubscribe();
    };
  }, []);

  // ==============================================
  // 🎯 ROUTE RENDERING LOGIC
  // ==============================================

  // Show errors
  if (error) {
    return (
      <div style={styles.errorContainer}>
        <h2>🚨 Error</h2>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Reload Page</button>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={styles.loading}>
        <h3>Loading...</h3>
        <p>Checking authentication status...</p>
      </div>
    );
  }

  // ==============================================
  // 🔐 CHECK CURRENT PATH
  // ==============================================
  const currentPath = window.location.pathname;
  console.log('📍 Current path:', currentPath);

  // ==============================================
  // 🏢 ADMIN ROUTES (Handle First)
  // ==============================================
  
  // Admin Login Route
  if (currentPath === '/admin-login') {
    console.log('🎯 Rendering Admin Login');
    return (
      <LanguageProvider>
        <AdminProvider>
          <AdminLogin />
        </AdminProvider>
      </LanguageProvider>
    );
  }
  
 // Commission Manager Route
  if (currentPath === '/admin/commissions') {
  console.log('🎯 Rendering Commission Manager');
  return (
    <LanguageProvider>
      <AdminProvider>
        <AdminRoute>
          <CommissionManager />
        </AdminRoute>
      </AdminProvider>
    </LanguageProvider>
  );
}

  // Admin Dashboard Route
  if (currentPath === '/admin') {
    console.log('🎯 Rendering Admin Dashboard');
    return (
      <LanguageProvider>
        <AdminProvider>
          <AdminRoute>
            <AdminDashboard />
          </AdminRoute>
        </AdminProvider>
      </LanguageProvider>
    );
  }

  // ==============================================
  // 👥 REGULAR USER ROUTES
  // ==============================================
  
  // If no user, show main auth
  if (!user) {
    console.log('🎯 Rendering Auth component');
    return (
      <LanguageProvider>
        <AdminProvider>
          <Auth />
        </AdminProvider>
      </LanguageProvider>
    );
  }

  console.log('🎯 User authenticated:', user.email, 'Role:', userRole);

  // Show appropriate dashboard based on role
  return (
    <LanguageProvider>
      <AdminProvider>
        {userRole === 'shop_owner' ? (
          <ShopOwnerDashboard />
        ) : (
          <CustomerDashboard />
        )}
      </AdminProvider>
    </LanguageProvider>
  );
}

// ==============================================
// 🎨 STYLES
// ==============================================

const styles = {
  loading: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    fontSize: '1.2rem',
    textAlign: 'center',
  },
  errorContainer: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    padding: '2rem',
    textAlign: 'center',
  },
};

export default App;