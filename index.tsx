
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';

// --- Types & Constants ---

type GameState = 'MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';
type EntityType = 'FRUIT' | 'BOMB' | 'ICE';

interface ScoreEntry {
  name: string;
  score: number;
  date: string;
}

interface Point {
  x: number;
  y: number;
  life: number;
}

// Helper for random range
const randomRange = (min: number, max: number) => Math.random() * (max - min) + min;

class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
  type: 'CIRCLE' | 'STAR';

  constructor(x: number, y: number, color: string) {
    this.x = x;
    this.y = y;
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 6 + 2;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = 1.0;
    this.color = color;
    this.size = Math.random() * 8 + 4;
    this.type = Math.random() > 0.5 ? 'CIRCLE' : 'STAR';
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.2; 
    this.life -= 0.02;
    this.vx *= 0.96;
    this.vy *= 0.96;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life);
    ctx.fillStyle = this.color;
    ctx.translate(this.x, this.y);

    if (this.type === 'CIRCLE') {
      ctx.beginPath();
      ctx.arc(0, 0, this.size, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      const spikes = 5;
      const outerRadius = this.size;
      const innerRadius = this.size / 2;
      for(let i=0; i<spikes; i++){
        let x = Math.cos(Math.PI/2 + i*Math.PI*2/spikes) * outerRadius;
        let y = Math.sin(Math.PI/2 + i*Math.PI*2/spikes) * outerRadius;
        ctx.lineTo(x, y);
        x = Math.cos(Math.PI/2 + Math.PI/spikes + i*Math.PI*2/spikes) * innerRadius;
        y = Math.sin(Math.PI/2 + Math.PI/spikes + i*Math.PI*2/spikes) * innerRadius;
        ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    }
    
    ctx.restore();
  }
}

class GameEntity {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number = 40;
  entityType: EntityType;
  
  // Visual props
  emoji: string;
  color: string;
  rotation: number = 0;
  rotSpeed: number;
  
  // Physics props
  gravity: number;

  sliced: boolean = false;
  id: number;
  
  static fruitTypes = [
    { emoji: '🍉', color: '#ff6b6b' }, 
    { emoji: '🍊', color: '#ffa502' }, 
    { emoji: '🥝', color: '#9bf6ff' }, 
    { emoji: '🍓', color: '#ffadad' }, 
    { emoji: '🍇', color: '#bdb2ff' }, 
    { emoji: '🍑', color: '#ffd6a5' }, 
    { emoji: '🍍', color: '#fdffb6' },
    { emoji: '🥥', color: '#eee' },
    { emoji: '🍎', color: '#ff7675' }
  ];

  constructor(canvasWidth: number, canvasHeight: number, score: number = 0, typeOverride?: EntityType) {
    this.id = Math.random();
    this.x = randomRange(60, canvasWidth - 60);
    this.y = canvasHeight + 80;
    
    // Horizontal toss
    const centerBias = (canvasWidth / 2 - this.x) * 0.002;
    this.vx = (Math.random() - 0.5) * 4 + centerBias * 4; 
    
    // --- VERTICAL PHYSICS ---
    // Calculate Speed Multiplier based on Score
    // Every 50 points, speed increases by 10%
    const speedMultiplier = 1 + Math.floor(score / 50) * 0.1;

    // Safe Zone: We want the fruit to peak significantly below the top UI.
    const safeTopY = 200; 
    const peakY = randomRange(safeTopY, canvasHeight * 0.65);
    
    // Distance to travel upwards
    const dist = (canvasHeight + 80) - peakY;
    
    // Base Gravity is 0.25. Multiply by speed factor.
    this.gravity = 0.25 * speedMultiplier;
    
    // v = sqrt(2 * g * h)
    this.vy = -Math.sqrt(2 * this.gravity * dist);

    this.rotSpeed = ((Math.random() - 0.5) * 0.15) * speedMultiplier;
    
    if (typeOverride) {
        this.entityType = typeOverride;
    } else {
        const rand = Math.random();
        // 10% Bomb, 40% Ice (High Frequency), 50% Fruit
        if (rand < 0.1) this.entityType = 'BOMB';
        else if (rand < 0.5) this.entityType = 'ICE';
        else this.entityType = 'FRUIT';
    }

    if (this.entityType === 'BOMB') {
        this.emoji = '💣';
        this.color = '#555';
        this.radius = 35;
    } else if (this.entityType === 'ICE') {
        this.emoji = '🧊';
        this.color = '#81ecec';
        this.radius = 35;
    } else {
        const type = GameEntity.fruitTypes[Math.floor(Math.random() * GameEntity.fruitTypes.length)];
        this.emoji = type.emoji;
        this.color = type.color;
    }
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += this.gravity; // Use dynamic gravity
    this.rotation += this.rotSpeed;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    ctx.font = '70px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    ctx.shadowColor = 'rgba(0,0,0,0.1)';
    ctx.shadowBlur = 15;
    ctx.shadowOffsetY = 8;

    ctx.fillText(this.emoji, 0, 5);

    if (this.entityType === 'BOMB') {
         const scale = 1 + Math.sin(Date.now() / 100) * 0.1;
         ctx.scale(scale, scale);
    }

    ctx.restore();
  }
}

