import { levelScreens } from './screen.js';  // Adicione esta linha
import { levels, gameSettings, gameState } from './levels.js';

const { lastCheckpoint, collectedLifeKeys, startPosition, firstLoad } = gameState;

if ('serviceWorker' in navigator) {
  // Registra o service worker e força atualização
  navigator.serviceWorker.register('/service-worker.js')
    .then(reg => {
      console.log("✅ Service Worker registrado com sucesso:", reg);
      reg.update(); // Força verificação de atualizações
      setInterval(() => reg.update(), 60 * 60 * 1000); // Verifica a cada hora
    })
    .catch(err => {
      console.error("❌ Falha ao registrar o Service Worker:", err);
    });
}


navigator.serviceWorker.addEventListener('controllerchange', () => {
  console.log("Nova versão do PWA ativada. Recarregando...");
  window.location.reload();
});


// Verifica se a página foi carregada do cache
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    window.location.reload(); // Recarrega se veio do cache
  }
});

// Variáveis globais
const objects = gameState.objects;

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const livesDisplay = document.getElementById("lives");
const controlsHeight = 90;

// Elementos de áudio

const soundLife = document.getElementById('sound-life');
const soundSpike = document.getElementById('sound-spike');
const soundWater = document.getElementById('sound-water');
const soundEnemy = document.getElementById('sound-enemy');
const soundEnemyDie = document.getElementById('sound-enemy-die');
const soundCheckpoint = document.getElementById('sound-checkpoint');
const soundFinish = document.getElementById('sound-finish');
const soundJump = document.getElementById('sound-jump');
const soundCoin = document.getElementById('sound-coin');
const soundGameOver = document.getElementById('sound-gameover');

const musicStart = document.getElementById('music-start');
const musicGame = document.getElementById('music-game');
const musicGameOver = document.getElementById('music-gameover');


let currentMusic = null;
let score = 0;
let animationFrameId;
//let firstLoad = true;
let isGamePaused = false;
let isFullscreen = false;
let isDying = false; // Variável global para controlar o estado de morte

// Variáveis de controle de frame rate
const targetFPS = 60;
const frameTime = 1000 / targetFPS;
let lastFrameTime = 0;
let deltaTime = 0;
let framesDropped = 0;
const maxFrameSkip = 5;

const timerDisplay = document.getElementById('timer-display');

let gameStartTime = null;
let elapsedTime = 0;
let timerInterval = null;

let finalTime = null; // ⏱️ será usado futuramente


function getLevelWidth() {
    return levels.getCurrentLevel().levelWidth || 5280; // Valor padrão caso não esteja definido
}

// Controle das telas
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.add('hidden');
  });
  document.getElementById(screenId).classList.remove('hidden');

  let nextMusic = null;
  let loop = true;

  if (screenId === 'game-container') {
    if (currentMusic === musicGame) return;
    nextMusic = musicGame;
  } else if (screenId === 'start-screen') {
    // Mantém a música de início se já estiver tocando (vinheta -> start-screen)
    if (currentMusic !== musicStart) {
      nextMusic = null;
    }
  } else if (screenId === 'gameover-screen') {
    nextMusic = musicGameOver;
    loop = false;
  }

  // ✅ Só troca a música se for diferente da atual
  if (nextMusic !== currentMusic) {
    if (currentMusic && currentMusic !== musicStart) { // Não pausa a musicStart se for manter
      currentMusic.pause();
      currentMusic.currentTime = 0;
    }

    if (nextMusic) {
      nextMusic.loop = loop;
      nextMusic.play().catch(e => console.log("Erro ao tocar música:", e));
      currentMusic = nextMusic;
    }
  }
}



function playMusic(newMusic) {
    if (currentMusic && currentMusic !== newMusic) {
        currentMusic.pause();
        currentMusic.currentTime = 0; // Opcional: Reinicia a música anterior
    }
    currentMusic = newMusic;
    if (currentMusic.paused) { // Só tenta tocar se não estiver já tocando
        currentMusic.play().catch(e => console.log("Erro ao tocar música:", e));
    }
}

function pauseGameMusic() {
  if (currentMusic && !currentMusic.paused) {
    currentMusic.pause();
  }
}



// Modifique a função startGame em game.js
async function startGame() {
    // Para a música atual se estiver tocando
    if (currentMusic) {
        currentMusic.pause();
        currentMusic.currentTime = 0;
    }

    const level = levels.getCurrentLevel();
    
    // Configura a música do nível atual (com tratamento de erro robusto)
    if (level.music) {
        currentMusic = new Audio(level.music);
        currentMusic.loop = true;
        currentMusic.volume = 0.6;

        try {
            await currentMusic.play().catch(e => {
                // Ignora AbortError (interrupção normal ao trocar de música)
                if (e.name !== 'AbortError') {
                    console.warn("Erro ao tocar música do level:", e);
                }
            });
        } catch (e) {
            console.warn("Erro inesperado ao tocar música:", e);
        }
    }

    // Reset do jogo (o restante permanece igual)
    resetTimer();
    showScreen('game-container');

    lives = 3;
    gameState.collectedLifeKeys = new Set();
    gameStartTime = performance.now();
    elapsedTime = 0;
    startTimer();

    livesDisplay.textContent = lives;
    livesDisplay.classList.remove('hidden');
    isGamePaused = false;

    score = 0;
    document.getElementById('score-display').textContent = score;
    gameState.lastCheckpoint = null;

    buildLevelFromMap();

    // Posiciona o jogador
    const spawn = gameState.startPosition || { x: 100, y: 550 };
    Object.assign(player, spawn, {
        dx: 0,
        dy: 0,
        jumping: false,
        canDoubleJump: false,
        jumpPressed: false
    });

    // Reinicia o loop do jogo
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
    animationFrameId = requestAnimationFrame(loop);
}

  


