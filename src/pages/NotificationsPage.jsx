import React, { useState, useEffect } from 'react';
import { MainLayout } from '../components/layout/MainLayout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { BellRing, Check, X, Clock } from 'lucide-react';

export const NotificationsPage = () => {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.id) {
      fetchNotifications();
      
      const channel = supabase.channel('schema-db-changes-page')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'app_notifications',
            filter: `user_id=eq.${profile.id}`
          },
          (payload) => {
            setNotifications(prev => [payload.new, ...prev]);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [profile]);

  const fetchNotifications = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('app_notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false });
      
    if (data) setNotifications(data);
    setLoading(false);
  };

  const markAsRead = async (id) => {
    await supabase.from('app_notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;
    
    await supabase.from('app_notifications').update({ is_read: true }).in('id', unreadIds);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const deleteNotification = async (id) => {
    await supabase.from('app_notifications').delete().eq('id', id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <MainLayout title="Notificări" subtitle="Toate notificările primite de la administratori">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[500px]">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
              <BellRing size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Inbox Notificări</h2>
              <p className="text-sm text-slate-500">Ai {unreadCount} notificări necitite</p>
            </div>
          </div>
          {unreadCount > 0 && (
            <button 
              onClick={markAllAsRead}
              className="px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold text-sm rounded-lg flex items-center gap-2 transition-colors"
            >
              <Check size={16} /> Marchează toate ca citite
            </button>
          )}
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center text-slate-500 py-12">Se încarcă notificările...</div>
          ) : notifications.length === 0 ? (
            <div className="text-center text-slate-500 py-12">
              <div className="w-16 h-16 mx-auto bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-4">
                <BellRing size={32} />
              </div>
              <p className="font-semibold text-lg">Nu ai nicio notificare.</p>
              <p className="mt-2 text-sm">Vei primi aici mesajele importante de la echipa de administrare.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {notifications.map(notif => (
                <div key={notif.id} className={`rounded-xl border transition-all ${notif.is_read ? 'bg-white border-slate-200' : 'bg-blue-50/30 border-blue-200 shadow-sm'}`}>
                  <div className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4">
                      <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
                        <Clock size={16} />
                        {new Date(notif.created_at).toLocaleString('ro-RO', { dateStyle: 'full', timeStyle: 'short' })}
                      </div>
                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        {!notif.is_read && (
                          <button 
                            onClick={() => markAsRead(notif.id)}
                            className="px-3 py-1.5 text-blue-600 hover:bg-blue-100 bg-blue-50 rounded-lg font-semibold text-sm transition-colors flex items-center gap-1"
                          >
                            <Check size={14} /> Marchează citită
                          </button>
                        )}
                        <button 
                          onClick={() => deleteNotification(notif.id)}
                          className="px-3 py-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg font-semibold text-sm transition-colors flex items-center gap-1"
                        >
                          <X size={14} /> Șterge
                        </button>
                      </div>
                    </div>
                    
                    <div className="w-full bg-white rounded-lg p-4 border border-slate-100">
                      <div 
                        className="prose max-w-none prose-indigo prose-headings:font-bold prose-a:text-indigo-600 text-slate-800"
                        dangerouslySetInnerHTML={{ __html: notif.message }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};
