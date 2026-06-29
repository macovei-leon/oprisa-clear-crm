import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { AlertTriangle, Lock, Loader2, X, Trash2 } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

export const ClearHistoryModal = ({ flowId, onClose, onSuccess }) => {
  const { t } = useLanguage();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleClearHistory = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      // 1. Get current user email
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error(t.errNoUser || 'Nu s-a putut obține utilizatorul curent.');

      // 2. Verify password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: password
      });

      if (signInError) {
        throw new Error(t.errWrongPass || 'Parola este incorectă. Acces interzis.');
      }

      // 3. Password is correct. Proceed to delete history.
      let query = supabase.from('crm_repetitive_history').delete();
      
      if (flowId !== 'all') {
        query = query.eq('repetitive_flow_id', flowId);
      } else {
        // delete all, just adding a dummy condition to satisfy supabase delete rules sometimes requiring a condition
        query = query.neq('id', '00000000-0000-0000-0000-000000000000');
      }

      const { error: deleteError } = await query;
      
      if (deleteError) throw deleteError;

      onSuccess();
      onClose();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200">
        
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-rose-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800">{t.clearHistTitle || 'Curăță Istoricul'}</h2>
              <p className="text-xs font-bold text-slate-500 mt-0.5">{t.clearHistSub || 'Acțiune ireversibilă'}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 bg-white p-2 rounded-full shadow-sm hover:shadow transition-all">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleClearHistory} className="p-6">
          <div className="mb-6">
            <p className="text-sm text-slate-600 mb-4">
              {t.clearHistWarning || 'Ești pe cale să ștergi definitiv istoricul de operare pentru'} 
              <strong className="text-rose-600 mx-1">{flowId === 'all' ? (t.clearHistAll || 'TOATE fluxurile') : (t.clearHistSelected || 'fluxul selectat')}</strong>.
              {t.clearHistConfirm || 'Pentru a confirma această acțiune cu un grad ridicat de risc, te rugăm să introduci parola contului tău de administrator.'}
            </p>

            {errorMsg && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm font-bold rounded-lg flex items-center gap-2">
                <AlertTriangle size={16} />
                {errorMsg}
              </div>
            )}

            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{t.lblAdminPass || 'Parola Administrator'}</label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-bold outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all"
                placeholder={t.phEnterPass || "Introdu parola..."}
              />
              <Lock size={18} className="absolute left-3 top-3 text-slate-400" />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
            >
              {t.btnCancel || 'Anulează'}
            </button>
            <button
              type="submit"
              disabled={loading || !password}
              className="px-6 py-2.5 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
              {t.btnConfirmDel || 'Confirmă ștergerea'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
