// src/components/CustomerDashboard.jsx - COMPLETE VERSION
import { calculateOrderTotal, calculateItemTotal } from '../utils/orderCalculations';
import { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import OrderSystem from './OrderSystem';
import CustomerOrderHistory from './CustomerOrderHistory';

const CustomerDashboard = () => {
  const [shops, setShops] = useState([]);
  const [selectedShop, setSelectedShop] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState([]);
  const [showOrderSystem, setShowOrderSystem] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [activeView, setActiveView] = useState('browse'); // 'browse' or 'orders'
  const auth = getAuth();

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
        if (product.stock > 0) { // Only show products with stock
          productsList.push(product);
        }
      });
      
      setProducts(productsList);
      setSelectedShop(shops.find(shop => shop.id === shopId));
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
  return calculateOrderTotal(cart); // ← ONLY CHANGE THIS LINE
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
      <div style={styles.header}>
        <h1>🛒 Customer Dashboard</h1>
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

      {/* Navigation Tabs */}
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
        <div style={styles.cartSummary}>
          🛒 Cart: {cart.length} items | ${getCartTotal().toFixed(2)}
        </div>
      </nav>

      {/* Main Content */}
      <div style={styles.mainContent}>
        {activeView === 'browse' ? (
          <div style={styles.browseSection}>
            {/* Shops Sidebar */}
            <div style={styles.sidebar}>
              <h3>🏪 Available Shops ({shops.length})</h3>
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
                              <img src={product.imageUrl} alt={product.name} style={styles.image} />
                            ) : (
                              <div style={styles.placeholderImage}>
                                {categories.find(cat => cat.value === product.category)?.label.split(' ')[0]}
                              </div>
                            )}
                          </div>
                          
                          <div style={styles.productInfo}>
                            <h4 style={styles.productName}>{product.name}</h4>
                            <p style={styles.productDescription}>{product.description}</p>
                            
                            <div style={styles.productDetails}>
                              <div style={styles.detail}>
                                <span style={styles.categoryBadge}>
                                  {categories.find(cat => cat.value === product.category)?.label}
                                </span>
                              </div>
                              <div style={styles.detail}>
                                <strong>Price:</strong> ${product.price} / {product.unit}
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
                  <p>Select a shop from the left sidebar to start shopping.</p>
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
            <div style={styles.cartSidebar}>
              <h3>🛒 Your Cart {cart.length > 0 && `(${cart.length})`}</h3>
              
              {cart.length === 0 ? (
                <div style={styles.emptyCart}>
                  <p>Your cart is empty</p>
                  <small>Add some products from the shops!</small>
                </div>
              ) : (
                <div style={styles.cartContent}>
                  <div style={styles.cartHeader}>
                    <span>Shopping at: <strong>{selectedShop?.shopName}</strong></span>
                  </div>
                  
                  <div style={styles.cartItems}>
                    {cart.map(item => (
                      <div key={item.id} style={styles.cartItem}>
                        <div style={styles.cartItemInfo}>
                          <strong>{item.name}</strong>
                          <span>${item.price} × {item.quantity}</span>
                          <span>Total: ${calculateItemTotal(item)}</span>
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
                    <strong>Total: ${getCartTotal().toFixed(2)}</strong>
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
        ) : (
          /* Orders View */
          <CustomerOrderHistory />
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
    </div>
  );
};

// COMPLETE STYLES
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
    alignItems: 'center',
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
  cartSummary: {
    marginLeft: 'auto',
    fontWeight: '600',
    color: '#2c3e50',
  },
  mainContent: {
    padding: '2rem',
    minHeight: 'calc(100vh - 140px)',
  },
  browseSection: {
    display: 'grid',
    gridTemplateColumns: '250px 1fr 300px',
    gap: '2rem',
    height: '100%',
  },
  sidebar: {
    backgroundColor: 'white',
    padding: '1rem',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    height: 'fit-content',
    maxHeight: '600px',
    overflowY: 'auto',
  },
  shopsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    marginTop: '1rem',
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
  productsArea: {
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    minHeight: '500px',
  },
  shopSection: {
    height: '100%',
  },
  shopHeader: {
    marginBottom: '2rem',
    paddingBottom: '1rem',
    borderBottom: '2px solid #ecf0f1',
  },
  shopDescription: {
    color: '#7f8c8d',
    fontSize: '1.1rem',
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
    padding: '0.75rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.9rem',
  },
  addButtonDisabled: {
    width: '100%',
    backgroundColor: '#bdc3c7',
    color: 'white',
    border: 'none',
    padding: '0.75rem',
    borderRadius: '4px',
    cursor: 'not-allowed',
    fontSize: '0.9rem',
  },
  cartSidebar: {
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    height: 'fit-content',
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
  cartHeader: {
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
    width: '25px',
    height: '25px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.8rem',
  },
  quantityBtnDisabled: {
    backgroundColor: '#bdc3c7',
    color: 'white',
    border: 'none',
    width: '25px',
    height: '25px',
    borderRadius: '4px',
    cursor: 'not-allowed',
    fontSize: '0.8rem',
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
    padding: '0.25rem 0.5rem',
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
    padding: '0.75rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '1rem',
  },
  clearButton: {
    backgroundColor: '#e74c3c',
    color: 'white',
    border: 'none',
    padding: '0.75rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '1rem',
  },
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
  loading: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    fontSize: '1.2rem',
    textAlign: 'center',
  },
};

export default CustomerDashboard;