// App.jsx - DEBUGGED VERSION
import { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import Auth from './components/Auth';
import ShopOwnerDashboard from './components/ShopOwnerDashboard';
import './App.css';
import CustomerDashboard from './components/CustomerDashboard';
import { LanguageProvider } from './contexts/LanguageContext'; // ADD THIS

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

  if (!user) {
    console.log('🎯 Rendering Auth component');
    return <Auth />;
  }

  console.log('🎯 Rendering dashboard for:', user.email, 'Role:', userRole);

  // Route based on user role
  return (
    <LanguageProvider>
      {userRole === 'shop_owner' ? (
        <ShopOwnerDashboard />
      ) : (
        <CustomerDashboard />
      )}
    </LanguageProvider>
  );
}

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
  customerDashboard: {
    padding: '2rem',
    backgroundColor: '#f5f5f5',
    minHeight: '100vh',
  },
  welcomeCard: {
    backgroundColor: 'white',
    padding: '2rem',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    textAlign: 'center',
    maxWidth: '500px',
    margin: '0 auto',
  },
  logoutBtn: {
    backgroundColor: '#e74c3c',
    color: 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '4px',
    cursor: 'pointer',
    marginTop: '1rem',
  },
};
export default App;