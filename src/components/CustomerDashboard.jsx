// src/components/CustomerDashboard.jsx - MOBILE RESPONSIVE VERSION
import { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import OrderSystem from './OrderSystem';
import CustomerOrderHistory from './CustomerOrderHistory';
import CustomerProfile from './CustomerProfile';
import { calculateOrderTotal, calculateItemTotal } from '../utils/orderCalculations';
import { useLanguage } from '../contexts/LanguageContext'; // USING LANGUAGE CONTEXT

const CustomerDashboard = () => {
  const [shops, setShops] = useState([]);
  const [selectedShop, setSelectedShop] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState([]);
  const [showOrderSystem, setShowOrderSystem] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [activeView, setActiveView] = useState('browse');
  const [isCartOpen, setIsCartOpen] = useState(false); // Mobile cart state
  const [isShopListOpen, setIsShopListOpen] = useState(false); // Mobile shop list state
  const auth = getAuth();
  const { t, isMalayalam, changeLanguage } = useLanguage(); // USING LANGUAGE CONTEXT

  useEffect(() => {
    fetchShops();
  }, []);

  const fetchShops = async () => {
    try {
      setLoading(true);
      const shopsSnapshot = await getDocs(collection(db, 'shops'));
      const shopsList = [];
      shopsSnapshot.forEach((doc) => {
        if (doc.data().isActive) {
          shopsList.push({ id: doc.id, ...doc.data() });
        }
      });
      setShops(shopsList);
      
      // Auto-select first shop if available
      if (shopsList.length > 0 && !selectedShop) {
        fetchShopProducts(shopsList[0].id);
      }
    } catch (error) {
      console.error('Error fetching shops:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchShopProducts = async (shopId) => {
    try {
      setLoading(true);
      const productsQuery = query(
        collection(db, 'products'),
        where('shopId', '==', shopId)
      );
      const querySnapshot = await getDocs(productsQuery);
      
      const productsList = [];
      querySnapshot.forEach((doc) => {
        const product = { id: doc.id, ...doc.data() };
        if (product.stock > 0) {
          productsList.push(product);
        }
      });
      
      setProducts(productsList);
      setSelectedShop(shops.find(shop => shop.id === shopId));
      setIsShopListOpen(false); // Close shop list on mobile after selection
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (product) => {
    // Check if product is from the same shop
    if (cart.length > 0 && cart[0].shopId !== product.shopId) {
      if (window.confirm('Your cart contains items from another shop. Would you like to clear the cart and add items from this shop?')) {
        setCart([{ ...product, quantity: 1, shopId: product.shopId }]);
      }
      return;
    }

    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.id === product.id);
      if (existingItem) {
        if (existingItem.quantity >= product.stock) {
          alert(`Only ${product.stock} items available in stock!`);
          return prevCart;
        }
        return prevCart.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        return [...prevCart, { ...product, quantity: 1, shopId: product.shopId }];
      }
    });
  };

  const removeFromCart = (productId) => {
    setCart(prevCart => prevCart.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId, quantity) => {
    if (quantity === 0) {
      removeFromCart(productId);
      return;
    }
    
    const product = cart.find(item => item.id === productId);
    if (product && quantity > product.stock) {
      alert(`Only ${product.stock} items available in stock!`);
      return;
    }
    
    setCart(prevCart =>
      prevCart.map(item =>
        item.id === productId ? { ...item, quantity } : item
      )
    );
  };

  const getCartTotal = () => {
    return calculateOrderTotal(cart);
  };

  const handlePlaceOrder = () => {
    if (cart.length === 0) {
      alert('Your cart is empty!');
      return;
    }
    
    if (!selectedShop) {
      alert('Please select a shop first!');
      return;
    }
    
    setShowOrderSystem(true);
    setIsCartOpen(false); // Close cart on mobile when placing order
  };

  const handleOrderPlaced = (orderId) => {
    setOrderPlaced(true);
    setCart([]);
    setShowOrderSystem(false);
    setActiveView('orders');
    
    setTimeout(() => {
      setOrderPlaced(false);
    }, 5000);
  };

  const categories = [
    { value: 'vegetables', label: '🥬 Vegetables' },
    { value: 'fruits', label: '🍎 Fruits' },
    { value: 'dairy', label: '🥛 Dairy & Eggs' },
    { value: 'meat', label: '🍗 Meat & Poultry' },
    { value: 'grains', label: '🌾 Grains & Cereals' },
    { value: 'beverages', label: '🥤 Beverages' },
    { value: 'snacks', label: '🍪 Snacks' },
    { value: 'household', label: '🏠 Household' },
    { value: 'other', label: '📦 Other' }
  ];

  // Mobile cart toggle
  const toggleCart = () => {
    setIsCartOpen(!isCartOpen);
  };

  // Mobile shop list toggle
  const toggleShopList = () => {
    setIsShopListOpen(!isShopListOpen);
  };

  if (loading && shops.length === 0) {
    return (
      <div style={styles.loading}>
        <h3>Loading Shops...</h3>
        <p>Finding the best shops for you...</p>
      </div>
    );
  }

  return (
    <div style={styles.dashboard}>
      {/* Order Success Message */}
      {orderPlaced && (
        <div style={styles.successMessage}>
          <div style={styles.successContent}>
            <span style={styles.successIcon}>🎉</span>
            <div>
              <strong>Order Placed Successfully!</strong>
              <p>Your order has been received. The shop will contact you soon.</p>
            </div>
            <button 
              onClick={() => setOrderPlaced(false)}
              style={styles.closeSuccess}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      {/* UPDATED HEADER WITH LANGUAGE SWITCHER */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <h1>🛒 Customer Dashboard</h1>
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

      {/* Mobile Bottom Navigation */}
      <div style={styles.mobileNav}>
        <button 
          onClick={() => setActiveView('browse')}
          style={activeView === 'browse' ? styles.mobileNavBtnActive : styles.mobileNavBtn}
        >
          <span style={styles.mobileNavIcon}>🏪</span>
          <span style={styles.mobileNavText}>Shops</span>
        </button>
        <button 
          onClick={() => setActiveView('orders')}
          style={activeView === 'orders' ? styles.mobileNavBtnActive : styles.mobileNavBtn}
        >
          <span style={styles.mobileNavIcon}>📋</span>
          <span style={styles.mobileNavText}>Orders</span>
        </button>
        <button 
          onClick={() => setActiveView('profile')}
          style={activeView === 'profile' ? styles.mobileNavBtnActive : styles.mobileNavBtn}
        >
          <span style={styles.mobileNavIcon}>👤</span>
          <span style={styles.mobileNavText}>Profile</span>
        </button>
        <button 
          onClick={toggleCart}
          style={styles.mobileCartBtn}
        >
          <span style={styles.mobileNavIcon}>🛒</span>
          <span style={styles.mobileNavText}>Cart</span>
          {cart.length > 0 && (
            <span style={styles.cartBadge}>{cart.length}</span>
          )}
        </button>
      </div>

      {/* Desktop Navigation */}
      <nav style={styles.nav}>
        <button 
          onClick={() => setActiveView('browse')}
          style={activeView === 'browse' ? styles.navBtnActive : styles.navBtn}
        >
          🏪 Browse Shops
        </button>
        <button 
          onClick={() => setActiveView('orders')}
          style={activeView === 'orders' ? styles.navBtnActive : styles.navBtn}
        >
          📋 My Orders
        </button>
        <button 
          onClick={() => setActiveView('profile')}
          style={activeView === 'profile' ? styles.navBtnActive : styles.navBtn}
        >
          👤 My Profile
        </button>
        <div style={styles.cartSummary}>
          🛒 Cart: {cart.length} items | ₹{getCartTotal().toFixed(2)}
          <button 
            onClick={handlePlaceOrder}
            style={styles.placeOrderBtn}
            disabled={cart.length === 0}
          >
            📦 Place Order
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <div style={styles.mainContent}>
        {activeView === 'browse' ? (
          <div style={styles.browseSection}>
            {/* Mobile Shop Selection */}
            <div style={styles.mobileShopHeader}>
              <button onClick={toggleShopList} style={styles.mobileShopToggle}>
                {selectedShop ? selectedShop.shopName : 'Select Shop'}
                <span style={styles.dropdownIcon}>▼</span>
              </button>
            </div>

            {/* Shops Sidebar */}
            <div style={{
              ...styles.sidebar,
              ...(isShopListOpen && styles.sidebarOpen)
            }}>
              <div style={styles.sidebarHeader}>
                <h3>🏪 Available Shops ({shops.length})</h3>
                <button onClick={toggleShopList} style={styles.closeSidebar}>
                  ✕
                </button>
              </div>
              <div style={styles.shopsList}>
                {shops.map(shop => (
                  <div
                    key={shop.id}
                    onClick={() => fetchShopProducts(shop.id)}
                    style={
                      selectedShop?.id === shop.id 
                        ? styles.shopItemActive 
                        : styles.shopItem
                    }
                  >
                    <div style={styles.shopIcon}>
                      {categories.find(cat => cat.value === shop.category)?.label.split(' ')[0]}
                    </div>
                    <div style={styles.shopInfo}>
                      <strong>{shop.shopName}</strong>
                      <span style={styles.shopCategory}>{shop.category}</span>
                      <small>{shop.phone || 'No phone'}</small>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Products Area */}
            <div style={styles.productsArea}>
              {selectedShop ? (
                <div style={styles.shopSection}>
                  <div style={styles.shopHeader}>
                    <h2>{selectedShop.shopName}</h2>
                    <p style={styles.shopDescription}>{selectedShop.description}</p>
                    <div style={styles.shopDetails}>
                      <span>📍 {selectedShop.address}</span>
                      <span>🕒 {selectedShop.openingHours}</span>
                      {selectedShop.phone && <span>📞 {selectedShop.phone}</span>}
                    </div>
                  </div>

                  {loading ? (
                    <div style={styles.loadingProducts}>
                      <p>Loading products from {selectedShop.shopName}...</p>
                    </div>
                  ) : products.length === 0 ? (
                    <div style={styles.emptyProducts}>
                      <h3>No products available</h3>
                      <p>This shop hasn't added any products yet or all products are out of stock.</p>
                    </div>
                  ) : (
                    <div style={styles.productsGrid}>
                      {products.map(product => (
                        <div key={product.id} style={styles.productCard}>
                          <div style={styles.productImage}>
                            {product.imageUrl ? (
                              <img src={product.imageUrl} alt={t(product)} style={styles.image} />
                            ) : (
                              <div style={styles.placeholderImage}>
                                {categories.find(cat => cat.value === product.category)?.label.split(' ')[0]}
                              </div>
                            )}
                          </div>
                          
                          <div style={styles.productInfo}>
                            {/* UPDATED: Uses translation function */}
                            <h4 style={styles.productName}>{t(product)}</h4>
                            <p style={styles.productDescription}>
                              {isMalayalam && product.description_ml 
                                ? product.description_ml 
                                : product.description
                              }
                            </p>
                            
                            <div style={styles.productDetails}>
                              <div style={styles.detail}>
                                <span style={styles.categoryBadge}>
                                  {categories.find(cat => cat.value === product.category)?.label}
                                </span>
                              </div>
                              <div style={styles.detail}>
                                <strong>Price:</strong> ₹{product.price} / {product.unit}
                              </div>
                              <div style={styles.detail}>
                                <strong>Stock:</strong> 
                                <span style={product.stock < 10 ? styles.lowStock : styles.inStock}>
                                  {product.stock} {product.unit}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div style={styles.productActions}>
                            <button 
                              onClick={() => addToCart(product)}
                              disabled={product.stock === 0}
                              style={product.stock === 0 ? styles.addButtonDisabled : styles.addButton}
                            >
                              {product.stock === 0 ? 'Out of Stock' : '🛒 Add to Cart'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div style={styles.welcomeSection}>
                  <h2>Welcome to NexCart! 🛒</h2>
                  <p>Select a shop from the sidebar to start shopping.</p>
                  <div style={styles.featureList}>
                    <div style={styles.feature}>
                      <span>🏪</span>
                      <div>
                        <strong>Multiple Shops</strong>
                        <p>Browse products from different local stores</p>
                      </div>
                    </div>
                    <div style={styles.feature}>
                      <span>💰</span>
                      <div>
                        <strong>Credit System</strong>
                        <p>Shop now, pay later with store credit</p>
                      </div>
                    </div>
                    <div style={styles.feature}>
                      <span>🛒</span>
                      <div>
                        <strong>Easy Shopping</strong>
                        <p>Add to cart and manage your orders</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Shopping Cart Sidebar */}
            <div style={{
              ...styles.cartSidebar,
              ...(isCartOpen && styles.cartSidebarOpen)
            }}>
              <div style={styles.cartHeader}>
                <h3>🛒 Your Cart {cart.length > 0 && `(${cart.length})`}</h3>
                <button onClick={toggleCart} style={styles.closeCart}>
                  ✕
                </button>
              </div>
              
              {cart.length === 0 ? (
                <div style={styles.emptyCart}>
                  <p>Your cart is empty</p>
                  <small>Add some products from the shops!</small>
                </div>
              ) : (
                <div style={styles.cartContent}>
                  <div style={styles.cartInfo}>
                    <span>Shopping at: <strong>{selectedShop?.shopName}</strong></span>
                  </div>
                  
                  <div style={styles.cartItems}>
                    {cart.map(item => (
                      <div key={item.id} style={styles.cartItem}>
                        <div style={styles.cartItemInfo}>
                          <strong>{item.name}</strong>
                          <span>₹{item.price} × {item.quantity}</span>
                          <span>Total: ₹{calculateItemTotal(item)}</span>
                        </div>
                        <div style={styles.cartItemActions}>
                          <button 
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            style={styles.quantityBtn}
                          >
                            -
                          </button>
                          <span style={styles.quantity}>{item.quantity}</span>
                          <button 
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            disabled={item.quantity >= item.stock}
                            style={item.quantity >= item.stock ? styles.quantityBtnDisabled : styles.quantityBtn}
                          >
                            +
                          </button>
                          <button 
                            onClick={() => removeFromCart(item.id)}
                            style={styles.removeBtn}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div style={styles.cartTotal}>
                    <strong>Total: ₹{getCartTotal().toFixed(2)}</strong>
                  </div>
                  
                  <div style={styles.cartActions}>
                    <button 
                      style={styles.checkoutButton}
                      onClick={handlePlaceOrder}
                    >
                      📦 Place Order
                    </button>
                    <button 
                      style={styles.clearButton}
                      onClick={() => setCart([])}
                    >
                      Clear Cart
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : activeView === 'orders' ? (
          <CustomerOrderHistory />
        ) : activeView === 'profile' ? (
          <CustomerProfile />
        ) : (
          <div style={styles.welcomeSection}>
            <h2>Welcome to NexCart! 🛒</h2>
            <p>Select a view from the navigation above.</p>
          </div>
        )}
      </div>

      {/* Order System Modal */}
      {showOrderSystem && (
        <OrderSystem
          cart={cart}
          shop={selectedShop}
          onOrderPlaced={handleOrderPlaced}
          onClose={() => setShowOrderSystem(false)}
        />
      )}

      {/* Mobile Overlay */}
      {(isCartOpen || isShopListOpen) && (
        <div style={styles.overlay} onClick={() => {
          setIsCartOpen(false);
          setIsShopListOpen(false);
        }} />
      )}
    </div>
  );
};

// COMPLETE MOBILE-RESPONSIVE STYLES
const styles = {
  dashboard: {
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
    paddingBottom: '80px', // Space for mobile nav
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
    gap: '2rem',
    flexWrap: 'wrap',
  },
  languageSwitch: {
    display: 'flex',
    backgroundColor: '#ecf0f1',
    borderRadius: '6px',
    overflow: 'hidden',
  },
  langBtn: {
    padding: '0.5rem 1rem',
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    fontSize: '0.9rem',
    color: '#2c3e50',
  },
  langBtnActive: {
    padding: '0.5rem 1rem',
    border: 'none',
    backgroundColor: '#3498db',
    color: 'white',
    cursor: 'pointer',
    fontSize: '0.9rem',
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
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTop: '1px solid #ddd',
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    padding: '0.5rem 0',
    zIndex: 1000,
  },
  mobileNavBtn: {
    background: 'none',
    border: 'none',
    padding: '0.5rem',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.25rem',
    flex: 1,
    color: '#7f8c8d',
  },
  mobileNavBtnActive: {
    background: 'none',
    border: 'none',
    padding: '0.5rem',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.25rem',
    flex: 1,
    color: '#3498db',
    fontWeight: '600',
  },
  mobileCartBtn: {
    background: 'none',
    border: 'none',
    padding: '0.5rem',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.25rem',
    flex: 1,
    color: '#7f8c8d',
    position: 'relative',
  },
  mobileNavIcon: {
    fontSize: '1.2rem',
  },
  mobileNavText: {
    fontSize: '0.7rem',
  },
  cartBadge: {
    position: 'absolute',
    top: '0',
    right: '20%',
    backgroundColor: '#e74c3c',
    color: 'white',
    borderRadius: '50%',
    width: '18px',
    height: '18px',
    fontSize: '0.7rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Desktop Navigation
  nav: {
    backgroundColor: 'white',
    padding: '1rem',
    borderBottom: '1px solid #ddd',
    display: 'flex',
    gap: '1rem',
    alignItems: 'center',
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
  cartSummary: {
    marginLeft: 'auto',
    fontWeight: '600',
    color: '#2c3e50',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  placeOrderBtn: {
    backgroundColor: '#27ae60',
    color: 'white',
    border: 'none',
    padding: '0.5rem 1rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.9rem',
  },

  // Main Content
  mainContent: {
    padding: '1rem',
    minHeight: 'calc(100vh - 200px)',
  },

  // Browse Section - Mobile First
  browseSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    height: '100%',
  },

  // Mobile Shop Header
  mobileShopHeader: {
    display: 'block',
  },
  mobileShopToggle: {
    width: '100%',
    padding: '1rem',
    backgroundColor: 'white',
    border: '1px solid #ddd',
    borderRadius: '8px',
    fontSize: '1rem',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownIcon: {
    fontSize: '0.8rem',
    opacity: 0.7,
  },

  // Sidebar - Mobile
  sidebar: {
    backgroundColor: 'white',
    padding: '1rem',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    maxHeight: '400px',
    overflowY: 'auto',
    display: 'none', // Hidden on mobile by default
  },
  sidebarOpen: {
    display: 'block', // Show when open on mobile
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '90%',
    maxWidth: '400px',
    maxHeight: '80vh',
    zIndex: 1001,
  },
  sidebarHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  closeSidebar: {
    background: 'none',
    border: 'none',
    fontSize: '1.2rem',
    cursor: 'pointer',
    color: '#666',
  },
  shopsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  shopItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem',
    borderRadius: '6px',
    cursor: 'pointer',
    border: '1px solid #ecf0f1',
    transition: 'all 0.3s ease',
  },
  shopItemActive: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem',
    borderRadius: '6px',
    cursor: 'pointer',
    backgroundColor: '#3498db',
    color: 'white',
    border: '1px solid #3498db',
  },
  shopIcon: {
    fontSize: '1.5rem',
  },
  shopInfo: {
    display: 'flex',
    flexDirection: 'column',
    fontSize: '0.9rem',
  },
  shopCategory: {
    fontSize: '0.8rem',
    color: '#7f8c8d',
  },

  // Products Area
  productsArea: {
    backgroundColor: 'white',
    padding: '1rem',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    minHeight: '500px',
    order: 2,
  },
  shopSection: {
    height: '100%',
  },
  shopHeader: {
    marginBottom: '1.5rem',
    paddingBottom: '1rem',
    borderBottom: '2px solid #ecf0f1',
  },
  shopDescription: {
    color: '#7f8c8d',
    fontSize: '1rem',
    margin: '0.5rem 0',
  },
  shopDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    fontSize: '0.9rem',
    color: '#95a5a6',
  },
  loadingProducts: {
    textAlign: 'center',
    padding: '2rem',
    color: '#7f8c8d',
  },
  emptyProducts: {
    textAlign: 'center',
    padding: '3rem',
    color: '#7f8c8d',
  },
  productsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '1.5rem',
  },
  productCard: {
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid #ecf0f1',
  },
  productImage: {
    height: '120px',
    backgroundColor: '#f8f9fa',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  placeholderImage: {
    fontSize: '2rem',
    color: '#bdc3c7',
  },
  productInfo: {
    padding: '1rem',
    flex: 1,
  },
  productName: {
    margin: '0 0 0.5rem 0',
    fontSize: '1.1rem',
    color: '#2c3e50',
  },
  productDescription: {
    margin: '0 0 1rem 0',
    color: '#7f8c8d',
    fontSize: '0.9rem',
    lineHeight: '1.4',
  },
  productDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  detail: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '0.9rem',
  },
  categoryBadge: {
    backgroundColor: '#e8f4fd',
    color: '#3498db',
    padding: '0.25rem 0.5rem',
    borderRadius: '12px',
    fontSize: '0.8rem',
  },
  inStock: {
    color: '#27ae60',
    fontWeight: '600',
  },
  lowStock: {
    color: '#e74c3c',
    fontWeight: '600',
  },
  productActions: {
    padding: '1rem',
    borderTop: '1px solid #ecf0f1',
  },
  addButton: {
    width: '100%',
    backgroundColor: '#27ae60',
    color: 'white',
    border: 'none',
    padding: '1rem',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: '600',
    minHeight: '50px',
  },
  addButtonDisabled: {
    width: '100%',
    backgroundColor: '#bdc3c7',
    color: 'white',
    border: 'none',
    padding: '1rem',
    borderRadius: '8px',
    cursor: 'not-allowed',
    fontSize: '1rem',
    minHeight: '50px',
  },

  // Cart Sidebar - Mobile
  cartSidebar: {
    backgroundColor: 'white',
    padding: '1rem',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    height: 'fit-content',
    display: 'none', // Hidden on mobile by default
  },
  cartSidebarOpen: {
    display: 'block', // Show when open on mobile
    position: 'fixed',
    bottom: '0',
    left: '0',
    right: '0',
    backgroundColor: 'white',
    borderTop: '2px solid #3498db',
    zIndex: 1001,
    maxHeight: '70vh',
    overflowY: 'auto',
    borderRadius: '16px 16px 0 0',
  },
  cartHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  closeCart: {
    background: 'none',
    border: 'none',
    fontSize: '1.2rem',
    cursor: 'pointer',
    color: '#666',
  },
  emptyCart: {
    textAlign: 'center',
    padding: '2rem',
    color: '#7f8c8d',
  },
  cartContent: {
    display: 'flex',
    flexDirection: 'column',
  },
  cartInfo: {
    padding: '0.75rem',
    backgroundColor: '#e8f4fd',
    borderRadius: '4px',
    marginBottom: '1rem',
    fontSize: '0.9rem',
    textAlign: 'center',
    color: '#3498db',
  },
  cartItems: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    marginBottom: '1rem',
    maxHeight: '300px',
    overflowY: 'auto',
  },
  cartItem: {
    padding: '0.75rem',
    border: '1px solid #ecf0f1',
    borderRadius: '6px',
    backgroundColor: '#f8f9fa',
  },
  cartItemInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    marginBottom: '0.5rem',
    fontSize: '0.9rem',
  },
  cartItemActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  quantityBtn: {
    backgroundColor: '#3498db',
    color: 'white',
    border: 'none',
    width: '35px',
    height: '35px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '1rem',
  },
  quantityBtnDisabled: {
    backgroundColor: '#bdc3c7',
    color: 'white',
    border: 'none',
    width: '35px',
    height: '35px',
    borderRadius: '6px',
    cursor: 'not-allowed',
    fontSize: '1rem',
  },
  quantity: {
    padding: '0 0.5rem',
    fontWeight: '600',
    fontSize: '0.9rem',
  },
  removeBtn: {
    backgroundColor: '#e74c3c',
    color: 'white',
    border: 'none',
    padding: '0.5rem',
    borderRadius: '4px',
    cursor: 'pointer',
    marginLeft: 'auto',
    fontSize: '0.8rem',
  },
  cartTotal: {
    padding: '1rem 0',
    borderTop: '2px solid #ecf0f1',
    textAlign: 'center',
    fontSize: '1.2rem',
    fontWeight: 'bold',
  },
  cartActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  checkoutButton: {
    backgroundColor: '#27ae60',
    color: 'white',
    border: 'none',
    padding: '1rem',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: '600',
  },
  clearButton: {
    backgroundColor: '#e74c3c',
    color: 'white',
    border: 'none',
    padding: '1rem',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '1rem',
  },

  // Welcome Section
  welcomeSection: {
    textAlign: 'center',
    padding: '3rem',
  },
  featureList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
    marginTop: '2rem',
    maxWidth: '500px',
    margin: '2rem auto',
  },
  feature: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    textAlign: 'left',
    padding: '1rem',
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
  },

  // Success Message
  successMessage: {
    position: 'fixed',
    top: '20px',
    right: '20px',
    backgroundColor: '#27ae60',
    color: 'white',
    padding: '1rem',
    borderRadius: '8px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    zIndex: 1001,
    maxWidth: '400px',
  },
  successContent: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '1rem',
  },
  successIcon: {
    fontSize: '1.5rem',
  },
  closeSuccess: {
    background: 'none',
    border: 'none',
    color: 'white',
    fontSize: '1.2rem',
    cursor: 'pointer',
    marginLeft: 'auto',
  },

  // Loading
  loading: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    fontSize: '1.2rem',
    textAlign: 'center',
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
  '@media (min-width: 768px)': {
    dashboard: {
      paddingBottom: '0', // Remove mobile nav space on desktop
    },
    mobileNav: {
      display: 'none', // Hide mobile nav on desktop
    },
    nav: {
      display: 'flex', // Show desktop nav
    },
    browseSection: {
      display: 'grid',
      gridTemplateColumns: '250px 1fr 300px',
      gap: '2rem',
      height: '100%',
    },
    sidebar: {
      display: 'block', // Show sidebar on desktop
      position: 'static',
      transform: 'none',
      width: '100%',
      maxHeight: '600px',
    },
    cartSidebar: {
      display: 'block', // Show cart on desktop
      position: 'static',
      maxHeight: 'none',
    },
    mobileShopHeader: {
      display: 'none', // Hide mobile shop header on desktop
    },
    closeSidebar: {
      display: 'none', // Hide close button on desktop
    },
    closeCart: {
      display: 'none', // Hide close button on desktop
    },
  },
};

export default CustomerDashboard;