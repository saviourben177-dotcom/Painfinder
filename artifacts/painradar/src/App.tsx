import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, SignIn, SignUp, useAuth, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/shared/keys';
import { shadcn } from '@clerk/themes';
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Bookmark, Check,
  CircleHelp, Command, ExternalLink, Flame, Gauge, Globe2,
  LayoutDashboard, LoaderCircle, LockKeyhole, LogOut, Menu, MessageSquareText,
  Plus, Search, Settings as SettingsIcon, SlidersHorizontal,
  Sparkles, Target, Trash2, Users, X, Zap,
} from 'lucide-react';
import {
  getGetAnalyticsQueryKey, getGetDashboardQueryKey, getGetLeadQueryKey,
  getGetSettingsQueryKey, getListCampaignsQueryKey, getListLeadsQueryKey, getListSourceStatusesQueryKey,
  useCreateCampaign, useCreateDemoWorkspace, useDiscoverHackerNews,
  useDeleteCampaign, useDeleteLead, useGetAnalytics, useGetDashboard, useGetLead,
  useGetSettings, useImportLead, useListCampaigns, useListLeads,
  useListSourceStatuses, useUpdateCampaign, useUpdateLead, useUpdateSettings,
} from '@workspace/api-client-react';
import type {
  Campaign, CampaignInput, Lead, LeadSource, LeadStatus, ListLeadsParams,
  UserSettingsUpdate,
} from '@workspace/api-client-react';
import { Link, Redirect, Route, Router as WouterRouter, Switch, useLocation, useParams } from 'wouter';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}
const sourceNames: Record<string, string> = { reddit: 'Reddit', hacker_news: 'Hacker News', x: 'X', facebook: 'Facebook', other: 'Other' };
const statusNames: Record<string, string> = { new: 'New', contacted: 'Contacted', replied: 'Replied', converted: 'Converted', dismissed: 'Dismissed' };
const intentNames: Record<string, string> = { recommendation_request: 'Recommendation request', solution_search: 'Solution search', general_problem: 'General problem' };
const navigation = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/discover', label: 'Discover leads', icon: Search },
  { href: '/campaigns', label: 'Campaigns', icon: Target },
  { href: '/saved', label: 'Saved leads', icon: Bookmark },
  { href: '/outreach', label: 'Outreach', icon: MessageSquareText },
  { href: '/analytics', label: 'Analytics', icon: Activity },
  { href: '/settings', label: 'Settings', icon: SettingsIcon },
];

function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}

const appearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#43d49a', colorForeground: '#e9f0f3', colorMutedForeground: '#91a0ae',
    colorDanger: '#eb7771', colorBackground: '#101925', colorInput: '#0b121d',
    colorInputForeground: '#edf5f4', colorNeutral: '#2a394b', fontFamily: 'Manrope, sans-serif',
    borderRadius: '0.7rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#101925] rounded-2xl w-[440px] max-w-full overflow-hidden border border-[#2a394b]',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#edf5f4] font-bold tracking-tight',
    headerSubtitle: 'text-[#91a0ae]',
    socialButtonsBlockButtonText: 'text-[#dce7e6] font-semibold',
    formFieldLabel: 'text-[#c7d2d7] font-semibold',
    footerActionLink: 'text-[#62e2ad] font-semibold',
    footerActionText: 'text-[#91a0ae]',
    dividerText: 'text-[#91a0ae]',
    identityPreviewEditButton: 'text-[#62e2ad]',
    formFieldSuccessText: 'text-[#62e2ad]',
    alertText: 'text-[#f2a39d]',
    logoBox: 'mb-3',
    logoImage: 'rounded-lg',
    socialButtonsBlockButton: 'border border-[#2a394b] bg-[#121d29] hover:bg-[#1a2938]',
    formButtonPrimary: 'bg-[#43d49a] text-[#07130f] hover:bg-[#5be2aa] font-bold',
    formFieldInput: 'bg-[#0b121d] border-[#2a394b] text-[#edf5f4]',
    footerAction: 'border-t border-[#263345]',
    dividerLine: 'bg-[#2a394b]',
    alert: 'border-[#573a3b] bg-[#23191e]',
    otpCodeFieldInput: 'bg-[#0b121d] border-[#2a394b] text-[#edf5f4]',
    formFieldRow: 'mb-4',
    main: 'text-[#e9f0f3]',
  },
};

function Logo({ compact = false }: { compact?: boolean }) {
  return <Link href="/" className="flex items-center gap-2.5 no-underline" data-testid="link-brand-home">
    <span className="grid h-8 w-8 place-items-center rounded-[10px] border border-emerald-300/40 bg-emerald-400/10 text-[#55e3a8]"><Activity size={19} strokeWidth={2.5} /></span>
    {!compact && <span className="text-[16px] font-extrabold tracking-[-.04em] text-[#edf5f4]">Pain<span className="text-[#51dda4]">Radar</span></span>}
  </Link>;
}

function Landing() {
  return <main className="min-h-[100dvh] overflow-hidden bg-[#090e16] text-[#edf5f4]">
    <div className="absolute inset-0 subtle-grid opacity-50" aria-hidden="true" />
    <header className="relative mx-auto flex max-w-[1240px] items-center justify-between px-6 py-6 md:px-10">
      <Logo />
      <div className="flex items-center gap-3">
        <Link href="/sign-in" className="btn btn-quiet" data-testid="link-sign-in">Sign in</Link>
        <Link href="/sign-up" className="btn btn-primary" data-testid="link-get-started">Get started <ArrowRight size={14} /></Link>
      </div>
    </header>
    <section className="relative mx-auto grid max-w-[1240px] items-center gap-12 px-6 pb-20 pt-14 md:grid-cols-[1.04fr_.96fr] md:px-10 md:pb-28 md:pt-24">
      <div className="page-enter">
        <div className="badge badge-green mb-7"><span className="h-1.5 w-1.5 rounded-full bg-[#53e0a6]" /> SIGNAL, NOT NOISE</div>
        <h1 className="max-w-[730px] text-[clamp(3.2rem,7.5vw,6.7rem)] font-extrabold leading-[.99] tracking-[-.075em]">Find the pain<br /><span className="text-[#51dba2]">before the pitch.</span></h1>
        <p className="mt-7 max-w-[560px] text-base leading-7 text-[#a4b1bf] md:text-lg">A focused workspace for discovering real conversations about real problems — then organizing the ones worth following up on.</p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Link href="/sign-up" className="btn btn-primary px-5 py-3" data-testid="link-start-finding">Start finding leads <ArrowRight size={15} /></Link>
          <Link href="/sign-in" className="btn px-5 py-3" data-testid="link-existing-account">I already have an account</Link>
        </div>
        <div className="mt-11 flex flex-wrap gap-x-7 gap-y-3 text-[11px] font-semibold text-[#8291a0]">
          <span className="inline-flex items-center gap-2"><LockKeyhole size={14} className="text-[#53dba3]" /> Your account data stays yours</span>
          <span className="inline-flex items-center gap-2"><Globe2 size={14} className="text-[#53dba3]" /> Public HN scan or manual URL import</span>
        </div>
      </div>
      <div className="relative page-enter" style={{ animationDelay: '.12s' }}>
        <div className="absolute -inset-8 rounded-full bg-[radial-gradient(circle,rgba(48,205,139,.12),transparent_68%)]" />
        <div className="surface relative overflow-hidden p-5 shadow-[0_30px_100px_rgba(0,0,0,.35)] md:p-6">
          <div className="flex items-center justify-between border-b border-[#243142] pb-4">
            <div className="flex items-center gap-3"><div className="grid h-8 w-8 place-items-center rounded-lg bg-[#172f27] text-[#57e2a8]"><Target size={16} /></div><div><div className="text-[12px] font-bold">Creator workflow toolkit</div><div className="mt-1 text-[10px] text-[#8796a7]">Active campaign · just now</div></div></div>
            <span className="badge badge-green">TRACKING</span>
          </div>
          <div className="flex items-center justify-between py-5">
            <div><div className="text-[10px] uppercase tracking-[.16em] text-[#8392a2]">Lead quality</div><div className="mt-1 text-3xl font-extrabold tracking-[-.05em]">Strong signal</div></div>
            <div className="grid h-[62px] w-[62px] place-items-center rounded-full border-[3px] border-[#45d49a] bg-[#0d1918] text-sm font-bold text-[#69e6b0]">86<span className="text-[9px]">%</span></div>
          </div>
          <div className="rounded-lg border border-[#253446] bg-[#0d141e] p-4">
            <div className="flex items-center gap-2 text-[10px] text-[#8494a4]"><span className="grid h-5 w-5 place-items-center rounded-full bg-[#47352a] text-[9px] text-[#f2a66a]">EX</span> Illustrative example · no real discussion link</div>
            <p className="mt-3 text-[13px] font-bold leading-5 text-[#e3ebec]">“I’m losing half a day every week just keeping client projects in sync.”</p>
            <div className="mt-2 text-[10px] leading-4 text-[#8f9eab]">A person describing a workflow problem. Not a confirmed buyer.</div>
            <div className="mt-4 flex flex-wrap gap-2"><span className="badge badge-green">Solution search</span><span className="badge">86 relevance</span><span className="badge">Demo record</span></div>
          </div>
          <div className="mt-4 flex items-center justify-between text-[10px] text-[#8494a4]"><span>Manual URL import</span><span className="flex items-center gap-1 text-[#65dda9]"><Check size={12} /> Source is yours to verify</span></div>
        </div>
      </div>
    </section>
    <section className="relative border-t border-[#1d2836] bg-[#0c131d] px-6 py-16 md:px-10 md:py-20">
      <div className="mx-auto max-w-[1240px]">
        <div className="max-w-xl"><div className="mono text-[10px] uppercase tracking-[.22em] text-[#55dba1]">A sharper way to listen</div><h2 className="mt-4 text-3xl font-extrabold tracking-[-.05em] md:text-4xl">From scattered posts<br />to a clear next step.</h2></div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[['01', 'Set your signal', 'Describe the product, audience, and pain points you are looking for.'], ['02', 'Bring the conversation', 'Import a URL and the context you observed. Nothing is scraped behind your back.'], ['03', 'Follow through', 'Save, prioritize, and track outreach notes as conversations evolve.']].map(([n, title, text]) => <article key={n} className="surface p-5 md:p-6"><span className="mono text-xs text-[#52dba3]">{n} /</span><h3 className="mt-5 text-sm font-bold">{title}</h3><p className="mt-2 text-xs leading-6 text-[#94a3b1]">{text}</p></article>)}
        </div>
        <div className="mt-12 flex flex-col justify-between gap-5 border-t border-[#253142] pt-7 text-xs text-[#8190a0] md:flex-row"><span>Conversations are signals to investigate — never proof of purchase intent.</span><Link href="/sign-up" className="inline-flex items-center gap-2 font-bold text-[#59dfa8]" data-testid="link-create-account-footer">Build your workspace <ArrowRight size={14} /></Link></div>
      </div>
    </section>
  </main>;
}

function ClerkCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevId = useRef<string | null | undefined>(undefined);
  useEffect(() => addListener(({ user }) => {
    const id = user?.id ?? null;
    if (prevId.current !== undefined && prevId.current !== id) qc.clear();
    prevId.current = id;
  }), [addListener, qc]);
  return null;
}

function SignInPage() {
  return <div className="relative grid min-h-[100dvh] place-items-center overflow-hidden bg-[#090e16] px-4 py-10"><div className="absolute inset-0 subtle-grid opacity-40" /><div className="relative w-full"><div className="mb-7 flex justify-center"><Logo /></div><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></div></div>;
}
function SignUpPage() {
  return <div className="relative grid min-h-[100dvh] place-items-center overflow-hidden bg-[#090e16] px-4 py-10"><div className="absolute inset-0 subtle-grid opacity-40" /><div className="relative w-full"><div className="mb-7 flex justify-center"><Logo /></div><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></div></div>;
}

function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { user } = useUser();
  const { signOut } = useClerk();
  const userName = user?.firstName || user?.username || user?.primaryEmailAddress?.emailAddress?.split('@')[0] || 'Workspace';
  return <div className="app-shell">
    {menuOpen && <button className="overlay-mobile" aria-label="Close navigation" onClick={() => setMenuOpen(false)} data-testid="button-close-navigation" />}
    <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
      <div className="mb-9 flex items-center justify-between px-2"><Logo /><button className="btn btn-quiet !p-1.5 md:hidden" onClick={() => setMenuOpen(false)} aria-label="Close menu" data-testid="button-close-menu"><X size={17} /></button></div>
      <div className="mb-3 px-3 mono text-[9px] uppercase tracking-[.2em] text-[#657589]">Workspace</div>
      <nav className="flex flex-col gap-1" aria-label="Main navigation">{navigation.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setMenuOpen(false)} className={`nav-link ${location === href || (href === '/discover' && location.startsWith('/leads/')) ? 'active' : ''}`} data-testid={`link-nav-${href.slice(1)}`}><Icon size={16} strokeWidth={1.8} />{label}</Link>)}</nav>
      <div className="mt-auto">
        <div className="mb-4 rounded-xl border border-[#233246] bg-[#101b29] p-4">
          <div className="flex items-center gap-2 text-xs font-bold"><Zap size={15} className="text-[#57dfa7]" /> Find the signal</div>
          <p className="mt-2 text-[10px] leading-5 text-[#8e9cac]">Start with a campaign. Add leads from conversations you have verified.</p>
          <Link href="/campaigns" className="btn btn-primary mt-3 w-full !py-2 text-[11px]" data-testid="link-create-campaign-sidebar"><Plus size={14} /> New campaign</Link>
        </div>
        <div className="flex items-center gap-3 border-t border-[#1e2a38] px-2 pt-4">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-[#1b332b] text-[11px] font-bold text-[#6ae2ae]">{userName.slice(0, 1).toUpperCase()}</div>
          <div className="min-w-0 flex-1"><div className="truncate text-[11px] font-bold">{userName}</div><div className="truncate text-[9px] text-[#78889a]">{user?.primaryEmailAddress?.emailAddress || 'Personal workspace'}</div></div>
          <button className="btn btn-quiet !p-1.5" title="Sign out" onClick={() => signOut({ redirectUrl: basePath || '/' })} data-testid="button-sign-out"><LogOut size={14} /></button>
        </div>
      </div>
    </aside>
    <div className="main-area">
      <header className="topbar">
        <div className="flex items-center gap-3"><button className="btn btn-quiet mobile-menu !p-1.5" onClick={() => setMenuOpen(true)} aria-label="Open navigation" data-testid="button-open-navigation"><Menu size={19} /></button><div className="hidden items-center gap-2 text-[10px] text-[#78899b] sm:flex"><Command size={12} /> Workspace / <span className="text-[#d9e3e6]">{navigation.find(n => location === n.href)?.label || (location.startsWith('/leads/') ? 'Lead detail' : 'PainRadar')}</span></div></div>
        <div className="flex items-center gap-3"><span className="hidden items-center gap-1.5 text-[10px] text-[#8292a1] md:flex"><span className="h-1.5 w-1.5 rounded-full bg-[#51d99d]" /> Your workspace</span><Link href="/settings" className="btn btn-quiet !p-2" aria-label="Settings" data-testid="link-top-settings"><SettingsIcon size={16} /></Link></div>
      </header>
      <main className="page-wrap page-enter">{children}</main>
    </div>
  </div>;
}

