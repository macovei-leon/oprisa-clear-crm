import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';

export const NotificationBell = () => {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (profile?.id) {
      fetchNotifications();
      
      const channel = supabase.channel('schema-db-changes')
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

            if ("Notification" in window && Notification.permission === "granted") {
              const temp = document.createElement("div");
              temp.innerHTML = payload.new.message;
              const textContent = temp.textContent || temp.innerText || "";
              new Notification("Notificare Nouă", {
                body: textContent.substring(0, 100)
              });
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [profile]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    const { data } = await supabase
      .from('app_notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(50);
      
    if (data) setNotifications(data);
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

  const handleBellClick = () => {
    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
      Notification.requestPermission();
    }
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={handleBellClick}
        className="flex items-center justify-center w-10 h-10 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors relative"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden flex flex-col max-h-[80vh]">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <h3 className="font-bold text-slate-800">{t.navNotifications || 'Notificări'}</h3>
            {unreadCount > 0 && (
              <button 
                onClick={markAllAsRead}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
              >
                {t.markAllRead || 'Marchează toate citite'}
              </button>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">
                {t.noNewNotif || 'Nu ai nicio notificare nouă.'}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {notifications.map(notif => (
                  <div key={notif.id} className={`p-4 transition-colors ${notif.is_read ? 'bg-white' : 'bg-blue-50/50'}`}>
                    <div className="flex justify-between items-start mb-2 gap-2">
                      <span className="text-xs text-slate-400 font-medium">
                        {new Date(notif.created_at).toLocaleString(t.lang === 'ro' ? 'ro-RO' : 'en-US', { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                      <div className="flex items-center gap-1">
                        {!notif.is_read && (
                          <button 
                            onClick={() => markAsRead(notif.id)}
                            className="p-1 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                            title={t.markRead || 'Marchează citită'}
                          >
                            <Check size={14} />
                          </button>
                        )}
                        <button 
                          onClick={() => deleteNotification(notif.id)}
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title={t.delete || 'Șterge'}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                    <div 
                      className="prose prose-sm max-w-none text-slate-700 text-sm leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: notif.message }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
