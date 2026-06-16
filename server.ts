import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

// Define Point, Snake, Food locally in server to avoid importing via bundler resolution errors inside tsx
interface Point {
  x: number;
  y: number;
}

interface Snake {
  id: string;
  name: string;
  skin: string;
  body: Point[];
  angle: number;
  speed: number;
  score: number;
  isBoosting: boolean;
  length: number;
  colorList: string[];
  isBot?: boolean;
}

interface Food {
  id: number;
  x: number;
  y: number;
  color: string;
  value: number;
  isBonus?: boolean;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const MAP_WIDTH = 3000;
const MAP_HEIGHT = 3000;
const TICK_RATE = 40; // ~25 FPS loop for physical updates
const MAX_FOODS = 600;
const BOT_COUNT = 15;

const BOT_NAMES = [
  'SlitherMaster', 'NeonPython', 'ViperX', 'GigaWorm', 'SlipperyPete',
  'SpeedyHiss', 'NoodleSoup', 'PythonPro', 'Cobramatic', 'Anaconda',
  'Glider', 'LaserNoodle', 'Sssamuel', 'DangerRope', 'ChromaTail',
  'WiggleChamp', 'FierceWorm', 'GhostSnake', 'VenomVortex', 'ApexAsp'
];

const SKIN_COLORS: Record<string, string[]> = {
  classic_red: ['#ef4444', '#dc2626', '#b91c1c'],
  classic_blue: ['#3b82f6', '#2563eb', '#1d4ed8'],
  classic_green: ['#10b981', '#059669', '#047857'],
  neon_tron: ['#06b6d4', '#000000', '#06b6d4', '#10b981'],
  golden_dragon: ['#fbbf24', '#f59e0b', '#d97706', '#fbbf24'],
  tiger_stripes: ['#f97316', '#000000', '#f97316', '#7c2d12'],
  stars_stripes: ['#3b82f6', '#ffffff', '#ef4444', '#ffffff'],
  rainbow: ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7'],
  nebula: ['#6366f1', '#a855f7', '#ec4899', '#3b82f6'],
};

// State Variables
const snakes: Map<string, Snake> = new Map();
let foods: Food[] = [];
let foodIdCounter = 0;

// Initialize starting food
function fillFoodPool() {
  while (foods.length < MAX_FOODS) {
    foods.push(spawnRandomFood());
  }
}

function spawnRandomFood(isBonus = false, customX?: number, customY?: number): Food {
  const colors = ['#f43f5e', '#ec4899', '#d946ef', '#a855f7', '#8b5cf6', '#6366f1', '#3b82f6', '#0ea5e9', '#06b6d4', '#14b8a6', '#10b981', '#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  return {
    id: foodIdCounter++,
    x: customX !== undefined ? customX : Math.floor(Math.random() * (MAP_WIDTH - 40)) + 20,
    y: customY !== undefined ? customY : Math.floor(Math.random() * (MAP_HEIGHT - 40)) + 20,
    color,
    value: isBonus ? Math.floor(Math.random() * 8) + 8 : Math.floor(Math.random() * 3) + 2,
    isBonus,
  };
}

// Generate starting bots
function maintainBots() {
  let activeBots = 0;
  snakes.forEach((snake) => {
    if (snake.isBot) activeBots++;
  });

  if (activeBots < BOT_COUNT) {
    const missing = BOT_COUNT - activeBots;
    for (let i = 0; i < missing; i++) {
      const botId = `bot_${Math.random().toString(36).substring(2, 9)}`;
      const name = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)] + ' (Bot)';
      const skinKeys = Object.keys(SKIN_COLORS);
      const skin = skinKeys[Math.floor(Math.random() * skinKeys.length)];
      const colorList = SKIN_COLORS[skin] || ['#ef4444', '#dc2626'];

      const startX = Math.floor(Math.random() * (MAP_WIDTH - 200)) + 100;
      const startY = Math.floor(Math.random() * (MAP_HEIGHT - 200)) + 100;
      const angle = Math.random() * Math.PI * 2;

      // Build initial body segments
      const body: Point[] = [];
      const initLen = 12;
      for (let s = 0; s < initLen; s++) {
        body.push({
          x: startX - Math.cos(angle) * s * 14,
          y: startY - Math.sin(angle) * s * 14,
        });
      }

      snakes.set(botId, {
        id: botId,
        name,
        skin,
        body,
        angle,
        speed: 3.5,
        score: initLen * 10,
        isBoosting: false,
        length: initLen,
        colorList,
        isBot: true,
      });
    }
  }
}

