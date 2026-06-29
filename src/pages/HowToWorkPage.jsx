import React, { useState, useEffect } from 'react';
import { MainLayout } from '../components/layout/MainLayout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { BookOpen } from 'lucide-react';

export const HowToWorkPage = () => {
  const { profile, simulatedDepartment } = useAuth();
  const [instructions, setInstructions] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const deptId = simulatedDepartment ? simulatedDepartment.id : profile?.department_id;
    if (deptId) {
      fetchInstructions(deptId);
    } else {
      setLoading(false);
    }
  }, [profile, simulatedDepartment]);

  const fetchInstructions = async (deptId) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('departments')
      .select('instructions, name')
      .eq('id', deptId)
      .single();

    if (!error && data) {
      setInstructions(data.instructions || '');
    }
    setLoading(false);
  };

  return (
    <MainLayout title="Cum să lucrezi" subtitle="Instrucțiuni specifice departamentului tău">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[500px]">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3 bg-slate-50">
          <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
            <BookOpen size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Ghid de Lucru</h2>
            <p className="text-sm text-slate-500">Urmează instrucțiunile de mai jos pentru a-ți desfășura activitatea</p>
          </div>
        </div>

        <div className="p-8">
          {loading ? (
            <div className="text-center text-slate-500 py-12">Se încarcă instrucțiunile...</div>
          ) : !(simulatedDepartment ? simulatedDepartment.id : profile?.department_id) ? (
            <div className="text-center text-slate-500 py-12">
              <p className="font-semibold text-lg">Nu ești alocat niciunui departament.</p>
              <p className="mt-2">Contactează un administrator pentru a-ți seta departamentul.</p>
            </div>
          ) : !instructions ? (
            <div className="text-center text-slate-500 py-12">
              <p className="font-semibold text-lg">Nu există instrucțiuni momentan.</p>
              <p className="mt-2">Administratorul nu a adăugat încă un ghid pentru departamentul tău.</p>
            </div>
          ) : (
            <div 
              className="prose max-w-none prose-indigo prose-headings:font-bold prose-a:text-indigo-600"
              dangerouslySetInnerHTML={{ __html: instructions }}
            />
          )}
        </div>
      </div>
    </MainLayout>
  );
};
