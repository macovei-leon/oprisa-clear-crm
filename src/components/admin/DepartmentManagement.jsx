import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Building, Trash2, Plus, FileText, X, Save, Eye, Code } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

export const DepartmentManagement = ({ setGlobalAlert }) => {
  const { t } = useLanguage();
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newDeptName, setNewDeptName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  
  const [editingDept, setEditingDept] = useState(null);
  const [instructionsText, setInstructionsText] = useState('');
  const [previewMode, setPreviewMode] = useState(false);
  const [isSavingInst, setIsSavingInst] = useState(false);

  const fetchDepartments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .order('name');
      
    if (error) {
      setGlobalAlert({ type: 'error', message: error.message });
    } else {
      setDepartments(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newDeptName.trim()) return;
    
    setIsAdding(true);
    const { error } = await supabase
      .from('departments')
      .insert([{ name: newDeptName.trim() }]);
      
    if (error) {
      setGlobalAlert({ type: 'error', message: error.message });
    } else {
      setGlobalAlert({ type: 'success', message: t.msgDeptAdded || `Departament adăugat cu succes.` });
      setNewDeptName('');
      fetchDepartments();
    }
    setIsAdding(false);
  };

  const handleDelete = async (id) => {
    if (!confirm(t.confirmDelDept || 'Ești sigur că vrei să ștergi acest departament? Utilizatorii asociați nu vor mai avea departament.')) return;
    
    const { error } = await supabase
      .from('departments')
      .delete()
      .eq('id', id);
      
    if (error) {
      setGlobalAlert({ type: 'error', message: error.message });
    } else {
      setGlobalAlert({ type: 'success', message: t.msgDeptDeleted || `Departament șters cu succes.` });
      fetchDepartments();
    }
  };

  const handleEditInstructions = (dept) => {
    setEditingDept(dept);
    setInstructionsText(dept.instructions || '');
    setPreviewMode(false);
  };

  const handleSaveInstructions = async () => {
    setIsSavingInst(true);
    const { error } = await supabase
      .from('departments')
      .update({ instructions: instructionsText })
      .eq('id', editingDept.id);
      
    if (error) {
      setGlobalAlert({ type: 'error', message: error.message });
    } else {
      setGlobalAlert({ type: 'success', message: `${t.msgInstSaved || 'Instrucțiuni salvate pentru'} ${editingDept.name}.` });
      setEditingDept(null);
      fetchDepartments();
    }
    setIsSavingInst(false);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Building className="text-indigo-600" size={20} />
          {t.deptTitle || 'Management Departamente'}
        </h2>
      </div>
      
      <div className="p-5 border-b border-slate-100 bg-white">
        <form onSubmit={handleAdd} className="flex gap-3 max-w-md">
          <input 
            type="text" 
            placeholder={t.phNewDept || "Nume Departament Nou..."}
            value={newDeptName}
            onChange={e => setNewDeptName(e.target.value)}
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-500"
          />
          <button 
            type="submit" 
            disabled={isAdding || !newDeptName.trim()}
            className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Plus size={18} /> {t.btnAdd || 'Adaugă'}
          </button>
        </form>
        <p className="text-xs text-slate-500 mt-2">{t.descDeptReg || 'Departamentele vor fi disponibile la înregistrarea noilor utilizatori.'}</p>
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-500">{t.loading || 'Se încarcă...'}</div>
      ) : departments.length === 0 ? (
        <div className="p-8 text-center text-slate-500">{t.noDepts || 'Nu există departamente.'}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                <th className="p-4 font-bold">{t.colDeptName || 'Nume Departament'}</th>
                <th className="p-4 font-bold w-24 text-right">{t.colActions || 'Acțiuni'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {departments.map(d => (
                <tr key={d.id} className="hover:bg-slate-50/50">
                  <td className="p-4 font-semibold text-slate-800">{d.name}</td>
                  <td className="p-4 text-right flex justify-end gap-2">
                    <button 
                      onClick={() => handleEditInstructions(d)}
                      className="p-2 text-indigo-500 hover:bg-indigo-50 rounded transition-colors"
                      title={t.btnEditInst || "Editează Instrucțiuni"}
                    >
                      <FileText size={18} />
                    </button>
                    <button 
                      onClick={() => handleDelete(d.id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded transition-colors"
                      title={t.delete || "Șterge"}
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Instrucțiuni */}
      {editingDept && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                <FileText size={20} className="text-indigo-600" />
                {t.modalInstTitle || 'Instrucțiuni -'} {editingDept.name}
              </h3>
              <button onClick={() => setEditingDept(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-5 flex-1 overflow-y-auto">
              <div className="flex border-b border-slate-200 mb-4">
                <button
                  onClick={() => setPreviewMode(false)}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-bold border-b-2 transition-colors ${!previewMode ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                  <Code size={16} /> HTML / Rich Text
                </button>
                <button
                  onClick={() => setPreviewMode(true)}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-bold border-b-2 transition-colors ${previewMode ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                  <Eye size={16} /> {t.btnPreview || 'Previzualizare'}
                </button>
              </div>

              {!previewMode ? (
                <textarea
                  value={instructionsText}
                  onChange={e => setInstructionsText(e.target.value)}
                  placeholder={t.phInst || "Scrie instrucțiunile aici (suportă HTML)..."}
                  className="w-full h-96 p-4 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 font-mono text-sm"
                />
              ) : (
                <div 
                  className="w-full h-96 p-4 border border-slate-200 rounded-lg overflow-y-auto prose max-w-none"
                  dangerouslySetInnerHTML={{ __html: instructionsText || `<p class="text-slate-400 italic">${t.lblNoInst || 'Fără instrucțiuni...'}</p>` }}
                />
              )}
            </div>

            <div className="p-5 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-xl">
              <button 
                onClick={() => setEditingDept(null)}
                className="px-4 py-2 text-slate-600 font-semibold hover:bg-slate-200 rounded-lg transition-colors"
              >
                {t.btnCancel || 'Anulează'}
              </button>
              <button 
                onClick={handleSaveInstructions}
                disabled={isSavingInst}
                className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
              >
                <Save size={18} /> {isSavingInst ? (t.btnSaving || 'Se salvează...') : (t.btnSave || 'Salvează')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
