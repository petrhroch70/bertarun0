import { useState, useEffect, useRef } from 'react';
import { ENEMIES, ROOMS, STORY_INTRO, STORY_MIDPOINTS } from './gameData';
import type { Enemy, Bullet, GameItem } from './gameData';
// Audio is handled inline below

// ===== AUDIO (simple, optional) =====
let audioCtx: AudioContext | null = null;
let melodyTimer: number | null = null;
let audioGain: GainNode | null = null;

function initAudioCtx() {
  if (audioCtx) return;
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    audioCtx = new AC();
    audioGain = audioCtx.createGain();
    audioGain.connect(audioCtx.destination);
    audioGain.gain.value = 0.25;
  } catch (e) { /* audio not available */ }
}

function beep(freq: number, dur: number, type: OscillatorType = 'square') {
  if (!audioCtx || !audioGain) return;
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.2, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + dur);
    osc.connect(g);
    g.connect(audioGain);
    osc.start();
    osc.stop(audioCtx.currentTime + dur);
  } catch (e) { /* ignore */ }
}

const MELODIES: Record<string, number[]> = {
  menu: [330, 392, 440, 523, 440, 392, 330, 294],
  overworld: [262, 294, 330, 349, 392, 349, 330, 294],
  battle: [392, 392, 440, 392, 523, 494, 392, 440],
  boss: [196, 233, 262, 196, 233, 262, 330, 294],
  victory: [523, 523, 523, 523, 659, 659, 784, 784],
};

function playMelody(name: string) {
  stopMelody();
  const notes = MELODIES[name];
  if (!notes) return;
  let i = 0;
  const play = () => {
    beep(notes[i % notes.length], 0.15, 'square');
    i++;
    melodyTimer = window.setTimeout(play, 200);
  };
  play();
}

function stopMelody() {
  if (melodyTimer) { clearTimeout(melodyTimer); melodyTimer = null; }
}

function sfx(name: string) {
  if (!audioCtx) return;
  switch (name) {
    case 'select': beep(440, 0.05); break;
    case 'confirm': beep(523, 0.05); setTimeout(() => beep(659, 0.05), 50); break;
    case 'hurt': beep(200, 0.1, 'sawtooth'); break;
    case 'heal': beep(523, 0.1, 'sine'); setTimeout(() => beep(784, 0.1, 'sine'), 100); break;
    case 'attack': beep(300, 0.05, 'sawtooth'); setTimeout(() => beep(600, 0.05, 'sawtooth'), 50); break;
  }
}

// ===== TYPES =====
type Screen = 'title' | 'intro' | 'overworld' | 'battle' | 'gameover' | 'ending';
type BPhase = 'menu' | 'act' | 'item' | 'enemy' | 'dialogue' | 'victory' | 'wait';