function AppPage({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
function HomeRedirect() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <div className="min-h-[100dvh] bg-[#090e16] px-4 py-16"><div className="mx-auto max-w-3xl"><LoadingState rows={2} /></div></div>;
  return isSignedIn ? <Redirect to="/dashboard" /> : <Landing />;
}
function Protected({ component: Component }: { component: () => ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <div className="min-h-[100dvh] bg-[#090e16] px-4 py-16"><div className="mx-auto max-w-3xl"><LoadingState rows={2} /></div></div>;
  return isSignedIn ? <Component /> : <Redirect to="/" />;
}

function Heading({ eyebrow, title, detail, actions }: { eyebrow: string; title: string; detail?: string; actions?: ReactNode }) {
  return <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><div className="mono text-[9px] uppercase tracking-[.2em] text-[#52dca3]">{eyebrow}</div><h1 className="mt-2 text-[28px] font-extrabold tracking-[-.06em] text-[#edf4f4] md:text-[34px]">{title}</h1>{detail && <p className="mt-2 max-w-2xl text-xs leading-5 text-[#8e9dac]">{detail}</p>}</div>{actions}</div>;
}

function LoadingState({ rows = 4 }: { rows?: number }) {
  return <div className="space-y-3" role="status" aria-label="Loading"><div className="sr-only">Loading workspace data</div>{Array.from({ length: rows }, (_, i) => <div key={i} className="surface flex items-center gap-4 p-4"><div className="skeleton h-9 w-9" /><div className="flex-1 space-y-2"><div className="skeleton h-3 w-2/5" /><div className="skeleton h-3 w-4/5" /></div><div className="skeleton h-7 w-16" /></div>)}</div>;
}
function ErrorState({ retry }: { retry: () => void }) {
  return <div className="surface p-8 text-center" data-testid="status-load-error"><div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-[#3a2527] text-[#f39b8f]"><CircleHelp size={19} /></div><h3 className="mt-3 text-sm font-bold">Couldn’t load this view</h3><p className="mt-1 text-xs text-[#8c9baa]">Your saved records are still safe. Try again in a moment.</p><button className="btn mt-4" onClick={retry} data-testid="button-retry-load">Retry</button></div>;
}
function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return <div className="surface subtle-grid px-6 py-12 text-center" data-testid="state-empty"><div className="mx-auto grid h-11 w-11 place-items-center rounded-xl border border-[#294334] bg-[#15261f] text-[#5add9f]"><Sparkles size={19} /></div><h3 className="mt-4 text-sm font-bold">{title}</h3><p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-[#8797a6]">{text}</p>{action && <div className="mt-5">{action}</div>}</div>;
}

function StatCard({ title, value, note, icon: Icon, accent = false }: { title: string; value: string | number; note: string; icon: typeof Activity; accent?: boolean }) {
  return <div className="surface p-4 md:p-5" data-testid={`metric-${title.toLowerCase().replaceAll(' ', '-')}`}><div className="flex items-center justify-between"><span className="text-[10px] font-semibold text-[#8797a7]">{title}</span><span className={`grid h-7 w-7 place-items-center rounded-lg ${accent ? 'bg-[#163327] text-[#5be0a8]' : 'bg-[#182433] text-[#91a2b2]'}`}><Icon size={14} /></span></div><div className="mt-3 text-[27px] font-extrabold tracking-[-.06em]">{value}</div><div className="mt-1 text-[10px] text-[#8090a0]">{note}</div></div>;
}

function MiniActivity({ points }: { points: { day: string; leads: number; contacted: number }[] }) {
  const data = points?.slice(-14) || [];
  const max = Math.max(1, ...data.map(p => p.leads));
  const coords = data.map((p, i) => `${data.length > 1 ? (i / (data.length - 1)) * 100 : 50},${88 - (p.leads / max) * 70}`).join(' ');
  return <div className="surface p-5 md:p-6"><div className="flex items-start justify-between"><div><div className="text-xs font-bold">Activity over time</div><div className="mt-1 text-[10px] text-[#8292a1]">Stored lead records by day</div></div><span className="badge">Last 14 points</span></div>
    {data.length ? <div className="mt-5 h-[180px] w-full"><svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full overflow-visible" role="img" aria-label="Lead activity chart"><defs><linearGradient id="sparkGradient" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#43d49a" stopOpacity=".23" /><stop offset="1" stopColor="#43d49a" stopOpacity="0" /></linearGradient></defs><g className="chart-grid">{[20, 45, 70, 95].map(y => <line key={y} x1="0" x2="100" y1={y} y2={y} />)}</g><polygon points={`0,100 ${coords} 100,100`} className="spark-fill" /><polyline points={coords} className="spark-path" vectorEffect="non-scaling-stroke" /></svg><div className="mt-2 flex justify-between mono text-[9px] text-[#758596]"><span>{data[0]?.day}</span><span>{data[data.length - 1]?.day}</span></div></div> : <div className="grid h-[180px] place-items-center text-xs text-[#8493a1]">Activity will appear as records are added.</div>}
  </div>;
}

function LeadCard({ lead, onSave, onStatus, compact = false, officialHn = false }: { lead: Lead; onSave?: (lead: Lead) => void; onStatus?: (lead: Lead, status: LeadStatus) => void; compact?: boolean; officialHn?: boolean }) {
  return <article className="surface p-4 md:p-5" data-testid={`card-lead-${lead.id}`}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-[10px] text-[#8797a7]"><span className={`badge !py-1 ${officialHn ? 'badge-green' : ''}`}>{lead.isDemo ? 'Illustrative example' : officialHn ? 'Hacker News · public API' : sourceNames[lead.source] || lead.source}</span><span>{lead.discussionAt ? new Date(lead.discussionAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Date unknown'}</span>{lead.isDemo && <span className="badge badge-amber" data-testid={`badge-demo-${lead.id}`}>DEMO RECORD</span>}</div>
        <h3 className="mt-3 text-[13px] font-bold leading-5 text-[#e6eeee]">{lead.title}</h3>
        <p className="mt-2 line-clamp-2 text-[11px] leading-5 text-[#93a1ae]">{lead.excerpt}</p>
      </div>
      <div className="flex min-w-[54px] flex-col items-center"><div className="grid h-12 w-12 place-items-center rounded-full border border-[#3b8267] bg-[#10241d] text-sm font-bold text-[#6ce6b1]">{lead.relevanceScore}</div><span className="mt-1 text-[8px] uppercase tracking-wider text-[#8292a0]">match</span></div>
    </div>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#243142] pt-3">
      <div className="flex flex-wrap gap-2"><span className="badge badge-green">{intentNames[lead.intentCategory] || lead.intentCategory}</span><span className="badge">{statusNames[lead.status]}</span>{lead.engagementCount !== null && <span className="badge">{lead.engagementCount} interactions</span>}</div>
      <div className="flex items-center gap-2">
        <Link href={`/leads/${lead.id}`} className="btn !px-3 !py-2 text-[10px]" data-testid={`link-lead-detail-${lead.id}`}>Details <ArrowRight size={12} /></Link>
        {onSave && <button className={`btn !px-3 !py-2 text-[10px] ${lead.saved ? 'text-[#69e5b1]' : ''}`} onClick={() => onSave(lead)} data-testid={`button-save-lead-${lead.id}`}><Bookmark size={12} fill={lead.saved ? 'currentColor' : 'none'} />{lead.saved ? 'Saved' : 'Save'}</button>}
        {!compact && onStatus && lead.status === 'new' && <button className="btn btn-quiet !px-2 !py-2 text-[10px]" onClick={() => onStatus(lead, 'contacted')} data-testid={`button-contact-lead-${lead.id}`}>Mark contacted</button>}
      </div>
    </div>
    {lead.isDemo && <div className="mt-3 border-t border-[#263142] pt-2 text-[9px] text-[#bd9c5d]">Illustrative demo data — not a real person or verified buyer.</div>}
  </article>;
}

function useLeadActions() {
  const qc = useQueryClient();
  const update = useUpdateLead();
  const remove = useDeleteLead();
  const refresh = () => { qc.invalidateQueries({ queryKey: getListLeadsQueryKey() }); qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); qc.invalidateQueries({ queryKey: getGetAnalyticsQueryKey() }); };
  const save = (lead: Lead) => update.mutate({ leadId: lead.id, data: { saved: !lead.saved } }, { onSuccess: () => { refresh(); qc.invalidateQueries({ queryKey: getGetLeadQueryKey(lead.id) }); } });
  const setStatus = (lead: Lead, status: LeadStatus) => update.mutate({ leadId: lead.id, data: { status } }, { onSuccess: () => { refresh(); qc.invalidateQueries({ queryKey: getGetLeadQueryKey(lead.id) }); } });
  return { save, setStatus, update, remove, refresh };
}

function Dashboard() {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useGetDashboard();
  const { data: campaigns } = useListCampaigns();
  const demoMutation = useCreateDemoWorkspace();
  const [message, setMessage] = useState('');
  const { save, setStatus } = useLeadActions();
  const demo = () => demoMutation.mutate(undefined, { onSuccess: () => { setMessage('Demo workspace added. Demo records remain labeled throughout PainRadar.'); qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); qc.invalidateQueries({ queryKey: getListCampaignsQueryKey() }); qc.invalidateQueries({ queryKey: getListLeadsQueryKey() }); qc.invalidateQueries({ queryKey: getGetAnalyticsQueryKey() }); qc.invalidateQueries({ queryKey: getGetSettingsQueryKey() }); }, onError: () => setMessage('The demo workspace could not be added. Please retry.') });
  return <><Heading eyebrow="Your workspace" title="Good signals, at a glance." detail="A clear view of the conversations you have chosen to track." actions={<button className="btn btn-primary" disabled={demoMutation.isPending} onClick={demo} data-testid="button-load-demo">{demoMutation.isPending ? <LoaderCircle size={14} className="animate-spin" /> : <Sparkles size={14} />} Add demo workspace</button>} />
    {message && <p role="status" className="mb-4 text-xs text-[#68dfab]" data-testid="status-demo">{message}</p>}
    {isLoading ? <LoadingState rows={3} /> : isError || !data ? <ErrorState retry={() => qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() })} /> : <>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard title="Tracked leads" value={data.totalLeads} note="Records in your workspace" icon={Users} accent />
        <StatCard title="Saved leads" value={data.savedLeads} note="Worth another look" icon={Bookmark} />
        <StatCard title="High intent signals" value={data.highIntentLeads} note="Signals, not buyer confirmation" icon={Flame} />
        <StatCard title="Contacted" value={data.contactedLeads} note="Outreach status updated" icon={MessageSquareText} />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.45fr_.8fr]">
        <MiniActivity points={data.weeklyActivity || []} />
        <section className="surface p-5 md:p-6"><div className="flex items-center justify-between"><div><h2 className="text-xs font-bold">Campaign pulse</h2><p className="mt-1 text-[10px] text-[#8292a1]">{campaigns?.length || 0} campaigns set up</p></div><Link className="btn btn-quiet !px-2 !py-1.5 text-[10px]" href="/campaigns" data-testid="link-view-campaigns">View all <ArrowRight size={12} /></Link></div>
          {campaigns?.length ? <div className="mt-4 space-y-2">{campaigns.slice(0, 4).map(c => <Link href="/campaigns" key={c.id} className="flex items-center justify-between rounded-lg border border-[#253345] bg-[#0d151f] p-3 no-underline" data-testid={`row-campaign-${c.id}`}><div className="min-w-0"><div className="truncate text-[11px] font-bold text-[#dce6e8]">{c.productName}</div><div className="mt-1 text-[9px] text-[#8392a0]">{c.status} · {c.keywords.length} keywords</div></div><ArrowUpRight size={14} className="text-[#8292a1]" /></Link>)}</div> : <div className="mt-5 rounded-lg border border-dashed border-[#344256] p-5 text-center text-[11px] text-[#8292a1]">No campaigns yet. Create one to start organizing leads.</div>}
        </section>
      </div>
      <section className="mt-5"><div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-bold">Recently tracked</h2><Link className="btn btn-quiet !px-2 !py-1.5 text-[10px]" href="/discover" data-testid="link-discover-more">Discover leads <ArrowRight size={12} /></Link></div>
        {data.recentLeads?.length ? <div className="space-y-3">{data.recentLeads.slice(0, 5).map(lead => <LeadCard key={lead.id} lead={lead} compact onSave={save} onStatus={setStatus} />)}</div> : <EmptyState title="Your first signal starts here" text="Add a campaign, then manually import a public discussion URL you have reviewed." action={<Link className="btn btn-primary" href="/campaigns" data-testid="link-first-campaign"><Plus size={14} /> Create a campaign</Link>} />}
      </section>
    </>}
  </>;
}

