import React, { useState, useEffect, useRef } from 'react';
import { PlayerConfig, GameLogEntry, AnimationSpeed, PlayerColor } from '../../types/game';
import { SnakePlayerState, SnakesGameOptions } from '../../types/snakes';
import { SnakesBoard } from './SnakesBoard';
import { SnakesEngine } from './SnakesEngine';
import { Dice3D } from '../../components/UI/Dice3D';
import { PlayerCard } from '../../components/UI/PlayerCard';
import { GameLog } from '../../components/UI/GameLog';
import { VictoryModal } from '../../components/UI/VictoryModal';
import { SettingsBar } from '../../components/UI/SettingsBar';
import { RulesModal } from '../../components/UI/RulesModal';
import { soundEffects } from '../../engine/soundEffects';
import { COLOR_MAP } from '../../utils/constants';

interface SnakesGameProps {
  initialPlayers: PlayerConfig[];
  options: SnakesGameOptions;
  onHome: () => void;
  onOpenSetup?: () => void;
}

export const SnakesGame: React.FC<SnakesGameProps> = ({
  initialPlayers,
  options,
  onHome,
  onOpenSetup,
}) => {
  const [players, setPlayers] = useState<SnakePlayerState[]>(() =>
    initialPlayers.map((p) => ({
      config: p,
      position: 1,
      hasShield: false,
      isFrozen: false,
      snakesBitten: 0,
      laddersClimbed: 0,
      totalRolls: 0,
    }))
  );

  const [activePlayerIndex, setActivePlayerIndex] = useState(0);
  const [diceValue, setDiceValue] = useState(1);
  const [isRolling, setIsRolling] = useState(false);
  const [isAnimatingMove, setIsAnimatingMove] = useState(false);
  const [animatingPlayerId, setAnimatingPlayerId] = useState<string | undefined>();
  const [displayPositions, setDisplayPositions] = useState<Record<string, number>>({});
  const [logs, setLogs] = useState<GameLogEntry[]>([]);
  const [winner, setWinner] = useState<PlayerConfig | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [speed, setSpeed] = useState<AnimationSpeed>('normal');
  const [isAutoPlay, setIsAutoPlay] = useState(false);

  const activePlayer = players[activePlayerIndex];
  const isBotTurn = activePlayer?.config.type === 'bot' || isAutoPlay;
  const botTimerRef = useRef<any>(null);

  const addLog = (
    text: string,
    type: GameLogEntry['type'] = 'info',
    playerColor?: PlayerColor,
    playerName?: string
  ) => {
    setLogs((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: Date.now(),
        text,
        type,
        playerColor,
        playerName,
      },
    ]);
  };

  useEffect(() => {
    const posMap: Record<string, number> = {};
    players.forEach((p) => {
      posMap[p.config.id] = p.position;
    });
    setDisplayPositions(posMap);
  }, []);

  useEffect(() => {
    if (winner || isRolling || isAnimatingMove) return;

    if (isBotTurn && activePlayer) {
      const delay = speed === 'turbo' ? 200 : speed === 'fast' ? 500 : 900;
      botTimerRef.current = setTimeout(() => {
        handleRollDice();
      }, delay);
    }

    return () => {
      if (botTimerRef.current) clearTimeout(botTimerRef.current);
    };
  }, [activePlayerIndex, isRolling, isAnimatingMove, winner, isBotTurn, speed]);

  const handleRollDice = async () => {
    if (isRolling || isAnimatingMove || winner) return;

    const currentPlayer = players[activePlayerIndex];
    if (!currentPlayer) return;

    if (currentPlayer.isFrozen) {
      addLog(`❄️ ${currentPlayer.config.name} is frozen and skips this turn!`, 'info', currentPlayer.config.color);
      setPlayers((prev) =>
        prev.map((p, idx) => (idx === activePlayerIndex ? { ...p, isFrozen: false } : p))
      );
      advanceTurn(false);
      return;
    }

    soundEffects.playDiceRoll();
    setIsRolling(true);
    const roll = Math.floor(Math.random() * 6) + 1;
    const rollDuration = speed === 'turbo' ? 250 : speed === 'fast' ? 400 : 600;

    setTimeout(() => {
      setDiceValue(roll);
      setIsRolling(false);
      executeMove(currentPlayer, roll);
    }, rollDuration);
  };

  const executeMove = async (playerState: SnakePlayerState, roll: number) => {
    setIsAnimatingMove(true);
    setAnimatingPlayerId(playerState.config.id);

    addLog(
      `🎲 ${playerState.config.name} rolled a ${roll}!`,
      'roll',
      playerState.config.color,
      playerState.config.name
    );

    const fromPos = playerState.position;
    const { bounced, snakeOrLadder, shieldUsed, powerUp } =
      SnakesEngine.calculateMove(
        fromPos,
        roll,
        options.exactRollToWin,
        playerState.hasShield,
        options.enablePowerUps
      );

    const stepDelay = speed === 'turbo' ? 50 : speed === 'fast' ? 100 : 180;
    let currentHop = fromPos;
    const intermediateTarget = fromPos + roll > 100 && options.exactRollToWin ? 100 : Math.min(100, fromPos + roll);

    for (let p = currentHop + 1; p <= intermediateTarget; p++) {
      await new Promise((res) => setTimeout(res, stepDelay));
      currentHop = p;
      soundEffects.playHop(currentHop);
      setDisplayPositions((prev) => ({ ...prev, [playerState.config.id]: currentHop }));
    }

    if (bounced) {
      const overshoot = fromPos + roll - 100;
      addLog(`↩️ Overshot 100! Bounced back ${overshoot} tiles!`, 'info', playerState.config.color);
      for (let p = 99; p >= 100 - overshoot; p--) {
        await new Promise((res) => setTimeout(res, stepDelay));
        currentHop = p;
        soundEffects.playHop(currentHop);
        setDisplayPositions((prev) => ({ ...prev, [playerState.config.id]: currentHop }));
      }
    }

    if (snakeOrLadder && snakeOrLadder.type === 'ladder') {
      await new Promise((res) => setTimeout(res, 200));
      soundEffects.playLadderClimb();
      addLog(
        `🪜 Great climb! Ascended from tile ${snakeOrLadder.from} to ${snakeOrLadder.to}!`,
        'ladder',
        playerState.config.color,
        playerState.config.name
      );
      currentHop = snakeOrLadder.to;
      setDisplayPositions((prev) => ({ ...prev, [playerState.config.id]: currentHop }));
      await new Promise((res) => setTimeout(res, 300));
    }

    if (snakeOrLadder && snakeOrLadder.type === 'snake') {
      if (shieldUsed) {
        addLog(
          `🛡️ Shield protected ${playerState.config.name} from the snake at tile ${snakeOrLadder.from}!`,
          'info',
          playerState.config.color
        );
      } else {
        await new Promise((res) => setTimeout(res, 200));
        soundEffects.playSnakeBite();
        addLog(
          `🐍 Ouch! Bitten by snake at tile ${snakeOrLadder.from}, slid down to ${snakeOrLadder.to}!`,
          'snake',
          playerState.config.color,
          playerState.config.name
        );
        currentHop = snakeOrLadder.to;
        setDisplayPositions((prev) => ({ ...prev, [playerState.config.id]: currentHop }));
        await new Promise((res) => setTimeout(res, 300));
      }
    }

    let updatedShield = shieldUsed ? false : playerState.hasShield;
    if (powerUp) {
      await new Promise((res) => setTimeout(res, 180));
      soundEffects.playSafeSquare();
      if (powerUp.type === 'shield') {
        updatedShield = true;
        addLog(`🛡️ Picked up a Shield!`, 'info', playerState.config.color);
      } else if (powerUp.type === 'boost') {
        addLog(`⚡ Speed Boost! Surged +5 tiles!`, 'info', playerState.config.color);
        currentHop = Math.min(100, currentHop + 5);
        setDisplayPositions((prev) => ({ ...prev, [playerState.config.id]: currentHop }));
      } else if (powerUp.type === 'freeze') {
        addLog(`❄️ Blizzard Freeze! Rivals frozen for 1 turn!`, 'info', playerState.config.color);
        setPlayers((prev) =>
          prev.map((p, idx) => (idx !== activePlayerIndex ? { ...p, isFrozen: true } : p))
        );
      } else if (powerUp.type === 'mystery') {
        addLog(`🎁 Mystery Gift! Extra turn granted!`, 'info', playerState.config.color);
      }
    }

    const finalPos = currentHop;
    const isWin = finalPos >= 100;

    setPlayers((prev) =>
      prev.map((p, idx) => {
        if (idx === activePlayerIndex) {
          return {
            ...p,
            position: finalPos,
            hasShield: updatedShield,
            snakesBitten: snakeOrLadder?.type === 'snake' && !shieldUsed ? p.snakesBitten + 1 : p.snakesBitten,
            laddersClimbed: snakeOrLadder?.type === 'ladder' ? p.laddersClimbed + 1 : p.laddersClimbed,
            totalRolls: p.totalRolls + 1,
            rank: isWin ? 1 : p.rank,
          };
        }
        return p;
      })
    );

    setIsAnimatingMove(false);
    setAnimatingPlayerId(undefined);

    if (isWin) {
      setWinner(playerState.config);
      addLog(`👑 ${playerState.config.name} WON THE GAME!`, 'win', playerState.config.color);
      return;
    }

    const getsExtraTurn = (options.extraTurnOnSix && roll === 6) || powerUp?.type === 'mystery';
    if (getsExtraTurn) {
      addLog(`🎲 ${playerState.config.name} earned an Extra Turn!`, 'info', playerState.config.color);
    } else {
      advanceTurn(false);
    }
  };

  const advanceTurn = (samePlayer: boolean) => {
    if (!samePlayer) {
      setActivePlayerIndex((prev) => (prev + 1) % players.length);
    }
  };

  const handleRestart = () => {
    setPlayers((prev) =>
      prev.map((p) => ({
        ...p,
        position: 1,
        hasShield: false,
        isFrozen: false,
        snakesBitten: 0,
        laddersClimbed: 0,
        totalRolls: 0,
        rank: undefined,
      }))
    );
    setActivePlayerIndex(0);
    setWinner(null);
    setLogs([]);
    const posMap: Record<string, number> = {};
    players.forEach((p) => {
      posMap[p.config.id] = 1;
    });
    setDisplayPositions(posMap);
  };

  const activeColorInfo = activePlayer ? COLOR_MAP[activePlayer.config.color] : COLOR_MAP.red;

  return (
    <div className="flex-1 flex flex-col max-w-6xl mx-auto w-full p-2 sm:p-4 gap-4">
      {/* Top Settings Bar */}
      <SettingsBar
        speed={speed}
        onSpeedChange={setSpeed}
        onRestart={handleRestart}
        onHome={onHome}
        onOpenRules={() => setShowRules(true)}
        onOpenSetup={onOpenSetup}
        gameTitle="Snakes & Ladders (1-100)"
        isAutoPlay={isAutoPlay}
        onToggleAutoPlay={() => setIsAutoPlay(!isAutoPlay)}
      />

      {/* Dynamic Turn Instruction Banner */}
      <div
        className="w-full py-2.5 px-4 rounded-2xl flex items-center justify-between shadow-lg border backdrop-blur-md transition-all"
        style={{
          backgroundColor: `${activeColorInfo.primary}20`,
          borderColor: activeColorInfo.primary,
        }}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-xl">{activePlayer?.config.avatar}</span>
          <div>
            <div className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
              <span>{activePlayer?.config.name}'s Turn</span>
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            </div>
            <p className="text-[11px] font-semibold text-slate-300">
              {isAnimatingMove ? '🏃 Moving pawn on board...' : '🎲 Tap the dice to roll and advance!'}
            </p>
          </div>
        </div>
      </div>

      {/* Main Game Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
        {/* Left Column: Player Cards */}
        <div className="lg:col-span-3 flex flex-col gap-2.5 order-2 lg:order-1">
          <div className="text-xs uppercase font-extrabold tracking-wider text-slate-400 px-1">
            Player Standings
          </div>
          {players.map((p, idx) => (
            <PlayerCard
              key={p.config.id}
              player={p.config}
              isActive={activePlayerIndex === idx}
              scoreLabel="Tile"
              scoreValue={p.position}
              rank={p.rank}
              hasShield={p.hasShield}
              isFrozen={p.isFrozen}
            />
          ))}
        </div>

        {/* Center: The Board */}
        <div className="lg:col-span-6 flex flex-col items-center justify-center order-1 lg:order-2">
          <SnakesBoard
            players={players}
            activePlayerIndex={activePlayerIndex}
            theme={options.theme}
            animatingPlayerId={animatingPlayerId}
            displayPositions={displayPositions}
          />
        </div>

        {/* Right Column: Dice Action Tray & Live Feed */}
        <div className="lg:col-span-3 order-3 flex flex-col gap-3">
          {/* Interactive Dice Tray */}
          <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-5 shadow-2xl flex flex-col items-center justify-center gap-3">
            <span className="text-xs font-extrabold uppercase tracking-widest text-slate-400">
              Dice Roller
            </span>
            <Dice3D
              value={diceValue}
              isRolling={isRolling}
              canRoll={!isRolling && !isAnimatingMove && (!isBotTurn || isAutoPlay)}
              activeColor={activePlayer?.config.color || 'red'}
              onRoll={handleRollDice}
              size={76}
            />
          </div>

          {/* Live Game Action Feed */}
          <GameLog
            logs={logs}
            myColor={activePlayer?.config.color}
            onSendEmote={(emote) =>
              addLog(
                `💬 ${activePlayer?.config.name}: "${emote}"`,
                'chat',
                activePlayer?.config.color
              )
            }
          />
        </div>
      </div>

      {/* Rules Modal */}
      {showRules && <RulesModal initialGame="snakes" onClose={() => setShowRules(false)} />}

      {/* Victory Modal */}
      {winner && (
        <VictoryModal
          winner={winner}
          rankings={players.map((p) => ({
            player: p.config,
            rank: p.rank || 2,
            stats: `Tile ${p.position} | 🪜 ${p.laddersClimbed} | 🐍 ${p.snakesBitten}`,
          }))}
          onRematch={handleRestart}
          onHome={onHome}
        />
      )}
    </div>
  );
};
