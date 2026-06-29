import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { X, Users, Activity, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

export const AppendToCampaignModal = ({ isOpen, onClose, onSuccess, selectedRowsData = [], tableName = '', isRepetitive = false }) => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  
  const [workers, setWorkers] = useState([]);
  const [workerSplits, setWorkerSplits] = useState([]);

  useEffect(() => {
    if (isOpen) {
      fetchCampaigns();
      fetchWorkers();
    }
  }, [isOpen, isRepetitive]);

  const fetchCampaigns = async () => {
    const table = isRepetitive ? 'crm_repetitive_flows' : 'crm_campaigns';
    const { data } = await supabase
      .from(table)
      .select('id, name')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    setCampaigns(data || []);
    if (data && data.length > 0) setSelectedCampaignId(data[0].id);
  };

  const fetchWorkers = async () => {
    const { data: activeWorkers } = await supabase
      .from('profiles')
      .select('id, name, email, role, status')
      .in('status', ['approved'])
      .order('name');
      
    const workersList = activeWorkers || [];
    setWorkers(workersList);
    setWorkerSplits(workersList.map(w => ({ id: w.id, count: 0 })));
  };

  const handleSplitChange = (workerId, value) => {
    const num = parseInt(value) || 0;
    setWorkerSplits(prev => prev.map(s => s.id === workerId ? { ...s, count: num } : s));
  };

  const distributeEvenly = () => {
    const total = selectedRowsData.length;
    if (total === 0 || workers.length === 0) return;
    
    const base = Math.floor(total / workers.length);
    const remainder = total % workers.length;
    
    setWorkerSplits(workers.map((w, idx) => ({
      id: w.id,
      count: base + (idx < remainder ? 1 : 0)
    })));
  };

  const totalAssigned = workerSplits.reduce((sum, split) => sum + split.count, 0);

  const appendToCampaign = async () => {
    if (totalAssigned !== selectedRowsData.length) {
      return alert((t.errDistributeExact || "Trebuie să distribuiți exact {total} rânduri. Momentan ați distribuit {assigned}.").replace("{total}", selectedRowsData.length).replace("{assigned}", totalAssigned));
    }
    
    if (!selectedCampaignId) {
      return alert(t.errSelectDestCamp || "Vă rugăm să selectați o campanie destinație.");
    }

    setLoading(true);
    try {
      // Create assignment array
      const assignments = [];
      workerSplits.forEach(split => {
        for (let i = 0; i < split.count; i++) {
          assignments.push(split.id);
        }
      });
      
      // Shuffle assignments to distribute rows randomly
      for (let i = assignments.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [assignments[i], assignments[j]] = [assignments[j], assignments[i]];
      }

      const tasksToInsert = selectedRowsData.map((row, idx) => ({
        [isRepetitive ? 'repetitive_flow_id' : 'campaign_id']: selectedCampaignId,
        row_data: row,
        assigned_to: assignments[idx],
        active_step_idx: 0,
        completed: false
      }));

      const tableTasks = isRepetitive ? 'crm_repetitive_tasks' : 'crm_tasks';

      // Insert in batches
      for (let i = 0; i < tasksToInsert.length; i += 500) {
        const batch = tasksToInsert.slice(i, i + 500);
        const { error: taskErr } = await supabase.from(tableTasks).insert(batch);
        if (taskErr) throw taskErr;
      }

      // Mark the rows as processed in the original custom table
      const rowIds = selectedRowsData.map(r => r.id).filter(Boolean);
      if (rowIds.length > 0) {
        for (let i = 0; i < rowIds.length; i += 500) {
          const batchIds = rowIds.slice(i, i + 500);
          const { error: markErr } = await supabase
            .from(tableName)
            .update({ crm_processed: true })
            .in('id', batchIds);
          if (markErr) console.error((t.errMarkProcessed || "Eroare la marcarea rândurilor ca procesate:") + " ", markErr);
        }
      }

      alert(t.msgRowsAddedSucc || "Rândurile au fost adăugate cu succes la campania existentă!");
      if (onSuccess) onSuccess();
      else onClose();
    } catch (err) {
      console.error(err);
      alert((t.errOperation || "Eroare la operare: ") + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center shadow-sm">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                Adaugă la {isRepetitive ? (t.titleAppendFlow || 'Flux Repetitiv') : (t.titleAppendCamp || 'Campanie Sarcini')} Existent
              </h2>
              <p className="text-sm text-slate-500 font-medium"> {(t.lblDistributeRows || 'Distribuie {count} rânduri noi.').split('{count}').map((part, i) => i === 0 ? part : <React.Fragment key={i}><strong>{selectedRowsData.length}</strong>{part}</React.Fragment>)}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-slate-200 rounded-full">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex flex-col gap-8 bg-slate-50/50">
          
          {/* Select Campaign */}
          <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-4">{t.lblSelectDest || '1. Selectează Destinația'}</h3>
            {campaigns.length === 0 ? (
              <p className="text-amber-600 font-semibold bg-amber-50 p-4 rounded-lg">{t.msgNoActiveCamps || 'Nu există campanii active.'}</p>
            ) : (
              <select 
                value={selectedCampaignId}
                onChange={e => setSelectedCampaignId(e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-700 font-medium"
              >
                <option value="" disabled>{t.phChooseCamp || 'Alege o campanie...'}</option>
                {campaigns.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Worker Distribution */}
          <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm">
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <div className="bg-indigo-100 p-2 rounded-lg text-indigo-700"><Users size={20} /></div>
                <h3 className="text-lg font-bold text-slate-800">{t.lblDistribNew || '2. Distribuire Sarcini Noi'}</h3>
              </div>
              <button 
                onClick={distributeEvenly}
                className="px-4 py-2 bg-indigo-50 text-indigo-700 font-bold rounded-lg hover:bg-indigo-100 transition-colors border border-indigo-200 text-sm"
              >
                Distribuie în mod egal
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {workers.map(worker => {
                const split = workerSplits.find(s => s.id === worker.id);
                return (
                  <div key={worker.id} className="p-4 border border-slate-200 rounded-xl bg-slate-50 flex flex-col justify-between hover:border-indigo-300 transition-colors">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-white border border-slate-200 rounded-full flex items-center justify-center font-bold text-slate-600 shadow-sm">
                        {worker.name.charAt(0)}
                      </div>
                      <div className="truncate">
                        <p className="font-bold text-slate-800 text-sm truncate">{worker.name}</p>
                        <p className="text-xs text-slate-500 truncate">{worker.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm">
                      <span className="text-xs font-bold text-slate-400 uppercase">{t.lblTasksColon || 'Sarcini:'}</span>
                      <input 
                        type="number"
                        min="0"
                        value={split?.count || 0}
                        onChange={e => handleSplitChange(worker.id, e.target.value)}
                        className="w-20 text-center font-bold text-slate-700 focus:outline-none focus:text-indigo-600 bg-transparent"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className={`mt-6 p-4 rounded-xl flex justify-between items-center border shadow-sm ${totalAssigned === selectedRowsData.length ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
              <div className="flex items-center gap-3">
                <Activity size={24} className={totalAssigned === selectedRowsData.length ? "text-emerald-500" : "text-rose-500"} />
                <div>
                  <p className="font-bold">{t.lblDistribProgress || 'Progres Distribuire Sarcini'}</p>
                  <p className="text-sm opacity-80"> {(t.lblSelectedRowsCount || 'Rânduri selectate: {count}').replace('{count}', selectedRowsData.length)}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-3xl font-black">{totalAssigned}</span>
                <span className="text-sm font-bold opacity-70"> / {selectedRowsData.length}</span>
              </div>
            </div>
          </div>
          
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 bg-slate-50 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-colors">
            Anulează
          </button>
          <button 
            onClick={appendToCampaign}
            disabled={loading || totalAssigned !== selectedRowsData.length || !selectedCampaignId}
            className="px-8 py-2.5 bg-amber-600 text-white font-bold rounded-xl hover:bg-amber-700 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? t.btnSavingDistrib || 'Se salvează...' : t.btnSaveAndDistrib || 'Salvează și Distribuie'}
          </button>
        </div>
      </div>
    </div>
  );
};