type CampaignDraft = { productName: string; description: string; targetAudience: string; problems: string; keywords: string; excludedTopics: string; preferredSources: string[] };
const emptyCampaign: CampaignDraft = { productName: '', description: '', targetAudience: '', problems: '', keywords: '', excludedTopics: '', preferredSources: ['hacker_news'] };
function splitItems(value: string) { return value.split(',').map(v => v.trim()).filter(Boolean); }
function CampaignDialog({ campaign, onClose }: { campaign?: Campaign; onClose: () => void }) {
  const qc = useQueryClient();
  const create = useCreateCampaign();
  const update = useUpdateCampaign();
  const [draft, setDraft] = useState<CampaignDraft>(campaign ? { productName: campaign.productName, description: campaign.description, targetAudience: campaign.targetAudience, problems: campaign.problems.join(', '), keywords: campaign.keywords.join(', '), excludedTopics: campaign.excludedTopics.join(', '), preferredSources: campaign.preferredSources } : emptyCampaign);
  const [error, setError] = useState('');
  const busy = create.isPending || update.isPending;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (draft.productName.trim().length < 2 || draft.description.trim().length < 10 || draft.targetAudience.trim().length < 2) { setError('Add a product name, a description of at least 10 characters, and a target audience.'); return; }
    const problems = splitItems(draft.problems);
    const keywords = splitItems(draft.keywords);
    if (!problems.length && !keywords.length) { setError('Add at least one problem or keyword so PainRadar can score matches.'); return; }
    const payload: CampaignInput = { productName: draft.productName.trim(), description: draft.description.trim(), targetAudience: draft.targetAudience.trim(), problems, keywords, excludedTopics: splitItems(draft.excludedTopics), preferredSources: draft.preferredSources as LeadSource[] };
    const done = () => { qc.invalidateQueries({ queryKey: getListCampaignsQueryKey() }); qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); onClose(); };
    if (campaign) update.mutate({ campaignId: campaign.id, data: payload }, { onSuccess: done, onError: () => setError('Unable to save changes. Try again.') });
    else create.mutate({ data: payload }, { onSuccess: done, onError: () => setError('Unable to create this campaign. Try again.') });
  };
  const field = (label: string, key: keyof CampaignDraft, placeholder: string, multiline = false) => <label className="block text-[10px] font-bold text-[#9eacb9]">{label}{multiline ? <textarea className="field mt-2 min-h-20 resize-y text-xs" value={draft[key] as string} placeholder={placeholder} onChange={e => setDraft({ ...draft, [key]: e.target.value })} data-testid={`input-campaign-${key}`} /> : <input className="field mt-2 text-xs" value={draft[key] as string} placeholder={placeholder} onChange={e => setDraft({ ...draft, [key]: e.target.value })} data-testid={`input-campaign-${key}`} />}</label>;
  return <div className="dialog-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="campaign-dialog-title">
    <form onSubmit={submit}><div className="flex items-start justify-between border-b border-[#263447] px-5 py-4"><div><h2 id="campaign-dialog-title" className="text-sm font-bold">{campaign ? 'Edit campaign' : 'Create a campaign'}</h2><p className="mt-1 text-[10px] text-[#8393a2]">Describe who you help and what problem to listen for.</p></div><button className="btn btn-quiet !p-1.5" type="button" onClick={onClose} aria-label="Close" data-testid="button-close-campaign-dialog"><X size={16} /></button></div>
    <div className="grid gap-4 p-5 md:grid-cols-2">{field('Product or service', 'productName', 'e.g. Fieldnote')}{field('Target audience', 'targetAudience', 'Who gets the most value?')}{field('What does it do?', 'description', 'Describe your product in a sentence or two.', true)}{field('Problems to listen for', 'problems', 'Comma separated pain points', true)}{field('Keywords', 'keywords', 'Comma separated keywords')}{field('Excluded topics', 'excludedTopics', 'Optional topics to ignore')}
      <fieldset className="md:col-span-2"><legend className="text-[10px] font-bold text-[#9eacb9]">Preferred sources</legend><div className="mt-2 flex flex-wrap gap-2">{Object.entries(sourceNames).map(([id, name]) => <label key={id} className={`badge cursor-pointer ${draft.preferredSources.includes(id) ? 'badge-green' : ''}`}><input type="checkbox" className="accent-[#43d49a]" checked={draft.preferredSources.includes(id)} onChange={e => setDraft({ ...draft, preferredSources: e.target.checked ? [...draft.preferredSources, id] : draft.preferredSources.filter(v => v !== id) })} data-testid={`checkbox-source-${id}`} />{name}</label>)}</div></fieldset>
    </div>
    {error && <p className="px-5 pb-2 text-xs text-[#f2a19a]" role="alert" data-testid="status-campaign-error">{error}</p>}
    <div className="flex justify-end gap-2 border-t border-[#263447] px-5 py-4"><button className="btn" type="button" onClick={onClose} data-testid="button-cancel-campaign">Cancel</button><button className="btn btn-primary" disabled={busy} type="submit" data-testid="button-submit-campaign">{busy ? 'Saving…' : campaign ? 'Save changes' : 'Create campaign'}</button></div></form>
  </section></div>;
}

