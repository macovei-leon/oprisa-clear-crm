import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { supabase } from '../../lib/supabase';
import { Bolt, LayoutDashboard, ShieldAlert, LogOut, Users, UserCog, Database, ClipboardList, Megaphone, ChevronDown, ChevronRight, Zap, Code, Network, BookOpen, BellRing, MessageSquare, Edit2 } from 'lucide-react';

export const Sidebar = () => {
  const { profile, signOut, simulatedDepartment, setSimulatedDepartment } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();

  const [campaigns, setCampaigns] = useState([]);
  const [repetitiveFlows, setRepetitiveFlows] = useState([]);
  const [isCampaignsOpen, setIsCampaignsOpen] = useState(true);
  const [isRepetitiveOpen, setIsRepetitiveOpen] = useState(true);

  const isSimulating = !!simulatedDepartment;
  const effectiveRole = isSimulating ? 'operator' : profile?.role;

  useEffect(() => {
    if (profile) {
      fetchUserCampaigns();
    }
  }, [profile, simulatedDepartment]);

  const fetchUserCampaigns = async () => {
    try {
      let campaignIds = [];

      if (effectiveRole === 'admin') {
        const { data: camps, error: campsError } = await supabase
          .from('crm_campaigns')
          .select('id, name')
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (campsError) throw campsError;
        setCampaigns(camps || []);

        const { data: flows, error: flowsError } = await supabase
          .from('crm_repetitive_flows')
          .select('id, name')
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (flowsError) throw flowsError;
        setRepetitiveFlows(flows || []);
        return;
      } else {
        let userIds = [profile.id];
        
        if (isSimulating) {
          const { data: deptUsers, error: deptUsersError } = await supabase
            .from('profiles')
            .select('id')
            .eq('department_id', simulatedDepartment.id);
            
          if (deptUsersError) throw deptUsersError;
          if (deptUsers && deptUsers.length > 0) {
            userIds = deptUsers.map(u => u.id);
          } else {
            userIds = [];
          }
        }
        
        if (userIds.length === 0) {
          setCampaigns([]);
          setRepetitiveFlows([]);
          return;
        }

        const { data: tasks, error: tasksError } = await supabase
          .from('crm_tasks')
          .select('campaign_id')
          .in('assigned_to', userIds);

        if (tasksError) throw tasksError;
        campaignIds = [...new Set(tasks.map(t => t.campaign_id))];

        const { data: repTasks, error: repTasksError } = await supabase
          .from('crm_repetitive_tasks')
          .select('repetitive_flow_id')
          .in('assigned_to', userIds);

        if (repTasksError) throw repTasksError;
        const flowIds = [...new Set(repTasks.map(t => t.repetitive_flow_id))];

        if (campaignIds.length > 0) {
          const { data: camps, error: campsError } = await supabase
            .from('crm_campaigns')
            .select('id, name')
            .in('id', campaignIds)
            .eq('is_active', true)
            .order('created_at', { ascending: false });
          if (campsError) throw campsError;
          setCampaigns(camps || []);
        } else {
          setCampaigns([]);
        }

        if (flowIds.length > 0) {
          const { data: flows, error: flowsError } = await supabase
            .from('crm_repetitive_flows')
            .select('id, name')
            .in('id', flowIds)
            .eq('is_active', true)
            .order('created_at', { ascending: false });
          if (flowsError) throw flowsError;
          setRepetitiveFlows(flows || []);
        } else {
          setRepetitiveFlows([]);
        }
      }
    } catch (err) {
      console.error('Error fetching user campaigns', err);
    }
  };

  return (
    <aside className="w-64 border-r border-slate-200 bg-white flex flex-col h-screen shrink-0 sticky top-0 shadow-sm z-20">
      <div className="p-6 flex items-center gap-3 border-b border-slate-100 relative">
        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/20">
          <Bolt size={24} />
        </div>
        <div>
          <h2 className="font-bold text-slate-800 text-lg tracking-tight">OPRISA OPS</h2>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{t.navWorkspace}</span>
        </div>
      </div>

      {isSimulating && (
        <div className="bg-indigo-50 border-b border-indigo-100 px-4 py-3 flex flex-col items-center justify-center gap-2">
          <div className="text-xs font-bold text-indigo-800 text-center uppercase tracking-wide">
            {t.navSimulatingDept}
          </div>
          <div className="text-sm font-bold text-indigo-600 text-center">
            {simulatedDepartment.name}
          </div>
        </div>
      )}

      <nav className="flex-1 p-4 flex flex-col gap-1 overflow-y-auto">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 mt-2 px-3">{t.navGeneral}</div>
        <NavLink 
          to="/" 
          className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
        >
          <LayoutDashboard size={18} />
          {t.navDashboard}
        </NavLink>

        <NavLink 
          to="/messages" 
          className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
        >
          <MessageSquare size={18} />
          {t.navMessages}
        </NavLink>

        {effectiveRole !== 'admin' && (
          <>
            <NavLink 
              to="/how-to-work" 
              className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
            >
              <BookOpen size={18} />
              {t.navHowToWork}
            </NavLink>
            <NavLink 
              to="/notifications" 
              className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
            >
              <BellRing size={18} />
              {t.navNotifications}
            </NavLink>
          </>
        )}

        <NavLink 
          to="/database" 
          className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
        >
          <Database size={18} />
          {t.navDatabase}
        </NavLink>

        <div className="flex flex-col">
          <button
            onClick={() => setIsCampaignsOpen(!isCampaignsOpen)}
            className="flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold transition-all text-slate-600 hover:bg-slate-50 hover:text-slate-900 w-full"
          >
            <div className="flex items-center gap-3">
              <Megaphone size={18} className="text-indigo-600" />
              <span className="text-indigo-600">{t.navActiveCampaigns}</span>
            </div>
            {isCampaignsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          
            {isCampaignsOpen && (
              <div className="flex flex-col gap-1 pl-10 pr-2 mt-1">
                {campaigns.length === 0 ? (
                  <div className="text-xs text-slate-400 py-2">{t.navNoCampaigns}</div>
                ) : (
                  campaigns.map(camp => (
                    <NavLink
                      key={camp.id}
                      to={`/tasks?campaignId=${camp.id}`}
                      className={({ isActive }) => `flex items-center py-2 px-2 rounded-md text-xs font-semibold transition-colors ${location.pathname === '/tasks' && location.search.includes(camp.id) ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
                    >
                      <span className="truncate">{camp.name}</span>
                    </NavLink>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col mt-2">
            <button
              onClick={() => setIsRepetitiveOpen(!isRepetitiveOpen)}
              className="flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold transition-all text-slate-600 hover:bg-slate-50 hover:text-slate-900 w-full"
            >
              <div className="flex items-center gap-3">
                <ClipboardList size={18} className="text-emerald-600" />
                <span className="text-emerald-600">{t.navRepetitiveFlows}</span>
              </div>
              {isRepetitiveOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            
            {isRepetitiveOpen && (
              <div className="flex flex-col gap-1 pl-10 pr-2 mt-1">
                {repetitiveFlows.length === 0 ? (
                  <div className="text-xs text-slate-400 py-2">{t.navNoFlows}</div>
                ) : (
                  repetitiveFlows.map(flow => (
                    <NavLink
                      key={flow.id}
                      to={`/repetitive-tasks?flowId=${flow.id}`}
                      className={({ isActive }) => `flex items-center py-2 px-2 rounded-md text-xs font-semibold transition-colors ${location.pathname === '/repetitive-tasks' && location.search.includes(flow.id) ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
                    >
                      <span className="truncate">{flow.name}</span>
                    </NavLink>
                  ))
                )}
              </div>
            )}
          </div>

        {effectiveRole === 'admin' && (
          <>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 mt-6 px-3">{t.navAdmin}</div>
            <NavLink 
              to="/admin" 
              end
              className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${isActive ? 'bg-amber-50 text-amber-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
            >
              {({ isActive }) => (
                <>
                  <ShieldAlert size={18} className={isActive ? 'text-amber-600' : 'text-amber-500'} />
                  {t.navAdminPanel}
                </>
              )}
            </NavLink>
            <NavLink 
              to="/admin/repetitive-history" 
              className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${isActive ? 'bg-amber-50 text-amber-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
            >
              {({ isActive }) => (
                <>
                  <ClipboardList size={18} className={isActive ? 'text-amber-600' : 'text-amber-500'} />
                  {t.navRepetitiveHistory}
                </>
              )}
            </NavLink>
            <NavLink 
              to="/admin/fleet-optimization" 
              className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${isActive ? 'bg-amber-50 text-amber-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
            >
              {({ isActive }) => (
                <>
                  <Zap size={18} className={isActive ? 'text-amber-600' : 'text-amber-500'} />
                  {t.navFleetOptimization}
                </>
              )}
            </NavLink>
            <NavLink 
              to="/admin/driver-dashboard" 
              className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${isActive ? 'bg-amber-50 text-amber-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
            >
              {({ isActive }) => (
                <>
                  <Users size={18} className={isActive ? 'text-amber-600' : 'text-amber-500'} />
                  {t.navDriverDashboard}
                </>
              )}
            </NavLink>
          </>
        )}

        {effectiveRole === 'admin' && (
          <>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 mt-6 px-3">{t.navDeveloper}</div>
            <NavLink 
              to="/developer/api-workspace" 
              className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${isActive ? 'bg-cyan-50 text-cyan-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
            >
              {({ isActive }) => (
                <>
                  <Code size={18} className={isActive ? 'text-cyan-600' : 'text-cyan-500'} />
                  {t.navApiWorkspace}
                </>
              )}
            </NavLink>
            <NavLink 
              to="/developer/architecture" 
              className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${isActive ? 'bg-cyan-50 text-cyan-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
            >
              {({ isActive }) => (
                <>
                  <Network size={18} className={isActive ? 'text-cyan-600' : 'text-cyan-500'} />
                  {t.navArchitectureGraph}
                </>
              )}
            </NavLink>
          </>
        )}
      </nav>

      <div className="p-4 border-t border-slate-100">
        <div className="px-3 py-3 rounded-lg bg-slate-50 flex items-center gap-3 mb-3 border border-slate-100">
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
            <UserCog size={16} />
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-bold text-slate-800 truncate">{profile?.name || 'User'}</p>
            <p className="text-xs text-slate-500 truncate capitalize">{profile?.role}</p>
          </div>
          <NavLink 
            to="/profile"
            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
            title="Edit Profile"
          >
            <Edit2 size={16} />
          </NavLink>
        </div>
        <button 
          onClick={() => signOut()} 
          className="w-full flex items-center justify-center gap-2 py-2 text-sm font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <LogOut size={16} />
          {t.btnSignout || 'Deconectare'}
        </button>
      </div>
    </aside>
  );
};
