import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { MainLayout } from '../components/layout/MainLayout';
import { useLanguage } from '../contexts/LanguageContext';
import { Activity, Users, CheckCircle2, TrendingUp, BarChart3, Building, ChevronRight, ArrowLeft, X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#14b8a6'];

export const DashboardPage = () => {
  const { t } = useLanguage();
  const { profile, simulatedDepartment, setSimulatedDepartment } = useAuth();
  const [loading, setLoading] = useState(true);
  
  // Raw Data State
  const [allTasks, setAllTasks] = useState([]);
  const [allDepartments, setAllDepartments] = useState([]);
  
  // Derived Dashboard state
  const [stats, setStats] = useState({ totalTasks: 0, completedTasks: 0, completionRate: 0 });
  const [campaignChartData, setCampaignChartData] = useState([]);
  const [workerChartData, setWorkerChartData] = useState([]);
  const [categoryKeys, setCategoryKeys] = useState([]);
  const [allProfiles, setAllProfiles] = useState([]);
  const [detailedWorkers, setDetailedWorkers] = useState([]);
  const [selectedWorker, setSelectedWorker] = useState(null);

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
        crm_campaigns:campaign_id ( name )
      `);

      // If normal operator, filter by assigned_to
      if (profile.role !== 'admin') {
        taskQuery = taskQuery.eq('assigned_to', profile.id);
      }

      let repTaskQuery = supabase.from('crm_repetitive_tasks').select(`
        id, repetitive_flow_id, completed, category, assigned_to, active_step_idx,
        crm_repetitive_flows:repetitive_flow_id ( name, steps )
      `);

      if (profile.role !== 'admin') {
        repTaskQuery = repTaskQuery.eq('assigned_to', profile.id);
      }

      const [{ data: tasks, error: tasksError }, { data: repTasks, error: repTasksError }, { data: allProfs, error: profsError }] = await Promise.all([
        taskQuery,
        repTaskQuery,
        supabase.from('profiles').select('id, name, email, department_id')
      ]);
      
      if (tasksError) throw tasksError;
      if (repTasksError) throw repTasksError;
      if (profsError) throw profsError;

      // Merge profiles into tasks manually
      const profilesMap = {};
      (allProfs || []).forEach(p => { profilesMap[p.id] = p; });
      setAllProfiles(allProfs || []);

      const mergedTasks = (tasks || []).map(t => ({
        ...t,
        profiles: profilesMap[t.assigned_to] || null
      }));

      const mappedRepTasks = (repTasks || []).map(t => {
        const flowName = t.crm_repetitive_flows?.name || 'Flux Necunoscut';
        const steps = t.crm_repetitive_flows?.steps || [];
        const stepName = (!t.completed && steps[t.active_step_idx]?.name) ? steps[t.active_step_idx].name : `Pas ${t.active_step_idx + 1}`;
        
        return {
          id: t.id,
          campaign_id: t.repetitive_flow_id,
          completed: t.completed,
          category: t.category,
          assigned_to: t.assigned_to,
          crm_campaigns: { name: flowName },
          isRepetitive: true,
          active_step_idx: t.active_step_idx,
          stepName: stepName,
          profiles: profilesMap[t.assigned_to] || null
        };
      });

      setAllTasks([...mergedTasks, ...mappedRepTasks]);

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
    if (profile?.role === 'admin' && simulatedDepartment) {
      filteredTasks = allTasks.filter(t => t.profiles?.department_id === simulatedDepartment.id);
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
      const campName = t.crm_campaigns?.name || (t.lblDeletedCampaign || 'Campanie Ștearsă');
      if (!campaignsMap[campName]) {
        campaignsMap[campName] = { name: campName, [t.lblInProgress || 'În Lucru']: 0 };
      }
      
      if (t.completed) {
        const cat = t.category || (t.lblNoCategory || 'Fără categorie');
        allCatsSet.add(cat);
        campaignsMap[campName][cat] = (campaignsMap[campName][cat] || 0) + 1;
      } else {
        campaignsMap[campName][t.lblInProgress || 'În Lucru'] += 1;
      }
    });
    
    setCategoryKeys(Array.from(allCatsSet));
    setCampaignChartData(Object.values(campaignsMap));

    // Worker Performance Data
    const workersMap = {};
    filteredTasks.forEach(t => {
      if (t.completed) {
        const workerName = t.profiles?.name || t.profiles?.email || (t.lblUnspecifiedWorker || 'Nespecificat');
        workersMap[workerName] = (workersMap[workerName] || 0) + 1;
      }
    });
    
    const workerDataArray = Object.entries(workersMap)
      .map(([name, sarcini]) => ({ name, Sarcini: sarcini }))
      .sort((a, b) => b.Sarcini - a.Sarcini)
      .slice(0, 10); // top 10

    setWorkerChartData(workerDataArray);

    // Detailed Workers for Simulated Department View
    if (profile?.role === 'admin' && simulatedDepartment) {
      const detailedMap = {};
      
      allProfiles.filter(p => p.department_id === simulatedDepartment.id).forEach(p => {
        detailedMap[p.id] = {
          name: p.name || p.email,
          total: 0,
          steps: {},
          categories: {}
        };
      });

      filteredTasks.forEach(t => {
        const workerId = t.assigned_to;
        if (!workerId || !detailedMap[workerId]) return;
        
        detailedMap[workerId].total += 1;
        if (t.completed) {
          const cat = t.category || (t.lblNoCategory || 'Fără categorie');
          detailedMap[workerId].categories[cat] = (detailedMap[workerId].categories[cat] || 0) + 1;
        } else {
          const step = t.isRepetitive ? (t.stepName || 'Pas Necunoscut') : 'În Lucru';
          detailedMap[workerId].steps[step] = (detailedMap[workerId].steps[step] || 0) + 1;
        }
      });
      
      setDetailedWorkers(Object.values(detailedMap).sort((a, b) => b.total - a.total));
    }

  }, [allTasks, simulatedDepartment, profile, allProfiles]);

  if (loading) {
    return (
      <MainLayout title="Dashboard" subtitle={t.lblLoadingData || "Se încarcă datele..."}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-slate-400 font-bold text-lg flex items-center gap-2">
            <Activity className="animate-spin" /> Procesare Analize...
          </div>
        </div>
      </MainLayout>
    );
  }

  // Admin: Default Overview (All Departments)
  if (profile?.role === 'admin' && !simulatedDepartment) {
    return (
      <MainLayout title={t.titleAdminDashboard || "Dashboard Administrator"} subtitle={t.subtitleDeptsOverview || "Prezentare generală a departamentelor"}>
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-5 w-fit pr-16">
            <div className="w-14 h-14 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
              <Building size={28} />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-400 uppercase tracking-wider">{t.lblTotalDepts || 'Total Departamente'}</div>
              <div className="text-3xl font-black text-slate-800">{allDepartments.length}</div>
            </div>
          </div>

          <h3 className="text-xl font-bold text-slate-800 mt-8 mb-4">{t.lblChooseDept || 'Alege Departament'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {allDepartments.map(dept => {
              const deptTasks = allTasks.filter(t => t.profiles?.department_id === dept.id);
              const total = deptTasks.length;
              const completed = deptTasks.filter(t => t.completed).length;
              const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

              return (
                <div 
                  key={dept.id}
                  onClick={() => setSimulatedDepartment(dept)}
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
                      <span className="text-slate-500 font-medium">{t.lblAllocatedTasks || 'Sarcini Alocate'}</span>
                      <span className="font-bold text-slate-800">{total}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500 font-medium">{t.lblCompletedTasksDashboard || 'Sarcini Finalizate'}</span>
                      <span className="font-bold text-emerald-600">{completed}</span>
                    </div>
                    
                    <div className="mt-5 pt-4 border-t border-slate-50">
                      <div className="flex justify-between items-center text-xs font-bold text-slate-500 mb-1.5">
                        <span>{t.lblSuccessRateLower || 'Rată de succes'}</span>
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
      title={simulatedDepartment ? `${t.titleDashboardPrefix || "Dashboard:"} ${simulatedDepartment.name}` : (t.titleAnalyticsDashboard || "Dashboard Analize")} 
      subtitle={t.subtitlePerfCamps || "Prezentare generală a performanței și campaniilor"}
    >
      
      {profile?.role === 'admin' && simulatedDepartment && (
        <button 
          onClick={() => setSimulatedDepartment(null)}
          className="mb-6 flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm w-fit"
        >
          <ArrowLeft size={16} /> {t.btnBackToDepts || 'Înapoi la Departamente'}
        </button>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-5">
          <div className="w-14 h-14 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
            <Activity size={28} />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-400 uppercase tracking-wider">{t.lblTotalAllocatedTasks || 'Total Sarcini Alocate'}</div>
            <div className="text-3xl font-black text-slate-800">{stats.totalTasks}</div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-5">
          <div className="w-14 h-14 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
            <CheckCircle2 size={28} />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-400 uppercase tracking-wider">{t.lblCompletedTasksDashboard || 'Sarcini Finalizate'}</div>
            <div className="text-3xl font-black text-slate-800">{stats.completedTasks}</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-5">
          <div className="w-14 h-14 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
            <TrendingUp size={28} />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-400 uppercase tracking-wider">{t.lblSuccessRate || 'Rată de Succes'}</div>
            <div className="text-3xl font-black text-slate-800">{stats.completionRate}%</div>
          </div>
        </div>
      </div>

      {profile?.role === 'admin' && simulatedDepartment ? (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
            <Users className="text-indigo-600" size={20} /> 
            Situație Detaliată Operatori ({simulatedDepartment.name})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-y border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4 font-bold">Operator</th>
                  <th className="py-3 px-4 font-bold text-center">Total Sarcini</th>
                  <th className="py-3 px-4 font-bold">În Lucru (Pe Pași)</th>
                  <th className="py-3 px-4 font-bold">Finalizate (Pe Categorii)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {detailedWorkers.map((w, idx) => (
                  <tr 
                    key={idx} 
                    className="hover:bg-slate-50 transition-colors cursor-pointer group"
                    onClick={() => setSelectedWorker(w)}
                  >
                    <td className="py-3 px-4 font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{w.name}</td>
                    <td className="py-3 px-4 text-center font-black text-indigo-600">{w.total}</td>
                    <td className="py-3 px-4">
                      {Object.keys(w.steps).length === 0 ? <span className="text-slate-400">-</span> : 
                        <div className="flex flex-col gap-1">
                          {Object.entries(w.steps).map(([step, count]) => (
                            <span key={step} className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded text-[11px] font-bold border border-amber-200 w-fit">
                              {step}: <span className="ml-1 text-amber-900">{count}</span>
                            </span>
                          ))}
                        </div>
                      }
                    </td>
                    <td className="py-3 px-4">
                      {Object.keys(w.categories).length === 0 ? <span className="text-slate-400">-</span> : 
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(w.categories).map(([cat, count]) => (
                            <span key={cat} className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-[11px] font-bold border border-emerald-200">
                              {cat}: <span className="ml-1 text-emerald-900">{count}</span>
                            </span>
                          ))}
                        </div>
                      }
                    </td>
                  </tr>
                ))}
                {detailedWorkers.length === 0 && (
                  <tr>
                    <td colSpan="4" className="py-8 text-center text-slate-500 font-bold">Nu există operatori alocați acestui departament.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Campaign Stacked Bar Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
          <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
            <BarChart3 className="text-indigo-600" size={20} /> 
            {t.titleCampsCatsProgress || 'Progres Campanii & Categorii'}
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
                  <Bar dataKey={t.lblInProgress || 'În Lucru'} stackId="a" fill="#cbd5e1" radius={[0, 0, 4, 4]} />
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
              <div className="h-full flex items-center justify-center text-slate-400 font-bold">{t.msgNotEnoughData || 'Nu există date suficiente.'}</div>
            )}
          </div>
        </div>

        {/* Worker Performance Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
          <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
            <Users className="text-emerald-600" size={20} /> 
            {t.titleTopOperators || 'Top Operatori (Sarcini Finalizate)'}
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
                  <Bar dataKey={t.lblTasksUpper || 'Sarcini'} fill="#10b981" radius={[0, 4, 4, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 font-bold">{t.msgNoTasksCompletedYet || 'Nicio sarcină finalizată încă.'}</div>
            )}
          </div>
        </div>

        </div>
      )}

      {selectedWorker && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <Users className="text-indigo-600" />
                Progres Detaliat: {selectedWorker.name}
              </h2>
              <button 
                onClick={() => setSelectedWorker(null)}
                className="text-slate-400 hover:text-slate-700 bg-white hover:bg-slate-100 p-2 rounded-xl transition-colors border border-slate-200 shadow-sm"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-8">
              {/* Summary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl flex flex-col justify-center items-center text-center">
                  <span className="text-indigo-400 font-bold text-xs uppercase tracking-wider mb-1">Total Carduri</span>
                  <span className="text-3xl font-black text-indigo-700">{selectedWorker.total}</span>
                </div>
                <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex flex-col justify-center items-center text-center">
                  <span className="text-amber-500 font-bold text-xs uppercase tracking-wider mb-1">În Lucru</span>
                  <span className="text-3xl font-black text-amber-700">{Object.values(selectedWorker.steps).reduce((a,b)=>a+b, 0)}</span>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex flex-col justify-center items-center text-center">
                  <span className="text-emerald-500 font-bold text-xs uppercase tracking-wider mb-1">Finalizate</span>
                  <span className="text-3xl font-black text-emerald-700">{Object.values(selectedWorker.categories).reduce((a,b)=>a+b, 0)}</span>
                </div>
              </div>

              {/* Steps */}
              {Object.keys(selectedWorker.steps).length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Defalcare: În Lucru (Pe Pași)</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {Object.entries(selectedWorker.steps).map(([step, count]) => (
                      <div key={step} className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm flex items-center justify-between">
                        <span className="font-bold text-slate-700 truncate mr-2" title={step}>{step}</span>
                        <span className="bg-amber-100 text-amber-800 text-sm font-black px-2.5 py-1 rounded-lg">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Categories */}
              {Object.keys(selectedWorker.categories).length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Defalcare: Finalizate (Pe Categorii)</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {Object.entries(selectedWorker.categories).map(([cat, count]) => (
                      <div key={cat} className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm flex items-center justify-between">
                        <span className="font-bold text-slate-700 truncate mr-2" title={cat}>{cat}</span>
                        <span className="bg-emerald-100 text-emerald-800 text-sm font-black px-2.5 py-1 rounded-lg">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

    </MainLayout>
  );
};