// --- Main Component ---

const App = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  
  const [gameState, setGameState] = useState<GameState>('MENU');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [freezeTimeLeft, setFreezeTimeLeft] = useState(0);
  
  const [leaderboard, setLeaderboard] = useState<ScoreEntry[]>([]);
  const [playerName, setPlayerName] = useState('');

  // Game Ref State
  const gameRef = useRef({
    entities: [] as GameEntity[],
    particles: [] as Particle[],
    blade: [] as Point[],
    score: 0,
    lives: 3,
    freezeEndTime: 0,
    remainingFreeze: 0, 
    iceCutCount: 0, // Track cumulative ice cuts
    droppedFruitCount: 0, // Track consecutively dropped fruits for penalty
    width: 0,
    height: 0,
    lastSpawn: 0,
  });

  // --- Logic Helpers ---

  const loadLeaderboard = () => {
    const saved = localStorage.getItem('kawaii-fruit-ninja-scores-v4');
    if (saved) {
      setLeaderboard(JSON.parse(saved));
    }
  };

  const saveScore = () => {
    if (!playerName.trim()) return;
    const newEntry: ScoreEntry = {
      name: playerName.trim(),
      score: score,
      date: new Date().toLocaleDateString()
    };
    const newBoard = [...leaderboard, newEntry]
      .sort((a, b) => b.score - a.score)
      .slice(0, 5); 
    
    localStorage.setItem('kawaii-fruit-ninja-scores-v4', JSON.stringify(newBoard));
    setLeaderboard(newBoard);
    setGameState('MENU');
  };

  const spawnEntity = () => {
    const now = Date.now();
    
    // Slower spawn rate logic
    const baseSpawnRate = 1100; 
    const spawnRate = Math.max(500, baseSpawnRate - gameRef.current.score * 1.5);

    if (now - gameRef.current.lastSpawn > spawnRate) {
       // Create potential entity with current score for difficulty scaling
       const ent = new GameEntity(gameRef.current.width, gameRef.current.height, gameRef.current.score);
       
       // Prevent double ice
       const hasIce = gameRef.current.entities.some(e => e.entityType === 'ICE');
       if (ent.entityType === 'ICE' && hasIce) {
           ent.entityType = 'FRUIT';
           const type = GameEntity.fruitTypes[Math.floor(Math.random() * GameEntity.fruitTypes.length)];
           ent.emoji = type.emoji;
           ent.color = type.color;
           ent.radius = 40;
       }

       gameRef.current.entities.push(ent);
       
       if (Math.random() > 0.9) {
         setTimeout(() => {
             if (gameState === 'PLAYING') {
                const extra = new GameEntity(gameRef.current.width, gameRef.current.height, gameRef.current.score);
                const currentHasIce = gameRef.current.entities.some(e => e.entityType === 'ICE');
                if (extra.entityType === 'ICE' && currentHasIce) {
                    extra.entityType = 'FRUIT';
                    const type = GameEntity.fruitTypes[Math.floor(Math.random() * GameEntity.fruitTypes.length)];
                    extra.emoji = type.emoji;
                    extra.color = type.color;
                    extra.radius = 40;
                }
                gameRef.current.entities.push(extra);
             }
         }, 250);
       }
       
       gameRef.current.lastSpawn = now;
    }
  };

  const triggerShake = () => {
      if (containerRef.current) {
          containerRef.current.classList.add('shake');
          setTimeout(() => containerRef.current?.classList.remove('shake'), 500);
      }
  };

  const checkCollisions = () => {
    // No cutting if frozen
    if (Date.now() < gameRef.current.freezeEndTime) return;

    const { blade, entities } = gameRef.current;
    if (blade.length < 2) return;

    const tip = blade[blade.length - 1];
    const prev = blade[blade.length - 2];

    entities.forEach(entity => {
      if (entity.sliced) return;

      const d = distToSegment(entity, prev, tip);
      
      if (d < entity.radius) {
        entity.sliced = true;
        
        if (entity.entityType === 'FRUIT') {
            gameRef.current.score += 10;
            setScore(gameRef.current.score);
            for (let i = 0; i < 10; i++) {
                gameRef.current.particles.push(new Particle(entity.x, entity.y, entity.color));
            }
        } else if (entity.entityType === 'BOMB') {
            gameRef.current.lives -= 1;
            setLives(gameRef.current.lives);
            triggerShake();
            for (let i = 0; i < 20; i++) {
                gameRef.current.particles.push(new Particle(entity.x, entity.y, '#555'));
                gameRef.current.particles.push(new Particle(entity.x, entity.y, '#ff4757'));
            }
            if (gameRef.current.lives <= 0) {
                endGame();
            }
        } else if (entity.entityType === 'ICE') {
            const now = Date.now();
            
            // Cumulative Logic: 1st=3s, 2nd=6s, 3rd=9s... CAP at 9s
            gameRef.current.iceCutCount = (gameRef.current.iceCutCount || 0) + 1;
            const freezeDuration = Math.min(gameRef.current.iceCutCount * 3000, 9000);

            // If already frozen, add to existing end time. If not, start from now.
            const currentEnd = Math.max(now, gameRef.current.freezeEndTime);
            gameRef.current.freezeEndTime = currentEnd + freezeDuration;
            
            for (let i = 0; i < 15; i++) {
                gameRef.current.particles.push(new Particle(entity.x, entity.y, '#81ecec'));
                gameRef.current.particles.push(new Particle(entity.x, entity.y, '#fff'));
            }
        }
      }
    });
  };

  const distToSegment = (p: {x: number, y: number}, v: Point, w: Point) => {
    const l2 = (v.x - w.x)**2 + (v.y - w.y)**2;
    if (l2 === 0) return Math.sqrt((p.x - v.x)**2 + (p.y - v.y)**2);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.sqrt((p.x - (v.x + t * (w.x - v.x)))**2 + (p.y - (v.y + t * (w.y - v.y)))**2);
  };

  // --- Game Loop ---

  const loop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const isPaused = gameState === 'PAUSED' || gameState === 'GAME_OVER';
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // --- MENU MODE ---
    if (gameState === 'MENU') {
        if (Math.random() > 0.97) {
             const f = new GameEntity(gameRef.current.width, gameRef.current.height, 0, 'FRUIT');
             f.vy = -randomRange(8, 14); 
             f.vx = (Math.random() - 0.5) * 3;
             gameRef.current.entities.push(f);
        }
        for (let i = gameRef.current.entities.length - 1; i >= 0; i--) {
            const ent = gameRef.current.entities[i];
            ent.update();
            ent.draw(ctx);
            if (ent.y > canvas.height + 100) gameRef.current.entities.splice(i, 1);
        }
        rafRef.current = requestAnimationFrame(loop);
        return; 
    }

    // --- PLAYING / PAUSED MODE ---

    const now = Date.now();
    // Strictly checking frozen status (for UI and Input Blocking)
    const isFrozen = !isPaused && now < gameRef.current.freezeEndTime;
    
    // Safety cleanup: If we are playing and not frozen, ensure remainingFreeze is 0.
    // This prevents the mask from sticking if the game loop desyncs from the pause logic.
    if (!isPaused && !isFrozen) {
        gameRef.current.remainingFreeze = 0;
    }

    if (isFrozen) {
        setFreezeTimeLeft(Math.ceil((gameRef.current.freezeEndTime - now) / 1000));
    } else if (!isPaused) {
        setFreezeTimeLeft(0);
    }

    // Draw Blade
    if (!isFrozen && !isPaused) {
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, '#badc58');
        gradient.addColorStop(1, '#6ab04c');
        
        ctx.strokeStyle = gradient;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 10;
        ctx.shadowBlur = 8;
        ctx.shadowColor = 'rgba(255, 255, 255, 0.6)';
        
        ctx.beginPath();
        if (gameRef.current.blade.length > 0) {
            ctx.moveTo(gameRef.current.blade[0].x, gameRef.current.blade[0].y);
            for (let i = 1; i < gameRef.current.blade.length; i++) {
                ctx.lineTo(gameRef.current.blade[i].x, gameRef.current.blade[i].y);
            }
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        for (let i = gameRef.current.blade.length - 1; i >= 0; i--) {
            gameRef.current.blade[i].life -= 0.15;
            if (gameRef.current.blade[i].life <= 0) {
                gameRef.current.blade.splice(i, 1);
            }
        }
    } else {
        gameRef.current.blade = [];
    }

    // Spawn (Continue spawning even if frozen)
    if (!isPaused) {
        spawnEntity();
    }

    // Entities
    for (let i = gameRef.current.entities.length - 1; i >= 0; i--) {
      const ent = gameRef.current.entities[i];
      if (!isPaused) {
        ent.update();
      }
      
      if (ent.sliced) {
        gameRef.current.entities.splice(i, 1);
        continue;
      }
      if (ent.y > canvas.height + 80 && ent.vy > 0) {
        // Drop penalty logic
        if (ent.entityType === 'FRUIT' && !ent.sliced) {
             gameRef.current.droppedFruitCount += 1;
             
             // Every 3 dropped fruits = -1 Life
             if (gameRef.current.droppedFruitCount >= 3) {
                 gameRef.current.droppedFruitCount = 0;
                 gameRef.current.lives -= 1;
                 setLives(gameRef.current.lives);
                 triggerShake();
                 
                 if (gameRef.current.lives <= 0) {
                     endGame();
                 }
             }
        }
        gameRef.current.entities.splice(i, 1);
      } else {
        ent.draw(ctx);
      }
    }

    // Particles
    for (let i = gameRef.current.particles.length - 1; i >= 0; i--) {
      const p = gameRef.current.particles[i];
      if (!isPaused) {
         p.update();
      }
      if (p.life <= 0) {
        gameRef.current.particles.splice(i, 1);
      } else {
        p.draw(ctx);
      }
    }

    if (!isPaused) {
        checkCollisions();
    }
    
    // Draw Pause Dimmer
    if (gameState === 'PAUSED') {
        ctx.beginPath();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    rafRef.current = requestAnimationFrame(loop);
  }, [gameState]);

  const startGame = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    gameRef.current.score = 0;
    gameRef.current.lives = 3;
    gameRef.current.entities = [];
    gameRef.current.particles = [];
    gameRef.current.blade = [];
    gameRef.current.freezeEndTime = 0;
    gameRef.current.remainingFreeze = 0;
    gameRef.current.iceCutCount = 0; // Reset ice counter
    gameRef.current.droppedFruitCount = 0; // Reset drop counter
    gameRef.current.lastSpawn = Date.now();
    
    setScore(0);
    setLives(3);
    setFreezeTimeLeft(0);
    setGameState('PLAYING');
  };

  const endGame = () => {
    setGameState('GAME_OVER');
  };

  const pauseGame = () => {
      const now = Date.now();
      if (now < gameRef.current.freezeEndTime) {
          gameRef.current.remainingFreeze = gameRef.current.freezeEndTime - now;
      } else {
          gameRef.current.remainingFreeze = 0;
      }
      setGameState('PAUSED');
  };

  const resumeGame = () => {
      if (gameRef.current.remainingFreeze > 0) {
          gameRef.current.freezeEndTime = Date.now() + gameRef.current.remainingFreeze;
          gameRef.current.remainingFreeze = 0;
      }
      setGameState('PLAYING');
  };

  const goHome = () => {
      setGameState('MENU');
  };

  const handleInput = (x: number, y: number) => {
    if (gameState !== 'PLAYING') return;
    if (Date.now() < gameRef.current.freezeEndTime) return;

    gameRef.current.blade.push({ x, y, life: 1.0 });
    if (gameRef.current.blade.length > 7) {
      gameRef.current.blade.shift();
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      gameRef.current.width = window.innerWidth;
      gameRef.current.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault(); 
      const touch = e.touches[0];
      handleInput(touch.clientX, touch.clientY);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (e.buttons === 1) {
        handleInput(e.clientX, e.clientY);
      }
    };

    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('mousemove', onMouseMove);
    
    loadLeaderboard();
    
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('mousemove', onMouseMove);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [gameState, loop]); 

  // --- UI Render ---

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
        
      <div className="wood-grain"></div>

      <canvas
        ref={canvasRef}
        style={{ display: 'block', position: 'relative', zIndex: 1 }}
      />
      
      {/* UI LAYERS */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none' }}>
      
        {/* FROZEN OVERLAY UI */}
        {freezeTimeLeft > 0 && (gameState === 'PLAYING' || gameState === 'PAUSED') && (
            <div style={{
                position: 'absolute', top: '35%', width: '100%', textAlign: 'center',
            }}>
                <div className="floating">
                    <h1 className="text-stroke" style={{ fontSize: '5rem', color: '#81ecec', margin: 0 }}>
                        ❄️ {freezeTimeLeft}
                    </h1>
                </div>
            </div>
        )}

        {/* HUD */}
        {gameState === 'PLAYING' && (
            <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="glass-panel" style={{ padding: '10px 25px', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 'auto' }}>
                    <span style={{ fontSize: '1.2rem', color: '#aaa', fontWeight: 'bold', fontFamily: 'Fredoka One' }}>SCORE</span>
                    <span style={{ fontSize: '2.5rem', color: '#ffbfa0', lineHeight: 1 }}>{score}</span>
                </div>
                
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <div className="glass-panel" style={{ padding: '10px 20px', display: 'flex', gap: '5px', minWidth: 'auto' }}>
                        {'❤'.repeat(lives).split('').map((h, i) => (
                            <span key={i} style={{ fontSize: '2rem', color: '#ff7675' }}>❤</span>
                        ))}
                        {'❤'.repeat(3 - lives).split('').map((h, i) => (
                             <span key={i} style={{ fontSize: '2rem', color: '#eee' }}>❤</span>
                        ))}
                    </div>
                    
                    <button 
                        className="glass-btn btn-blue icon-btn" 
                        style={{ 
                          padding: '0', 
                          width: '60px', 
                          height: '60px', 
                          fontSize: '1.5rem', 
                          pointerEvents: 'auto', 
                          margin: 0, 
                          display: 'flex', 
                          justifyContent: 'center', 
                          alignItems: 'center' 
                        }}
                        onClick={pauseGame}
                    >
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                        </svg>
                    </button>
                </div>
            </div>
        )}

        {/* MENU */}
        {gameState === 'MENU' && (
            <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', pointerEvents: 'auto' }}>
                <div className="glass-panel" style={{ textAlign: 'center', transform: 'rotate(-1deg)' }}>
                    <h1 className="title-text floating">夏日切切乐</h1>
                    
                    <button className="glass-btn btn-orange" onClick={startGame}>
                        开始切水果! 🍉
                    </button>

                    {leaderboard.length > 0 && (
                        <div style={{ marginTop: '30px' }}>
                            <div style={{ background: 'rgba(255,255,255,0.5)', borderRadius: '15px', padding: '15px', border: '2px solid rgba(255,255,255,0.7)' }}>
                                {leaderboard.slice(0, 3).map((entry, i) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px', fontSize: '1.1rem', color: '#777', borderBottom: '1px dashed #ddd' }}>
                                        <span>#{i+1} {entry.name}</span>
                                        <span style={{ color: '#ffbfa0', fontWeight: 'bold' }}>{entry.score}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* PAUSE */}
        {gameState === 'PAUSED' && (
            <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', pointerEvents: 'auto' }}>
                <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center' }}>
                    <h2 style={{ fontSize: '3rem', color: '#a0c4ff', margin: '0 0 10px 0' }} className="text-stroke">休息一下</h2>
                    <button className="glass-btn btn-green" style={{ width: '100%' }} onClick={resumeGame}>继续游戏</button>
                    <button className="glass-btn btn-red" style={{ width: '100%' }} onClick={goHome}>回到主页</button>
                </div>
            </div>
        )}

        {/* GAME OVER */}
        {gameState === 'GAME_OVER' && (
            <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', pointerEvents: 'auto' }}>
                <div className="glass-panel" style={{ textAlign: 'center' }}>
                    <h2 style={{ fontSize: '3.5rem', color: '#ff7675', margin: 0 }} className="text-stroke">游戏结束!</h2>
                    <p style={{ fontSize: '1.8rem', color: '#888' }}>最终得分</p>
                    <div style={{ fontSize: '4.5rem', color: '#ffbfa0', lineHeight: 1, marginBottom: '20px' }} className="text-stroke">{score}</div>
                    
                    <input 
                        type="text" 
                        className="glass-input"
                        placeholder="你的名字..."
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value)}
                        maxLength={8}
                    />
                    <div style={{ height: '20px' }}></div>
                    <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap' }}>
                         <button className="glass-btn btn-orange" onClick={startGame}>重玩一次</button>
                         <button className="glass-btn btn-blue" onClick={saveScore}>保存分数</button>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
