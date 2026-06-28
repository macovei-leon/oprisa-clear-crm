import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { Sidebar } from '../../components/layout/Sidebar';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { X, ZoomIn, ZoomOut, Maximize } from 'lucide-react';

// Data Dictionary for Deep Dives
const NODE_DATA = {
  ViteApp: {
    title: 'React Admin Panel (Vite)',
    type: 'Frontend',
    description: 'The core CRM application built with React and Vite. Handles routing, global authentication context, and renders all other micro-apps via iframes.',
    tables: ['profiles', 'departments'],
    logic: 'Uses React Router for navigation and Context API for global state. Protected routes ensure only authenticated admins can access the backend.'
  },
  DriverDashboard: {
    title: 'Driver Dashboard UI',
    type: 'Frontend Micro-App',
    description: 'Static HTML/JS app loaded in an iframe. Provides UI for HR to process timeline data, configure automated rules, and view sent email logs.',
    tables: ['driver_email_settings', 'driver_dashboard_data'],
    columns: {
      'driver_email_settings': 'id, is_enabled (bool), send_time (time), allowed_categories (jsonb), pn_range_start (int), pn_range_end (int), cron_schedule (text)',
      'driver_dashboard_data': 'id, data (jsonb)'
    },
    logic: 'Calls /api/admin/ endpoints to trigger test emails, fetch logs, and upload timeline JSON files.'
  },
  FleetCap: {
    title: 'FleetCap Optimization UI',
    type: 'Frontend Micro-App',
    description: 'Standalone HTML app for calculating fleet capacity and driver metrics based on daily actions.',
    tables: ['fleetcap_app_data', 'driver_activity', 'driver_daily_actions'],
    columns: {
      'fleetcap_app_data': 'id, data (jsonb)',
      'driver_daily_actions': 'id, driver_pn, status, created_at, user_id'
    },
    logic: 'Fetches raw timeline data and cross-references it with driver actions to optimize scheduling.'
  },
  ExpressAPI: {
    title: 'Express Node.js Server',
    type: 'Backend',
    description: 'Main backend server running on port 3001. Handles API requests from the frontend, securely communicates with Supabase, and orchestrates background jobs.',
    tables: ['All Tables via Supabase Service Key'],
    logic: 'Routes include /api/admin/email-settings, /api/admin/active-table, /api/admin/trigger-email-job. Bypasses RLS using the service role key to perform admin duties.'
  },
  NodeCron: {
    title: 'Node-Cron Automation Engine',
    type: 'Background Service',
    description: 'Internal scheduling system that runs completely independently of the frontend browser.',
    tables: ['driver_email_settings', 'driver_email_queue', 'driver_email_batches'],
    columns: {
      'driver_email_batches': 'id, name, total_emails, sent_count, failed_count, status, created_at',
      'driver_email_queue': 'id, batch_id, driver_pn, email, category, status, scheduled_for'
    },
    logic: '1. Queue Processor runs every 5 minutes (Europe/Berlin).\n2. Daily Job runs at configured send_time.\n3. Pushes targets to queue and fires Nodemailer.'
  },
  EmailService: {
    title: 'Nodemailer & PDF-lib',
    type: 'Backend Service',
    description: 'Generates customized HTML emails and optionally attaches customized PDFs using puppeteer/pdf-lib.',
    tables: ['driver_email_logs', 'driver_email_templates'],
    columns: {
      'driver_email_logs': 'id, driver_pn, email, category, status, details, sent_at',
      'driver_email_templates': 'category, subject, body'
    },
    logic: 'Replaces {{variables}} in the template, generates a batch, sends emails via SMTP, and logs the result/error in driver_email_logs.'
  },
  DB_CRM: {
    title: 'CRM Database Layer',
    type: 'Supabase PostgreSQL',
    description: 'Core tables for managing the internal company hierarchy, tasks, and employees.',
    tables: ['angajati', 'crm_tasks', 'crm_campaigns', 'departments', 'profiles'],
    columns: {
      'angajati': 'id, uuid, nume, email, telefon, companie, iban, tip_contract, inactiv',
      'crm_campaigns': 'id, name, description, trigger_type, target_role, steps (jsonb)',
      'crm_tasks': 'id, category, assigned_to, row_data, completed, active_step_idx'
    }
  },
  DB_Timeline: {
    title: 'Raw Timeline Data',
    type: 'Supabase PostgreSQL',
    description: 'Stores massive JSON files uploaded by HR regarding raw driver timeline tracking.',
    tables: ['dashboard_settings', 'driver_timeline_data'],
    columns: {
      'dashboard_settings': 'id, timeline_file_path, active_table, raw_timeline_data',
      'driver_timeline_data': 'id, data (jsonb)'
    }
  }
};

