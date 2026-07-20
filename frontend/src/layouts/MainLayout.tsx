import { Outlet, Link, useLocation } from 'react-router-dom';

export default function MainLayout() {
  const location = useLocation();
  const path = location.pathname;

  return (
    <div className="bg-background text-on-surface overflow-hidden h-screen flex w-full">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full flex flex-col z-40 bg-surface-container-low border-r border-outline-variant w-[240px]">
        <div className="p-6 flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-2xl">precision_manufacturing</span>
            <span className="font-headline-md text-headline-md font-bold text-primary">Industrial Hub</span>
          </div>
          <span className="font-label-md text-label-md text-on-surface-variant">Precision Engineering</span>
        </div>
        
        <nav className="flex-1 px-2 py-4 space-y-1">
          <Link to="/admin" className={`flex items-center gap-3 px-4 py-3 rounded-sm transition-all duration-200 ${path === '/admin' ? 'bg-secondary-container text-on-secondary-container font-bold border-l-2 border-primary' : 'text-on-surface-variant hover:bg-surface-container-high'}`}>
            <span className="material-symbols-outlined" data-icon="upload_file">upload_file</span>
            <span className="font-label-md text-label-md">Document Ingestion</span>
          </Link>
          <Link to="/verification" className={`flex items-center gap-3 px-4 py-3 rounded-sm transition-all duration-200 ${path === '/verification' ? 'bg-secondary-container text-on-secondary-container font-bold border-l-2 border-primary' : 'text-on-surface-variant hover:bg-surface-container-high'}`}>
            <span className="material-symbols-outlined" data-icon="rule">rule</span>
            <span className="font-label-md text-label-md">HITL Verification</span>
          </Link>
          <Link to="/copilot" className={`flex items-center gap-3 px-4 py-3 rounded-sm transition-all duration-200 ${path === '/copilot' ? 'bg-secondary-container text-on-secondary-container font-bold border-l-2 border-primary' : 'text-on-surface-variant hover:bg-surface-container-high'}`}>
            <span className="material-symbols-outlined" data-icon="smart_toy">smart_toy</span>
            <span className="font-label-md text-label-md">Expert Copilot</span>
          </Link>
          <Link to="/knowledge-graph" className={`flex items-center gap-3 px-4 py-3 rounded-sm transition-all duration-200 ${path === '/knowledge-graph' ? 'bg-secondary-container text-on-secondary-container font-bold border-l-2 border-primary' : 'text-on-surface-variant hover:bg-surface-container-high'}`}>
            <span className="material-symbols-outlined" data-icon="account_tree">account_tree</span>
            <span className="font-label-md text-label-md">Knowledge Graph</span>
          </Link>
          <Link to="/rca" className={`flex items-center gap-3 px-4 py-3 rounded-sm transition-all duration-200 ${path === '/rca' ? 'bg-secondary-container text-on-secondary-container font-bold border-l-2 border-primary' : 'text-on-surface-variant hover:bg-surface-container-high'}`}>
            <span className="material-symbols-outlined" data-icon="troubleshoot">troubleshoot</span>
            <span className="font-label-md text-label-md">RCA Intelligence</span>
          </Link>
          <Link to="/compliance" className={`flex items-center gap-3 px-4 py-3 rounded-sm transition-all duration-200 ${path === '/compliance' ? 'bg-secondary-container text-on-secondary-container font-bold border-l-2 border-primary' : 'text-on-surface-variant hover:bg-surface-container-high'}`}>
            <span className="material-symbols-outlined" data-icon="verified">verified</span>
            <span className="font-label-md text-label-md">Compliance Check</span>
          </Link>
          <Link to="/lessons" className={`flex items-center gap-3 px-4 py-3 rounded-sm transition-all duration-200 ${path === '/lessons' ? 'bg-secondary-container text-on-secondary-container font-bold border-l-2 border-primary' : 'text-on-surface-variant hover:bg-surface-container-high'}`}>
            <span className="material-symbols-outlined" data-icon="tips_and_updates">tips_and_updates</span>
            <span className="font-label-md text-label-md">Lessons Learned</span>
          </Link>
        </nav>
        
        <div className="px-4 py-4">
          <button className="w-full bg-primary text-on-primary py-2 rounded-sm font-label-md text-label-md flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all">
            <span className="material-symbols-outlined text-sm">add</span>
            New Analysis
          </button>
        </div>
        
        <div className="p-4 mt-auto border-t border-outline-variant">
          <a href="#" className="flex items-center gap-3 px-4 py-2 text-on-surface-variant hover:bg-surface-container-high transition-colors">
            <span className="material-symbols-outlined" data-icon="analytics">analytics</span>
            <span className="font-label-md text-label-md">System Health</span>
          </a>
          <a href="#" className="flex items-center gap-3 px-4 py-2 text-on-surface-variant hover:bg-surface-container-high transition-colors">
            <span className="material-symbols-outlined" data-icon="help">help</span>
            <span className="font-label-md text-label-md">Support</span>
          </a>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 ml-[240px] flex flex-col h-full overflow-hidden">
        {/* TopNavBar */}
        <header className="flex justify-between items-center w-full h-16 px-margin z-50 bg-surface border-b border-outline-variant flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-outline">
                <span className="material-symbols-outlined text-sm">search</span>
              </span>
              <input className="bg-surface-container-low border-none rounded-sm pl-10 pr-4 py-1.5 text-body-md w-64 focus:ring-1 focus:ring-primary" placeholder="Global search..." type="text" />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4">
              <span className="material-symbols-outlined text-on-surface-variant cursor-pointer hover:text-primary transition-colors" data-icon="monitor_heart">monitor_heart</span>
              <span className="material-symbols-outlined text-on-surface-variant cursor-pointer hover:text-primary transition-colors" data-icon="notifications">notifications</span>
              <span className="material-symbols-outlined text-on-surface-variant cursor-pointer hover:text-primary transition-colors" data-icon="settings">settings</span>
            </div>
            <div className="h-8 w-8 rounded-full overflow-hidden border border-outline-variant">
              <img className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAwKv73DVOth76tZT4dO-OCZGLv3SuFyYvy4pluUWeWXs65z3-S55Ty8C69e6y1PMTR8aGfX7CzXUOZ-JHR0eZK4bbNI1n9yclwJavVGRevsAv3lHoKT6j-MCwUheiJ0M9pAHoioadL45ObvabqXUdHph29jlALYHIwtggOY4F5SWgbqSBY_I4IxFAA-IeOAj27Ji9e8KQvOOsG5BSUtDffIJBuy9v83Jg2umFAExbeaOW9RZfuRUXkpQ" alt="User Avatar" />
            </div>
          </div>
        </header>
        
        {/* Page Content */}
        <div className="flex-1 overflow-auto bg-surface-bright">
            <Outlet />
        </div>
      </main>
    </div>
  );
}
