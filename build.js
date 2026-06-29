const fs = require('fs');
const path = require('path');

const solverPath = path.join(__dirname, 'solver.js');
const templatePath = path.join(__dirname, 'template.html');
const outputPath = path.join(__dirname, 'index.html');

console.log('Reading solver.js...');
let solverContent = fs.readFileSync(solverPath, 'utf8');

console.log('Reading math engines...');
let isoContent = fs.readFileSync(path.join(__dirname, '../iso_965.js'), 'utf8');
let asmeContent = fs.readFileSync(path.join(__dirname, '../asme_b1_1.js'), 'utf8');

console.log('Reading template.html...');
let templateContent = fs.readFileSync(templatePath, 'utf8');

console.log('Injecting JS into template...');
let finalHtml = templateContent.replace('// --- INJECTED_SOLVER_JS ---', solverContent);
finalHtml = finalHtml.replace('// --- INJECTED_METRIC_JS ---', isoContent);
finalHtml = finalHtml.replace('// --- INJECTED_IMPERIAL_JS ---', asmeContent);

fs.writeFileSync(outputPath, finalHtml, 'utf8');
console.log('Successfully built index.html!');
