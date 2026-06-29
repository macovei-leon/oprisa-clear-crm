import React, { useState, useEffect, useRef } from 'react';
import { MainLayout } from '../components/layout/MainLayout';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { Workbook } from '@fortune-sheet/react';
import '@fortune-sheet/react/dist/index.css';

export const MySpacePage = () => {
  const { t } = useLanguage();
  const { profile } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [workbookData, setWorkbookData] = useState([{ name: 'Sheet1' }]);
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(profile?.id);
  const [saving, setSaving] = useState(false);
  
  const workbookRef = useRef(null);
  
  useEffect(() => {
    if (profile?.role === 'admin') {
      fetchUsers();
    }
  }, [profile]);
  
  useEffect(() => {
    if (selectedUserId) {
      loadWorkbook(selectedUserId);
    }
  }, [selectedUserId]);
  
  const fetchUsers = async () => {
    const { data } = await supabase.from('profiles').select('id, name, role').order('name');
    if (data) setUsers(data);
  };
  
  const loadWorkbook = async (userId) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_workbooks')
        .select('data')
        .eq('user_id', userId)
        .maybeSingle();
        
      if (data && data.data && data.data.length > 0) {
        setWorkbookData(data.data);
      } else {
        // Default blank sheet
        setWorkbookData([{ name: 'Sheet1' }]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  const saveWorkbook = async (dataToSave) => {
    if (!selectedUserId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_workbooks')
        .upsert({ 
          user_id: selectedUserId, 
          data: dataToSave,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
        
      if (error) throw error;
    } catch (err) {
      console.error('Error saving workbook', err);
    } finally {
      setTimeout(() => setSaving(false), 500); // Visual cue
    }
  };
  
  const handleOnChange = (data) => {
    if (window.saveTimeout) clearTimeout(window.saveTimeout);
    window.saveTimeout = setTimeout(() => {
      saveWorkbook(data);
    }, 2000);
  };

  return (
    <MainLayout title={t.navMySpace || "Spațiul Meu"} subtitle={t.subMySpace || "Spațiul tău personal de lucru (Excel)"}>
      <div className="flex flex-col h-[calc(100vh-140px)] bg-white border border-slate-200 rounded-xl overflow-hidden relative shadow-sm">
        
        {/* Admin Controls */}
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {profile?.role === 'admin' ? (
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-600">{t.lblSelectUser || 'Selectează Utilizator'}:</span>
                <select 
                  className="border border-slate-300 rounded-md px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                >
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>
            ) : (
              <span className="text-sm font-bold text-slate-700">{profile?.name} - {t.navMySpace || 'Spațiul Meu'}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
             <span className={`text-xs font-bold px-2 py-1 rounded-full ${saving ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
               {saving ? (t.lblSaving || 'Se salvează...') : (t.lblSaved || 'Salvat')}
             </span>
          </div>
        </div>

        {/* Spreadsheet Container */}
        <div className="flex-1 w-full relative" style={{ isolation: 'isolate' }}>
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-50 z-10">
              <span className="text-slate-500 font-bold">{t.lblLoadingSpace || 'Se încarcă spațiul tău...'}</span>
            </div>
          ) : (
             <Workbook 
                ref={workbookRef} 
                data={workbookData} 
                onChange={handleOnChange}
                lang="en"
             />
          )}
        </div>

      </div>
    </MainLayout>
  );
};
