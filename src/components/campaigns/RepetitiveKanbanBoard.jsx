import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { FlashcardModal } from './FlashcardModal';
import { Activity, Clock, CheckCircle2, FolderClosed, Trash2 } from 'lucide-react';

export const RepetitiveKanbanBoard = ({ flow }) => {
  const { profile } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [activeTabIdx, setActiveTabIdx] = useState(0);
  const [viewMode, setViewMode] = useState('mine'); // 'mine' | 'all'

  const steps = flow?.steps || [];
  
  // Extract all unique categories defined across all steps
  const categories = Array.from(new Set(
    steps.flatMap(s => s.branches.filter(b => b.action.startsWith('category_')).map(b => b.action.replace('category_', '')))
  ));

  const allTabs = [
    ...steps.map(s => ({ type: 'step', name: s.name })),
    ...categories.map(c => ({ type: 'category', name: c }))
  ];

  useEffect(() => {
    if (flow) {
      fetchTasks();
      setActiveTabIdx(0); // Reset tab when flow changes
      
      const intervalId = setInterval(() => {
        fetchTasks(true);
      }, 30000); // Poll every 30 seconds to catch resets automatically
      
      return () => clearInterval(intervalId);
    }
  }, [flow, viewMode]);

  const fetchTasks = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // 1. Reset tasks if needed based on reset interval
      const { error: resetErr } = await supabase.rpc('reset_repetitive_tasks', { p_flow_id: flow.id });
      if (resetErr) {
        console.error('Error resetting repetitive tasks:', resetErr);
      }

      // 2. Fetch tasks
      let query = supabase
        .from('crm_repetitive_tasks')
        .select('*')
        .eq('repetitive_flow_id', flow.id);
        // We fetch ALL tasks including completed ones now, so we can show them in Category tabs

      // If operator and viewMode is 'mine', only see own tasks. Admin sees all.
      if (profile?.role !== 'admin' && viewMode === 'mine') {
        query = query.eq('assigned_to', profile?.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setTasks(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleTaskTransition = async (task, actionLabel, actionType, actionTarget) => {
    try {
      let updatePayload = {};

      if (actionType === 'next') {
        updatePayload = { 
          active_step_idx: task.active_step_idx + 1,
          updated_at: new Date().toISOString()
        };
      } else if (actionType.startsWith('category_')) {
        updatePayload = { 
          completed: true, 
          category: actionType.replace('category_', ''),
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      }

      const { error } = await supabase
        .from('crm_repetitive_tasks')
        .update(updatePayload)
        .eq('id', task.id);

      if (error) throw error;

      if (updatePayload.completed) {
        const { error: histErr } = await supabase
          .from('crm_repetitive_history')
          .insert([{
            repetitive_flow_id: flow.id,
            task_id: task.id,
            worker_id: profile?.id,
            category: updatePayload.category
          }]);
        if (histErr) console.error('Failed to save history', histErr);
      }

      // Update local state to immediately move the card
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...updatePayload } : t));
      
      setSelectedTask(null);
    } catch (err) {
      console.error(err);
      alert('Eroare la actualizarea sarcinii: ' + err.message);
    }
  };

  const handleDeleteTask = async (e, taskId) => {
    e.stopPropagation();
    if (!window.confirm("Ești sigur că vrei să ștergi acest card din acest flux repetitiv? Acțiunea este ireversibilă.")) return;
    try {
      const { error } = await supabase.from('crm_repetitive_tasks').delete().eq('id', taskId);
      if (error) throw error;
      setTasks(prev => prev.filter(t => t.id !== taskId));
    } catch (err) {
      console.error(err);
      alert('Eroare la ștergerea cardului: ' + err.message);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500 font-bold">Se încarcă sarcinile...</div>;
  }

  // Filter tasks for the currently selected tab
  const activeTabConfig = allTabs[activeTabIdx];
  const activeTasks = tasks.filter(t => {
    if (activeTabConfig.type === 'step') {
      return !t.completed && t.active_step_idx === activeTabIdx;
    } else {
      return t.completed && t.category === activeTabConfig.name;
    }
  });

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-200 bg-white shrink-0 shadow-sm z-10 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <FolderClosed className="text-indigo-600" />
            {flow?.name}
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">{flow?.description}</p>
        </div>
        <div className="flex items-center gap-4">
          {profile?.role !== 'admin' && (
            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button 
                onClick={() => setViewMode('mine')}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'mine' ? 'bg-white text-indigo-700 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Atribuite Mie
              </button>
              <button 
                onClick={() => setViewMode('all')}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'all' ? 'bg-white text-indigo-700 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Toate
              </button>
            </div>
          )}
          <div className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl text-sm font-bold border border-indigo-100 flex items-center gap-2">
            <Activity size={16} /> Total Sarcini: {tasks.length}
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="px-6 pt-4 bg-white border-b border-slate-200 shrink-0">
        <div className="flex gap-1 overflow-x-auto pb-px">
          {allTabs.map((tab, idx) => {
            const isStep = tab.type === 'step';
            const stepTasksCount = isStep 
              ? tasks.filter(t => !t.completed && t.active_step_idx === idx).length
              : tasks.filter(t => t.completed && t.category === tab.name).length;
              
            const isActive = activeTabIdx === idx;
            
            return (
              <button
                key={idx}
                onClick={() => setActiveTabIdx(idx)}
                className={`
                  flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all whitespace-nowrap
                  ${isActive 
                    ? (isStep ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50' : 'border-emerald-600 text-emerald-700 bg-emerald-50/50')
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}
                `}
              >
                {isStep ? (
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${isActive ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                    {idx + 1}
                  </div>
                ) : (
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${isActive ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                    <FolderClosed size={12} />
                  </div>
                )}
                {isStep ? tab.name : `Categ: ${tab.name}`}
                <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] ${isActive ? (isStep ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700') : 'bg-slate-100 text-slate-500'}`}>
                  {stepTasksCount}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid Container */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl bg-white/50">
            <CheckCircle2 size={40} className={activeTabConfig.type === 'step' ? 'text-emerald-400' : 'text-slate-300'} />
            <p className="font-bold text-lg text-slate-500">Nicio sarcină în acest stadiu.</p>
            <p className="text-sm mt-1">{activeTabConfig.type === 'step' ? 'Toate sarcinile din această etapă au fost procesate.' : 'Nicio sarcină închisă în această categorie.'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {activeTasks.map(task => {
              const rowData = task.row_data || {};
              const titleStr = rowData.nume_complet || rowData.nume || rowData.name || rowData.denumire || rowData.titlu || 'FIȘĂ DOSAR CAMPANIE SARCINI';
              const isMissing = rowData.is_missing;
              
              const totalSteps = steps.length;
              const progressPercent = totalSteps > 0 ? ((task.active_step_idx + 1) / totalSteps) * 100 : 0;
              const isClosed = task.completed;

              return (
                <div 
                  key={task.id}
                  onClick={() => setSelectedTask(task)}
                  className={`bg-white p-4 rounded-xl border shadow-sm hover:shadow-md cursor-pointer transition-all group flex flex-col justify-between min-h-[160px] relative overflow-hidden ${isClosed ? 'border-emerald-200 hover:border-emerald-300' : isMissing ? 'border-red-300 hover:border-red-400' : 'border-slate-200 hover:border-indigo-300'}`}
                >
                  {/* Subtle top color bar */}
                  <div className={`absolute top-0 left-0 right-0 h-1 transition-colors ${isClosed ? 'bg-emerald-300 group-hover:bg-emerald-400' : isMissing ? 'bg-red-300 group-hover:bg-red-400' : 'bg-indigo-100 group-hover:bg-indigo-400'}`}></div>
                  
                  <div>
                    <div className="flex justify-between items-start mb-3 mt-1">
                      <span className="font-black text-slate-800 line-clamp-1 text-base">{titleStr}</span>
                    </div>
                    {isMissing && (
                      <div className="mb-2 flex items-center justify-between">
                        <div className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center w-fit">
                          🚨 Exclus din baza de date
                        </div>
                        <button 
                          onClick={(e) => handleDeleteTask(e, task.id)}
                          className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Șterge card din flux"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                    
                    {/* Quick Data Fields */}
                    <div className="text-[11px] text-slate-600 flex flex-col gap-1.5 mb-4 font-medium">
                      {Object.entries(rowData).slice(0, 3).map(([k, v]) => (
                        <div key={k} className="flex justify-between items-center border-b border-slate-50 pb-1">
                          <span className="text-slate-400 uppercase tracking-wider">{k}</span>
                          <span className="text-slate-700 truncate max-w-[120px] font-bold" title={String(v)}>
                            {v !== null && v !== undefined && v !== '' ? String(v) : '-'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Progress Footer */}
                  <div className="border-t border-slate-100 pt-3 mt-auto flex flex-col gap-2">
                    {isClosed ? (
                      <div className="flex justify-between items-center text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                        <span>Status Finalizat</span>
                        <span className="flex items-center gap-1"><CheckCircle2 size={12} /> {task.category}</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          <span>Progres Campanie</span>
                          <span className="text-indigo-600">{task.active_step_idx + 1}/{totalSteps} Pași</span>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-indigo-500 h-full rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedTask && (
        <FlashcardModal 
          task={selectedTask} 
          stepConfig={selectedTask.completed ? null : steps[selectedTask.active_step_idx]} 
          visibleColumns={flow.visible_columns}
          onClose={() => setSelectedTask(null)} 
          onTransition={handleTaskTransition}
        />
      )}
    </div>
  );
};
