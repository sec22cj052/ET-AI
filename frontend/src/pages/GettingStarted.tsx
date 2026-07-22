
import { Link } from 'react-router-dom';

export default function GettingStarted() {
  return (
    <div className="min-h-screen bg-surface-container-lowest relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-primary/10 to-transparent -z-10" />
      <div className="absolute -top-48 -right-48 w-96 h-96 bg-primary/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-48 -left-48 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-6xl mx-auto px-6 py-12 space-y-16">
        
        {/* Hero Section */}
        <div className="text-center max-w-4xl mx-auto mt-8 animate-fade-in-up">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface shadow-sm border border-outline-variant mb-6">
            <span className="material-symbols-outlined text-primary text-sm">auto_awesome</span>
            <span className="text-label-md font-bold text-primary tracking-wide uppercase">Industrial Knowledge Platform</span>
          </div>
          <h1 className="text-[3.5rem] leading-tight font-extrabold text-on-surface mb-6 tracking-tight">
            Turn Disconnected PDFs into <br className="hidden md:block"/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-600">Living Intelligence</span>
          </h1>
          <p className="text-body-xl text-on-surface-variant max-w-2xl mx-auto leading-relaxed">
            Eliminate silos and hallucinations. We transform your OEM Manuals, P&IDs, and Work Orders into a heavily structured, verifiable Knowledge Graph to power agentic AI.
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Link to="/admin" className="group block bg-surface rounded-3xl p-8 border border-outline-variant shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all duration-300 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-bl-full -z-10 transition-transform group-hover:scale-150" />
            <div className="h-14 w-14 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mb-6 shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
              <span className="material-symbols-outlined text-[28px]">upload_file</span>
            </div>
            <h3 className="text-title-lg font-bold text-on-surface mb-3">1. Agentic Ingestion</h3>
            <p className="text-body-md text-on-surface-variant mb-6 leading-relaxed">
              Upload complex engineering documents. Our AI acts as a Reliability Engineer, extracting entities and properties structurally.
            </p>
            <div className="text-blue-600 font-bold flex items-center gap-1 group-hover:gap-3 transition-all">
              Start Ingestion <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </div>
          </Link>

          <Link to="/verification" className="group block bg-surface rounded-3xl p-8 border border-outline-variant shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all duration-300 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-bl-full -z-10 transition-transform group-hover:scale-150" />
            <div className="h-14 w-14 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mb-6 shadow-sm group-hover:bg-amber-500 group-hover:text-white transition-colors duration-300">
              <span className="material-symbols-outlined text-[28px]">rule</span>
            </div>
            <h3 className="text-title-lg font-bold text-on-surface mb-3">2. Human in the Loop</h3>
            <p className="text-body-md text-on-surface-variant mb-6 leading-relaxed">
              Review and bulk-edit extracted data using natural language instructions. Ensure 100% ground-truth accuracy before building the graph.
            </p>
            <div className="text-amber-600 font-bold flex items-center gap-1 group-hover:gap-3 transition-all">
              Verify Data <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </div>
          </Link>

          <Link to="/copilot" className="group block bg-surface rounded-3xl p-8 border border-outline-variant shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all duration-300 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 rounded-bl-full -z-10 transition-transform group-hover:scale-150" />
            <div className="h-14 w-14 rounded-2xl bg-green-100 text-green-600 flex items-center justify-center mb-6 shadow-sm group-hover:bg-green-600 group-hover:text-white transition-colors duration-300">
              <span className="material-symbols-outlined text-[28px]">smart_toy</span>
            </div>
            <h3 className="text-title-lg font-bold text-on-surface mb-3">3. Expert Copilot</h3>
            <p className="text-body-md text-on-surface-variant mb-6 leading-relaxed">
              Query the unified Knowledge Graph. Get hallucination-free maintenance answers backed by directly linked source documents.
            </p>
            <div className="text-green-600 font-bold flex items-center gap-1 group-hover:gap-3 transition-all">
              Launch Copilot <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </div>
          </Link>
        </div>

        {/* Architecture / Why Section */}
        <div className="mt-20 bg-gradient-to-br from-surface to-surface-bright rounded-[2rem] border border-outline-variant shadow-lg overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2">
            <div className="p-12 lg:p-16 flex flex-col justify-center">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-xl flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-2xl">warning</span>
              </div>
              <h2 className="text-display-sm font-bold text-on-surface mb-6">The Hallucination Problem</h2>
              <p className="text-title-md font-medium text-on-surface-variant mb-4">
                Standard LLMs fail in heavy industry because knowledge is heavily siloed.
              </p>
              <p className="text-body-lg text-on-surface-variant leading-relaxed">
                When a technician asks about "Pump-101", a basic chatbot cannot connect the generic OEM manual to the specific historical Work Orders and OSHA safety standards. It guesses, which leads to safety hazards and costly downtime.
              </p>
            </div>
            
            <div className="bg-primary/5 p-12 lg:p-16 border-t lg:border-t-0 lg:border-l border-outline-variant flex flex-col justify-center">
              <div className="w-12 h-12 bg-primary/20 text-primary rounded-xl flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-2xl">account_tree</span>
              </div>
              <h2 className="text-display-sm font-bold text-on-surface mb-6">The Graph Solution</h2>
              <p className="text-title-md font-medium text-on-surface-variant mb-4">
                We bridge the gap using Entities and Relationships.
              </p>
              <p className="text-body-lg text-on-surface-variant leading-relaxed mb-6">
                By aggressively extracting physical assets and logical records as nodes, and mapping their relationships, we create a unified Digital Twin. When you ask our Copilot a question, it traverses this graph to pull perfectly contextualized, verified chunks.
              </p>
              <div className="flex items-center gap-3 text-primary font-bold">
                <span className="material-symbols-outlined">verified_user</span>
                100% Traceable. Zero Hallucinations.
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
