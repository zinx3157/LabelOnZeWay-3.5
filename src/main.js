import { bootstrap } from './app/bootstrap.js';

const localSecureContext = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
if ('serviceWorker' in navigator && (location.protocol === 'https:' || localSecureContext)) {
  navigator.serviceWorker.register('./sw.js').catch((error) => console.warn('Service worker registration failed', error));
}

bootstrap(document.querySelector('#app')).catch((error) => {
  console.error(error);
  const root = document.querySelector('#app');
  if (root) root.textContent = 'LZWay 3.5 failed to start.';
});
