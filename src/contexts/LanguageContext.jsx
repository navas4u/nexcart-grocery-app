// src/contexts/LanguageContext.jsx
import React, { createContext, useState, useContext, useEffect } from 'react';

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState('en');

  useEffect(() => {
    const savedLanguage = localStorage.getItem('preferredLanguage') || 'en';
    setLanguage(savedLanguage);
    
    const handleLanguageChange = (event) => {
      setLanguage(event.detail);
      localStorage.setItem('preferredLanguage', event.detail);
    };
    
    window.addEventListener('languageChange', handleLanguageChange);
    return () => window.removeEventListener('languageChange', handleLanguageChange);
  }, []);

  const changeLanguage = (lang) => {
    setLanguage(lang);
    localStorage.setItem('preferredLanguage', lang);
    window.dispatchEvent(new CustomEvent('languageChange', { detail: lang }));
  };

  const t = (product) => {
    if (typeof product === 'object' && product !== null) {
      return (language === 'ml' && product.name_ml) ? product.name_ml : product.name;
    }
    return product;
  };

  // THIS IS THE CRITICAL PART - MAKE SURE IT MATCHES EXACTLY:
  return (
    <LanguageContext.Provider value={{ 
      language, 
      changeLanguage, 
      t,
      isMalayalam: language === 'ml'
    }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);