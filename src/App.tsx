import { useState, useEffect, useRef, useCallback } from 'react';
import { ENEMIES, ROOMS, STORY_INTRO, STORY_MIDPOINTS } from './gameData';
import type { Enemy, Bullet, GameItem } from './gameData';
import { playMelody, stopMelody, playSfx, setVolume, initAudio } from './audio';

// ===== TYPES =====
type GameState = 'title' | 'intro' | 'overworld' | 'battle' | 'gameover' | 'ending';
type BattlePhase = 'menu' | 'act' | 'item' | 'enemy_turn' | 'dialogue' | 'victory' | 'transition';

interface PlayerState {
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  lv: number;
  exp: number;
  gold: number;
}

// ===== CONSTANTS =====
const BERT_MAX_HP = 92;
const BERT_ATK = 12;
const BERT_DEF = 8;

// ===== MAIN COMPONENT =====
export default function App() {
  const [gameState, setGameState] = useState<GameState>('title');
  const [introIndex, setIntroIndex] = useState(0);
  const [currentRoom, setCurrentRoom] = useState('classroom');
  const [dialogue, setDialogue] = useState<string[]>([]);
  const [dialogueIndex, setDialogueIndex] = useState(0);
  const [inventory, setInventory] = useState<GameItem[]>([]);
  const [player, setPlayer] = useState<PlayerState>({
    hp: BERT_MAX_HP, maxHp: BERT_MAX_HP, atk: BERT_ATK, def: BERT_DEF, lv: 1, exp: 0, gold: 0,
  });
  const [currentEnemy, setCurrentEnemy] = useState<Enemy | null>(null);
  const [battlePhase, setBattlePhase] = useState<BattlePhase>('menu');
  const [menuSelection, setMenuSelection] = useState(0);
  const [battleLog, setBattleLog] = useState<string[]>([]);
  const [bullets, setBullets] = useState<Bullet[]>([]);
  const [playerPos, setPlayerPos] = useState({ x: 150, y: 100 });
  const [isDodging, setIsDodging] = useState(false);
  const [visitedRooms, setVisitedRooms] = useState<Set<string>>(new Set(['classroom']));
  const [defeatedEnemies, setDefeatedEnemies] = useState<Set<string>>(new Set());
  const [collectedItems, setCollectedItems] = useState<Set<string>>(new Set());
  const [fightAnim, setFightAnim] = useState(false);
  const [shake, setShake] = useState(false);
  const [dmgNum, setDmgNum] = useState<{ val: number } | null>(null);
  const [invincible, setInvincible] = useState(false);
  const [audioOn, setAudioOn] = useState(false);
  const [volume, setVol] = useState(0.3);
  const [showMidpoint, setShowMidpoint] = useState(false);
  const [midpointText, setMidpointText] = useState<string[]>([]);
  const [midpointIdx, setMidpointIdx] = useState(0);

  // Refs for game loop
  const keysRef = useRef(new Set<string>());
  const animRef = useRef<number>(0);
  const dodgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enemyRef = useRef<Enemy | null>(null);
  const playerPosRef = useRef(playerPos);
  const invincibleRef = useRef(false);
  const isDodgingRef = useRef(false);

  // Keep refs in sync
  useEffect(() => { playerPosRef.current = playerPos; }, [playerPos]);
  useEffect(() => { invincibleRef.current = invincible; }, [invincible]);
  useEffect(() => { isDodgingRef.current = isDodging; }, [isDodging]);
  useEffect(() => { enemyRef.current = currentEnemy; }, [currentEnemy]);

  // ===== AUDIO =====
  const startAudio = useCallback(() => {
    if (!audioOn) {
      initAudio();
      setAudioOn(true);
      playMelody('menu');
    }
  }, [audioOn]);

  // Music changes based on game state
  useEffect(() => {
    if (!audioOn) return;
    if (gameState === 'title') {
      stopMelody();
    } else if (gameState === 'battle' && currentEnemy) {
      if (currentEnemy.name.includes('Principal') || currentEnemy.name.includes('Matěj')) {
        playMelody('boss');
      } else {
        playMelody('battle');
      }
    } else if (gameState === 'overworld') {
      playMelody('overworld');
    } else if (gameState === 'ending') {
      playMelody('victory');
    }
  }, [gameState, currentEnemy, audioOn]);

  // ===== GAME LOOP (Bullet Hell) =====
  useEffect(() => {
    if (!isDodging || gameState !== 'battle') return;

    const loop = () => {
      if (!isDodgingRef.current) return;

      const speed = 4;
      const keys = keysRef.current;
      setPlayerPos(pos => {
        let nx = pos.x, ny = pos.y;
        if (keys.has('ArrowLeft') || keys.has('a')) nx -= speed;
        if (keys.has('ArrowRight') || keys.has('d')) nx += speed;
        if (keys.has('ArrowUp') || keys.has('w')) ny -= speed;
        if (keys.has('ArrowDown') || keys.has('s')) ny += speed;
        nx = Math.max(10, Math.min(290, nx));
        ny = Math.max(10, Math.min(190, ny));
        return { x: nx, y: ny };
      });

      setBullets(prev => prev.map(b => ({ ...b, x: b.x + b.vx, y: b.y + b.vy }))
        .filter(b => b.x > -50 && b.x < 350 && b.y > -50 && b.y < 250));

      // Collision
      if (!invincibleRef.current) {
        const pos = playerPosRef.current;
        setBullets(prev => {
          const hit = prev.some(b => {
            const dx = b.x - pos.x;
            const dy = b.y - pos.y;
            return Math.sqrt(dx * dx + dy * dy) < (b.size + 8);
          });
          if (hit) {
            const enemy = enemyRef.current;
            const dmg = Math.max(1, (enemy?.atk || 5) - BERT_DEF);
            setPlayer(p => {
              const newHp = Math.max(0, p.hp - dmg);
              if (newHp <= 0) {
                setIsDodging(false);
                setBullets([]);
                setTimeout(() => {
                  setGameState('gameover');
                  stopMelody();
                }, 300);
              }
              return { ...p, hp: newHp };
            });
            setShake(true);
            setTimeout(() => setShake(false), 200);
            playSfx('hurt');
            setInvincible(true);
            setTimeout(() => setInvincible(false), 800);
          }
          return prev;
        });
      }

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [isDodging, gameState]);

  // ===== KEYBOARD =====
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keysRef.current.add(e.key);

      if (gameState === 'title' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        startAudio();
        setGameState('intro');
        playSfx('confirm');
      }
      if (gameState === 'intro' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        playSfx('select');
        if (introIndex < STORY_INTRO.length - 1) {
          setIntroIndex(i => i + 1);
        } else {
          setGameState('overworld');
        }
      }
      if (showMidpoint && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        playSfx('select');
        if (midpointIdx < midpointText.length - 1) {
          setMidpointIdx(i => i + 1);
        } else {
          setShowMidpoint(false);
          beginBattle();
        }
      }
      if (gameState === 'overworld' && dialogue.length > 0 && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        playSfx('select');
        if (dialogueIndex < dialogue.length - 1) {
          setDialogueIndex(i => i + 1);
        } else {
          setDialogue([]);
          setDialogueIndex(0);
        }
      }
      if (gameState === 'battle') {
        handleBattleKey(e.key);
      }
      if (gameState === 'gameover' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        restartGame();
      }
      if (gameState === 'ending' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        setGameState('title');
        stopMelody();
      }
    };
    const up = (e: KeyboardEvent) => keysRef.current.delete(e.key);

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  });

  // ===== BATTLE LOGIC =====
  const handleBattleKey = (key: string) => {
    if (battlePhase === 'transition') return;

    if (battlePhase === 'dialogue') {
      if (key === 'Enter' || key === ' ') {
        playSfx('select');
        setBattlePhase('menu');
        setMenuSelection(0);
      }
      return;
    }
    if (battlePhase === 'menu') {
      if (key === 'ArrowLeft') { setMenuSelection(s => Math.max(0, s - 1)); playSfx('select'); }
      if (key === 'ArrowRight') { setMenuSelection(s => Math.min(3, s + 1)); playSfx('select'); }
      if (key === 'Enter' || key === ' ') {
        playSfx('confirm');
        if (menuSelection === 0) doFight();
        else if (menuSelection === 1) setBattlePhase('act');
        else if (menuSelection === 2) setBattlePhase('item');
        else if (menuSelection === 3) doMercy();
      }
    }
    if (battlePhase === 'victory') {
      if (key === 'Enter' || key === ' ') endBattle();
    }
  };

  const doFight = () => {
    const enemy = currentEnemy;
    if (!enemy) return;
    setFightAnim(true);
    playSfx('attack');
    const dmg = Math.max(1, player.atk - enemy.def + Math.floor(Math.random() * 5));
    setDmgNum({ val: dmg });
    setTimeout(() => setDmgNum(null), 1000);
    setTimeout(() => {
      setFightAnim(false);
      const newHp = Math.max(0, enemy.hp - dmg);
      setCurrentEnemy({ ...enemy, hp: newHp });
      setBattleLog([`* Bert attacks! ${dmg} damage!`]);
      if (newHp <= 0) {
        setTimeout(() => {
          setBattleLog([enemy.defeatText]);
          setBattlePhase('victory');
          playSfx('confirm');
        }, 500);
      } else {
        setTimeout(() => startEnemyTurn(), 800);
      }
    }, 400);
  };

  const doAct = (idx: number) => {
    const enemy = currentEnemy;
    if (!enemy) return;
    playSfx('confirm');
    const resp = enemy.actResponses[idx] || '* Nothing happens.';
    setBattleLog([resp]);
    setBattlePhase('dialogue');
    if (enemy.spareable) {
      setCurrentEnemy(prev => prev ? { ...prev, mercyCount: prev.mercyCount + 1 } : null);
    }
    // Some acts also deal damage
    if (idx === 0 || idx === 2) {
      const dmg = Math.floor(player.atk * 0.5);
      const newHp = Math.max(0, enemy.hp - dmg);
      setCurrentEnemy(prev => prev ? { ...prev, hp: newHp } : null);
      if (newHp <= 0) {
        setTimeout(() => {
          setBattleLog([enemy.defeatText]);
          setBattlePhase('victory');
        }, 1200);
        return;
      }
    }
    setTimeout(() => startEnemyTurn(), 1500);
  };

  const doMercy = () => {
    const enemy = currentEnemy;
    if (!enemy) return;
    if (enemy.mercyCount >= enemy.spareThreshold) {
      setBattleLog([enemy.spareText]);
      setBattlePhase('victory');
      playSfx('heal');
    } else {
      setBattleLog([
        `* You tried to spare ${enemy.name}... not ready yet.`,
        `* (Use ACT to weaken its resolve! ${enemy.mercyCount}/${enemy.spareThreshold})`
      ]);
      setBattlePhase('dialogue');
      setTimeout(() => startEnemyTurn(), 2000);
    }
  };

  const useItem = (idx: number) => {
    if (idx >= inventory.length) return;
    const item = inventory[idx];
    setPlayer(p => ({ ...p, hp: Math.min(p.maxHp, p.hp + item.healAmount) }));
    setInventory(inv => inv.filter((_, i) => i !== idx));
    setBattleLog([`* Bert used ${item.emoji} ${item.name}! Healed ${item.healAmount} HP!`]);
    setBattlePhase('dialogue');
    playSfx('heal');
    setTimeout(() => startEnemyTurn(), 1500);
  };

  const startEnemyTurn = () => {
    const enemy = currentEnemy;
    if (!enemy) return;
    const d = enemy.dialogue[Math.floor(Math.random() * enemy.dialogue.length)];
    setBattleLog([d]);
    setBattlePhase('transition');
    setTimeout(() => {
      const pattern = enemy.attackPatterns[Math.floor(Math.random() * enemy.attackPatterns.length)];
      setBullets(pattern.bullets.map(b => ({ ...b })));
      setPlayerPos({ x: 150, y: 100 });
      setIsDodging(true);
      setBattlePhase('enemy_turn');

      dodgeTimerRef.current = setTimeout(() => {
        setIsDodging(false);
        setBullets([]);
        setBattlePhase('menu');
        setMenuSelection(0);
      }, pattern.duration);
    }, 1200);
  };

  const beginBattle = () => {
    const room = ROOMS[currentRoom];
    if (room.encounters && room.encounters.length > 0) {
      const ek = room.encounters.find(e => !defeatedEnemies.has(`${currentRoom}_${e}`));
      if (ek) {
        const enemy = { ...ENEMIES[ek], mercyCount: 0 };
        setCurrentEnemy(enemy);
        setBattlePhase('menu');
        setMenuSelection(0);
        setBattleLog([enemy.dialogue[0]]);
        setPlayerPos({ x: 150, y: 100 });
        setBullets([]);
        setIsDodging(false);
        setGameState('battle');
        playSfx('attack');
        return;
      }
    }
    setGameState('overworld');
  };

  const endBattle = () => {
    if (currentEnemy) {
      setDefeatedEnemies(prev => new Set([...prev, `${currentRoom}_${currentEnemy.name}`]));
      const expGain = Math.floor(currentEnemy.maxHp * 0.5);
      const goldGain = Math.floor(currentEnemy.maxHp * 0.3);
      setPlayer(p => ({
        ...p,
        exp: p.exp + expGain,
        gold: p.gold + goldGain,
        lv: p.exp + expGain >= p.lv * 30 ? p.lv + 1 : p.lv,
      }));
    }
    if (currentRoom === 'darkroom') {
      setGameState('ending');
    } else {
      setGameState('overworld');
    }
    setCurrentEnemy(null);
    setBattleLog([]);
    setBullets([]);
    setIsDodging(false);
  };

  const moveToRoom = (roomId: string) => {
    // Add party on hallway
    if (roomId === 'hallway' && !visitedRooms.has('hallway')) {
      setDialogue([
        "* Martin and Kája join your party!",
        "* Martin: 'Dude, this is either awesome or terrifying.'",
        "* Kája: 'Statistically? Both.'",
        "* Your party has formed! Fight together!",
      ]);
      setDialogueIndex(0);
    }

    setCurrentRoom(roomId);
    setVisitedRooms(prev => new Set([...prev, roomId]));
    playSfx('confirm');

    // Check midpoint story
    if (STORY_MIDPOINTS[roomId] && !visitedRooms.has(roomId)) {
      setMidpointText(STORY_MIDPOINTS[roomId]);
      setMidpointIdx(0);
      setShowMidpoint(true);
      return;
    }

    // Check encounters
    const room = ROOMS[roomId];
    if (room.encounters && room.encounters.some(e => !defeatedEnemies.has(`${roomId}_${e}`))) {
      setTimeout(() => {
        const ek = room.encounters!.find(e => !defeatedEnemies.has(`${roomId}_${e}`));
        if (ek) {
          const enemy = { ...ENEMIES[ek], mercyCount: 0 };
          setCurrentEnemy(enemy);
          setBattlePhase('menu');
          setMenuSelection(0);
          setBattleLog([enemy.dialogue[0]]);
          setPlayerPos({ x: 150, y: 100 });
          setBullets([]);
          setIsDodging(false);
          setGameState('battle');
          playSfx('attack');
        }
      }, 200);
    }
  };

  const collectItem = (room: string, idx: number) => {
    const key = `${room}_${idx}`;
    if (collectedItems.has(key)) return;
    const item = ROOMS[room].items![idx];
    setInventory(inv => [...inv, item]);
    setCollectedItems(prev => new Set([...prev, key]));
    setDialogue([`* Found ${item.emoji} ${item.name}!`, `* ${item.description}`]);
    setDialogueIndex(0);
    playSfx('heal');
  };

  const restartGame = () => {
    setGameState('title');
    setIntroIndex(0);
    setCurrentRoom('classroom');
    setDialogue([]);
    setDialogueIndex(0);
    setInventory([]);
    setPlayer({ hp: BERT_MAX_HP, maxHp: BERT_MAX_HP, atk: BERT_ATK, def: BERT_DEF, lv: 1, exp: 0, gold: 0 });
    setCurrentEnemy(null);
    setBattlePhase('menu');
    setMenuSelection(0);
    setBattleLog([]);
    setBullets([]);
    setPlayerPos({ x: 150, y: 100 });
    setIsDodging(false);
    setVisitedRooms(new Set(['classroom']));
    setDefeatedEnemies(new Set());
    setCollectedItems(new Set());
    stopMelody();
    setAudioOn(false);
  };

  const handleVol = (v: number) => { setVol(v); setVolume(v); };

  const room = ROOMS[currentRoom];

  // ===== RENDER =====
  return (
    <div
      className={`w-full h-screen bg-black flex flex-col items-center justify-center overflow-hidden select-none ${shake ? 'animate-shake' : ''}`}
      style={{ fontFamily: "'Courier New', monospace" }}
    >
      {/* Volume */}
      <div className="absolute top-2 right-2 z-50 flex items-center gap-2">
        <span className="text-yellow-400 text-xs">🔊</span>
        <input type="range" min="0" max="1" step="0.1" value={volume}
          onChange={e => handleVol(parseFloat(e.target.value))}
          className="w-16 h-2 accent-yellow-400" />
      </div>

      {/* ===== TITLE ===== */}
      {gameState === 'title' && (
        <div className="text-center cursor-pointer relative" onClick={startAudio}>
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {Array.from({ length: 20 }, (_, i) => (
              <div key={i} className="absolute w-1 h-1 bg-white rounded-full"
                style={{
                  left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
                  animation: `twinkle ${1.5 + Math.random() * 2}s ease-in-out infinite`,
                  animationDelay: `${Math.random() * 3}s`,
                }} />
            ))}
          </div>
          <div className="relative z-10">
            <div className="text-7xl mb-6" style={{ animation: 'float 3s ease-in-out infinite' }}>🏫</div>
            <h1 className="text-4xl md:text-5xl font-bold text-yellow-400 mb-2 tracking-wider"
              style={{ textShadow: '0 0 10px #ffaa00, 0 0 20px #ff6600' }}>
              BERTARUNE
            </h1>
            <p className="text-base md:text-lg text-blue-300 mb-2">✦ A School Dark World Adventure ✦</p>
            <p className="text-sm text-purple-400 mb-8 italic">"Determination fills the hallway..."</p>
            <div className="text-xs md:text-sm text-gray-400 mb-6 space-y-1">
              <p>📍 Church Gymnasium of the Teutonic Order</p>
              <p className="mt-3 text-gray-300">Party:</p>
              <div className="flex justify-center gap-2 mt-2 flex-wrap text-xs">
                <span className="text-blue-400">🧑‍🎓 Bert</span>
                <span className="text-red-400">👦 Martin</span>
                <span className="text-pink-400">👧 Kája</span>
                <span className="text-orange-400">👦 Dan</span>
                <span className="text-purple-400">😈 Matěj</span>
                <span className="text-green-400">🧒 Šíma</span>
              </div>
            </div>
            <p className="text-yellow-300 animate-bounce mt-8 text-base md:text-lg">
              ▶ Click or Press ENTER to Start ◀
            </p>
            <div className="mt-6 text-xs text-gray-600">
              <p>Arrow Keys / WASD: Move | Enter: Confirm</p>
            </div>
          </div>
        </div>
      )}

      {/* ===== INTRO ===== */}
      {gameState === 'intro' && (
        <div className="w-full max-w-2xl p-4 md:p-8 cursor-pointer"
          onClick={() => {
            playSfx('select');
            if (introIndex < STORY_INTRO.length - 1) setIntroIndex(i => i + 1);
            else setGameState('overworld');
          }}>
          <div className="border-4 border-white p-6 bg-black min-h-[160px] flex items-center">
            <p className="text-white text-sm md:text-lg leading-relaxed">{STORY_INTRO[introIndex]}</p>
          </div>
          <p className="text-gray-500 text-xs mt-4 text-center animate-pulse">
            [ Click or ENTER ] ({introIndex + 1}/{STORY_INTRO.length})
          </p>
        </div>
      )}

      {/* ===== MIDPOINT ===== */}
      {showMidpoint && (
        <div className="w-full max-w-2xl p-4 md:p-8 cursor-pointer"
          onClick={() => {
            playSfx('select');
            if (midpointIdx < midpointText.length - 1) setMidpointIdx(i => i + 1);
            else { setShowMidpoint(false); beginBattle(); }
          }}>
          <div className="border-4 border-purple-500 p-6 bg-black min-h-[160px] flex items-center">
            <p className="text-purple-200 text-sm md:text-lg leading-relaxed">{midpointText[midpointIdx]}</p>
          </div>
          <p className="text-gray-500 text-xs mt-4 text-center animate-pulse">[ Click or ENTER ]</p>
        </div>
      )}

      {/* ===== OVERWORLD ===== */}
      {gameState === 'overworld' && !showMidpoint && (
        <div className="w-full max-w-3xl p-3 md:p-4 overflow-y-auto max-h-screen">
          <div className="border-2 border-yellow-600 p-3 mb-4 relative" style={{ backgroundColor: room.bg }}>
            <h2 className="text-yellow-400 text-lg md:text-xl font-bold mb-1">📍 {room.name}</h2>
            <p className="text-gray-300 text-xs md:text-sm">{room.description}</p>
          </div>

          {room.npcs?.map((npc, i) => (
            <button key={i} onClick={() => { setDialogue(npc.dialogue); setDialogueIndex(0); playSfx('select'); }}
              className="flex items-center gap-3 p-3 border-2 border-gray-700 hover:border-yellow-400 w-full text-left transition-colors bg-gray-900 hover:bg-gray-800 mb-2">
              <span className="text-2xl md:text-3xl">{npc.sprite}</span>
              <span style={{ color: npc.color }} className="font-bold text-sm md:text-base">{npc.name}</span>
              <span className="text-gray-500 text-xs ml-auto">[Talk]</span>
            </button>
          ))}

          {room.items?.map((item, i) => {
            if (collectedItems.has(`${currentRoom}_${i}`)) return null;
            return (
              <button key={i} onClick={() => collectItem(currentRoom, i)}
                className="flex items-center gap-3 p-3 border-2 border-green-800 hover:border-green-400 w-full text-left transition-colors bg-gray-900 hover:bg-gray-800 mb-2">
                <span className="text-xl">{item.emoji}</span>
                <span className="text-green-400 text-sm">{item.name}</span>
                <span className="text-gray-500 text-xs ml-auto">[Take]</span>
              </button>
            );
          })}

          {dialogue.length > 0 && (
            <div className="border-4 border-white p-4 mt-3 bg-black cursor-pointer"
              onClick={() => {
                playSfx('select');
                if (dialogueIndex < dialogue.length - 1) setDialogueIndex(i => i + 1);
                else { setDialogue([]); setDialogueIndex(0); }
              }}>
              <p className="text-white text-sm">{dialogue[dialogueIndex]}</p>
              <p className="text-gray-500 text-xs mt-2">[Click] ({dialogueIndex + 1}/{dialogue.length})</p>
            </div>
          )}

          <div className="mt-4 border-t border-gray-700 pt-3">
            <p className="text-gray-500 text-xs mb-2">Go to:</p>
            <div className="flex flex-wrap gap-2">
              {room.exits.map((exit, i) => (
                <button key={i} onClick={() => moveToRoom(exit.roomId)}
                  className="px-3 py-2 border-2 border-blue-600 text-blue-400 hover:bg-blue-900 hover:text-white transition-colors text-xs md:text-sm">
                  {exit.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 border-2 border-gray-700 p-3 bg-gray-900">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-xl">🧑‍🎓</span>
                <div>
                  <p className="text-white font-bold text-sm">Bert <span className="text-yellow-400 text-xs">LV {player.lv}</span></p>
                  <p className="text-xs">
                    <span className="text-yellow-400">HP </span>
                    <span className={player.hp < player.maxHp * 0.3 ? 'text-red-400' : 'text-green-400'}>
                      {player.hp}/{player.maxHp}
                    </span>
                  </p>
                </div>
              </div>
              <div className="text-right text-xs text-gray-500">
                <p>ATK:{player.atk} DEF:{player.def}</p>
                <p>EXP:{player.exp} Gold:{player.gold}</p>
                <p>Items:{inventory.length}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== BATTLE ===== */}
      {gameState === 'battle' && currentEnemy && (
        <div className="w-full max-w-3xl p-3 md:p-4">
          {/* Enemy */}
          <div className="text-center mb-3 border-2 border-gray-700 p-3 md:p-4 relative overflow-hidden"
            style={{ background: `linear-gradient(180deg, ${currentEnemy.color}22 0%, #111 100%)` }}>
            <div className={`text-5xl md:text-6xl mb-2 ${fightAnim ? 'animate-bounce' : ''}`}
              style={{ filter: currentEnemy.hp < currentEnemy.maxHp * 0.3 ? 'hue-rotate(180deg) brightness(1.5)' : 'none' }}>
              {currentEnemy.sprite}
            </div>
            <h3 className="text-base md:text-xl font-bold" style={{ color: currentEnemy.color }}>{currentEnemy.name}</h3>
            <div className="mt-2 flex items-center justify-center gap-2">
              <span className="text-red-400 text-xs">HP</span>
              <div className="w-32 md:w-48 h-3 md:h-4 bg-gray-800 border border-gray-600">
                <div className="h-full bg-red-500 transition-all duration-300"
                  style={{ width: `${(currentEnemy.hp / currentEnemy.maxHp) * 100}%` }} />
              </div>
              <span className="text-gray-400 text-xs">{currentEnemy.hp}/{currentEnemy.maxHp}</span>
            </div>
            {currentEnemy.spareable && (
              <div className="mt-2">
                <div className="flex items-center justify-center gap-1">
                  <span className="text-yellow-600 text-xs">MERCY:</span>
                  <div className="w-20 h-2 bg-gray-800 border border-gray-600">
                    <div className="h-full bg-yellow-500 transition-all"
                      style={{ width: `${Math.min(100, (currentEnemy.mercyCount / currentEnemy.spareThreshold) * 100)}%` }} />
                  </div>
                </div>
                {currentEnemy.mercyCount >= currentEnemy.spareThreshold && (
                  <p className="text-yellow-400 text-xs mt-1 animate-pulse">★ SPAREABLE ★</p>
                )}
              </div>
            )}
          </div>

          {/* Battle Box */}
          <div className="relative w-full border-4 border-white bg-black mx-auto mb-3 overflow-hidden"
            style={{ maxWidth: '300px', height: '200px' }}>
            {isDodging ? (
              <>
                <div className={`absolute text-red-500 text-lg ${invincible ? 'opacity-30' : ''}`}
                  style={{ left: playerPos.x - 8, top: playerPos.y - 8, transition: 'opacity 0.1s' }}>
                  ❤
                </div>
                {bullets.map((b, i) => (
                  <div key={i} className="absolute"
                    style={{
                      left: b.x - b.size / 2, top: b.y - b.size / 2,
                      width: b.size, height: b.size,
                      backgroundColor: b.color,
                      borderRadius: b.shape === 'circle' ? '50%' : b.shape === 'diamond' ? '0' : '2px',
                      transform: b.shape === 'diamond' ? 'rotate(45deg)' : 'none',
                      boxShadow: `0 0 4px ${b.color}`,
                    }} />
                ))}
              </>
            ) : (
              <div className="p-3 h-full flex items-center justify-center relative">
                {dmgNum && (
                  <div className="absolute text-red-500 text-2xl font-bold animate-damage pointer-events-none"
                    style={{ left: '130px', top: '40px' }}>
                    {dmgNum.val}
                  </div>
                )}
                <div className="text-center">
                  {battleLog.map((log, i) => (
                    <p key={i} className="text-white text-xs md:text-sm mb-1">{log}</p>
                  ))}
                  {battlePhase === 'dialogue' && (
                    <p className="text-gray-500 text-xs mt-2 animate-pulse cursor-pointer"
                      onClick={() => { playSfx('select'); setBattlePhase('menu'); setMenuSelection(0); }}>
                      [Click/ENTER]
                    </p>
                  )}
                  {battlePhase === 'victory' && (
                    <div className="mt-3">
                      <p className="text-yellow-400 animate-pulse cursor-pointer" onClick={endBattle}>
                        [Click/ENTER to continue]
                      </p>
                      <p className="text-green-400 text-xs mt-2">
                        +{Math.floor(currentEnemy.maxHp * 0.5)} EXP | +{Math.floor(currentEnemy.maxHp * 0.3)} Gold
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Player HP */}
          <div className="mb-3 px-1">
            <div className="flex items-center gap-2">
              <span className="text-yellow-400 text-xs w-20">🧑‍🎓 Bert</span>
              <div className="flex-1 h-3 bg-gray-800 border border-gray-600">
                <div className={`h-full transition-all duration-300 ${player.hp < player.maxHp * 0.3 ? 'bg-red-500' : player.hp < player.maxHp * 0.6 ? 'bg-yellow-500' : 'bg-green-500'}`}
                  style={{ width: `${(player.hp / player.maxHp) * 100}%` }} />
              </div>
              <span className={`text-xs w-16 text-right ${player.hp < player.maxHp * 0.3 ? 'text-red-400' : 'text-green-400'}`}>
                {player.hp}/{player.maxHp}
              </span>
            </div>
          </div>

          {/* Battle Menu */}
          {!isDodging && battlePhase !== 'victory' && battlePhase !== 'dialogue' && battlePhase !== 'transition' && (
            <div className="border-2 border-yellow-600 p-3 bg-gray-900">
              {battlePhase === 'menu' && (
                <div className="flex justify-around flex-wrap gap-2">
                  {['⚔️ FIGHT', '💬 ACT', '🎒 ITEM', '💛 MERCY'].map((opt, i) => (
                    <button key={i}
                      onClick={() => {
                        playSfx('confirm');
                        setMenuSelection(i);
                        if (i === 0) doFight();
                        else if (i === 1) setBattlePhase('act');
                        else if (i === 2) setBattlePhase('item');
                        else if (i === 3) doMercy();
                      }}
                      className={`px-2 py-2 border-2 text-xs transition-all ${menuSelection === i
                        ? 'border-yellow-400 text-yellow-400 bg-yellow-900/30 scale-105'
                        : 'border-gray-600 text-gray-400 hover:border-gray-400'}`}>
                      {menuSelection === i && '❤ '}{opt}
                    </button>
                  ))}
                </div>
              )}
              {battlePhase === 'act' && currentEnemy && (
                <div className="space-y-1">
                  <button onClick={() => setBattlePhase('menu')} className="text-blue-400 hover:text-blue-200 text-xs mb-2">← Back</button>
                  {currentEnemy.acts.map((act, i) => (
                    <button key={i} onClick={() => doAct(i)}
                      className="block w-full text-left px-3 py-2 border border-gray-700 text-gray-400 hover:border-yellow-400 hover:text-yellow-400 transition-all text-sm">
                      {act}
                    </button>
                  ))}
                </div>
              )}
              {battlePhase === 'item' && (
                <div className="space-y-1">
                  <button onClick={() => setBattlePhase('menu')} className="text-blue-400 hover:text-blue-200 text-xs mb-2">← Back</button>
                  {inventory.length === 0 ? (
                    <p className="text-gray-500 text-sm px-3">No items!</p>
                  ) : inventory.map((item, i) => (
                    <button key={i} onClick={() => useItem(i)}
                      className="block w-full text-left px-3 py-2 border border-gray-700 text-gray-400 hover:border-yellow-400 hover:text-yellow-400 transition-all text-sm">
                      {item.emoji} {item.name} (+{item.healAmount}HP)
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {isDodging && (
            <p className="text-center text-gray-500 text-xs mt-2">
              Arrow Keys / WASD to dodge! ❤ = you!
            </p>
          )}

          {/* Touch controls for mobile */}
          {isDodging && (
            <div className="flex flex-col items-center gap-1 mt-3 md:hidden">
              <button onTouchStart={() => keysRef.current.add('ArrowUp')}
                onTouchEnd={() => keysRef.current.delete('ArrowUp')}
                className="w-12 h-10 bg-gray-800 border-2 border-gray-600 rounded text-white active:bg-gray-600">▲</button>
              <div className="flex gap-1">
                <button onTouchStart={() => keysRef.current.add('ArrowLeft')}
                  onTouchEnd={() => keysRef.current.delete('ArrowLeft')}
                  className="w-12 h-10 bg-gray-800 border-2 border-gray-600 rounded text-white active:bg-gray-600">◀</button>
                <div className="w-12" />
                <button onTouchStart={() => keysRef.current.add('ArrowRight')}
                  onTouchEnd={() => keysRef.current.delete('ArrowRight')}
                  className="w-12 h-10 bg-gray-800 border-2 border-gray-600 rounded text-white active:bg-gray-600">▶</button>
              </div>
              <button onTouchStart={() => keysRef.current.add('ArrowDown')}
                onTouchEnd={() => keysRef.current.delete('ArrowDown')}
                className="w-12 h-10 bg-gray-800 border-2 border-gray-600 rounded text-white active:bg-gray-600">▼</button>
            </div>
          )}
        </div>
      )}

      {/* ===== GAME OVER ===== */}
      {gameState === 'gameover' && (
        <div className="text-center cursor-pointer p-8" onClick={restartGame}>
          <div className="text-6xl mb-6 animate-bounce" style={{ animationDuration: '2s' }}>💔</div>
          <h2 className="text-3xl text-red-500 font-bold mb-4" style={{ textShadow: '0 0 20px #ff0000' }}>GAME OVER</h2>
          <div className="border-2 border-red-900 p-4 bg-black/80 max-w-sm mx-auto mb-6">
            <p className="text-gray-300 text-sm mb-2">* Bert's heart has stopped...</p>
            <p className="text-gray-400 text-sm mb-2">* But determination fills you.</p>
            <p className="text-red-400 text-sm italic">* "I can't give up. My friends need me."</p>
          </div>
          <p className="text-yellow-400 animate-pulse">[ Click or ENTER to try again ]</p>
        </div>
      )}

      {/* ===== ENDING ===== */}
      {gameState === 'ending' && (
        <div className="w-full max-w-2xl p-4 md:p-6 text-center cursor-pointer overflow-y-auto max-h-screen"
          onClick={() => { setGameState('title'); stopMelody(); }}>
          <div className="text-6xl mb-4" style={{ animation: 'float 3s ease-in-out infinite' }}>🌟</div>
          <h2 className="text-3xl text-yellow-400 font-bold mb-4"
            style={{ textShadow: '0 0 10px #ffaa00, 0 0 20px #ffaa00' }}>
            ✦ VICTORY! ✦
          </h2>
          <div className="border-4 border-yellow-600 p-4 md:p-6 bg-gray-900/95 text-left mb-4 text-sm">
            <p className="text-white mb-2">* The darkness fades from the school...</p>
            <p className="text-white mb-2">* The Principal returns to normal.</p>
            <p className="text-white mb-2">* Principal: "I... what happened? Why so many detention slips?"</p>
            <p className="text-white mb-2">* Matěj shakes off the corruption.</p>
            <p className="text-white mb-2">* Matěj: "Dude, that was WILD. Again sometime?"</p>
            <p className="text-white mb-2">* Kája: "Absolutely not. Chemistry test tomorrow."</p>
            <p className="text-white mb-2">* Martin: "I learned something today..."</p>
            <p className="text-white mb-2">* Dan: "Yeah? What?"</p>
            <p className="text-white mb-2">* Martin: "My jokes are so bad they defeat evil."</p>
            <p className="text-white mb-2">* Šíma: "The supply closet is normal again!"</p>
            <p className="text-white mb-2">* Bert smiles. Another day saved.</p>
            <p className="text-yellow-400 mt-3 text-center font-bold">✦ THE END...? ✦</p>
          </div>
          <div className="text-xs text-gray-400 mb-3 border border-gray-700 p-2 bg-black/50">
            <p>Bert LV {player.lv} | EXP: {player.exp} | Gold: {player.gold}</p>
            <p>Rooms: {visitedRooms.size}/{Object.keys(ROOMS).length} | Defeated: {defeatedEnemies.size}</p>
          </div>
          <p className="text-yellow-300 animate-pulse">[ Click or ENTER ]</p>
        </div>
      )}

      {/* Footer */}
      {gameState !== 'title' && (
        <div className="absolute bottom-1 left-2 text-xs text-gray-700 hidden md:block">
          <p>Arrows/WASD: Move | Enter: Confirm | Esc: Back</p>
        </div>
      )}
    </div>
  );
}
