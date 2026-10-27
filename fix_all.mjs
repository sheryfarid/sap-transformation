import fs from 'fs';
import path from 'path';
const root = 'src';
function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p);
    else if (p.endsWith('.js') || p.endsWith('.jsx')) {
      let s = fs.readFileSync(p, 'utf8');
      let n = s.replace(/from ['"]\.\/data\/model\.js['"]/g, "from './model.js'");
      n = n.replace(/from ['"]\.\.\/data\/model\.js['"]/g, "from '../model.js'");
      if (n !== s) {
        fs.writeFileSync(p, n);
        console.log('updated', p);
      }
    }
  }
}
walk(root);
