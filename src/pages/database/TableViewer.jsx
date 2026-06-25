import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '../../components/layout/MainLayout';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, Upload, Search, Filter, Trash2, CheckCircle2, AlertCircle, X, ChevronDown, Eye } from 'lucide-react';
import * as XLSX from 'xlsx';
import { CampaignBuilderModal } from '../../components/campaigns/CampaignBuilderModal';

export const TableViewer = () => {
  const { tableName } = useParams();
  const navigate = useNavigate();
  
  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filtering & Columns state
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({});
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showColumnsPanel, setShowColumnsPanel] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState([]);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 100;

  // Row Selection State
  const [selectedRowIndices, setSelectedRowIndices] = useState(new Set());
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [showRepetitiveModal, setShowRepetitiveModal] = useState(false);
  
  // Replace Data Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [excelFile, setExcelFile] = useState(null);
  const [detectedColumns, setDetectedColumns] = useState([]);
  const [parsedRows, setParsedRows] = useState([]);

  useEffect(() => {
    fetchTableData();
  }, [tableName]);

  const fetchTableData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Schema to get true columns
      const { data: schemaCols, error: schemaErr } = await supabase.rpc('get_table_columns', { p_table_name: tableName });
      if (schemaErr) throw schemaErr;
      
      const cols = schemaCols ? schemaCols.map(c => c.column_name).filter(c => c !== 'id') : [];
      setColumns(cols);
      
      // Initialize visible columns if empty
      if (visibleColumns.length === 0) {
        setVisibleColumns(cols);
      }

      // 2. Fetch Data (Fetch all in chunks to allow client-side filtering)
      let allData = [];
      let from = 0;
      const step = 5000;
      
      while (true) {
        const { data: tableData, error: dataErr } = await supabase.from(tableName).select('*').range(from, from + step - 1);
        if (dataErr) {
          if (dataErr.code === '42P01') {
            // Table does not exist (maybe newly created frontend card without DB backend)
            alert("Tabelul nu există încă în baza de date / Table does not exist yet.");
            break;
          } else {
            throw dataErr;
          }
        }
        
        if (!tableData || tableData.length === 0) break;
        
        allData = [...allData, ...tableData];
        if (tableData.length < step) break;
        from += step;
      }
      
      setData(allData);
      
      // Auto-extract column names if schema RPC failed but we have data
      if (cols.length === 0 && allData.length > 0) {
        const fallbackCols = Object.keys(allData[0]).filter(k => k !== 'id');
        setColumns(fallbackCols);
        if (visibleColumns.length === 0) setVisibleColumns(fallbackCols);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Extract unique values for text filters or min/max for numbers
  const columnStats = useMemo(() => {
    const stats = {};
    columns.forEach(col => {
      const values = data.map(row => row[col]).filter(v => v !== null && v !== undefined && v !== '');
      const isNumeric = values.every(v => !isNaN(parseFloat(v)));
      
      if (isNumeric && values.length > 0) {
        const nums = values.map(v => parseFloat(v));
        stats[col] = { type: 'number', min: Math.min(...nums), max: Math.max(...nums) };
      } else {
        const unique = [...new Set(values)];
        stats[col] = { type: 'text', unique: unique.length < 50 ? unique : [] }; // Only provide dropdown if < 50 unique values
      }
    });
    return stats;
  }, [data, columns]);

  const handleFilterChange = (col, value) => {
    setFilters(prev => ({
      ...prev,
      [col]: value
    }));
    setCurrentPage(1);
  };

  const filteredData = useMemo(() => {
    return data.filter(row => {
      // 1. Global Search (matches any column)
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesSearch = columns.some(col => String(row[col] || '').toLowerCase().includes(q));
        if (!matchesSearch) return false;
      }

      // 2. Column-specific filters
      for (const col in filters) {
        const filterVal = filters[col];
        if (!filterVal || filterVal === '') continue;

        const stat = columnStats[col];
        const rowVal = row[col];

        if (stat?.type === 'number') {
           // Handle min/max range object
           if (filterVal.min !== undefined && parseFloat(rowVal) < filterVal.min) return false;
           if (filterVal.max !== undefined && parseFloat(rowVal) > filterVal.max) return false;
        } else {
           // Exact match for dropdown
           if (String(rowVal) !== String(filterVal)) return false;
        }
      }

      return true;
    });
  }, [data, searchQuery, filters, columns, columnStats]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, currentPage]);

  const toggleRowSelection = (absoluteIndex) => {
    setSelectedRowIndices(prev => {
      const newSet = new Set(prev);
      if (newSet.has(absoluteIndex)) newSet.delete(absoluteIndex);
      else newSet.add(absoluteIndex);
      return newSet;
    });
  };

  const toggleAllPageSelection = () => {
    const start = (currentPage - 1) * itemsPerPage;
    const pageIndices = Array.from({ length: paginatedData.length }, (_, i) => start + i);
    const allSelected = pageIndices.every(idx => selectedRowIndices.has(idx));
    
    setSelectedRowIndices(prev => {
      const newSet = new Set(prev);
      pageIndices.forEach(idx => {
        if (allSelected) newSet.delete(idx);
        else newSet.add(idx);
      });
      return newSet;
    });
  };

  const selectedRowsData = useMemo(() => {
    return Array.from(selectedRowIndices).map(idx => filteredData[idx]).filter(Boolean);
  }, [selectedRowIndices, filteredData]);

  // ---- OVERWRITE LOGIC ----
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) setExcelFile(file);
  };

  const analyzeFile = async (e) => {
    e.preventDefault();
    if (!excelFile) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet);
        
        if (rows.length === 0) throw new Error("Foaie de lucru goală");
        
        const fileHeaders = Object.keys(rows[0]);
        // Map file headers to existing DB columns
        const cols = fileHeaders.map(fh => {
          let sanitized = fh.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, '');
          if (/^[0-9]/.test(sanitized)) sanitized = 'col_' + sanitized;
          
          // Does it match an existing column?
          const matchesExisting = columns.includes(sanitized);
          
          return { original: fh, sanitized, selected: true, matchesExisting };
        });
        
        setDetectedColumns(cols);
        setParsedRows(rows);
        setModalStep(2);
      } catch (err) {
        alert("Eroare la procesarea fișierului: " + err.message);
      }
    };
    reader.readAsArrayBuffer(excelFile);
  };

  const executeOverwrite = async () => {
    if (!confirm("Ești sigur? Această acțiune va șterge COMPLET datele existente din tabel și le va înlocui cu cele noi.")) return;
    
    setUploading(true);
    try {
      const selectedCols = detectedColumns.filter(c => c.selected);
      
      // 1. DDL if we need to add new columns to the table
      const newCols = selectedCols.filter(c => !c.matchesExisting);
      if (newCols.length > 0 || columns.length === 0) {
        const ddlSql = `
          CREATE TABLE IF NOT EXISTS public."${tableName}" (
            id uuid DEFAULT gen_random_uuid() PRIMARY KEY
          );
          ${selectedCols.map(c => `ALTER TABLE public."${tableName}" ADD COLUMN IF NOT EXISTS "${c.sanitized}" text;`).join('\n')}
          ALTER TABLE public."${tableName}" ENABLE ROW LEVEL SECURITY;
          DROP POLICY IF EXISTS "Allow all access to authenticated users" ON public."${tableName}";
          CREATE POLICY "Allow all access to authenticated users" ON public."${tableName}" FOR ALL TO authenticated USING (true) WITH CHECK (true);
          NOTIFY pgrst, 'reload schema';
        `;
        await supabase.rpc('execute_ddl', { query_text: ddlSql });
        await new Promise(r => setTimeout(r, 1000));
      }

      // 2. DELETE ALL EXISTING DATA
      const { error: delError } = await supabase.from(tableName).delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all trick
      if (delError) throw delError;

      // 3. Insert new data
      const mappedRows = parsedRows.map(row => {
        const newRow = {};
        selectedCols.forEach(col => {
          let val = row[col.original];
          if (val instanceof Date) val = val.toISOString();
          newRow[col.sanitized] = val !== undefined && val !== null ? String(val) : null;
        });
        return newRow;
      });

      for (let i = 0; i < mappedRows.length; i += 500) {
        const batch = mappedRows.slice(i, i + 500);
        const { error: insertError } = await supabase.from(tableName).insert(batch);
        if (insertError) throw insertError;
      }

      alert('Tabel suprascris cu succes!');
      setIsModalOpen(false);
      resetModal();
      fetchTableData(); // refresh UI
    } catch (err) {
      console.error(err);
      alert('Eroare: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const resetModal = () => {
    setModalStep(1);
    setExcelFile(null);
    setDetectedColumns([]);
    setParsedRows([]);
  };

  return (
    <MainLayout title={`Bază Date / ${tableName}`} subtitle="Vizualizare și administrare date">
      
      {/* Header Actions */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/database')} className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">
            <ArrowLeft size={20} />
          </button>
          
          <div className="relative">
            <Search className="absolute left-3 top-[10px] text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Căutare generală..." 
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg w-full md:w-80 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="relative">
            <button 
              onClick={() => { setShowColumnsPanel(!showColumnsPanel); setShowFilterPanel(false); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold border transition-colors ${showColumnsPanel ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}
            >
              <Eye size={18} /> Coloane Vizibile
            </button>
            {showColumnsPanel && (
              <div className="absolute top-full left-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-4 min-w-[240px] flex flex-col gap-2 max-h-96 overflow-y-auto">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Alege coloanele afișate</h4>
                {columns.map(col => (
                  <label key={col} className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer p-2 hover:bg-slate-50 rounded border border-transparent hover:border-slate-200">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 text-indigo-600 rounded"
                      checked={visibleColumns.includes(col)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setVisibleColumns([...visibleColumns, col]);
                        } else {
                          setVisibleColumns(visibleColumns.filter(c => c !== col));
                        }
                      }}
                    />
                    {col}
                  </label>
                ))}
              </div>
            )}
          </div>

          <button 
            onClick={() => { setShowFilterPanel(!showFilterPanel); setShowColumnsPanel(false); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold border transition-colors ${showFilterPanel ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}
          >
            <Filter size={18} /> Filtre Smart
          </button>
        </div>

        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Upload size={18} /> Încărcare Date / Upload Data
        </button>
      </div>

      {/* Filter Panel */}
      {showFilterPanel && (
        <div className="bg-white border border-slate-200 p-5 rounded-xl mb-6 shadow-sm flex flex-wrap gap-4">
          {columns.map(col => {
            const stat = columnStats[col];
            if (!stat) return null;

            if (stat.type === 'number') {
              return (
                <div key={col} className="w-full sm:w-auto min-w-[200px]">
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">{col} (Interval)</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      placeholder={`Min (${stat.min})`}
                      onChange={e => handleFilterChange(col, { ...filters[col], min: e.target.value ? parseFloat(e.target.value) : undefined })}
                      className="w-24 p-2 border border-slate-300 rounded-lg text-sm"
                    />
                    <span className="text-slate-400">-</span>
                    <input 
                      type="number" 
                      placeholder={`Max (${stat.max})`}
                      onChange={e => handleFilterChange(col, { ...filters[col], max: e.target.value ? parseFloat(e.target.value) : undefined })}
                      className="w-24 p-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                </div>
              );
            }

            if (stat.type === 'text' && stat.unique.length > 0) {
              return (
                <div key={col} className="w-full sm:w-auto min-w-[200px]">
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">{col}</label>
                  <select 
                    onChange={e => handleFilterChange(col, e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white"
                  >
                    <option value="">Toate</option>
                    {stat.unique.map((v, i) => <option key={i} value={v}>{v}</option>)}
                  </select>
                </div>
              );
            }
            
            return null;
          })}
        </div>
      )}

      {/* Data Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex-1">
        {loading ? (
          <div className="p-12 text-center text-slate-500">Se încarcă datele...</div>
        ) : filteredData.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
             <AlertCircle size={48} className="text-slate-300 mb-4" />
             <h3 className="text-lg font-bold text-slate-700">Nu am găsit date</h3>
             <p className="text-slate-500 mt-1">Acest tabel este gol sau nu există înregistrări pentru filtrele aplicate.</p>
          </div>
        ) : (
          <div className="overflow-x-auto h-[600px] relative">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-4 border-b border-slate-200 w-10">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                      checked={paginatedData.length > 0 && paginatedData.every((_, i) => selectedRowIndices.has((currentPage - 1) * itemsPerPage + i))}
                      onChange={toggleAllPageSelection}
                    />
                  </th>
                  {columns.filter(c => visibleColumns.includes(c)).map(col => (
                    <th key={col} className="px-6 py-4 border-b border-slate-200 font-bold text-slate-700 text-sm whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedData.map((row, idx) => {
                  const absoluteIndex = (currentPage - 1) * itemsPerPage + idx;
                  const isSelected = selectedRowIndices.has(absoluteIndex);
                  return (
                    <tr 
                      key={idx} 
                      onClick={() => toggleRowSelection(absoluteIndex)}
                      className={`transition-colors cursor-pointer ${isSelected ? 'bg-indigo-50/60' : 'hover:bg-slate-50/50'}`}
                    >
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                          checked={isSelected}
                          onChange={() => toggleRowSelection(absoluteIndex)}
                        />
                      </td>
                      {columns.filter(c => visibleColumns.includes(c)).map(col => (
                        <td key={col} className="px-6 py-3 text-sm text-slate-600 truncate max-w-xs" title={row[col] !== null && row[col] !== undefined ? String(row[col]) : ''}>
                          {row[col] !== null && row[col] !== undefined ? String(row[col]) : '-'}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!loading && filteredData.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <span className="text-sm text-slate-600 font-medium">
              Se afișează / Showing {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredData.length)} din / of {filteredData.length} rânduri / rows.
            </span>
            <div className="flex gap-2">
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="px-3 py-1 bg-white border border-slate-300 rounded text-sm disabled:opacity-50 hover:bg-slate-50"
              >
                Anterior / Prev
              </button>
              <button 
                disabled={currentPage * itemsPerPage >= filteredData.length}
                onClick={() => setCurrentPage(p => p + 1)}
                className="px-3 py-1 bg-white border border-slate-300 rounded text-sm disabled:opacity-50 hover:bg-slate-50"
              >
                Următor / Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Floating Action Bar for Selected Rows */}
      {selectedRowIndices.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-6 z-40 border border-slate-700 animate-in slide-in-from-bottom-10 fade-in duration-300">
          <div className="flex items-center gap-3 border-r border-slate-600 pr-6">
            <div className="bg-indigo-500 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">{selectedRowIndices.size}</div>
            <span className="font-semibold text-sm">rânduri selectate</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setSelectedRowIndices(new Set())} className="text-slate-300 hover:text-white text-sm font-semibold transition-colors">Deselectează</button>
            <div className="flex gap-2">
              <button 
                onClick={() => setShowCampaignModal(true)}
                className="bg-indigo-500 hover:bg-indigo-400 text-white px-5 py-2 rounded-full text-sm font-bold shadow-lg transition-colors flex items-center gap-2"
              >
                Creează Campanie Sarcini
              </button>
              <button 
                onClick={() => setShowRepetitiveModal(true)}
                className="bg-emerald-500 hover:bg-emerald-400 text-white px-5 py-2 rounded-full text-sm font-bold shadow-lg transition-colors flex items-center gap-2"
              >
                Creează Flux Repetitiv
              </button>
            </div>
          </div>
        </div>
      )}

      <CampaignBuilderModal 
        isOpen={showCampaignModal} 
        onClose={() => { setShowCampaignModal(false); setSelectedRowIndices(new Set()); }}
        selectedRowsData={selectedRowsData}
        tableName={tableName}
        visibleColumns={visibleColumns}
      />
      <CampaignBuilderModal 
        isOpen={showRepetitiveModal} 
        onClose={() => { setShowRepetitiveModal(false); setSelectedRowIndices(new Set()); }}
        selectedRowsData={selectedRowsData}
        tableName={tableName}
        visibleColumns={visibleColumns}
        isRepetitive={true}
      />

      {/* Overwrite Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-bold text-slate-800">Încărcare Date / Upload Data</h2>
              <button onClick={() => { setIsModalOpen(false); resetModal(); }} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              {modalStep === 1 ? (
                <form onSubmit={analyzeFile} className="flex flex-col gap-5">
                  <div className="p-4 bg-red-50 text-red-800 rounded-lg flex gap-3 text-sm border border-red-200">
                    <Trash2 className="shrink-0" size={20} />
                    <p><strong>ATENȚIE / WARNING!</strong> Această acțiune va șterge TOATE rândurile existente din tabelul <code>{tableName}</code> și le va înlocui complet cu datele din noul fișier. / This action will DELETE ALL existing rows and replace them with the new file.</p>
                  </div>
                  <div>
                    <label htmlFor="file-upload-overwrite" className="border-2 border-dashed border-indigo-300 rounded-xl p-6 text-center hover:bg-indigo-50 transition-colors bg-indigo-50/30 cursor-pointer flex flex-col items-center justify-center w-full">
                      <input type="file" id="file-upload-overwrite" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
                      <Upload size={32} className="text-indigo-600 mb-3" />
                      <span className="font-semibold text-slate-800">{excelFile ? excelFile.name : 'Selectează fișierul / Select file (Excel / CSV)'}</span>
                    </label>
                  </div>
                  <button type="submit" className="w-full py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 mt-2">
                    Analizează Datele / Analyze Data
                  </button>
                </form>
              ) : (
                <div className="flex flex-col gap-6">
                  <div className="bg-emerald-50 text-emerald-800 p-4 rounded-lg flex items-start gap-3">
                    <CheckCircle2 className="shrink-0 mt-0.5" size={20} />
                    <div>
                      <p className="text-sm">Se vor insera / Will insert <strong>{parsedRows.length} rânduri noi / new rows</strong>. Analizați corespondența coloanelor mai jos. Dacă o coloană nouă apare în Excel, aceasta va fi adăugată automat la structura tabelului curent. / Analyze column mapping below.</p>
                    </div>
                  </div>
                  
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 font-bold text-sm text-slate-700">Mapare Coloane</div>
                    <div className="max-h-64 overflow-y-auto p-2">
                      {detectedColumns.map((col, idx) => (
                        <div key={idx} className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-lg cursor-pointer">
                          <input type="checkbox" className="w-5 h-5 text-amber-600 rounded" checked={col.selected} 
                            onChange={() => {
                              const newCols = [...detectedColumns];
                              newCols[idx].selected = !newCols[idx].selected;
                              setDetectedColumns(newCols);
                            }} 
                          />
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-800">{col.original}</span>
                            <span className="text-xs text-slate-500 font-mono">
                              {col.matchesExisting ? `Se suprapune cu DB: ${col.sanitized}` : `Coloană NOUĂ: ${col.sanitized}`}
                            </span>
                          </div>
                          {col.matchesExisting && <span className="ml-auto bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded">MATCH</span>}
                          {!col.matchesExisting && <span className="ml-auto bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-1 rounded">ADD</span>}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button onClick={() => setModalStep(1)} disabled={uploading} className="flex-1 py-3 border border-slate-300 text-slate-700 font-bold rounded-lg hover:bg-slate-50">Înapoi / Back</button>
                    <button onClick={executeOverwrite} disabled={uploading} className="flex-[2] py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 flex justify-center items-center">
                      {uploading ? 'Se procesează / Processing...' : 'Șterge Datele Vechi și Suprascrie / Delete Old & Overwrite'}
                    </button>
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
