import React, { useState } from 'react';
import { PlayerConfig } from './types/game';
import { TaasArenaHub } from './components/Hub/TaasArenaHub';
import { TaasGameId } from './components/Hub/CardRulesModal';
import { GameSetup } from './components/Hub/GameSetup';
import { LudoModeMenu } from './components/Ludo/LudoModeMenu';
import { WorkInProgressScreen } from './components/Common/WorkInProgressScreen';
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
import { MultiplayerSession, GameSnapshot, normalizeRoomCode } from './multiplayer/protocol';
import { onlineLudoController } from './multiplayer/onlineLudoController';

export type AppScreen = 'menu' | TaasGameId;

export interface InitialLaunchState {
  roomCode: string;
  screen: AppScreen;
  setupGameId: TaasGameId | null;
  isLegacyHub: boolean;
}

export function parseLaunchState(search?: string): InitialLaunchState {
  if (isNativeBuild || (typeof window !== 'undefined' && Capacitor.isNativePlatform())) {
    return {
      roomCode: '',
      screen: 'ludo',
      setupGameId: 'ludo',
      isLegacyHub: false,
    };
  }

  const query = search !== undefined ? search : (typeof window !== 'undefined' ? window.location.search : '');
  const params = new URLSearchParams(query);
  const rawRoom = params.get('room');
  const normalizedRoom = rawRoom ? normalizeRoomCode(rawRoom) : '';

  // 1. Room invitation link takes highest precedence: open online lobby immediately
  if (normalizedRoom) {
    return {
      roomCode: normalizedRoom,
      screen: 'ludo',
      setupGameId: null,
      isLegacyHub: false,
    };
  }

  // 2. Explicit ?game=hub opens legacy multi-game card hub
  if (params.get('game') === 'hub') {
    return {
      roomCode: '',
      screen: 'menu',
      setupGameId: null,
      isLegacyHub: true,
    };
  }

  // 3. Default: Shared Ludo Classic experience on web and native
  return {
    roomCode: '',
    screen: 'ludo',
    setupGameId: 'ludo',
    isLegacyHub: false,
  };
}

export function isMaintenanceActive(
  envMode: string = import.meta.env.MODE,
  isDev: boolean = Boolean(import.meta.env.DEV),
  flag: string | undefined = import.meta.env.VITE_MAINTENANCE_MODE
): boolean {
  if (isNativeBuild || (typeof window !== 'undefined' && Capacitor.isNativePlatform())) {
    return false;
  }
  if (isDev || envMode === 'development' || envMode === 'native') {
    return false;
  }
  return flag === 'true';
}

export function getRouterContainerClass(screen: AppScreen, setupGameId: TaasGameId | null): string {
  if (screen !== 'menu' && !setupGameId) {
    return 'p-1 sm:p-2 overflow-hidden justify-center';
  }
  return 'py-3 sm:py-5 px-2 sm:px-4 overflow-y-auto justify-start';
}

