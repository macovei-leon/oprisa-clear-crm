import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { CheckCircle, XCircle, Shield, Building, Trash2 } from 'lucide-react';

export const UserManagement = ({ setGlobalAlert }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState([]);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch departments for the dropdowns
    const { data: depts } = await supabase.from('departments').select('*').order('name');
    setDepartments(depts || []);

    // Fetch users (profiles)
    const { data, error } = await supabase
      .from('profiles')
      .select('*, departments(name)');
      
    if (error) {
      setGlobalAlert({ type: 'error', message: error.message });
    } else {
      setUsers(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAction = async (id, newStatus) => {
    const { error } = await supabase
      .from('profiles')
      .update({ status: newStatus })
      .eq('id', id);
      
    if (error) {
      setGlobalAlert({ type: 'error', message: error.message });
    } else {
      setGlobalAlert({ type: 'success', message: `Status updated successfully.` });
      fetchData();
    }
  };

  const handleRoleChange = async (id, newRole) => {
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', id);
      
    if (error) {
      setGlobalAlert({ type: 'error', message: error.message });
    } else {
      setGlobalAlert({ type: 'success', message: `Role updated to ${newRole}.` });
      fetchData();
    }
  };

  const pendingUsers = users.filter(u => u.status === 'pending');
  const activeUsers = users.filter(u => u.status !== 'pending');

  return (
    <div className="flex flex-col gap-8">
      {/* Pending Users Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-amber-50/50">
          <h2 className="text-lg font-bold text-slate-800">Utilizatori în Așteptare ({pendingUsers.length})</h2>
        </div>
        
        {loading ? (
          <div className="p-8 text-center text-slate-500">Se încarcă...</div>
        ) : pendingUsers.length === 0 ? (
          <div className="p-8 text-center text-slate-500">Niciun utilizator în așteptare.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                  <th className="p-4 font-bold">Nume</th>
                  <th className="p-4 font-bold">Email</th>
                  <th className="p-4 font-bold">Departament</th>
                  <th className="p-4 font-bold text-right">Acțiuni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingUsers.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50/50">
                    <td className="p-4 font-semibold text-slate-800">{u.name || 'N/A'}</td>
                    <td className="p-4 text-slate-600">{u.email || 'N/A'}</td>
                    <td className="p-4 text-slate-600">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
                        {u.departments?.name || 'N/A'}
                      </span>
                    </td>
                    <td className="p-4 text-right flex justify-end gap-2">
                      <button onClick={() => handleAction(u.id, 'approved')} className="px-3 py-1 bg-green-50 text-green-600 hover:bg-green-100 font-bold text-sm rounded-lg flex items-center gap-1">
                        <CheckCircle size={16} /> Aprobă
                      </button>
                      <button onClick={() => handleAction(u.id, 'rejected')} className="px-3 py-1 bg-red-50 text-red-600 hover:bg-red-100 font-bold text-sm rounded-lg flex items-center gap-1">
                        <XCircle size={16} /> Respinge
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Active Users Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800">Toți Utilizatorii ({activeUsers.length})</h2>
        </div>
        
        {loading ? (
          <div className="p-8 text-center text-slate-500">Se încarcă...</div>
        ) : activeUsers.length === 0 ? (
          <div className="p-8 text-center text-slate-500">Niciun utilizator activ.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                  <th className="p-4 font-bold">Utilizator</th>
                  <th className="p-4 font-bold">Rol</th>
                  <th className="p-4 font-bold">Departament</th>
                  <th className="p-4 font-bold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeUsers.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50/50">
                    <td className="p-4">
                      <div className="font-semibold text-slate-800">{u.name || 'N/A'}</div>
                      <div className="text-xs text-slate-500">{u.email}</div>
                    </td>
                    <td className="p-4">
                      <select 
                        value={u.role || 'user'}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-sm font-semibold text-slate-700 outline-none focus:border-indigo-500"
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="p-4 text-slate-600">
                      <div className="flex items-center gap-2 text-sm">
                        <Building size={14} className="text-slate-400" />
                        {u.departments?.name || 'Fără'}
                      </div>
                    </td>
                    <td className="p-4">
                      {u.status === 'approved' ? (
                        <span className="text-green-600 font-bold text-xs bg-green-50 px-2 py-1 rounded">ACTIV</span>
                      ) : (
                        <span className="text-red-600 font-bold text-xs bg-red-50 px-2 py-1 rounded">RESPINS</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
