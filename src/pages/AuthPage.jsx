import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { LanguageSwitcher, Alert } from '../components/auth/Shared';
import { Bolt, Clock, MailOpen, ChevronDown, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

export const AuthPage = ({ forceView }) => {
  const { t } = useLanguage();
  const { signIn, signUp, resetPassword, updatePassword, signOut } = useAuth();
  
  const [view, setView] = useState(forceView || 'login'); // login, signup, forgot-password, reset-password, check-email, pending
  const [alert, setAlert] = useState({ message: '', type: '' });
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    if (forceView) setView(forceView);
  }, [forceView]);

  useEffect(() => {
    // Check for recovery token
    if (window.location.hash.includes('type=recovery')) {
      setView('reset-password');
    }
  }, []);

  useEffect(() => {
    if (view === 'signup' && departments.length === 0) {
      supabase.from('departments').select('*').order('name').then(({ data }) => {
        if (data) setDepartments(data);
      });
    }
  }, [view]);

  const showAlert = (message, type) => setAlert({ message, type });

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setAlert({ message: '', type: '' });
    const { error } = await signIn(e.target.email.value, e.target.password.value);
    if (error) {
      showAlert(error.message === 'Invalid login credentials' ? 'Credențiale incorecte.' : error.message, 'error');
    }
    setLoading(false);
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setAlert({ message: '', type: '' });
    const name = e.target.name.value;
    const email = e.target.email.value;
    const password = e.target.password.value;
    const passwordRepeat = e.target.passwordRepeat.value;
    const department_id = e.target.department.value;

    if (!department_id) return showAlert('Te rugăm să selectezi un departament.', 'warning');
    if (password !== passwordRepeat) return showAlert('Parolele nu se potrivesc.', 'warning');

    setLoading(true);
    const { data, error } = await signUp(email, password, name, department_id);
    setLoading(false);

    if (error) return showAlert(error.message, 'error');

    if (data?.user && !data?.session) {
      setView('check-email');
    }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await resetPassword(e.target.email.value);
    setLoading(false);
    if (error) return showAlert(error.message, 'error');
    showAlert('Linkul a fost trimis! Verifică-ți adresa de email.', 'info');
  };

  const handleReset = async (e) => {
    e.preventDefault();
    const password = e.target.password.value;
    const repeat = e.target.passwordRepeat.value;
    if (password !== repeat) return showAlert('Parolele nu se potrivesc.', 'warning');
    
    setLoading(true);
    const { error } = await updatePassword(password);
    setLoading(false);
    
    if (error) return showAlert(error.message, 'error');
    showAlert('Parola a fost actualizată!', 'success');
    setTimeout(() => {
      window.location.hash = '';
      setView('login');
    }, 2000);
  };

  return (
    <>
      <div className="orb orb-1"></div>
      <div className="orb orb-2"></div>
      <div className="orb orb-3"></div>

      <div className="min-h-screen flex items-center justify-center w-full relative z-10 p-4">
        <div className="auth-container">
          <LanguageSwitcher />

          {/* Logo & Header */}
          <div className="mb-8 relative z-20">
            <div className="w-16 h-16 mx-auto bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-6 transform hover:scale-105 transition-transform duration-300">
              <Bolt className="text-white" size={36} />
            </div>
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight mb-2">Oprisa OPS</h1>
            <p className="text-slate-500 font-medium">Autentificare necesară</p>
          </div>

          <Alert message={alert?.message} type={alert?.type} />

          {/* Forms */}
          {view === 'login' && (
            <form onSubmit={handleLogin} className="text-left w-full">
              <div className="mb-4">
                <label className="block text-sm font-bold text-slate-800 mb-2">{t.lblEmail}</label>
                <input name="email" type="email" required placeholder="nume@oprisa.de" className="w-full p-3 border border-slate-300 bg-white/90 rounded-lg text-slate-900 text-base shadow-sm focus:outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/20 transition-all" />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-bold text-slate-800 mb-2">{t.lblPass}</label>
                <input name="password" type="password" required placeholder="••••••••" className="w-full p-3 border border-slate-300 bg-white/90 rounded-lg text-slate-900 text-base shadow-sm focus:outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/20 transition-all" />
              </div>
              <button type="submit" disabled={loading} className="auth-btn w-full p-3 text-white font-bold text-base rounded-lg">
                {loading ? 'Se conectează...' : t.btnLogin}
              </button>
              
              <div className="mt-6 flex flex-col items-center gap-4 text-sm text-slate-600">
                <a onClick={() => setView('forgot-password')} className="text-indigo-600 font-bold cursor-pointer hover:underline">{t.linkForgotPass}</a>
                <div>
                  <span>{t.txtNoAccount}</span> <a onClick={() => setView('signup')} className="text-indigo-600 font-bold cursor-pointer hover:underline">{t.linkSignup}</a>
                </div>
              </div>
            </form>
          )}

          {view === 'signup' && (
            <form onSubmit={handleSignup} className="text-left w-full grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1 mb-2">
                <label className="block text-sm font-bold text-slate-800 mb-2">{t.lblName}</label>
                <input name="name" type="text" required placeholder={t.lblName} className="w-full p-3 border border-slate-300 bg-white/90 rounded-lg text-slate-900 text-base shadow-sm focus:outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/20 transition-all" />
              </div>
              <div className="col-span-2 sm:col-span-1 mb-2">
                <label className="block text-sm font-bold text-slate-800 mb-2">{t.lblEmail}</label>
                <input name="email" type="email" required placeholder="nume@oprisa.de" className="w-full p-3 border border-slate-300 bg-white/90 rounded-lg text-slate-900 text-base shadow-sm focus:outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/20 transition-all" />
              </div>
              <div className="col-span-2 mb-2 relative">
                <label className="block text-sm font-bold text-slate-800 mb-2">{t.lblDepartment}</label>
                <select name="department" required className="w-full p-3 border border-slate-300 bg-white/90 rounded-lg text-slate-900 text-base shadow-sm focus:outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/20 transition-all appearance-none">
                  <option value="" disabled selected>Selectează departamentul</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <ChevronDown className="absolute right-4 top-[38px] text-slate-500 pointer-events-none" size={20} />
              </div>
              <div className="col-span-2 sm:col-span-1 mb-2">
                <label className="block text-sm font-bold text-slate-800 mb-2">{t.lblPass}</label>
                <input name="password" type="password" required minLength={6} placeholder="Minim 6 caractere" className="w-full p-3 border border-slate-300 bg-white/90 rounded-lg text-slate-900 text-base shadow-sm focus:outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/20 transition-all" />
              </div>
              <div className="col-span-2 sm:col-span-1 mb-2">
                <label className="block text-sm font-bold text-slate-800 mb-2">{t.lblPassRepeat}</label>
                <input name="passwordRepeat" type="password" required minLength={6} placeholder="Minim 6 caractere" className="w-full p-3 border border-slate-300 bg-white/90 rounded-lg text-slate-900 text-base shadow-sm focus:outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/20 transition-all" />
              </div>
              <div className="col-span-2 mt-2">
                <button type="submit" disabled={loading} className="auth-btn w-full p-3 text-white font-bold text-base rounded-lg">
                  {loading ? 'Se creează...' : t.btnSignup}
                </button>
              </div>
              <div className="col-span-2 mt-4 text-sm text-slate-600 text-center">
                <span>{t.txtHasAccount}</span> <a onClick={() => setView('login')} className="text-indigo-600 font-bold cursor-pointer hover:underline">{t.linkLogin}</a>
              </div>
            </form>
          )}

          {view === 'forgot-password' && (
            <form onSubmit={handleResetPassword} className="text-left w-full">
              <div className="mb-6">
                <label className="block text-sm font-bold text-slate-800 mb-2">{t.lblEmail}</label>
                <input name="email" type="email" required placeholder="nume@oprisa.de" className="w-full p-3 border border-slate-300 bg-white/90 rounded-lg text-slate-900 text-base shadow-sm focus:outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/20 transition-all" />
              </div>
              <button type="submit" disabled={loading} className="auth-btn w-full p-3 text-white font-bold text-base rounded-lg">
                {loading ? 'Se trimite...' : t.btnResetPass}
              </button>
              <div className="mt-6 text-sm text-slate-600 text-center">
                <a onClick={() => setView('login')} className="text-indigo-600 font-bold cursor-pointer hover:underline">{t.linkBackToLogin}</a>
              </div>
            </form>
          )}

          {view === 'reset-password' && (
            <form onSubmit={handleUpdatePassword} className="text-left w-full">
              <div className="mb-4">
                <label className="block text-sm font-bold text-slate-800 mb-2">Parolă nouă</label>
                <input name="password" type="password" required minLength={6} placeholder="Minim 6 caractere" className="w-full p-3 border border-slate-300 bg-white/90 rounded-lg text-slate-900 text-base shadow-sm focus:outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/20 transition-all" />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-bold text-slate-800 mb-2">Confirmă parolă nouă</label>
                <input name="passwordRepeat" type="password" required minLength={6} placeholder="Minim 6 caractere" className="w-full p-3 border border-slate-300 bg-white/90 rounded-lg text-slate-900 text-base shadow-sm focus:outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/20 transition-all" />
              </div>
              <button type="submit" disabled={loading} className="auth-btn w-full p-3 text-white font-bold text-base rounded-lg">
                {loading ? 'Se actualizează...' : 'Actualizează Parola'}
              </button>
            </form>
          )}

          {view === 'check-email' && (
            <div className="text-center w-full">
              <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-4">
                <CheckCircle size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Verifică-ți emailul</h3>
              <p className="text-slate-600 mb-6">Am trimis un link de confirmare către adresa ta de email. Te rugăm să îl accesezi pentru a continua.</p>
              <button onClick={() => setView('login')} className="text-indigo-600 font-bold hover:underline">
                Înapoi la autentificare
              </button>
            </div>
          )}

          {view === 'pending' && (
            <div className="text-center w-full">
              <div className="w-16 h-16 mx-auto bg-amber-100 rounded-full flex items-center justify-center text-amber-600 mb-4">
                <Clock size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Cont în așteptare</h3>
              <p className="text-slate-600 mb-6">Contul tău a fost creat și este în curs de aprobare de către un administrator. Vei putea accesa platforma în curând.</p>
              <button onClick={() => { signOut(); setView('login'); }} className="text-indigo-600 font-bold hover:underline">
                Deconectare
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
