import { baseHeight } from '../src/game/worldData';
for (let z=-9000; z<=-4000; z+=500){ let r=''; for (let x=3000;x<=10000;x+=500) r+=String(Math.round(baseHeight(x,z)/100)).padStart(3); console.log(z, r);}
