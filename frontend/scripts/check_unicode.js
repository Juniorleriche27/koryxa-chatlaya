const { readdirSync, readFileSync } = require('fs');
const { join } = require('path');

const roots = ['app','components','lib','styles'];
const legacySkip = [/\bapp[\\\/]chat-laya[\\\/]/];
const exts = new Set(['.ts','.tsx','.js','.jsx','.json','.md','.mdx','.css']);

function walk(dir){
  for(const name of readdirSync(dir, { withFileTypes: true })){
    const p = join(dir, name.name);
    if(name.isDirectory()) walk(p); else {
      const ext = name.name.slice(name.name.lastIndexOf('.'));
      if(!exts.has(ext)) continue;
      const text = readFileSync(p, 'utf8');
      if (legacySkip.some((re)=> re.test(p))) {
        continue; // ignore legacy path for compatibility
      }
      if(/\\u00/i.test(text)){
        console.error(`[unicode-escape] Found \\u00.. in: ${p}`);
        process.exitCode = 1;
      }
      if(/Chat[- ]?LAYA|Chat Laya/.test(text)){
        console.error(`[koryxa] Non-uniform naming in: ${p}`);
        process.exitCode = 1;
      }
    }
  }
}

for(const r of roots) walk(join(process.cwd(), r));
if(process.exitCode){
  if(process.env.STRICT_CHECK === '1'){
    console.error('\nBuild check failed: replace unicode escapes and unify CHATLAYA naming.');
    process.exit(process.exitCode);
  } else {
    console.warn('\n[warn] Prebuild check reported issues, but STRICT_CHECK is not set; continuing build.');
    process.exitCode = 0;
  }
} else {
  console.log('Unicode/CHATLAYA check passed.');
}