function AppContent() {
  const isNative = isNativeBuild || (typeof window !== 'undefined' && Capacitor.isNativePlatform());
  const [initialLaunch] = useState<InitialLaunchState>(() => parseLaunchState());
  const [showMultiplayerModal, setShowMultiplayerModal] = useState<boolean>(() => Boolean(initialLaunch.roomCode));
  const [multiplayerSession, setMultiplayerSession] = useState<MultiplayerSession | null>(null);
  const [screen, setScreen] = useState<AppScreen>(initialLaunch.screen);
  const [setupGameId, setSetupGameId] = useState<TaasGameId | null>(initialLaunch.setupGameId);
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

  const handleStartOnlineMatch = (session: MultiplayerSession, initialSnapshot: GameSnapshot) => {
    onlineLudoController.initSession(session, initialSnapshot);
    setMultiplayerSession(session);
    setPlayers(session.players);
    setLudoOptions(session.options);
    setShowMultiplayerModal(false);
    setScreen('ludo');
    setSetupGameId(null);
    setMatchKey((prev) => prev + 1);
  };

  const handleStartGameFromSetup = (configuredPlayers: PlayerConfig[], options?: any) => {
    setPlayers(configuredPlayers);
    if (setupGameId === 'ludo') {
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
    if (multiplayerSession) {
      onlineLudoController.endSession();
      setMultiplayerSession(null);
    }
    setScreen('ludo');
    setSetupGameId('ludo');
  };

  const handleOpenSetup = () => {
    if (screen !== 'menu') {
      setSetupGameId(screen);
    }
  };

  const isGameActive = screen !== 'menu' || !!setupGameId;

  return (
    <main
      className={`${
        isGameActive ? 'h-dvh max-h-dvh overflow-hidden flex flex-col' : 'min-h-screen flex flex-col justify-between'
      } bg-[#221309] bg-[radial-gradient(ellipse_at_50%_38%,_#7a4b26_0%,_#543217_40%,_#331d0d_80%,_#1f1006_100%)] text-[#f6ead7] selection:bg-amber-600 selection:text-white relative`}
    >
      {/* Subtle Physical Wood Tabletop Grain & Warm Overhead Lighting */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 opacity-[0.04] bg-[radial-gradient(#f6ead7_1px,transparent_1px),radial-gradient(#e2a865_1px,transparent_1px)] [background-size:20px_20px,32px_32px] [background-position:0_0,10px_10px]" />
      <div className="fixed inset-0 pointer-events-none z-0 bg-[radial-gradient(circle_at_50%_38%,rgba(255,228,185,0.08)_0%,transparent_65%)]" />

      {/* Header Bar - Sticky and Pinned at Top */}
      <header className="sticky top-0 shrink-0 z-40 border-b border-[#4d2c16] bg-[#1e1007]/95 backdrop-blur-md px-3 sm:px-6 py-2 sm:py-2.5 flex items-center justify-between shadow-lg">
        <button
          type="button"
          onClick={handleHome}
          className="flex items-center gap-2.5 text-left group transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-xl"
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-700 flex items-center justify-center text-base shadow-md group-hover:scale-105 transition-transform text-slate-950 font-black border border-amber-300/40">
            🎲
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black tracking-tight text-[#f6ead7] leading-none">
              LUDO <span className="text-[#d6a85f]">CLASSIC</span>
            </h1>
            <span className="text-[10px] text-[#cdb99d] font-bold uppercase tracking-wider">
              Royal Board Game • Offline & Online
            </span>
          </div>
        </button>

        {/* Header Action Slot for Game Controls */}
        <div id="header-actions" className="flex items-center gap-1.5 sm:gap-2 shrink-0" />
      </header>

      {/* Main Content Router */}
      <div
        className={`relative z-10 flex-1 min-h-0 flex flex-col ${getRouterContainerClass(
          screen,
          setupGameId
        )}`}
      >
        {/* If Player Setup is open for a game, show Setup screen first */}
        {setupGameId === 'ludo' ? (
          <LudoModeMenu
            isNative={isNative}
            onStartOfflineGame={(configuredPlayers, options) => {
              if (multiplayerSession) {
                onlineLudoController.endSession();
                setMultiplayerSession(null);
              }
              setPlayers(configuredPlayers);
              setLudoOptions(options);
              setMatchKey((prev) => prev + 1);
              setScreen('ludo');
              setSetupGameId(null);
            }}
            onOpenOnlineMultiplayer={() => setShowMultiplayerModal(true)}
            onBackToHub={initialLaunch.isLegacyHub ? () => {
              setSetupGameId(null);
              setScreen('menu');
            } : undefined}
            onResumeGame={matchKey > 0 && screen === 'ludo' ? () => setSetupGameId(null) : undefined}
          />
        ) : setupGameId ? (
          <GameSetup
            gameType={setupGameId}
            initialPlayers={players}
            onBack={() => setSetupGameId(null)}
            onStartGame={handleStartGameFromSetup}
            onOpenOnlineMultiplayer={() => setShowMultiplayerModal(true)}
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
        {showMultiplayerModal && (
          <OnlineLobbyModal
            initialRoomCode={initialLaunch.roomCode}
            onClose={() => {
              setShowMultiplayerModal(false);
              if (typeof window !== 'undefined' && window.history.replaceState) {
                const url = new URL(window.location.href);
                url.searchParams.delete('room');
                window.history.replaceState({}, '', url.toString());
              }
              if (!multiplayerSession) {
                setScreen('ludo');
                setSetupGameId('ludo');
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

export function App() {
  if (isMaintenanceActive()) {
    return <WorkInProgressScreen />;
  }

  return <AppContent />;
}

export default App;
