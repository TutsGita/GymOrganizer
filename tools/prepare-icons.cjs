const fs = require('node:fs');
const path = require('node:path');

const source = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const names = {
  fitness: 'fitness-fill',
  plus: 'add-fill',
  check: 'check-fill',
  play: 'play-fill',
  list: 'list-check-fill',
  history: 'history-fill',
  search: 'search-fill',
  edit: 'edit-2-fill',
  trash: 'delete-2-fill',
  info: 'information-fill',
  timer: 'stopwatch-fill',
  back: 'left-fill',
  next: 'right-fill',
  close: 'close-fill'
};

const icons = Object.fromEntries(Object.entries(names).map(([name, key]) => {
  const icon = source.icons[key];
  if (!icon) throw new Error(`Ícone ausente: ${key}`);
  return [name, icon.body];
}));
const output = path.join(__dirname, '../app/src/main/assets/icons.js');
fs.writeFileSync(output, '// Vetores MingCute distribuídos sob Apache-2.0.\nwindow.GYM_ICONS = ' + JSON.stringify(icons, null, 2) + ';\n');
