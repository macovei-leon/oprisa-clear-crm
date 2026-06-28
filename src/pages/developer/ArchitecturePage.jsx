import React, { useEffect, useRef } from 'react';
import mermaid from 'mermaid';
import { Sidebar } from '../../components/layout/Sidebar';

export function ArchitecturePage() {
  const chartRef = useRef(null);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: true,
      theme: 'base',
      securityLevel: 'loose',
      themeVariables: {
        primaryColor: '#f1f5f9',
        primaryTextColor: '#1e293b',
        primaryBorderColor: '#cbd5e1',
        lineColor: '#64748b',
        secondaryColor: '#e0e7ff',
        tertiaryColor: '#fff',
        fontFamily: 'sans-serif'
      }
    });
    
    if (chartRef.current) {
        chartRef.current.removeAttribute('data-processed');
        mermaid.run({
            nodes: [chartRef.current]
        });
    }
  }, []);

  const chart = `
graph TD
    classDef container fill:#e2e8f0,stroke:#94a3b8,stroke-width:2px,rx:10px,ry:10px;
    classDef frontend fill:#dbeafe,stroke:#3b82f6,stroke-width:2px,rx:5px,ry:5px;
    classDef backend fill:#fef3c7,stroke:#d97706,stroke-width:2px,rx:5px,ry:5px;
    classDef database fill:#dcfce3,stroke:#22c55e,stroke-width:2px,rx:5px,ry:5px;
    classDef external fill:#f3e8ff,stroke:#a855f7,stroke-width:2px,rx:5px,ry:5px;

    subgraph Coolify["☁️ Coolify VPS Host"]
        
        subgraph DockerCompose["🐳 Docker Compose Network"]
            
            subgraph FrontendContainer["💻 Frontend Container (Vite, Port 3050)"]
                ViteApp["⚛️ Vite React Admin Panel"]:::frontend
                DriverDashboard["🚘 Driver Dashboard UI (iframe)"]:::frontend
                FleetCap["🚛 FleetCap UI (iframe)"]:::frontend
                ApiWorkspace["🛠️ API Workspace UI (iframe)"]:::frontend
                
                ViteApp --- DriverDashboard
                ViteApp --- FleetCap
                ViteApp --- ApiWorkspace
            end
            
            subgraph BackendContainer["⚙️ Backend Container (Express, Port 3001)"]
                ExpressAPI["🌐 Express API Server"]:::backend
                NodeCron["🕒 Node-Cron (Scheduler)"]:::backend
                EmailService["📧 Email Service (Nodemailer)"]:::backend
                PDFGen["📄 PDF Generator (pdf-lib)"]:::backend
                
                ExpressAPI -.-> EmailService
                NodeCron -.-> EmailService
                EmailService -.-> PDFGen
            end
        end
    end
    
    subgraph Database["🗄️ Supabase (External)"]
        Auth["🔐 Supabase Auth"]:::database
        
        subgraph PostgreSQL["🐘 PostgreSQL Database"]
            CRMTables[("CRM Core Data<br>(profiles, campaigns, tasks)")]:::database
            DriverTables[("Automation Settings<br>(email_settings, queue, logs)")]:::database
            FleetTables[("Fleet Optimization<br>(fleetcap_app_data)")]:::database
            TimelineTables[("Timeline Data<br>(raw timeline tracking)")]:::database
        end
    end
    
    subgraph External["🌍 External Services"]
        SMTP["✉️ SMTP Server (e.g. Gmail)"]:::external
        ClientBrowser["🧑‍💻 Client Browser / Internet"]:::external
    end
    
    ClientBrowser == "HTTP 80/443" ==> Coolify
    Coolify == "Reverse Proxy" ==> FrontendContainer
    FrontendContainer <== "API Calls (REST)" ==> BackendContainer
    FrontendContainer <== "Auth / Subscriptions" ==> Database
    BackendContainer <== "PostgreSQL queries" ==> Database
    EmailService == "SMTP Protocol" ==> SMTP

    class Coolify,DockerCompose,FrontendContainer,BackendContainer,Database,PostgreSQL,External container;
  `;

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8 h-screen relative">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 min-h-full">
            <h1 className="text-3xl font-bold text-slate-800 mb-2">Application Architecture</h1>
            <p className="text-slate-500 mb-8 max-w-2xl">
                This dynamic diagram illustrates the flow of data between the frontend micro-apps, the backend container, 
                and the external Supabase database, hosted securely on a Coolify VPS.
            </p>
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 overflow-x-auto flex justify-center items-center w-full">
                <div className="mermaid" ref={chartRef} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                    {chart}
                </div>
            </div>
        </div>
      </main>
    </div>
  );
}
