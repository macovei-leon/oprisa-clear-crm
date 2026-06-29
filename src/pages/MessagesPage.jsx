import React, { useState, useEffect } from 'react';
import { MainLayout } from '../components/layout/MainLayout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { MessageSquare, Send, Inbox, Users, Building, Code, Eye, ArrowLeft, Reply, CornerDownRight } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export const MessagesPage = () => {
  const { profile } = useAuth();
  const { t } = useLanguage();
  
  const [activeTab, setActiveTab] = useState('inbox'); // 'inbox', 'sent', 'compose', 'thread'
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  
  // Compose State
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [targetType, setTargetType] = useState('user'); // 'department', 'user'
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [subject, setSubject] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [previewMode, setPreviewMode] = useState(false);
  const [isSending, setIsSending] = useState(false);
  
  // Thread State
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [threadMessages, setThreadMessages] = useState([]);
  const [replyBody, setReplyBody] = useState('');
  const [replyPreviewMode, setReplyPreviewMode] = useState(false);

  useEffect(() => {
    if (profile?.id) {
      if (activeTab === 'inbox' || activeTab === 'sent') {
        fetchMessages(activeTab);
      } else if (activeTab === 'compose') {
        fetchComposeData();
      } else if (activeTab === 'thread' && activeThreadId) {
        fetchThread(activeThreadId);
      }
    }
  }, [profile, activeTab, activeThreadId]);

  const fetchMessages = async (type) => {
    setLoading(true);
    let query = supabase
      .from('app_messages')
      .select('*, sender:sender_id(name, email), receiver:receiver_id(name, email)')
      .order('created_at', { ascending: false });

    if (type === 'inbox') {
      query = query.eq('receiver_id', profile.id);
    } else {
      query = query.eq('sender_id', profile.id);
    }

    const { data } = await query;
    if (data) {
      // Group by thread to show only latest message per thread
      const threads = {};
      data.forEach(msg => {
        if (!threads[msg.thread_id] || new Date(msg.created_at) > new Date(threads[msg.thread_id].created_at)) {
          threads[msg.thread_id] = msg;
        }
      });
      setMessages(Object.values(threads).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
    }
    setLoading(false);
  };

  const fetchComposeData = async () => {
    if (departments.length === 0) {
      const { data: depts } = await supabase.from('departments').select('*').order('name');
      if (depts) setDepartments(depts);
    }
    if (users.length === 0) {
      const { data: profs } = await supabase.from('profiles').select('*').order('name');
      if (profs) setUsers(profs.filter(u => u.id !== profile.id)); // Exclude self
    }
  };

  const fetchThread = async (threadId) => {
    setLoading(true);
    const { data } = await supabase
      .from('app_messages')
      .select('*, sender:sender_id(name, email), receiver:receiver_id(name, email)')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });
      
    if (data) {
      setThreadMessages(data);
      
      // Mark as read any unread messages where receiver is current user
      const unreadIds = data.filter(m => m.receiver_id === profile.id && !m.is_read).map(m => m.id);
      if (unreadIds.length > 0) {
        await supabase.from('app_messages').update({ is_read: true }).in('id', unreadIds);
      }
    }
    setLoading(false);
  };

  const handleSendCompose = async () => {
    if (!subject.trim() || !messageBody.trim()) return alert(t.msgReqSubjectBody || 'Subiectul și mesajul sunt obligatorii.');

    setIsSending(true);
    let targetUserIds = [];

    if (targetType === 'department') {
      if (!selectedDept) { setIsSending(false); return alert('Selectează un departament.'); }
      targetUserIds = users.filter(u => u.department_id === selectedDept && u.status !== 'pending').map(u => u.id);
    } else if (targetType === 'user') {
      if (!selectedUser) { setIsSending(false); return alert('Selectează un utilizator.'); }
      targetUserIds = [selectedUser];
    }

    if (targetUserIds.length === 0) {
      setIsSending(false);
      return alert('Niciun utilizator găsit pentru această selecție.');
    }

    try {
      const inserts = targetUserIds.map(uid => ({
        thread_id: uuidv4(),
        sender_id: profile.id,
        receiver_id: uid,
        subject: subject,
        message: messageBody,
        is_read: false
      }));

      const { error } = await supabase.from('app_messages').insert(inserts);
      if (error) throw error;

      alert(`${t.msgSentSuccess || 'Mesaj trimis cu succes către'} ${targetUserIds.length} utilizator(i).`);
      setSubject('');
      setMessageBody('');
      setActiveTab('sent');
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSending(false);
    }
  };

  const handleReply = async () => {
    if (!replyBody.trim()) return alert(t.msgEmptyReply || 'Mesajul nu poate fi gol.');
    if (threadMessages.length === 0) return;

    setIsSending(true);
    // Find the other person in the thread
    const firstMsg = threadMessages[0];
    const otherUserId = firstMsg.sender_id === profile.id ? firstMsg.receiver_id : firstMsg.sender_id;
    
    try {
      const { error } = await supabase.from('app_messages').insert({
        thread_id: activeThreadId,
        sender_id: profile.id,
        receiver_id: otherUserId,
        subject: firstMsg.subject.startsWith('Re:') ? firstMsg.subject : `Re: ${firstMsg.subject}`,
        message: replyBody,
        is_read: false
      });

      if (error) throw error;
      setReplyBody('');
      setReplyPreviewMode(false);
      fetchThread(activeThreadId); // refresh
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSending(false);
    }
  };

  const renderMessageList = () => {
    if (loading) return <div className="p-8 text-center text-slate-500">Se încarcă...</div>;
    if (messages.length === 0) return <div className="p-8 text-center text-slate-500">{t.msgNoMessages || 'Nu există mesaje aici.'}</div>;

    return (
      <div className="divide-y divide-slate-100">
        {messages.map(msg => {
          const isUnread = activeTab === 'inbox' && !msg.is_read;
          const otherPerson = activeTab === 'inbox' ? msg.sender?.name || msg.sender?.email : msg.receiver?.name || msg.receiver?.email;
          
          return (
            <div 
              key={msg.id} 
              onClick={() => { setActiveThreadId(msg.thread_id); setActiveTab('thread'); }}
              className={`p-4 hover:bg-slate-50 cursor-pointer flex items-start gap-4 transition-colors ${isUnread ? 'bg-indigo-50/30' : ''}`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${activeTab === 'inbox' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-600'}`}>
                {activeTab === 'inbox' ? <Inbox size={18} /> : <Send size={18} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-1">
                  <span className={`text-sm truncate ${isUnread ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>
                    {activeTab === 'inbox' ? `De la: ${otherPerson}` : `Către: ${otherPerson}`}
                  </span>
                  <span className="text-xs text-slate-400 whitespace-nowrap ml-2">
                    {new Date(msg.created_at).toLocaleString('ro-RO', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>
                <div className={`text-base truncate mb-1 ${isUnread ? 'font-bold text-slate-900' : 'font-semibold text-slate-800'}`}>
                  {msg.subject}
                </div>
                <div className="text-sm text-slate-500 truncate" dangerouslySetInnerHTML={{ __html: msg.message.substring(0, 100) + '...' }}></div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderThread = () => {
    if (loading) return <div className="p-8 text-center text-slate-500">Se încarcă conversația...</div>;
    if (threadMessages.length === 0) return null;

    const firstMsg = threadMessages[0];
    const otherPersonName = firstMsg.sender_id === profile.id ? firstMsg.receiver?.name || firstMsg.receiver?.email : firstMsg.sender?.name || firstMsg.sender?.email;

    return (
      <div className="flex flex-col h-full bg-white">
        {/* Thread Header */}
        <div className="p-4 border-b border-slate-100 flex items-center gap-4 bg-slate-50 sticky top-0 z-10">
          <button 
            onClick={() => setActiveTab('inbox')}
            className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-lg font-bold text-slate-800">{firstMsg.subject}</h2>
            <p className="text-sm text-slate-500">Conversație cu {otherPersonName}</p>
          </div>
        </div>

        {/* Thread Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
          {threadMessages.map((msg, index) => {
            const isMe = msg.sender_id === profile.id;
            const senderName = isMe ? 'Tu' : (msg.sender?.name || msg.sender?.email);
            const isFirst = index === 0;

            return (
              <div key={msg.id} className="w-full bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="bg-slate-50/80 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
                      {senderName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-slate-800 text-sm">{senderName}</div>
                      <div className="text-xs text-slate-500">
                        {isMe ? profile.email : msg.sender?.email}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs font-medium text-slate-500">
                    {new Date(msg.created_at).toLocaleString('ro-RO', { dateStyle: 'full', timeStyle: 'short' })}
                  </div>
                </div>
                <div className="p-6">
                  <div 
                    className="prose prose-slate max-w-none prose-a:text-indigo-600 prose-headings:text-slate-800 text-sm text-slate-700"
                    dangerouslySetInnerHTML={{ __html: msg.message }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Reply Area */}
        <div className="p-4 border-t border-slate-100 bg-white">
          <div className="border border-slate-200 rounded-xl overflow-hidden focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
            <div className="flex border-b border-slate-100 bg-slate-50">
              <button
                onClick={() => setReplyPreviewMode(false)}
                className={`px-4 py-2 text-xs font-bold transition-colors border-b-2 ${!replyPreviewMode ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                Editare
              </button>
              <button
                onClick={() => setReplyPreviewMode(true)}
                className={`px-4 py-2 text-xs font-bold transition-colors border-b-2 ${replyPreviewMode ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                Previzualizare
              </button>
            </div>
            
            {!replyPreviewMode ? (
              <textarea
                value={replyBody}
                onChange={e => setReplyBody(e.target.value)}
                placeholder="Scrie un răspuns..."
                className="w-full h-32 p-3 focus:outline-none text-sm resize-none"
              />
            ) : (
              <div 
                className="w-full h-32 p-3 overflow-y-auto prose prose-sm max-w-none bg-white"
                dangerouslySetInnerHTML={{ __html: replyBody || `<p class="text-slate-400 italic">${t.lblMsgEmpty || 'Mesajul este gol...'}</p>` }}
              />
            )}
            
            <div className="p-2 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button 
                onClick={handleReply}
                disabled={isSending || !replyBody.trim()}
                className="px-4 py-1.5 bg-indigo-600 text-white font-bold text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
              >
                <Reply size={16} /> Răspunde
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderCompose = () => (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
        <Send className="text-indigo-600" size={24} />
        {t.tabCompose || 'Mesaj Nou'}
      </h2>
      
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-3">Trimite către:</label>
          <div className="flex gap-4 mb-4">
            <button 
              onClick={() => setTargetType('user')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border-2 font-semibold transition-all ${targetType === 'user' ? 'border-indigo-600 text-indigo-700 bg-indigo-50' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
            >
              <Users size={18} /> Persoană
            </button>
            <button 
              onClick={() => setTargetType('department')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border-2 font-semibold transition-all ${targetType === 'department' ? 'border-indigo-600 text-indigo-700 bg-indigo-50' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
            >
              <Building size={18} /> Departament
            </button>
          </div>

          {targetType === 'department' && (
            <select 
              value={selectedDept} 
              onChange={e => setSelectedDept(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-500"
            >
              <option value="">-- Selectează Departament --</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}

          {targetType === 'user' && (
            <select 
              value={selectedUser} 
              onChange={e => setSelectedUser(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-500"
            >
              <option value="">-- Selectează Utilizator --</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
            </select>
          )}
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">{t.lblSubject || 'Subiect'}</label>
          <input
            type="text"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="Subiectul mesajului..."
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">{t.lblMsgContent || 'Conținut Mesaj'}</label>
          <div className="border border-slate-200 rounded-xl overflow-hidden focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
            <div className="flex border-b border-slate-100 bg-slate-50">
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
                value={messageBody}
                onChange={e => setMessageBody(e.target.value)}
                placeholder={t.phMsgBody || "Scrie corpul mesajului aici..."}
                className="w-full h-64 p-4 focus:outline-none text-sm resize-y font-mono"
              />
            ) : (
              <div 
                className="w-full h-64 p-4 overflow-y-auto prose max-w-none bg-white"
                dangerouslySetInnerHTML={{ __html: messageBody || `<p class="text-slate-400 italic">${t.lblMsgEmpty || 'Mesajul este gol...'}</p>` }}
              />
            )}
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button 
            onClick={handleSendCompose}
            disabled={isSending || !subject.trim() || !messageBody.trim()}
            className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 transition-colors shadow-md shadow-indigo-600/20"
          >
            <Send size={18} /> {isSending ? (t.btnSendingMsg || 'Se trimite...') : (t.btnSendMsg || 'Trimite Mesaj')}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <MainLayout title={t.navMessagesInternal || "Mesaje Interne"} subtitle={t.subMessages || "Sistem de comunicare tip ticket"}>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[600px] h-full">
        {activeTab !== 'thread' && (
          <div className="flex border-b border-slate-200 bg-slate-50 p-2 gap-2">
            <button
              onClick={() => setActiveTab('inbox')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-colors ${activeTab === 'inbox' ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:bg-slate-200/50'}`}
            >
              <Inbox size={18} /> {t.tabInbox || 'Inbox'}
            </button>
            <button
              onClick={() => setActiveTab('sent')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-colors ${activeTab === 'sent' ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:bg-slate-200/50'}`}
            >
              <CornerDownRight size={18} /> {t.tabSent || 'Trimise'}
            </button>
            <button
              onClick={() => setActiveTab('compose')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-colors ${activeTab === 'compose' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
            >
              <MessageSquare size={18} /> {t.tabCompose || 'Mesaj Nou'}
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {activeTab === 'inbox' && renderMessageList()}
          {activeTab === 'sent' && renderMessageList()}
          {activeTab === 'compose' && renderCompose()}
          {activeTab === 'thread' && renderThread()}
        </div>
      </div>
    </MainLayout>
  );
};
