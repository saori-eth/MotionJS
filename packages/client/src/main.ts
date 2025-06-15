import { Game } from './game/Game';

const appElement = document.getElementById('app');
if (!appElement) throw new Error('App element not found');

const game = new Game(appElement);

const lobby = document.createElement('div');
lobby.className = 'lobby';
lobby.innerHTML = `
  <h1>MotionJS</h1>
  <button id="play-btn">Play</button>
`;

appElement.appendChild(lobby);

document.getElementById('play-btn')?.addEventListener('click', () => {
  const roomId = 'default';
  lobby.remove();
  game.joinRoom(roomId);
});