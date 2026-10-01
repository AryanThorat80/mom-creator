import { useAuth } from '../context/AuthContext.jsx';

function navigateTo(path) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function PublicHomePage() {
    const { session } = useAuth();
    const isSignedIn = !!session;
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <button
            type="button"
            onClick={() => navigateTo('/')}
            className="text-xl brand-font tracking-tight"
          >
            MOM Creator
          </button>

          <div className="flex items-center gap-3">
            {isSignedIn ? (
                <button
                type="button"
                onClick={() => navigateTo('/dashboard')}
                className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-950 hover:bg-slate-200"
                >
                Dashboard
                </button>
            ) : (
                <>
                <button
                    type="button"
                    onClick={() => navigateTo('/login')}
                    className="rounded-lg px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white"
                >
                    Sign in
                </button>
                <button
                    type="button"
                    onClick={() => navigateTo('/register')}
                    className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-950 hover:bg-slate-200"
                >
                    Get Started
                </button>
                </>
            )}
            </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-7xl px-6 py-24">
          <div className="max-w-3xl">
            <p className="mb-5 text-sm font-medium uppercase tracking-widest text-slate-400">
              Meeting intelligence
            </p>

            <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
              Turn meetings into structured Minutes of Meeting.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              MOM Creator helps teams capture meeting information, process
              recordings and transcripts, generate Minutes of Meeting, and
              organize follow-up action items.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
                <button
                    type="button"
                    onClick={() => navigateTo(isSignedIn ? '/dashboard' : '/register')}
                    className="rounded-lg bg-white px-6 py-3 font-medium text-slate-950 hover:bg-slate-200"
                >
                    {isSignedIn ? 'Go to Dashboard' : 'Get Started'}
                </button>

                {!isSignedIn && (
                    <button
                    type="button"
                    onClick={() => navigateTo('/login')}
                    className="rounded-lg border border-slate-700 px-6 py-3 font-medium text-white hover:bg-slate-900"
                    >
                    Sign in
                    </button>
                )}
                </div>
          </div>
        </section>

        <section className="border-y border-slate-800 bg-slate-900/50">
          <div className="mx-auto grid max-w-7xl gap-8 px-6 py-16 md:grid-cols-3">
            <div>
              <h2 className="text-lg font-semibold">Capture meetings</h2>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                Create meetings and process supported meeting recordings and
                transcripts.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold">Generate MOMs</h2>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                Transform meeting transcripts into structured Minutes of
                Meeting for review.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold">Track action items</h2>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                Organize follow-up tasks associated with meetings and their
                Minutes of Meeting.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-20">
          <div className="max-w-3xl">
            <h2 className="text-3xl font-bold">Google integrations</h2>

            <p className="mt-4 leading-7 text-slate-400">
              MOM Creator can integrate with Google services to support meeting
              workflows and calendar-related functionality. Google user data
              is handled according to Google's API Services User Data Policy,
              including the Limited Use requirements where applicable.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            © {new Date().getFullYear()} MOM Creator
          </p>

          <div className="flex gap-5 text-sm text-slate-400">
            <button
              type="button"
              onClick={() => navigateTo('/privacy')}
              className="hover:text-white"
            >
              Privacy Policy
            </button>

            <button
              type="button"
              onClick={() => navigateTo('/terms')}
              className="hover:text-white"
            >
              Terms of Service
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default PublicHomePage;