import { useAuth } from '../context/AuthContext.jsx';

function navigateTo(path) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function TermsOfServicePage() {
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
            Terms of Service
          </h1>

          <p className="mt-4 text-sm text-slate-500">
            Last updated: September 2026
          </p>
        </div>

        <div className="space-y-10 leading-7 text-slate-300">
          <section>
            <h2 className="text-2xl font-semibold text-white">
              1. Acceptance of Terms
            </h2>

            <p className="mt-4">
              By accessing or using MOM Creator, you agree to these Terms of
              Service. If you do not agree with these terms, you should not use
              the service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">
              2. Description of the Service
            </h2>

            <p className="mt-4">
              MOM Creator is a meeting management application that provides
              functionality for creating meetings, processing meeting content,
              generating Minutes of Meeting, and managing related action items.
            </p>

            <p className="mt-4">
              Features may change, be added, or be removed as the service
              develops.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">
              3. Accounts
            </h2>

            <p className="mt-4">
              You are responsible for maintaining the security of your account
              credentials and for activity performed through your account.
            </p>

            <p className="mt-4">
              You must provide accurate information when creating and
              maintaining your account.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">
              4. Workspaces
            </h2>

            <p className="mt-4">
              MOM Creator may provide workspaces that allow multiple users to
              collaborate on meetings, Minutes of Meeting, and action items.
            </p>

            <p className="mt-4">
              Workspace owners and members may have different permissions
              depending on the application's workspace access controls.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">
              5. Meeting Content
            </h2>

            <p className="mt-4">
              You are responsible for ensuring that you have the necessary
              rights and permissions to record, upload, transcribe, process,
              and share meeting content through MOM Creator.
            </p>

            <p className="mt-4">
              This includes complying with applicable recording-consent,
              privacy, confidentiality, intellectual-property, and employment
              requirements.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">
              6. AI-Generated Content
            </h2>

            <p className="mt-4">
              MOM Creator may use artificial intelligence to generate
              summaries, Minutes of Meeting, discussion points, decisions, and
              action items from meeting content.
            </p>

            <p className="mt-4">
              AI-generated content may contain errors or omissions and should
              be reviewed by users before being relied upon or distributed.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">
              7. Third-Party Integrations
            </h2>

            <p className="mt-4">
              MOM Creator may integrate with third-party services such as
              Google services and other meeting or calendar providers.
            </p>

            <p className="mt-4">
              Use of those services may also be subject to the third party's
              own terms, policies, and requirements.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">
              8. Prohibited Use
            </h2>

            <p className="mt-4">
              You must not use MOM Creator to violate applicable laws or
              regulations, interfere with the service, gain unauthorized access
              to accounts or data, or abuse third-party integrations.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">
              9. Intellectual Property
            </h2>

            <p className="mt-4">
              The MOM Creator application, including its software, interface,
              branding, and associated materials, is protected by applicable
              intellectual-property laws.
            </p>

            <p className="mt-4">
              Users retain responsibility for content they provide to the
              service and for ensuring that they have the rights necessary to
              use that content.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">
              10. Service Availability
            </h2>

            <p className="mt-4">
              MOM Creator may occasionally be unavailable because of
              maintenance, infrastructure issues, third-party service
              interruptions, or other circumstances.
            </p>

            <p className="mt-4">
              The service is provided subject to its availability and
              operational limitations.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">
              11. Suspension or Termination
            </h2>

            <p className="mt-4">
              Access to MOM Creator may be suspended or terminated where
              necessary to protect the service, users, third-party systems, or
              comply with applicable requirements.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">
              12. Disclaimer
            </h2>

            <p className="mt-4">
              MOM Creator provides software tools for meeting management and
              AI-assisted document generation. The service does not guarantee
              that generated transcripts, summaries, Minutes of Meeting, or
              action items will always be complete or accurate.
            </p>

            <p className="mt-4">
              Users should review generated information before relying on it
              for important decisions or communications.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">
              13. Changes to These Terms
            </h2>

            <p className="mt-4">
              These Terms of Service may be updated as the service changes.
              Updated terms will be published on this page.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">
              14. Contact
            </h2>

            <p className="mt-4">
              Questions regarding these Terms of Service can be directed to
              the MOM Creator application operator through the contact
              information provided with the service.
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

export default TermsOfServicePage;