import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useState, useEffect } from 'react';

export default function MainLayout() {
  const location = useLocation();
  const path = location.pathname;
  const { user, logout } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  
  // sidebarOpen acts as "pinned" on desktop, and "visible" on mobile
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Close sidebar on route change on mobile
  useEffect(() => {
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, [location.pathname]);

  return (
    <div className="bg-background text-on-surface overflow-hidden h-screen flex w-full relative">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity" 
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 h-full flex flex-col z-50 bg-slate-900 border-r border-slate-800 transform transition-all duration-300 ease-in-out overflow-hidden
          ${sidebarOpen ? 'translate-x-0 w-[280px]' : '-translate-x-full w-[280px] md:translate-x-0 md:w-20'}
        `}
      >
        <div className="p-4 h-16 flex items-center gap-2 overflow-hidden flex-shrink-0">
          <button 
            className="text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-800 transition-colors flex items-center justify-center flex-shrink-0"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
          
          <div className={`flex flex-col gap-0.5 ml-2 transition-opacity duration-300 whitespace-nowrap ${!sidebarOpen ? 'md:opacity-0 opacity-100' : 'opacity-100'}`}>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-400 text-xl">precision_manufacturing</span>
              <span className="font-headline-sm text-headline-sm font-bold text-white">Industrial Hub</span>
            </div>
          </div>
          
          <button 
            className="md:hidden ml-auto text-slate-400 hover:text-white p-1 rounded-md transition-colors"
            onClick={() => setSidebarOpen(false)}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        
        <nav className="flex-1 px-3 py-4 space-y-2 overflow-y-auto overflow-x-hidden custom-scrollbar">
          <Link onClick={() => { if (!sidebarOpen) setSidebarOpen(true); }} to="/getting-started" className={`flex items-center gap-4 px-3 py-3 rounded-xl transition-all duration-200 ${path === '/getting-started' ? 'bg-blue-600/20 text-blue-400 font-bold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
            <span className="material-symbols-outlined text-[24px] flex-shrink-0" data-icon="rocket_launch">rocket_launch</span>
            <span className={`font-label-lg text-label-lg whitespace-nowrap transition-opacity duration-300 ${!sidebarOpen ? 'md:opacity-0 opacity-100' : 'opacity-100'}`}>Getting Started</span>
          </Link>
          {user?.role === 'admin' && (
            <>
              <Link onClick={() => { if (!sidebarOpen) setSidebarOpen(true); }} to="/admin" className={`flex items-center gap-4 px-3 py-3 rounded-xl transition-all duration-200 ${path === '/admin' ? 'bg-blue-600/20 text-blue-400 font-bold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
                <span className="material-symbols-outlined text-[24px] flex-shrink-0" data-icon="upload_file">upload_file</span>
                <span className={`font-label-lg text-label-lg whitespace-nowrap transition-opacity duration-300 ${!sidebarOpen ? 'md:opacity-0 opacity-100' : 'opacity-100'}`}>Document Ingestion</span>
              </Link>
              <Link onClick={() => { if (!sidebarOpen) setSidebarOpen(true); }} to="/verification" className={`flex items-center gap-4 px-3 py-3 rounded-xl transition-all duration-200 ${path === '/verification' ? 'bg-blue-600/20 text-blue-400 font-bold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
                <span className="material-symbols-outlined text-[24px] flex-shrink-0" data-icon="rule">rule</span>
                <span className={`font-label-lg text-label-lg whitespace-nowrap transition-opacity duration-300 ${!sidebarOpen ? 'md:opacity-0 opacity-100' : 'opacity-100'}`}>HITL Verification</span>
              </Link>
              <Link onClick={() => { if (!sidebarOpen) setSidebarOpen(true); }} to="/plant-manager-inbox" className={`flex items-center gap-4 px-3 py-3 rounded-xl transition-all duration-200 ${path === '/plant-manager-inbox' ? 'bg-blue-600/20 text-blue-400 font-bold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
                <span className="material-symbols-outlined text-[24px] flex-shrink-0" data-icon="inbox">inbox</span>
                <span className={`font-label-lg text-label-lg whitespace-nowrap transition-opacity duration-300 ${!sidebarOpen ? 'md:opacity-0 opacity-100' : 'opacity-100'}`}>Compliance Inbox</span>
              </Link>
            </>
          )}
          <Link onClick={() => { if (!sidebarOpen) setSidebarOpen(true); }} to="/copilot" className={`flex items-center gap-4 px-3 py-3 rounded-xl transition-all duration-200 ${path === '/copilot' ? 'bg-blue-600/20 text-blue-400 font-bold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
            <span className="material-symbols-outlined text-[24px] flex-shrink-0" data-icon="smart_toy">smart_toy</span>
            <span className={`font-label-lg text-label-lg whitespace-nowrap transition-opacity duration-300 ${!sidebarOpen ? 'md:opacity-0 opacity-100' : 'opacity-100'}`}>Expert Copilot</span>
          </Link>
          <Link onClick={() => { if (!sidebarOpen) setSidebarOpen(true); }} to="/knowledge-graph" className={`flex items-center gap-4 px-3 py-3 rounded-xl transition-all duration-200 ${path === '/knowledge-graph' ? 'bg-blue-600/20 text-blue-400 font-bold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
            <span className="material-symbols-outlined text-[24px] flex-shrink-0" data-icon="account_tree">account_tree</span>
            <span className={`font-label-lg text-label-lg whitespace-nowrap transition-opacity duration-300 ${!sidebarOpen ? 'md:opacity-0 opacity-100' : 'opacity-100'}`}>Knowledge Graph</span>
          </Link>
          <Link onClick={() => { if (!sidebarOpen) setSidebarOpen(true); }} to="/rca" className={`flex items-center gap-4 px-3 py-3 rounded-xl transition-all duration-200 ${path === '/rca' ? 'bg-blue-600/20 text-blue-400 font-bold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
            <span className="material-symbols-outlined text-[24px] flex-shrink-0" data-icon="troubleshoot">troubleshoot</span>
            <span className={`font-label-lg text-label-lg whitespace-nowrap transition-opacity duration-300 ${!sidebarOpen ? 'md:opacity-0 opacity-100' : 'opacity-100'}`}>RCA Intelligence</span>
          </Link>
          <Link onClick={() => { if (!sidebarOpen) setSidebarOpen(true); }} to="/compliance" className={`flex items-center gap-4 px-3 py-3 rounded-xl transition-all duration-200 ${path === '/compliance' ? 'bg-blue-600/20 text-blue-400 font-bold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
            <span className="material-symbols-outlined text-[24px] flex-shrink-0" data-icon="verified">verified</span>
            <span className={`font-label-lg text-label-lg whitespace-nowrap transition-opacity duration-300 ${!sidebarOpen ? 'md:opacity-0 opacity-100' : 'opacity-100'}`}>Compliance Check</span>
          </Link>
          <Link onClick={() => { if (!sidebarOpen) setSidebarOpen(true); }} to="/lessons" className={`flex items-center gap-4 px-3 py-3 rounded-xl transition-all duration-200 ${path === '/lessons' ? 'bg-blue-600/20 text-blue-400 font-bold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
            <span className="material-symbols-outlined text-[24px] flex-shrink-0" data-icon="tips_and_updates">tips_and_updates</span>
            <span className={`font-label-lg text-label-lg whitespace-nowrap transition-opacity duration-300 ${!sidebarOpen ? 'md:opacity-0 opacity-100' : 'opacity-100'}`}>Lessons Learned</span>
          </Link>
        </nav>
        
        <div className="p-3 mt-auto border-t border-slate-800 bg-slate-900 relative">
          <div className="relative">
            <button onClick={(e) => { e.stopPropagation(); if (!sidebarOpen) setSidebarOpen(true); setProfileOpen(!profileOpen); }} className="w-full flex items-center gap-3 hover:bg-slate-800 p-2 rounded-xl transition-colors outline-none">
              <div className="h-9 w-9 rounded-full overflow-hidden bg-blue-600 text-white flex items-center justify-center font-bold shadow-sm flex-shrink-0">
                {user?.full_name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className={`flex flex-col items-start overflow-hidden transition-opacity duration-300 ${!sidebarOpen ? 'md:opacity-0 opacity-100' : 'opacity-100'}`}>
                <span className="text-label-md font-bold text-on-surface truncate w-full text-left">{user?.full_name}</span>
                <span className="text-label-sm text-on-surface-variant truncate w-full text-left">{user?.email}</span>
              </div>
            </button>
            
            {profileOpen && (
              <div className={`absolute bottom-full mb-2 bg-white border border-outline-variant rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.15)] z-[100] overflow-hidden transform transition-all ${sidebarOpen ? 'left-0 w-[240px]' : 'left-0 w-56'}`}>
                <div className="p-4 border-b border-outline-variant bg-surface-container-lowest">
                  <p className="text-body-sm font-bold text-on-surface truncate">{user?.full_name}</p>
                  <p className="text-label-sm text-on-surface-variant truncate">{user?.email}</p>
                </div>
                <button onClick={logout} className="w-full text-left px-4 py-3 text-red-600 hover:bg-red-50 text-label-md font-bold flex items-center gap-2 transition-colors">
                  <span className="material-symbols-outlined text-[18px]">logout</span>
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main 
        className={`flex-1 flex flex-col h-full overflow-hidden w-full transition-all duration-300 ease-in-out ${sidebarOpen ? 'md:ml-[280px]' : 'md:ml-20'}`}
        onClick={() => {
          // Close sidebar when clicking main content area
          if (sidebarOpen) setSidebarOpen(false);
        }}
      >
        {!sidebarOpen && (
          <button 
            className="md:hidden absolute top-4 left-4 z-40 bg-surface shadow-md p-2 rounded-xl text-on-surface hover:text-primary transition-colors flex items-center justify-center border border-outline-variant"
            onClick={(e) => { e.stopPropagation(); setSidebarOpen(true); }}
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
        )}
        
        {/* Page Content */}
        <div className="flex-1 overflow-auto bg-surface-bright relative">
            <Outlet />
        </div>
      </main>
    </div>
  );
}
