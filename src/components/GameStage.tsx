import { useEffect, useRef, useState } from 'react';
import { db, serverTimestamp } from '../firebase';
import { doc, getDoc, updateDoc, setDoc, collection, addDoc } from 'firebase/firestore';
import { Point, Snake, Food, UserStats, SKINS, ACHIEVEMENTS } from '../types';
import { Swords, RotateCcw, Award, Coins, Home, Navigation, Skull } from 'lucide-react';

interface GameStageProps {
  stats: UserStats;
  playerName: string;
  playerSkinId: string;
  onUpdateStats: (updated: UserStats) => void;
  onExitGame: () => void;
}

export default function GameStage({ stats, playerName, playerSkinId, onUpdateStats, onExitGame }: GameStageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);

  // Gameplay local states
  const [gameJoined, setGameJoined] = useState(false);
  const [isDead, setIsDead] = useState(false);
  const [currentScore, setCurrentScore] = useState(0);
  const [currentKills, setCurrentKills] = useState(0);
  const [killFeed, setKillFeed] = useState<string[]>([]);
  const [leaderboardItems, setLeaderboardItems] = useState<{ rank: number; id: string; name: string; score: number }[]>([]);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [connecting, setConnecting] = useState(true);

  // In-memory reference coordinates downloaded from WS
  const worldStateRef = useRef<{
    snakes: Snake[];
    foods: Food[];
    myId: string;
    mapWidth: number;
    mapHeight: number;
  }>({
    snakes: [],
    foods: [],
    myId: '',
    mapWidth: 3000,
    mapHeight: 3000,
  });

  const steerAngleRef = useRef<number>(0);
  const isBoostingRef = useRef<boolean>(false);
  const [earnedCoins, setEarnedCoins] = useState(0);
  const [unlockedAchievementsThisRun, setUnlockedAchievementsThisRun] = useState<string[]>([]);

  // 1. Connection and resize listeners
  useEffect(() => {
    // Handle Window Resize
    const handleResize = () => {
      if (containerRef.current) {
        setCanvasSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    // Initialize HTML5 Canvas mouse tracks
    const canvas = canvasRef.current;
    if (canvas) {
      const calculateSteeringDirection = (e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Vector from center of screen (where our head always is) to mouse
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        const dy = mouseY - centerY;
        const dx = mouseX - centerX;
        steerAngleRef.current = Math.atan2(dy, dx);
      };

      canvas.addEventListener('mousemove', calculateSteeringDirection);

      const handleTouchSteer = (e: TouchEvent) => {
        if (e.touches.length > 0) {
          const rect = canvas.getBoundingClientRect();
          const touchX = e.touches[0].clientX - rect.left;
          const touchY = e.touches[0].clientY - rect.top;
          const centerX = canvas.width / 2;
          const centerY = canvas.height / 2;
          const dy = touchY - centerY;
          const dx = touchX - centerX;
          steerAngleRef.current = Math.atan2(dy, dx);
        }
      };
      canvas.addEventListener('touchmove', handleTouchSteer);

      // Mouse drag down or Space holds boost
      const handleBoostStart = (e: MouseEvent) => {
        if (e.button === 0) { // left click
          isBoostingRef.current = true;
          sendSteerMessage();
        }
      };
      const handleBoostEnd = (e: MouseEvent) => {
        if (e.button === 0) {
          isBoostingRef.current = false;
          sendSteerMessage();
        }
      };

      canvas.addEventListener('mousedown', handleBoostStart);
      canvas.addEventListener('mouseup', handleBoostEnd);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.code === 'Space') {
          e.preventDefault();
          isBoostingRef.current = true;
          sendSteerMessage();
        }
      };
      const handleKeyUp = (e: KeyboardEvent) => {
        if (e.code === 'Space') {
          e.preventDefault();
          isBoostingRef.current = false;
          sendSteerMessage();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);

      return () => {
        window.removeEventListener('resize', handleResize);
        canvas.removeEventListener('mousemove', calculateSteeringDirection);
        canvas.removeEventListener('touchmove', handleTouchSteer);
        canvas.removeEventListener('mousedown', handleBoostStart);
        canvas.removeEventListener('mouseup', handleBoostEnd);
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
      };
    }
  }, [gameJoined]);

  // 2. Establish Game Server Websocket Connection
  useEffect(() => {
    let wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Match build settings or use Dev URL for standard resolution fallback
    let host = window.location.host;
    let wsUrl = `${wsProtocol}//${host}/ws`;

    // Attempt WS creation
    console.log('Connecting socket to arena: ', wsUrl);
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket Connection Opened!');
      setConnecting(false);

      // Join payload
      ws.send(JSON.stringify({
        type: 'join',
        id: stats.uid, // Tie user UID if available
        name: playerName || 'Unnamed Snake',
        skin: playerSkinId || 'classic_blue',
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'joined_confirm':
            worldStateRef.current.myId = msg.playerId;
            worldStateRef.current.mapWidth = msg.mapWidth;
            worldStateRef.current.mapHeight = msg.mapHeight;
            setGameJoined(true);
            setIsDead(false);
            break;

          case 'tick':
            worldStateRef.current.snakes = msg.snakes;
            worldStateRef.current.foods = msg.foods;
            setLeaderboardItems(msg.leaderboard);

            // Update real-time score in local status matching our snake ID
            const myId = worldStateRef.current.myId;
            const ourSnake = msg.snakes.find((s: Snake) => s.id === myId);
            if (ourSnake) {
              setCurrentScore(ourSnake.score);
            } else {
              // Snake was deleted by physics = Death!
              if (gameJoined && !isDead) {
                handleLocalSnakeDeath();
              }
            }
            break;

          case 'kill_notification':
            // Display elimination banners
            setKillFeed(prev => {
              const cap = [...prev, `${msg.killerName} swallowed an opponent! (+${msg.scoreReward} pts)`];
              return cap.slice(-4);
            });

            // Increment kill count if it was us!
            if (msg.killerName === playerName) {
              setCurrentKills(k => k + 1);
            }
            break;
        }
      } catch (err) {
        console.error(err);
      }
    };

    ws.onclose = () => {
      console.log('Websocket fully disconnected');
      setConnecting(false);
    };

    return () => {
      cleanupWebSocket();
    };
  }, []);

  const cleanupWebSocket = () => {
    if (socketRef.current) {
      if (socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: 'leave' }));
      }
      socketRef.current.close();
    }
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
    }
  };

  const sendSteerMessage = () => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'steer',
        angle: steerAngleRef.current,
        isBoosting: isBoostingRef.current,
      }));
    }
  };

  // Steer steering updates in periodic ticks to avoid congestion
  useEffect(() => {
    const steerInterval = setInterval(() => {
      if (gameJoined && !isDead) {
        sendSteerMessage();
      }
    }, 60);

    return () => clearInterval(steerInterval);
  }, [gameJoined, isDead]);

  // 3. Render Game Scene: Draw Arena, Grid, Snakes, Minimap, Coordinates
  useEffect(() => {
    const renderCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Ensure canvas bounds match state size
      if (canvas.width !== canvasSize.width || canvas.height !== canvasSize.height) {
        canvas.width = canvasSize.width;
        canvas.height = canvasSize.height;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const state = worldStateRef.current;
      // Find our snake coordinates to bind camera focus
      let ourSnake = state.snakes.find(s => s.id === state.myId);

      // Standby coords if we are dead or loading other clients
      let cameraX = state.mapWidth / 2;
      let cameraY = state.mapHeight / 2;

      if (ourSnake && ourSnake.body.length > 0) {
        cameraX = ourSnake.body[0].x;
        cameraY = ourSnake.body[0].y;
      }

      // Drawing offsets: translates map universe center to screen center
      const offsetX = canvas.width / 2 - cameraX;
      const offsetY = canvas.height / 2 - cameraY;

      // 3A. Draw Grid BG
      ctx.save();
      ctx.strokeStyle = '#1e293b'; // Space slate lines
      ctx.lineWidth = 1;
      const gridSpacing = 80;

      // Draw grid lines offset matching scroll
      const firstLineX = Math.floor((-offsetX) / gridSpacing) * gridSpacing;
      const firstLineY = Math.floor((-offsetY) / gridSpacing) * gridSpacing;

      for (let x = firstLineX - gridSpacing; x < firstLineX + canvas.width + gridSpacing; x += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(x + offsetX, 0);
        ctx.lineTo(x + offsetX, canvas.height);
        ctx.stroke();
      }
      for (let y = firstLineY - gridSpacing; y < firstLineY + canvas.height + gridSpacing; y += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(0, y + offsetY);
        ctx.lineTo(canvas.width, y + offsetY);
        ctx.stroke();
      }
      ctx.restore();

      // 3B. Draw Map Boundaries
      ctx.save();
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 6;
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#f43f5e';

      ctx.beginPath();
      // Draw outer map square
      ctx.strokeRect(offsetX, offsetY, state.mapWidth, state.mapHeight);
      ctx.restore();

      // 3C. Draw Food Particles
      ctx.save();
      state.foods.forEach((f) => {
        // Frustum culling (skip drawing food off screen to boost performance)
        const renderX = f.x + offsetX;
        const renderY = f.y + offsetY;
        if (renderX < -15 || renderX > canvas.width + 15 || renderY < -15 || renderY > canvas.height + 15) return;

        ctx.fillStyle = f.color;
        ctx.beginPath();
        if (f.isBonus) {
          // Large shimmering food
          ctx.shadowBlur = 12;
          ctx.shadowColor = f.color;
          const breatheRad = f.value * 2 + Math.sin(Date.now() * 0.01) * 3;
          ctx.arc(renderX, renderY, Math.max(3, breatheRad), 0, Math.PI * 2);
        } else {
          ctx.shadowBlur = 4;
          ctx.shadowColor = f.color;
          ctx.arc(renderX, renderY, f.value + 1.5, 0, Math.PI * 2);
        }
        ctx.fill();
      });
      ctx.restore();

      // 3D. Draw Snakes (Tail to Head)
      state.snakes.forEach((snake) => {
        const body = snake.body;
        if (body.length === 0) return;

        // Custom snake segments drawing logic
        ctx.save();
        const colors = snake.colorList || ['#3b82f6', '#2563eb'];

        // Draw Shadows/Glowing effect for the active local participant
        if (snake.id === state.myId) {
          ctx.shadowBlur = 12;
          ctx.shadowColor = colors[0] + 'aa';
        }

        // Draw body chain
        for (let i = body.length - 1; i >= 0; i--) {
          const pt = body[i];
          const renderX = pt.x + offsetX;
          const renderY = pt.y + offsetY;

          // Culling
          if (renderX < -40 || renderX > canvas.width + 40 || renderY < -40 || renderY > canvas.height + 40) continue;

          // Color sequence looping
          const clr = colors[i % colors.length];
          ctx.fillStyle = clr;

          ctx.beginPath();
          // Decrease size slightly down to tail
          const maxRadius = 15;
          const minRadius = 5;
          const radiusRatio = 1 - (i / body.length) * 0.55; // tail is ~45% of head thickness
          const segmentRadius = Math.max(minRadius, maxRadius * radiusRatio);

          ctx.arc(renderX, renderY, segmentRadius, 0, Math.PI * 2);
          ctx.fill();

          // Detail outlines or stripes for premium skins
          if (snake.skin === 'tiger_stripes' && i % 3 === 0) {
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.arc(renderX, renderY, segmentRadius * 0.6, 0, Math.PI * 2);
            ctx.fill();
          }
          if (snake.skin === 'neon_tron' && i % 4 === 0) {
            ctx.strokeStyle = '#06b6d4';
            ctx.lineWidth = 2.5;
            ctx.stroke();
          }
        }

        // Draw the snake head details (eyes, boost trail highlights)
        const head = body[0];
        const hX = head.x + offsetX;
        const hY = head.y + offsetY;
        ctx.shadowBlur = 0;

        // Draw Eyes: 2 round circles based on head heading angle
        ctx.fillStyle = '#ffffff';
        const eyeOffsetRadius = 8;
        const eyeAngleSpacing = 0.5; // offset eyes left/right of center-line

        const leftEyeX = hX + Math.cos(snake.angle - eyeAngleSpacing) * eyeOffsetRadius;
        const leftEyeY = hY + Math.sin(snake.angle - eyeAngleSpacing) * eyeOffsetRadius;
        const rightEyeX = hX + Math.cos(snake.angle + eyeAngleSpacing) * eyeOffsetRadius;
        const rightEyeY = hY + Math.sin(snake.angle + eyeAngleSpacing) * eyeOffsetRadius;

        ctx.beginPath();
        ctx.arc(leftEyeX, leftEyeY, 4.5, 0, Math.PI * 2);
        ctx.arc(rightEyeX, rightEyeY, 4.5, 0, Math.PI * 2);
        ctx.fill();

        // Draw Pupils tracking vector direction
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(leftEyeX + Math.cos(snake.angle) * 1.5, leftEyeY + Math.sin(snake.angle) * 1.5, 2.2, 0, Math.PI * 2);
        ctx.arc(rightEyeX + Math.cos(snake.angle) * 1.5, rightEyeY + Math.sin(snake.angle) * 1.5, 2.2, 0, Math.PI * 2);
        ctx.fill();

        // Draw crown ornament if top player of the MATCH!
        const isMatchTopDog = leaderboardItems.length > 0 && leaderboardItems[0].id === snake.id;
        if (isMatchTopDog) {
          ctx.save();
          ctx.fillStyle = '#f59e0b';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#fbbf24';

          const crownX = hX - Math.cos(snake.angle) * 12;
          const crownY = hY - Math.sin(snake.angle) * 12 - 14;

          ctx.beginPath();
          ctx.moveTo(crownX - 10, crownY + 5);
          ctx.lineTo(crownX - 12, crownY - 12);
          ctx.lineTo(crownX - 4, crownY - 4);
          ctx.lineTo(crownX, crownY - 16);
          ctx.lineTo(crownX + 4, crownY - 4);
          ctx.lineTo(crownX + 12, crownY - 12);
          ctx.lineTo(crownX + 10, crownY + 5);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }

        // Draw Text tags over snakes
        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${snake.name} [${snake.score}]`, hX, hY - 24);
        ctx.restore();
      });

      // 3E. Radar Minimap (Lower Right Corner)
      ctx.save();
      const mapScaling = 0.05; // 3000x3000px down to 150x150px
      const miniWidth = state.mapWidth * mapScaling;
      const miniHeight = state.mapHeight * mapScaling;
      const padding = 20;

      const mmX = canvas.width - miniWidth - padding;
      const mmY = canvas.height - miniHeight - padding;

      // Draw radar circle or transparent card background
      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(mmX, mmY, miniWidth, miniHeight, 12);
      ctx.fill();
      ctx.stroke();

      // Draw food points inside minimap (selective cluster dots)
      ctx.fillStyle = 'rgba(74, 222, 128, 0.35)'; // faint green food area indicator
      state.foods.forEach((food, idx) => {
        if (idx % 12 === 0) { // draw 1 of every 12 food particles to prevent lag
          const mfX = mmX + food.x * mapScaling;
          const mfY = mmY + food.y * mapScaling;
          ctx.beginPath();
          ctx.arc(mfX, mfY, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Draw snake dots
      state.snakes.forEach((snake) => {
        if (snake.body.length === 0) return;
        const isMe = snake.id === state.myId;
        ctx.fillStyle = isMe ? '#22d3ee' : '#ef4444'; // cyan for user, red for enemy/bots

        const msX = mmX + snake.body[0].x * mapScaling;
        const msY = mmY + snake.body[0].y * mapScaling;

        ctx.beginPath();
        ctx.arc(msX, msY, isMe ? 3 : 2, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();

      // Loop rendering call
      animationFrameIdRef.current = requestAnimationFrame(renderCanvas);
    };

    renderCanvas();

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [canvasSize, isDead, gameJoined]);

  // 4. Update Statistics and check Achievements at end of run
  const handleLocalSnakeDeath = async () => {
    setIsDead(true);
    cleanupWebSocket();

    // Calculate score metrics
    // Gain coins corresponding to 10% of game score + 15 coins per opponent kill!
    const scoreCoins = Math.floor(currentScore * 0.08);
    const killBonus = currentKills * 15;
    const finalRunCoins = scoreCoins + killBonus;

    setEarnedCoins(finalRunCoins);

    // Prepare updated global stat profiles for cloud save
    const updatedGames = stats.totalGames + 1;
    const newKillsTotal = stats.totalKills + currentKills;
    const bestScore = Math.max(stats.highScore, currentScore);

    // Length logic
    const finalLen = Math.max(10, Math.floor(currentScore / 15));
    const longestSnake = Math.max(stats.longestLength, finalLen);
    const walletBalance = stats.coins + finalRunCoins;

    // Check newly unlocked achievements
    const freshlyUnlocked: string[] = [];
    ACHIEVEMENTS.forEach((ach) => {
      // Skip if already unlocked
      if (stats.unlockedAchievements.includes(ach.id)) return;

      let meetsRequirement = false;
      if (ach.targetType === 'score' && bestScore >= ach.targetValue) meetsRequirement = true;
      if (ach.targetType === 'kills' && newKillsTotal >= ach.targetValue) meetsRequirement = true;
      if (ach.targetType === 'games' && updatedGames >= ach.targetValue) meetsRequirement = true;
      if (ach.targetType === 'coins' && walletBalance >= ach.targetValue) meetsRequirement = true;
      if (ach.targetType === 'length' && longestSnake >= ach.targetValue) meetsRequirement = true;

      if (meetsRequirement) {
        freshlyUnlocked.push(ach.id);
      }
    });

    const activeAchievements = [...stats.unlockedAchievements, ...freshlyUnlocked];
    // Add prizes
    let bonusPrize = 0;
    freshlyUnlocked.forEach((id) => {
      const matchAch = ACHIEVEMENTS.find(a => a.id === id);
      if (matchAch) {
        bonusPrize += matchAch.rewardCoins;
      }
    });

    const finalWallet = walletBalance + bonusPrize;
    setUnlockedAchievementsThisRun(freshlyUnlocked);

    const mergedStats: UserStats = {
      ...stats,
      highScore: bestScore,
      longestLength: longestSnake,
      totalGames: updatedGames,
      totalKills: newKillsTotal,
      coins: finalWallet,
      unlockedAchievements: activeAchievements,
      updatedAt: new Date().toISOString(),
    };

    onUpdateStats(mergedStats);

    // Save permanently in Firestore if connected
    try {
      const userRef = doc(db, 'users', stats.uid);
      await setDoc(userRef, {
        nickname: stats.nickname,
        highScore: bestScore,
        longestLength: longestSnake,
        totalGames: updatedGames,
        totalKills: newKillsTotal,
        coins: finalWallet,
        selectedSkin: stats.selectedSkin,
        unlockedSkins: stats.unlockedSkins,
        unlockedAchievements: activeAchievements,
        updatedAt: serverTimestamp ? serverTimestamp() : new Date().toISOString(),
      }, { merge: true });

      // Save record in main public Leaderboard collection
      if (currentScore > 50) {
        const scoreColl = collection(db, 'leaderboard');
        await addDoc(scoreColl, {
          userId: stats.uid,
          nickname: playerName,
          highScore: currentScore,
          longestLength: finalLen,
          totalKills: currentKills,
          skin: playerSkinId,
          timestamp: serverTimestamp ? serverTimestamp() : new Date().toISOString(),
        });
      }
    } catch (err) {
      console.warn('Leaderboard save failed or skipped for Guest offline mode:', err);
    }
  };

  const handleRestartBattle = () => {
    // Reload state and reconnect WebSocket
    setIsDead(false);
    setGameJoined(false);
    setConnecting(true);
    setCurrentScore(0);
    setCurrentKills(0);
    setUnlockedAchievementsThisRun([]);

    // Establish WebSocket anew
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${wsProtocol}//${host}/ws`;

    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      setConnecting(false);
      ws.send(JSON.stringify({
        type: 'join',
        id: stats.uid,
        name: playerName || 'Unnamed Snake',
        skin: playerSkinId || 'classic_blue',
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'joined_confirm':
            worldStateRef.current.myId = msg.playerId;
            setGameJoined(true);
            break;
          case 'tick':
            worldStateRef.current.snakes = msg.snakes;
            worldStateRef.current.foods = msg.foods;
            setLeaderboardItems(msg.leaderboard);

            const ourSnake = msg.snakes.find((s: Snake) => s.id === worldStateRef.current.myId);
            if (ourSnake) {
              setCurrentScore(ourSnake.score);
            } else {
              if (gameJoined && !isDead) {
                handleLocalSnakeDeath();
              }
            }
            break;
          case 'kill_notification':
            setKillFeed(prev => [...prev, `${msg.killerName} swallowed an opponent! (+${msg.scoreReward} pts)`].slice(-4));
            if (msg.killerName === playerName) {
              setCurrentKills(k => k + 1);
            }
            break;
        }
      } catch (err) {
        console.error(err);
      }
    };

    ws.onclose = () => {
      setConnecting(false);
    };
  };

  return (
    <div id="game-stage-wrapper" ref={containerRef} className="relative w-full h-[85vh] bg-slate-950 overflow-hidden select-none rounded-2xl border border-gray-800 shadow-3xl">
      {/* 1. HTML5 Render Canvas */}
      <canvas
        ref={canvasRef}
        className="block w-full h-full cursor-crosshair"
      />

      {/* 2. Loading State */}
      {connecting && (
        <div className="absolute inset-0 flex flex-col justify-center items-center bg-gray-950/90 text-white gap-4 backdrop-blur-sm z-30">
          <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="font-extrabold text-sm text-cyan-400 tracking-wider uppercase animate-pulse">Entering Multiverse Arena...</p>
        </div>
      )}

      {/* 3. In-Game HUD Panel */}
      {gameJoined && !isDead && (
        <>
          {/* Top-Left Score Indicator */}
          <div className="absolute top-4 left-4 bg-slate-900/80 backdrop-blur-md border border-slate-700/50 p-4 rounded-xl flex items-center gap-4 text-white z-10 shadow-lg">
            <div className="border-r border-slate-800 pr-4">
              <span className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider">Snake Length</span>
              <span className="text-2xl font-black text-cyan-400">{Math.max(10, Math.floor(currentScore / 15))}m</span>
            </div>
            <div>
              <span className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider">Score points</span>
              <span className="text-2xl font-black text-yellow-400">{Math.floor(currentScore)}</span>
            </div>
            <div className="border-l border-slate-800 pl-4">
              <span className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider">Killed Opponents</span>
              <span className="text-2xl font-black text-rose-500 flex items-center gap-1">
                <Swords className="w-4 h-4" /> {currentKills}
              </span>
            </div>
          </div>

          {/* Top-Right LIVE Match Leaderboard */}
          <div className="absolute top-4 right-4 bg-slate-900/80 backdrop-blur-sm border border-slate-700/50 p-4 rounded-xl w-60 text-white z-10 shadow-lg font-sans">
            <h4 className="text-xs font-black tracking-wider text-cyan-400 uppercase border-b border-slate-800 pb-2 mb-2 flex items-center gap-1.5">
              <Award className="w-4 h-4" /> Leaders Match
            </h4>
            <div className="space-y-1.5 text-xs">
              {leaderboardItems.map((item, index) => {
                const isUs = item.name === playerName;
                return (
                  <div
                    key={index}
                    className={`flex justify-between items-center py-1 rounded px-1.5 ${
                      isUs ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-gray-300'
                    }`}
                  >
                    <span className="truncate max-w-[120px]">
                      {index + 1}. {item.name}
                    </span>
                    <span className="font-mono font-bold text-yellow-500">{item.score}</span>
                  </div>
                );
              })}
              {leaderboardItems.length === 0 && (
                <div className="text-gray-500 text-center py-2 italic text-[11px]">Searching for players...</div>
              )}
            </div>
          </div>

          {/* Eliminations Ticker Feed (Bottom-Left) */}
          <div className="absolute bottom-4 left-4 space-y-1.5 pointer-events-none z-10">
            {killFeed.map((feed, index) => (
              <div
                key={index}
                className="bg-slate-900/90 text-red-200 border border-red-500/20 px-3.5 py-1.5 rounded-lg text-xs font-semibold animate-fade-in flex items-center gap-2 shadow-md"
              >
                <Skull className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                {feed}
              </div>
            ))}
          </div>

          {/* Direct Controls Tip */}
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-slate-950/80 border border-slate-800 text-[10px] text-gray-500 font-bold uppercase tracking-widest px-4 py-2 rounded-full pointer-events-none text-center">
            Steer with Cursor • Press Left Click / Space to BOOST
          </div>
        </>
      )}

      {/* 4. GAME OVER REPORT SCREEN */}
      {isDead && (
        <div id="game-over-overlay" className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-20">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl relative overflow-hidden text-center text-white">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-rose-500"></div>

            <div className="mx-auto w-16 h-16 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center justify-center text-rose-500 mb-4 animate-bounce">
              <Skull className="w-8 h-8" />
            </div>

            <h2 className="text-3xl font-black tracking-tight text-white mb-1">
              SNAKE DEFEATED
            </h2>
            <p className="text-xs text-rose-400 font-bold tracking-widest uppercase mb-6">Worm Crushed In Action</p>

            {/* Performance Stats */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <span className="block text-[10px] text-gray-500 font-bold uppercase">Final Length</span>
                <span className="text-lg font-black text-cyan-400">{Math.max(10, Math.floor(currentScore / 15))}m</span>
              </div>
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <span className="block text-[10px] text-gray-500 font-bold">Total Points</span>
                <span className="text-lg font-black text-yellow-400">{Math.floor(currentScore)}</span>
              </div>
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <span className="block text-[10px] text-gray-500 font-bold">Kills Secured</span>
                <span className="text-lg font-black text-rose-500">{currentKills}</span>
              </div>
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <span className="block text-[10px] text-gray-500 font-bold">Snake Coins Earned</span>
                <span className="text-l font-black text-yellow-500 flex items-center justify-center gap-1">
                  +{earnedCoins} <Coins className="w-3.5 h-3.5 text-yellow-400" />
                </span>
              </div>
            </div>

            {/* Newly Unlocked Achievements */}
            {unlockedAchievementsThisRun.length > 0 && (
              <div className="mb-6 bg-emerald-950/20 border border-emerald-500/20 p-3 rounded-xl">
                <h4 className="text-xs font-bold text-emerald-400 uppercase flex items-center justify-center gap-1.5 mb-1.5">
                  🏆 New Achievement Unlocked!
                </h4>
                <div className="space-y-1">
                  {unlockedAchievementsThisRun.map((id) => {
                    const matchAch = ACHIEVEMENTS.find(a => a.id === id);
                    return (
                      <div key={id} className="text-xs text-emerald-200 font-semibold italic">
                        &quot;{matchAch?.title}&quot; — {matchAch?.description}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Control buttons */}
            <div className="flex flex-col gap-2">
              <button
                onClick={handleRestartBattle}
                className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-black py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg cursor-pointer transition hover:scale-101 active:scale-99"
              >
                <RotateCcw className="w-4.5 h-4.5" />
                <span>PLAY AGAIN</span>
              </button>
              <button
                onClick={onExitGame}
                className="w-full bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition"
              >
                <Home className="w-4.5 h-4.5" />
                <span>Return to Lobby</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
