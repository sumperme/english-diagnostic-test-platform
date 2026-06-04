import { useState } from 'react';
import { InfoScreen } from './screens/InfoScreen';
import { LandingScreen } from './screens/LandingScreen';
import { QuizScreen } from './screens/QuizScreen';
import { ResultsScreen } from './screens/ResultsScreen';
import { VoucherScreen } from './screens/VoucherScreen';
import { loadSession } from './lib/session';
import type { CandidateInfo, ReportResult, Session } from './types';

type Screen = 'landing' | 'voucher' | 'info' | 'quiz' | 'results';

export function App() {
  const [screen, setScreen] = useState<Screen>('landing');
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [info, setInfo] = useState<CandidateInfo | null>(null);
  const [result, setResult] = useState<ReportResult | null>(null);

  const goVoucher = () => setScreen(session ? 'info' : 'voucher');

  return (
    <>
      {screen === 'landing' ? <LandingScreen onStart={goVoucher} /> : null}
      {screen === 'voucher' ? (
        <VoucherScreen
          onBack={() => setScreen('landing')}
          onSuccess={(nextSession) => {
            setSession(nextSession);
            setScreen('info');
          }}
        />
      ) : null}
      {screen === 'info' ? (
        <InfoScreen
          onNext={(candidateInfo) => {
            setInfo(candidateInfo);
            setScreen('quiz');
          }}
        />
      ) : null}
      {screen === 'quiz' && info && session ? (
        <QuizScreen
          candidateInfo={info}
          session={session}
          onSubmit={(nextResult) => {
            setResult(nextResult);
            setScreen('results');
          }}
        />
      ) : null}
      {screen === 'results' && result ? <ResultsScreen result={result} /> : null}
    </>
  );
}
