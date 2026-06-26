import React from 'react';
import { Sidebar } from '../../components/layout/Sidebar';

export function DriverDashboardPage() {
  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900">
      <Sidebar />
      <main className="flex-1 h-screen overflow-hidden">
        <iframe 
          src="/driver-dashboard/index.html" 
          width="100%" 
          height="100%" 
          style={{ border: 'none', display: 'block', backgroundColor: '#f1f5f9' }}
          title="Driver Dashboard Micro-Frontend"
        />
      </main>
    </div>
  );
}