function togglePause() {
  isGamePaused = !isGamePaused;

  if (isGamePaused) {
    stopTimer();

    // 🔒 Somente pausa a música atual, sem tocar nenhuma outra
    if (currentMusic && !currentMusic.paused) {
      currentMusic.pause();
    }

    document.getElementById('pause-screen').classList.add('visible-by-focus');
    document.getElementById('game-container').classList.add('hidden');
    document.getElementById('pause-screen').classList.remove('hidden');

  } else {
    gameStartTime = performance.now() - elapsedTime;
    startTimer();

    // 🔒 Somente retoma a música que já estava tocando, sem trocar
    if (currentMusic && currentMusic.paused) {
      currentMusic.play().catch(e => console.log("Erro ao retomar música:", e));
    }

    document.getElementById('pause-screen').classList.add('hidden');
    document.getElementById('pause-screen').classList.remove('visible-by-focus');
    document.getElementById('game-container').classList.remove('hidden');
  }
}


function startTimer() {
  if (timerInterval) return;

  timerInterval = setInterval(() => {
    const now = performance.now();
    elapsedTime = now - gameStartTime;
    
    // Exibe sem milissegundos (MM:SS)
    const minutes = Math.floor(elapsedTime / 60000);
    const seconds = Math.floor((elapsedTime % 60000) / 1000);
    timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }, 100);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

function resetTimer() {
  stopTimer();
  gameStartTime = null;
  elapsedTime = 0;
  timerDisplay.textContent = "00:00:000";
}


function formatTime(ms, showMilliseconds = false) {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  
  if (showMilliseconds) {
    const milliseconds = Math.floor(ms % 1000);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}



// Configurações de tela cheia
function toggleFullscreen() {
  if (!isFullscreen) {
    const elem = document.documentElement;
    if (elem.requestFullscreen) elem.requestFullscreen();
    else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
    else if (elem.msRequestFullscreen) elem.msRequestFullscreen();
    isFullscreen = true;
    fullscreenBtn.textContent = "Sair da Tela Cheia";
  } else {
    if (document.exitFullscreen) document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    else if (document.msExitFullscreen) document.msExitFullscreen();
    isFullscreen = false;
    fullscreenBtn.textContent = "Tela Cheia";
  }
}

// Verifica mudanças no estado de tela cheia
document.addEventListener('fullscreenchange', () => {
  isFullscreen = !!document.fullscreenElement;
  fullscreenBtn.textContent = isFullscreen ? "Sair da Tela Cheia" : "Tela Cheia";
});





let isResizing = false;

// Função para redimensionar o canvas
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight - controlsHeight;
  
  // Força verificação de colisão após redimensionamento
  if (player) {
    enforceCollisions();
  }
}

//const collectedLifeKeys = new Set();

const images = {
  ground: new Image(),
  groundGrass: new Image(),
  groundGrassRight: new Image(),
  groundGrassLeft: new Image(),
  platform: new Image(),
  spike: new Image(),
  idle: new Image(),
  idleFlipped: new Image(),
  walk: new Image(),
  walkFlipped: new Image(),
  jump: new Image(),
  jumpFlipped: new Image(),
  enemy01Walk: new Image(),
  enemy01WalkFlipped: new Image(),
  enemy01Die: new Image(),
  enemy01DieFlipped: new Image(),
  decoGrass: new Image(),
  decor01: new Image(),
  groundBottom: new Image(),
  coin: new Image(),
};

// Caminhos corrigidos para imagens
images.ground.src = "img/ground.png?v=1.0.5";
images.groundGrass.src = "img/ground_grass_top.png?v=1.0.5";
images.groundGrassRight.src = "img/ground_grass_right.png?v=1.0.5";
images.groundGrassLeft.src = "img/ground_grass_left.png?v=1.0.5";
images.platform.src = "img/platform.png?v=1.0.5";
images.spike.src = "img/spike.png?v=1.0.5";
images.idle.src = "img/idle.png?v=1.0.5";
images.idleFlipped.src = "img/idle_flipped.png?v=1.0.5";
images.walk.src = "img/walk.png?v=1.0.5";
images.walkFlipped.src = "img/walk_flipped.png?v=1.0.5";
images.jump.src = "img/jump.png?v=1.0.5";
images.jumpFlipped.src = "img/jump_flipped.png?v=1.0.5";
images.enemy01Walk.src = "img/enemy01_walk.png?v=1.0.5";
images.enemy01WalkFlipped.src = "img/enemy01_walk_flipped.png?v=1.0.5";
images.enemy01Die.src = "img/enemy01_die.png?v=1.0.5";
images.enemy01DieFlipped.src = "img/enemy01_die_flipped.png?v=1.0.5";
images.decoGrass.src = 'img/decograss.png';
images.decor01.src = "img/decor01.png?v=1.0.5";
images.groundBottom.src = "img/ground_bottom.png?v=1.0.5";
images.coin.src = "img/coin.png?v=1.0.5";

const mountainLayer = new Image();
mountainLayer.src = "img/montanhas-parallax.png?v=1.0.5";

const coinSprite = {
  image: new Image(),
  frameWidth: 40,
  frameHeight: 40,
  frameCount: 5,
  currentFrame: 0,
  frameDelay: 90,
  delayCounter: 0
};
coinSprite.image.src = "img/coin.png?v=1.0.5";

const checkpointSprite = {
  image: new Image(),
  frameWidth: 40,
  frameHeight: 120,
  frameCount: 3,
  currentFrame: 0,
  frameDelay: 100,
  delayCounter: 0
};
checkpointSprite.image.src = "img/checkpoint_midle.png?v=1.0.5";

const waterSprite = {
  image: new Image(),
  frameWidth: 40,
  frameHeight: 40,
  frameCount: 3,
  currentFrame: 0,
  frameDelay: 15,
  delayCounter: 0
};
waterSprite.image.src = "img/water2.png?v=1.0.5";

const finishSprite = {
  image: new Image(),
  frameWidth: 40,
  frameHeight: 120,
  frameCount: 3,
  currentFrame: 0,
  frameDelay: 100,
  delayCounter: 0
};
finishSprite.image.src = "img/finish.png?v=1.0.5";

const lifeSprite = {
  image: new Image(),
  frameWidth: 40,
  frameHeight: 40,
  frameCount: 3,
  currentFrame: 0,
  frameDelay: 80,
  delayCounter: 0
};
lifeSprite.image.src = "img/life.png?v=1.0.5";

function updateWaterAnimation() {
  waterSprite.delayCounter++;
  if (waterSprite.delayCounter >= waterSprite.frameDelay) {
    waterSprite.delayCounter = 0;
    waterSprite.currentFrame = (waterSprite.currentFrame + 1) % waterSprite.frameCount;
  }
}

function drawAnimatedWater(tile) {
  const sx = waterSprite.currentFrame * waterSprite.frameWidth;
  ctx.drawImage(
    waterSprite.image,
    sx, 0, waterSprite.frameWidth, waterSprite.frameHeight,
    tile.x - cameraX, tile.y - cameraY,
    tile.width, tile.height
  );
}


  

  


    const tileTypes = {
      '⬛': null,
      '🟫': { type: 'ground', color: '#b87333', width: 40, height: 40 },
      '🟤': { type: 'ground-fake', color: '#b87333', width: 40, height: 40 },
      '🟢': { type: 'ground-grass', color: '#b87333', width: 40, height: 40 },
      '🔵': { type: 'ground-grass-right', color: '#b87333', width: 40, height: 40 },
      '🔴': { type: 'ground-grass-left', color: '#b87333', width: 40, height: 40 },
      '⚫': { type: 'ground-bottom', color: '#b87333', width: 40, height: 40 },
      '🟦': { type: 'water', color: '#0026a3', width: 40, height: 40 },
      '🟥': { type: 'platform', color: '#e53935', width: 40, height: 40 },
      '🟩': { type: 'checkpoint', color: '#2196f3', width: 40, height: 40 },
      '🔻': { type: 'spike', color: '#eceff4', width: 40, height: 20 },
      '👾': { type: 'enemy', color: '#000', width: 40, height: 40 },
      '🏁': { type: 'finish', color: '#fff', width: 40, height: 40 },
      '💗': { type: 'life', color: '#f00', width: 40, height: 40 },
      '💰': { type: 'coin', color: 'yellow', width: 25, height: 25 },
      '⬜': { type: 'start', color: 'transparent', width: 40, height: 40 },
      '🍃': { type: 'decoGrass', color: 'transparent', width: 40, height: 40 },
      '🌼': { type: 'decor01', color: 'transparent', width: 40, height: 40 },


    };

const keys = { left: false, right: false, jump: false };
const gravity = gameSettings.gravity;
const friction = gameSettings.friction;


let cameraX = 0, cameraY = 0, targetCameraX = 0, targetCameraY = 0;
let lives = 3;

let levelMinY = Infinity, levelMaxY = -Infinity;

const player = {
  x: 0, y: 0,
  width: 40, height: 40,
  dx: 0, dy: 0,
  jumping: false,
  canDoubleJump: false,
  jumpPressed: false,
  color: "#4caf50",
  wasInWater: false
  
};

const playerSprite = {
  state: 'idle',
  frame: 0,
  delay: 15,
  counter: 0,
  facing: 'right'
};

//let startPosition = null;
//let objects = { tiles: [], platforms: [], checkpoints: [], spikes: [], enemies: [], lives: [], coins: [], finish: null };

// Sistema de partículas
let waterParticles = [];
let coinParticles = [];
let confettiParticles = [];

function createCoinSparkle(x, y) {
  for (let i = 0; i < 12; i++) {
    coinParticles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 1.5) * 2,
      size: Math.random() * 2 + 2,
      alpha: 1,
      life: 30 + Math.random() * 10
    });
  }
}

