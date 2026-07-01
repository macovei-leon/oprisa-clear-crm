import React, { useState, useEffect } from 'react';
import { MainLayout } from '../components/layout/MainLayout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { MessageSquare, Send, Inbox, Users, Building, Code, Eye, ArrowLeft, Reply } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export const MessagesPage = () => {
  const { profile } = useAuth();
  const { t } = useLanguage();
  
  const [activeTab, setActiveTab] = useState('inbox'); // 'inbox', 'compose', 'thread'
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
      if (activeTab === 'inbox') {
        fetchMessages();
      } else if (activeTab === 'compose') {
        fetchComposeData();
      } else if (activeTab === 'thread' && activeThreadId) {
        fetchThread(activeThreadId);
      }
    }
  }, [profile, activeTab, activeThreadId]);

  const fetchMessages = async () => {
    setLoading(true);
    let query = supabase
      .from('app_messages')
      .select('*, sender:sender_id(name, email), receiver:receiver_id(name, email)')
      .or(`receiver_id.eq.${profile.id},sender_id.eq.${profile.id}`)
      .order('created_at', { ascending: false });

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
      // Mark as read any unread messages where receiver is current user
      const unreadIds = data.filter(m => m.receiver_id === profile.id && !m.is_read).map(m => m.id);
      if (unreadIds.length > 0) {
        await supabase.from('app_messages').update({ is_read: true }).in('id', unreadIds);
      }

      // Group identical messages (for department broadcasts)
      const groupedMsgs = [];
      data.forEach(msg => {
        const existing = groupedMsgs.find(g => 
          g.sender_id === msg.sender_id && 
          g.message === msg.message && 
          Math.abs(new Date(g.created_at) - new Date(msg.created_at)) < 5000
        );

        if (existing) {
          existing.all_receivers.push(msg.receiver);
          if (msg.is_read) existing.seen_by.push(msg.receiver);
        } else {
          groupedMsgs.push({
            ...msg,
            all_receivers: [msg.receiver],
            seen_by: msg.is_read ? [msg.receiver] : []
          });
        }
      });
      setThreadMessages(groupedMsgs);
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
      const sharedThreadId = uuidv4();
      const inserts = targetUserIds.map(uid => ({
        thread_id: sharedThreadId,
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
      setActiveTab('inbox');
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
    // Reply to the last person who sent a message, or default to the original receiver
    const lastOtherMsg = [...threadMessages].reverse().find(m => m.sender_id !== profile.id);
    const firstMsg = threadMessages[0];
    const otherUserId = lastOtherMsg 
      ? lastOtherMsg.sender_id 
      : (firstMsg.sender_id === profile.id ? firstMsg.receiver_id : firstMsg.sender_id);
    
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
    if (loading) return <div className="p-8 text-center text-slate-500">{t.msgLoading}</div>;
    if (messages.length === 0) return <div className="p-8 text-center text-slate-500">{t.msgNoMessages}</div>;

    return (
      <div className="w-full overflow-x-auto bg-white rounded-xl shadow-sm border border-slate-200">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
              <th className="px-4 py-3 font-semibold w-12 text-center">{t.msgStatus}</th>
              <th className="px-4 py-3 font-semibold w-1/6">{t.msgFrom}</th>
              <th className="px-4 py-3 font-semibold w-1/6">{t.msgToCol}</th>
              <th className="px-4 py-3 font-semibold">{t.msgSubject}</th>
              <th className="px-4 py-3 font-semibold w-40 text-right">{t.msgDate}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {messages.map(msg => {
              const isSentByMe = msg.sender_id === profile.id;
              const isUnread = !isSentByMe && !msg.is_read;
              const senderDisplay = msg.sender?.name || msg.sender?.email || 'System';
              const receiverDisplay = msg.receiver?.name || msg.receiver?.email || 'Unknown';
              
              return (
                <tr 
                  key={msg.id} 
                  onClick={() => { setActiveThreadId(msg.thread_id); setActiveTab('thread'); }}
                  className={`hover:bg-slate-50 cursor-pointer transition-colors ${isUnread ? 'bg-indigo-50/20' : 'bg-white'}`}
                >
                  <td className="px-4 py-4 align-top text-center">
                    <div className="flex justify-center flex-col items-center gap-1">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${!isSentByMe ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-600'}`}>
                        {!isSentByMe ? <Inbox size={16} /> : <Send size={16} />}
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">
                        {isSentByMe ? (msg.is_read ? t.msgSeen : t.msgUnread) : (msg.is_read ? t.msgRead : t.msgUnread)}
                      </span>
                    </div>
                  </td>
                  <td className={`px-4 py-4 align-top text-sm ${isUnread && !isSentByMe ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>
                    {senderDisplay}
                  </td>
                  <td className="px-4 py-4 align-top text-sm text-slate-600 font-medium">
                    {receiverDisplay}
                  </td>
                  <td className="px-4 py-4 align-top">
                    <div className={`text-sm mb-1 ${isUnread && !isSentByMe ? 'font-bold text-slate-900' : 'font-semibold text-slate-800'}`}>
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
    if (loading) return <div className="p-8 text-center text-slate-500">{t.msgLoading}</div>;
    if (threadMessages.length === 0) return null;

    const firstMsg = threadMessages[0];
    const otherPersonName = firstMsg.sender_id === profile.id ? firstMsg.receiver?.name || firstMsg.receiver?.email : firstMsg.sender?.name || firstMsg.sender?.email;

    return (
      <div className="w-full flex flex-col bg-white flex-1 min-h-full">
        {/* Thread Header */}
        <div className="px-8 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between sticky top-0 z-20 shadow-sm">
          <div className="flex items-center gap-6">
            <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-indigo-100 text-indigo-700 tracking-wider">
              TKT-{activeThreadId.substring(0, 8).toUpperCase()}
            </span>
            <div>
              <h2 className="text-xl font-bold text-slate-900 leading-tight flex items-center gap-3">
                {firstMsg.subject}
                <span className="text-sm font-normal text-slate-500">
                  {new Date(firstMsg.created_at).toLocaleString('ro-RO', { dateStyle: 'long', timeStyle: 'short' })}
                </span>
              </h2>
              <div className="text-sm text-slate-600 mt-1 flex items-center gap-2">
                <span className="text-slate-400">{t.msgFrom}:</span> 
                <span className="font-semibold text-slate-800">{otherPersonName}</span>
              </div>
            </div>
          </div>
          <button 
            onClick={() => setActiveTab('inbox')}
            className="px-4 py-2 bg-white border border-slate-300 shadow-sm rounded-lg text-slate-700 hover:bg-slate-50 transition-colors font-bold text-sm"
          >
            Înapoi la {t.msgInbox}
          </button>
        </div>

        {/* Thread Messages */}
        <div className="flex flex-col p-8 space-y-6 bg-slate-50/50 flex-1">
          {threadMessages.map((msg, index) => {
            const isMe = msg.sender_id === profile.id;
            const senderName = isMe ? 'Tu' : (msg.sender?.name || msg.sender?.email);

            return (
              <div key={msg.id} className="w-full bg-white border border-slate-200 rounded-lg shadow-sm">
                <div className="px-4 py-2 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${isMe ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-700'}`}>
                      {senderName.charAt(0).toUpperCase()}
                    </div>
                    <div className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                      {senderName}
                      <span className="text-xs font-normal text-slate-400 hidden sm:inline">
                        {isMe ? profile.email : msg.sender?.email}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-xs text-slate-400">
                      {new Date(msg.created_at).toLocaleString('ro-RO', { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                    {isMe && (
                      <div className="relative group cursor-help flex items-center gap-1">
                        {msg.seen_by && msg.seen_by.length > 0 ? (
                          <>
                            <span className="text-[10px] font-bold text-green-500">✔ {t.msgSeen}</span>
                            <div className="flex -space-x-1 ml-1">
                              {msg.seen_by.slice(0, 3).map((usr, i) => (
                                <div key={i} className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[8px] font-bold border border-white" title={usr?.name || usr?.email}>
                                  {(usr?.name || usr?.email || '?').charAt(0).toUpperCase()}
                                </div>
                              ))}
                              {msg.seen_by.length > 3 && (
                                <div className="w-4 h-4 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[8px] font-bold border border-white">
                                  +{msg.seen_by.length - 3}
                                </div>
                              )}
                            </div>
                            <div className="absolute top-full right-0 mt-1 hidden group-hover:block w-max min-w-[120px] bg-slate-800 text-white text-[10px] rounded px-2 py-1.5 z-50 shadow-lg">
                              <div className="font-semibold mb-1 border-b border-slate-600 pb-1">Văzut de:</div>
                              {msg.seen_by.map((u, i) => (
                                <div key={i} className="py-0.5">• {u?.name || u?.email}</div>
                              ))}
                            </div>
                          </>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-400">{t.msgUnread}</span>
                        )}
                      </div>
                    )}
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
        <div className="p-8 bg-white border-t border-slate-200 sticky bottom-0 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] mt-auto">
          <div className="border border-slate-300 rounded-lg overflow-hidden focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all shadow-sm">
            <div className="flex border-b border-slate-200 bg-slate-50">
              <button
                onClick={() => setReplyPreviewMode(false)}
                className={`px-4 py-2.5 text-xs font-bold transition-colors border-b-2 ${!replyPreviewMode ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                {t.msgReply}
              </button>
              <button
                onClick={() => setReplyPreviewMode(true)}
                className={`px-4 py-2.5 text-xs font-bold transition-colors border-b-2 ${replyPreviewMode ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                {t.msgPreview}
              </button>
            </div>
            
            {!replyPreviewMode ? (
              <textarea
                value={replyBody}
                onChange={e => setReplyBody(e.target.value)}
                placeholder={t.msgReplyPlaceholder}
                className="w-full h-40 p-4 focus:outline-none text-sm resize-y font-mono"
              />
            ) : (
              <div 
                className="w-full h-40 p-4 overflow-y-auto prose prose-sm max-w-none bg-white"
                dangerouslySetInnerHTML={{ __html: replyBody || `<p class="text-slate-400 italic">${t.msgMessageEmpty}</p>` }}
              />
            )}
            
            <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-400">{t.msgReplyInfo}</span>
              <button 
                onClick={handleReply}
                disabled={isSending || !replyBody.trim()}
                className="px-8 py-2.5 bg-indigo-600 text-white font-bold text-sm rounded-md hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 transition-colors shadow-sm"
              >
                <Reply size={16} /> {t.msgReply}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderCompose = () => (
    <div className="max-w-4xl mx-auto w-full bg-white rounded-xl shadow-sm border border-slate-200 p-8">
      <div className="flex items-center gap-4 border-b border-slate-200 pb-4 mb-8">
        <button 
          onClick={() => setActiveTab('inbox')}
          className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <Send className="text-indigo-600" size={26} />
            {t.msgCreateNewTicket}
          </h2>
          <p className="text-slate-500 text-sm mt-1">{t.msgTicketDesc}</p>
        </div>
      </div>
      
      <div className="space-y-6 max-w-4xl">
        <div className="grid grid-cols-1 md:grid-cols-[150px_1fr] items-center gap-4">
          <label className="text-sm font-bold text-slate-700">{t.msgRecipientType}</label>
          <div className="flex gap-4">
            <button 
              onClick={() => setTargetType('user')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md border font-semibold transition-all ${targetType === 'user' ? 'border-indigo-600 text-indigo-700 bg-indigo-50 shadow-sm' : 'border-slate-300 text-slate-600 hover:border-slate-400'}`}
            >
              <Users size={16} /> {t.msgPerson}
            </button>
            <button 
              onClick={() => setTargetType('department')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md border font-semibold transition-all ${targetType === 'department' ? 'border-indigo-600 text-indigo-700 bg-indigo-50 shadow-sm' : 'border-slate-300 text-slate-600 hover:border-slate-400'}`}
            >
              <Building size={16} /> {t.msgDepartment}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[150px_1fr] items-center gap-4">
          <label className="text-sm font-bold text-slate-700">{t.msgTo}</label>
          {targetType === 'department' ? (
            <select 
              value={selectedDept} 
              onChange={e => setSelectedDept(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <option value="">{t.msgSelectDepartment}</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          ) : (
            <select 
              value={selectedUser} 
              onChange={e => setSelectedUser(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <option value="">{t.msgSelectUser}</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
            </select>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[150px_1fr] items-center gap-4">
          <label className="text-sm font-bold text-slate-700">{t.msgSubject}</label>
          <input
            type="text"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder={t.msgSubjectPlaceholder}
            className="w-full px-4 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        <div className="pt-2">
          <label className="block text-sm font-bold text-slate-700 mb-2">{t.msgMessageContent}</label>
          <div className="border border-slate-300 rounded-md overflow-hidden focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all shadow-sm">
            <div className="flex border-b border-slate-200 bg-slate-50">
              <button
                onClick={() => setPreviewMode(false)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold transition-colors border-b-2 ${!previewMode ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                <Code size={16} /> {t.msgEditHtml}
              </button>
              <button
                onClick={() => setPreviewMode(true)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold transition-colors border-b-2 ${previewMode ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                <Eye size={16} /> {t.msgPreview}
              </button>
            </div>

            {!previewMode ? (
              <textarea
                value={messageBody}
                onChange={e => setMessageBody(e.target.value)}
                placeholder={t.msgMessagePlaceholder}
                className="w-full h-64 p-4 focus:outline-none text-sm resize-y font-mono"
              />
            ) : (
              <div 
                className="w-full h-64 p-4 overflow-y-auto prose max-w-none bg-white"
                dangerouslySetInnerHTML={{ __html: messageBody || `<p class="text-slate-400 italic">${t.msgMessageEmpty}</p>` }}
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
            <Send size={18} /> {isSending ? t.msgSending : t.msgOpenTicketBtn}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <MainLayout title={t.msgInternalMessages} subtitle={t.msgTicketSystem} noPadding={activeTab === 'thread'}>
      <div className="w-full flex-1 flex flex-col">
        {activeTab === 'inbox' && (
          <div className="flex justify-between items-center mb-6 w-full">
            <h2 className="text-xl font-bold text-slate-800">{t.msgInbox}</h2>
            <button
              onClick={() => setActiveTab('compose')}
              className="px-4 py-2 bg-indigo-600 text-white font-bold text-sm rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-sm"
            >
              <MessageSquare size={16} /> {t.msgCreateNewTicket}
            </button>
          </div>
        )}
        
        <div className="w-full flex-1 flex flex-col">
          {activeTab === 'inbox' && renderMessageList()}
          {activeTab === 'compose' && renderCompose()}
          {activeTab === 'thread' && renderThread()}
        </div>
      </div>
    </MainLayout>
  );
};