// Tick loop updates bot AI, moves snakes, performs collision detection
function gameLoopTick() {
  maintainBots();

  // 1. Bot Steering Logic
  snakes.forEach((snake) => {
    if (!snake.isBot) return;

    // Simple Bot AI: Search for nearest food and guide direction
    let nearestFood: Food | null = null;
    let minDist = 300; // Search radius for food

    foods.forEach((f) => {
      const d = Math.hypot(f.x - snake.body[0].x, f.y - snake.body[0].y);
      if (d < minDist) {
        minDist = d;
        nearestFood = f;
      }
    });

    let desiredAngle = snake.angle;
    if (nearestFood) {
      desiredAngle = Math.atan2((nearestFood as Food).y - snake.body[0].y, (nearestFood as Food).x - snake.body[0].x);
    } else {
      // Periodic random cruising when no immediate food is close
      if (Math.random() < 0.05) {
        desiredAngle += (Math.random() - 0.5) * 1.5;
      }
    }

    // Bot Collision avoidance: detect nearby snake body segments
    let dangerX = 0;
    let dangerY = 0;
    let hasDanger = false;
    const head = snake.body[0];

    snakes.forEach((other) => {
      if (other.id === snake.id) return;
      // Examine other snake's body parts
      for (let s = 0; s < other.body.length; s += 2) {
        const seg = other.body[s];
        const distToSeg = Math.hypot(seg.x - head.x, seg.y - head.y);
        if (distToSeg < 90) {
          // Accumulate vector away from danger
          dangerX += (head.x - seg.x) / distToSeg;
          dangerY += (head.y - seg.y) / distToSeg;
          hasDanger = true;
        }
      }
    });

    if (hasDanger) {
      desiredAngle = Math.atan2(dangerY, dangerX);
      if (Math.random() < 0.3) {
        snake.isBoosting = true;
      }
    } else {
      // Normal speed if safe
      if (Math.random() < 0.01) {
        snake.isBoosting = !snake.isBoosting && snake.score > 250;
      }
    }

    // Smoothly interpolate current angle towards desired angle
    let diff = desiredAngle - snake.angle;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    snake.angle += diff * 0.15;
  });

  // 2. Physics & Snake Movement
  const deadSnakes: string[] = [];
  const killerCredits: { killedId: string; killerId: string; scoreGained: number }[] = [];

  snakes.forEach((snake) => {
    const head = snake.body[0];
    let speed = snake.isBoosting && snake.score > 150 ? 6.5 : 3.5;
    snake.speed = speed;

    // Movement
    const newHead: Point = {
      x: head.x + Math.cos(snake.angle) * speed,
      y: head.y + Math.sin(snake.angle) * speed,
    };

    // Edge of map boundaries check
    if (newHead.x <= 10 || newHead.x >= MAP_WIDTH - 10 || newHead.y <= 10 || newHead.y >= MAP_HEIGHT - 10) {
      deadSnakes.push(snake.id);
      return;
    }

    // Push new head to front
    snake.body.unshift(newHead);

    // Boost drain cycle
    if (snake.isBoosting && snake.score > 150) {
      // Drain score gradually
      snake.score -= 0.6;
      // Leaving a trail of visual glow food behind
      if (Math.random() < 0.15) {
        const tail = snake.body[snake.body.length - 1];
        if (tail) {
          foods.push(spawnRandomFood(false, tail.x + (Math.random() - 0.5) * 20, tail.y + (Math.random() - 0.5) * 20));
        }
      }
    }

    // Maintain length of snake body based on score
    const targetSegments = Math.max(10, Math.floor(snake.score / 15));
    while (snake.body.length > targetSegments) {
      snake.body.pop();
    }
    snake.length = snake.body.length;
  });

  // 3. Collision logic: Snake head vs other Snake bodies
  snakes.forEach((snake) => {
    if (deadSnakes.includes(snake.id)) return;

    const head = snake.body[0];
    let crashed = false;
    let killerId = '';

    snakes.forEach((other) => {
      if (crashed) return;

      // Can't crash into yourself (though you can loop around your tail)
      if (other.id === snake.id) return;

      // Check if head of "snake" touches any part of "other" body
      // We skip the direct head segment of the other snake to allow head-to-head resolving with lower tier or head margin
      for (let i = 0; i < other.body.length; i++) {
        const segment = other.body[i];
        const dist = Math.hypot(segment.x - head.x, segment.y - head.y);
        const collisionThreshold = 22; // Distance of collision circle
        
        if (dist < collisionThreshold) {
          crashed = true;
          killerId = other.id;
          break;
        }
      }
    });

    if (crashed) {
      deadSnakes.push(snake.id);
      if (killerId) {
        killerCredits.push({
          killedId: snake.id,
          killerId,
          scoreGained: Math.floor(snake.score * 0.3),
        });
      }
    }
  });

  // Handle deaths: convert dead snakes into yummy bonus food scatter!
  deadSnakes.forEach((deadId) => {
    const deadSnake = snakes.get(deadId);
    if (deadSnake) {
      // Scatter body segments as foods
      deadSnake.body.forEach((pt, idx) => {
        if (idx % 2 === 0) {
          foods.push(spawnRandomFood(true, pt.x + (Math.random() - 0.5) * 15, pt.y + (Math.random() - 0.5) * 15));
        }
      });
      // Delete from list
      snakes.delete(deadId);
    }
  });

  // Award killer points
  killerCredits.forEach((credit) => {
    const killer = snakes.get(credit.killerId);
    if (killer) {
      killer.score += credit.scoreGained;
      // Send message to socket indicating player got an elimination
      broadcast({
        type: 'kill_notification',
        killerName: killer.name,
        killedId: credit.killedId,
        scoreReward: credit.scoreGained,
      });
    }
  });

  // 4. Collision: Snake head vs Foods
  snakes.forEach((snake) => {
    const head = snake.body[0];
    const headRadius = 24;

    foods = foods.filter((food) => {
      const dist = Math.hypot(food.x - head.x, food.y - head.y);
      if (dist < headRadius) {
        // Collect food!
        snake.score += food.value * 4; // grow
        return false; // delete food
      }
      return true;
    });
  });

  // Repopulate food
  fillFoodPool();

  // 5. Broadcast tick to all connected players
  const listSnakes = Array.from(snakes.values()).map((s) => ({
    id: s.id,
    name: s.name,
    skin: s.skin,
    body: s.body, // full coordinate array for painting
    angle: s.angle,
    speed: s.speed,
    score: Math.floor(s.score),
    isBoosting: s.isBoosting,
    length: s.length,
    colorList: s.colorList,
  }));

  // Build current leaderboard
  const sortedSnakes = [...listSnakes].sort((a, b) => b.score - a.score);
  const liveLeaderboard = sortedSnakes.slice(0, 10).map((s, index) => ({
    rank: index + 1,
    id: s.id,
    name: s.name,
    score: s.score,
  }));

  broadcast({
    type: 'tick',
    snakes: listSnakes,
    foods,
    leaderboard: liveLeaderboard,
  });
}

