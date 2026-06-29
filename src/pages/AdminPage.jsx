import React, { useState } from 'react';
import { MainLayout } from '../components/layout/MainLayout';
import { Alert } from '../components/auth/Shared';
import { Users, Activity, Building, Target, Archive } from 'lucide-react';

import { UserManagement } from '../components/admin/UserManagement';
import { WorkerMonitoring } from '../components/admin/WorkerMonitoring';
import { DepartmentManagement } from '../components/admin/DepartmentManagement';
import { CampaignManagement } from '../components/admin/CampaignManagement';
import { NotificationSender } from '../components/admin/NotificationSender';
import { BellRing } from 'lucide-react';

export const AdminPage = () => {
  const [activeTab, setActiveTab] = useState('users');
  const [globalAlert, setGlobalAlert] = useState(null);

  const tabs = [
    { id: 'users', label: 'Management Utilizatori', icon: <Users size={18} /> },
    { id: 'workers', label: 'Monitorizare Operatori', icon: <Activity size={18} /> },
    { id: 'departments', label: 'Departamente', icon: <Building size={18} /> },
    { id: 'campaigns_active', label: 'Campanii Active', icon: <Target size={18} /> },
    { id: 'campaigns_archived', label: 'Campanii Arhivate', icon: <Archive size={18} /> },
    { id: 'repetitive_active', label: 'Fluxuri Repetitive Active', icon: <Target size={18} /> },
    { id: 'repetitive_archived', label: 'Fluxuri Repetitive Arhivate', icon: <Archive size={18} /> },
    { id: 'notifications', label: 'Notificări', icon: <BellRing size={18} /> },
  ];

  return (
    <MainLayout title="Admin Panel" subtitle="Aprobare utilizatori și setări globale platformă">
      
      {/* Global Alerts */}
      <Alert message={globalAlert?.message} type={globalAlert?.type} />
      
      {/* Tabs Header */}
      <div className="flex border-b border-slate-200 mb-6 overflow-x-auto hide-scrollbar">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-all border-b-2 whitespace-nowrap ${
              activeTab === tab.id 
                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50' 
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content Area */}
      <div className="pb-12">
        {activeTab === 'users' && <UserManagement setGlobalAlert={setGlobalAlert} />}
        {activeTab === 'workers' && <WorkerMonitoring setGlobalAlert={setGlobalAlert} />}
        {activeTab === 'departments' && <DepartmentManagement setGlobalAlert={setGlobalAlert} />}
        {activeTab === 'campaigns_active' && <CampaignManagement filterType="active" isRepetitive={false} setGlobalAlert={setGlobalAlert} />}
        {activeTab === 'campaigns_archived' && <CampaignManagement filterType="archived" isRepetitive={false} setGlobalAlert={setGlobalAlert} />}
        {activeTab === 'repetitive_active' && <CampaignManagement filterType="active" isRepetitive={true} setGlobalAlert={setGlobalAlert} />}
        {activeTab === 'repetitive_archived' && <CampaignManagement filterType="archived" isRepetitive={true} setGlobalAlert={setGlobalAlert} />}
        {activeTab === 'notifications' && <NotificationSender setGlobalAlert={setGlobalAlert} />}
      </div>
      
    </MainLayout>
  );
};
