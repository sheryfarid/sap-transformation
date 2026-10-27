const fs = require('fs');
const files = [
  'src/App.jsx'
];
files.forEach(p => {
  let c = fs.readFileSync(p, 'utf8');
  let n = c.replace("from './data/model.js'", "from './model.js'");
  if (n !== c) {
    fs.writeFileSync(p, n);
    console.log('updated', p);
  } else {
    console.log('no change', p);
  }
});
