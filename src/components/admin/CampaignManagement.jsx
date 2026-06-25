import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Target, Trash2, Archive, RefreshCw, AlertTriangle, Calendar, Edit } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { RepetitiveHistoryModal } from './RepetitiveHistoryModal';
import { CampaignBuilderModal } from '../campaigns/CampaignBuilderModal';

export const CampaignManagement = ({ filterType, isRepetitive, setGlobalAlert }) => {
  const { t } = useLanguage();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historyFlow, setHistoryFlow] = useState(null);
  const [editingItem, setEditingItem] = useState(null);

  const fetchCampaigns = async () => {
    setLoading(true);
    
    const table = isRepetitive ? 'crm_repetitive_flows' : 'crm_campaigns';
    const isActive = filterType === 'active';

    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('is_active', isActive)
      .order('created_at', { ascending: false });
      
    if (error) setGlobalAlert({ type: 'error', message: error.message });
    else setItems(data || []);

    setLoading(false);
  };

  useEffect(() => {
    fetchCampaigns();
  }, [filterType, isRepetitive]);

  const handleArchive = async (id) => {
    if (!confirm(t.confirmArchive || 'Ești sigur că vrei să arhivezi?')) return;
    
    const table = isRepetitive ? 'crm_repetitive_flows' : 'crm_campaigns';
    const { error } = await supabase
      .from(table)
      .update({ is_active: false })
      .eq('id', id);
      
    if (error) {
      setGlobalAlert({ type: 'error', message: error.message });
    } else {
      setGlobalAlert({ type: 'success', message: t.msgArchived || `Arhivată cu succes.` });
      fetchCampaigns();
    }
  };

  const handleRestore = async (id) => {
    const table = isRepetitive ? 'crm_repetitive_flows' : 'crm_campaigns';
    const { error } = await supabase
      .from(table)
      .update({ is_active: true })
      .eq('id', id);
      
    if (error) {
      setGlobalAlert({ type: 'error', message: error.message });
    } else {
      setGlobalAlert({ type: 'success', message: t.msgRestored || `Restaurată cu succes.` });
      fetchCampaigns();
    }
  };

  const handleDeletePermanently = async (id) => {
    if (!confirm(t.confirmDelete || 'ATENȚIE! Ești sigur că vrei să ștergi DEFINITIV? Toate datele vor fi pierdute iremediabil.')) return;
    
    const table = isRepetitive ? 'crm_repetitive_flows' : 'crm_campaigns';
    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', id);
      
    if (error) {
      setGlobalAlert({ type: 'error', message: error.message });
    } else {
      setGlobalAlert({ type: 'success', message: t.msgDeleted || `Ștearsă definitiv.` });
      fetchCampaigns();
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
      <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Target className="text-rose-600" size={20} />
            Management {isRepetitive ? 'Fluxuri Repetitive' : 'Campanii Standard'} ({filterType === 'active' ? 'Active' : 'Arhivate'})
          </h2>
          <p className="text-xs text-slate-500 mt-1">{t.campaignsDesc || 'Gestionează campaniile. Crearea se face doar din panoul Baze de Date.'}</p>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-500">{t.loading || 'Se încarcă...'}</div>
      ) : filterType === 'active' ? (
        <div className="overflow-x-auto">
          {items.length === 0 ? (
            <div className="p-8 text-center text-slate-500">Nu există date active.</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                  <th className="p-4 font-bold">Informații</th>
                  <th className="p-4 font-bold w-48 text-right">Acțiuni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50/50">
                    <td className="p-4">
                      <div className="font-bold text-slate-800">{c.name}</div>
                      <div className="text-xs text-slate-500 mt-1 max-w-md truncate">{c.description || (t.noDescription || 'Fără descriere')}</div>
                      {isRepetitive && (
                        <div className="mt-1 text-xs font-bold text-emerald-600">Interval resetare: {c.reset_interval_hours || 24} ore</div>
                      )}
                    </td>
                    <td className="p-4 text-right flex justify-end gap-2">
                      {isRepetitive && (
                        <button 
                          onClick={() => setHistoryFlow(c)}
                          className="px-3 py-1.5 text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 rounded flex items-center gap-1 transition-colors"
                        >
                          <Calendar size={14} /> Istoric
                        </button>
                      )}
                      <button 
                        onClick={() => setEditingItem(c)}
                        className="px-3 py-1.5 text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 rounded flex items-center gap-1 transition-colors"
                        title="Editează"
                      >
                        <Edit size={14} /> Editează
                      </button>
                      <button 
                        onClick={() => handleArchive(c.id)}
                        className="px-3 py-1.5 text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 rounded flex items-center gap-1 transition-colors"
                        title={t.btnArchive || "Arhivează"}
                      >
                        <Archive size={14} /> {t.btnArchive || 'Arhivează'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto bg-slate-50/50 min-h-[300px]">
          {items.length === 0 ? (
            <div className="p-8 text-center text-slate-500">Nu există date arhivate.</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                  <th className="p-4 font-bold">Informații</th>
                  <th className="p-4 font-bold w-48 text-right">Acțiuni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.map(c => (
                  <tr key={c.id} className="hover:bg-slate-100/50">
                    <td className="p-4">
                      <div className="font-bold text-slate-700">{c.name}</div>
                      <div className="text-xs text-slate-400 mt-1 max-w-md truncate">{c.description || (t.noDescription || 'Fără descriere')}</div>
                    </td>
                    <td className="p-4 text-right flex justify-end gap-2">
                      <button 
                        onClick={() => handleRestore(c.id)}
                        className="px-3 py-1.5 text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 rounded flex items-center gap-1 transition-colors"
                        title={t.btnRestore || "Restaurează"}
                      >
                        <RefreshCw size={14} /> {t.btnRestore || 'Restaurează'}
                      </button>
                      <button 
                        onClick={() => handleDeletePermanently(c.id)}
                        className="px-3 py-1.5 text-xs font-bold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 rounded flex items-center gap-1 transition-colors"
                        title={t.btnDeletePerm || "Șterge Definitiv"}
                      >
                        <Trash2 size={14} /> {t.btnDeletePerm || 'Șterge'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      
      {historyFlow && (
        <RepetitiveHistoryModal flow={historyFlow} onClose={() => setHistoryFlow(null)} />
      )}
      
      {editingItem && (
        <CampaignBuilderModal 
          isOpen={!!editingItem} 
          onClose={() => { setEditingItem(null); fetchCampaigns(); }} 
          initialData={editingItem} 
          isRepetitive={isRepetitive} 
        />
      )}
    </div>
  );
};
