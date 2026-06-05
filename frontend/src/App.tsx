import { useEffect, useState } from 'react';
import { InfoScreen } from './screens/InfoScreen';
import { LandingScreen } from './screens/LandingScreen';
import { MarketingScreen } from './screens/MarketingScreen';
import { PurchaseVoucherScreen } from './screens/PurchaseVoucherScreen';
import { QuizScreen } from './screens/QuizScreen';
import { ResultsScreen } from './screens/ResultsScreen';
import { VoucherScreen } from './screens/VoucherScreen';
import { AdminScreen } from './screens/AdminScreen';
import { loadSession } from './lib/session';
import type { CandidateInfo, MarketingPage, ReportResult, Session } from './types';

type Screen =
  | 'landing'
  | MarketingPage
  | 'voucher'
  | 'purchase'
  | 'info'
  | 'quiz'
  | 'results';

const MARKETING_PAGES: MarketingPage[] = ['learners', 'schools', 'universities', 'collaboration'];
const DEFAULT_USER_GROUP = 'General Learner';

function isMarketingPage(screen: Screen): screen is MarketingPage {
  return MARKETING_PAGES.includes(screen as MarketingPage);
}

function isAdminPath() {
  return window.location.pathname === '/admin';
}

export function App() {
  const [isAdmin, setIsAdmin] = useState(() => isAdminPath());
  const [screen, setScreen] = useState<Screen>('landing');
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [info, setInfo] = useState<CandidateInfo | null>(null);
  const [result, setResult] = useState<ReportResult | null>(null);

  useEffect(() => {
    setIsAdmin(isAdminPath());
  }, []);

  if (isAdmin) {
    return <AdminScreen />;
  }

  const goLanding = () => setScreen('landing');
  const goMarketing = (page: MarketingPage) => setScreen(page);
  const goVoucher = () => setScreen(session ? 'info' : 'voucher');
  const goHomeFromApp = () => setScreen('landing');
  const userGroup = session?.userGroup ?? DEFAULT_USER_GROUP;

  return (
    <>
      {screen === 'landing' ? (
        <LandingScreen onStart={goVoucher} onNavigate={goMarketing} onLogoClick={goLanding} />
      ) : null}
      {isMarketingPage(screen) ? (
        <MarketingScreen page={screen} onNavigate={goMarketing} onLogin={goVoucher} onLogoClick={goLanding} />
      ) : null}
      {screen === 'voucher' ? (
        <VoucherScreen
          onBack={goHomeFromApp}
          onPurchase={() => setScreen('purchase')}
          onSuccess={(nextSession) => {
            setSession(nextSession);
            setScreen('info');
          }}
        />
      ) : null}
      {screen === 'purchase' ? <PurchaseVoucherScreen onHome={goHomeFromApp} /> : null}
      {screen === 'info' ? (
        <InfoScreen
          userGroup={userGroup}
          onNext={(candidateInfo) => {
            setInfo(candidateInfo);
            setScreen('quiz');
          }}
          onNavigate={goMarketing}
          onLogin={goVoucher}
          onLogoClick={goLanding}
        />
      ) : null}
      {screen === 'quiz' && info && session ? (
        <QuizScreen
          candidateInfo={info}
          session={session}
          onBack={() => setScreen('info')}
          onSubmit={(nextResult) => {
            setResult(nextResult);
            setScreen('results');
          }}
        />
      ) : null}
      {screen === 'results' && result ? <ResultsScreen result={result} onHome={goHomeFromApp} /> : null}
    </>
  );
}
