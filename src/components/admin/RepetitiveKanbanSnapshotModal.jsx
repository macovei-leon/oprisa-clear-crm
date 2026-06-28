import React, { useMemo, useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { X, FolderClosed, Activity, CheckCircle2, Loader2 } from 'lucide-react';
import { FlashcardModal } from '../campaigns/FlashcardModal';

export const RepetitiveKanbanSnapshotModal = ({ flow, selectedStampId, workerId, onClose }) => {
  const [activeTabIdx, setActiveTabIdx] = useState(0);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [selectedCard, setSelectedCard] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [steps, setSteps] = useState(flow?.steps || []);

  useEffect(() => {
    const fetchStamp = async () => {
      if (!selectedStampId) return;
      setLoadingTasks(true);
      try {
        const { data, error } = await supabase
          .from('crm_repetitive_snapshots')
          .select('steps_structure, tasks_map')
          .eq('id', selectedStampId)
          .single();
          
        if (error) throw error;
        
        if (data) {
          if (data.steps_structure) {
            setSteps(data.steps_structure);
          }
          let tasksArr = Object.values(data.tasks_map || {});
          if (workerId) {
            tasksArr = tasksArr.filter(t => t.assigned_to === workerId);
          }
          setTasks(tasksArr);
        }
      } catch (err) {
        console.error('Error fetching stamp:', err);
      } finally {
        setLoadingTasks(false);
      }
    };
    
    fetchStamp();
  }, [selectedStampId, workerId]);

  const categories = Array.from(new Set(
    steps.flatMap(s => s.branches.filter(b => b.action.startsWith('category_')).map(b => b.action.replace('category_', '')))
  ));

  const allTabs = [
    ...steps.map(s => ({ type: 'step', name: s.name })),
    ...categories.map(c => ({ type: 'category', name: c }))
  ];

  const activeTabConfig = allTabs[activeTabIdx];
  const activeTasks = tasks.filter(t => {
    if (!activeTabConfig) return false;
    if (activeTabConfig.type === 'step') {
      return !t.completed && t.active_step_idx === activeTabIdx;
    } else {
      return t.completed && t.category === activeTabConfig.name;
    }
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[95vw] h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-white shrink-0 flex justify-between items-center z-10">
          <div>
            <span className="text-xs font-bold text-indigo-500 uppercase tracking-wider">Snapshot Kanban Data</span>
            <h1 className="text-xl font-black text-slate-800 flex items-center gap-2 mt-1">
              <FolderClosed className="text-indigo-600" />
              {flow?.name}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-slate-100 text-slate-600 px-4 py-2 rounded-xl text-sm font-bold border border-slate-200 flex items-center gap-2">
              <Activity size={16} /> Total Sarcini în Snapshot: {tasks.length}
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700 bg-slate-50 p-2 rounded-full hover:bg-slate-100 transition-all">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="px-6 pt-4 bg-white border-b border-slate-200 shrink-0 shadow-sm z-10">
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
        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50 min-h-0">
          {loadingTasks ? (
            <div className="h-full flex items-center justify-center text-slate-500 gap-2">
              <Loader2 size={24} className="animate-spin" />
              <span className="font-bold">Se încarcă datele panoului...</span>
            </div>
          ) : !activeTabConfig || activeTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl bg-white/50">
              <CheckCircle2 size={40} className={activeTabConfig?.type === 'step' ? 'text-emerald-400' : 'text-slate-300'} />
              <p className="font-bold text-lg text-slate-500">Nicio sarcină în acest stadiu.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {activeTasks.map(task => {
                const rowData = task.row_data || {};
                const titleStr = rowData.nume_complet || rowData.nume || rowData.name || rowData.denumire || rowData.titlu || 'FIȘĂ DOSAR CAMPANIE SARCINI';
                
                const totalSteps = steps.length;
                const progressPercent = totalSteps > 0 ? ((task.active_step_idx + 1) / totalSteps) * 100 : 0;
                const isClosed = task.completed;

                return (
                  <div 
                    key={task.id}
                    onClick={() => setSelectedCard(task)}
                    className={`bg-white p-4 rounded-xl border shadow-sm flex flex-col justify-between min-h-[160px] relative overflow-hidden cursor-pointer hover:shadow-md transition-all ${isClosed ? 'border-emerald-200 hover:border-emerald-300' : 'border-slate-200 hover:border-indigo-300'}`}
                  >
                    <div className={`absolute top-0 left-0 right-0 h-1 ${isClosed ? 'bg-emerald-300' : 'bg-indigo-100'}`}></div>
                    
                    <div>
                      <div className="flex justify-between items-start mb-3 mt-1">
                        <span className="font-black text-slate-800 line-clamp-1 text-base">{titleStr}</span>
                      </div>
                      
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
                            <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${progressPercent}%` }}></div>
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
      </div>
      
      {/* Read-only Data Modal */}
      {selectedCard && (
        <FlashcardModal
          task={selectedCard}
          onClose={() => setSelectedCard(null)}
          // By not passing stepConfig or onTransition, it acts as a read-only viewer
        />
      )}
    </div>
  );
};