// Broadcaster to all websockets
const activeSockets: Set<WebSocket> = new Set();

function broadcast(msg: any) {
  const data = JSON.stringify(msg);
  activeSockets.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  });
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  app.use(express.json());

  // API Route for health and config
  app.get('/api/game-config', (req, res) => {
    res.json({
      mapWidth: MAP_WIDTH,
      mapHeight: MAP_HEIGHT,
      maxFoods: MAX_FOODS,
    });
  });

  // Handle WebSocket upgrades
  server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;
    if (pathname === '/ws' || pathname === '/ws/') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  // Client WebSocket Handler
  wss.on('connection', (ws: WebSocket) => {
    activeSockets.add(ws);
    let playerId = `client_${Math.random().toString(36).substring(2, 9)}`;

    ws.on('message', (message: string) => {
      try {
        const payload = JSON.parse(message);
        switch (payload.type) {
          case 'join': {
            playerId = payload.id || playerId;
            const colors = SKIN_COLORS[payload.skin] || ['#3b82f6', '#2563eb'];
            
            // Initial positioning away from border
            const startX = Math.floor(Math.random() * (MAP_WIDTH - 400)) + 200;
            const startY = Math.floor(Math.random() * (MAP_HEIGHT - 400)) + 200;
            const angle = Math.random() * Math.PI * 2;

            const body: Point[] = [];
            const initialLength = 12;
            for (let i = 0; i < initialLength; i++) {
              body.push({
                x: startX - Math.cos(angle) * i * 14,
                y: startY - Math.sin(angle) * i * 14,
              });
            }

            snakes.set(playerId, {
              id: playerId,
              name: payload.name || 'Anonymous Snake',
              skin: payload.skin || 'classic_blue',
              body,
              angle,
              speed: 3.5,
              score: initialLength * 10,
              isBoosting: false,
              length: initialLength,
              colorList: colors,
            });

            // Re-confirm join
            ws.send(JSON.stringify({
              type: 'joined_confirm',
              playerId,
              mapWidth: MAP_WIDTH,
              mapHeight: MAP_HEIGHT,
            }));
            break;
          }

          case 'steer': {
            const snake = snakes.get(playerId);
            if (snake) {
              snake.angle = payload.angle;
              snake.isBoosting = !!payload.isBoosting;
            }
            break;
          }

          case 'leave': {
            if (snakes.has(playerId)) {
              // Convert to food
              const snake = snakes.get(playerId);
              if (snake) {
                snake.body.forEach((pt, index) => {
                  if (index % 2 === 0) {
                    foods.push(spawnRandomFood(true, pt.x, pt.y));
                  }
                });
                snakes.delete(playerId);
              }
            }
            break;
          }
        }
      } catch (err) {
        console.error('WebSocket payload parsing error:', err);
      }
    });

    ws.on('close', () => {
      activeSockets.delete(ws);
      if (snakes.has(playerId)) {
        const snake = snakes.get(playerId);
        if (snake) {
          snake.body.forEach((pt, index) => {
            if (index % 2 === 0) {
              foods.push(spawnRandomFood(true, pt.x, pt.y));
            }
          });
          snakes.delete(playerId);
        }
      }
    });

    ws.on('error', (error) => {
      console.warn(`WebSocket error on playerId: ${playerId}`, error);
    });
  });

  // Setup periodic ticks for the physical engine
  setInterval(gameLoopTick, TICK_RATE);

  // Set up SPA Vite middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, '../dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server fully operational on port ${PORT}!`);
  });
}

startServer().catch((error) => {
  console.error('Failure initializing the back-end application server:', error);
});
