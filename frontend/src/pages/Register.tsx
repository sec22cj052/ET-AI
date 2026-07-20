export default function Register() {
  return (
    <div className="min-h-screen flex items-center justify-center p-gutter bg-background">
      <main className="w-full max-w-[440px] flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700 z-10">
        <div className="bg-white border border-outline-variant shadow-sm rounded-lg overflow-hidden flex flex-col">
          <div className="p-8 flex flex-col gap-6">
            <h2 className="font-headline-md text-headline-md text-on-surface border-b border-surface-container-low pb-4">Create Account</h2>
            <form className="flex flex-col gap-5" onSubmit={(e) => e.preventDefault()}>
              <div className="flex flex-col gap-2">
                <label className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider" htmlFor="email">Work Email</label>
                <input className="w-full px-4 py-3 bg-white border border-outline-variant rounded-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none" id="email" type="email" required />
              </div>
              <button className="w-full bg-primary-container hover:bg-primary text-on-primary font-headline-md text-headline-md py-4 rounded-sm transition-all flex items-center justify-center gap-2 mt-2" type="submit">
                Register
              </button>
            </form>
          </div>
          <div className="bg-surface-container-low p-6 border-t border-outline-variant flex flex-col gap-4 text-center">
            <p className="font-body-md text-body-md text-on-surface-variant">
              Already have an account? <a className="text-primary font-semibold hover:underline" href="/login">Sign in</a>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
