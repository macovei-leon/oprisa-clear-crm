import React, { createContext, useContext, useState, useEffect } from 'react';

const LanguageContext = createContext();

const translations = {
  ro: {
    mainTitle: "Oprisa OPS",
    mainSubtitle: "Autentificare necesară",
    lblEmail: "Adresă Email",
    lblPass: "Parolă",
    btnLogin: "Conectare",
    txtNoAccount: "Nu ai cont?",
    linkSignup: "Înregistrează-te",
    lblName: "Nume Complet",
    lblPassRepeat: "Repetă Parola",
    lblDepartment: "Departament",
    btnSignup: "Creează Cont",
    txtHasAccount: "Ai deja cont?",
    linkLogin: "Conectează-te",
    pendingTitle: "Cont în așteptare",
    pendingDesc: "Contul tău a fost creat cu succes, dar necesită aprobarea unui administrator pentru a accesa platforma. Te rugăm să revii mai târziu.",
    btnSignout: "Ieși din cont",
    linkForgotPass: "Ai uitat parola?",
    forgotTitle: "Resetare Parolă",
    forgotDesc: "Introdu adresa de email și îți vom trimite un link pentru a reseta parola.",
    btnForgotSubmit: "Trimite Link",
    linkBackLogin: "Înapoi la autentificare",
    resetTitle: "Setare Parolă Nouă",
    lblNewPass: "Parolă Nouă",
    lblNewPassRepeat: "Repetă Parola Nouă",
    btnResetSubmit: "Actualizează Parola",
    checkEmailTitle: "Înregistrare în așteptare",
    checkEmailDesc: "Cererea ta a fost trimisă! Contul tău necesită aprobarea unui administrator. Te rugăm să verifici căsuța de email pentru link-ul de confirmare și să aștepți aprobarea.",
    // Admin Panel Translations
    campaignsTitle: "Management Campanii (Flashcards)",
    campaignsDesc: "Gestionează campaniile. Crearea se face doar din panoul Baze de Date.",
    tabActiveCampaigns: "Campanii Active",
    tabArchivedCampaigns: "Arhivă (Trash Bin)",
    loading: "Se încarcă...",
    noActiveCampaigns: "Nu există campanii active.",
    noArchivedCampaigns: "Nu există campanii arhivate.",
    colCampInfo: "Informații Campanie",
    colActions: "Acțiuni",
    noDescription: "Fără descriere",
    btnArchive: "Arhivează",
    btnRestore: "Restaurează",
    btnDeletePerm: "Șterge",
    confirmArchive: "Ești sigur că vrei să arhivezi această campanie?",
    confirmDelete: "ATENȚIE! Ești sigur că vrei să ștergi DEFINITIV această campanie? Toate datele vor fi pierdute iremediabil.",
    msgArchived: "Campanie arhivată cu succes.",
    msgRestored: "Campanie restaurată cu succes.",
    msgDeleted: "Campanie ștearsă definitiv.",
    workerMonitoringTitle: "Monitorizare Activitate Operatori",
    workerMonitoringDesc: "Status online și progres sarcini curente din baza de date.",
    btnReload: "Reîncarcă Acum",
    noWorkers: "Nu există operatori activi.",
    colOperator: "Operator",
    colStatus: "Status",
    colTaskProgress: "Progres Sarcini (Global)",
    noDepartment: "Fără Departament",
    statusOnline: "ONLINE",
    statusOffline: "OFFLINE",
    wordTasks: "Sarcini"
  },
  en: {
    mainTitle: "Oprisa OPS",
    mainSubtitle: "Authentication required",
    lblEmail: "Email Address",
    lblPass: "Password",
    btnLogin: "Login",
    txtNoAccount: "Don't have an account?",
    linkSignup: "Register",
    lblName: "Full Name",
    lblPassRepeat: "Repeat Password",
    lblDepartment: "Department",
    btnSignup: "Create Account",
    txtHasAccount: "Already have an account?",
    linkLogin: "Login",
    pendingTitle: "Account Pending",
    pendingDesc: "Your account was successfully created, but it requires administrator approval to access the platform. Please check back later.",
    btnSignout: "Sign out",
    linkForgotPass: "Forgot password?",
    forgotTitle: "Reset Password",
    forgotDesc: "Enter your email address and we will send you a link to reset your password.",
    btnForgotSubmit: "Send Link",
    linkBackLogin: "Back to login",
    resetTitle: "Set New Password",
    lblNewPass: "New Password",
    lblNewPassRepeat: "Repeat New Password",
    btnResetSubmit: "Update Password",
    checkEmailTitle: "Registration Pending",
    checkEmailDesc: "Your registration request has been submitted and is awaiting administrator approval. Please check your email for the confirmation link and wait for approval.",
    // Admin Panel Translations
    campaignsTitle: "Campaign Management (Flashcards)",
    campaignsDesc: "Manage campaigns. Creation is only done from the Database panel.",
    tabActiveCampaigns: "Active Campaigns",
    tabArchivedCampaigns: "Archive (Trash Bin)",
    loading: "Loading...",
    noActiveCampaigns: "No active campaigns.",
    noArchivedCampaigns: "No archived campaigns.",
    colCampInfo: "Campaign Information",
    colActions: "Actions",
    noDescription: "No description",
    btnArchive: "Archive",
    btnRestore: "Restore",
    btnDeletePerm: "Delete",
    confirmArchive: "Are you sure you want to archive this campaign?",
    confirmDelete: "WARNING! Are you sure you want to PERMANENTLY delete this campaign? All data will be irretrievably lost.",
    msgArchived: "Campaign successfully archived.",
    msgRestored: "Campaign successfully restored.",
    msgDeleted: "Campaign permanently deleted.",
    workerMonitoringTitle: "Operator Activity Monitoring",
    workerMonitoringDesc: "Online status and current task progress from the database.",
    btnReload: "Reload Now",
    noWorkers: "No active operators.",
    colOperator: "Operator",
    colStatus: "Status",
    colTaskProgress: "Task Progress (Global)",
    noDepartment: "No Department",
    statusOnline: "ONLINE",
    statusOffline: "OFFLINE",
    wordTasks: "Tasks"
  }
};

export const LanguageProvider = ({ children }) => {
  const [lang, setLang] = useState('ro');

  useEffect(() => {
    const savedLang = localStorage.getItem('app_lang');
    if (savedLang && ['ro', 'en'].includes(savedLang)) {
      setLang(savedLang);
    }
  }, []);

  const changeLanguage = (newLang) => {
    setLang(newLang);
    localStorage.setItem('app_lang', newLang);
  };

  const t = translations[lang];

  return (
    <LanguageContext.Provider value={{ lang, changeLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
