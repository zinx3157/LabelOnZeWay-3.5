import { bootstrap } from './app/bootstrap.js';
import './styles/tokens.css';
import './styles/app.css';
import './styles/workflows.css';

bootstrap(document.querySelector('#app')).catch((error) => {
  console.error(error);
  const root = document.querySelector('#app');
  if (root) root.textContent = 'LabelOnZeWay 3.5 failed to start.';
});
