import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { supabase } from '../../lib/supabase';

export const LanguageSwitcher = () => {
  const { lang, changeLanguage } = useLanguage();

  return (
    <div className="absolute top-4 right-6 flex bg-white/50 border border-white/50 rounded-full overflow-hidden z-20">
      <button 
        onClick={() => changeLanguage('ro')}
        className={`px-3 py-1.5 text-xs font-semibold flex items-center gap-1 transition-all ${lang === 'ro' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-white/50'}`}
      >
        <span>🇷🇴</span> RO
      </button>
      <button 
        onClick={() => changeLanguage('en')}
        className={`px-3 py-1.5 text-xs font-semibold flex items-center gap-1 transition-all ${lang === 'en' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-white/50'}`}
      >
        <span>🇬🇧</span> EN
      </button>
    </div>
  );
};

export const Alert = ({ message, type }) => {
  if (!message) return null;
  const colors = {
    error: 'bg-red-500/10 text-red-500 border-red-500/20',
    info: 'bg-sky-500/10 text-sky-500 border-sky-500/20',
    warning: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    success: 'bg-green-500/10 text-green-500 border-green-500/20'
  };
  return (
    <div className={`p-3 rounded-md text-sm mb-6 text-left border ${colors[type] || colors.info}`}>
      {message}
    </div>
  );
};
