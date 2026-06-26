import React from 'react';
import { MainLayout } from '../../components/layout/MainLayout';

export function FleetCapPage() {
  return (
    <MainLayout title="Fleet Optimization" subtitle="Driver Capacity Prediction & Staffing Auditor">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden w-full" style={{ height: 'calc(100vh - 180px)' }}>
        <iframe 
          src="/fleetcap/index.html" 
          width="100%" 
          height="100%" 
          style={{ border: 'none' }}
          title="Fleet Cap Micro-Frontend"
        />
      </div>
    </MainLayout>
  );
}
