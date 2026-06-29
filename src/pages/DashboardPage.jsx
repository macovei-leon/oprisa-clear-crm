import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { MainLayout } from '../components/layout/MainLayout';
import { Activity, Users, CheckCircle2, TrendingUp, BarChart3, Building, ChevronRight, ArrowLeft } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#14b8a6'];

export const DashboardPage = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  
  // Raw Data State
  const [allTasks, setAllTasks] = useState([]);
  const [allDepartments, setAllDepartments] = useState([]);
  
  // UI State
  const [selectedDepartment, setSelectedDepartment] = useState(null);

  // Derived Dashboard state
  const [stats, setStats] = useState({ totalTasks: 0, completedTasks: 0, completionRate: 0 });
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
      // 1. Fetch normal campaigns and their tasks with profiles explicitly joined
      let taskQuery = supabase.from('crm_tasks').select(`
        id, campaign_id, completed, category, assigned_to,
        crm_campaigns:campaign_id ( name ),
        profiles:assigned_to ( name, email, department_id )
      `);

      // If normal operator, filter by assigned_to
      if (profile.role !== 'admin') {
        taskQuery = taskQuery.eq('assigned_to', profile.id);
      }

      const { data: tasks, error: tasksError } = await taskQuery;
      if (tasksError) throw tasksError;
      setAllTasks(tasks || []);

      // 2. If admin, fetch departments
      if (profile.role === 'admin') {
        const { data: depts, error: deptsError } = await supabase.from('departments').select('*').order('name');
        if (deptsError) throw deptsError;
        setAllDepartments(depts || []);
      }

    } catch (err) {
      console.error('Error fetching dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  // Recalculate stats & charts whenever raw data or selected department changes
  useEffect(() => {
    if (!allTasks) return;

    let filteredTasks = allTasks;
    
    // If Admin and in Department View, filter by that department's users
    if (profile?.role === 'admin' && selectedDepartment) {
      filteredTasks = allTasks.filter(t => t.profiles?.department_id === selectedDepartment.id);
    }

    // Global stats
    const totalTasks = filteredTasks.length;
    const completedTasks = filteredTasks.filter(t => t.completed).length;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    
    setStats({ totalTasks, completedTasks, completionRate });

    // Campaign Performance Data
    const campaignsMap = {};
    const allCatsSet = new Set();
    
    filteredTasks.forEach(t => {
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

    // Worker Performance Data
    const workersMap = {};
    filteredTasks.forEach(t => {
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

  }, [allTasks, selectedDepartment, profile]);

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

  // Admin: Default Overview (All Departments)
  if (profile?.role === 'admin' && !selectedDepartment) {
    return (
      <MainLayout title="Dashboard Administrator" subtitle="Prezentare generală a departamentelor">
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-5 w-fit pr-16">
            <div className="w-14 h-14 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
              <Building size={28} />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-400 uppercase tracking-wider">Total Departamente</div>
              <div className="text-3xl font-black text-slate-800">{allDepartments.length}</div>
            </div>
          </div>

          <h3 className="text-xl font-bold text-slate-800 mt-8 mb-4">Alege Departament</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {allDepartments.map(dept => {
              const deptTasks = allTasks.filter(t => t.profiles?.department_id === dept.id);
              const total = deptTasks.length;
              const completed = deptTasks.filter(t => t.completed).length;
              const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

              return (
                <div 
                  key={dept.id}
                  onClick={() => setSelectedDepartment(dept)}
                  className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer group flex flex-col"
                >
                  <h4 className="text-lg font-bold text-slate-800 group-hover:text-indigo-600 transition-colors mb-5 flex items-center justify-between">
                    {dept.name}
                    <div className="w-8 h-8 rounded-full bg-slate-50 group-hover:bg-indigo-50 flex items-center justify-center transition-colors">
                      <ChevronRight className="text-slate-400 group-hover:text-indigo-600" size={18} />
                    </div>
                  </h4>
                  
                  <div className="space-y-3 flex-1">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500 font-medium">Sarcini Alocate</span>
                      <span className="font-bold text-slate-800">{total}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500 font-medium">Sarcini Finalizate</span>
                      <span className="font-bold text-emerald-600">{completed}</span>
                    </div>
                    
                    <div className="mt-5 pt-4 border-t border-slate-50">
                      <div className="flex justify-between items-center text-xs font-bold text-slate-500 mb-1.5">
                        <span>Rată de succes</span>
                        <span className={rate > 75 ? 'text-emerald-600' : rate > 40 ? 'text-amber-600' : 'text-red-600'}>{rate}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-1000 ${rate > 75 ? 'bg-emerald-500' : rate > 40 ? 'bg-amber-500' : 'bg-red-500'}`} 
                          style={{ width: `${rate}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </MainLayout>
    );
  }

  // Admin Department View OR Normal User View
  return (
    <MainLayout 
      title={selectedDepartment ? `Dashboard: ${selectedDepartment.name}` : "Dashboard Analize"} 
      subtitle="Prezentare generală a performanței și campaniilor"
    >
      
      {profile?.role === 'admin' && selectedDepartment && (
        <button 
          onClick={() => setSelectedDepartment(null)}
          className="mb-6 flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm w-fit"
        >
          <ArrowLeft size={16} /> Înapoi la Departamente
        </button>
      )}

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
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
          <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
            <BarChart3 className="text-indigo-600" size={20} /> 
            Progres Campanii & Categorii
          </h3>
          <div className="h-80 w-full flex-1">
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
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
          <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
            <Users className="text-emerald-600" size={20} /> 
            Top Operatori (Sarcini Finalizate)
          </h3>
          <div className="h-80 w-full flex-1">
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
