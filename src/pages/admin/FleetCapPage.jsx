import React from 'react';
import { Sidebar } from '../../components/layout/Sidebar';

export function FleetCapPage() {
  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900">
      <Sidebar />
      <main className="flex-1 h-screen overflow-hidden">
        <iframe 
          src="/fleetcap/index.html" 
          width="100%" 
          height="100%" 
          style={{ border: 'none', display: 'block' }}
          title="Fleet Cap Micro-Frontend"
        />
      </main>
    </div>
  );
}
