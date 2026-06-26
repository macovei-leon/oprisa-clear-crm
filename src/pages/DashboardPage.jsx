import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { MainLayout } from '../components/layout/MainLayout';
import { Activity, Users, CheckCircle2, TrendingUp, BarChart3, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#14b8a6'];

export const DashboardPage = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  
  // Dashboard state
  const [stats, setStats] = useState({
    totalTasks: 0,
    completedTasks: 0,
    completionRate: 0,
  });
  
  const [campaignChartData, setCampaignChartData] = useState([]);
  const [workerChartData, setWorkerChartData] = useState([]);
  const [categoryKeys, setCategoryKeys] = useState([]);

  useEffect(() => {
    if (profile) {
      fetchDashboardData();
    }
  }, [profile]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Fetch normal campaigns and their tasks
      let taskQuery = supabase.from('crm_tasks').select(`
        id, campaign_id, completed, category, assigned_to,
        profiles:assigned_to ( name, email ),
        crm_campaigns:campaign_id ( name )
      `);

      // If normal operator, filter by assigned_to
      if (profile.role !== 'admin') {
        taskQuery = taskQuery.eq('assigned_to', profile.id);
      }

      const { data: tasks, error: tasksError } = await taskQuery;
      if (tasksError) throw tasksError;

      const safeTasks = tasks || [];

      // 2. Global stats
      const totalTasks = safeTasks.length;
      const completedTasks = safeTasks.filter(t => t.completed).length;
      const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      
      setStats({ totalTasks, completedTasks, completionRate });

      // 3. Campaign Performance Data
      const campaignsMap = {};
      const allCatsSet = new Set();
      
      safeTasks.forEach(t => {
        const campName = t.crm_campaigns?.name || 'Campanie Ștearsă';
        if (!campaignsMap[campName]) {
          campaignsMap[campName] = { name: campName, 'În Lucru': 0 };
        }
        
        if (t.completed) {
          const cat = t.category || 'Fără categorie';
          allCatsSet.add(cat);
          campaignsMap[campName][cat] = (campaignsMap[campName][cat] || 0) + 1;
        } else {
          campaignsMap[campName]['În Lucru'] += 1;
        }
      });
      
      setCategoryKeys(Array.from(allCatsSet));
      setCampaignChartData(Object.values(campaignsMap));

      // 4. Worker Performance Data
      const workersMap = {};
      safeTasks.forEach(t => {
        if (t.completed) {
          const workerName = t.profiles?.name || t.profiles?.email || 'Nespecificat';
          workersMap[workerName] = (workersMap[workerName] || 0) + 1;
        }
      });
      
      const workerDataArray = Object.entries(workersMap)
        .map(([name, sarcini]) => ({ name, Sarcini: sarcini }))
        .sort((a, b) => b.Sarcini - a.Sarcini)
        .slice(0, 10); // top 10

      setWorkerChartData(workerDataArray);

    } catch (err) {
      console.error('Error fetching dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <MainLayout title="Dashboard" subtitle="Se încarcă datele...">
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-slate-400 font-bold text-lg flex items-center gap-2">
            <Activity className="animate-spin" /> Procesare Analize...
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Dashboard Analize" subtitle="Prezentare generală a performanței și campaniilor">
      
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-5">
          <div className="w-14 h-14 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
            <Activity size={28} />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-400 uppercase tracking-wider">Total Sarcini Alocate</div>
            <div className="text-3xl font-black text-slate-800">{stats.totalTasks}</div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-5">
          <div className="w-14 h-14 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
            <CheckCircle2 size={28} />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-400 uppercase tracking-wider">Sarcini Finalizate</div>
            <div className="text-3xl font-black text-slate-800">{stats.completedTasks}</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-5">
          <div className="w-14 h-14 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
            <TrendingUp size={28} />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-400 uppercase tracking-wider">Rată de Succes</div>
            <div className="text-3xl font-black text-slate-800">{stats.completionRate}%</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Campaign Stacked Bar Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
            <BarChart3 className="text-indigo-600" size={20} /> 
            Progres Campanii & Categorii
          </h3>
          <div className="h-80 w-full">
            {campaignChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={campaignChartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{fill: '#64748b', fontSize: 12}} tickLine={false} axisLine={{stroke: '#cbd5e1'}} />
                  <YAxis tick={{fill: '#64748b', fontSize: 12}} tickLine={false} axisLine={false} />
                  <Tooltip 
                    cursor={{fill: '#f1f5f9'}} 
                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                  />
                  <Legend iconType="circle" wrapperStyle={{fontSize: '12px', paddingTop: '20px'}} />
                  <Bar dataKey="În Lucru" stackId="a" fill="#cbd5e1" radius={[0, 0, 4, 4]} />
                  {categoryKeys.map((cat, index) => (
                    <Bar 
                      key={cat} 
                      dataKey={cat} 
                      stackId="a" 
                      fill={COLORS[index % COLORS.length]} 
                      radius={index === categoryKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} 
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 font-bold">Nu există date suficiente.</div>
            )}
          </div>
        </div>

        {/* Worker Performance Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
            <Users className="text-emerald-600" size={20} /> 
            Top Operatori (Sarcini Finalizate)
          </h3>
          <div className="h-80 w-full">
            {workerChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={workerChartData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" tick={{fill: '#64748b', fontSize: 12}} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" tick={{fill: '#475569', fontSize: 12, fontWeight: 600}} tickLine={false} axisLine={false} />
                  <Tooltip 
                    cursor={{fill: '#f1f5f9'}} 
                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                  />
                  <Bar dataKey="Sarcini" fill="#10b981" radius={[0, 4, 4, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 font-bold">Nicio sarcină finalizată încă.</div>
            )}
          </div>
        </div>

      </div>
    </MainLayout>
  );
};