export function ArchitecturePage() {
  const chartRef = useRef(null);
  const [selectedNode, setSelectedNode] = useState(null);

  // Setup global click handler for Mermaid
  useEffect(() => {
    window.handleMermaidClick = (nodeId) => {
      console.log('Clicked node:', nodeId);
      if (NODE_DATA[nodeId]) {
        setSelectedNode(NODE_DATA[nodeId]);
      }
    };

    return () => {
      delete window.handleMermaidClick;
    };
  }, []);

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
    classDef frontend fill:#dbeafe,stroke:#3b82f6,stroke-width:2px,rx:5px,ry:5px,cursor:pointer;
    classDef backend fill:#fef3c7,stroke:#d97706,stroke-width:2px,rx:5px,ry:5px,cursor:pointer;
    classDef database fill:#dcfce3,stroke:#22c55e,stroke-width:2px,rx:5px,ry:5px,cursor:pointer;
    classDef external fill:#f3e8ff,stroke:#a855f7,stroke-width:2px,rx:5px,ry:5px;
    classDef default cursor:pointer;

    subgraph Coolify["☁️ Coolify VPS Host (Docker Compose)"]
        
        subgraph FrontendContainer["💻 Frontend Container (Vite, Port 3050)"]
            ViteApp["⚛️ Vite React Admin Panel"]:::frontend
            DriverDashboard["🚘 Driver Dashboard UI"]:::frontend
            FleetCap["🚛 FleetCap UI"]:::frontend
            ApiWorkspace["🛠️ API Workspace"]:::frontend
            
            ViteApp --- DriverDashboard
            ViteApp --- FleetCap
            ViteApp --- ApiWorkspace
        end
        
        subgraph BackendContainer["⚙️ Backend Container (Express, Port 3001)"]
            ExpressAPI["🌐 Express API Server"]:::backend
            NodeCron["🕒 Node-Cron (Scheduler)"]:::backend
            EmailService["📧 Email Service (Nodemailer)"]:::backend
            
            ExpressAPI -.-> NodeCron
            ExpressAPI -.-> EmailService
            NodeCron -.-> EmailService
        end
    end
    
    subgraph Database["🗄️ Supabase PostgreSQL (External)"]
        DB_CRM[("CRM Data<br>(angajati, tasks, campaigns)")]:::database
        DB_Driver[("Automation Data<br>(email_settings, queue, logs)")]:::database
        DB_Fleet[("Fleet Optimization<br>(fleetcap_data)")]:::database
        DB_Timeline[("Timeline Data<br>(raw timeline tracking)")]:::database
    end
    
    SMTP["✉️ SMTP Server (Gmail)"]:::external
    ClientBrowser["🧑‍💻 Client Browser / Internet"]:::external
    
    ClientBrowser == "HTTP 80/443" ==> FrontendContainer
    FrontendContainer <== "API Calls (REST)" ==> BackendContainer
    FrontendContainer <== "Auth / Supabase-js" ==> Database
    BackendContainer <== "Supabase Service Key" ==> Database
    EmailService == "SMTP Protocol" ==> SMTP

    click ViteApp call handleMermaidClick()
    click DriverDashboard call handleMermaidClick()
    click FleetCap call handleMermaidClick()
    click ApiWorkspace call handleMermaidClick()
    click ExpressAPI call handleMermaidClick()
    click NodeCron call handleMermaidClick()
    click EmailService call handleMermaidClick()
    click DB_CRM call handleMermaidClick()
    click DB_Driver call handleMermaidClick()
    click DB_Fleet call handleMermaidClick()
    click DB_Timeline call handleMermaidClick()
  `;

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden relative">
      <Sidebar />
      <main className="flex-1 flex flex-col h-screen relative">
        {/* Header */}
        <div className="bg-white px-8 py-6 shadow-sm border-b border-slate-200 z-10">
            <h1 className="text-2xl font-bold text-slate-800">Deep-Dive Architecture Graph</h1>
            <p className="text-sm text-slate-500 mt-1">
                Drag to pan, scroll to zoom. <b>Click on any node</b> to see its exact database schema and backend logic.
            </p>
        </div>

        {/* Interactive Canvas */}
        <div className="flex-1 overflow-hidden relative bg-slate-50/50 cursor-grab active:cursor-grabbing">
            <TransformWrapper
              initialScale={1.2}
              minScale={0.5}
              maxScale={3}
              centerOnInit={true}
              wheel={{ step: 0.1 }}
            >
              {({ zoomIn, zoomOut, resetTransform }) => (
                <>
                  <div className="absolute top-4 left-4 z-10 flex gap-2 bg-white p-2 rounded-lg shadow-sm border border-slate-200">
                    <button onClick={() => zoomIn()} className="p-2 hover:bg-slate-100 rounded text-slate-600"><ZoomIn size={18} /></button>
                    <button onClick={() => zoomOut()} className="p-2 hover:bg-slate-100 rounded text-slate-600"><ZoomOut size={18} /></button>
                    <button onClick={() => resetTransform()} className="p-2 hover:bg-slate-100 rounded text-slate-600"><Maximize size={18} /></button>
                  </div>
                  <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }}>
                    <div className="p-20 flex justify-center items-center min-w-[1200px] min-h-[800px]">
                      <div className="mermaid" ref={chartRef} style={{ pointerEvents: 'auto' }}>
                          {chart}
                      </div>
                    </div>
                  </TransformComponent>
                </>
              )}
            </TransformWrapper>
        </div>

        {/* Slide-over Deep Dive Panel */}
        {selectedNode && (
          <div className="absolute top-0 right-0 h-full w-96 bg-white shadow-2xl border-l border-slate-200 transform transition-transform duration-300 ease-in-out z-50 flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 mb-1 block">{selectedNode.type}</span>
                <h2 className="text-xl font-bold text-slate-800">{selectedNode.title}</h2>
              </div>
              <button 
                onClick={() => setSelectedNode(null)}
                className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2 mb-3">Core Functionality</h3>
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{selectedNode.logic}</p>
              </div>

              {selectedNode.description && (
                <div>
                  <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2 mb-3">Description</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{selectedNode.description}</p>
                </div>
              )}

              {selectedNode.tables && (
                <div>
                  <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2 mb-3">Affected Tables</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedNode.tables.map(t => (
                      <span key={t} className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-mono rounded border border-emerald-200">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedNode.columns && (
                <div>
                  <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2 mb-3">Database Schema (Deep Dive)</h3>
                  <div className="space-y-3">
                    {Object.entries(selectedNode.columns).map(([table, cols]) => (
                      <div key={table} className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <div className="text-xs font-bold text-slate-700 mb-2 font-mono">{table}</div>
                        <div className="text-xs text-slate-600 font-mono leading-relaxed break-words">
                          {cols.split(', ').map(c => (
                            <div key={c} className="ml-2 border-l-2 border-slate-300 pl-2 mb-1">{c}</div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
