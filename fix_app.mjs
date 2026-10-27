import fs from 'fs';
const p = 'src/App.jsx';
let c = fs.readFileSync(p, 'utf8');
let n = c.replace("from './data/model.js'", "from './model.js'");
if (n !== c) {
  fs.writeFileSync(p, n);
  console.log('updated');
} else {
  console.log('no change');
}
