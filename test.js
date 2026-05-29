import fs from 'fs';
let indexCss = fs.readFileSync('src/index.css', 'utf-8');
indexCss = `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n` + indexCss;
fs.writeFileSync('src/index.css', indexCss);
