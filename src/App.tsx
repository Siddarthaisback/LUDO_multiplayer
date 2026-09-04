import React, { useState } from 'react';
import { PlayerConfig } from './types/game';
import { TaasArenaHub } from './components/Hub/TaasArenaHub';
import { TaasGameId } from './components/Hub/CardRulesModal';
import { GameSetup } from './components/Hub/GameSetup';
const isNativeBuild = import.meta.env.MODE === 'native';

const LudoGame = React.lazy(() =>
  import('./games/ludo/LudoGame').then((m) => ({ default: m.LudoGame }))
);
const CallBreakTable: React.ComponentType<any> = isNativeBuild
  ? () => null
  : React.lazy(() =>
      import('./games/callbreak/ui/CallBreakTable').then((m) => ({ default: m.CallBreakTable }))
    );
const DhumbalTable: React.ComponentType<any> = isNativeBuild
  ? () => null
  : React.lazy(() =>
      import('./games/dhumbal/ui/DhumbalTable').then((m) => ({ default: m.DhumbalTable }))
    );
const JutPattiTable: React.ComponentType<any> = isNativeBuild
  ? () => null
  : React.lazy(() =>
      import('./games/jutpatti/ui/JutPattiTable').then((m) => ({ default: m.JutPattiTable }))
    );
const TeenPattiTable: React.ComponentType<any> = isNativeBuild
  ? () => null
  : React.lazy(() =>
      import('./games/teenpatti/ui/TeenPattiTable').then((m) => ({ default: m.TeenPattiTable }))
    );
const PokerTable: React.ComponentType<any> = isNativeBuild
  ? () => null
  : React.lazy(() =>
      import('./games/poker/ui/PokerTable').then((m) => ({ default: m.PokerTable }))
    );
const SnakesGame: React.ComponentType<any> = isNativeBuild
  ? () => null
  : React.lazy(() =>
      import('./games/snakes-and-ladders/SnakesGame').then((m) => ({ default: m.SnakesGame }))
    );
import { DEFAULT_PLAYERS } from './utils/constants';
import { Capacitor } from '@capacitor/core';
import { OnlineLobbyModal } from './components/Multiplayer/OnlineLobbyModal';
import { MultiplayerSession, GameSnapshot } from './multiplayer/protocol';
import { onlineLudoController } from './multiplayer/onlineLudoController';

type AppScreen = 'menu' | TaasGameId;

function getInitialRoomCode(): string {
  if (isNativeBuild || (typeof window !== 'undefined' && Capacitor.isNativePlatform())) return '';
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    return params.get('room') || '';
  }
  return '';
}

function isAutoPlayRequested(): boolean {
  if (isNativeBuild || (typeof window !== 'undefined' && Capacitor.isNativePlatform())) return false;
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    return params.get('autoplay') === 'true' || params.get('mode') === 'autoplay';
  }
  return false;
}

function getInitialScreen(): AppScreen {
  if (isNativeBuild || (typeof window !== 'undefined' && Capacitor.isNativePlatform())) {
    return 'ludo';
  }
  if (isAutoPlayRequested()) {
    return 'ludo';
  }
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('game') === 'ludo' || window.location.hash === '#ludo') {
      return 'ludo';
    }
  }
  return 'menu';
}

