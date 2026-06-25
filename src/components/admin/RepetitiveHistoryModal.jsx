import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { X, Calendar as CalendarIcon, Users, CheckCircle2 } from 'lucide-react';

export const RepetitiveHistoryModal = ({ flow, onClose }) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, [date, flow.id]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('crm_repetitive_history')
        .select(`
          category,
          worker_id,
          profiles:worker_id (name, email)
        `)
        .eq('repetitive_flow_id', flow.id)
        .eq('completed_date', date);

      if (error) throw error;
      setHistory(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Aggregate stats
  const totalCompleted = history.length;
  
  const categoryStats = history.reduce((acc, row) => {
    acc[row.category] = (acc[row.category] || 0) + 1;
    return acc;
  }, {});

  const workerStats = history.reduce((acc, row) => {
    const workerName = row.profiles?.name || row.profiles?.email || 'Unknown';
    if (!acc[workerName]) acc[workerName] = { total: 0, categories: {} };
    acc[workerName].total += 1;
    acc[workerName].categories[row.category] = (acc[workerName].categories[row.category] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <CalendarIcon className="text-emerald-600" />
            Istoric: {flow.name}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 bg-white p-1 rounded-full shadow-sm">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 flex flex-col gap-6">
          
          {/* Controls */}
          <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <label className="font-bold text-slate-700">Alege Data:</label>
            <input 
              type="date" 
              value={date} 
              onChange={e => setDate(e.target.value)}
              className="p-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700"
            />
          </div>

          {loading ? (
            <div className="text-center py-8 font-bold text-slate-500">Se încarcă datele...</div>
          ) : totalCompleted === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
              <CheckCircle2 size={48} className="mx-auto text-slate-300 mb-4" />
              <p className="font-bold text-slate-500 text-lg">Nu există activitate pentru data selectată.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Overall Category Breakdown */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-slate-700 border-b border-slate-100 pb-2 mb-4">Total Sarcini Finalizate: {totalCompleted}</h3>
                <div className="flex flex-col gap-3">
                  {Object.entries(categoryStats).map(([cat, count]) => (
                    <div key={cat} className="flex justify-between items-center text-sm">
                      <span className="font-bold text-slate-600">{cat}</span>
                      <span className="bg-slate-100 px-3 py-1 rounded-full font-bold text-slate-700">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Worker Breakdown */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-slate-700 border-b border-slate-100 pb-2 mb-4 flex items-center gap-2">
                  <Users size={18} className="text-slate-400" /> Performanță Operatori
                </h3>
                <div className="flex flex-col gap-4">
                  {Object.entries(workerStats).map(([worker, stats]) => (
                    <div key={worker} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                      <div className="font-bold text-indigo-700 mb-2 flex justify-between">
                        <span>{worker}</span>
                        <span>Total: {stats.total}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(stats.categories).map(([cat, count]) => (
                          <span key={cat} className="text-xs bg-white border border-slate-200 px-2 py-1 rounded text-slate-600 font-semibold">
                            {cat}: <span className="text-slate-800">{count}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
};
