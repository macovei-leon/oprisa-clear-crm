import React, { useState, useEffect } from 'react';
import { MainLayout } from '../components/layout/MainLayout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { MessageSquare, Send, Inbox, Users, Building, Code, Eye, ArrowLeft, Reply, CornerDownRight } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export const MessagesPage = () => {
  const { profile } = useAuth();
  
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
    if (!subject.trim() || !messageBody.trim()) return alert('Subiectul și mesajul sunt obligatorii.');

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

      alert(`Mesaj trimis cu succes către ${targetUserIds.length} utilizator(i).`);
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
    if (!replyBody.trim()) return alert('Mesajul nu poate fi gol.');
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
    if (messages.length === 0) return <div className="p-8 text-center text-slate-500">Nu există mesaje aici.</div>;

    return (
      <div className="overflow-x-auto w-full">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
              <th className="px-4 py-3 font-semibold w-12 text-center">Stare</th>
              <th className="px-4 py-3 font-semibold w-1/4">{activeTab === 'inbox' ? 'De la' : 'Către'}</th>
              <th className="px-4 py-3 font-semibold">Subiect</th>
              <th className="px-4 py-3 font-semibold w-40 text-right">Dată</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {messages.map(msg => {
              const isUnread = activeTab === 'inbox' && !msg.is_read;
              const otherPerson = activeTab === 'inbox' ? msg.sender?.name || msg.sender?.email : msg.receiver?.name || msg.receiver?.email;
              
              return (
                <tr 
                  key={msg.id} 
                  onClick={() => { setActiveThreadId(msg.thread_id); setActiveTab('thread'); }}
                  className={`hover:bg-slate-50 cursor-pointer transition-colors ${isUnread ? 'bg-indigo-50/20' : 'bg-white'}`}
                >
                  <td className="px-4 py-4 align-top text-center">
                    <div className="flex justify-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${activeTab === 'inbox' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-600'}`}>
                        {activeTab === 'inbox' ? <Inbox size={16} /> : <Send size={16} />}
                      </div>
                    </div>
                  </td>
                  <td className={`px-4 py-4 align-top text-sm ${isUnread ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>
                    {otherPerson}
                  </td>
                  <td className="px-4 py-4 align-top">
                    <div className={`text-sm mb-1 ${isUnread ? 'font-bold text-slate-900' : 'font-semibold text-slate-800'}`}>
                      {msg.subject}
                    </div>
                    <div className="text-xs text-slate-500 line-clamp-1" dangerouslySetInnerHTML={{ __html: msg.message.substring(0, 100) + '...' }}></div>
                  </td>
                  <td className="px-4 py-4 align-top text-xs text-slate-500 whitespace-nowrap text-right">
                    {new Date(msg.created_at).toLocaleString('ro-RO', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const renderThread = () => {
    if (loading) return <div className="p-8 text-center text-slate-500">Se încarcă conversația...</div>;
    if (threadMessages.length === 0) return null;

    const firstMsg = threadMessages[0];
    const otherPersonName = firstMsg.sender_id === profile.id ? firstMsg.receiver?.name || firstMsg.receiver?.email : firstMsg.sender?.name || firstMsg.sender?.email;

    return (
      <div className="flex flex-col h-full bg-slate-50">
        {/* Thread Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center gap-4 sticky top-0 z-10 shadow-sm">
          <button 
            onClick={() => setActiveTab('inbox')}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-800">{firstMsg.subject}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                Ticket ID: {activeThreadId.substring(0, 8).toUpperCase()}
              </span>
              <span className="text-sm text-slate-500">
                Contact: <span className="font-semibold text-slate-700">{otherPersonName}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Thread Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {threadMessages.map((msg, index) => {
            const isMe = msg.sender_id === profile.id;
            const senderName = isMe ? 'Tu' : (msg.sender?.name || msg.sender?.email);

            return (
              <div key={msg.id} className="w-full bg-white border border-slate-200 rounded-lg shadow-sm">
                <div className="px-6 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${isMe ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-700'}`}>
                      {senderName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-slate-800 text-sm">
                        {senderName}
                      </div>
                      <div className="text-xs text-slate-500">
                        {isMe ? profile.email : msg.sender?.email}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs font-medium text-slate-400">
                    {new Date(msg.created_at).toLocaleString('ro-RO', { dateStyle: 'full', timeStyle: 'short' })}
                  </div>
                </div>
                <div className="px-6 py-5">
                  <div 
                    className="prose prose-slate max-w-none text-sm text-slate-800"
                    dangerouslySetInnerHTML={{ __html: msg.message }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Reply Area */}
        <div className="p-6 bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <div className="border border-slate-300 rounded-lg overflow-hidden focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all shadow-sm">
            <div className="flex border-b border-slate-200 bg-slate-50">
              <button
                onClick={() => setReplyPreviewMode(false)}
                className={`px-4 py-2.5 text-xs font-bold transition-colors border-b-2 ${!replyPreviewMode ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                Răspuns
              </button>
              <button
                onClick={() => setReplyPreviewMode(true)}
                className={`px-4 py-2.5 text-xs font-bold transition-colors border-b-2 ${replyPreviewMode ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                Previzualizare
              </button>
            </div>
            
            {!replyPreviewMode ? (
              <textarea
                value={replyBody}
                onChange={e => setReplyBody(e.target.value)}
                placeholder="Apasă aici pentru a scrie un răspuns (suportă HTML)..."
                className="w-full h-32 p-4 focus:outline-none text-sm resize-y font-mono"
              />
            ) : (
              <div 
                className="w-full h-32 p-4 overflow-y-auto prose prose-sm max-w-none bg-white"
                dangerouslySetInnerHTML={{ __html: replyBody || '<p class="text-slate-400 italic">Mesajul este gol...</p>' }}
              />
            )}
            
            <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-400">Răspunsul va fi adăugat ca un nou mesaj în acest ticket.</span>
              <button 
                onClick={handleReply}
                disabled={isSending || !replyBody.trim()}
                className="px-6 py-2 bg-indigo-600 text-white font-bold text-sm rounded-md hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 transition-colors shadow-sm"
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
    <div className="p-8 max-w-4xl mx-auto bg-white min-h-full">
      <div className="border-b border-slate-200 pb-4 mb-8">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
          <Send className="text-indigo-600" size={26} />
          Deschide Ticket Nou
        </h2>
        <p className="text-slate-500 text-sm mt-1">Creează o nouă solicitare sau mesaj direct.</p>
      </div>
      
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-[150px_1fr] items-center gap-4">
          <label className="text-sm font-bold text-slate-700">Tip Destinatar:</label>
          <div className="flex gap-4">
            <button 
              onClick={() => setTargetType('user')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md border font-semibold transition-all ${targetType === 'user' ? 'border-indigo-600 text-indigo-700 bg-indigo-50 shadow-sm' : 'border-slate-300 text-slate-600 hover:border-slate-400'}`}
            >
              <Users size={16} /> Persoană
            </button>
            <button 
              onClick={() => setTargetType('department')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md border font-semibold transition-all ${targetType === 'department' ? 'border-indigo-600 text-indigo-700 bg-indigo-50 shadow-sm' : 'border-slate-300 text-slate-600 hover:border-slate-400'}`}
            >
              <Building size={16} /> Departament
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[150px_1fr] items-center gap-4">
          <label className="text-sm font-bold text-slate-700">Către:</label>
          {targetType === 'department' ? (
            <select 
              value={selectedDept} 
              onChange={e => setSelectedDept(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <option value="">-- Selectează Departament --</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          ) : (
            <select 
              value={selectedUser} 
              onChange={e => setSelectedUser(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <option value="">-- Selectează Utilizator --</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
            </select>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[150px_1fr] items-center gap-4">
          <label className="text-sm font-bold text-slate-700">Subiect:</label>
          <input
            type="text"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="Introduceți subiectul solicitării..."
            className="w-full px-4 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        <div className="pt-2">
          <label className="block text-sm font-bold text-slate-700 mb-2">Conținut Mesaj:</label>
          <div className="border border-slate-300 rounded-md overflow-hidden focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all shadow-sm">
            <div className="flex border-b border-slate-200 bg-slate-50">
              <button
                onClick={() => setPreviewMode(false)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold transition-colors border-b-2 ${!previewMode ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                <Code size={16} /> Editare (HTML)
              </button>
              <button
                onClick={() => setPreviewMode(true)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold transition-colors border-b-2 ${previewMode ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                <Eye size={16} /> Previzualizare
              </button>
            </div>

            {!previewMode ? (
              <textarea
                value={messageBody}
                onChange={e => setMessageBody(e.target.value)}
                placeholder="Scrie corpul mesajului aici..."
                className="w-full h-64 p-4 focus:outline-none text-sm resize-y font-mono"
              />
            ) : (
              <div 
                className="w-full h-64 p-4 overflow-y-auto prose max-w-none bg-white"
                dangerouslySetInnerHTML={{ __html: messageBody || '<p class="text-slate-400 italic">Mesajul este gol...</p>' }}
              />
            )}
          </div>
        </div>

        <div className="flex justify-end pt-6 border-t border-slate-200 mt-6">
          <button 
            onClick={handleSendCompose}
            disabled={isSending || !subject.trim() || !messageBody.trim()}
            className="px-8 py-2.5 bg-indigo-600 text-white font-bold rounded-md hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 transition-colors shadow-md shadow-indigo-600/20"
          >
            <Send size={18} /> {isSending ? 'Se trimite...' : 'Deschide Ticket'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <MainLayout title="Mesaje Interne" subtitle="Sistem de comunicare tip ticket">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[600px] h-full">
        {activeTab !== 'thread' && (
          <div className="flex border-b border-slate-200 bg-slate-50 p-2 gap-2">
            <button
              onClick={() => setActiveTab('inbox')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-colors ${activeTab === 'inbox' ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:bg-slate-200/50'}`}
            >
              <Inbox size={18} /> Inbox
            </button>
            <button
              onClick={() => setActiveTab('sent')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-colors ${activeTab === 'sent' ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:bg-slate-200/50'}`}
            >
              <CornerDownRight size={18} /> Trimise
            </button>
            <button
              onClick={() => setActiveTab('compose')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-colors ${activeTab === 'compose' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
            >
              <MessageSquare size={18} /> Mesaj Nou
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