function createConfettiExplosion(x, y) {
  const colors = ['#ffeb3b', '#ff4081', '#4caf50', '#2196f3', '#f44336', '#00bcd4'];
  for (let i = 0; i < 20; i++) {
    confettiParticles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 3,
      vy: (Math.random() - 1.5) * 3,
      size: Math.random() * 3 + 2,
      alpha: 1,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 30 + Math.random() * 15
    });
  }
}

function createWaterSplash(x, y) {
  for (let i = 0; i < 15; i++) {
    waterParticles.push({
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * 5,
      vy: -Math.random() * 5,
      size: Math.random() * 3 + 2,
      life: 30 + Math.random() * 20
    });
  }
}

function drawWaterParticles() {
  for (let i = 0; i < waterParticles.length; i++) {
    const p = waterParticles[i];
    
    ctx.fillStyle = 'rgba(100, 200, 255, 0.7)';
    ctx.beginPath();
    ctx.arc(p.x - cameraX, p.y - cameraY, p.size, 0, Math.PI * 2);
    ctx.fill();
    
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.1; // gravidade
    p.life--;
    
    if (p.life <= 0) {
      waterParticles.splice(i, 1);
      i--;
    }
  }
}

function hexToRgb(hex) {
  const bigint = parseInt(hex.replace("#", ""), 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `${r},${g},${b}`;
}

function buildLevelFromMap() {
  const currentLevel = levels.getCurrentLevel();
  const tileMap = currentLevel.tileMap;

  // Limpa os objetos anteriores
  gameState.objects.tiles = [];
  gameState.objects.platforms = [];
  gameState.objects.checkpoints = [];
  gameState.objects.spikes = [];
  gameState.objects.enemies = [];
  gameState.objects.lives = [];
  gameState.objects.coins = [];
  gameState.objects.finish = null;

  // Reset opcional das vidas coletadas (caso deseje manter progresso, remova esta linha)
 

  tileMap.forEach((row, rowIndex) => {
    [...row].forEach((char, colIndex) => {
      const def = tileTypes[char];
      if (!def) return;

      const x = colIndex * 40;
      const baseY = canvas.height - (tileMap.length - rowIndex) * 40;
      const y = baseY + (40 - def.height);
      const props = { x, y, width: def.width, height: def.height };

      if (def.type === 'ground' || def.type === 'water' || def.type === 'ground-grass' ||
          def.type === 'ground-grass-right' || def.type === 'ground-grass-left') {
        gameState.objects.tiles.push({ ...props, type: def.type, color: def.color });
      } else if (def.type === 'decor01') {
        gameState.objects.tiles.push({ ...props, type: 'decor01' });
      } else if (def.type === 'decoGrass') {
        gameState.objects.tiles.push({ ...props, type: 'decoGrass' });
      } else if (def.type === 'ground-fake') {
        gameState.objects.tiles.push({ ...props, type: 'ground-fake' });
      } else if (def.type === 'ground-bottom') {
        gameState.objects.tiles.push({ ...props, type: 'ground-bottom' });
      } else if (def.type === 'platform') {
        gameState.objects.platforms.push(props);
      } else if (def.type === 'checkpoint') {
        gameState.objects.checkpoints.push({ x, y: y + 40, active: true });
      } else if (def.type === 'finish') {
        gameState.objects.finish = { x, y: y + 40, active: true };
      } else if (def.type === 'start') {
        if (gameState.firstLoad) {
          gameState.startPosition = { x: x, y: y - player.height };
          player.x = gameState.startPosition.x;
          player.y = gameState.startPosition.y;
          gameState.firstLoad = false;
        }
      } else if (def.type === 'spike') {
        gameState.objects.spikes.push(props);
      } else if (def.type === 'enemy') {
        gameState.objects.enemies.push({
          ...props,
          dx: 0.8,
          dir: 1,
          name: 'enemy01',
          state: 'walk',
          frame: 0,
          delay: 10,
          counter: 0
        });
      } else if (def.type === 'coin') {
        const key = `${x},${y}`;
        gameState.objects.coins.push({ ...props, type: 'coin', key, collected: false });
      } else if (def.type === 'life') {
        const key = `${x},${y}`;
        gameState.objects.lives.push({ ...props, type: 'life', color: def.color, key, collected: gameState.collectedLifeKeys.has(key) });
        
      }

      levelMinY = Math.min(levelMinY, y);
      levelMaxY = Math.max(levelMaxY, y + def.height);
    });
  });

  if (!gameState.startPosition) {
    gameState.startPosition = { x: 100, y: 550 };
    if (gameState.firstLoad) {
      player.x = gameState.startPosition.x;
      player.y = gameState.startPosition.y;
      gameState.firstLoad = false;
    }
  }
}



function checkCollision(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function resolveCollision(r) {
  const prevX = player.x - player.dx;
  const prevY = player.y - player.dy;
  const collX = player.x + player.width > r.x && player.x < r.x + r.width;
  const collY = player.y + player.height > r.y && player.y < r.y + r.height;

  if (collX && collY) {
    if (prevY + player.height <= r.y) {
      player.y = r.y - player.height;
      player.dy = 0;
      player.jumping = false;
      player.canDoubleJump = false;
    } else if (prevX + player.width <= r.x) {
      player.x = r.x - player.width;
      player.dx = 0;
    } else if (prevX >= r.x + r.width) {
      player.x = r.x + r.width;
      player.dx = 0;
    }
  }
}

function enforceCollisions() {
  // Verifica colisões com todos os tiles sólidos
  gameState.objects.tiles
    .filter(t => t.type === "ground" || t.type === "ground-grass" || 
             t.type === "ground-grass-right" || t.type === "ground-grass-left")
    .forEach(tile => {
      if (checkCollision(player, tile)) {
        resolveCollision(tile);
      }
    });
  
  // Verifica colisões com plataformas
  gameState.objects.platforms.forEach(p => {
    if (checkCollision(player, p)) {
      resolveCollision(p);
    }
  });
}

function pauseGameForSeconds(seconds) {
  isGamePaused = true;
  return new Promise(resolve => {
    setTimeout(() => {
      isGamePaused = false;
      resolve();
    }, seconds * 1000);
  });
}





async function handleDeath() {
    if (isDying) return;
    isDying = true;
    
    lives--;
    livesDisplay.textContent = lives;

    if (lives < 1) {
        livesDisplay.classList.add('hidden');
        await pauseGameForSeconds(1);
        isGamePaused = true;
        finalTime = elapsedTime;
        
        // Mostrar tela de game over
        showScreen('gameover-screen');
        setTimeout(() => {
  const finalTimeDisplay = document.getElementById('final-time-display');
  if (finalTimeDisplay) {
    const minutes = Math.floor(finalTime / 60000);
    const seconds = Math.floor((finalTime % 60000) / 1000);
    const milliseconds = Math.floor(finalTime % 1000);
    finalTimeDisplay.textContent =
      `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(milliseconds).padStart(3, '0')}`;
  }
}, 50);
        
        setTimeout(() => {
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
            
            // Reseta o estado usando gameState
            lives = 3;
            isDying = false;
            isGamePaused = false;
            gameState.lastCheckpoint = null; // ← Atualizado
            gameState.collectedLifeKeys = new Set(); // ← Atualizado
            cameraX = 0;
            cameraY = 0;
            gameState.firstLoad = true; // ← Atualizado
             gameState.collectedLifeKeys = new Set();
            
            // Reconstroi os objetos do jogo
            gameState.objects = { tiles: [], platforms: [], checkpoints: [], spikes: [], enemies: [], lives: [], coins: [], finish: null };
            buildLevelFromMap();
            
            // Reseta o jogador usando gameState.startPosition
            const spawn = gameState.startPosition || { x: 100, y: 550 }; // ← Atualizado
            Object.assign(player, spawn, { 
                dx: 0, 
                dy: 0,
                jumping: false,
                canDoubleJump: false,
                jumpPressed: false
            });
            
            resetTimer();
            showScreen('start-screen');
            livesDisplay.textContent = lives;
            livesDisplay.classList.remove('hidden');
        }, 9000);
        
        isDying = false;
        return;
    }

    // Tocar som apenas uma vez
    if (lives >= 0) {
        soundSpike.play();
    }

    await pauseGameForSeconds(1);

    // Usa gameState.lastCheckpoint
    const spawn = gameState.lastCheckpoint || gameState.startPosition; // ← Atualizado
    Object.assign(player, spawn, { 
        dx: 0, 
        dy: 0,
        jumping: false,
        canDoubleJump: false,
        jumpPressed: false
    });
    
    isDying = false;
}

function checkCheckpointCollision() {
  gameState.objects.checkpoints.forEach(cp => { // ← Atualizado
    if (!cp.active) return;

    const fake = { x: cp.x, y: cp.y - 40, width: 4, height: 40 };
    if (checkCollision(player, fake)) {
      cp.active = false;
      gameState.lastCheckpoint = { x: cp.x, y: cp.y - player.height - 1 }; // ← Atualizado
      soundCheckpoint.play();
      createConfettiExplosion(cp.x + 20, cp.y);
    }
  });
}

const deathYLimit = 3000; // ajuste se necessário


function update() {
  if (isGamePaused) return;

  // Cálculo normal de movimento com gameSettings
  if (keys.left) player.dx = -gameSettings.playerSpeed;
  else if (keys.right) player.dx = gameSettings.playerSpeed;
  else player.dx *= friction;

  if (keys.jump && !player.jumpPressed) {
    if (!player.jumping) {
      player.dy = gameSettings.jumpForce;
      player.jumping = true;
      player.canDoubleJump = true;
      player.jumpPressed = true;
      soundJump.play();
    } else if (player.canDoubleJump) {
      player.dy = gameSettings.doubleJumpForce;
      player.canDoubleJump = false;
      player.jumpPressed = true;
      soundJump.play();
    }
  } else if (!keys.jump) {
    player.jumpPressed = false;
  }

  player.dy += gravity;
  player.x += player.dx;
  player.y += player.dy;

  enforceCollisions();

  gameState.objects.platforms.forEach(resolveCollision);
  gameState.objects.tiles
    .filter(t => t.type === "ground" || t.type === "ground-grass" || 
             t.type === "ground-grass-right" || t.type === "ground-grass-left")
    .forEach(tile => {
      if (tile.type === "ground-grass" || tile.type === "ground-grass-right" ||
          tile.type === "ground-grass-left") {
        const adjustedTile = {
          x: tile.x,
          y: tile.y + 5,
          width: tile.width,
          height: tile.height - 5
        };
        resolveCollision(adjustedTile);
      } else {
        resolveCollision(tile);
      }
    });

  if (gameState.objects.spikes.some(s => {
    const reducedSpike = {
      x: s.x + 6,
      y: s.y + 4,
      width: s.width - 25,
      height: s.height - 6
    };
    return checkCollision(player, reducedSpike);
  })) {
    if (!isDying) soundSpike.play();
    handleDeath();
  }

  if (gameState.objects.tiles.some(t => t.type === "water" && checkCollision(player, t))) {
    if (!isDying) soundWater.play();
    handleDeath();
  }

  if (player.y > deathYLimit) handleDeath();

  gameState.objects.enemies = gameState.objects.enemies.filter(e => {
    if (e.state === 'die') {
      e.counter++;
      if (e.counter >= e.delay) {
        e.counter = 0;
        e.frame++;
        if (e.frame >= e.frameMax) {
          return false;
        }
      }
      return true;
    }

    checkpointSprite.delayCounter++;
    if (checkpointSprite.delayCounter >= checkpointSprite.frameDelay) {
      checkpointSprite.delayCounter = 0;
      checkpointSprite.currentFrame = (checkpointSprite.currentFrame + 1) % checkpointSprite.frameCount;
    }

    finishSprite.delayCounter++;
    if (finishSprite.delayCounter >= finishSprite.frameDelay) {
      finishSprite.delayCounter = 0;
      finishSprite.currentFrame = (finishSprite.currentFrame + 1) % finishSprite.frameCount;
    }

    lifeSprite.delayCounter++;
    if (lifeSprite.delayCounter >= lifeSprite.frameDelay) {
      lifeSprite.delayCounter = 0;
      lifeSprite.currentFrame = (lifeSprite.currentFrame + 1) % lifeSprite.frameCount;
    }

    coinSprite.delayCounter++;
    if (coinSprite.delayCounter >= coinSprite.frameDelay) {
      coinSprite.delayCounter = 0;
      coinSprite.currentFrame = (coinSprite.currentFrame + 1) % coinSprite.frameCount;
    }

    e.x += e.dx * e.dir;
    e.counter++;
    if (e.counter >= e.delay) {
      e.counter = 0;
      e.frame = (e.frame + 1) % 3;
    }

    if (gameState.objects.tiles.some(t => t.type === "ground" && checkCollision(e, t))) e.dir *= -1;
    if (gameState.objects.platforms.some(p => checkCollision(e, p))) e.dir *= -1;

    const playerFeet = {
      x: player.x + 6,
      y: player.y + player.height - 6,
      width: player.width - 12,
      height: 8
    };
    const enemyHead = {
      x: e.x + 2,
      y: e.y,
      width: e.width - 4,
      height: 10
    };

    if (checkCollision(playerFeet, enemyHead)) {
      e.state = 'die';
      e.frame = 0;
      e.counter = 0;
      e.frameMax = 3;
      player.dy = gameSettings.jumpForce; // Usa o mesmo impulso do pulo
      soundEnemyDie.play();
      return true;
    }

    if (checkCollision(player, e)) {
      if (!isDying) soundEnemy.play();
      handleDeath();
    }

    return true;
  });

  checkCheckpointCollision();

if (gameState.objects.lives) {
    gameState.objects.lives = gameState.objects.lives.filter(life => {
        if (!life.collected && checkCollision(player, life)) {
            life.collected = true;
            gameState.collectedLifeKeys.add(life.key); // ← Agora usando gameState
            
            // Atualiza a exibição de vidas
            lives++;
            livesDisplay.textContent = lives;
            livesDisplay.classList.remove('hidden');
            
            // Toca o efeito sonoro
            soundLife.play();
            return false; // Remove esta vida do array
        }
        return true; // Mantém esta vida no array
    });
}

  if (gameState.objects.coins) {
    gameState.objects.coins = gameState.objects.coins.filter(coin => {
      if (!coin.collected && checkCollision(player, coin)) {
        coin.collected = true;
        soundCoin.play();
        score += 10;
        document.getElementById('score-display').textContent = score;
        createCoinSparkle(coin.x + coin.width / 2, coin.y + coin.height / 2);
        return false;
      }
      return true;
    });
  }

// Em game.js, na função update
if (gameState.objects.finish && gameState.objects.finish.active) {
    const finishBox = {
        x: gameState.objects.finish.x,
        y: gameState.objects.finish.y - 40,
        width: 40,
        height: 120
    };
    if (checkCollision(player, finishBox)) {
        gameState.objects.finish.active = false;
        stopTimer();
        finalTime = elapsedTime;
        soundFinish.play();
        isGamePaused = true;
        
        const totalCoins = gameState.objects.coins ? gameState.objects.coins.length : 0;
        const collectedCoins = gameState.objects.coins ? 
            gameState.objects.coins.filter(c => c.collected).length : 0;
        
        setTimeout(() => {
            levelScreens.showLevelComplete(score, finalTime, collectedCoins, totalCoins);
        }, 1500);
    }
}

  player.x = Math.max(0, Math.min(player.x, getLevelWidth() - player.width));
  targetCameraX = Math.max(0, Math.min(player.x - canvas.width / 2, getLevelWidth() - canvas.width));
  targetCameraY = Math.max(levelMinY, Math.min(player.y - canvas.height / 2, levelMaxY - canvas.height));
  cameraX += (targetCameraX - cameraX) * 0.1;
  cameraY += (targetCameraY - cameraY) * 0.1;

  if (player.dy !== 0) {
    playerSprite.state = 'jump';
  } else if (Math.abs(player.dx) > 1) {
    playerSprite.state = 'walk';
  } else {
    playerSprite.state = 'idle';
  }

  if (player.dx > 0) playerSprite.facing = 'right';
  else if (player.dx < 0) playerSprite.facing = 'left';

  playerSprite.counter++;
  const maxFrames = { idle: 3, walk: 3, jump: 2 };
  if (playerSprite.counter >= playerSprite.delay) {
    playerSprite.counter = 0;
    playerSprite.frame = (playerSprite.frame + 1) % maxFrames[playerSprite.state];
  }

  for (let i = 0; i < coinParticles.length; i++) {
    const p = coinParticles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.05;
    p.life--;
    p.alpha -= 0.03;

    if (p.life <= 0 || p.alpha <= 0) {
      coinParticles.splice(i, 1);
      i--;
    }
  }

  for (let i = 0; i < confettiParticles.length; i++) {
    const p = confettiParticles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.05;
    p.alpha -= 0.02;
    p.life--;

    if (p.life <= 0 || p.alpha <= 0) {
      confettiParticles.splice(i, 1);
      i--;
    }
  }
}


function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Paralaxe de montanhas
  const parallaxX = -cameraX * 0.3;
  ctx.drawImage(mountainLayer, parallaxX, canvas.height - 450);

  // --- ADICIONE ESTES LOGS AQUI ---
 
  if (gameState.objects.lives.length > 0) {
      gameState.objects.lives.forEach((life, index) => {
          
      });
  } else {
     
  }
 

  // Desenha tiles do cenário
  gameState.objects.tiles.forEach(tile => {
    if (tile.type === "ground" && images.ground.complete) {
      ctx.drawImage(images.ground, tile.x - cameraX, tile.y - cameraY, tile.width, tile.height);
    } else if (tile.type === "ground-fake" && images.ground.complete) {
      ctx.drawImage(images.ground, tile.x - cameraX, tile.y - cameraY, tile.width, tile.height);
    } else if (tile.type === "ground-bottom" && images.groundBottom.complete) {
      ctx.drawImage(images.groundBottom, tile.x - cameraX, tile.y - cameraY, tile.width, tile.height);
    } else if (tile.type === "ground-grass" && images.groundGrass.complete) {
      ctx.drawImage(images.groundGrass, tile.x - cameraX, tile.y - cameraY, tile.width, tile.height);
    } else if (tile.type === "ground-grass-right" && images.groundGrassRight.complete) {
      ctx.drawImage(images.groundGrassRight, tile.x - cameraX, tile.y - cameraY, tile.width, tile.height);
    } else if (tile.type === "ground-grass-left" && images.groundGrassLeft.complete) {
      ctx.drawImage(images.groundGrassLeft, tile.x - cameraX, tile.y - cameraY, tile.width, tile.height);
    } else if (tile.type === "decoGrass" && images.decoGrass.complete) {
      ctx.drawImage(images.decoGrass, tile.x - cameraX, tile.y - cameraY, tile.width, tile.height);
    } else if (tile.type === "decor01" && images.decor01.complete) {
      ctx.drawImage(images.decor01, tile.x - cameraX, tile.y - cameraY, tile.width, tile.height);
    } else if (tile.type === "water" && waterSprite.image.complete) {
      drawAnimatedWater(tile);
    } else {
      ctx.fillStyle = tile.color;
      ctx.fillRect(tile.x - cameraX, tile.y - cameraY, tile.width, tile.height);
    }
  });

  // Desenha plataformas
  gameState.objects.platforms.forEach(p => {
    if (images.platform.complete) {
      ctx.drawImage(images.platform, p.x - cameraX, p.y - cameraY, p.width, p.height);
    } else {
      ctx.fillStyle = "#e53935";
      ctx.fillRect(p.x - cameraX, p.y - cameraY, p.width, p.height);
    }
  });

  // Desenha espinhos
  gameState.objects.spikes.forEach(s => {
    if (images.spike.complete) {
      ctx.drawImage(images.spike, s.x - cameraX, s.y - cameraY, s.width, s.height);
    }
  });

  // Desenha checkpoints
  gameState.objects.checkpoints.forEach(cp => {
    ctx.drawImage(
      checkpointSprite.image,
      checkpointSprite.currentFrame * checkpointSprite.frameWidth, 0,
      checkpointSprite.frameWidth, checkpointSprite.frameHeight,
      cp.x - cameraX, cp.y - cameraY - checkpointSprite.frameHeight + 40,
      checkpointSprite.frameWidth, checkpointSprite.frameHeight
    );
  });

  // Desenha finish
  if (gameState.objects.finish) {
    ctx.drawImage(
      finishSprite.image,
      finishSprite.currentFrame * finishSprite.frameWidth, 0,
      finishSprite.frameWidth, finishSprite.frameHeight,
      gameState.objects.finish.x - cameraX,
      gameState.objects.finish.y - cameraY - finishSprite.frameHeight + 40,
      finishSprite.frameWidth,
      finishSprite.frameHeight
    );
  }

  // Desenha inimigos
  gameState.objects.enemies.forEach(e => {
    const eSpriteSet = e.state;
    const eFrame = e.frame;
    const eFlipped = e.dir < 0 ? 'Flipped' : '';
    const eImgKey = e.name + eSpriteSet.charAt(0).toUpperCase() + eSpriteSet.slice(1) + eFlipped;
    const eImage = images[eImgKey];
    const eSx = eFrame * 40;

    if (eImage && eImage.complete) {
      ctx.drawImage(eImage, eSx, 0, 40, 40, e.x - cameraX, e.y - cameraY, 40, 40);
    } else {
      ctx.fillStyle = '#000';
      ctx.fillRect(e.x - cameraX, e.y - cameraY, e.width, e.height);
    }
  });

  // Desenha vidas
if (gameState.objects.lives) {
    
    gameState.objects.lives.forEach(life => {
        // Adicione este log dentro do loop
        

        // AQUI ESTÁ SEU CÓDIGO ATUAL QUE NÃO TEM O if (!life.collected)
        const sx = lifeSprite.currentFrame * lifeSprite.frameWidth;
        ctx.drawImage(
            lifeSprite.image,
            sx, 0, lifeSprite.frameWidth, lifeSprite.frameHeight,
            life.x - cameraX, life.y - cameraY,
            life.width, life.height
        );
    });
}

  if (gameState.objects.coins) {
    gameState.objects.coins.forEach(coin => {
      const sx = coinSprite.currentFrame * coinSprite.frameWidth;
      ctx.drawImage(
        coinSprite.image,
        sx, 0, coinSprite.frameWidth, coinSprite.frameHeight,
        coin.x - cameraX, coin.y - cameraY,
        coin.width, coin.height
      );
    });
  }

  // Desenha partículas das moedas
  coinParticles.forEach(p => {
    ctx.fillStyle = `rgba(255, 215, 0, ${p.alpha})`;
    ctx.beginPath();
    ctx.arc(p.x - cameraX, p.y - cameraY, p.size, 0, Math.PI * 2);
    ctx.fill();
  });

  // Desenha partículas do checkpoint
  confettiParticles.forEach(p => {
    ctx.fillStyle = `rgba(${hexToRgb(p.color)}, ${p.alpha})`;
    ctx.beginPath();
    ctx.fillRect(p.x - cameraX, p.y - cameraY, p.size, p.size);
  });

  // Verifica colisão com água
  const isInWater = gameState.objects.tiles.some(tile => 
    tile.type === "water" && 
    player.x + player.width > tile.x && 
    player.x < tile.x + tile.width && 
    player.y + player.height > tile.y && 
    player.y < tile.y + tile.height
  );

  // Efeito splash ao entrar na água
  if (isInWater && !player.wasInWater) {
    createWaterSplash(player.x + player.width/2, player.y + player.height);
  }
  player.wasInWater = isInWater;

  // Desenha partículas da água
  drawWaterParticles();

  // Desenha o player apenas se não estiver na água
  if (!isInWater) {
    drawPlayer();
  }
}

function drawPlayer() {
  const spriteSet = playerSprite.state;
  const frame = playerSprite.frame;
  const imgKey = spriteSet + (playerSprite.facing === 'left' ? 'Flipped' : '');
  const image = images[imgKey];
  const sx = frame * 40;

  if (image.complete) {
    ctx.drawImage(image, sx, 0, 40, 40, player.x - cameraX, player.y - cameraY, 40, 40);
  } else {
    ctx.fillStyle = '#4caf50';
    ctx.fillRect(player.x - cameraX, player.y - cameraY, player.width, player.height);
  }
}

function loop(timestamp) {
  if (!lastFrameTime) lastFrameTime = timestamp;
  deltaTime += timestamp - lastFrameTime;
  lastFrameTime = timestamp;
  
  // Controle de frame rate com garantia de atualização mínima
  let updatesCount = 0;
  while (deltaTime >= frameTime && updatesCount < maxFrameSkip) {
    update();
    deltaTime -= frameTime;
    updatesCount++;
  }
  
  // Garante pelo menos uma atualização física mesmo com FPS muito baixo
  if (updatesCount === 0) {
    update();
    deltaTime = 0;
  }
  
  updateWaterAnimation();
  draw();
  
  animationFrameId = requestAnimationFrame(loop);
}

function initGame() {
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  // Inicializa o sistema de níveis
  levels.init();

  // Configura o botão de início
  document.getElementById('start-btn').addEventListener('click', () => {
    levels.loadLevel(0); // Carrega o nível 0 (primeiro nível)
    levelScreens.showLevelIntro(levels.getCurrentLevel().name);
  });

  // Mostra a vinheta apenas se NÃO foi vista antes
  const hasSeenIntro = sessionStorage.getItem('vinheta-exibida');
  
  if (!hasSeenIntro) {
    showScreen('intro-screen');
    setTimeout(() => {
      showScreen('vinheta-screen');
    }, 3000);
  } else {
    showScreen('start-screen');
  }
  
  // Configura o volume dos efeitos sonoros
  [soundLife, soundSpike, soundCoin, soundWater, soundEnemy, soundEnemyDie, 
   soundCheckpoint, soundFinish, soundJump].forEach(sound => {
    if (sound) sound.volume = 0.7;
  });
}




document.addEventListener("keydown", e => {
  if (e.key === "ArrowLeft") keys.left = true;
  if (e.key === "ArrowRight") keys.right = true;
  if (e.key === " " || e.key === "ArrowUp") keys.jump = true;
});

document.addEventListener("keyup", e => {
  if (e.key === "ArrowLeft") keys.left = false;
  if (e.key === "ArrowRight") keys.right = false;
  if (e.key === " " || e.key === "ArrowUp") keys.jump = false;
});

const leftBtn = document.getElementById("left");
const rightBtn = document.getElementById("right");
const jumpBtn = document.getElementById("jump");

if (leftBtn && rightBtn && jumpBtn) { // Verifica se os botões existem
    leftBtn.addEventListener("touchstart", () => keys.left = true, { passive: true });
    leftBtn.addEventListener("touchend", () => keys.left = false, { passive: true });
    
    rightBtn.addEventListener("touchstart", () => keys.right = true, { passive: true });
    rightBtn.addEventListener("touchend", () => keys.right = false, { passive: true });
    
    jumpBtn.addEventListener("touchstart", () => keys.jump = true, { passive: true });
    jumpBtn.addEventListener("touchend", () => keys.jump = false, { passive: true });
}

// Event listeners para os botões das telas



document.getElementById('resume-btn').addEventListener('click', togglePause);
document.getElementById('menu-btn').addEventListener('click', togglePause);





// Inicializa o jogo quando o DOM estiver pronto
document.addEventListener("DOMContentLoaded", initGame);

document.getElementById('vinheta-ok-btn').addEventListener('click', () => {
  // Toca a música de início apenas se não estiver tocando já
  if (currentMusic !== musicStart) {
    if (currentMusic) {
      currentMusic.pause();
      currentMusic.currentTime = 0;
    }
    musicStart.loop = false;
    musicStart.play().catch(e => console.log("Erro ao tocar música inicial:", e));
    currentMusic = musicStart;
  }
  showScreen('start-screen');
});


export { startGame, formatTime, finalTime, currentMusic, playMusic};  // Export múltiplo