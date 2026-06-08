import { useEffect, useState } from 'react';
import { InfoScreen } from './screens/InfoScreen';
import { LandingScreen } from './screens/LandingScreen';
import { MarketingScreen } from './screens/MarketingScreen';
import { PurchaseVoucherScreen } from './screens/PurchaseVoucherScreen';
import { QuizScreen } from './screens/QuizScreen';
import { ResultsScreen } from './screens/ResultsScreen';
import { VoucherScreen } from './screens/VoucherScreen';
import { AdminScreen } from './screens/AdminScreen';
import { TeacherDashboardScreen } from './screens/TeacherDashboardScreen';
import { loadSession } from './lib/session';
import { loadTeacherSession, saveTeacherSession, verifyTeacherKey } from './lib/api';
import type { CandidateInfo, MarketingPage, ReportResult, Session, TeacherSession } from './types';

type Screen =
  | 'landing'
  | MarketingPage
  | 'voucher'
  | 'purchase'
  | 'info'
  | 'quiz'
  | 'results'
  | 'teacher';

const MARKETING_PAGES: MarketingPage[] = ['learners', 'schools', 'universities', 'collaboration'];
const DEFAULT_USER_GROUP = 'General Learner';

function isMarketingPage(screen: Screen): screen is MarketingPage {
  return MARKETING_PAGES.includes(screen as MarketingPage);
}

function isAdminPath() {
  return window.location.pathname === '/admin';
}

function isTeacherPath() {
  return window.location.pathname === '/teacher';
}

export function App() {
  const [isAdmin, setIsAdmin] = useState(() => isAdminPath());
  const [screen, setScreen] = useState<Screen>(() => (isTeacherPath() ? 'teacher' : 'landing'));
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [info, setInfo] = useState<CandidateInfo | null>(null);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [teacherSession, setTeacherSession] = useState<TeacherSession | null>(() => loadTeacherSession());

  useEffect(() => {
    setIsAdmin(isAdminPath());
    if (isTeacherPath() && teacherSession) {
      setScreen('teacher');
    }
  }, [teacherSession]);

  if (isAdmin) {
    return <AdminScreen />;
  }

  if (screen === 'teacher' && teacherSession) {
    return (
      <TeacherDashboardScreen
        session={teacherSession}
        onSignOut={() => {
          setTeacherSession(null);
          setScreen('landing');
          // Clear URL if navigated via /teacher
          if (window.location.pathname === '/teacher') {
            window.history.pushState({}, '', '/');
          }
        }}
      />
    );
  }

  const goLanding = () => setScreen('landing');
  const goMarketing = (page: MarketingPage) => setScreen(page);
  const goVoucher = () => setScreen(session ? 'info' : 'voucher');
  const goHomeFromApp = () => setScreen('landing');
  const userGroup = session?.userGroup ?? DEFAULT_USER_GROUP;

  const handleTeacherLogin = async (key: string): Promise<void> => {
    const ts = await verifyTeacherKey(key);
    saveTeacherSession(ts);
    setTeacherSession(ts);
    setScreen('teacher');
  };

  return (
    <>
      {screen === 'landing' ? (
        <LandingScreen onStart={goVoucher} onNavigate={goMarketing} onLogoClick={goLanding} />
      ) : null}
      {isMarketingPage(screen) ? (
        <MarketingScreen
          page={screen}
          onNavigate={goMarketing}
          onLogin={goVoucher}
          onLogoClick={goLanding}
          onTeacherLogin={screen === 'schools' ? handleTeacherLogin : undefined}
        />
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
