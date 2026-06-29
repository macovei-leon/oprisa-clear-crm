import React, { createContext, useContext, useState, useEffect } from 'react';

const LanguageContext = createContext();

import translations from '../translations.json';

export const LanguageProvider = ({ children }) => {
  const [lang, setLang] = useState('ro');

  useEffect(() => {
    const savedLang = localStorage.getItem('app_lang');
    if (savedLang && ['ro', 'en'].includes(savedLang)) {
      setLang(savedLang);
    }
  }, []);

  const changeLanguage = (newLang) => {
    setLang(newLang);
    localStorage.setItem('app_lang', newLang);
  };

  const t = translations[lang];

  return (
    <LanguageContext.Provider value={{ lang, changeLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
