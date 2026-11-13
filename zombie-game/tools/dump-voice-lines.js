const {chromium}=require('playwright');(async()=>{
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});const p=await b.newPage();
const T=__dirname+'/three/package/';
for(const [u,f] of [['**/three.min.js','build/three.min.js'],['**/GLTFLoader.js','examples/js/loaders/GLTFLoader.js'],['**/SkeletonUtils.js','examples/js/utils/SkeletonUtils.js']])await p.route(u,r=>r.fulfill({path:T+f,contentType:'application/javascript'}));
await p.route('**/fonts.googleapis.com/**',r=>r.fulfill({body:'',contentType:'text/css'}));
await p.goto('http://localhost:8765/index.html');await p.waitForFunction(()=>G.state==='menu',null,{timeout:120000});
const L=await p.evaluate(()=>{const out=[];const add=(who,text)=>{if(text)out.push({who,text,key:VOICE.key(who,text)});};
 for(const A of AREAS)for(const k in A.radio)for(const l of A.radio[k])add(l.who,l.text);
 for(const s of INTRO_SHOTS){if(s.radio)for(const l of s.radio)add(l.who,l.text);else add('NARRATOR',s.text);}
 for(const l of ENDING_RADIO)add(l.who,l.text);for(const E of Object.values(ENDINGS))for(const t of E.lines)add('NARRATOR',t);
 for(const t of TRIPS)for(const l of t.lines)add(l.who,l.text);
 const seen=new Set();return out.filter(o=>!seen.has(o.key)&&seen.add(o.key));});
require('fs').writeFileSync(__dirname+'/lines.json',JSON.stringify(L,null,1));console.log(L.length,'lines');await b.close();})();