export function App() {
  const isNative = isNativeBuild || (typeof window !== 'undefined' && Capacitor.isNativePlatform());
  const [ludoInitialAutoPlay, setLudoInitialAutoPlay] = useState<boolean>(isAutoPlayRequested);
  const [showMultiplayerModal, setShowMultiplayerModal] = useState<boolean>(() => Boolean(getInitialRoomCode()));
  const [multiplayerSession, setMultiplayerSession] = useState<MultiplayerSession | null>(null);
  const [screen, setScreen] = useState<AppScreen>(getInitialScreen);
  const [setupGameId, setSetupGameId] = useState<TaasGameId | null>(() => {
    if (isAutoPlayRequested() || getInitialRoomCode()) return null;
    const initial = getInitialScreen();
    return initial === 'ludo' ? 'ludo' : null;
  });
  const [players, setPlayers] = useState<PlayerConfig[]>(DEFAULT_PLAYERS);
  const [matchKey, setMatchKey] = useState<number>(0);

  const [ludoOptions, setLudoOptions] = useState<any>({
    requireSixToStart: true,
    bonusTurnOnSix: true,
    bonusTurnOnCapture: true,
    bonusTurnOnHome: true,
    maxConsecutiveSixes: 3,
  });

  const [snakesOptions, setSnakesOptions] = useState<any>({
    theme: 'classic',
    enablePowerUps: false,
    exactRollToWin: true,
    extraTurnOnSix: true,
  });

  const [callBreakRules, setCallBreakRules] = useState<any>(undefined);

  // When a game is clicked on the hub, prompt for Player Setup at beginning before entering play
  const handleSelectGame = (gameId: TaasGameId) => {
    if (isNative && gameId !== 'ludo') return;
    setSetupGameId(gameId);
  };

  const handleLaunchLudoAutoPlay = () => {
    setLudoInitialAutoPlay(true);
    setScreen('ludo');
    setSetupGameId(null);
    setMatchKey((prev) => prev + 1);
  };

  const handleStartOnlineMatch = (session: MultiplayerSession, initialSnapshot: GameSnapshot) => {
    onlineLudoController.initSession(session, initialSnapshot);
    setMultiplayerSession(session);
    setPlayers(session.players);
    setLudoOptions(session.options);
    setLudoInitialAutoPlay(false);
    setShowMultiplayerModal(false);
    setScreen('ludo');
    setSetupGameId(null);
    setMatchKey((prev) => prev + 1);
  };

  const handleStartGameFromSetup = (configuredPlayers: PlayerConfig[], options?: any, isAutoPlayLaunch?: boolean) => {
    setPlayers(configuredPlayers);
    if (setupGameId === 'ludo') {
      setLudoInitialAutoPlay(Boolean(isAutoPlayLaunch));
      if (options) setLudoOptions(options);
    } else if (setupGameId === 'snakes' && options) {
      setSnakesOptions(options);
    } else if (setupGameId === 'callbreak' && options) {
      setCallBreakRules(options);
    }
    setMatchKey((prev) => prev + 1);
    setScreen(setupGameId!);
    setSetupGameId(null);
  };

  const handleHome = () => {
    setLudoInitialAutoPlay(false);
    if (multiplayerSession) {
      onlineLudoController.endSession();
      setMultiplayerSession(null);
    }
    if (isNative) {
      setScreen('ludo');
      setSetupGameId('ludo');
    } else {
      setScreen('menu');
      setSetupGameId(null);
    }
  };

  const handleOpenSetup = () => {
    if (screen !== 'menu') {
      setSetupGameId(screen);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-amber-500 selection:text-slate-950">
      {/* Background Ambient Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 left-1/4 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
      </div>

      {/* Header Bar */}
      <header className="relative z-10 border-b border-slate-800/80 bg-slate-950 px-4 sm:px-6 py-3 flex items-center justify-between">
        <button
          onClick={handleHome}
          className="flex items-center gap-2.5 text-left group transition-all cursor-pointer"
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 via-yellow-400 to-amber-600 flex items-center justify-center text-base shadow-md group-hover:scale-105 transition-transform text-slate-950 font-black">
            {isNative ? '🎲' : '♠️'}
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black tracking-tight text-white leading-none">
              {isNative ? 'LUDO' : 'TAAS'} <span className="text-amber-400">{isNative ? 'CLASSIC' : 'ARENA'}</span>
            </h1>
            <span className="text-[10px] text-amber-300/80 font-bold uppercase tracking-wider">
              {isNative ? 'Offline Board Game' : 'Nepali & Classic Hub'}
            </span>
          </div>
        </button>
      </header>

      {/* Main Content Router */}
      <div className={`relative z-10 flex-1 flex flex-col justify-center ${screen === 'menu' && !setupGameId ? 'py-4' : 'p-1 sm:p-2 h-[calc(100vh-64px)] overflow-hidden'}`}>
        {/* If Player Setup is open for a game, show Setup screen first */}
        {setupGameId ? (
          <GameSetup
            gameType={setupGameId}
            initialPlayers={players}
            onBack={() => setSetupGameId(null)}
            onStartGame={handleStartGameFromSetup}
          />
        ) : (
          <React.Suspense
            fallback={
              <div className="flex-1 flex flex-col items-center justify-center p-6 gap-3 select-none text-slate-400">
                <div className="w-10 h-10 border-3 border-amber-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Loading Game Arena...
                </span>
              </div>
            }
          >
            {screen === 'menu' && !isNative && (
              <TaasArenaHub
                onSelectGame={handleSelectGame}
                onLaunchLudoAutoPlay={handleLaunchLudoAutoPlay}
                onOpenOnlineMultiplayer={() => setShowMultiplayerModal(true)}
              />
            )}

            {!isNative && screen === 'callbreak' && (
              <CallBreakTable
                key={`callbreak-${matchKey}`}
                initialPlayers={players}
                onHome={handleHome}
                onOpenSetup={handleOpenSetup}
                rulesConfig={callBreakRules}
              />
            )}

            {!isNative && screen === 'dhumbal' && (
              <DhumbalTable
                key={`dhumbal-${matchKey}`}
                initialPlayers={players}
                onHome={handleHome}
                onOpenSetup={handleOpenSetup}
              />
            )}

            {!isNative && screen === 'jutpatti' && (
              <JutPattiTable
                key={`jutpatti-${matchKey}`}
                initialPlayers={players}
                onHome={handleHome}
                onOpenSetup={handleOpenSetup}
              />
            )}

            {!isNative && screen === 'teenpatti' && (
              <TeenPattiTable
                key={`teenpatti-${matchKey}`}
                initialPlayers={players}
                onHome={handleHome}
                onOpenSetup={handleOpenSetup}
              />
            )}

            {!isNative && screen === 'poker' && (
              <PokerTable
                key={`poker-${matchKey}`}
                initialPlayers={players}
                onHome={handleHome}
                onOpenSetup={handleOpenSetup}
              />
            )}

            {screen === 'ludo' && (
              <LudoGame
                key={`ludo-${matchKey}`}
                initialPlayers={players}
                options={ludoOptions}
                onHome={handleHome}
                onOpenSetup={handleOpenSetup}
                initialAutoPlay={ludoInitialAutoPlay}
                multiplayerSession={multiplayerSession}
              />
            )}

            {!isNative && screen === 'snakes' && (
              <SnakesGame
                key={`snakes-${matchKey}`}
                initialPlayers={players}
                options={snakesOptions}
                onHome={handleHome}
                onOpenSetup={handleOpenSetup}
              />
            )}
          </React.Suspense>
        )}

        {/* Online Multiplayer Lobby Modal */}
        {showMultiplayerModal && !isNative && (
          <OnlineLobbyModal
            initialRoomCode={getInitialRoomCode()}
            onClose={() => {
              setShowMultiplayerModal(false);
              if (typeof window !== 'undefined' && window.history.replaceState) {
                const url = new URL(window.location.href);
                url.searchParams.delete('room');
                window.history.replaceState({}, '', url.toString());
              }
            }}
            onStartMatch={handleStartOnlineMatch}
          />
        )}
      </div>

      {/* Global Footer (Menu Only) */}
      {!isNative && screen === 'menu' && !setupGameId && (
        <footer className="relative z-10 border-t border-slate-800/80 py-3 text-center text-[11px] text-slate-500 font-medium">
          TAAS ARENA &bull; Call Break &bull; Dhumbal / Jhyap &bull; Jut Patti &bull; Teen Patti &bull; Texas Hold'em &bull; Virtual Chips Only
        </footer>
      )}
    </main>
  );
}

export default App;
