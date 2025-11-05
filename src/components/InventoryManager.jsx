// src/components/InventoryManager.jsx - COMPLETE UPDATED VERSION
import { useState, useEffect, useRef } from 'react';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useLanguage } from '../contexts/LanguageContext';

const InventoryManager = ({ shopId }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const fileInputRef = useRef(null);
  const auth = getAuth();
  const { t, isMalayalam, changeLanguage } = useLanguage();

  // SIMPLIFIED FORM STATE - Optional Malayalam fields
  const [formData, setFormData] = useState({
    name: '',           // REQUIRED - English name
    name_ml: '',        // OPTIONAL - Malayalam name
    description: '',    // English description
    description_ml: '', // Optional Malayalam description
    price: '',
    category: 'vegetables',
    stock: '',
    unit: 'kg',
    imageUrl: ''
  });

  useEffect(() => {
    fetchProducts();
  }, [shopId]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const productsQuery = query(
        collection(db, 'products'),
        where('shopId', '==', shopId)
      );
      const querySnapshot = await getDocs(productsQuery);
      
      const productsList = [];
      querySnapshot.forEach((doc) => {
        productsList.push({ id: doc.id, ...doc.data() });
      });
      
      setProducts(productsList);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const productData = {
        ...formData,
        price: parseFloat(formData.price),
        stock: parseInt(formData.stock),
        shopId: shopId,
        createdAt: editingProduct ? editingProduct.createdAt : new Date(),
        updatedAt: new Date()
      };

      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id), productData);
        console.log('✅ Product updated successfully!');
      } else {
        await addDoc(collection(db, 'products'), productData);
        console.log('✅ Product added successfully!');
      }

      resetForm();
      fetchProducts();
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Error saving product. Please try again.');
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name || '',
      name_ml: product.name_ml || '', // Handle optional field
      description: product.description || '',
      description_ml: product.description_ml || '', // Handle optional field
      price: product.price.toString(),
      category: product.category,
      stock: product.stock.toString(),
      unit: product.unit,
      imageUrl: product.imageUrl || ''
    });
    setShowAddForm(true);
  };

  const handleDelete = async (productId) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        await deleteDoc(doc(db, 'products', productId));
        console.log('✅ Product deleted successfully!');
        fetchProducts();
      } catch (error) {
        console.error('Error deleting product:', error);
        alert('Error deleting product. Please try again.');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      name_ml: '',
      description: '',
      description_ml: '',
      price: '',
      category: 'vegetables',
      stock: '',
      unit: 'kg',
      imageUrl: ''
    });
    setEditingProduct(null);
    setShowAddForm(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // SIMPLIFIED: Regular handleChange - no complex logic
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleImageUrlChange = (e) => {
    setFormData({
      ...formData,
      imageUrl: e.target.value
    });
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

  const units = [
    { value: 'kg', label: 'Kilogram (kg)' },
    { value: 'g', label: 'Gram (g)' },
    { value: 'lb', label: 'Pound (lb)' },
    { value: 'piece', label: 'Piece' },
    { value: 'pack', label: 'Pack' },
    { value: 'bottle', label: 'Bottle' },
    { value: 'can', label: 'Can' },
    { value: 'liter', label: 'Liter' },
    { value: 'ml', label: 'Milliliter (ml)' }
  ];

  if (loading) {
    return (
      <div style={styles.loading}>Loading Inventory...</div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header with Language Switcher */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <h2>📦 Inventory Management</h2>
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
        <button 
          onClick={() => setShowAddForm(true)}
          style={styles.addButton}
        >
          ➕ Add Product
        </button>
      </div>

      {/* Add/Edit Product Form - Simplified */}
      {showAddForm && (
        <div style={styles.formOverlay}>
          <div style={styles.formCard}>
            <div style={styles.formHeader}>
              <h3>{editingProduct ? 'Edit Product' : 'Add New Product'}</h3>
              <button onClick={resetForm} style={styles.closeButton}>✕</button>
            </div>
            
            <form onSubmit={handleSubmit} style={styles.form}>
              <div style={styles.formGrid}>
                {/* English Name - REQUIRED */}
                <div style={styles.formGroup}>
                  <label>Product Name (English) *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    style={styles.input}
                    placeholder="Enter product name in English"
                  />
                </div>

                {/* Malayalam Name - OPTIONAL */}
                <div style={styles.formGroup}>
                  <label>Product Name (Malayalam) <small style={styles.optional}>(optional)</small></label>
                  <input
                    type="text"
                    name="name_ml"
                    value={formData.name_ml}
                    onChange={handleChange}
                    style={styles.input}
                    placeholder="മലയാളത്തിൽ ഉൽപ്പന്നത്തിന്റെ പേര്"
                    className="malayalam-input"
                  />
                  <small style={styles.helpText}>
                    Add Malayalam name for better customer experience
                  </small>
                </div>

                <div style={styles.formGroup}>
                  <label>Category *</label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    required
                    style={styles.select}
                  >
                    {categories.map(cat => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label>Price (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    name="price"
                    value={formData.price}
                    onChange={handleChange}
                    required
                    style={styles.input}
                    placeholder="0.00"
                    min="0"
                  />
                </div>

                <div style={styles.formGroup}>
                  <label>Stock Quantity *</label>
                  <input
                    type="number"
                    name="stock"
                    value={formData.stock}
                    onChange={handleChange}
                    required
                    style={styles.input}
                    placeholder="0"
                    min="0"
                  />
                </div>

                <div style={styles.formGroup}>
                  <label>Unit *</label>
                  <select
                    name="unit"
                    value={formData.unit}
                    onChange={handleChange}
                    required
                    style={styles.select}
                  >
                    {units.map(unit => (
                      <option key={unit.value} value={unit.value}>
                        {unit.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={styles.formGroupFull}>
                  <label>Image URL (optional)</label>
                  <input
                    type="url"
                    name="imageUrl"
                    value={formData.imageUrl}
                    onChange={handleChange}
                    style={styles.input}
                    placeholder="https://example.com/image.jpg"
                  />
                </div>

                {/* English Description - OPTIONAL */}
                <div style={styles.formGroupFull}>
                  <label>Description (English) <small style={styles.optional}>(optional)</small></label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    style={styles.textarea}
                    placeholder="Product description in English"
                    rows="2"
                  />
                </div>

                {/* Malayalam Description - OPTIONAL */}
                <div style={styles.formGroupFull}>
                  <label>Description (Malayalam) <small style={styles.optional}>(optional)</small></label>
                  <textarea
                    name="description_ml"
                    value={formData.description_ml}
                    onChange={handleChange}
                    style={styles.textarea}
                    placeholder="മലയാളത്തിൽ ഉൽപ്പന്ന വിവരണം"
                    rows="2"
                    className="malayalam-input"
                  />
                </div>
              </div>

              <div style={styles.formActions}>
                <button type="button" onClick={resetForm} style={styles.cancelButton}>
                  Cancel
                </button>
                <button type="submit" style={styles.saveButton}>
                  {editingProduct ? 'Update Product' : 'Add Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Products List - Uses translation function */}
      <div style={styles.productsSection}>
        <div style={styles.statsBar}>
          <div style={styles.stat}>
            <strong>Total Products:</strong> {products.length}
          </div>
          <div style={styles.stat}>
            <strong>With Malayalam Names:</strong> {products.filter(p => p.name_ml).length}
          </div>
          <div style={styles.stat}>
            <strong>Low Stock:</strong> {products.filter(p => p.stock < 10).length}
          </div>
        </div>

        {products.length === 0 ? (
          <div style={styles.emptyState}>
            <h3>No products yet</h3>
            <p>Start by adding your first product to your inventory!</p>
            <button 
              onClick={() => setShowAddForm(true)}
              style={styles.addButton}
            >
              ➕ Add Your First Product
            </button>
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
                  {/* UPDATED: Uses simple translation function */}
                  <h4 style={styles.productName}>{t(product)}</h4>
                  {product.name_ml && (
                    <div style={styles.malayalamBadge}>
                      🌸 Malayalam name available
                    </div>
                  )}
                  <p style={styles.productDescription}>
                    {isMalayalam && product.description_ml 
                      ? product.description_ml 
                      : product.description
                    }
                  </p>
                  
                  <div style={styles.productDetails}>
                    <div style={styles.detail}>
                      <strong>Category:</strong> 
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
                    onClick={() => handleEdit(product)}
                    style={styles.editButton}
                  >
                    ✏️ Edit
                  </button>
                  <button 
                    onClick={() => handleDelete(product.id)}
                    style={styles.deleteButton}
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// COMPLETE STYLES WITH LANGUAGE SUPPORT
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
  addButton: {
    backgroundColor: '#27ae60',
    color: 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: '600',
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    fontSize: '1.2rem',
  },
  formOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    padding: '1rem',
  },
  formCard: {
    backgroundColor: 'white',
    padding: '2rem',
    borderRadius: '8px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    width: '100%',
    maxWidth: '600px',
    maxHeight: '90vh',
    overflowY: 'auto',
  },
  formHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.5rem',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '1.5rem',
    cursor: 'pointer',
    color: '#666',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1rem',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
  },
  formGroupFull: {
    display: 'flex',
    flexDirection: 'column',
    gridColumn: '1 / -1',
  },
  input: {
    padding: '0.75rem',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '1rem',
    marginTop: '0.25rem',
  },
  textarea: {
    padding: '0.75rem',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '1rem',
    resize: 'vertical',
    minHeight: '80px',
    marginTop: '0.25rem',
  },
  select: {
    padding: '0.75rem',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '1rem',
    marginTop: '0.25rem',
  },
  formActions: {
    display: 'flex',
    gap: '1rem',
    justifyContent: 'flex-end',
    marginTop: '1rem',
  },
  cancelButton: {
    backgroundColor: '#95a5a6',
    color: 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  saveButton: {
    backgroundColor: '#3498db',
    color: 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  optional: {
    color: '#7f8c8d',
    fontWeight: 'normal',
  },
  helpText: {
    color: '#7f8c8d',
    fontSize: '0.8rem',
    marginTop: '0.25rem',
  },
  productsSection: {
    marginTop: '2rem',
  },
  statsBar: {
    display: 'flex',
    gap: '2rem',
    marginBottom: '2rem',
    padding: '1rem',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    flexWrap: 'wrap',
  },
  stat: {
    fontSize: '1rem',
    color: '#2c3e50',
  },
  emptyState: {
    textAlign: 'center',
    padding: '3rem',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  productsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
    gap: '1.5rem',
  },
  productCard: {
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
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
    fontSize: '1.2rem',
    color: '#2c3e50',
    minHeight: '2.8em',
    lineHeight: '1.3',
  },
  malayalamBadge: {
    backgroundColor: '#e8f6f3',
    color: '#27ae60',
    padding: '0.25rem 0.5rem',
    borderRadius: '12px',
    fontSize: '0.7rem',
    display: 'inline-block',
    marginBottom: '0.5rem',
  },
  productDescription: {
    margin: '0 0 1rem 0',
    color: '#7f8c8d',
    fontSize: '0.9rem',
    lineHeight: '1.4',
    minHeight: '2.8em',
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
    display: 'flex',
    gap: '0.5rem',
  },
  editButton: {
    flex: 1,
    backgroundColor: '#f39c12',
    color: 'white',
    border: 'none',
    padding: '0.5rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.9rem',
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#e74c3c',
    color: 'white',
    border: 'none',
    padding: '0.5rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.9rem',
  },
};

export default InventoryManager;