// ===== MAIN =====
export default function App() {
  const [screen, setScreen] = useState<Screen>('title');
  const [introIdx, setIntroIdx] = useState(0);
  const [room, setRoom] = useState('classroom');
  const [dlg, setDlg] = useState<string[]>([]);
  const [dlgIdx, setDlgIdx] = useState(0);
  const [inv, setInv] = useState<GameItem[]>([]);
  const [hp, setHp] = useState(92);
  const [lv, setLv] = useState(1);
  const [exp, setExp] = useState(0);
  const [gold, setGold] = useState(0);
  const [enemy, setEnemy] = useState<Enemy | null>(null);
  const [bp, setBp] = useState<BPhase>('menu');
  const [menuSel, setMenuSel] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [bullets, setBullets] = useState<Bullet[]>([]);
  const [pos, setPos] = useState({ x: 150, y: 100 });
  const [dodging, setDodging] = useState(false);
  const [visited, setVisited] = useState<Set<string>>(new Set(['classroom']));
  const [defeated, setDefeated] = useState<Set<string>>(new Set());
  const [collected, setCollected] = useState<Set<string>>(new Set());
  const [shake, setShake] = useState(false);
  const [invincible, setInvincible] = useState(false);
  const [midpoint, setMidpoint] = useState(false);
  const [midIdx, setMidIdx] = useState(0);
  const [midText, setMidText] = useState<string[]>([]);
  const [audioStarted, setAudioStarted] = useState(false);

  // Refs for game loop
  const keys = useRef(new Set<string>());
  const dodgingRef = useRef(false);
  const posRef = useRef(pos);
  const invRef = useRef(false);
  const enemyRef = useRef(enemy);

  useEffect(() => { dodgingRef.current = dodging; }, [dodging]);
  useEffect(() => { posRef.current = pos; }, [pos]);
  useEffect(() => { invRef.current = invincible; }, [invincible]);
  useEffect(() => { enemyRef.current = enemy; }, [enemy]);

  // Keyboard - stable handler using ref (ref is assigned after handleEnter is defined)
  const handleEnterRef = useRef<() => void>(() => {});

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys.current.add(e.key);
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleEnterRef.current();
      }
      if (e.key === 'Escape') {
        setBp(prev => (prev === 'act' || prev === 'item') ? 'menu' : prev);
      }
      if (e.key === 'ArrowLeft') setMenuSel(s => Math.max(0, s - 1));
      if (e.key === 'ArrowRight') setMenuSel(s => Math.min(3, s + 1));
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  // Game loop
  useEffect(() => {
    if (!dodging) return;
    let raf = 0;
    const loop = () => {
      if (!dodgingRef.current) return;
      // Move
      const sp = 4;
      const k = keys.current;
      setPos(p => {
        let x = p.x, y = p.y;
        if (k.has('ArrowLeft') || k.has('a')) x -= sp;
        if (k.has('ArrowRight') || k.has('d')) x += sp;
        if (k.has('ArrowUp') || k.has('w')) y -= sp;
        if (k.has('ArrowDown') || k.has('s')) y += sp;
        return { x: Math.max(10, Math.min(290, x)), y: Math.max(10, Math.min(190, y)) };
      });
      // Move bullets
      setBullets(bs => bs.map(b => ({ ...b, x: b.x + b.vx, y: b.y + b.vy }))
        .filter(b => b.x > -50 && b.x < 350 && b.y > -50 && b.y < 250));
      // Collision
      if (!invRef.current) {
        const p = posRef.current;
        setBullets(bs => {
          const hit = bs.some(b => {
            const dx = b.x - p.x, dy = b.y - p.y;
            return Math.sqrt(dx * dx + dy * dy) < (b.size + 8);
          });
          if (hit) {
            const en = enemyRef.current;
            const dmg = Math.max(1, (en?.atk || 5) - 8);
            setHp(h => {
              const nh = Math.max(0, h - dmg);
              if (nh <= 0) {
                setDodging(false);
                setBullets([]);
                setTimeout(() => { stopMelody(); setScreen('gameover'); }, 300);
              }
              return nh;
            });
            setShake(true);
            setTimeout(() => setShake(false), 200);
            sfx('hurt');
            setInvincible(true);
            setTimeout(() => setInvincible(false), 800);
          }
          return bs;
        });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [dodging]);

  // Music
  useEffect(() => {
    if (!audioStarted) return;
    if (screen === 'title') stopMelody();
    else if (screen === 'battle' && enemy) {
      if (enemy.name.includes('Principal') || enemy.name.includes('Matěj')) playMelody('boss');
      else playMelody('battle');
    } else if (screen === 'overworld') playMelody('overworld');
    else if (screen === 'ending') playMelody('victory');
  }, [screen, enemy, audioStarted]);

  // ===== ACTIONS =====
  const startAudio = () => {
    if (!audioStarted) {
      initAudioCtx();
      setAudioStarted(true);
      playMelody('menu');
    }
  };

  const handleEnter = () => {
    if (screen === 'title') { startAudio(); setScreen('intro'); sfx('confirm'); }
    else if (screen === 'intro') {
      sfx('select');
      if (introIdx < STORY_INTRO.length - 1) setIntroIdx(i => i + 1);
      else setScreen('overworld');
    }
    else if (screen === 'overworld' && dlg.length > 0) {
      sfx('select');
      if (dlgIdx < dlg.length - 1) setDlgIdx(i => i + 1);
      else { setDlg([]); setDlgIdx(0); }
    }
    else if (midpoint) {
      sfx('select');
      if (midIdx < midText.length - 1) setMidIdx(i => i + 1);
      else { setMidpoint(false); startBattle(); }
    }
    else if (screen === 'battle') {
      if (bp === 'dialogue') { sfx('select'); setBp('menu'); setMenuSel(0); }
      else if (bp === 'victory') endBattle();
      else if (bp === 'menu') {
        sfx('confirm');
        if (menuSel === 0) doFight();
        else if (menuSel === 1) setBp('act');
        else if (menuSel === 2) setBp('item');
        else if (menuSel === 3) doMercy();
      }
    }
    else if (screen === 'gameover') restart();
    else if (screen === 'ending') { setScreen('title'); stopMelody(); }
  };
  handleEnterRef.current = handleEnter;

  const doFight = () => {
    if (!enemy) return;
    sfx('attack');
    const dmg = Math.max(1, 12 - enemy.def + Math.floor(Math.random() * 5));
    const newHp = Math.max(0, enemy.hp - dmg);
    setEnemy({ ...enemy, hp: newHp });
    setLog([`* Bert attacks! ${dmg} damage!`]);
    if (newHp <= 0) {
      setTimeout(() => { setLog([enemy.defeatText]); setBp('victory'); sfx('confirm'); }, 600);
    } else {
      setTimeout(() => enemyTurn(), 1000);
    }
  };

  const doAct = (idx: number) => {
    if (!enemy) return;
    sfx('confirm');
    setLog([enemy.actResponses[idx] || '* Nothing happens.']);
    setBp('dialogue');
    if (enemy.spareable) setEnemy(prev => prev ? { ...prev, mercyCount: prev.mercyCount + 1 } : null);
    if (idx === 0 || idx === 2) {
      const dmg = Math.floor(12 * 0.5);
      const newHp = Math.max(0, enemy.hp - dmg);
      setEnemy(prev => prev ? { ...prev, hp: newHp } : null);
      if (newHp <= 0) {
        setTimeout(() => { setLog([enemy.defeatText]); setBp('victory'); }, 1200);
        return;
      }
    }
    setTimeout(() => enemyTurn(), 1500);
  };

  const doMercy = () => {
    if (!enemy) return;
    if (enemy.mercyCount >= enemy.spareThreshold) {
      setLog([enemy.spareText]);
      setBp('victory');
      sfx('heal');
    } else {
      setLog([`* Not ready yet. (${enemy.mercyCount}/${enemy.spareThreshold})`]);
      setBp('dialogue');
      setTimeout(() => enemyTurn(), 1500);
    }
  };

  const useItem = (idx: number) => {
    if (idx >= inv.length) return;
    const item = inv[idx];
    setHp(h => Math.min(92, h + item.healAmount));
    setInv(arr => arr.filter((_, i) => i !== idx));
    setLog([`* Used ${item.emoji} ${item.name}! +${item.healAmount} HP`]);
    setBp('dialogue');
    sfx('heal');
    setTimeout(() => enemyTurn(), 1200);
  };

  const enemyTurn = () => {
    if (!enemy) return;
    setBp('wait');
    const d = enemy.dialogue[Math.floor(Math.random() * enemy.dialogue.length)];
    setLog([d]);
    setTimeout(() => {
      const pat = enemy.attackPatterns[Math.floor(Math.random() * enemy.attackPatterns.length)];
      setBullets(pat.bullets.map(b => ({ ...b })));
      setPos({ x: 150, y: 100 });
      setDodging(true);
      setBp('enemy');
      setTimeout(() => {
        setDodging(false);
        setBullets([]);
        setBp('menu');
        setMenuSel(0);
      }, pat.duration);
    }, 1000);
  };

  const startBattle = () => {
    const r = ROOMS[room];
    if (r.encounters) {
      const ek = r.encounters.find(e => !defeated.has(`${room}_${e}`));
      if (ek) {
        const en = { ...ENEMIES[ek], mercyCount: 0 };
        setEnemy(en);
        setBp('menu');
        setMenuSel(0);
        setLog([en.dialogue[0]]);
        setPos({ x: 150, y: 100 });
        setBullets([]);
        setDodging(false);
        setScreen('battle');
        sfx('attack');
        return;
      }
    }
    setScreen('overworld');
  };

  const endBattle = () => {
    if (enemy) {
      setDefeated(prev => new Set([...prev, `${room}_${enemy.name}`]));
      const eg = Math.floor(enemy.maxHp * 0.5);
      const gg = Math.floor(enemy.maxHp * 0.3);
      setExp(e => e + eg);
      setGold(g => g + gg);
      if (exp + eg >= lv * 30) setLv(l => l + 1);
    }
    if (room === 'darkroom') setScreen('ending');
    else setScreen('overworld');
    setEnemy(null);
    setLog([]);
    setBullets([]);
    setDodging(false);
  };

  const goToRoom = (id: string) => {
    if (id === 'hallway' && !visited.has('hallway')) {
      setDlg([
        "* Martin and Kája join your party!",
        "* Martin: 'Dude, this is either awesome or terrifying.'",
        "* Kája: 'Statistically? Both.'",
      ]);
      setDlgIdx(0);
    }
    setRoom(id);
    setVisited(prev => new Set([...prev, id]));
    sfx('confirm');
    if (STORY_MIDPOINTS[id] && !visited.has(id)) {
      setMidText(STORY_MIDPOINTS[id]);
      setMidIdx(0);
      setMidpoint(true);
      return;
    }
    const r = ROOMS[id];
    if (r.encounters && r.encounters.some(e => !defeated.has(`${id}_${e}`))) {
      setTimeout(() => {
        const ek = r.encounters!.find(e => !defeated.has(`${id}_${e}`));
        if (ek) {
          const en = { ...ENEMIES[ek], mercyCount: 0 };
          setEnemy(en);
          setBp('menu');
          setMenuSel(0);
          setLog([en.dialogue[0]]);
          setPos({ x: 150, y: 100 });
          setBullets([]);
          setDodging(false);
          setScreen('battle');
          sfx('attack');
        }
      }, 100);
    }
  };

  const takeItem = (idx: number) => {
    const key = `${room}_${idx}`;
    if (collected.has(key)) return;
    const item = ROOMS[room].items![idx];
    setInv(arr => [...arr, item]);
    setCollected(prev => new Set([...prev, key]));
    setDlg([`* Found ${item.emoji} ${item.name}!`]);
    setDlgIdx(0);
    sfx('heal');
  };

  const restart = () => {
    setScreen('title');
    setIntroIdx(0);
    setRoom('classroom');
    setDlg([]);
    setDlgIdx(0);
    setInv([]);
    setHp(92);
    setLv(1);
    setExp(0);
    setGold(0);
    setEnemy(null);
    setBp('menu');
    setMenuSel(0);
    setLog([]);
    setBullets([]);
    setPos({ x: 150, y: 100 });
    setDodging(false);
    setVisited(new Set(['classroom']));
    setDefeated(new Set());
    setCollected(new Set());
    stopMelody();
    setAudioStarted(false);
  };

  const R = ROOMS[room];

  // ===== RENDER =====
  return (
    <div className={`w-full h-screen bg-black flex items-center justify-center overflow-auto ${shake ? 'animate-shake' : ''}`}
      style={{ fontFamily: "'Courier New', monospace" }}>
      
      {/* TITLE */}
      {screen === 'title' && (
        <div className="text-center p-8 cursor-pointer" onClick={() => { startAudio(); setScreen('intro'); sfx('confirm'); }}>
          <div className="text-7xl mb-6 animate-bounce">🏫</div>
          <h1 className="text-4xl font-bold text-yellow-400 mb-2" style={{ textShadow: '0 0 10px #ffaa00' }}>
            BERTARUNE
          </h1>
          <p className="text-blue-300 mb-2">✦ A School Dark World Adventure ✦</p>
          <p className="text-purple-400 text-sm italic mb-6">"Determination fills the hallway..."</p>
          <div className="text-gray-400 text-sm mb-4">
            <p>📍 Church Gymnasium of the Teutonic Order</p>
            <div className="flex justify-center gap-2 mt-3 flex-wrap text-xs">
              <span className="text-blue-400">🧑‍🎓 Bert</span>
              <span className="text-red-400">👦 Martin</span>
              <span className="text-pink-400">👧 Kája</span>
              <span className="text-orange-400">👦 Dan</span>
              <span className="text-purple-400">😈 Matěj</span>
              <span className="text-green-400">🧒 Šíma</span>
            </div>
          </div>
          <p className="text-yellow-300 animate-pulse mt-6">▶ Click or Press ENTER ◀</p>
        </div>
      )}

      {/* INTRO */}
      {screen === 'intro' && (
        <div className="w-full max-w-2xl p-6 cursor-pointer" onClick={handleEnter}>
          <div className="border-4 border-white p-6 bg-black min-h-[150px] flex items-center">
            <p className="text-white text-base leading-relaxed">{STORY_INTRO[introIdx]}</p>
          </div>
          <p className="text-gray-500 text-xs mt-3 text-center animate-pulse">
            [Click/Enter] ({introIdx + 1}/{STORY_INTRO.length})
          </p>
        </div>
      )}

      {/* MIDPOINT */}
      {midpoint && (
        <div className="w-full max-w-2xl p-6 cursor-pointer" onClick={handleEnter}>
          <div className="border-4 border-purple-500 p-6 bg-black min-h-[150px] flex items-center">
            <p className="text-purple-200 text-base leading-relaxed">{midText[midIdx]}</p>
          </div>
          <p className="text-gray-500 text-xs mt-3 text-center animate-pulse">[Click/Enter]</p>
        </div>
      )}

      {/* OVERWORLD */}
      {screen === 'overworld' && !midpoint && (
        <div className="w-full max-w-3xl p-4 overflow-y-auto max-h-screen">
          <div className="border-2 border-yellow-600 p-3 mb-3" style={{ backgroundColor: R.bg }}>
            <h2 className="text-yellow-400 text-lg font-bold mb-1">📍 {R.name}</h2>
            <p className="text-gray-300 text-sm">{R.description}</p>
          </div>

          {R.npcs?.map((npc, i) => (
            <button key={i} onClick={() => { setDlg(npc.dialogue); setDlgIdx(0); sfx('select'); }}
              className="flex items-center gap-3 p-3 border-2 border-gray-700 hover:border-yellow-400 w-full text-left bg-gray-900 hover:bg-gray-800 mb-2 transition-colors">
              <span className="text-2xl">{npc.sprite}</span>
              <span style={{ color: npc.color }} className="font-bold">{npc.name}</span>
              <span className="text-gray-500 text-xs ml-auto">[Talk]</span>
            </button>
          ))}

          {R.items?.map((item, i) => {
            if (collected.has(`${room}_${i}`)) return null;
            return (
              <button key={i} onClick={() => takeItem(i)}
                className="flex items-center gap-3 p-3 border-2 border-green-800 hover:border-green-400 w-full text-left bg-gray-900 hover:bg-gray-800 mb-2 transition-colors">
                <span className="text-xl">{item.emoji}</span>
                <span className="text-green-400">{item.name}</span>
                <span className="text-gray-500 text-xs ml-auto">[Take]</span>
              </button>
            );
          })}

          {dlg.length > 0 && (
            <div className="border-4 border-white p-4 mt-3 bg-black cursor-pointer" onClick={handleEnter}>
              <p className="text-white text-sm">{dlg[dlgIdx]}</p>
              <p className="text-gray-500 text-xs mt-2">[Click/Enter] ({dlgIdx + 1}/{dlg.length})</p>
            </div>
          )}

          <div className="mt-4 border-t border-gray-700 pt-3">
            <p className="text-gray-500 text-xs mb-2">Go to:</p>
            <div className="flex flex-wrap gap-2">
              {R.exits.map((ex, i) => (
                <button key={i} onClick={() => goToRoom(ex.roomId)}
                  className="px-3 py-2 border-2 border-blue-600 text-blue-400 hover:bg-blue-900 hover:text-white text-sm transition-colors">
                  {ex.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 border-2 border-gray-700 p-3 bg-gray-900">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-white font-bold text-sm">🧑‍🎓 Bert <span className="text-yellow-400 text-xs">LV {lv}</span></p>
                <p className="text-xs">
                  <span className="text-yellow-400">HP </span>
                  <span className={hp < 28 ? 'text-red-400' : 'text-green-400'}>{hp}/92</span>
                </p>
              </div>
              <div className="text-right text-xs text-gray-500">
                <p>EXP:{exp} Gold:{gold}</p>
                <p>Items:{inv.length}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BATTLE */}
      {screen === 'battle' && enemy && (
        <div className="w-full max-w-3xl p-3">
          <div className="text-center mb-3 border-2 border-gray-700 p-3" style={{ background: `linear-gradient(180deg, ${enemy.color}22, #111)` }}>
            <div className="text-5xl mb-2">{enemy.sprite}</div>
            <h3 className="text-lg font-bold" style={{ color: enemy.color }}>{enemy.name}</h3>
            <div className="mt-2 flex items-center justify-center gap-2">
              <span className="text-red-400 text-xs">HP</span>
              <div className="w-40 h-3 bg-gray-800 border border-gray-600">
                <div className="h-full bg-red-500 transition-all" style={{ width: `${(enemy.hp / enemy.maxHp) * 100}%` }} />
              </div>
              <span className="text-gray-400 text-xs">{enemy.hp}/{enemy.maxHp}</span>
            </div>
            {enemy.spareable && (
              <div className="mt-1">
                <div className="flex items-center justify-center gap-1">
                  <span className="text-yellow-600 text-xs">MERCY:</span>
                  <div className="w-20 h-2 bg-gray-800 border border-gray-600">
                    <div className="h-full bg-yellow-500 transition-all" style={{ width: `${Math.min(100, (enemy.mercyCount / enemy.spareThreshold) * 100)}%` }} />
                  </div>
                </div>
                {enemy.mercyCount >= enemy.spareThreshold && <p className="text-yellow-400 text-xs animate-pulse">★ SPAREABLE ★</p>}
              </div>
            )}
          </div>

          <div className="relative w-full border-4 border-white bg-black mx-auto mb-3 overflow-hidden" style={{ maxWidth: '300px', height: '200px' }}>
            {dodging ? (
              <>
                <div className={`absolute text-red-500 text-lg ${invincible ? 'opacity-30' : ''}`}
                  style={{ left: pos.x - 8, top: pos.y - 8, transition: 'opacity 0.1s' }}>❤</div>
                {bullets.map((b, i) => (
                  <div key={i} className="absolute" style={{
                    left: b.x - b.size / 2, top: b.y - b.size / 2, width: b.size, height: b.size,
                    backgroundColor: b.color,
                    borderRadius: b.shape === 'circle' ? '50%' : b.shape === 'diamond' ? '0' : '2px',
                    transform: b.shape === 'diamond' ? 'rotate(45deg)' : 'none',
                    boxShadow: `0 0 4px ${b.color}`,
                  }} />
                ))}
              </>
            ) : (
              <div className="p-3 h-full flex items-center justify-center">
                <div className="text-center">
                  {log.map((l, i) => <p key={i} className="text-white text-sm mb-1">{l}</p>)}
                  {bp === 'dialogue' && <p className="text-gray-500 text-xs mt-2 animate-pulse cursor-pointer" onClick={handleEnter}>[Click/Enter]</p>}
                  {bp === 'victory' && (
                    <div className="mt-3">
                      <p className="text-yellow-400 animate-pulse cursor-pointer" onClick={endBattle}>[Click/Enter to continue]</p>
                      <p className="text-green-400 text-xs mt-2">+{Math.floor(enemy.maxHp * 0.5)} EXP | +{Math.floor(enemy.maxHp * 0.3)} Gold</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="mb-3">
            <div className="flex items-center gap-2">
              <span className="text-yellow-400 text-xs w-16">🧑‍🎓 Bert</span>
              <div className="flex-1 h-3 bg-gray-800 border border-gray-600">
                <div className={`h-full transition-all ${hp < 28 ? 'bg-red-500' : hp < 55 ? 'bg-yellow-500' : 'bg-green-500'}`}
                  style={{ width: `${(hp / 92) * 100}%` }} />
              </div>
              <span className={`text-xs w-14 text-right ${hp < 28 ? 'text-red-400' : 'text-green-400'}`}>{hp}/92</span>
            </div>
          </div>

          {!dodging && bp !== 'victory' && bp !== 'dialogue' && bp !== 'wait' && (
            <div className="border-2 border-yellow-600 p-3 bg-gray-900">
              {bp === 'menu' && (
                <div className="flex justify-around flex-wrap gap-2">
                  {['⚔️ FIGHT', '💬 ACT', '🎒 ITEM', '💛 MERCY'].map((opt, i) => (
                    <button key={i} onClick={() => {
                      sfx('confirm');
                      setMenuSel(i);
                      if (i === 0) doFight();
                      else if (i === 1) setBp('act');
                      else if (i === 2) setBp('item');
                      else if (i === 3) doMercy();
                    }} className={`px-2 py-2 border-2 text-xs transition-all ${menuSel === i ? 'border-yellow-400 text-yellow-400 bg-yellow-900/30' : 'border-gray-600 text-gray-400 hover:border-gray-400'}`}>
                      {menuSel === i && '❤ '}{opt}
                    </button>
                  ))}
                </div>
              )}
              {bp === 'act' && (
                <div className="space-y-1">
                  <button onClick={() => setBp('menu')} className="text-blue-400 text-xs mb-2">← Back</button>
                  {enemy.acts.map((act, i) => (
                    <button key={i} onClick={() => doAct(i)}
                      className="block w-full text-left px-3 py-2 border border-gray-700 text-gray-400 hover:border-yellow-400 hover:text-yellow-400 text-sm transition-colors">
                      {act}
                    </button>
                  ))}
                </div>
              )}
              {bp === 'item' && (
                <div className="space-y-1">
                  <button onClick={() => setBp('menu')} className="text-blue-400 text-xs mb-2">← Back</button>
                  {inv.length === 0 ? <p className="text-gray-500 text-sm">No items!</p> :
                    inv.map((item, i) => (
                      <button key={i} onClick={() => useItem(i)}
                        className="block w-full text-left px-3 py-2 border border-gray-700 text-gray-400 hover:border-yellow-400 hover:text-yellow-400 text-sm transition-colors">
                        {item.emoji} {item.name} (+{item.healAmount}HP)
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}

          {dodging && (
            <>
              <p className="text-center text-gray-500 text-xs mt-2">Arrow Keys / WASD to dodge! ❤ = you</p>
              <div className="flex flex-col items-center gap-1 mt-2 md:hidden">
                <button onTouchStart={() => keys.current.add('ArrowUp')} onTouchEnd={() => keys.current.delete('ArrowUp')}
                  className="w-12 h-10 bg-gray-800 border-2 border-gray-600 rounded text-white active:bg-gray-600">▲</button>
                <div className="flex gap-1">
                  <button onTouchStart={() => keys.current.add('ArrowLeft')} onTouchEnd={() => keys.current.delete('ArrowLeft')}
                    className="w-12 h-10 bg-gray-800 border-2 border-gray-600 rounded text-white active:bg-gray-600">◀</button>
                  <div className="w-12" />
                  <button onTouchStart={() => keys.current.add('ArrowRight')} onTouchEnd={() => keys.current.delete('ArrowRight')}
                    className="w-12 h-10 bg-gray-800 border-2 border-gray-600 rounded text-white active:bg-gray-600">▶</button>
                </div>
                <button onTouchStart={() => keys.current.add('ArrowDown')} onTouchEnd={() => keys.current.delete('ArrowDown')}
                  className="w-12 h-10 bg-gray-800 border-2 border-gray-600 rounded text-white active:bg-gray-600">▼</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* GAME OVER */}
      {screen === 'gameover' && (
        <div className="text-center p-8 cursor-pointer" onClick={restart}>
          <div className="text-6xl mb-6 animate-bounce">💔</div>
          <h2 className="text-3xl text-red-500 font-bold mb-4" style={{ textShadow: '0 0 20px #ff0000' }}>GAME OVER</h2>
          <div className="border-2 border-red-900 p-4 bg-black max-w-sm mx-auto mb-6">
            <p className="text-gray-300 text-sm mb-2">* Bert's heart stopped...</p>
            <p className="text-red-400 text-sm italic">* "But determination fills you."</p>
          </div>
          <p className="text-yellow-400 animate-pulse">[Click/Enter to retry]</p>
        </div>
      )}

      {/* ENDING */}
      {screen === 'ending' && (
        <div className="w-full max-w-2xl p-4 text-center cursor-pointer overflow-y-auto max-h-screen"
          onClick={() => { setScreen('title'); stopMelody(); }}>
          <div className="text-6xl mb-4 animate-bounce">🌟</div>
          <h2 className="text-3xl text-yellow-400 font-bold mb-4" style={{ textShadow: '0 0 10px #ffaa00' }}>✦ VICTORY! ✦</h2>
          <div className="border-4 border-yellow-600 p-4 bg-gray-900 text-left mb-4 text-sm">
            <p className="text-white mb-2">* The darkness fades from the school...</p>
            <p className="text-white mb-2">* The Principal returns to normal.</p>
            <p className="text-white mb-2">* Matěj: "Dude, that was WILD!"</p>
            <p className="text-white mb-2">* Kája: "I have a chemistry test tomorrow."</p>
            <p className="text-white mb-2">* Martin: "My jokes defeat evil."</p>
            <p className="text-white mb-2">* Bert smiles. Another day saved.</p>
            <p className="text-yellow-400 mt-3 text-center font-bold">✦ THE END ✦</p>
          </div>
          <p className="text-yellow-300 animate-pulse">[Click/Enter]</p>
        </div>
      )}
    </div>
  );
}
