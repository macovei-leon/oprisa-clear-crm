import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { X, Users, Activity, Plus, Trash2, ArrowRight } from 'lucide-react';

const generateId = () => {
  return (crypto && crypto.randomUUID) 
    ? crypto.randomUUID() 
    : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

export const CampaignBuilderModal = ({ isOpen, onClose, onSuccess, selectedRowsData = [], tableName = '', visibleColumns = [], isRepetitive = false, initialData = null }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [workers, setWorkers] = useState([]);
  
  // Campaign Metadata
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetRole, setTargetRole] = useState('support');
  const [triggerType, setTriggerType] = useState('Manual Campaign');
  
  // Repetitive flow state
  const [resetIntervalHours, setResetIntervalHours] = useState(24);
  const [resetIntervalMinutes, setResetIntervalMinutes] = useState(0);
  
  // Worker Splits (Array of { id, count })
  const [workerSplits, setWorkerSplits] = useState([]);
  
  // Existing tasks when editing
  const [existingTasks, setExistingTasks] = useState([]);

  // Campaign Steps & Branches
  const [campaignSteps, setCampaignSteps] = useState([
    {
      id: generateId(),
      name: '',
      description: '',
      branches: [
        { id: generateId(), label: 'Pas Următor', action: 'next', color: 'success' }
      ]
    }
  ]);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setTitle(initialData.name || '');
        setDescription(initialData.description || '');
        setCampaignSteps(initialData.steps || [
          {
            id: generateId(),
            name: '',
            description: '',
            branches: [{ id: generateId(), label: 'Pas Următor', action: 'next', color: 'success' }]
          }
        ]);
        if (isRepetitive) {
          if (initialData.reset_interval_hours !== undefined) setResetIntervalHours(initialData.reset_interval_hours);
          if (initialData.reset_interval_minutes !== undefined) setResetIntervalMinutes(initialData.reset_interval_minutes);
        }
      }
      fetchWorkers();
    }
  }, [isOpen, initialData]);

  const fetchWorkers = async () => {
    const { data: activeWorkers } = await supabase
      .from('profiles')
      .select('id, name, email, role, status, departments(name)')
      .in('status', ['approved'])
      .order('name');
      
    const workersList = activeWorkers || [];
    setWorkers(workersList);
    
    if (initialData) {
      // Fetch current task distribution
      const tableTasks = isRepetitive ? 'crm_repetitive_tasks' : 'crm_tasks';
      const colName = isRepetitive ? 'repetitive_flow_id' : 'campaign_id';
      const { data: tasks } = await supabase
        .from(tableTasks)
        .select('id, assigned_to')
        .eq(colName, initialData.id);
        
      const taskList = tasks || [];
      setExistingTasks(taskList);
      
      const counts = {};
      taskList.forEach(t => {
        counts[t.assigned_to] = (counts[t.assigned_to] || 0) + 1;
      });
      
      setWorkerSplits(workersList.map(w => ({ id: w.id, count: counts[w.id] || 0 })));
    } else {
      // Initialize splits with 0
      setWorkerSplits(workersList.map(w => ({ id: w.id, count: 0 })));
    }
  };

  const handleSplitChange = (workerId, value) => {
    const num = parseInt(value) || 0;
    setWorkerSplits(prev => prev.map(s => s.id === workerId ? { ...s, count: num } : s));
  };

  const distributeEvenly = () => {
    const total = initialData ? existingTasks.length : selectedRowsData.length;
    if (total === 0 || workers.length === 0) return;
    
    const base = Math.floor(total / workers.length);
    const remainder = total % workers.length;
    
    setWorkerSplits(workers.map((w, idx) => ({
      id: w.id,
      count: base + (idx < remainder ? 1 : 0)
    })));
  };

  const totalAssigned = workerSplits.reduce((sum, split) => sum + split.count, 0);

  // --- Step Builder Helpers ---
  const addStep = () => {
    setCampaignSteps([...campaignSteps, {
      id: generateId(),
      name: '',
      description: '',
      branches: [{ id: generateId(), label: 'Continuă', action: 'next', color: 'success' }]
    }]);
  };

  const updateStep = (id, field, value) => {
    setCampaignSteps(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const removeStep = (id) => {
    setCampaignSteps(prev => prev.filter(s => s.id !== id));
  };

  const addBranch = (stepId) => {
    setCampaignSteps(prev => prev.map(s => {
      if (s.id === stepId) {
        return {
          ...s,
          branches: [...s.branches, { id: generateId(), label: 'Opțiune nouă', action: 'next', color: 'primary' }]
        };
      }
      return s;
    }));
  };

  const updateBranch = (stepId, branchId, field, value) => {
    setCampaignSteps(prev => prev.map(s => {
      if (s.id === stepId) {
        return {
          ...s,
          branches: s.branches.map(b => b.id === branchId ? { ...b, [field]: value } : b)
        };
      }
      return s;
    }));
  };

  const removeBranch = (stepId, branchId) => {
    setCampaignSteps(prev => prev.map(s => {
      if (s.id === stepId) {
        return { ...s, branches: s.branches.filter(b => b.id !== branchId) };
      }
      return s;
    }));
  };

  const launchCampaign = async () => {
    if (!title.trim()) return alert("Introduceți un titlu.");
    
    const totalAvailable = initialData ? existingTasks.length : selectedRowsData.length;
    if (totalAssigned !== totalAvailable) {
      return alert(`Ați distribuit ${totalAssigned} sarcini din ${totalAvailable}. Trebuie să le distribuiți pe toate.`);
    }
    
    // Validate steps
    for (let s of campaignSteps) {
      if (!s.name.trim()) return alert("Fiecare etapă trebuie să aibă un nume.");
      for (let b of s.branches) {
        if (!b.label.trim()) return alert("Fiecare buton de decizie trebuie să aibă o etichetă.");
        if (b.action.startsWith('category_') && b.action === 'category_') return alert("Completați numele categoriei pentru finalizare.");
      }
    }

    setLoading(true);
    try {
      const tableFlows = isRepetitive ? 'crm_repetitive_flows' : 'crm_campaigns';
      const tableTasks = isRepetitive ? 'crm_repetitive_tasks' : 'crm_tasks';

      if (initialData) {
        // Edit Mode
        const updateData = {
          name: title.trim(),
          description: description.trim(),
          steps: campaignSteps,
        };
        if (isRepetitive) {
          updateData.reset_interval_hours = resetIntervalHours;
          updateData.reset_interval_minutes = resetIntervalMinutes;
        }

        const { error } = await supabase.from(tableFlows).update(updateData).eq('id', initialData.id);
        if (error) throw error;

        // Reassign tasks if distribution changed
        let taskIdx = 0;
        const updates = [];
        for (let split of workerSplits) {
          for (let i = 0; i < split.count; i++) {
            const task = existingTasks[taskIdx];
            if (task && task.assigned_to !== split.id) {
              updates.push(
                supabase.from(tableTasks).update({ assigned_to: split.id }).eq('id', task.id)
              );
            }
            taskIdx++;
          }
        }
        
        if (updates.length > 0) {
          await Promise.all(updates);
        }

        alert("Modificările au fost salvate cu succes!");
        onClose();
        return;
      }

      // Create Mode
      const insertData = {
        name: title.trim(),
        description: description.trim(),
        target_role: targetRole,
        trigger_type: triggerType,
        steps: campaignSteps,
        is_active: true,
        visible_columns: visibleColumns
      };

      if (isRepetitive) {
        insertData.reset_interval_hours = resetIntervalHours;
        insertData.reset_interval_minutes = resetIntervalMinutes;
      }

      const { data: campData, error: campErr } = await supabase
        .from(tableFlows)
        .insert([insertData]).select('id').single();

      if (campErr) throw campErr;
      const campaignId = campData.id;

      // Prepare task rows
      let rowIndex = 0;
      const tasksToInsert = [];

      for (let split of workerSplits) {
        for (let i = 0; i < split.count; i++) {
          const rowData = selectedRowsData[rowIndex];
          if (!rowData) break;
          
          const taskObj = {
            row_data: rowData,
            assigned_to: split.id,
            active_step_idx: 0,
            completed: false
          };
          if (isRepetitive) {
            taskObj.repetitive_flow_id = campaignId;
          } else {
            taskObj.campaign_id = campaignId;
          }
          tasksToInsert.push(taskObj);
          rowIndex++;
        }
      }

      // Bulk insert tasks (chunks of 500)
      for (let i = 0; i < tasksToInsert.length; i += 500) {
        const batch = tasksToInsert.slice(i, i + 500);
        const { error: taskErr } = await supabase.from(tableTasks).insert(batch);
        if (taskErr) throw taskErr;
      }

      // Mark the rows as processed in the original custom table
      const rowIds = selectedRowsData.map(r => r.id).filter(Boolean);
      if (rowIds.length > 0 && tableName) {
        for (let i = 0; i < rowIds.length; i += 500) {
          const batchIds = rowIds.slice(i, i + 500);
          const { error: markErr } = await supabase
            .from(tableName)
            .update({ crm_processed: true })
            .in('id', batchIds);
          if (markErr) console.error("Eroare la marcarea rândurilor ca procesate:", markErr);
        }
      }

      alert(isRepetitive ? "Flux repetitiv lansat cu succes!" : "Campanie lansată cu succes!");
      if (onSuccess) onSuccess();
      else onClose(); // and trigger a refresh upstream to uncheck rows
    } catch (err) {
      console.error(err);
      alert("Eroare la operare: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl h-[95vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Activity className="text-indigo-600" />
            {initialData 
              ? (isRepetitive ? "Editează Flux Repetitiv" : "Editează Campanie")
              : (isRepetitive ? "Creează Flux Repetitiv" : "Creează Campanie Sarcini")
            }
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 bg-white p-1 rounded-full shadow-sm">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 flex gap-6">
          
          {/* Left Column: Metadata & Distribution */}
          <div className="flex-1 flex flex-col gap-5">
            {!initialData && (
              <div className="bg-blue-50 text-blue-800 p-4 rounded-xl font-bold text-sm border border-blue-200 flex justify-between items-center">
                <span>{selectedRowsData.length} Rânduri Selectate din `{tableName}`</span>
                <span>Pasul 1 / 2</span>
              </div>
            )}

            {initialData && (
              <div className="bg-emerald-50 text-emerald-800 p-4 rounded-xl font-bold text-sm border border-emerald-200 flex justify-between items-center">
                <span>Total Sarcini în {isRepetitive ? "Flux" : "Campanie"}: {existingTasks.length}</span>
                <span>Editare</span>
              </div>
            )}

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-4">
              <h3 className="font-bold text-slate-700">{isRepetitive ? "Detalii Flux" : "Detalii Campanie"}</h3>
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-1">Titlu {isRepetitive ? "Flux" : "Campanie"}</label>
                <input type="text" value={title} onChange={e=>setTitle(e.target.value)} className="w-full p-2 border rounded-lg focus:outline-none focus:border-indigo-500" placeholder="ex: Sunare Șoferi Reactivare" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-1">Instrucțiuni Globale</label>
                <textarea value={description} onChange={e=>setDescription(e.target.value)} className="w-full p-2 border rounded-lg h-20 resize-none focus:outline-none focus:border-indigo-500" placeholder="Instrucțiuni pentru operatori..."></textarea>
              </div>
              {isRepetitive && (
                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-1">Interval de Resetare Sarcini (Ore)</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      min="1"
                      value={resetIntervalHours} 
                      onChange={e => setResetIntervalHours(parseInt(e.target.value) || 24)} 
                      className="w-24 p-2 border rounded-lg focus:outline-none focus:border-indigo-500 text-center font-bold" 
                    />
                    <span className="text-sm text-slate-500 font-medium">ore (Ex: 24, 48, 72)</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Sarcina completată se va reseta automat pentru operator după acest număr de ore.</p>
                </div>
              )}
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-slate-700 flex items-center gap-2"><Users size={16}/> {initialData ? "Redistribuire Sarcini Existente" : "Distribuire Sarcini Noi"}</h3>
                <button onClick={distributeEvenly} className="text-xs bg-slate-100 px-3 py-1 font-bold rounded hover:bg-slate-200 border">Distribuie Egal</button>
              </div>
              <div className="max-h-48 overflow-y-auto flex flex-col gap-2">
                {workers.map(w => (
                  <div key={w.id} className="flex justify-between items-center p-2 bg-slate-50 border rounded-lg">
                    <div>
                      <div className="font-bold text-sm text-slate-800">{w.name || w.email}</div>
                      <div className="text-xs text-slate-500 uppercase">{w.role} - {w.departments?.name || '-'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" min="0" 
                        value={workerSplits.find(s=>s.id===w.id)?.count || 0}
                        onChange={(e) => handleSplitChange(w.id, e.target.value)}
                        className="w-16 p-1 text-center border rounded text-sm font-bold"
                      />
                      <span className="text-xs text-slate-500">sarcini</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center font-bold text-sm border-t pt-2">
                <span>Total Distribuit:</span>
                <span className={totalAssigned !== (initialData ? existingTasks.length : selectedRowsData.length) ? 'text-red-500' : 'text-emerald-600'}>
                  {totalAssigned} / {initialData ? existingTasks.length : selectedRowsData.length}
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Dynamic Steps */}
          <div className="flex-[1.2] bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-700 flex items-center gap-2">Constructor Flux de Lucru (Steps)</h3>
              <button onClick={addStep} className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1 font-bold rounded-lg hover:bg-indigo-100 flex items-center gap-1 border border-indigo-200">
                <Plus size={14}/> Adaugă Etapă
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto flex flex-col gap-4 pl-4 pr-2 py-2">
              {campaignSteps.map((step, sIdx) => (
                <div key={step.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50 relative group ml-2">
                  <div className="absolute -left-5 top-4 w-8 h-8 bg-slate-800 text-white rounded-full flex justify-center items-center font-bold text-sm shadow-md border-2 border-white z-10">{sIdx + 1}</div>
                  
                  <div className="flex gap-2 items-start pl-4">
                    <div className="flex-1 flex flex-col gap-2">
                      <input 
                        type="text" value={step.name} onChange={e=>updateStep(step.id, 'name', e.target.value)} 
                        className="w-full p-2 border rounded focus:border-indigo-500 font-bold text-sm" 
                        placeholder={`Nume Etapă (ex: Apel 1)`} 
                      />
                      <textarea 
                        value={step.description} onChange={e=>updateStep(step.id, 'description', e.target.value)}
                        className="w-full p-2 border rounded text-sm resize-none h-12" 
                        placeholder="Instrucțiuni specifice pentru acest pas..." 
                      />
                    </div>
                    {campaignSteps.length > 1 && (
                      <button onClick={()=>removeStep(step.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={16}/></button>
                    )}
                  </div>

                  {/* Branches */}
                  <div className="mt-5 border border-indigo-100 rounded-xl overflow-hidden shadow-sm">
                    <div className="bg-indigo-50 px-4 py-2 border-b border-indigo-100 flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-indigo-800 uppercase tracking-wide">Configurare Butoane Acțiune</span>
                        <span className="text-[10px] text-indigo-600">Setează opțiunile pe care le are operatorul la acest pas</span>
                      </div>
                      <button onClick={()=>addBranch(step.id)} className="text-xs bg-white text-indigo-600 border border-indigo-200 px-3 py-1 font-bold rounded-lg hover:bg-indigo-100 flex items-center gap-1 shadow-sm">
                        <Plus size={14} /> Adaugă Buton
                      </button>
                    </div>
                    
                    <div className="flex flex-col gap-2 p-3 bg-white">
                    {step.branches.map((branch, bIdx) => (
                      <div key={branch.id} className="flex items-center gap-2 bg-white p-2 border rounded-lg shadow-sm text-sm">
                        <input 
                          type="text" value={branch.label} onChange={e=>updateBranch(step.id, branch.id, 'label', e.target.value)}
                          className="w-32 p-1 border-b focus:border-indigo-500 outline-none" placeholder="Etichetă"
                        />
                        <select 
                          value={branch.color} onChange={e=>updateBranch(step.id, branch.id, 'color', e.target.value)}
                          className="p-1 border rounded bg-slate-50 w-24"
                        >
                          <option value="success">Verde</option>
                          <option value="danger">Roșu</option>
                          <option value="warning">Galben</option>
                          <option value="primary">Albastru</option>
                          <option value="secondary">Gri</option>
                        </select>
                        <select 
                          value={branch.action.startsWith('category_') ? 'category' : 'next'} 
                          onChange={e=>{
                            const val = e.target.value;
                            updateBranch(step.id, branch.id, 'action', val === 'category' ? 'category_' : 'next');
                          }}
                          className="p-1 border rounded bg-slate-50 flex-1 font-bold"
                        >
                          <option value="next">Treci la Pas Următor ➔</option>
                          <option value="category">Închide în Categorie 🏁</option>
                        </select>
                        {branch.action.startsWith('category_') && (
                          <input 
                            type="text" value={branch.action.replace('category_', '')} 
                            onChange={e=>updateBranch(step.id, branch.id, 'action', 'category_' + e.target.value)}
                            className="w-32 p-1 border border-rose-200 bg-rose-50 rounded outline-none placeholder:text-rose-300" placeholder="Nume Categorie Finală"
                          />
                        )}
                        {step.branches.length > 1 && (
                          <button onClick={()=>removeBranch(step.id, branch.id)} className="text-red-400 hover:text-red-600"><X size={14}/></button>
                        )}
                      </div>
                    ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-white flex justify-end gap-3">
          <button onClick={onClose} disabled={loading} className="px-6 py-2 border rounded-lg font-bold text-slate-600 hover:bg-slate-50">Anulează</button>
          <button onClick={launchCampaign} disabled={loading} className="px-8 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-50">
            {loading ? 'Se procesează...' : (initialData ? 'Salvează Modificările' : 'Lansează Campanie')} <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};
