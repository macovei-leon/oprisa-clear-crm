import React, { useState, useEffect } from 'react';
import { X, Clock, User, CheckCircle2, MessageSquare, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export const CardTimelineModal = ({ taskId, onClose }) => {
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cardData, setCardData] = useState(null);

  useEffect(() => {
    if (taskId) fetchTimeline();
  }, [taskId]);

  const fetchTimeline = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('crm_repetitive_history')
        .select(`
          id, category, step_name, action_type, notes, created_at, card_snapshot,
          profiles ( name, email )
        `)
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setTimeline(data || []);
      
      // Use the most recent snapshot for the card header
      if (data && data.length > 0) {
        setCardData(data[data.length - 1].card_snapshot);
      }
    } catch (err) {
      console.error('Error fetching timeline:', err);
    } finally {
      setLoading(false);
    }
  };

  const displayName = cardData?.nume_complet || cardData?.nume || cardData?.name || cardData?.denumire || cardData?.titlu || 'FIȘĂ DOSAR CAMPANIE SARCINI';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-white shrink-0">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Istoric Interacțiuni Card</span>
            <h2 className="text-xl font-black text-slate-800 mt-1 line-clamp-1">{displayName}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 bg-slate-50 p-2 rounded-full hover:bg-slate-100 transition-all">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
          {loading ? (
            <div className="text-center py-10 text-slate-500 font-bold animate-pulse">Se încarcă istoricul...</div>
          ) : timeline.length === 0 ? (
            <div className="text-center py-10 text-slate-500">Nu există istoric salvat pentru acest card.</div>
          ) : (
            <div className="flex flex-col gap-6 relative">
              {/* Vertical line connecting timeline items */}
              <div className="absolute left-[27px] top-4 bottom-4 w-0.5 bg-slate-200"></div>
              
              {timeline.map((item, idx) => {
                const date = new Date(item.created_at);
                const isCompletion = item.action_type === 'COMPLETION';
                
                return (
                  <div key={item.id} className="flex gap-4 relative z-10">
                    {/* Icon */}
                    <div className={`w-14 h-14 rounded-full flex shrink-0 items-center justify-center border-4 border-slate-50 ${isCompletion ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'}`}>
                      {isCompletion ? <CheckCircle2 size={24} /> : <ArrowRight size={24} />}
                    </div>
                    
                    {/* Details Card */}
                    <div className="flex-1 bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800 text-sm">{item.category}</span>
                          <span className="text-xs text-slate-500 font-medium">Etapă curentă: {item.step_name}</span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-xs font-bold text-slate-400">{date.toLocaleDateString('ro-RO')}</span>
                          <span className="text-sm font-bold text-indigo-600">{date.toLocaleTimeString('ro-RO')}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-slate-50 px-3 py-2 rounded-lg mb-3">
                        <User size={14} className="text-slate-400" /> 
                        {item.profiles?.name || item.profiles?.email || 'Nevalabil'}
                      </div>
                      
                      {item.notes ? (
                        <div className="bg-amber-50 border border-amber-100 p-3 rounded-lg flex items-start gap-2">
                          <MessageSquare size={16} className="text-amber-600 shrink-0 mt-0.5" />
                          <p className="text-sm text-amber-900 font-medium whitespace-pre-wrap">{item.notes}</p>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 italic">Nu a fost adăugată nicio notiță.</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
