import { terrainHeight, AIRPORTS, CITIES } from '../src/game/worldData';
const step = 800; let out = '';
for (let z = -22000; z <= 22000; z += step) {
  let row = '';
  for (let x = -22000; x <= 22000; x += step / 2) {
    const h = terrainHeight(x, z);
    let c = h < -40 ? ' ' : h < 0 ? '.' : h < 30 ? ',' : h < 150 ? 'o' : h < 500 ? 'O' : h < 1200 ? '#' : '@';
    for (const a of AIRPORTS) if (Math.abs(a.x - x) < step / 4 && Math.abs(a.z - z) < step / 2) c = 'A';
    for (const a of CITIES) if (Math.abs(a.x - x) < step / 4 && Math.abs(a.z - z) < step / 2) c = 'C';
    row += c;
  }
  out += row + '\n';
}
console.log(out);
for (const a of AIRPORTS) console.log(a.id, a.elev, terrainHeight(a.x, a.z).toFixed(1), 'ends', terrainHeight(a.x + a.fwd.x * a.length / 2, a.z + a.fwd.z * a.length / 2).toFixed(1));
for (const c of CITIES) console.log(c.id, c.elev, terrainHeight(c.x, c.z).toFixed(1), terrainHeight(c.x + c.r*0.8, c.z).toFixed(1));
let t=Date.now(); let s=0; for(let i=0;i<30000;i++) s+=terrainHeight(i*7.3,i*3.1); console.log('30k evals ms', Date.now()-t);
