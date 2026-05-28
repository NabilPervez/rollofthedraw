import fs from 'fs';
let code = fs.readFileSync('RollOfTheDraw.jsx', 'utf-8');
code = code.replace(/const ACTIVE_CARDS = \[[\s\S]*?\];/m, `import ACTIVE_CARDS from './data/activeCards.json';`);
code = code.replace(/const JOKERS = \[[\s\S]*?\];/m, `import JOKERS from './data/jokers.json';`);
fs.writeFileSync('src/App.jsx', code);
