import { bootstrap } from './app/bootstrap.js';

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./public/sw.js').catch((error) => console.warn('Service worker registration failed', error));
}

bootstrap(document.querySelector('#app')).catch((error) => {
  console.error(error);
  const root = document.querySelector('#app');
  if (root) root.textContent = 'LabelOnZeWay 3.5 failed to start.';
});
