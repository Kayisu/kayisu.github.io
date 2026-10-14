import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
async function verifyPublished(){
 const files=['index.html','app.js','engine.js','style.css','catalog.json','catalog-audit.json','mannequin.js','mannequin-textures.json'],expected=new Map();
 for(const path of files)expected.set(path,await readFile(new URL('../../public/kendince/'+path,import.meta.url)));
 const token=process.env.GITHUB_SHA?.slice(0,12)||Date.now().toString();let failures=[];
 for(let attempt=0;attempt<8;attempt++){
  const outcomes=await Promise.allSettled(files.map(async path=>{
   const url='https://kayisu.github.io/kendince/'+path+'?verify='+token+'&attempt='+attempt,response=await fetch(url,{signal:AbortSignal.timeout(15000),cache:'no-store'});
   if(!response.ok)throw Error(path+' HTTP '+response.status);
   const body=Buffer.from(await response.arrayBuffer()),hash=b=>createHash('sha256').update(b).digest('hex');
   if(hash(body)!==hash(expected.get(path)))throw Error(path+' content differs');
   return path;
  }));
  failures=outcomes.flatMap((r,i)=>r.status==='rejected'?[files[i]+': '+String(r.reason)]:[]);
  if(!failures.length){console.log('LIVE VERIFIED: '+files.join(', '));return;}
  console.log('Publication check '+(attempt+1)+': '+failures.join('; '));
  if(attempt<7)await new Promise(resolve=>setTimeout(resolve,8000));
 }
 throw Error('Published files did not match: '+failures.join('; '));
}
await verifyPublished();
