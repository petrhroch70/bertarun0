import { useState, useEffect, useCallback, useRef } from 'react';
import { BERT, PARTY_MEMBERS, ENEMIES, ROOMS, STORY_INTRO, STORY_MIDPOINTS, type Enemy, type Bullet, type GameItem } from './gameData';
import { playMelody, stopMelody, playSfx, setVolume } from './audio';

type GameState = 'title' | 'intro' | 'overworld' | 'battle' | 'victory' | 'gameover' | 'ending';
type BattlePhase = 'menu' | 'fight' | 'act' | 'item' | 'mercy' | 'enemy_turn' | 'dialogue' | 'victory';

interface PlayerState {
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  lv: number;
  exp: number;
  gold: number;
}

interface PartyState {
  name: string;
  hp: number;
  maxHp: number;
  sprite: string;
  color: string;
}

function App() {
  const [gameState, setGameState] = useState<GameState>('title');
  const [introIndex, setIntroIndex] = useState(0);
  const [currentRoom, setCurrentRoom] = useState('classroom');
  const [dialogue, setDialogue] = useState<string[]>([]);
  const [dialogueIndex, setDialogueIndex] = useState(0);
  const [inventory, setInventory] = useState<GameItem[]>([]);
  const [player, setPlayer] = useState<PlayerState>({
    hp: BERT.maxHp, maxHp: BERT.maxHp, atk: BERT.atk, def: BERT.def, lv: 1, exp: 0, gold: 0,
  });
  const [party, setParty] = useState<PartyState[]>([]);
  const [currentEnemy, setCurrentEnemy] = useState<Enemy | null>(null);
  const [battlePhase, setBattlePhase] = useState<BattlePhase>('menu');
  const [menuSelection, setMenuSelection] = useState(0);
  const [battleLog, setBattleLog] = useState<string[]>([]);
  const [bullets, setBullets] = useState<Bullet[]>([]);
  const [playerPos, setPlayerPos] = useState({ x: 150, y: 100 });
  const [isDodging, setIsDodging] = useState(false);
  const [enemyTurnTimer, setEnemyTurnTimer] = useState(0);
  const [visitedRooms, setVisitedRooms] = useState<Set<string>>(new Set(['classroom']));
  const [defeatedEnemies, setDefeatedEnemies] = useState<Set<string>>(new Set());
  const [collectedItems, setCollectedItems] = useState<Set<string>>(new Set());
  const [actSelection, setActSelection] = useState(0);
  const [itemSelection, setItemSelection] = useState(0);
  const [fightAnimation, setFightAnimation] = useState(false);
  const [shakeScreen, setShakeScreen] = useState(false);
  const [damageNumber, setDamageNumber] = useState<{ value: number; x: number; y: number } | null>(null);
  const [invincible, setInvincible] = useState(false);
  const [musicStarted, setMusicStarted] = useState(false);
  const [volume, setVolumeState] = useState(0.3);
  const [showMidpoint, setShowMidpoint] = useState(false);
  const [midpointText, setMidpointText] = useState<string[]>([]);
  const [midpointIndex, setMidpointIndex] = useState(0);

  const gameLoopRef = useRef<number | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const battleBoxRef = useRef<HTMLDivElement>(null);

  // Start music
  const startMusic = useCallback(() => {
    if (!musicStarted) {
      setMusicStarted(true);
      playMelody('menu');
    }
  }, [musicStarted]);

  // Title screen
  useEffect(() => {
    if (gameState === 'title') {
      stopMelody();
    }
  }, [gameState]);

  // Battle music
  useEffect(() => {
    if (gameState === 'battle' && currentEnemy) {
      if (currentEnemy.name === "The Principal" || currentEnemy.name === "Matěj (Corrupted)") {
        playMelody('boss');
      } else {
        playMelody('battle');
      }
    }
    if (gameState === 'overworld') {
      playMelody('overworld');
    }
    if (gameState === 'victory' || gameState === 'ending') {
      playMelody('victory');
    }
  }, [gameState, currentEnemy]);

  // Keyboard handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key);
      
      if (gameState === 'title' && (e.key === 'Enter' || e.key === ' ')) {
        startMusic();
        setGameState('intro');
        playSfx('confirm');
      }
      if (gameState === 'intro' && (e.key === 'Enter' || e.key === ' ')) {
        if (introIndex < STORY_INTRO.length - 1) {
          setIntroIndex(i => i + 1);
          playSfx('select');
        } else {
          setGameState('overworld');
          playSfx('confirm');
        }
      }
      if (showMidpoint && (e.key === 'Enter' || e.key === ' ')) {
        if (midpointIndex < midpointText.length - 1) {
          setMidpointIndex(i => i + 1);
          playSfx('select');
        } else {
          setShowMidpoint(false);
          setGameState('battle');
          startBattle();
        }
      }
      if (gameState === 'overworld' && dialogue.length > 0 && (e.key === 'Enter' || e.key === ' ')) {
        if (dialogueIndex < dialogue.length - 1) {
          setDialogueIndex(i => i + 1);
          playSfx('select');
        } else {
          setDialogue([]);
          setDialogueIndex(0);
        }
      }
      if (gameState === 'battle') {
        handleBattleInput(e.key);
      }
      if (gameState === 'gameover' && (e.key === 'Enter' || e.key === ' ')) {
        restartGame();
      }
      if (gameState === 'ending' && (e.key === 'Enter' || e.key === ' ')) {
        setGameState('title');
        stopMelody();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState, introIndex, dialogue, dialogueIndex, battlePhase, menuSelection, actSelection, itemSelection, showMidpoint, midpointIndex, midpointText]);

  // Battle game loop
  useEffect(() => {
    if (gameState === 'battle' && isDodging) {
      const loop = () => {
        // Move player
        const speed = 4;
        setPlayerPos(pos => {
          let newX = pos.x;
          let newY = pos.y;
          if (keysRef.current.has('ArrowLeft') || keysRef.current.has('a')) newX -= speed;
          if (keysRef.current.has('ArrowRight') || keysRef.current.has('d')) newX += speed;
          if (keysRef.current.has('ArrowUp') || keysRef.current.has('w')) newY -= speed;
          if (keysRef.current.has('ArrowDown') || keysRef.current.has('s')) newY += speed;
          newX = Math.max(10, Math.min(290, newX));
          newY = Math.max(10, Math.min(190, newY));
          return { x: newX, y: newY };
        });

        // Move bullets
        setBullets(prev => prev.map(b => ({
          ...b,
          x: b.x + b.vx,
          y: b.y + b.vy,
        })).filter(b => b.x > -50 && b.x < 350 && b.y > -50 && b.y < 250));

        // Check collisions (with invincibility frames)
        if (!invincible) {
          setBullets(prev => {
            const hit = prev.some(b => {
              const dx = b.x - playerPos.x;
              const dy = b.y - playerPos.y;
              return Math.sqrt(dx * dx + dy * dy) < (b.size + 8);
            });
            if (hit) {
              setPlayer(p => {
                const dmg = Math.max(1, (currentEnemy?.atk || 5) - p.def);
                const newHp = Math.max(0, p.hp - dmg);
                if (newHp <= 0) {
                  // Game over
                  setIsDodging(false);
                  setBullets([]);
                  setTimeout(() => {
                    setGameState('gameover');
                    stopMelody();
                  }, 500);
                }
                return { ...p, hp: newHp };
              });
              setShakeScreen(true);
              setTimeout(() => setShakeScreen(false), 200);
              playSfx('hurt');
              // Grant invincibility frames
              setInvincible(true);
              setTimeout(() => setInvincible(false), 800);
            }
            return prev;
          });
        }

        gameLoopRef.current = requestAnimationFrame(loop);
      };
      gameLoopRef.current = requestAnimationFrame(loop);
      return () => {
        if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
      };
    }
  }, [gameState, isDodging, playerPos, currentEnemy]);

  // Enemy turn timer
  useEffect(() => {
    if (isDodging && currentEnemy) {
      const pattern = currentEnemy.attackPatterns[Math.floor(Math.random() * currentEnemy.attackPatterns.length)];
      setBullets(pattern.bullets.map(b => ({ ...b })));
      setEnemyTurnTimer(pattern.duration);
      
      const timer = setInterval(() => {
        setEnemyTurnTimer(prev => {
          if (prev <= 100) {
            clearInterval(timer);
            setIsDodging(false);
            setBullets([]);
            setBattlePhase('menu');
            setMenuSelection(0);
            return 0;
          }
          return prev - 50;
        });
      }, 50);
      
      return () => clearInterval(timer);
    }
  }, [isDodging, currentEnemy]);

  const startBattle = () => {
    const room = ROOMS[currentRoom];
    if (room.encounters && room.encounters.length > 0) {
      const enemyKey = room.encounters.find(e => !defeatedEnemies.has(`${currentRoom}_${e}`));
      if (enemyKey) {
        const enemy = { ...ENEMIES[enemyKey], mercyCount: 0 };
        setCurrentEnemy(enemy);
        setBattlePhase('menu');
        setMenuSelection(0);
        setBattleLog([enemy.dialogue[0]]);
        setPlayerPos({ x: 150, y: 100 });
        setBullets([]);
        setIsDodging(false);
        return;
      }
    }
    // No encounter, continue
    setGameState('overworld');
  };

  const handleBattleInput = (key: string) => {
    if (battlePhase === 'dialogue') {
      if (key === 'Enter' || key === ' ') {
        if (!waitingForEnemyTurn && battleLog.length > 0) {
          setBattlePhase('menu');
          setMenuSelection(0);
        }
      }
      return;
    }

    if (battlePhase === 'menu') {
      if (key === 'ArrowLeft') { setMenuSelection(s => Math.max(0, s - 1)); playSfx('select'); }
      if (key === 'ArrowRight') { setMenuSelection(s => Math.min(3, s + 1)); playSfx('select'); }
      if (key === 'Enter' || key === ' ') {
        playSfx('confirm');
        if (menuSelection === 0) { // FIGHT
          performFight();
        } else if (menuSelection === 1) { // ACT
          setBattlePhase('act');
          setActSelection(0);
        } else if (menuSelection === 2) { // ITEM
          setBattlePhase('item');
          setItemSelection(0);
        } else if (menuSelection === 3) { // MERCY
          performMercy();
        }
      }
    } else if (battlePhase === 'act') {
      if (key === 'ArrowUp') { setActSelection(s => Math.max(0, s - 1)); playSfx('select'); }
      if (key === 'ArrowDown') { setActSelection(s => Math.min((currentEnemy?.acts.length || 1) - 1, s + 1)); playSfx('select'); }
      if (key === 'Enter' || key === ' ') {
        playSfx('confirm');
        performAct(actSelection);
      }
      if (key === 'Escape') { setBattlePhase('menu'); }
    } else if (battlePhase === 'item') {
      if (key === 'ArrowUp') { setItemSelection(s => Math.max(0, s - 1)); playSfx('select'); }
      if (key === 'ArrowDown') { setItemSelection(s => Math.min(inventory.length - 1, s + 1)); playSfx('select'); }
      if (key === 'Enter' || key === ' ') {
        playSfx('confirm');
        useItem(itemSelection);
      }
      if (key === 'Escape') { setBattlePhase('menu'); }
    } else if (battlePhase === 'victory') {
      if (key === 'Enter' || key === ' ') {
        endBattle();
      }
    }
  };

  const performFight = () => {
    setFightAnimation(true);
    playSfx('attack');
    const dmg = Math.max(1, player.atk - (currentEnemy?.def || 0) + Math.floor(Math.random() * 5));
    setDamageNumber({ value: dmg, x: 150, y: 50 });
    setTimeout(() => setDamageNumber(null), 1000);
    setTimeout(() => {
      setFightAnimation(false);
      if (currentEnemy) {
        const newHp = Math.max(0, currentEnemy.hp - dmg);
        setCurrentEnemy({ ...currentEnemy, hp: newHp });
        setBattleLog([`* Bert attacks! ${dmg} damage!`]);
        if (newHp <= 0) {
          setTimeout(() => {
            setBattleLog([currentEnemy.defeatText]);
            setBattlePhase('victory');
            playSfx('confirm');
          }, 500);
        } else {
          setTimeout(() => startEnemyTurn(), 1000);
        }
      }
    }, 500);
  };

  const performAct = (index: number) => {
    if (!currentEnemy) return;
    playSfx('confirm');
    const response = currentEnemy.actResponses[index] || "* Nothing happens.";
    setBattleLog([response]);
    setBattlePhase('dialogue');
    
    // Acts can increase mercy
    if (currentEnemy.spareable) {
      setCurrentEnemy(prev => prev ? { ...prev, mercyCount: prev.mercyCount + 1 } : null);
    }
    
    // Some acts damage
    if (index === 0 || index === 2) {
      const dmg = Math.floor(player.atk * 0.5);
      if (currentEnemy) {
        const newHp = Math.max(0, currentEnemy.hp - dmg);
        setCurrentEnemy(prev => prev ? { ...prev, hp: newHp } : null);
        if (newHp <= 0) {
          setTimeout(() => {
            setBattleLog([currentEnemy.defeatText]);
            setBattlePhase('victory');
          }, 1500);
          return;
        }
      }
    }
    
    setTimeout(() => startEnemyTurn(), 1500);
  };

  const performMercy = () => {
    if (!currentEnemy) return;
    if (currentEnemy.mercyCount >= currentEnemy.spareThreshold) {
      setBattleLog([currentEnemy.spareText]);
      setBattlePhase('victory');
      playSfx('heal');
    } else {
      setBattleLog([`* You tried to spare ${currentEnemy.name}... but it's not ready yet.`, `* (Use ACT to weaken its resolve! ${currentEnemy.mercyCount}/${currentEnemy.spareThreshold})`]);
      setBattlePhase('dialogue');
      setTimeout(() => startEnemyTurn(), 2000);
    }
  };

  const useItem = (index: number) => {
    if (index >= inventory.length) return;
    const item = inventory[index];
    setPlayer(p => ({ ...p, hp: Math.min(p.maxHp, p.hp + item.healAmount) }));
    setInventory(inv => inv.filter((_, i) => i !== index));
    setBattleLog([`* Bert used ${item.emoji} ${item.name}! Healed ${item.healAmount} HP!`]);
    setBattlePhase('dialogue');
    playSfx('heal');
    setTimeout(() => startEnemyTurn(), 1500);
  };

  const [waitingForEnemyTurn, setWaitingForEnemyTurn] = useState(false);

  const startEnemyTurn = () => {
    // Show enemy dialogue before attacking
    const enemyDialogue = currentEnemy?.dialogue[Math.floor(Math.random() * (currentEnemy?.dialogue.length || 1))];
    setBattleLog([enemyDialogue || '* The enemy prepares to attack!']);
    setBattlePhase('dialogue');
    setWaitingForEnemyTurn(true);
    setTimeout(() => {
      setWaitingForEnemyTurn(false);
      setBattlePhase('enemy_turn');
      setIsDodging(true);
      setPlayerPos({ x: 150, y: 100 });
    }, 1500);
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
    
    // Check for ending
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
    setCurrentRoom(roomId);
    setVisitedRooms(prev => new Set([...prev, roomId]));
    playSfx('confirm');
    
    // Add party members when entering hallway
    if (roomId === 'hallway' && party.length === 0) {
      setParty(PARTY_MEMBERS.map(m => ({ name: m.name, hp: m.maxHp, maxHp: m.maxHp, sprite: m.sprite, color: m.color })));
    }
    
    // Check for midpoint story
    if (STORY_MIDPOINTS[roomId] && !visitedRooms.has(roomId)) {
      setMidpointText(STORY_MIDPOINTS[roomId]);
      setMidpointIndex(0);
      setShowMidpoint(true);
    } else if (ROOMS[roomId].encounters && ROOMS[roomId].encounters!.some(e => !defeatedEnemies.has(`${roomId}_${e}`))) {
      setGameState('battle');
      playSfx('attack');
      setTimeout(() => {
        const enemyKey = ROOMS[roomId].encounters!.find(e => !defeatedEnemies.has(`${roomId}_${e}`));
        if (enemyKey) {
          const enemy = { ...ENEMIES[enemyKey], mercyCount: 0 };
          setCurrentEnemy(enemy);
          setBattlePhase('menu');
          setMenuSelection(0);
          setBattleLog([enemy.dialogue[0]]);
          setPlayerPos({ x: 150, y: 100 });
          setBullets([]);
          setIsDodging(false);
        }
      }, 100);
    }
  };

  const collectItem = (room: string, index: number) => {
    const key = `${room}_${index}`;
    if (!collectedItems.has(key)) {
      const item = ROOMS[room].items![index];
      setInventory(inv => [...inv, item]);
      setCollectedItems(prev => new Set([...prev, key]));
      setDialogue([`* Found ${item.emoji} ${item.name}!`, `* ${item.description}`]);
      setDialogueIndex(0);
      playSfx('heal');
    }
  };

  const restartGame = () => {
    setGameState('title');
    setIntroIndex(0);
    setCurrentRoom('classroom');
    setDialogue([]);
    setDialogueIndex(0);
    setInventory([]);
    setPlayer({ hp: BERT.maxHp, maxHp: BERT.maxHp, atk: BERT.atk, def: BERT.def, lv: 1, exp: 0, gold: 0 });
    setParty([]);
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
    setMusicStarted(false);
  };

  const handleVolumeChange = (v: number) => {
    setVolumeState(v);
    setVolume(v);
  };

  const room = ROOMS[currentRoom];

  // RENDER
  return (
    <div className="w-full h-screen bg-black flex flex-col items-center justify-center overflow-hidden font-mono" style={{ imageRendering: 'pixelated' }}>
      {/* Volume Control */}
      <div className="absolute top-2 right-2 z-50 flex items-center gap-2">
        <span className="text-yellow-400 text-xs">🔊</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={volume}
          onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
          className="w-16 h-2 accent-yellow-400"
        />
      </div>

      {/* TITLE SCREEN */}
      {gameState === 'title' && (
        <div className="text-center cursor-pointer relative" onClick={startMusic}>
          {/* Background stars */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {Array.from({ length: 20 }, (_, i) => (
              <div
                key={i}
                className="star"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 3}s`,
                  animationDuration: `${1.5 + Math.random() * 2}s`,
                }}
              />
            ))}
          </div>
          <div className="relative z-10">
            <div className="text-7xl mb-6 animate-float">🏫</div>
            <h1 className="text-5xl font-bold text-yellow-400 mb-2 tracking-wider animate-glow" style={{ textShadow: '0 0 10px #ffaa00, 0 0 20px #ff6600, 0 0 40px #ff440066' }}>
              BERTARUNE
            </h1>
            <p className="text-lg text-blue-300 mb-2">✦ A School Dark World Adventure ✦</p>
            <p className="text-sm text-purple-400 mb-8 italic">"Determination fills the hallway..."</p>
            <div className="text-sm text-gray-400 mb-6 space-y-1">
              <p>📍 Church Gymnasium of the Teutonic Order</p>
              <p className="mt-3 text-gray-300">Party Members:</p>
              <div className="flex justify-center gap-3 mt-2 flex-wrap">
                <span className="text-blue-400">🧑‍🎓 Bert</span>
                <span className="text-red-400">👦 Martin</span>
                <span className="text-pink-400">👧 Kája</span>
                <span className="text-orange-400">👦 Dan</span>
                <span className="text-purple-400">😈 Matěj</span>
                <span className="text-green-400">🧒 Šíma</span>
              </div>
            </div>
            <p className="text-yellow-300 animate-bounce mt-8 text-lg">
              ▶ Press ENTER or Click to Start ◀
            </p>
            <div className="mt-8 text-xs text-gray-600 space-y-1">
              <p>A Deltarune-inspired parody game</p>
              <p className="text-gray-500">Arrow Keys/WASD: Move | Enter: Confirm | Click: Interact</p>
            </div>
          </div>
        </div>
      )}

      {/* INTRO */}
      {gameState === 'intro' && (
        <div className="w-full max-w-2xl p-8">
          <div className="border-4 border-white p-6 bg-black min-h-[200px] flex items-center">
            <p className="text-white text-lg leading-relaxed">
              {STORY_INTRO[introIndex]}
            </p>
          </div>
          <p className="text-gray-500 text-sm mt-4 text-center animate-pulse">
            [ Press ENTER to continue... ] ({introIndex + 1}/{STORY_INTRO.length})
          </p>
        </div>
      )}

      {/* MIDPOINT STORY */}
      {showMidpoint && (
        <div className="w-full max-w-2xl p-8">
          <div className="border-4 border-purple-500 p-6 bg-black min-h-[200px] flex items-center">
            <p className="text-purple-200 text-lg leading-relaxed">
              {midpointText[midpointIndex]}
            </p>
          </div>
          <p className="text-gray-500 text-sm mt-4 text-center animate-pulse">
            [ Press ENTER to continue... ]
          </p>
        </div>
      )}

      {/* OVERWORLD */}
      {gameState === 'overworld' && !showMidpoint && (
        <div className="w-full max-w-3xl p-4 relative">
          {/* Background atmosphere */}
          <div className="absolute inset-0 pointer-events-none opacity-20" style={{ background: `radial-gradient(ellipse at center, ${room.bg} 0%, transparent 70%)` }} />
          
          {/* Room Header */}
          <div className="border-2 border-yellow-600 p-4 mb-4 relative overflow-hidden" style={{ backgroundColor: room.bg }}>
            {/* Room particles */}
            <div className="absolute inset-0 opacity-20">
              {Array.from({ length: 4 }, (_, i) => (
                <div
                  key={i}
                  className="absolute rounded-full bg-yellow-400"
                  style={{
                    width: 2,
                    height: 2,
                    left: `${20 + i * 20}%`,
                    top: `${30 + Math.sin(i * 2) * 20}%`,
                    animation: `twinkle ${2 + i * 0.5}s ease-in-out infinite`,
                  }}
                />
              ))}
            </div>
            <h2 className="text-yellow-400 text-xl font-bold mb-2 relative z-10">📍 {room.name}</h2>
            <p className="text-gray-300 text-sm relative z-10">{room.description}</p>
          </div>

          {/* NPCs */}
          {room.npcs && room.npcs.map((npc, i) => (
            <div key={i} className="mb-3">
              <button
                onClick={() => { setDialogue(npc.dialogue); setDialogueIndex(0); playSfx('select'); }}
                className="flex items-center gap-3 p-3 border-2 border-gray-700 hover:border-yellow-400 w-full text-left transition-colors bg-gray-900 hover:bg-gray-800"
              >
                <span className="text-3xl">{npc.sprite}</span>
                <span style={{ color: npc.color }} className="font-bold">{npc.name}</span>
                <span className="text-gray-500 text-sm ml-auto">[Talk]</span>
              </button>
            </div>
          ))}

          {/* Items */}
          {room.items && room.items.map((item, i) => {
            const key = `${currentRoom}_${i}`;
            if (collectedItems.has(key)) return null;
            return (
              <button
                key={i}
                onClick={() => collectItem(currentRoom, i)}
                className="flex items-center gap-3 p-3 border-2 border-green-800 hover:border-green-400 w-full text-left transition-colors bg-gray-900 hover:bg-gray-800 mb-3"
              >
                <span className="text-2xl">{item.emoji}</span>
                <span className="text-green-400">{item.name}</span>
                <span className="text-gray-500 text-sm ml-auto">[Take]</span>
              </button>
            );
          })}

          {/* Dialogue Box */}
          {dialogue.length > 0 && (
            <div className="border-4 border-white p-4 mt-4 bg-black">
              <p className="text-white">{dialogue[dialogueIndex]}</p>
              <p className="text-gray-500 text-xs mt-2">[ENTER to continue] ({dialogueIndex + 1}/{dialogue.length})</p>
            </div>
          )}

          {/* Exits */}
          <div className="mt-6 border-t border-gray-700 pt-4">
            <p className="text-gray-500 text-sm mb-2">Go to:</p>
            <div className="flex flex-wrap gap-2">
              {room.exits.map((exit, i) => (
                <button
                  key={i}
                  onClick={() => moveToRoom(exit.roomId)}
                  className="px-4 py-2 border-2 border-blue-600 text-blue-400 hover:bg-blue-900 hover:text-white transition-colors"
                >
                  {exit.label}
                </button>
              ))}
            </div>
          </div>

          {/* Player Stats */}
          <div className="mt-6 border-2 border-gray-700 p-3 bg-gray-900">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{BERT.sprite}</span>
                <div>
                  <p className="text-white font-bold">{BERT.name} <span className="text-yellow-400 text-sm">LV {player.lv}</span></p>
                  <p className="text-sm">
                    <span className="text-yellow-400">HP</span>{' '}
                    <span className={player.hp < player.maxHp * 0.3 ? 'text-red-400' : 'text-green-400'}>
                      {player.hp}/{player.maxHp}
                    </span>
                    {' '}{party.map(p => (
                      <span key={p.name} className="ml-2">
                        <span className="text-gray-500">{p.sprite}</span>
                        <span style={{ color: p.color }}>{p.hp}/{p.maxHp}</span>
                      </span>
                    ))}
                  </p>
                </div>
              </div>
              <div className="text-right text-xs text-gray-500">
                <p>ATK: {player.atk} | DEF: {player.def}</p>
                <p>EXP: {player.exp} | Gold: {player.gold}</p>
                <p>Items: {inventory.length}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BATTLE */}
      {gameState === 'battle' && currentEnemy && (
        <div className={`w-full max-w-3xl p-4 ${shakeScreen ? 'animate-shake' : ''}`}>
          {/* Enemy Display */}
          <div className="text-center mb-4 border-2 border-gray-700 p-4 relative overflow-hidden" style={{ background: `linear-gradient(180deg, ${currentEnemy.color}11 0%, #111 100%)` }}>
            {/* Background particles */}
            <div className="absolute inset-0 opacity-30">
              {Array.from({ length: 6 }, (_, i) => (
                <div
                  key={i}
                  className="absolute rounded-full"
                  style={{
                    width: 3 + Math.random() * 4,
                    height: 3 + Math.random() * 4,
                    backgroundColor: currentEnemy.color,
                    left: `${10 + i * 15}%`,
                    top: `${20 + Math.sin(i) * 30}%`,
                    animation: `twinkle ${1.5 + i * 0.3}s ease-in-out infinite`,
                    animationDelay: `${i * 0.2}s`,
                  }}
                />
              ))}
            </div>
            <div className={`text-6xl mb-2 relative z-10 ${fightAnimation ? 'animate-bounce' : ''} ${shakeScreen ? 'animate-flash' : ''}`} style={{ filter: currentEnemy.hp < currentEnemy.maxHp * 0.3 ? 'hue-rotate(180deg) brightness(1.5)' : 'none', transition: 'filter 0.3s' }}>
              {currentEnemy.sprite}
            </div>
            <h3 className="text-xl font-bold" style={{ color: currentEnemy.color }}>{currentEnemy.name}</h3>
            <div className="mt-2 flex items-center justify-center gap-2">
              <span className="text-red-400 text-sm">HP</span>
              <div className="w-48 h-4 bg-gray-800 border border-gray-600">
                <div
                  className="h-full bg-red-500 transition-all duration-300"
                  style={{ width: `${(currentEnemy.hp / currentEnemy.maxHp) * 100}%` }}
                />
              </div>
              <span className="text-gray-400 text-sm">{currentEnemy.hp}/{currentEnemy.maxHp}</span>
            </div>
            {currentEnemy.spareable && (
              <div className="mt-2">
                <div className="flex items-center justify-center gap-1">
                  <span className="text-yellow-600 text-xs">MERCY:</span>
                  <div className="w-24 h-2 bg-gray-800 border border-gray-600">
                    <div
                      className="h-full bg-yellow-500 transition-all duration-300"
                      style={{ width: `${Math.min(100, (currentEnemy.mercyCount / currentEnemy.spareThreshold) * 100)}%` }}
                    />
                  </div>
                  <span className="text-yellow-600 text-xs">{currentEnemy.mercyCount}/{currentEnemy.spareThreshold}</span>
                </div>
                {currentEnemy.mercyCount >= currentEnemy.spareThreshold && (
                  <p className="text-yellow-400 text-sm mt-1 animate-pulse animate-spare-glow">★ SPAREABLE ★</p>
                )}
              </div>
            )}
          </div>

          {/* Battle Box (Bullet Hell Area) */}
          <div
            ref={battleBoxRef}
            className="relative w-full h-[200px] border-4 border-white bg-black mx-auto mb-4 overflow-hidden"
            style={{ maxWidth: '300px' }}
          >
            {isDodging ? (
              <>
                {/* Player Heart */}
                <div
                  className={`absolute text-red-500 text-lg ${invincible ? 'opacity-30' : 'opacity-100'}`}
                  style={{ left: playerPos.x - 8, top: playerPos.y - 8, transition: 'opacity 0.1s' }}
                >
                  ❤
                </div>
                {/* Bullets */}
                {bullets.map((b, i) => (
                  <div
                    key={i}
                    className="absolute"
                    style={{
                      left: b.x - b.size / 2,
                      top: b.y - b.size / 2,
                      width: b.size,
                      height: b.size,
                      backgroundColor: b.color,
                      borderRadius: b.shape === 'circle' ? '50%' : b.shape === 'diamond' ? '0' : '2px',
                      transform: b.shape === 'diamond' ? 'rotate(45deg)' : 'none',
                      boxShadow: `0 0 4px ${b.color}`,
                    }}
                  />
                ))}
                {/* Timer bar */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-800">
                  <div
                    className="h-full bg-blue-400 transition-all"
                    style={{ width: `${(enemyTurnTimer / 5000) * 100}%` }}
                  />
                </div>
              </>
            ) : (
              /* Battle Log */
              <div className="p-3 h-full flex items-center justify-center relative">
                {/* Damage number */}
                {damageNumber && (
                  <div
                    className="absolute text-red-500 text-2xl font-bold animate-damage pointer-events-none"
                    style={{ left: damageNumber.x - 15, top: damageNumber.y }}
                  >
                    {damageNumber.value}
                  </div>
                )}
                <div className="text-center">
                  {battleLog.map((log, i) => (
                    <p key={i} className="text-white text-sm mb-1">{log}</p>
                  ))}
                  {battlePhase === 'dialogue' && (
                    <p className="text-gray-500 text-xs mt-2 animate-pulse cursor-pointer" onClick={() => handleBattleInput('Enter')}>[Click or ENTER to continue]</p>
                  )}
                  {battlePhase === 'victory' && (
                    <div className="mt-4">
                      <p className="text-yellow-400 animate-pulse cursor-pointer" onClick={() => endBattle()}>[Click or ENTER to continue]</p>
                      <p className="text-green-400 text-sm mt-2">
                        +{Math.floor(currentEnemy.maxHp * 0.5)} EXP | +{Math.floor(currentEnemy.maxHp * 0.3)} Gold
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Party HP */}
          <div className="mb-3 px-2 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-yellow-400 text-sm w-16">{BERT.sprite} {BERT.name}</span>
              <div className="flex-1 h-4 bg-gray-800 border border-gray-600 relative">
                <div
                  className={`h-full transition-all duration-300 ${player.hp < player.maxHp * 0.3 ? 'bg-red-500' : player.hp < player.maxHp * 0.6 ? 'bg-yellow-500' : 'bg-green-500'}`}
                  style={{ width: `${(player.hp / player.maxHp) * 100}%` }}
                />
              </div>
              <span className={`text-sm w-20 text-right ${player.hp < player.maxHp * 0.3 ? 'text-red-400' : 'text-green-400'}`}>
                {player.hp}/{player.maxHp}
              </span>
            </div>
            {party.map(p => (
              <div key={p.name} className="flex items-center gap-2">
                <span className="text-sm w-16" style={{ color: p.color }}>{p.sprite} {p.name}</span>
                <div className="flex-1 h-3 bg-gray-800 border border-gray-700">
                  <div className="h-full bg-green-500 transition-all duration-300" style={{ width: `${(p.hp / p.maxHp) * 100}%` }} />
                </div>
                <span className="text-green-400 text-sm w-20 text-right">{p.hp}/{p.maxHp}</span>
              </div>
            ))}
          </div>

          {/* Battle Menu */}
          {!isDodging && battlePhase !== 'victory' && battlePhase !== 'dialogue' && (
            <div className="border-2 border-yellow-600 p-3 bg-gray-900">
              {battlePhase === 'menu' && (
                <div className="flex justify-around flex-wrap gap-2">
                  {['⚔️ FIGHT', '💬 ACT', '🎒 ITEM', '💛 MERCY'].map((option, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setMenuSelection(i);
                        playSfx('confirm');
                        if (i === 0) performFight();
                        else if (i === 1) { setBattlePhase('act'); setActSelection(0); }
                        else if (i === 2) { setBattlePhase('item'); setItemSelection(0); }
                        else if (i === 3) performMercy();
                      }}
                      className={`px-3 py-2 border-2 text-xs sm:text-sm transition-all ${
                        menuSelection === i
                          ? 'border-yellow-400 text-yellow-400 bg-yellow-900/30 scale-110'
                          : 'border-gray-600 text-gray-400 hover:border-gray-400 hover:text-gray-200'
                      }`}
                    >
                      {menuSelection === i && '❤ '}{option}
                    </button>
                  ))}
                </div>
              )}
              {battlePhase === 'act' && currentEnemy && (
                <div className="space-y-1">
                  <p className="text-gray-500 text-xs mb-2">
                    <button onClick={() => setBattlePhase('menu')} className="text-blue-400 hover:text-blue-200">← Back</button>
                  </p>
                  {currentEnemy.acts.map((act, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setActSelection(i);
                        playSfx('confirm');
                        performAct(i);
                      }}
                      className={`block w-full text-left px-3 py-2 border transition-all ${
                        actSelection === i
                          ? 'border-yellow-400 text-yellow-400 bg-yellow-900/30'
                          : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
                      }`}
                    >
                      {actSelection === i ? '❤ ' : '  '}{act}
                    </button>
                  ))}
                </div>
              )}
              {battlePhase === 'item' && (
                <div className="space-y-1">
                  <p className="text-gray-500 text-xs mb-2">
                    <button onClick={() => setBattlePhase('menu')} className="text-blue-400 hover:text-blue-200">← Back</button>
                  </p>
                  {inventory.length === 0 ? (
                    <p className="text-gray-500 px-3">No items! Find some in the overworld.</p>
                  ) : (
                    inventory.map((item, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setItemSelection(i);
                          playSfx('confirm');
                          useItem(i);
                        }}
                        className={`block w-full text-left px-3 py-2 border transition-all ${
                          itemSelection === i
                            ? 'border-yellow-400 text-yellow-400 bg-yellow-900/30'
                            : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
                        }`}
                      >
                        {itemSelection === i ? '❤ ' : '  '}{item.emoji} {item.name} (+{item.healAmount}HP)
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* Controls hint */}
          {isDodging && (
            <p className="text-center text-gray-500 text-xs mt-2">
              Use Arrow Keys or WASD to dodge! ❤ is your heart!
            </p>
          )}
        </div>
      )}

      {/* GAME OVER */}
      {gameState === 'gameover' && (
        <div className="text-center cursor-pointer">
          <div className="relative">
            {/* Dark vignette */}
            <div className="absolute inset-0 bg-gradient-radial from-transparent to-black/80 pointer-events-none" />
            <div className="text-7xl mb-6 animate-bounce" style={{ animationDuration: '2s' }}>💔</div>
            <h2 className="text-4xl text-red-500 font-bold mb-4" style={{ textShadow: '0 0 20px #ff0000' }}>
              GAME OVER
            </h2>
            <div className="border-2 border-red-900 p-4 bg-black/80 max-w-md mx-auto mb-6">
              <p className="text-gray-300 mb-2">* Bert's heart has stopped...</p>
              <p className="text-gray-400 mb-2">* But you can feel determination filling you.</p>
              <p className="text-red-400 italic">* "I can't give up. My friends are counting on me."</p>
            </div>
            <p className="text-yellow-400 animate-pulse text-lg">[ Press ENTER or Click to try again ]</p>
          </div>
        </div>
      )}

      {/* ENDING */}
      {gameState === 'ending' && (
        <div className="w-full max-w-2xl p-6 text-center cursor-pointer relative overflow-y-auto max-h-screen">
          {/* Celebration particles */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {Array.from({ length: 15 }, (_, i) => (
              <div
                key={i}
                className="absolute text-2xl"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animation: `float ${2 + Math.random() * 3}s ease-in-out infinite`,
                  animationDelay: `${Math.random() * 2}s`,
                }}
              >
                {['✨', '⭐', '🌟', '💫'][i % 4]}
              </div>
            ))}
          </div>
          
          <div className="relative z-10">
            <div className="text-7xl mb-4 animate-float">🌟</div>
            <h2 className="text-4xl text-yellow-400 font-bold mb-6 animate-glow" style={{ textShadow: '0 0 10px #ffaa00, 0 0 20px #ffaa00' }}>
              ✦ VICTORY! ✦
            </h2>
            <div className="border-4 border-yellow-600 p-6 bg-gray-900/95 text-left mb-6">
              <p className="text-white mb-3">* The darkness fades from the school...</p>
              <p className="text-white mb-3">* The Principal returns to normal, adjusting their glasses.</p>
              <p className="text-white mb-3">* Principal: "I... what happened? Why do I have so many detention slips?"</p>
              <p className="text-white mb-3">* Matěj shakes off the last of the corruption.</p>
              <p className="text-white mb-3">* Matěj: "Dude, that was WILD. Can we do it again sometime?"</p>
              <p className="text-white mb-3">* Kája: "Absolutely not. I have a chemistry test tomorrow."</p>
              <p className="text-white mb-3">* Martin: "I think I learned something today..."</p>
              <p className="text-white mb-3">* Dan: "Yeah? What?"</p>
              <p className="text-white mb-3">* Martin: "That my jokes are so bad they can defeat evil."</p>
              <p className="text-white mb-3">* Everyone laughs.</p>
              <p className="text-white mb-3">* Šíma: "Guys! The supply closet is normal again!"</p>
              <p className="text-white mb-3">* Bert smiles. Another day saved at the Church Gymnasium.</p>
              <p className="text-white mb-3">* But deep down... you know the Dark World isn't gone forever.</p>
              <p className="text-yellow-400 mt-4 text-center font-bold">✦ THE END...? ✦</p>
            </div>
            <div className="text-sm text-gray-400 mb-4 space-y-1 border border-gray-700 p-3 bg-black/50">
              <p className="text-yellow-400 font-bold mb-2">📊 Adventure Stats:</p>
              <p>Bert LV {player.lv} | EXP: {player.exp} | Gold: {player.gold}</p>
              <p>Rooms explored: {visitedRooms.size}/{Object.keys(ROOMS).length}</p>
              <p>Enemies defeated: {defeatedEnemies.size}</p>
              <p>Items collected: {collectedItems.size}</p>
            </div>
            <p className="text-yellow-300 animate-pulse text-lg">[ Press ENTER or Click to return to title ]</p>
          </div>
        </div>
      )}

      {/* Touch Controls for Mobile */}
      {(gameState === 'battle' && isDodging) && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 z-40 md:hidden">
          <button
            onTouchStart={() => keysRef.current.add('ArrowUp')}
            onTouchEnd={() => keysRef.current.delete('ArrowUp')}
            className="w-12 h-12 bg-gray-800 border-2 border-gray-600 rounded text-white text-xl active:bg-gray-600"
          >▲</button>
          <div className="flex gap-1">
            <button
              onTouchStart={() => keysRef.current.add('ArrowLeft')}
              onTouchEnd={() => keysRef.current.delete('ArrowLeft')}
              className="w-12 h-12 bg-gray-800 border-2 border-gray-600 rounded text-white text-xl active:bg-gray-600"
            >◀</button>
            <div className="w-12 h-12" />
            <button
              onTouchStart={() => keysRef.current.add('ArrowRight')}
              onTouchEnd={() => keysRef.current.delete('ArrowRight')}
              className="w-12 h-12 bg-gray-800 border-2 border-gray-600 rounded text-white text-xl active:bg-gray-600"
            >▶</button>
          </div>
          <button
            onTouchStart={() => keysRef.current.add('ArrowDown')}
            onTouchEnd={() => keysRef.current.delete('ArrowDown')}
            className="w-12 h-12 bg-gray-800 border-2 border-gray-600 rounded text-white text-xl active:bg-gray-600"
          >▼</button>
        </div>
      )}

      {/* Clickable overlays for intro/ending */}
      {gameState === 'intro' && (
        <div
          className="absolute inset-0 z-30 cursor-pointer"
          onClick={() => {
            if (introIndex < STORY_INTRO.length - 1) {
              setIntroIndex(i => i + 1);
              playSfx('select');
            } else {
              setGameState('overworld');
              playSfx('confirm');
            }
          }}
        />
      )}
      {showMidpoint && (
        <div
          className="absolute inset-0 z-30 cursor-pointer"
          onClick={() => {
            if (midpointIndex < midpointText.length - 1) {
              setMidpointIndex(i => i + 1);
              playSfx('select');
            } else {
              setShowMidpoint(false);
              setGameState('battle');
              startBattle();
            }
          }}
        />
      )}
      {gameState === 'gameover' && (
        <div className="absolute inset-0 z-30 cursor-pointer" onClick={restartGame} />
      )}
      {gameState === 'ending' && (
        <div className="absolute inset-0 z-30 cursor-pointer" onClick={() => { setGameState('title'); stopMelody(); }} />
      )}

      {/* Footer controls */}
      {gameState !== 'title' && (
        <div className="absolute bottom-2 left-2 text-xs text-gray-700 hidden md:block">
          <p>Arrow Keys/WASD: Move | Enter: Confirm | ESC: Back</p>
        </div>
      )}
    </div>
  );
}

export default App;
