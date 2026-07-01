import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { MainLayout } from '../components/layout/MainLayout';
import { Camera, Save, Loader2 } from 'lucide-react';

export const ProfilePage = () => {
  const { profile } = useAuth();
  const { t } = useLanguage();
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
      alert(`${t.profErrUpload} ${error.message}`);
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
      
      alert(t.profSuccess);
      window.location.reload();
    } catch (error) {
      alert(`${t.profErrSave} ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <MainLayout title={t.profTitle} subtitle={t.profSub} noPadding={true}>
      <div className="w-full flex-1 flex flex-col bg-white">
        
        <div className="px-8 py-10 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center gap-8 bg-slate-50/50">
          <div className="relative group cursor-pointer shrink-0">
            <div className="w-28 h-28 rounded-full bg-slate-100 border-4 border-white shadow-md overflow-hidden flex items-center justify-center">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl font-bold text-slate-300">
                  {name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            
            <label className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
              {uploading ? <Loader2 className="text-white animate-spin" size={28} /> : <Camera className="text-white" size={28} />}
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
            <h2 className="text-2xl font-bold text-slate-800">{profile?.email}</h2>
            <span className="inline-block mt-2 px-3 py-1 bg-indigo-50 text-indigo-700 text-sm font-bold rounded-md uppercase tracking-wider">
              {profile?.role}
            </span>
          </div>
        </div>

        <div className="flex-1 p-8">
          <div className="max-w-3xl space-y-8">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">{t.profName}</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">{t.profEmail}</label>
              <input 
                type="email" 
                value={profile?.email}
                disabled
                className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-lg text-slate-400 cursor-not-allowed font-medium"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">{t.profPass}</label>
              <input 
                type="password" 
                value="********"
                disabled
                className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-lg text-slate-400 cursor-not-allowed font-medium"
              />
            </div>

            <div className="pt-4 flex justify-start">
              <button 
                onClick={handleSave}
                disabled={saving || uploading}
                className="flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50"
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                {t.profSave}
              </button>
            </div>
          </div>
        </div>

      </div>
    </MainLayout>
  );
};