function Campaigns() {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useListCampaigns();
  const remove = useDeleteCampaign();
  const update = useUpdateCampaign();
  const [editing, setEditing] = useState<Campaign | null | 'new'>(null);
  const [notice, setNotice] = useState('');
  const deleteOne = (c: Campaign) => { if (window.confirm(`Delete ${c.productName} and all leads in this campaign?`)) remove.mutate({ campaignId: c.id }, { onSuccess: () => { setNotice('Campaign deleted.'); qc.invalidateQueries({ queryKey: getListCampaignsQueryKey() }); qc.invalidateQueries({ queryKey: getListLeadsQueryKey() }); qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); }, onError: () => setNotice('Campaign could not be deleted.') }); };
  return <><Heading eyebrow="Campaigns" title="Define what matters." detail="Each campaign keeps a product, audience, and problem space in one place." actions={<button className="btn btn-primary" onClick={() => setEditing('new')} data-testid="button-new-campaign"><Plus size={14} /> New campaign</button>} />
    {notice && <p role="status" className="mb-4 text-xs text-[#67dfaa]" data-testid="status-campaign-notice">{notice}</p>}
    {isLoading ? <LoadingState /> : isError ? <ErrorState retry={() => qc.invalidateQueries({ queryKey: getListCampaignsQueryKey() })} /> : !data?.length ? <EmptyState title="No campaigns, no noise" text="Create a campaign to define who you help and which problems are worth tracking." action={<button className="btn btn-primary" onClick={() => setEditing('new')} data-testid="button-empty-new-campaign"><Plus size={14} /> Create campaign</button>} /> :
      <div className="space-y-3">{data.map(c => <article key={c.id} className="surface p-5" data-testid={`card-campaign-${c.id}`}>
        <div className="flex flex-wrap items-start justify-between gap-4"><div className="flex min-w-0 items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#274638] bg-[#13251f] text-[#5bdfa7]"><Target size={18} /></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-bold">{c.productName}</h2><span className={`badge ${c.status === 'active' ? 'badge-green' : ''}`}>{c.status}</span></div><p className="mt-1 max-w-3xl text-[11px] leading-5 text-[#8e9dac]">{c.description}</p></div></div>
          <div className="flex gap-2"><button className="btn" onClick={() => update.mutate({ campaignId: c.id, data: { status: c.status === 'active' ? 'paused' : 'active' } }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListCampaignsQueryKey() }) })} data-testid={`button-toggle-campaign-${c.id}`}>{c.status === 'active' ? 'Pause' : 'Resume'}</button><button className="btn" onClick={() => setEditing(c)} data-testid={`button-edit-campaign-${c.id}`}>Edit</button><button className="btn btn-quiet !px-2" onClick={() => deleteOne(c)} aria-label={`Delete ${c.productName}`} data-testid={`button-delete-campaign-${c.id}`}><Trash2 size={14} /></button></div>
        </div><div className="mt-4 grid gap-3 border-t border-[#243142] pt-4 md:grid-cols-3"><div><div className="text-[9px] uppercase tracking-wider text-[#718295]">Audience</div><div className="mt-1 text-[11px] text-[#ced8dc]">{c.targetAudience}</div></div><div><div className="text-[9px] uppercase tracking-wider text-[#718295]">Problems</div><div className="mt-1 flex flex-wrap gap-1.5">{c.problems.length ? c.problems.map(p => <span className="badge" key={p}>{p}</span>) : <span className="text-[10px] text-[#718295]">None added</span>}</div></div><div><div className="text-[9px] uppercase tracking-wider text-[#718295]">Keywords</div><div className="mt-1 flex flex-wrap gap-1.5">{c.keywords.length ? c.keywords.slice(0, 6).map(p => <span className="badge" key={p}>{p}</span>) : <span className="text-[10px] text-[#718295]">None added</span>}</div></div></div>
      </article>)}</div>}
    {editing && <CampaignDialog campaign={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
  </>;
}

function ImportDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data: campaigns } = useListCampaigns();
  const importer = useImportLead();
  const [campaignId, setCampaignId] = useState('');
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [discussionDate, setDiscussionDate] = useState('');
  const [engagementCount, setEngagementCount] = useState('');
  const [error, setError] = useState('');
  const validUrl = (() => { try { const parsed = new URL(url); return ['http:', 'https:'].includes(parsed.protocol); } catch { return false; } })();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!campaignId || !validUrl || title.trim().length < 4 || excerpt.trim().length < 8) { setError('Choose a campaign, enter a valid URL, and add a title and context.'); return; }
    const engagement = engagementCount.trim() ? Number(engagementCount) : undefined;
    if (engagement !== undefined && (!Number.isSafeInteger(engagement) || engagement < 0)) { setError('Engagement must be a whole number of zero or more.'); return; }
    const discussionAt = discussionDate ? new Date(`${discussionDate}T12:00:00`).toISOString() : undefined;
    importer.mutate({ data: { campaignId, sourceUrl: url, title: title.trim(), excerpt: excerpt.trim(), ...(discussionAt ? { discussionAt } : {}), ...(engagement !== undefined ? { engagementCount: engagement } : {}) } }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListLeadsQueryKey() }); qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); qc.invalidateQueries({ queryKey: getGetAnalyticsQueryKey() }); onClose(); }, onError: () => setError('Import failed. Check the information and try again.') });
  };
  return <div className="dialog-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="import-title"><form onSubmit={submit}>
    <div className="flex items-start justify-between border-b border-[#263447] px-5 py-4"><div><h2 id="import-title" className="text-sm font-bold">Import a discussion URL</h2><p className="mt-1 text-[10px] text-[#8594a4]">We store the URL and the context you provide. PainRadar does not scrape the page.</p></div><button className="btn btn-quiet !p-1.5" type="button" onClick={onClose} aria-label="Close import" data-testid="button-close-import"><X size={16} /></button></div>
    <div className="space-y-4 p-5"><label className="block text-[10px] font-bold text-[#9eacb9]">Campaign<select className="field mt-2 text-xs" value={campaignId} onChange={e => setCampaignId(e.target.value)} data-testid="select-import-campaign"><option value="">Select a campaign</option>{campaigns?.map(c => <option key={c.id} value={c.id}>{c.productName}</option>)}</select></label>
      <label className="block text-[10px] font-bold text-[#9eacb9]">Discussion URL<input className="field mt-2 text-xs" type="url" value={url} placeholder="https://…" onChange={e => setUrl(e.target.value)} data-testid="input-import-url" /></label>
      <label className="block text-[10px] font-bold text-[#9eacb9]">Short title<input className="field mt-2 text-xs" value={title} placeholder="What is the person discussing?" onChange={e => setTitle(e.target.value)} data-testid="input-import-title" /></label>
      <label className="block text-[10px] font-bold text-[#9eacb9]">Your context<textarea className="field mt-2 min-h-24 resize-y text-xs" value={excerpt} placeholder="Add a short excerpt or notes you are allowed to store." onChange={e => setExcerpt(e.target.value)} data-testid="input-import-excerpt" /></label>
       <div className="grid gap-3 sm:grid-cols-2"><label className="block text-[10px] font-bold text-[#9eacb9]">Discussion date, if known<input className="field mt-2 text-xs" type="date" value={discussionDate} onChange={e => setDiscussionDate(e.target.value)} data-testid="input-import-discussion-date" /></label><label className="block text-[10px] font-bold text-[#9eacb9]">Engagement, if shown<input className="field mt-2 text-xs" type="number" min="0" step="1" value={engagementCount} onChange={e => setEngagementCount(e.target.value)} placeholder="e.g. 24" data-testid="input-import-engagement" /></label></div>
       <p className="text-[9px] text-[#78899a]">Leave unknown dates and engagement blank; they will not be guessed.</p>
      <p className="text-[10px] leading-5 text-[#7f90a0]">Only import public discussions you are authorized to record. A complaint is a signal, not evidence the person is a buyer.</p>
    </div>
    {error && <p role="alert" className="px-5 pb-2 text-xs text-[#f1a09a]" data-testid="status-import-error">{error}</p>}
    <div className="flex justify-end gap-2 border-t border-[#263447] px-5 py-4"><button type="button" className="btn" onClick={onClose} data-testid="button-cancel-import">Cancel</button><button className="btn btn-primary" type="submit" disabled={importer.isPending} data-testid="button-submit-import">{importer.isPending ? 'Importing…' : 'Import lead'}</button></div>
  </form></section></div>;
}

