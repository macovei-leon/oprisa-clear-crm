import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Building, Trash2, Plus } from 'lucide-react';

export const DepartmentManagement = ({ setGlobalAlert }) => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newDeptName, setNewDeptName] = useState('');
  const [isAdding, setIsAdding] = useState(false);

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
      setGlobalAlert({ type: 'success', message: `Departament adăugat cu succes.` });
      setNewDeptName('');
      fetchDepartments();
    }
    setIsAdding(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Ești sigur că vrei să ștergi acest departament? Utilizatorii asociați nu vor mai avea departament.')) return;
    
    const { error } = await supabase
      .from('departments')
      .delete()
      .eq('id', id);
      
    if (error) {
      setGlobalAlert({ type: 'error', message: error.message });
    } else {
      setGlobalAlert({ type: 'success', message: `Departament șters cu succes.` });
      fetchDepartments();
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Building className="text-indigo-600" size={20} />
          Management Departamente
        </h2>
      </div>
      
      <div className="p-5 border-b border-slate-100 bg-white">
        <form onSubmit={handleAdd} className="flex gap-3 max-w-md">
          <input 
            type="text" 
            placeholder="Nume Departament Nou..." 
            value={newDeptName}
            onChange={e => setNewDeptName(e.target.value)}
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-500"
          />
          <button 
            type="submit" 
            disabled={isAdding || !newDeptName.trim()}
            className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Plus size={18} /> Adaugă
          </button>
        </form>
        <p className="text-xs text-slate-500 mt-2">Departamentele vor fi disponibile la înregistrarea noilor utilizatori.</p>
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-500">Se încarcă...</div>
      ) : departments.length === 0 ? (
        <div className="p-8 text-center text-slate-500">Nu există departamente.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                <th className="p-4 font-bold">Nume Departament</th>
                <th className="p-4 font-bold w-24 text-right">Acțiuni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {departments.map(d => (
                <tr key={d.id} className="hover:bg-slate-50/50">
                  <td className="p-4 font-semibold text-slate-800">{d.name}</td>
                  <td className="p-4 text-right">
                    <button 
                      onClick={() => handleDelete(d.id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded transition-colors"
                      title="Șterge"
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
    </div>
  );
};
