import React, { useState } from 'react';
import { X, User, Activity, FileText, Phone, Mail, MapPin, Building, StickyNote, CheckCircle, Database } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export const FlashcardModal = ({ task, stepConfig, onClose, onTransition, visibleColumns = [] }) => {
  const rowData = task.row_data || {};
  const branches = stepConfig?.branches || [];
  const [notes, setNotes] = useState('');

  const getColorClass = (colorName) => {
    const map = {
      success: 'bg-emerald-500 hover:bg-emerald-600 text-white',
      danger: 'bg-rose-500 hover:bg-rose-600 text-white',
      warning: 'bg-amber-500 hover:bg-amber-600 text-white',
      primary: 'bg-indigo-500 hover:bg-indigo-600 text-white',
      secondary: 'bg-slate-500 hover:bg-slate-600 text-white'
    };
    return map[colorName] || map['primary'];
  };

  // Extract common fields for quick access
  const phone = rowData.telefon || rowData.phone || '';
  const email = rowData.email || '';
  const company = rowData.companie || rowData.company || rowData.firma || '';
  const city = rowData.oras || rowData.city || rowData.localitate || '';
  const status = rowData.status || rowData.stare || '';

  const displayName = rowData.nume || rowData.name || rowData.denumire || 'FIȘĂ DOSAR CAMPANIE SARCINI';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-white shrink-0">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">FIȘĂ DOSAR CAMPANIE SARCINI</span>
            <div className="flex items-center gap-3 mt-1">
              <h2 className="text-2xl font-black text-slate-800">{displayName}</h2>
              {status && (
                <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-2.5 py-1 rounded-full border border-indigo-100">
                  {status}
                </span>
              )}
              {rowData.is_missing && (
                <span className="bg-red-100 text-red-700 text-xs font-bold px-2.5 py-1 rounded-full border border-red-200 flex items-center gap-1">
                  🚨 Exclus din baza de date
                </span>
              )}
            </div>
            {city && (
              <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-1 font-medium">
                <MapPin size={14} className="text-indigo-500" /> {city}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 bg-slate-50 p-2 rounded-full hover:bg-slate-100 transition-all">
            <X size={20} />
          </button>
        </div>

        {/* Content - 2 Column Layout */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col md:flex-row gap-8 bg-slate-50">
          
          {/* Column 1: Info & Data */}
          <div className="flex-1 flex flex-col gap-6">
            
            {/* Quick Contact Box */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 shadow-sm">
              <h3 className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                <User size={14} /> Contact Rapid
              </h3>
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="text-emerald-700 font-medium flex items-center gap-2 text-sm">
                    <Phone size={14} /> Telefon
                  </span>
                  {phone ? (
                    <a href={`tel:${phone}`} className="font-mono font-bold text-slate-800 hover:text-emerald-700">{phone}</a>
                  ) : (
                    <span className="text-emerald-600/50 italic text-sm">Lipsă Telefon</span>
                  )}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-emerald-700 font-medium flex items-center gap-2 text-sm">
                    <Mail size={14} /> Email
                  </span>
                  {email ? (
                    <a href={`mailto:${email}`} className="font-mono font-bold text-slate-800 hover:text-emerald-700">{email}</a>
                  ) : (
                    <span className="text-emerald-600/50 italic text-sm">Lipsă Email</span>
                  )}
                </div>
                {company && (
                  <div className="flex justify-between items-center">
                    <span className="text-emerald-700 font-medium flex items-center gap-2 text-sm">
                      <Building size={14} /> Companie
                    </span>
                    <span className="font-bold text-slate-800 text-sm">{company}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Full Database Info */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Database size={14} /> Date Complete Înregistrare
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Object.entries(rowData)
                  .filter(([key]) => !visibleColumns || visibleColumns.length === 0 || visibleColumns.includes(key))
                  .map(([key, val]) => (
                  <div key={key} className="flex flex-col border-b border-slate-100 pb-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{key}</span>
                    <span className="text-sm font-semibold text-slate-800 break-words">
                      {val !== null && val !== undefined && val !== '' ? String(val) : <em className="text-slate-300 font-normal">Nespecificat</em>}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Column 2: Plan & Notes */}
          <div className="w-full md:w-96 flex flex-col gap-6 shrink-0">
            
            {/* Step Instructions */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
              <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Plan Sarcini Campanie</span>
                <span className="text-xs font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">
                  Etapa: {stepConfig?.name}
                </span>
              </div>
              <div className="p-4 flex flex-col gap-4">
                {stepConfig?.description ? (
                  <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-amber-900 text-sm flex items-start gap-3">
                    <FileText className="shrink-0 mt-0.5 text-amber-600" size={16} />
                    <p className="whitespace-pre-wrap leading-relaxed">{stepConfig.description}</p>
                  </div>
                ) : (
                  <div className="text-sm text-slate-500 italic">Nu există instrucțiuni specifice pentru această etapă.</div>
                )}
              </div>
            </div>

            {/* Notes Form */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col gap-3">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                <StickyNote size={14} /> Notițe Jurnal (Opțional)
              </label>
              <textarea 
                className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
                rows="4"
                placeholder="Adaugă observații înainte de a trece la pasul următor..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {/* Dynamic Action Branches moved to Right Column */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col mt-auto overflow-hidden">
              <div className="bg-slate-100 px-4 py-3 border-b border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Acțiuni Disponibile
                </span>
              </div>
              <div className="p-4 flex flex-col gap-3">
                {branches.map(branch => (
                  <button
                    key={branch.id}
                    onClick={() => {
                      onTransition(task, branch.label, branch.action, notes);
                    }}
                    className={`w-full py-3 rounded-xl text-sm font-bold shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 ${getColorClass(branch.color)} flex items-center justify-center gap-2`}
                  >
                    {branch.action.startsWith('category_') ? <CheckCircle size={16} /> : <Activity size={16} />}
                    {branch.label}
                  </button>
                ))}
                {branches.length === 0 && (
                  <div className="text-sm text-slate-500 italic text-center py-2">Nu există acțiuni configurate.</div>
                )}
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
