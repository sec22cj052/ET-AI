export default function Login() {
  return (
    <div className="min-h-screen flex items-center justify-center p-gutter bg-background">
      <main className="w-full max-w-[440px] flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700 z-10">
        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center shadow-sm">
            <span className="material-symbols-outlined text-white text-[40px]" data-icon="factory">factory</span>
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">Industrial Knowledge Platform</h1>
            <p className="font-body-md text-body-md text-on-surface-variant">Precision Engineering Dashboard Access</p>
          </div>
        </div>

        <div className="bg-white border border-outline-variant shadow-sm rounded-lg overflow-hidden flex flex-col">
          <div className="p-8 flex flex-col gap-6">
            <h2 className="font-headline-md text-headline-md text-on-surface border-b border-surface-container-low pb-4">Sign In</h2>
            <form className="flex flex-col gap-5" onSubmit={(e) => e.preventDefault()}>
              <div className="flex flex-col gap-2">
                <label className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider" htmlFor="email">Work Email Address</label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">mail</span>
                  <input className="w-full pl-10 pr-4 py-3 bg-white border border-outline-variant rounded-sm font-body-md text-body-md focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none placeholder:text-outline" id="email" name="email" placeholder="name@company.com" required type="email" />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <label className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider" htmlFor="password">Password</label>
                  <a className="font-label-md text-label-md text-primary hover:underline transition-all" href="#">Forgot Password?</a>
                </div>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">lock</span>
                  <input className="w-full pl-10 pr-12 py-3 bg-white border border-outline-variant rounded-sm font-body-md text-body-md focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none" id="password" name="password" placeholder="••••••••" required type="password" />
                  <button className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors" type="button">
                    <span className="material-symbols-outlined">visibility</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input className="w-4 h-4 rounded-sm border-outline-variant text-primary focus:ring-primary" id="remember" type="checkbox" />
                <label className="font-body-md text-body-md text-on-surface-variant select-none" htmlFor="remember">Remember this device for 30 days</label>
              </div>

              <button className="w-full bg-primary-container hover:bg-primary text-on-primary font-headline-md text-headline-md py-4 rounded-sm transition-all pressed-state flex items-center justify-center gap-2 mt-2" type="submit">
                Sign In
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>
            </form>
          </div>

          <div className="bg-surface-container-low p-6 border-t border-outline-variant flex flex-col gap-4 text-center">
            <p className="font-body-md text-body-md text-on-surface-variant">
              New to the platform? <a className="text-primary font-semibold hover:underline" href="/register">Create an account</a>
            </p>
            <div className="flex items-center justify-center gap-4 border-t border-outline-variant pt-4">
              <span className="material-symbols-outlined text-outline text-sm">shield</span>
              <span className="font-label-sm text-label-sm text-outline uppercase tracking-widest">Enterprise Encrypted Protocol</span>
            </div>
          </div>
        </div>

        <footer className="flex justify-between items-center px-4">
          <div className="flex items-center gap-2 text-outline">
            <span className="material-symbols-outlined text-base">help_outline</span>
            <span className="font-label-md text-label-md">System Status: Optimal</span>
          </div>
          <div className="flex gap-4">
            <a className="font-label-md text-label-md text-on-surface-variant hover:text-primary" href="#">Legal</a>
            <a className="font-label-md text-label-md text-on-surface-variant hover:text-primary" href="#">Privacy</a>
          </div>
        </footer>
      </main>

      {/* Background Decorative Elements */}
      <div className="fixed top-0 left-0 w-full h-1 bg-primary"></div>
      <div className="fixed bottom-margin right-margin opacity-10 pointer-events-none hidden md:block z-0">
        <div className="w-[400px] h-[400px] bg-contain bg-no-repeat" style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDqTUIuLvP6P8tBwuO4KaXj1iVeftpVi9Ib5W0cWvDnrUa79AhWsurCpVGYFiTmdcY_tjz4l7ZXTzSQxjtllCqFuwiVZSRRWhXgF_gnSvPHwqmMTYsmR2hTkxDanD3bKMEFSU-sJsO0A7wjZWl5DQw1Q44qy9UEnxsl28ZVsd4SUEg9UPi5sopxJ6scLKgRRGwcsWA1qIpuiE8K6pSNhXUoqB8YNswUlD1buV1PZ-phOMejDkY960r3Yg')" }}></div>
      </div>
    </div>
  );
}
