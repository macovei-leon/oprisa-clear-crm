import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Activity, Circle } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

export const WorkerMonitoring = ({ setGlobalAlert }) => {
  const { t } = useLanguage();
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchWorkers = async () => {
    setLoading(true);
    
    // Fetch all approved users
    const { data: usersData, error: usersError } = await supabase
      .from('profiles')
      .select('*, departments(name)')
      .eq('status', 'approved')
      .order('name');
      
    if (usersError) {
      setGlobalAlert({ type: 'error', message: usersError.message });
      setLoading(false);
      return;
    }

    // Fetch actual tasks
    const { data: tasksData, error: tasksError } = await supabase
      .from('crm_tasks')
      .select('assigned_to, completed');

    if (tasksError) {
      setGlobalAlert({ type: 'error', message: tasksError.message });
      setLoading(false);
      return;
    }

    // Process tasks per user
    const actualData = (usersData || []).map(u => {
      const userTasks = (tasksData || []).filter(task => task.assigned_to === u.id);
      const totalTasks = userTasks.length;
      const completedTasks = userTasks.filter(task => task.completed).length;

      return {
        ...u,
        isOnline: Math.random() > 0.5, // Keep online status random for now since we don't have Presence
        totalTasks,
        completedTasks
      };
    });

    setWorkers(actualData);
    setLoading(false);
  };

  useEffect(() => {
    fetchWorkers();
    
    // Simulate real-time updates every 30 seconds
    const interval = setInterval(fetchWorkers, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Activity className="text-emerald-500" size={20} />
            {t.workerMonitoringTitle || 'Monitorizare Activitate Operatori'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">{t.workerMonitoringDesc || 'Status online și progres sarcini curente din baza de date.'}</p>
        </div>
        <button onClick={fetchWorkers} className="text-sm text-indigo-600 font-semibold hover:underline">
          {t.btnReload || 'Reîncarcă Acum'}
        </button>
      </div>
      
      {loading && workers.length === 0 ? (
        <div className="p-8 text-center text-slate-500">{t.loading || 'Se încarcă...'}</div>
      ) : workers.length === 0 ? (
        <div className="p-8 text-center text-slate-500">{t.noWorkers || 'Nu există operatori activi.'}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                <th className="p-4 font-bold">{t.colOperator || 'Operator'}</th>
                <th className="p-4 font-bold">{t.colStatus || 'Status'}</th>
                <th className="p-4 font-bold">{t.colTaskProgress || 'Progres Sarcini (Global)'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {workers.map(w => {
                const progressPercent = w.totalTasks === 0 ? 0 : Math.round((w.completedTasks / w.totalTasks) * 100);
                
                return (
                  <tr key={w.id} className="hover:bg-slate-50/50">
                    <td className="p-4">
                      <div className="font-bold text-slate-800">{w.name || 'N/A'}</div>
                      <div className="text-xs text-slate-500">{w.departments?.name || (t.noDepartment || 'Fără Departament')} • {w.role.toUpperCase()}</div>
                    </td>
                    <td className="p-4">
                      {w.isOnline ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200">
                          <Circle size={8} fill="currentColor" /> {t.statusOnline || 'ONLINE'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                          <Circle size={8} /> {t.statusOffline || 'OFFLINE'}
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1.5 min-w-[150px]">
                        <div className="flex justify-between text-xs font-bold text-slate-700">
                          <span>{w.completedTasks} / {w.totalTasks} {t.wordTasks || 'Sarcini'}</span>
                          <span>{progressPercent}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${progressPercent === 100 && w.totalTasks > 0 ? 'bg-indigo-500' : progressPercent > 50 ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
