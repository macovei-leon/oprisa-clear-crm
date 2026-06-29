import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { MainLayout } from '../../components/layout/MainLayout';
import { supabase } from '../../lib/supabase';
import { RepetitiveKanbanBoard } from '../../components/campaigns/RepetitiveKanbanBoard';
import { Megaphone, Search, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';

export const RepetitiveFlashcardsPage = () => {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const location = useLocation();
  const [flows, setFlows] = useState([]);
  const [activeFlow, setActiveFlow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchCampaigns();
  }, [location.search]);

  const fetchCampaigns = async () => {
    try {
      const searchParams = new URLSearchParams(location.search);
      const urlFlowId = searchParams.get('flowId');

      let query = supabase
        .from('crm_repetitive_flows')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (urlFlowId) {
        query = query.eq('id', urlFlowId);
      }

      const { data, error } = await query;
        
      if (error) throw error;
      setFlows(data || []);
      
      if (data && data.length > 0) {
        if (urlFlowId) {
          const selected = data.find(c => c.id === urlFlowId);
          setActiveFlow(selected || data[0]);
        } else if (!activeFlow) {
          setActiveFlow(data[0]);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredCampaigns = flows.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <MainLayout title={t.titleFleetTasks || "Sarcini Flotă (Flashcards)"} subtitle={t.subFleetTasks || "Gestionare sarcini și campanii active"}>
      <div className="flex h-[calc(100vh-140px)] gap-6">
        


        {/* Main Content: Kanban Board */}
        <div className="flex-1 flex flex-col bg-slate-50/50 border border-slate-200 rounded-xl overflow-hidden relative">
          {activeFlow ? (
            <RepetitiveKanbanBoard flow={activeFlow} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <Megaphone size={48} className="mb-4 text-slate-300" />
              <p className="font-bold text-lg text-slate-500">{t.msgNoCampSelected || "Nicio campanie selectată"}</p>
              <p className="text-sm">{t.msgSelectCampInfo || "Selectează o campanie din meniul din stânga pentru a vizualiza sarcinile."}</p>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};
