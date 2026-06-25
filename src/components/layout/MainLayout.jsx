import React from 'react';
import { Sidebar } from './Sidebar';
import { LanguageSwitcher } from '../auth/Shared';

export const MainLayout = ({ children, title, subtitle }) => {
  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900">
      <Sidebar />
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-8 py-5 flex justify-between items-center shrink-0">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
            {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
          </div>
          <div className="relative">
            {/* The language switcher is absolute by default, let's wrap it nicely or just use the same approach */}
            <div className="relative z-10 w-32 h-10">
                <LanguageSwitcher />
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
          <div className="w-full h-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};
