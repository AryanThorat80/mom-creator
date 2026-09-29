import { useAuth } from '../context/AuthContext.jsx';

function navigateTo(path) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function PrivacyPolicyPage() {
    const { session } = useAuth();
    const isSignedIn = !!session;
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <header className="border-b border-slate-800">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <button
            type="button"
            onClick={() => navigateTo('/')}
            className="text-xl font-bold text-white"
          >
            MOM Creator
          </button>

          <button
            type="button"
            onClick={() => navigateTo(isSignedIn ? '/dashboard' : '/login')}
            className="rounded-lg px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white"
            >
            {isSignedIn ? 'Dashboard' : 'Sign in'}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-16">
        <div className="mb-12">
          <h1 className="text-4xl font-bold tracking-tight text-white">
            Privacy Policy
          </h1>

          <p className="mt-4 text-sm text-slate-500">
            Last updated: September 2026
          </p>
        </div>

        <div className="space-y-10 leading-7 text-slate-300">
          <section>
            <h2 className="text-2xl font-semibold text-white">
              1. Introduction
            </h2>

            <p className="mt-4">
              MOM Creator is a meeting management application designed to help
              users capture meeting information, process meeting recordings
              and transcripts, generate Minutes of Meeting, and manage action
              items.
            </p>

            <p className="mt-4">
              This Privacy Policy explains what information MOM Creator
              processes, how that information is used, and how users can
              manage their information.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">
              2. Information We Process
            </h2>

            <p className="mt-4">
              Depending on how you use MOM Creator, the service may process:
            </p>

            <ul className="mt-4 list-disc space-y-2 pl-6">
              <li>Account and profile information.</li>
              <li>Workspace and workspace membership information.</li>
              <li>Meeting titles, dates, settings, and related metadata.</li>
              <li>Meeting recordings, uploaded files, and attachments.</li>
              <li>Meeting transcripts and transcript-related information.</li>
              <li>Minutes of Meeting generated from meeting content.</li>
              <li>Action items and related task information.</li>
              <li>Information required to connect supported third-party services.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">
              3. Google Account and Google API Data
            </h2>

            <p className="mt-4">
              If you connect a Google account, MOM Creator may request access
              to Google services required to provide its integration features.
              Depending on the enabled functionality, this may include Google
              Meet and Google Calendar data.
            </p>

            <p className="mt-4">
              Google user data is used only to provide or improve the
              functionality requested by the user and is handled in accordance
              with Google's API Services User Data Policy and applicable
              Limited Use requirements.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">
              4. How Google Data Is Used
            </h2>

            <p className="mt-4">
              Google data accessed through MOM Creator may be used to support
              meeting creation, meeting-related workflows, calendar events,
              and other integration functionality explicitly provided by the
              application.
            </p>

            <p className="mt-4">
              Google data is not used for advertising or sold to third parties.
              MOM Creator does not use Google user data for purposes unrelated
              to the functionality of the connected integration.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">
              5. Google OAuth Credentials
            </h2>

            <p className="mt-4">
              When you authorize Google integration, MOM Creator stores the
              credentials necessary to maintain the connection. OAuth refresh
              tokens are encrypted before being stored by the application.
            </p>

            <p className="mt-4">
              Users can disconnect their Google integration through the
              application's integration controls when that functionality is
              available.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">
              6. Meeting Recordings, Transcripts, and AI Processing
            </h2>

            <p className="mt-4">
              Meeting recordings and transcripts may be processed to generate
              Minutes of Meeting and related structured information.
            </p>

            <p className="mt-4">
              AI processing may be used to transform meeting transcripts into
              summaries, discussion points, decisions, and action items.
            </p>

            <p className="mt-4">
              Users should ensure that they have the appropriate authorization
              to record, transcribe, upload, and process meeting content.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">
              7. Third-Party Services
            </h2>

            <p className="mt-4">
              MOM Creator may use third-party infrastructure and services to
              provide authentication, database storage, file storage, AI
              processing, communication, and external integrations.
            </p>

            <p className="mt-4">
              Information may be processed by these providers only as required
              to provide the corresponding functionality of MOM Creator.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">
              8. Data Security
            </h2>

            <p className="mt-4">
              MOM Creator uses security controls intended to protect account
              information, application data, and integration credentials.
              These controls include authenticated access, database access
              policies, encrypted OAuth credentials, and HTTPS for production
              deployments.
            </p>

            <p className="mt-4">
              No internet-based service can guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">
              9. Data Retention and Deletion
            </h2>

            <p className="mt-4">
              Meeting data, transcripts, Minutes of Meeting, action items, and
              account information may remain in the service while required to
              provide the application's functionality.
            </p>

            <p className="mt-4">
              Data deletion and retention behavior may depend on the applicable
              application functionality and account state. Users may contact
              the application operator regarding deletion requests.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">
              10. Disconnecting Google
            </h2>

            <p className="mt-4">
              Users may disconnect their Google account from MOM Creator using
              the application's Google integration controls where available.
              Disconnecting the integration prevents MOM Creator from using the
              stored Google authorization to make further API requests.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">
              11. Changes to This Policy
            </h2>

            <p className="mt-4">
              This Privacy Policy may be updated when the application's
              functionality, integrations, or legal requirements change. The
              updated policy will be published on this page.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">
              12. Contact
            </h2>

            <p className="mt-4">
              For privacy-related questions or requests, contact the MOM
              Creator application operator through the contact information
              provided with the service.
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-slate-800">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-8">
          <p className="text-sm text-slate-500">
            © {new Date().getFullYear()} MOM Creator
          </p>

          <button
            type="button"
            onClick={() => navigateTo('/')}
            className="text-sm text-slate-400 hover:text-white"
          >
            Back to home
          </button>
        </div>
      </footer>
    </div>
  );
}

export default PrivacyPolicyPage;