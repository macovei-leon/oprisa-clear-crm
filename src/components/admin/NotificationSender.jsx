import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Send, Users, Building, User, Code, Eye, BellRing } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

export const NotificationSender = ({ setGlobalAlert }) => {
  const { t } = useLanguage();
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  
  const [targetType, setTargetType] = useState('all'); // 'all', 'department', 'user'
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  
  const [message, setMessage] = useState('');
  const [previewMode, setPreviewMode] = useState(false);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: depts } = await supabase.from('departments').select('*').order('name');
    if (depts) setDepartments(depts);
    
    const { data: profiles } = await supabase.from('profiles').select('*').order('name');
    if (profiles) setUsers(profiles);
  };

  const handleSend = async () => {
    if (!message.trim()) {
      setGlobalAlert({ type: 'error', message: t.errEmptyMsg || 'Mesajul nu poate fi gol.' });
      return;
    }

    setIsSending(true);
    let targetUserIds = [];

    try {
      if (targetType === 'all') {
        targetUserIds = users.filter(u => u.status !== 'pending').map(u => u.id);
      } else if (targetType === 'department') {
        if (!selectedDept) throw new Error(t.errSelectDept || 'Selectează un departament.');
        targetUserIds = users.filter(u => u.department_id === selectedDept && u.status !== 'pending').map(u => u.id);
      } else if (targetType === 'user') {
        if (!selectedUser) throw new Error(t.errSelectUser || 'Selectează un utilizator.');
        targetUserIds = [selectedUser];
      }

      if (targetUserIds.length === 0) {
        throw new Error(t.errNoUsersFound || 'Niciun utilizator găsit pentru această selecție.');
      }

      const inserts = targetUserIds.map(uid => ({
        user_id: uid,
        message: message,
        is_read: false
      }));

      const { error } = await supabase.from('app_notifications').insert(inserts);
      if (error) throw error;

      setGlobalAlert({ type: 'success', message: `${t.msgNotifSentPart1 || 'Notificare trimisă cu succes către'} ${targetUserIds.length} ${t.msgNotifSentPart2 || 'utilizator(i).'}` });
      setMessage('');
      setTargetType('all');
    } catch (err) {
      setGlobalAlert({ type: 'error', message: err.message });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden max-w-4xl">
      <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <BellRing className="text-indigo-600" size={20} />
          Trimite Notificare
        </h2>
      </div>

      <div className="p-6 space-y-6">
        
        {/* Target Selection */}
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-3">{t.lblRecipients || 'Destinatar(i)'}</label>
          <div className="flex gap-4 mb-4">
            <button 
              onClick={() => setTargetType('all')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border-2 font-semibold transition-all ${targetType === 'all' ? 'border-indigo-600 text-indigo-700 bg-indigo-50' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
            >
              <Users size={18} /> Toți
            </button>
            <button 
              onClick={() => setTargetType('department')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border-2 font-semibold transition-all ${targetType === 'department' ? 'border-indigo-600 text-indigo-700 bg-indigo-50' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
            >
              <Building size={18} /> Departament
            </button>
            <button 
              onClick={() => setTargetType('user')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border-2 font-semibold transition-all ${targetType === 'user' ? 'border-indigo-600 text-indigo-700 bg-indigo-50' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
            >
              <User size={18} /> Utilizator
            </button>
          </div>

          {targetType === 'department' && (
            <select 
              value={selectedDept} 
              onChange={e => setSelectedDept(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-500"
            >
              <option value="">{t.optSelectDept || '-- Selectează Departament --'}</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}

          {targetType === 'user' && (
            <select 
              value={selectedUser} 
              onChange={e => setSelectedUser(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-500"
            >
              <option value="">{t.optSelectUser || '-- Selectează Utilizator --'}</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
            </select>
          )}
        </div>

        {/* Message Editor */}
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">{t.lblNotifMsg || 'Mesaj Notificare'}</label>
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="flex border-b border-slate-200 bg-slate-50">
              <button
                onClick={() => setPreviewMode(false)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-bold transition-colors border-b-2 ${!previewMode ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                <Code size={16} /> Editare (HTML)
              </button>
              <button
                onClick={() => setPreviewMode(true)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-bold transition-colors border-b-2 ${previewMode ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                <Eye size={16} /> Previzualizare
              </button>
            </div>

            {!previewMode ? (
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder={t.phWriteNotif || "Scrie mesajul notificării..."}
                className="w-full h-64 p-4 focus:outline-none font-mono text-sm resize-y"
              />
            ) : (
              <div 
                className="w-full h-64 p-4 overflow-y-auto prose max-w-none bg-white"
                dangerouslySetInnerHTML={{ __html: message || `<p class="text-slate-400 italic">${t.lblMsgEmpty || 'Mesajul este gol...'}</p>` }}
              />
            )}
          </div>
        </div>
      </div>

      <div className="p-5 border-t border-slate-100 flex justify-end bg-slate-50">
        <button 
          onClick={handleSend}
          disabled={isSending || !message.trim()}
          className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 transition-colors shadow-md shadow-indigo-600/20"
        >
          <Send size={18} /> {isSending ? (t.btnSending || 'Se trimite...') : (t.btnSendNotif || 'Trimite Notificarea')}
        </button>
      </div>
    </div>
  );
};
