import { startGame, formatTime, finalTime, audio as audioManager } from './game.js';
import { levels, gameState } from './levels.js';

// Gerenciador de telas (screens)
const levelScreens = {
  showLevelIntro: function (levelName) {
    // Remove tela anterior se existir
    const existingScreen = document.getElementById('level-intro-screen');
    if (existingScreen) {
      document.body.removeChild(existingScreen);
    }

    // Cria nova tela de introdução do nível
    const screen = document.createElement('div');
    screen.id = 'level-intro-screen';
    screen.className = 'screen';
    screen.innerHTML = `
      <div class="screen-content">
        <h1>${levelName}</h1>
        <div class="level-number">Nível ${levels.currentLevel + 1}/${levels.totalLevels}</div>
        <button id="start-level-btn" class="menu-btn">Começar</button>
      </div>
    `;
    document.body.appendChild(screen);

    

    

    // Botão "Começar"
    document.getElementById('start-level-btn').addEventListener('click', () => {
      document.body.removeChild(screen);
      startGame(); // Inicia o nível
    });

    // Toca música de introdução do nível (opcional)
    const introMusic = levels.getCurrentLevel()?.introMusic;
    if (introMusic) {
      audioManager.playMusic(introMusic, false); // false = sem loop
    } else {
      audioManager.stopMusic(); // Ou para qualquer música anterior
    }
  },

showLevelComplete: function (score, time, collectedCoins, totalCoins) {
    const screen = document.getElementById('results-screen');
    screen.classList.remove('hidden');

    // Atualiza estatísticas na tela
    document.getElementById('result-score').textContent = score;
    document.getElementById('result-time').textContent = formatTime(time, true);
    document.getElementById('result-level').textContent = levels.currentLevel + 1; // Nível atual (1-based)
    document.getElementById('result-lives').textContent = gameState.lives || 3;
    
    // Adiciona o título do nível
    const levelTitle = document.createElement('h2');
    levelTitle.textContent = levels.getCurrentLevel().name;
    const existingTitle = screen.querySelector('h2');
    if (existingTitle) {
        existingTitle.replaceWith(levelTitle);
    } else {
        const h1 = screen.querySelector('h1');
        h1.insertAdjacentElement('afterend', levelTitle);
    }

    const coinElement = document.getElementById('result-coins');
    if (coinElement) {
      coinElement.textContent = `${collectedCoins}/${totalCoins}`;
    }

    // Botão: Próximo nível
    const nextBtn = document.getElementById('next-level-btn');
   nextBtn.onclick = () => {
  screen.classList.add('hidden');

  if (levels.nextLevel()) {
    // Para a música do nível anterior ANTES de iniciar o próximo
    audioManager.stopMusic(); 
    
    this.showLevelIntro(levels.getCurrentLevel().name);
  } else {
    showScreen('start-screen');
  }
};

    // Botão: Repetir nível
    const retryBtn = document.getElementById('retry-level-btn');
    retryBtn.onclick = () => {
      screen.classList.add('hidden');
      levels.reloadLevel();
      startGame();
    };

    // Botão: Voltar ao menu principal
    const menuBtn = document.getElementById('main-menu-btn');
    menuBtn.onclick = () => {
      screen.classList.add('hidden');
      showScreen('start-screen');
    };

    // Som de vitória
    const victorySound = document.getElementById('sound_complete');
    if (victorySound) {
      victorySound.play().catch((e) => console.warn("Erro ao tocar som:", e));
    }

    // Música de vitória (opcional)
    if (levels.getCurrentLevel()?.victoryMusic) {
      audioManager.playMusic(levels.getCurrentLevel().victoryMusic, false);
    }
  }
};

export { levelScreens };
