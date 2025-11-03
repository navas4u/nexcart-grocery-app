// src/utils/orderCalculations.js - CREATE NEW FILE
export const calculateItemTotal = (item) => {
  return (item.price * item.quantity).toFixed(2);
};

export const normalizeOrderItems = (items) => {
  return items.map(item => ({
    ...item,
    total: calculateItemTotal(item)
  }));
};

export const calculateOrderTotal = (items) => {
  return items.reduce((total, item) => total + (item.price * item.quantity), 0);
};