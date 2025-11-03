// src/components/InventoryManager.jsx - ORIGINAL STYLING
import { useState, useEffect, useRef } from 'react';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';

const InventoryManager = ({ shopId }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const fileInputRef = useRef(null);
  const auth = getAuth();

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
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
      name: product.name,
      description: product.description || '',
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
      description: '',
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
      {/* Header */}
      <div style={styles.header}>
        <h2>📦 Inventory Management</h2>
        <button 
          onClick={() => setShowAddForm(true)}
          style={styles.addButton}
        >
          ➕ Add Product
        </button>
      </div>

      {/* Add/Edit Product Form */}
      {showAddForm && (
        <div style={styles.formOverlay}>
          <div style={styles.formCard}>
            <div style={styles.formHeader}>
              <h3>{editingProduct ? 'Edit Product' : 'Add New Product'}</h3>
              <button onClick={resetForm} style={styles.closeButton}>✕</button>
            </div>
            
            <form onSubmit={handleSubmit} style={styles.form}>
              <div style={styles.formGrid}>
                <div style={styles.formGroup}>
                  <label>Product Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    style={styles.input}
                    placeholder="Enter product name"
                  />
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
                  <label>Price ($) *</label>
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
                    onChange={handleImageUrlChange}
                    style={styles.input}
                    placeholder="https://example.com/image.jpg"
                  />
                  <small style={styles.helpText}>
                    🔒 Image upload feature will be available after Firebase Storage setup
                  </small>
                </div>

                <div style={styles.formGroupFull}>
                  <label>Description</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    style={styles.textarea}
                    placeholder="Product description (optional)"
                    rows="3"
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

      {/* Products List */}
      <div style={styles.productsSection}>
        <div style={styles.statsBar}>
          <div style={styles.stat}>
            <strong>Total Products:</strong> {products.length}
          </div>
          <div style={styles.stat}>
            <strong>Categories:</strong> {new Set(products.map(p => p.category)).size}
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
                      <strong>Category:</strong> 
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

// ORIGINAL COOL STYLES
const styles = {
  container: {
    padding: '0',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2rem',
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