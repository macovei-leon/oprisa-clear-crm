import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { MainLayout } from '../../components/layout/MainLayout';
import { supabase } from '../../lib/supabase';
import { KanbanBoard } from '../../components/campaigns/KanbanBoard';
import { Megaphone, Search, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export const FlashcardsPage = () => {
  const { profile } = useAuth();
  const location = useLocation();
  const [campaigns, setCampaigns] = useState([]);
  const [activeCampaign, setActiveCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchCampaigns();
  }, [location.search]);

  const fetchCampaigns = async () => {
    try {
      const searchParams = new URLSearchParams(location.search);
      const urlCampaignId = searchParams.get('campaignId');

      let query = supabase
        .from('crm_campaigns')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (urlCampaignId) {
        query = query.eq('id', urlCampaignId);
      }

      const { data, error } = await query;
        
      if (error) throw error;
      setCampaigns(data || []);
      
      if (data && data.length > 0) {
        if (urlCampaignId) {
          const selected = data.find(c => c.id === urlCampaignId);
          setActiveCampaign(selected || data[0]);
        } else if (!activeCampaign) {
          setActiveCampaign(data[0]);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredCampaigns = campaigns.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <MainLayout title="Sarcini Flotă (Flashcards)" subtitle="Gestionare sarcini și campanii active">
      <div className="flex h-[calc(100vh-140px)] gap-6">
        


        {/* Main Content: Kanban Board */}
        <div className="flex-1 flex flex-col bg-slate-50/50 border border-slate-200 rounded-xl overflow-hidden relative">
          {activeCampaign ? (
            <KanbanBoard campaign={activeCampaign} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <Megaphone size={48} className="mb-4 text-slate-300" />
              <p className="font-bold text-lg text-slate-500">Nicio campanie selectată</p>
              <p className="text-sm">Selectează o campanie din meniul din stânga pentru a vizualiza sarcinile.</p>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};
