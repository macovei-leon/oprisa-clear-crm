import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { MainLayout } from '../components/layout/MainLayout';
import { Camera, Save, Loader2 } from 'lucide-react';

export const ProfilePage = () => {
  const { profile } = useAuth();
  const [name, setName] = useState(profile?.name || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleImageUpload = async (e) => {
    try {
      setUploading(true);
      const file = e.target.files[0];
      if (!file) return;

      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.id}-${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setAvatarUrl(publicData.publicUrl);
    } catch (error) {
      alert(`Eroare la încărcarea imaginii: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const { error } = await supabase
        .from('profiles')
        .update({
          name: name,
          avatar_url: avatarUrl
        })
        .eq('id', profile.id);

      if (error) throw error;
      
      alert('Profilul a fost salvat cu succes! Pagina se va reîncărca pentru a aplica schimbările.');
      window.location.reload();
    } catch (error) {
      alert(`Eroare la salvare: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <MainLayout title="Profilul Meu" subtitle="Gestionează setările contului tău">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        
        <div className="p-8 border-b border-slate-100 flex items-center gap-8">
          <div className="relative group cursor-pointer">
            <div className="w-24 h-24 rounded-full bg-slate-100 border-4 border-white shadow-lg overflow-hidden flex items-center justify-center">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-bold text-slate-300">
                  {name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            
            <label className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
              {uploading ? <Loader2 className="text-white animate-spin" size={24} /> : <Camera className="text-white" size={24} />}
              <input 
                type="file" 
                accept="image/*"
                className="hidden" 
                onChange={handleImageUpload}
                disabled={uploading}
              />
            </label>
          </div>
          
          <div>
            <h2 className="text-xl font-bold text-slate-800">{profile?.email}</h2>
            <span className="inline-block mt-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-md uppercase tracking-wider">
              {profile?.role}
            </span>
          </div>
        </div>

        <div className="p-8 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Nume Complet</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Email</label>
            <input 
              type="email" 
              value={profile?.email}
              disabled
              className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-400 cursor-not-allowed font-medium"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Parolă</label>
            <input 
              type="password" 
              value="********"
              disabled
              className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-400 cursor-not-allowed font-medium"
            />
          </div>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button 
            onClick={handleSave}
            disabled={saving || uploading}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Salvează Profilul
          </button>
        </div>

      </div>
    </MainLayout>
  );
};
