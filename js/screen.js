import { startGame, formatTime, currentMusic, finalTime,  playMusic  } from './game.js';
import { levels, gameState } from './levels.js';  // Adicione esta linha


// js/screens.js - Novo arquivo para gerenciar telas adicionais
const levelScreens = {
    showLevelIntro: function(levelName) {
    // Remove a tela anterior se existir
    const existingScreen = document.getElementById('level-intro-screen');
    if (existingScreen) {
        document.body.removeChild(existingScreen);
    }

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
    
    // Adiciona o event listener CORRETAMENTE
    document.getElementById('start-level-btn').addEventListener('click', () => {
        document.body.removeChild(screen);
        startGame(); // Chama a função diretamente
    });
    
    // Toca o som de introdução
    //const introMusic = new Audio('sound/intro.mp3');
//introMusic.loop = false;
//playMusic(introMusic);
    
},
    
showLevelComplete: function(score, time, collectedCoins, totalCoins) {
  const screen = document.getElementById('results-screen');
  screen.classList.remove('hidden');

  // Atualiza os valores nos elementos existentes
  document.getElementById('result-score').textContent = score;
  document.getElementById('result-time').textContent = formatTime(time, true);
  document.getElementById('result-level').textContent = levels.getCurrentLevel().number || 1;
  document.getElementById('result-lives').textContent = gameState.lives || 3;

  // Se quiser exibir também moedas:
  const coinElement = document.getElementById('result-coins');
  if (coinElement) {
    coinElement.textContent = `${collectedCoins}/${totalCoins}`;
  }

  // Botão: Próximo Nível
  const nextBtn = document.getElementById('next-level-btn');
  nextBtn.onclick = () => {
    screen.classList.add('hidden');
    if (levels.nextLevel()) {
      this.showLevelIntro(levels.getCurrentLevel().name);
    } else {
      showScreen('start-screen');
    }
  };

  // Botão: Repetir Nível
  const retryBtn = document.getElementById('retry-level-btn');
  retryBtn.onclick = () => {
    screen.classList.add('hidden');
    levels.reloadLevel();
    startGame();
  };

  // Botão: Menu Principal
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
}

};

export { levelScreens };