function LeadsPage({ mode = 'discover' }: { mode?: 'discover' | 'saved' | 'outreach' }) {
  const qc = useQueryClient();
  const discoverHn = useDiscoverHackerNews();
  const [searchText, setSearchText] = useState('');
  const [campaign, setCampaign] = useState('');
  const [source, setSource] = useState('');
  const [intent, setIntent] = useState('');
  const [recency, setRecency] = useState('');
  const [minScore, setMinScore] = useState('');
  const [minEngagement, setMinEngagement] = useState('');
  const [status, setStatusFilter] = useState('');
  const [sort, setSort] = useState<'relevance' | 'recent' | 'engagement'>('relevance');
  const [showImport, setShowImport] = useState(false);
  const [scanResult, setScanResult] = useState<{ checkedCount: number; importedCount: number; visibleCount: number; duplicateCount: number; leads: Lead[] } | null>(null);
  const [scanError, setScanError] = useState('');
  const { data: campaigns } = useListCampaigns();
  const { data: preferences } = useGetSettings();
  const selectedCampaign = campaigns?.find(c => c.id === campaign);
  const canScanHn = Boolean(selectedCampaign?.preferredSources.includes('hacker_news'));
  const params: ListLeadsParams = {
    ...(campaign ? { campaignId: campaign } : {}),
    ...(searchText.trim() ? { q: searchText.trim() } : {}),
    ...(source ? { source: source as LeadSource } : {}),
    ...(intent ? { intent: intent as ListLeadsParams['intent'] } : {}),
    ...(recency ? { recency: recency as ListLeadsParams['recency'] } : {}),
    ...(minScore ? { minScore: Number(minScore) } : {}),
    ...(minEngagement ? { minEngagement: Number(minEngagement) } : {}),
    ...(mode === 'saved' ? { savedOnly: true } : {}),
    ...(status ? { status: status as LeadStatus } : {}),
    sort,
  };
  const { data, isLoading, isError } = useListLeads(params);
  const { save, setStatus } = useLeadActions();
  const title = mode === 'saved' ? 'Your saved signals.' : mode === 'outreach' ? 'Keep the thread moving.' : 'Find conversations worth a look.';
  const detail = mode === 'saved' ? 'A shortlist of discussions you chose to revisit.' : mode === 'outreach' ? 'Track follow-up status and notes. A response is not a conversion.' : 'Search your stored leads or import a discussion URL you have reviewed.';
  const filtered = useMemo(() => (data || []).filter(lead =>
    (mode !== 'outreach' || ['contacted', 'replied', 'converted', 'dismissed'].includes(lead.status)) &&
    (preferences?.showDemoData !== false || !lead.isDemo) &&
    (!preferences?.hideFlagged || !(lead.isSpam || lead.isSelfPromotion || lead.isBait || lead.isIrrelevant))
  ), [data, mode, preferences]);
  const scanHackerNews = () => {
    if (!campaign) {
      setScanError('Choose a campaign first. Hacker News discovery is scoped to one campaign.');
      return;
    }
    if (!canScanHn) {
      setScanError('Select Hacker News under this campaign’s preferred sources before scanning.');
      return;
    }
    setScanError('');
    setScanResult(null);
    discoverHn.mutate({ data: { campaignId: campaign, maxStories: 40 } }, {
      onSuccess: result => {
        setScanResult(result);
        qc.invalidateQueries({ queryKey: getListLeadsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        qc.invalidateQueries({ queryKey: getGetAnalyticsQueryKey() });
      },
      onError: () => setScanError('Hacker News discovery could not complete. Try again shortly.'),
    });
  };
  return <><Heading eyebrow={mode === 'discover' ? 'Discovery' : mode === 'saved' ? 'Saved' : 'Outreach'} title={title} detail={detail} actions={mode === 'discover' ? <button className="btn btn-primary" onClick={() => setShowImport(true)} data-testid="button-open-import"><Plus size={14} /> Import URL</button> : undefined} />
    <section className="surface mb-5 p-3 md:p-4"><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      <label className="relative sm:col-span-2"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#718295]" /><input className="field !py-2.5 pl-9 text-xs" value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="Search title, excerpt…" data-testid="input-search-leads" /></label>
      <select className="field !py-2.5 text-xs" value={campaign} onChange={e => setCampaign(e.target.value)} data-testid="select-filter-campaign"><option value="">All campaigns</option>{campaigns?.map(c => <option key={c.id} value={c.id}>{c.productName}</option>)}</select>
      <select className="field !py-2.5 text-xs" value={source} onChange={e => setSource(e.target.value)} data-testid="select-filter-source"><option value="">All sources</option>{Object.entries(sourceNames).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
      <select className="field !py-2.5 text-xs" value={intent} onChange={e => setIntent(e.target.value)} data-testid="select-filter-intent"><option value="">All intent signals</option><option value="recommendation_request">Recommendation requests</option><option value="solution_search">Active solution searches</option><option value="general_problem">General problem discussions</option></select>
      <select className="field !py-2.5 text-xs" value={recency} onChange={e => setRecency(e.target.value)} data-testid="select-filter-recency"><option value="">Any date</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="90d">Last 90 days</option></select>
      <select className="field !py-2.5 text-xs" value={minScore} onChange={e => setMinScore(e.target.value)} data-testid="select-filter-score"><option value="">Any relevance</option><option value="50">Score 50+</option><option value="70">Score 70+</option><option value="85">Score 85+</option></select>
      <select className="field !py-2.5 text-xs" value={minEngagement} onChange={e => setMinEngagement(e.target.value)} data-testid="select-filter-engagement"><option value="">Any engagement</option><option value="5">5+ interactions</option><option value="25">25+ interactions</option><option value="100">100+ interactions</option></select>
      <select className="field !py-2.5 text-xs" value={sort} onChange={e => setSort(e.target.value as typeof sort)} data-testid="select-sort-leads"><option value="relevance">Sort: relevance</option><option value="recent">Sort: newest</option><option value="engagement">Sort: engagement</option></select>
      {mode === 'outreach' && <select className="field !py-2.5 text-xs" value={status} onChange={e => setStatusFilter(e.target.value)} data-testid="select-filter-status"><option value="">All statuses</option>{['contacted', 'replied', 'converted', 'dismissed'].map(s => <option key={s} value={s}>{statusNames[s]}</option>)}</select>}
    </div><div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#223040] pt-3"><span className="inline-flex items-center gap-1.5 text-[10px] text-[#8090a0]"><SlidersHorizontal size={12} /> Stored account records only{preferences && preferences.minimumRelevance > 0 ? ` · account minimum ${preferences.minimumRelevance}` : ''}</span><div className="flex items-center gap-2"><button className="btn btn-quiet !py-1.5 text-[10px]" onClick={() => { setSearchText(''); setCampaign(''); setSource(''); setIntent(''); setRecency(''); setMinScore(''); setMinEngagement(''); setStatusFilter(''); setSort('relevance'); }} data-testid="button-reset-filters">Reset filters</button>{mode === 'discover' && <button className="btn !py-1.5 text-[10px]" disabled={!campaign || discoverHn.isPending} onClick={scanHackerNews} data-testid="button-scan-hacker-news">{discoverHn.isPending ? <LoaderCircle size={13} className="animate-spin" /> : <Activity size={13} />}{discoverHn.isPending ? 'Scanning public HN…' : 'Scan Hacker News'}</button>}</div></div>
      {mode === 'discover' && <p className="mt-2 text-[9px] leading-4 text-[#77899a]">Hacker News is the only public source scan enabled. Reddit, X, and Facebook are not connected. Select a campaign that includes Hacker News under preferred sources.{campaign && !canScanHn ? ' Edit the campaign to enable it.' : ''}</p>}
    </section>
    {scanError && <p className="mb-4 text-xs text-[#f0a098]" role="alert" data-testid="status-hacker-news-error">{scanError}</p>}
    {scanResult && <section className="surface mb-5 border-[#32614e] p-4 md:p-5" data-testid="panel-hacker-news-results">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><span className="badge badge-green">HACKER NEWS PUBLIC API</span><span className="text-[10px] text-[#8b9aaa]">Campaign scan complete</span></div><h2 className="mt-2 text-sm font-bold">Public discussions found</h2></div><button className="btn btn-quiet !p-1.5" aria-label="Dismiss scan summary" onClick={() => setScanResult(null)} data-testid="button-dismiss-hn-results"><X size={15} /></button></div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{[['Checked', scanResult.checkedCount], ['Stored', scanResult.importedCount], ['Shown', scanResult.visibleCount], ['Duplicates', scanResult.duplicateCount]].map(([label, count]) => <div className="rounded-lg border border-[#263647] bg-[#0c151f] p-3" key={label}><div className="mono text-lg font-bold text-[#dce8e7]">{count}</div><div className="mt-1 text-[9px] text-[#8191a0]">{label}</div></div>)}</div>
      <p className="mt-3 text-[9px] leading-4 text-[#8393a1]">These are public Hacker News API discussions, not confirmed buyers. Stored records may be hidden by your account filters. Other social sources are not connected.</p>
      {scanResult.leads.length > 0 && <div className="mt-4 space-y-3">{scanResult.leads.map(lead => <LeadCard key={lead.id} lead={lead} officialHn onSave={save} onStatus={setStatus} />)}</div>}
      {!scanResult.leads.length && <p className="mt-4 text-[10px] text-[#8c9ba9]">No new matching discussion records were returned.</p>}
    </section>}
    {isLoading ? <LoadingState /> : isError ? <ErrorState retry={() => qc.invalidateQueries({ queryKey: getListLeadsQueryKey(params) })} /> : filtered.length ? <div className="space-y-3">{filtered.map(lead => <LeadCard key={lead.id} lead={lead} onSave={save} onStatus={mode === 'outreach' ? undefined : setStatus} />)}</div> : <EmptyState title={mode === 'saved' ? 'Nothing saved yet' : mode === 'outreach' ? 'No active follow-ups' : 'No matching leads'} text={mode === 'saved' ? 'Save a lead from Discover and it will be waiting here.' : mode === 'outreach' ? 'Mark a lead as contacted to begin tracking your follow-up.' : 'Try different filters, or import the URL of a conversation you have reviewed.'} action={mode === 'discover' ? <button className="btn btn-primary" onClick={() => setShowImport(true)} data-testid="button-empty-import"><Plus size={14} /> Import a URL</button> : mode === 'saved' ? <Link className="btn" href="/discover" data-testid="link-empty-discover">Discover leads <ArrowRight size={13} /></Link> : undefined} />}
    {showImport && <ImportDialog onClose={() => setShowImport(false)} />}
  </>;
}

function LeadDetail() {
  const params = useParams<{ leadId: string }>();
  const [, setLocation] = useLocation();
  const leadId = params.leadId || '';
  const qc = useQueryClient();
  const { data: lead, isLoading, isError } = useGetLead(leadId, { query: { enabled: !!leadId, queryKey: getGetLeadQueryKey(leadId) } });
  const { save, setStatus, update, remove } = useLeadActions();
  const [notes, setNotes] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => { if (lead) setNotes(lead.outreachNotes || ''); }, [lead?.id]);
  if (isLoading) return <LoadingState rows={2} />;
  if (isError || !lead) return <ErrorState retry={() => qc.invalidateQueries({ queryKey: getGetLeadQueryKey(leadId) })} />;
  const updateNotes = () => update.mutate({ leadId: lead.id, data: { outreachNotes: notes } }, { onSuccess: () => { setNotice('Notes saved.'); qc.invalidateQueries({ queryKey: getGetLeadQueryKey(lead.id) }); qc.invalidateQueries({ queryKey: getListLeadsQueryKey() }); }, onError: () => setNotice('Notes could not be saved.') });
  const deleteLead = () => { if (window.confirm('Delete this lead record?')) remove.mutate({ leadId: lead.id }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListLeadsQueryKey() }); qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); qc.invalidateQueries({ queryKey: getGetAnalyticsQueryKey() }); setLocation('/discover'); }, onError: () => setNotice('Lead could not be deleted.') }); };
  return <><div className="mb-5"><Link href="/discover" className="inline-flex items-center gap-2 text-[10px] font-bold text-[#86a092] no-underline" data-testid="link-back-discover"><ArrowDownRight className="rotate-[135deg]" size={14} /> Back to discovery</Link></div>
    <Heading eyebrow="Lead record" title="Conversation details" detail="A discussion signal to assess on its own merits — not a confirmed buyer." actions={<div className="flex gap-2"><button className="btn" onClick={() => save(lead)} data-testid="button-detail-save"><Bookmark size={13} fill={lead.saved ? 'currentColor' : 'none'} />{lead.saved ? 'Saved' : 'Save'}</button>{lead.isDemo ? <span className="badge badge-amber self-center" data-testid="status-demo-source-link">Illustrative record · no real discussion link</span> : <a className="btn" href={lead.sourceUrl} target="_blank" rel="noreferrer" data-testid="link-source-url">Open source <ExternalLink size={13} /></a>}</div>} />
    <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
      <div className="space-y-4">
         <article className="surface p-5 md:p-7" data-testid={`panel-lead-${lead.id}`}><div className="flex flex-wrap items-center gap-2"><span className={`badge ${lead.isDemo ? 'badge-amber' : ''}`}>{lead.isDemo ? 'Illustrative example' : sourceNames[lead.source]}</span><span className="badge badge-green">{intentNames[lead.intentCategory]}</span>{lead.isDemo && <span className="badge badge-amber">DEMO RECORD</span>}</div><h2 className="mt-5 text-xl font-extrabold leading-8 tracking-[-.035em]">{lead.title}</h2><p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[#b3c0ca]">{lead.excerpt}</p><div className="mt-5 flex flex-wrap gap-2 text-[10px] text-[#8494a3]"><span>{lead.discussionAt ? new Date(lead.discussionAt).toLocaleString() : 'Discussion date unknown'}</span><span>·</span><span>{lead.engagementCount ?? '—'} interactions reported</span></div>
          {lead.isDemo && <p className="mt-5 rounded-lg border border-[#584a31] bg-[#211d15] p-3 text-[10px] leading-5 text-[#c7ad70]">Illustrative demo record. It does not represent a real person or a verified potential customer.</p>}
        </article>
        <section className="surface p-5"><div className="flex items-center justify-between"><div><h3 className="text-xs font-bold">Your outreach notes</h3><p className="mt-1 text-[10px] text-[#8292a0]">Private workspace context for this record.</p></div>{notice && <span role="status" className="text-[10px] text-[#68dfa9]" data-testid="status-note-save">{notice}</span>}</div><textarea className="field mt-4 min-h-32 resize-y text-xs leading-5" value={notes} onChange={e => setNotes(e.target.value)} maxLength={5000} placeholder="Add a note for your next follow-up…" data-testid="textarea-outreach-notes" /><div className="mt-3 flex justify-between"><span className="text-[9px] text-[#738496]">{notes.length}/5000</span><button className="btn btn-primary" onClick={updateNotes} disabled={update.isPending} data-testid="button-save-notes">{update.isPending ? 'Saving…' : 'Save notes'}</button></div></section>
      </div>
      <aside className="space-y-4">
        <section className="surface p-5"><h3 className="text-xs font-bold">Signal assessment</h3><div className="mt-5 flex items-center gap-4"><div className="grid h-[58px] w-[58px] place-items-center rounded-full border-2 border-[#45d49a] bg-[#10241d] text-lg font-bold text-[#68e4b0]">{lead.relevanceScore}</div><div><div className="text-[11px] font-bold">Relevance score</div><div className="mt-1 text-[9px] text-[#8493a2]">A sorting aid, not certainty</div></div></div><div className="mt-5 space-y-3 border-t border-[#273344] pt-4"><div className="text-[9px] uppercase tracking-wider text-[#77889a]">Intent signals</div>{(lead.intentSignals || []).length ? lead.intentSignals.map((s, i) => <div key={`${s}-${i}`} className="flex items-start gap-2 text-[10px] leading-4 text-[#bbc7ce]"><Check size={13} className="mt-0.5 shrink-0 text-[#59dda5]" />{s}</div>) : <p className="text-[10px] text-[#8796a4]">No intent signals recorded.</p>}</div>
          <div className="mt-4 space-y-2 border-t border-[#273344] pt-4"><div className="text-[9px] uppercase tracking-wider text-[#77889a]">Why this score</div>{(lead.scoreReasons || []).map((s, i) => <div key={`${s}-${i}`} className="text-[10px] leading-4 text-[#94a3af]">— {s}</div>)}</div>
        </section>
        <section className="surface p-5"><label className="text-[10px] font-bold text-[#9caab7]">Outreach status<select className="field mt-2 text-xs" value={lead.status} onChange={e => setStatus(lead, e.target.value as LeadStatus)} data-testid="select-lead-status">{Object.entries(statusNames).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><p className="mt-3 text-[9px] leading-4 text-[#7e8e9d]">Status tracks your follow-up only. It does not confirm intent or a sale.</p><button className="btn btn-quiet mt-4 w-full text-[#e18c86]" onClick={deleteLead} data-testid="button-delete-lead"><Trash2 size={13} /> Delete record</button></section>
      </aside>
    </div>
  </>;
}

function Analytics() {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useGetAnalytics();
  if (isLoading) return <><Heading eyebrow="Analytics" title="Measure what you track." /><LoadingState rows={3} /></>;
  if (isError || !data) return <><Heading eyebrow="Analytics" title="Measure what you track." /><ErrorState retry={() => qc.invalidateQueries({ queryKey: getGetAnalyticsQueryKey() })} /></>;
  const bars = (items: { label: string; count: number }[]) => {
    const max = Math.max(1, ...items.map(i => i.count));
    return items.length ? (
      <div className="mt-4 space-y-3">
        {items.map((item, i) => (
          <div key={item.label} data-testid={`bar-${item.label.toLowerCase().replaceAll(' ', '-')}`}>
            <div className="mb-1.5 flex justify-between text-[10px]">
              <span className="text-[#b2bec7]">{item.label}</span>
              <span className="mono text-[#7f90a0]">{item.count}</span>
            </div>
            <div className="h-1.5 rounded-full bg-[#202d3b]">
              <div
                className="h-full rounded-full bg-[#43d49a]"
                style={{
                  width: `${Math.max(2, (item.count / max) * 100)}%`,
                  opacity: 0.92 - i * 0.07,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    ) : (
      <p className="mt-4 text-[10px] text-[#7f90a0]">No stored records to summarize yet.</p>
    );
  };
  return <><Heading eyebrow="Analytics" title="Measure what you track." detail="Calculated from the records currently stored in your account. Demo records are included only when present." />
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-5"><StatCard title="Total leads" value={data.totalLeads} note="Stored records" icon={Users} accent /><StatCard title="Saved" value={data.savedLeads} note="Shortlisted" icon={Bookmark} /><StatCard title="Contacted" value={data.contactedLeads} note="Outreach started" icon={MessageSquareText} /><StatCard title="Replied" value={data.repliedLeads} note="Response recorded" icon={Activity} /><StatCard title="Converted" value={data.convertedLeads} note="Marked by you" icon={Gauge} /></div>
    <div className="mt-5 grid gap-5 lg:grid-cols-2"><MiniActivity points={data.weeklyActivity || []} /><section className="surface p-5 md:p-6"><h2 className="text-xs font-bold">Leads by intent</h2><p className="mt-1 text-[10px] text-[#8292a1]">How stored records were categorized</p>{bars(data.byIntent || [])}</section><section className="surface p-5 md:p-6"><h2 className="text-xs font-bold">Sources represented</h2><p className="mt-1 text-[10px] text-[#8292a1]">Based on the records you imported</p>{bars(data.bySource || [])}</section><section className="surface p-5 md:p-6"><h2 className="text-xs font-bold">Read this carefully</h2><p className="mt-3 text-[11px] leading-6 text-[#98a7b3]">These numbers describe activity in your workspace, not market size or guaranteed buying intent. A person discussing a problem is not necessarily shopping for a solution.</p><div className="mt-4 rounded-lg border border-[#294334] bg-[#112019] p-3 text-[10px] leading-5 text-[#92b9a6]">No external source monitoring or AI analysis runs behind these analytics. Counts are calculated by the account API from saved records.</div></section></div>
  </>;
}

function Settings() {
  const qc = useQueryClient();
  const { data: settings, isLoading, isError } = useGetSettings();
  const { data: sources, isLoading: sourcesLoading, isError: sourcesError } = useListSourceStatuses();
  const update = useUpdateSettings();
  const [draft, setDraft] = useState<UserSettingsUpdate | null>(null);
  const [notice, setNotice] = useState('');
  useEffect(() => { if (settings && !draft) setDraft({ timezone: settings.timezone, minimumRelevance: settings.minimumRelevance, hideFlagged: settings.hideFlagged, showDemoData: settings.showDemoData }); }, [settings, draft]);
  if (isLoading) return <><Heading eyebrow="Settings" title="Your preferences." /><LoadingState rows={3} /></>;
  if (isError || !settings || !draft) return <><Heading eyebrow="Settings" title="Your preferences." /><ErrorState retry={() => qc.invalidateQueries({ queryKey: getGetSettingsQueryKey() })} /></>;
  const save = () => update.mutate({ data: draft }, { onSuccess: () => { setNotice('Preferences saved.'); qc.invalidateQueries({ queryKey: getGetSettingsQueryKey() }); qc.invalidateQueries({ queryKey: getListLeadsQueryKey() }); }, onError: () => setNotice('Preferences could not be saved.') });
  const toggle = (key: 'hideFlagged' | 'showDemoData') => setDraft({ ...draft, [key]: !draft[key] });
  return <><Heading eyebrow="Settings" title="Your preferences." detail="Choose how your own stored lead records are shown and ranked." actions={<button className="btn btn-primary" disabled={update.isPending} onClick={save} data-testid="button-save-settings">{update.isPending ? 'Saving…' : 'Save preferences'}</button>} />
    {notice && <p role="status" className="mb-4 text-xs text-[#64dfa8]" data-testid="status-settings">{notice}</p>}
    <div className="grid gap-5 xl:grid-cols-[1fr_.9fr]">
      <section className="surface p-5 md:p-6"><div className="flex items-center gap-2"><SlidersHorizontal size={15} className="text-[#59dca4]" /><h2 className="text-xs font-bold">Lead preferences</h2></div><div className="mt-5 space-y-5">
        <label className="block text-[10px] font-bold text-[#9eacb9]">Timezone<select className="field mt-2 text-xs" value={draft.timezone || ''} onChange={e => setDraft({ ...draft, timezone: e.target.value })} data-testid="select-timezone">{['UTC', 'America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York', 'Europe/London', 'Europe/Paris', 'Asia/Tokyo', 'Australia/Sydney'].map(t => <option key={t} value={t}>{t.replaceAll('_', ' ')}</option>)}</select></label>
        <label className="block text-[10px] font-bold text-[#9eacb9]">Minimum relevance <span className="mono float-right text-[#5fe0a8]">{draft.minimumRelevance ?? settings.minimumRelevance}</span><input type="range" min="0" max="100" value={draft.minimumRelevance ?? settings.minimumRelevance} onChange={e => setDraft({ ...draft, minimumRelevance: Number(e.target.value) })} className="mt-3 w-full accent-[#43d49a]" data-testid="input-minimum-relevance" /><span className="mt-1 flex justify-between text-[9px] font-normal text-[#7e8e9e]"><span>Show more</span><span>Higher match only</span></span></label>
        {[['hideFlagged', 'Hide flagged records', 'Hide records marked as spam, self-promotion, bait, or irrelevant.'], ['showDemoData', 'Show demo records', 'Include explicitly labeled illustrative records in workspace views.']].map(([key, label, help]) => <label key={key} className="flex cursor-pointer items-start justify-between gap-4 border-t border-[#263344] pt-4"><span><span className="block text-[11px] font-bold">{label}</span><span className="mt-1 block max-w-md text-[10px] leading-4 text-[#8393a1]">{help}</span></span><input className="mt-1 h-4 w-4 accent-[#43d49a]" type="checkbox" checked={Boolean(draft[key as keyof UserSettingsUpdate])} onChange={() => toggle(key as 'hideFlagged' | 'showDemoData')} data-testid={`checkbox-${key}`} /></label>)}
      </div></section>
      <section className="surface p-5 md:p-6"><div className="flex items-center gap-2"><Globe2 size={15} className="text-[#59dca4]" /><h2 className="text-xs font-bold">Source status</h2></div><p className="mt-2 text-[10px] leading-5 text-[#8999a7]">Hacker News public API discovery is available from Discover. Reddit, X, and Facebook are not connected. Other discussions can be added by manual URL import.</p>
         {sourcesLoading ? <div className="mt-4 space-y-2"><div className="skeleton h-11" /><div className="skeleton h-11" /></div> : sourcesError ? <div className="mt-4 rounded-lg border border-[#533a3c] bg-[#21191d] p-4 text-[10px] text-[#d4a09c]" data-testid="status-source-error">Source availability could not be loaded. <button className="ml-2 underline" onClick={() => qc.invalidateQueries({ queryKey: getListSourceStatusesQueryKey() })} data-testid="button-retry-sources">Retry</button></div> : sources?.length ? <div className="mt-4 space-y-2">{sources.map(s => <div key={s.id} className="flex items-start justify-between gap-3 rounded-lg border border-[#253346] bg-[#0d151f] p-3" data-testid={`source-status-${s.id}`}><div className="min-w-0"><div className="flex items-center gap-2 text-[11px] font-bold">{s.name}<span className={`badge ${s.status === 'available' ? 'badge-green' : 'badge-amber'}`}>{s.status.replaceAll('_', ' ')}</span></div><p className="mt-1 text-[9px] leading-4 text-[#8797a5]">{s.detail}</p></div><span className="shrink-0 text-[9px] text-[#9aabbb]">{s.id === 'hacker_news' ? 'API scan + import' : s.manualImport ? 'Manual import' : 'Not authorized'}</span></div>)}</div> : <div className="mt-4 rounded-lg border border-dashed border-[#334155] p-4 text-[10px] text-[#8392a1]">No source statuses have been published yet.</div>}
        <div className="mt-5 rounded-lg border border-[#263344] bg-[#0c141e] p-3 text-[10px] leading-5 text-[#8c9ba9]">PainRadar does not scrape Reddit, X, or Facebook. Hacker News discovery reads its public API; manual imports store only the URL and context you provide.</div>
      </section>
    </div>
  </>;
}

function NotFound() {
  return <AppPage><div className="py-20 text-center"><div className="mono text-xs text-[#57dca4]">404 / SIGNAL LOST</div><h1 className="mt-3 text-3xl font-extrabold">This page isn’t here.</h1><Link href="/dashboard" className="btn btn-primary mt-6" data-testid="link-return-dashboard">Return to overview <ArrowRight size={14} /></Link></div></AppPage>;
}

function Router() {
  return <Switch>
    <Route path="/" component={HomeRedirect} />
    <Route path="/sign-in/*?" component={SignInPage} />
    <Route path="/sign-up/*?" component={SignUpPage} />
    <Route path="/dashboard">{() => <Protected component={() => <AppPage><Dashboard /></AppPage>} />}</Route>
    <Route path="/discover">{() => <Protected component={() => <AppPage><LeadsPage /></AppPage>} />}</Route>
    <Route path="/campaigns">{() => <Protected component={() => <AppPage><Campaigns /></AppPage>} />}</Route>
    <Route path="/saved">{() => <Protected component={() => <AppPage><LeadsPage mode="saved" /></AppPage>} />}</Route>
    <Route path="/outreach">{() => <Protected component={() => <AppPage><LeadsPage mode="outreach" /></AppPage>} />}</Route>
    <Route path="/analytics">{() => <Protected component={() => <AppPage><Analytics /></AppPage>} />}</Route>
    <Route path="/settings">{() => <Protected component={() => <AppPage><Settings /></AppPage>} />}</Route>
    <Route path="/leads/:leadId">{() => <Protected component={() => <AppPage><LeadDetail /></AppPage>} />}</Route>
    <Route component={NotFound} />
  </Switch>;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={appearance} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`}
    localization={{ signIn: { start: { title: 'Welcome back', subtitle: 'Sign in to your PainRadar workspace' } }, signUp: { start: { title: 'Start listening closely', subtitle: 'Create your PainRadar workspace' } } }}
    routerPush={(to: string) => setLocation(stripBase(to))} routerReplace={(to: string) => setLocation(stripBase(to), { replace: true })}>
    <QueryClientProvider client={queryClient}><ClerkCacheInvalidator /><Router /></QueryClientProvider>
  </ClerkProvider>;
}

function App() {
  return <WouterRouter base={basePath}><ClerkProviderWithRoutes /></WouterRouter>;
}

export default App;
