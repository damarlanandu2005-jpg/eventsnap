import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';

export default function Layout({ children, title, description }) {
  const router = useRouter();
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'EventSnap';
  const pageTitle = title ? `${title} — ${appName}` : appName;

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta
          name="description"
          content={description || 'Find your event photos with AI face matching'}
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-purple-950 text-white font-sans">
        {/* Ambient glow effects */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-500/20 rounded-full blur-[128px] animate-pulse-slow" />
          <div className="absolute top-1/2 -left-40 w-80 h-80 bg-indigo-500/15 rounded-full blur-[100px] animate-pulse-slow animation-delay-2000" />
          <div className="absolute -bottom-40 right-1/3 w-72 h-72 bg-violet-500/10 rounded-full blur-[80px] animate-pulse-slow animation-delay-4000" />
        </div>

        {/* Navigation */}
        <nav className="relative z-50 border-b border-white/5 backdrop-blur-xl bg-white/[0.02]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <Link
                href="/"
                className="flex items-center gap-2 group"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/25 group-hover:shadow-violet-500/40 transition-shadow">
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </div>
                <span className="text-lg font-bold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
                  {appName}
                </span>
              </Link>

              <div className="flex items-center gap-4">
                {router.pathname.startsWith('/admin') ? (
                  <Link
                    href="/"
                    className="text-sm text-white/50 hover:text-white/80 transition-colors"
                  >
                    Guest View
                  </Link>
                ) : (
                  <Link
                    href="/admin"
                    className="text-sm text-white/50 hover:text-white/80 transition-colors"
                  >
                    Admin
                  </Link>
                )}
              </div>
            </div>
          </div>
        </nav>

        {/* Main content */}
        <main className="relative z-10">{children}</main>

        {/* Footer */}
        <footer className="relative z-10 border-t border-white/5 mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <p className="text-center text-sm text-white/30">
              Powered by {appName} — AI-powered event photo matching
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
