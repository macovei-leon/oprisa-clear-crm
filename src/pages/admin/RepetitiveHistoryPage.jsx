import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { MainLayout } from '../../components/layout/MainLayout';
import { Calendar as CalendarIcon, Users, Activity, BarChart, CheckCircle2 } from 'lucide-react';

export const RepetitiveHistoryPage = () => {
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [flows, setFlows] = useState([]);
  const [selectedFlowId, setSelectedFlowId] = useState('all');

  useEffect(() => {
    fetchFlows();
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [selectedDate, selectedFlowId]);

  const fetchFlows = async () => {
    try {
      const { data, error } = await supabase.from('crm_repetitive_flows').select('id, name').order('created_at', { ascending: false });
      if (error) throw error;
      setFlows(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchHistory = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('crm_repetitive_history')
        .select(`
          id,
          category,
          completed_date,
          worker_id,
          profiles:worker_id ( id, name, email ),
          flow:repetitive_flow_id ( id, name )
        `)
        .eq('completed_date', selectedDate);
        
      if (selectedFlowId !== 'all') {
        query = query.eq('repetitive_flow_id', selectedFlowId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setHistoryData(data || []);
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setLoading(false);
    }
  };

  // Group data by worker
  const statsByWorker = useMemo(() => {
    const map = {};
    historyData.forEach(item => {
      const wId = item.worker_id;
      const wName = item.profiles?.name || item.profiles?.email || 'Nevalabil';
      const cat = item.category || 'Fără Categorie';
      
      if (!map[wId]) {
        map[wId] = {
          name: wName,
          total: 0,
          categories: {}
        };
      }
      map[wId].total += 1;
      map[wId].categories[cat] = (map[wId].categories[cat] || 0) + 1;
    });
    
    // Sort by total descending
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [historyData]);

  // Aggregate global categories
  const globalCategories = useMemo(() => {
    const map = {};
    historyData.forEach(item => {
      const cat = item.category || 'Fără Categorie';
      map[cat] = (map[cat] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [historyData]);

  return (
    <MainLayout title="Istoric Fluxuri Repetitive" subtitle="Monitorizare activitate pe zile pentru echipele call-center">
      
      {/* Controls */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8 flex flex-col sm:flex-row gap-6 items-center justify-between">
        
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="flex flex-col">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Alege Data</label>
            <div className="relative">
              <input 
                type="date" 
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-bold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
              <CalendarIcon size={18} className="absolute left-3 top-2.5 text-slate-400" />
            </div>
          </div>
          
          <div className="flex flex-col">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Filtru Flux</label>
            <select 
              value={selectedFlowId}
              onChange={e => setSelectedFlowId(e.target.value)}
              className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-bold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all min-w-[200px]"
            >
              <option value="all">Toate Fluxurile</option>
              {flows.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-indigo-50 p-4 rounded-xl flex items-center gap-4 border border-indigo-100 min-w-[200px] justify-center">
          <Activity size={24} className="text-indigo-600" />
          <div>
            <div className="text-sm font-bold text-indigo-900">Total Apeluri/Sarcini</div>
            <div className="text-2xl font-black text-indigo-700">{historyData.length}</div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-500 font-bold text-lg animate-pulse">Se încarcă datele istorice...</div>
      ) : historyData.length === 0 ? (
        <div className="bg-white p-16 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4 text-slate-400">
            <CalendarIcon size={32} />
          </div>
          <h3 className="text-xl font-bold text-slate-700 mb-2">Nicio activitate înregistrată</h3>
          <p className="text-slate-500 max-w-md">Nu au fost finalizate sarcini repetitive în ziua de <span className="font-bold text-slate-700">{selectedDate}</span>. Încearcă să selectezi o altă dată sau un alt flux.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main List: Workers */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 mb-2">
              <Users size={20} className="text-indigo-600" /> Performanță Operatori
            </h3>
            
            {statsByWorker.map(worker => (
              <div key={worker.name} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
                <div>
                  <h4 className="text-lg font-bold text-slate-800 mb-1">{worker.name}</h4>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 font-bold rounded-lg text-sm border border-emerald-200">
                    <CheckCircle2 size={16} /> Total finalizate: {worker.total}
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2 md:justify-end flex-1">
                  {Object.entries(worker.categories).map(([cat, count]) => (
                    <div key={cat} className="flex flex-col items-center justify-center bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl min-w-[80px]">
                      <span className="text-xs font-bold text-slate-400 uppercase text-center mb-1 line-clamp-1">{cat}</span>
                      <span className="font-black text-slate-700 text-lg">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Right Column: Global Stats */}
          <div className="flex flex-col gap-4">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 mb-2">
              <BarChart size={20} className="text-amber-600" /> Rezultate Globale
            </h3>
            
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex flex-col gap-4">
                {globalCategories.map(([cat, count]) => {
                  const percent = Math.round((count / historyData.length) * 100);
                  return (
                    <div key={cat}>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-sm font-bold text-slate-700">{cat}</span>
                        <span className="text-sm font-black text-slate-900">{count} <span className="text-xs text-slate-400 font-bold">({percent}%)</span></span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div className="bg-amber-500 h-full rounded-full" style={{ width: `${percent}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          
        </div>
      )}
    </MainLayout>
  );
};
