// Campaign script: Seoul events, Double Dungeon (Statue of God), System awakening, Venom Cave, Job Change / Igris, Penalty Zone.
import * as THREE from 'three';
import type { Enemy, Game } from './game';
import { useFade } from './game';
import { bus, useGame, useHud } from './store';
import { input } from './input';
import { GATE_INFO } from './data';
import { addTalkNPC, spawnCitizens } from './npcs';
import { removeEnemy } from './enemies';
import { summonDefault } from './army';
import { makeLabel } from './models';

let G: Game;
let dlgCb: ((c?: string) => void) | null = null;
let bound = false;
const st = () => useGame.getState();
const sv = () => useGame.getState().save;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

function setChapter(c: number) {
  useGame.setState((s) => ({ save: { ...s.save, chapter: c } }));
  G?.refreshModel();
}
function resetQuest(id: string, n: number) {
  useGame.setState((s) => {
    const q = { ...s.save.quests };
    q[id] = { state: 'active', prog: Array(n).fill(0) };
    return { save: { ...s.save, quests: q } };
  });
}
function dialog(
  name: string,
  lines: string[],
  o: { choices?: { label: string; id: string }[]; color?: string; done?: (c?: string) => void } = {}
) {
  input.unlock();
  dlgCb = o.done || null;
  st().setDialog({ name, lines, idx: 0, choices: o.choices, npc: name, color: o.color });
}
function bind() {
  if (bound) return;
  bound = true;
  bus.on('dialogAdvance', () => {
    const d = st().dialog;
    if (!d) return;
    if (d.idx < d.lines.length - 1) {
      st().setDialog({ ...d, idx: d.idx + 1 });
      bus.emit('sfx', 'ui');
    } else if (!d.choices) {
      st().setDialog(null);
      const cb = dlgCb;
      dlgCb = null;
      cb?.();
    }
  });
  bus.on('dialogChoice', (id: string) => {
    st().setDialog(null);
    const cb = dlgCb;
    dlgCb = null;
    cb?.(id);
  });
  bus.on('summonDefault', () => summonDefault(G));
  bus.on('questDone', (id: string) => onQuestDone(id));
  bus.on('acceptSystem', () => finishAwakening());
}
function system(text: string, dur = 4) {
  G.say(text, 'SYSTEM', dur);
  bus.emit('sfx', 'system');
}

// ======================================================================= ENTER
export function onEnter(g: Game, id: string, opts: any = {}) {
  G = g;
  bind();
  g.interacts = [];
  useHud.setState({ timer: null, boss: null });
  if (id === 'seoul') seoulEnter(g, opts);
  else if (id === 'double') templeEnter(g, opts);
  else if (id === 'venom') caveEnter(g);
  else if (id === 'job') jobEnter(g);
  else if (id === 'raid') raidEnter(g);
  else penaltyEnter(g);
}

// ======================================================================= SEOUL
const lookF = { skin: 0xf2d2b6, hair: 0x111116, top: 0x2a3a5a, pants: 0x1c1c24 };
function talkLines(id: string): { lines: string[]; name: string } {
  const ch = sv().chapter;
  const A = ch >= 3,
    B = ch >= 5;
  const T: Record<string, [string, string[]]> = {
    songchiyul: [
      'Song Chi-Yul',
      ch <= 1
        ? [
            "Song Chi-Yul, D-Rank. You're the E-Rank they keep dragging along, right?",
            'Try not to slow us down in there.',
          ]
        : ch === 2
          ? ["The gate's stable, they say. Just another D-Rank dungeon.", 'Stay behind me and you will be fine, Sung.']
          : ['I heard what happened inside that temple... and that you walked out alone.', 'Who are you, really?'],
    ],
    kimsangshik: [
      'Kim Sang-Shik',
      ch <= 2
        ? ['Mr. Kim here. Twenty years a C-Rank, and I still get nervous at gates.', "Let's all go home alive, yes?"]
        : ["Jin-Woo... your eyes have changed. Whatever happened in there, I'm glad you're alive."],
    ],
    joohee: [
      'Lee Joohee',
      ch === 0
        ? ['Jin-Woo! A gate leaked right in the street, are you okay?!']
        : ['Jin-Woo! Always running into danger...', 'Take care of yourself. I mean it.'],
    ],
    yoojinho: [
      'Yoo Jin-Ho',
      A
        ? ['Whoa, Jin-Woo! You look... different. Stronger.', 'Someday I want to fight beside you.']
        : ['Hey! My dad says I need to train every morning. Race you to the park fountain?'],
    ],
    chahaein: [
      'Cha Hae-In',
      B
        ? ['That mana... it is overwhelming. Who are you, Sung Jin-Woo?', 'I want to see where you are going.']
        : A
          ? ['...You smell different. Like something old and deep. Strange.']
          : ["An E-Rank at a Guild door? ...Hm. You don't feel like one."],
    ],
    gogunhee: [
      'Go Gun-Hee',
      A
        ? [
            'Sung Jin-Woo. Chairman Go Gun-Hee. I have read the Double Dungeon report, E-Rank who walked out alone.',
            'Keep growing. The Association needs hunters like you.',
          ]
        : ['Hm? Another E-Rank volunteer? Be careful out there, young man.'],
    ],
    choijongin: [
      'Choi Jong-In',
      B
        ? ['Hunters Guild would welcome you, Sung. Think about it.']
        : ["Don't loiter at our door, hunter. The Hunters Guild has work to do."],
    ],
    baekyoonho: ['Baek Yoon-Ho', ["...Hmph. You're not bad. Come see me when you're stronger."]],
    woojinchul: ['Woo Jin-Chul', ['Woo Jin-Chul, S-Rank. Gate raids are my day job. Stay out of my way.']],
    mom: [
      'Mom',
      [
        "Jin-Woo, you're home! Eat something before you go out again.",
        "Your sister's been worried sick. Please... be careful.",
      ],
    ],
    jinah: ['Sung Jin-Ah', ["Oppa! Don't get hurt, okay? ...Promise me."]],
  };
  const [name, lines] = T[id];
  return { name, lines };
}
function seoulEnter(g: Game, o: any) {
  const z = g.zone;
  const s = sv();
  const ch = s.chapter;
  const S = (g.state.seoul = {
    eventT: 70,
    nextDaily: -1,
    event: null as any,
    trainT: 0,
    trainCd: { pushup: 0, situp: 0 } as Record<string, number>,
    leakGate: null as any,
    goblinT: -1,
    raidGate: null as any,
  });
  spawnCitizens(g, st().settings.npcDensity);
  const T = (
    id: string,
    x: number,
    zz: number,
    yaw: number,
    look: any,
    onTalk?: () => void,
    cond?: () => boolean,
    sub?: string,
    color?: string
  ) => {
    const l = talkLines(id);
    addTalkNPC(g, {
      id,
      name: l.name,
      sub,
      x,
      z: zz,
      yaw,
      look,
      color,
      cond,
      onTalk: onTalk || (() => dialog(talkLines(id).name, talkLines(id).lines, { color })),
    });
  };
  const [hx, hz] = z.anchors.hq;
  addTalkNPC(g, {
    id: 'reception',
    name: 'Association Receptionist',
    sub: 'Hunter Association',
    x: z.anchors.reception[0],
    z: z.anchors.reception[1] - 1.8,
    yaw: 0,
    r: 5.5,
    look: { ...lookF, hair: 0x2a1a10, hs: 'bun', top: 0xe8eefc, pants: 0x2a3a5a },
    onTalk: receptionTalk,
  });
  T(
    'gogunhee',
    hx + 11,
    hz - 5,
    -1,
    { skin: 0xe0c4a8, hair: 0xdddddd, hs: 'short', top: 0x1a1a24, pants: 0x1a1a24, coat: 0x1a1a24, b: 1.1 },
    undefined,
    undefined,
    'Chairman'
  );
  T(
    'chahaein',
    98,
    -76,
    0.4,
    {
      hair: 0xe8d070,
      hs: 'long',
      top: 0xf0f0f4,
      top2: 0x4a5a8a,
      pants: 0x2a3040,
      weapon: 'steel',
      wtype: 'sword',
      skin: 0xf6dcc4,
    },
    undefined,
    undefined,
    'Hunters Guild',
    '#ffe08a'
  );
  T(
    'choijongin',
    104,
    -76,
    -0.4,
    { hair: 0x2a1a10, hs: 'short', top: 0x6a2a1a, pants: 0x1a1a24, coat: 0x8a3a20, b: 1.1 },
    undefined,
    undefined,
    'Guild Master',
    '#ffe08a'
  );
  T(
    'baekyoonho',
    30,
    -81,
    0,
    { hair: 0xeeeeee, hs: 'short', top: 0xe8eefc, pants: 0x2a2a34, coat: 0xe8eefc, b: 1.25, scale: 1.08 },
    undefined,
    undefined,
    'White Tiger Guild',
    '#ffffff'
  );
  T(
    'woojinchul',
    -44,
    -22,
    1,
    { hair: 0x1a1a22, hs: 'spiky', top: 0x3a2a2a, pants: 0x1c1c24, b: 1.2, scale: 1.06, weapon: 'killer' },
    undefined,
    undefined,
    'S-Rank Hunter'
  );
  T(
    'joohee',
    -61,
    38,
    -1,
    { hair: 0x6a3a20, hs: 'long', top: 0xe08a8a, pants: 0x3a4a6a, skin: 0xf6dcc4 },
    joohee,
    undefined,
    'Friend'
  );
  T(
    'yoojinho',
    -40,
    36,
    1,
    { hair: 0x3a2a1a, hs: 'spiky', top: 0x4a8aca, pants: 0x2a2a34 },
    undefined,
    undefined,
    'Hunter'
  );
  T(
    'mom',
    z.anchors.family[0] - 1,
    z.anchors.family[1],
    0,
    { hair: 0x8a8a92, hs: 'bun', top: 0x8a6a8a, pants: 0x3a3a4a, skin: 0xeccbb0 },
    () =>
      dialog('Mom', talkLines('mom').lines, {
        done: () => {
          G.P.hp = G.derived.maxHp;
          G.P.mp = G.derived.maxMp;
          st().notify({ title: "MOM'S COOKING", text: 'HP and MP fully restored.' });
        },
      }),
    undefined,
    'Family'
  );
  T(
    'jinah',
    z.anchors.family[0] + 1.5,
    z.anchors.family[1],
    0,
    { hair: 0x1a1a22, hs: 'long', top: 0xfae0a0, pants: 0x4a4a6a, scale: 0.92 },
    undefined,
    undefined,
    'Family'
  );
  addTalkNPC(g, {
    id: 'shop',
    name: 'Gear Shop Owner',
    sub: 'Weapons & Equipment',
    x: z.anchors.shop[0],
    z: z.anchors.shop[1] + 1,
    yaw: 0,
    look: { ...lookF, hair: 0x555555, hs: 'short', top: 0x6a4a2a, pants: 0x3a3a3a, b: 1.1 },
    onTalk: () =>
      dialog(
        'Gear Shop Owner',
        ['Welcome to Hunter Gear! Dungeon loot sells well here.', 'Browse the shelves, hunter.'],
        {
          done: () => {
            st().setFlag('shopVisit');
            useGame.setState({ shopTab: 'buy' });
            st().setPanel('shop');
          },
        }
      ),
  });
  g.interacts.push({
    id: 'board',
    x: z.anchors.board[0],
    z: z.anchors.board[1],
    r: 4,
    label: () => '[E] Mission Board',
    act: () => {
      useGame.setState({ shopTab: 'missions' });
      st().setPanel('association');
      input.unlock();
    },
  });
  for (const [k, ax, label, type] of [
    ['pushup', z.anchors.pushup, 'Push-ups', 'pushup'],
    ['situp', z.anchors.situp, 'Sit-ups', 'situp'],
  ] as const) {
    g.interacts.push({
      id: k,
      x: ax[0],
      z: ax[1],
      r: 2.4,
      label: () => `[E] ${label} (tap repeatedly)${sv().quests.q_daily?.state === 'active' ? '' : ' - training'}`,
      act: () => {
        if ((S.trainCd[k] ?? 0) > 0) return;
        S.trainCd[k] = 0.25;
        S.trainT = 0.25;
        const dailyActive = sv().quests.q_daily?.state === 'active' && sv().dailyLeft > 0;
        st().questEvent(type, '', 1);
        if (dailyActive) {
          st().addScore(2);
          if (Math.random() < 0.2) st().addXp(1);
        }
        bus.emit('sfx', 'step', 1);
        G.fx.dust(ax[0], ax[1], 2);
        st().setFlag('trained');
        G.P.yaw = Math.PI / 2;
      },
    });
  }
  // gates
  const leakInfo = GATE_INFO.leak;
  if (ch === 0) {
    S.leakGate = g.addGate('leak', z.anchors.leakGate[0], z.anchors.leakGate[1], 'seoul', {
      name: leakInfo.name,
      id: 'leak0',
    });
    S.goblinT = 1.4;
    resetQuest('q_gate', 1);
    g.banner('GATE BREAK!', 'Monsters are pouring out. Defend yourself, E-Rank Hunter!', '#ff6a6a', 3.2);
    g.say('WASD move · Mouse camera · Left Click attack · Ctrl dodge · Shift sprint', 'TIP', 7);
  }
  if (ch === 2)
    g.addGate('double', z.anchors.dgate[0], z.anchors.dgate[1], 'double', { name: GATE_INFO.double.name, id: 'dgate' });
  if (ch >= 6)
    S.raidGate = g.addGate('raid', z.anchors.raidGate[0], z.anchors.raidGate[1], 'raid', {
      name: GATE_INFO.raid.name,
      id: 'raidg',
    });
  if (ch === 1 || ch === 2) {
    T(
      'songchiyul',
      -34,
      -30,
      0.5,
      { hair: 0x1a2a4a, hs: 'spiky', top: 0x3a4a6a, pants: 0x1c1c24, weapon: 'steel', wtype: 'sword', b: 1.1 },
      undefined,
      undefined,
      'D-Rank Hunter'
    );
    T(
      'kimsangshik',
      -26,
      -30,
      -0.5,
      { hair: 0x2a2a2a, hs: 'short', top: 0x4a5a3a, pants: 0x2a2a2a, coat: 0x4a5a3a, b: 1.1 },
      undefined,
      undefined,
      'C-Rank Hunter'
    );
  } else if (ch >= 3) {
    T(
      'songchiyul',
      40,
      -16,
      0.5,
      { hair: 0x1a2a4a, hs: 'spiky', top: 0x3a4a6a, pants: 0x1c1c24, weapon: 'steel', wtype: 'sword', b: 1.1 },
      undefined,
      undefined,
      'D-Rank Hunter'
    );
  }
  // placement
  let at: [number, number, number] | null = o.at || null;
  if (!at) {
    if (o.awake) at = [z.anchors.hospital[0], z.anchors.hospital[1] + 3, Math.PI];
    else if (o.from || o.respawn || (o.restore && ch > 0)) at = [z.anchors.plaza[0], z.anchors.plaza[1] + 6, Math.PI];
  }
  if (at) {
    g.P.pos.set(at[0], 0, at[1]);
    g.P.yaw = at[2];
    g.camYaw = at[2];
  }
  g.P.invuln = 1.5;
  if (ch >= 3) {
    if (o.awake) {
      startDaily();
    } else if (sv().quests.q_daily?.state !== 'active') S.nextDaily = 8;
  }
  if (ch >= 3 && sv().flags.sliceEnd !== true && ch >= 6 && o.from === 'job') {
    setTimeout(sliceEnd, 1200);
  }
  if (ch >= 1)
    st()
      .persist('auto')
      .catch(() => {});
  g.fx.clearTele();
}
function receptionTalk() {
  const ch = sv().chapter;
  if (ch === 1)
    dialog(
      'Association Receptionist',
      [
        'Welcome to the Hunter Association. E-Rank Sung Jin-Woo, correct?',
        'A D-Rank gate raid is recruiting right beside this building. Hazard pay is generous, even for an E-Rank.',
        'Hunters Song Chi-Yul and Kim Sang-Shik are waiting at the gate. Please be careful.',
      ],
      {
        done: () => {
          st().questEvent('talk', 'reception', 1);
        },
      }
    );
  else
    dialog('Association Receptionist', ['How can the Association help you today, Hunter?'], {
      choices: [
        { label: 'Mission Board', id: 'missions' },
        { label: 'Hunter Records', id: 'records' },
        { label: 'Guild Information', id: 'guilds' },
        { label: 'Leave', id: 'x' },
      ],
      done: (c) => {
        if (c && c !== 'x') {
          useGame.setState({ shopTab: c });
          st().setPanel('association');
        }
      },
    });
}
function joohee() {
  const q = sv().quests.q_supply;
  if (sv().chapter < 3) {
    const l = talkLines('joohee');
    dialog(l.name, l.lines);
    return;
  }
  if (!q)
    dialog(
      'Lee Joohee',
      [
        'Jin-Woo! Could you help me out? The Association is short on monster parts.',
        'Take down 8 monsters around Seoul and I will make it worth your while.',
      ],
      { color: '#ffb0b0', done: () => st().startQuest('q_supply') }
    );
  else if (q.state === 'active')
    dialog('Lee Joohee', ['Still hunting? Keep it up, Jin-Woo. Monsters near the gates are the easiest to find.']);
  else dialog('Lee Joohee', ['Thanks for the help, Jin-Woo. You really have changed.']);
}
function sliceEnd() {
  if (sv().flags.sliceEnd) return;
  st().setFlag('sliceEnd');
  st().persist('auto');
  st().submitScore('Completed: Job Change & Igris');
  useGame.setState({ screen: 'ending' });
  input.unlock();
}
function startDaily() {
  useGame.setState((s) => ({ save: { ...s.save, dailyLeft: 720 } }));
  if (G) {
    G.state.dailyTickAcc = 0;
    G.state.dailyWarned = false;
    G.state.pendingPenalty = false;
  }
  st().startQuest('q_daily');
  resetQuest('q_daily', 4);
  G.banner('DAILY QUEST', 'Preparation to Become Powerful', '#6ab4ff', 3);
  system(
    '[Daily Quest: Preparation to Become Powerful has arrived.]\nFail to complete it in time and a penalty will follow.',
    6
  );
}
function onQuestDone(id: string) {
  if (id === 'q_gate' && sv().chapter === 0) {
    const S = G.state.seoul;
    if (S?.leakGate) {
      G.closeGate(S.leakGate);
      S.leakGate = null;
    }
    setChapter(1);
    st().startQuest('q_report');
    G.say("E-Rank... the weakest of all hunters. But Mom's hospital bills won't pay themselves.", 'Sung Jin-Woo', 5);
    G.banner('GATE CLOSED', 'Report to the Hunter Association (north-east, glowing blue sign).', '#9ad8ff', 3.2);
  } else if (id === 'q_report' && sv().chapter === 1) {
    setChapter(2);
    st().startQuest('q_raid');
    const z = G.zone;
    if (z.id === 'seoul') {
      G.addGate('double', z.anchors.dgate[0], z.anchors.dgate[1], 'double', {
        name: GATE_INFO.double.name,
        id: 'dgate',
      });
    }
    st().persist('auto');
    G.say(
      'A D-Rank gate has opened beside the Association. Song Chi-Yul and Kim Sang-Shik are waiting.',
      'Objective',
      5
    );
  } else if (id === 'q_daily') {
    const S = G.state.seoul;
    if (S) S.nextDaily = 40;
    useGame.setState((s) => ({ save: { ...s.save, dailyLeft: 0 } }));
    if (sv().chapter === 3) {
      setChapter(4);
      st().addItem('key_venom');
      st().startQuest('q_venom');
      system('[Instant Dungeon Key acquired.]\nOpen Inventory (I) and Use the key to open the Venom Cave.', 6);
    }
  } else if (id === 'q_venom' && sv().chapter <= 4) {
    setChapter(5);
    st().setFlag('venomDone');
    st().startQuest('q_job');
    resetQuest('q_job', 3);
    system('[Emergency Quest: Job Change has arrived.]\nUse the Job Change Key from your Inventory.', 7);
  } else if (id === 'q_job' && sv().chapter <= 5) {
    setChapter(6);
    st().setFlag('jobDone');
    st().startQuest('q_army');
    G.banner('JOB CHANGE COMPLETE', 'You are now a NECROMANCER', '#b26bff', 4);
  } else if (id === 'q_double') {
    /* handled by awakening flow */
  }
  st()
    .persist('auto')
    .catch(() => {});
}

// Seoul per-frame
function seoulUpdate(g: Game, dt: number) {
  const S = g.state.seoul;
  if (!S || !g.zone) return;
  const s = sv();
  const ch = s.chapter;
  const P = g.P;
  if (S.goblinT > 0) {
    S.goblinT -= dt;
    if (S.goblinT <= 0) {
      const [gx, gz] = g.zone.anchors.leakGate;
      g.spawn('goblin', gx - 2, gz - 2, { aggro: true });
      g.spawn('goblin', gx + 2, gz - 3, { aggro: true });
      bus.emit('sfx', 'growl');
    }
  }
  if (S.trainT > 0) {
    S.trainT -= dt;
    P.ps.kneel = 0.75;
  }
  for (const station of Object.keys(S.trainCd)) S.trainCd[station] = Math.max(0, S.trainCd[station] - dt);
  if (ch >= 3) {
    if (S.nextDaily > 0) {
      S.nextDaily -= dt;
      if (S.nextDaily <= 0 && s.quests.q_daily?.state !== 'active') startDaily();
    }
    // gate break events
    if (!S.event && !g.cine) {
      S.eventT -= dt;
      if (S.eventT <= 0) spawnGateBreak(g);
    } else if (S.event) {
      const ev = S.event;
      if (ev.enemies.every((e: Enemy) => e.dead)) {
        g.closeGate(ev.gate);
        S.event = null;
        S.eventT = rnd(60, 100);
        g.banner('GATE CLOSED', 'The breach has been sealed.', '#9ad8ff', 2);
        st().addScore(300);
        st().addGold(60);
      }
    }
  }
}
function spawnGateBreak(g: Game) {
  const S = g.state.seoul;
  const P = g.P;
  let gx = 0,
    gz = 0,
    ok = false;
  for (let i = 0; i < 20 && !ok; i++) {
    const a = Math.random() * 6.28,
      d = rnd(26, 42);
    gx = P.pos.x + Math.cos(a) * d;
    gz = P.pos.z + Math.sin(a) * d;
    ok =
      G.zone.roads.some((r) => gx > r.x0 + 2 && gx < r.x1 - 2 && gz > r.z0 + 2 && gz < r.z1 - 2) &&
      gz < 100 &&
      Math.abs(gx) < 120;
  }
  if (!ok) {
    S.eventT = 10;
    return;
  }
  const lvl = sv().level;
  const gate = g.addGate('leak', gx, gz, 'seoul', { name: 'E-Rank Gate (Unstable)' });
  const n = 3 + Math.floor(Math.random() * 3) + Math.floor(lvl / 8);
  const enemies: Enemy[] = [];
  for (let i = 0; i < n; i++) {
    const r = Math.random();
    const key =
      lvl >= 15 && r > 0.8
        ? 'knight'
        : lvl >= 8 && r > 0.55
          ? r > 0.75
            ? 'centipede'
            : 'lizard'
          : r > 0.6 && lvl >= 4
            ? 'lizard'
            : 'goblin';
    enemies.push(
      g.spawn(key, gx + rnd(-3, 3), gz + rnd(-3, 3), { aggro: true, atkMul: 1 + lvl * 0.02, hpMul: 1 + lvl * 0.05 })
    );
  }
  S.event = { gate, enemies };
  g.banner(
    'GATE BREAK!',
    'Hunter Association alert: monsters detected nearby. Citizens are evacuating!',
    '#ff6a6a',
    3.5
  );
  st().notify({ title: 'HUNTER ASSOCIATION ALERT', text: 'E-Rank gate break in the city. Hunters respond!' });
  bus.emit('sfx', 'warn');
}
function triggerPenalty(g: Game) {
  if (g.cine || g.trans || g.state.penaltyQueued) return;
  g.state.penaltyQueued = true;
  g.state.pendingPenalty = false;
  system('[The Daily Quest was not completed.]\n[Penalty: Survive the Penalty Zone for 60 seconds.]', 5);
  bus.emit('sfx', 'stinger');
  g.banner('PENALTY ZONE', 'You failed the Daily Quest.', '#ffc04a', 3);
  setTimeout(() => {
    g.state.penaltyQueued = false;
    g.travel('penalty');
  }, 2500);
}
function dailyTick(g: Game, dt: number) {
  const save = sv();
  if (save.chapter < 3 || save.quests.q_daily?.state !== 'active') return;
  if (save.dailyLeft <= 0) {
    if (g.zone.id === 'seoul') triggerPenalty(g);
    else g.state.pendingPenalty = true;
    return;
  }
  g.state.dailyTickAcc = (g.state.dailyTickAcc ?? 0) + dt;
  const ticks = Math.floor(g.state.dailyTickAcc);
  if (ticks < 1) return;
  g.state.dailyTickAcc -= ticks;
  const next = Math.max(0, save.dailyLeft - ticks);
  useGame.setState((q) => ({ save: { ...q.save, dailyLeft: next } }));
  if (!g.state.dailyWarned && save.dailyLeft > 60 && next <= 60) {
    g.state.dailyWarned = true;
    system('[Warning: 60 seconds remain on the Daily Quest.]', 4);
    bus.emit('sfx', 'warn');
  }
  if (next <= 0) {
    if (g.zone.id === 'seoul') triggerPenalty(g);
    else {
      g.state.pendingPenalty = true;
      st().notify({ kind: 'system', title: 'DAILY QUEST FAILED', text: 'Return to Seoul to face the penalty.' });
      bus.emit('sfx', 'stinger');
    }
  }
}

// ======================================================================= PENALTY
function penaltyEnter(g: Game) {
  g.state.pen = { t: 60, spawnT: 1.5, elapsed: 0, done: false };
  g.banner('PENALTY ZONE', 'Survive for 60 seconds!', '#ffc04a', 3);
  g.cmd = 'follow';
}
function penaltyUpdate(g: Game, dt: number) {
  const S = g.state.pen;
  if (!S || S.done || g.cine) return;
  S.t -= dt;
  S.elapsed += dt;
  S.spawnT -= dt;
  useHud.setState({ timer: `SURVIVE  ${Math.max(0, Math.ceil(S.t))}s` });
  const alive = g.enemies.filter((e) => !e.dead).length;
  if (S.spawnT <= 0 && alive < 14) {
    S.spawnT = Math.max(0.7, 2.6 - S.elapsed * 0.035);
    const a = Math.random() * 6.28;
    g.spawn('centipede', Math.cos(a) * 30, Math.sin(a) * 30, {
      aggro: true,
      noLoot: true,
      hpMul: 1 + sv().level * 0.03,
    });
  }
  if (S.t <= 0) {
    S.done = true;
    g.enemies.forEach((e) => {
      g.fx.shadowBurst(e.pos.x, 0.5, e.pos.z, 8, 2);
    });
    g.enemies.slice().forEach((e) => removeEnemy(g, e));
    system('[Penalty Zone survived.]', 4);
    st().addScore(800);
    st().addXp(40);
    g.banner('PENALTY SURVIVED', '', '#9ad8ff', 2.5);
    setTimeout(() => g.travel('seoul', { from: 'penalty' }), 2500);
    useGame.setState((s) => {
      const q = { ...s.save.quests };
      q.q_daily = { state: 'done', prog: [0, 0, 0, 0] };
      return { save: { ...s.save, quests: q, dailyLeft: 0 } };
    });
    const S2 = g.state;
    S2.pendingNextDaily = true;
    S2.pendingPenalty = false;
    S2.penaltyQueued = false;
    S2.dailyWarned = false;
  }
}

// ======================================================================= DOUBLE DUNGEON
const COMMANDS = [
  { txt: 'KNEEL BEFORE THE STATUE OF GOD', type: 'kneel', hint: 'Hold [E] on the altar sigil to KNEEL' },
  { txt: 'NONE SHALL MOVE', type: 'still', hint: 'Do NOT move, jump or attack' },
  { txt: 'NONE SHALL STAND UPON THE SIGIL', type: 'leave', hint: 'Step OFF the central sigil (7m away)' },
  { txt: 'THE CHOSEN SHALL KNEEL', type: 'kneel', hint: 'Hold [E] on the altar sigil to KNEEL' },
];
function setTablet(txt: string) {
  const z = G.zone;
  if (z.tabletMesh) {
    z.group.remove(z.tabletMesh);
  }
  const m = makeLabel(txt, { w: 6.4, h: 1.6, color: '#ffcf70', font: 40 });
  m.position.set(0, 3, -90.65);
  z.group.add(m);
  z.tabletMesh = m;
}
function templeEnter(g: Game, _o: any) {
  const z = g.zone;
  resetQuest('q_double', 1);
  const S = (g.state.temple = {
    stage: 'corridor',
    j: 0,
    t: 0,
    party: [] as any[],
    moved: false,
    kneelAcc: 0,
    beams: [] as any[],
    trapCd: 0,
    crackOpen: false,
    hudT: 0,
    sealed: false,
    deadParty: false,
    tabletTxt: '',
  } as any);
  const mk = (id: string, name: string, x: number, zz: number, look: any, sub: string) =>
    addTalkNPC(g, { id, name, sub, x, z: zz, yaw: 0, look, cond: () => false, onTalk: () => {} });
  S.party = [
    mk(
      'p_song',
      'Song Chi-Yul',
      -3,
      -57,
      { hair: 0x1a2a4a, hs: 'spiky', top: 0x3a4a6a, pants: 0x1c1c24, weapon: 'steel', wtype: 'sword', b: 1.1 },
      'D-Rank'
    ),
    mk(
      'p_kim',
      'Kim Sang-Shik',
      3,
      -57,
      { hair: 0x2a2a2a, hs: 'short', top: 0x4a5a3a, pants: 0x2a2a2a, coat: 0x4a5a3a, b: 1.1 },
      'C-Rank'
    ),
    mk('p_a', 'Party Hunter', -9, -62, { hair: 0x3a2a1a, top: 0x6a3a3a, pants: 0x222, weapon: 'rusty' }, 'Hunter'),
    mk('p_b', 'Party Hunter', 9, -62, { hair: 0x1a1a22, top: 0x3a6a5a, pants: 0x222, weapon: 'rusty' }, 'Hunter'),
    mk(
      'p_c',
      'Party Hunter',
      0,
      -66,
      { hair: 0x6a4a2a, hs: 'long', top: 0x7a5a2a, pants: 0x222, weapon: 'rusty' },
      'Hunter'
    ),
  ];
  g.interacts.push({
    id: 'exit',
    x: z.anchors.exit[0],
    z: z.anchors.exit[1],
    r: 3.5,
    label: () => (S.stage === 'corridor' ? '[E] Retreat to Seoul' : null),
    act: () => g.travel('seoul', { from: 'double' }),
  });
  g.interacts.push({
    id: 'crack',
    x: z.anchors.crack[0],
    z: z.anchors.crack[1],
    r: 3.2,
    label: () => (!S.crackOpen ? '[E] Push the cracked wall' : null),
    act: () => {
      S.crackOpen = true;
      z.crackWall.visible = false;
      const b = z.boxes.find((q: any) => q.id === 'crack');
      if (b) b.on = false;
      g.shake = 0.5;
      g.fx.dust(-5.4, -22, 30);
      bus.emit('sfx', 'slam');
      st().notify({ title: 'HIDDEN CHAMBER', text: 'A secret room opens...' });
    },
  });
  g.interacts.push({
    id: 'chest',
    x: z.anchors.chest[0],
    z: z.anchors.chest[1],
    r: 2.6,
    label: () => (S.crackOpen && !S.chestOpen ? '[E] Open chest' : null),
    act: () => {
      S.chestOpen = true;
      st().addItem('hp_potion', 2);
      st().addItem('mp_potion', 1);
      st().addItem('hunter_gloves');
      st().addGold(150);
      bus.emit('sfx', 'coin');
      z.chest.scale.y = 0.7;
    },
  });
  g.banner('DOUBLE DUNGEON', 'An ancient temple. Something feels wrong...', '#ff8a3a', 3.5);
  system('[Warning: Dungeon type mismatch. Rank: ???]', 4);
}
function startHallCine(g: Game) {
  const S = g.state.temple;
  S.stage = 'cine';
  const gp: [number, number, number] = [0, 5.5, -97];
  g.cineSeq(
    [
      {
        dur: 3.6,
        from: [0, 2.5, -48],
        to: [0, 4.2, -64],
        look: [0, 3.5, -98],
        speaker: 'Song Chi-Yul',
        text: '...This is no D-Rank dungeon. Look at that statue.',
        sfx: 'stinger',
      },
      {
        dur: 3.4,
        from: [-7, 2.2, -83],
        to: [-4, 2.6, -85],
        look: [0, 3, -90.6],
        lookTo: [0, 3.2, -90.6],
        speaker: 'Tablet',
        text: '"PRAY TO THE STATUE OF GOD."',
        shake: 0.2,
      },
      {
        dur: 3.2,
        from: [6, 8, -78],
        to: [0, 7.5, -84],
        look: gp,
        lookTo: [0, 6.3, -98],
        speaker: 'Kim Sang-Shik',
        text: 'The entrance... it sealed behind us!',
        cb: () => {
          S.sealed = true;
          g.zone.boxes.push({ x: 0, z: -49, hw: 8, hd: 0.8 });
          g.shake = 0.6;
          bus.emit('sfx', 'boom');
        },
      },
      {
        dur: 2.6,
        from: [0, 3, -70],
        to: [0, 3, -74],
        look: [0, 2, -90],
        speaker: 'Sung Jin-Woo',
        text: "Something's wrong. We need to survive this somehow.",
        cb: () => {
          g.banner('THE COMMANDMENTS', 'Obey the tablet before the judgement falls.', '#ffcf70', 3);
        },
      },
    ],
    () => {
      S.stage = 'announce';
      S.t = 0;
      setTablet(COMMANDS[0].txt);
      S.tabletTxt = COMMANDS[0].txt;
    }
  );
}
function killParty(g: Game, names: string[]) {
  const S = g.state.temple;
  for (const n of g.npcs) {
    if (names.includes(n.id) && !(n as any).dying) {
      (n as any).dying = 0.01;
      g.fx.shadowBurst(n.pos.x, 1, n.pos.z, 20, 3);
      bus.emit('sfx', 'death');
      const m = new THREE.Mesh(
        new THREE.CylinderGeometry(0.8, 0.8, 30, 12, 1, true),
        new THREE.MeshBasicMaterial({
          color: 0xff3020,
          transparent: true,
          opacity: 0.8,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      m.position.set(n.pos.x, 15, n.pos.z);
      g.scene.add(m);
      S.beams.push({ m, t: 0 });
    }
  }
}
function templeUpdate(g: Game, dt: number) {
  const S = g.state.temple;
  if (!S) return;
  const P = g.P;
  const z = g.zone;
  for (const b of S.beams.slice()) {
    b.t += dt;
    (b.m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.8 - b.t * 0.8);
    b.m.scale.x = 1 + b.t;
    b.m.scale.z = 1 + b.t;
    if (b.t > 1.2) {
      g.scene.remove(b.m);
      S.beams = S.beams.filter((q: any) => q !== b);
    }
  }
  for (const n of g.npcs) {
    const d = (n as any).dying;
    if (d !== undefined) {
      (n as any).dying = d + dt;
      n.ps.dead = Math.min(1, (n as any).dying * 1.5);
    }
    if ((n as any).fleeing && !n.hidden) {
      n.pos.z += dt * 6;
      n.rig.root.position.z = n.pos.z;
      n.ps.move = 1.2;
      n.ps.phase += dt * 12;
      n.yaw = 0;
      if (n.pos.z > -40) n.hidden = true;
    }
  }
  S.trapCd -= dt;
  for (const tp of z.traps)
    if (tp.up && S.trapCd <= 0 && Math.abs(P.pos.x - tp.x) < 3.6 && Math.abs(P.pos.z - tp.z) < 1.6 && P.pos.y < 0.8) {
      g.hurtPlayer(22, V(tp.x, 0, tp.z), 2);
      S.trapCd = 0.8;
      bus.emit('sfx', 'clang');
    }
  if (S.stage === 'corridor') {
    if (P.pos.z < -52 && !g.cine) startHallCine(g);
    return;
  }
  if (S.stage === 'cine' || S.stage === 'awakening') return;
  const alt = z.anchors.altar;
  const dAlt = Math.hypot(P.pos.x - alt[0], P.pos.z - alt[1]);
  const cmd = COMMANDS[S.j];
  S.t += dt;
  S.kneelAcc = P.kneeling && dAlt < 6.5 ? S.kneelAcc + dt : 0;
  const moving =
    Math.hypot(P.pos.x - (S.lx ?? P.pos.x), P.pos.z - (S.lz ?? P.pos.z)) > 0.02 || P.atk || !P.grounded || P.dodgeT > 0;
  S.lx = P.pos.x;
  S.lz = P.pos.z;
  S.hudT += dt;
  if (S.hudT > 0.1) {
    S.hudT = 0;
    if (S.stage === 'window') {
      const w = S.j === 0 ? 8 : 7;
      useHud.setState({ timer: `${cmd.txt}  \u2014  ${Math.max(0, Math.ceil(w - S.t))}s\n${cmd.hint}` });
    } else if (S.stage === 'announce') useHud.setState({ timer: 'THE STATUE SPEAKS...' });
    else if (S.stage === 'guardians')
      useHud.setState({
        timer: `The statues awaken! Survive. Next judgement in ${Math.max(0, Math.ceil(S.gt - S.t))}s`,
      });
    else useHud.setState({ timer: null });
  }
  if (S.stage === 'announce' && S.t > 2.4) {
    S.stage = 'window';
    S.t = 0;
    S.violated = false;
    g.banner(`COMMANDMENT ${S.j + 1}`, cmd.txt, '#ffcf70', 3);
    bus.emit('sfx', 'warn');
    z.godLight.color.set(0xff3a20);
    g.shake = 0.3;
    g.enemies
      .filter((e) => e.flag === 'guard')
      .forEach((e) => {
        g.fx.dust(e.pos.x, e.pos.z, 12);
        removeEnemy(g, e);
      });
    z.statues?.forEach((s: any) => {
      s.rig.root.visible = true;
      s.base.visible = true;
    });
  } else if (S.stage === 'window') {
    const w = S.j === 0 ? 8 : 7;
    if (cmd.type === 'still' && S.t > w - 3.5 && moving) S.violated = true;
    if (S.t > w - 2.2 && S.t < w && Math.random() < 0.3)
      g.fx.burst(0, 8, -97, 1, { speed: 1, life: 0.6, c0: 0xff4020, c1: 0xff0000, size: 0.4 });
    if (S.t >= w) {
      S.stage = 'strike';
      S.t = 0;
      const ok = cmd.type === 'kneel' ? S.kneelAcc > 1.2 : cmd.type === 'still' ? !S.violated : dAlt > 7;
      S.ok = ok;
      bus.emit('sfx', 'judge');
      g.shake = 0.9;
      g.slow = { t: 0.5, s: 0.4 };
      if (!ok) {
        const m = new THREE.Mesh(
          new THREE.CylinderGeometry(0.9, 0.9, 30, 12, 1, true),
          new THREE.MeshBasicMaterial({
            color: 0xff3020,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            depthWrite: false,
          })
        );
        m.position.set(P.pos.x, 15, P.pos.z);
        g.scene.add(m);
        S.beams.push({ m, t: 0 });
        if (S.j < 3) {
          const dmg = Math.min(P.hp - 1, G.derived.maxHp * 0.5);
          P.hp -= dmg;
          P.ps.hurt = 1;
          g.fx.sparks(P.pos.x, 1, P.pos.z, 0xff2a2a, 30);
          g.fx.num(P.pos.clone().add(V(0, 2.4, 0)), '-' + Math.round(dmg), '#ff3a3a', true);
        }
        g.banner('JUDGEMENT', 'You did not obey the commandment.', '#ff4040', 2.5);
      } else g.banner('JUDGEMENT', 'The commandment was obeyed. You are spared.', '#9ad8ff', 2.5);
      if (S.j === 0) killParty(g, ['p_a', 'p_b', 'p_c']);
      if (S.j === 1) {
        st().notify({ title: 'SYSTEM', text: 'Party hunters were struck down.' });
      }
      z.godLight.color.set(0xffa850);
      st().questEvent('judge', '', 1);
    }
  } else if (S.stage === 'strike' && S.t > 1.8) {
    if (S.j >= 3) {
      S.stage = 'awakening';
      startAwakeningCine(g);
      return;
    }
    S.j++;
    S.stage = 'guardians';
    S.t = 0;
    S.gt = 34;
    const cnt = [2, 2, 3][S.j - 1] ?? 3;
    const ss = (z.statues || [])
      .slice()
      .sort((a: any, b: any) => Math.hypot(a.x - P.pos.x, a.z - P.pos.z) - Math.hypot(b.x - P.pos.x, b.z - P.pos.z))
      .slice(4, 4 + cnt);
    ss.forEach((s: any) => {
      s.rig.root.visible = false;
      s.base.visible = false;
      g.spawn('guardian', s.x, s.z, { rise: true, aggro: true, flag: 'guard', noLoot: false });
      g.fx.dust(s.x, s.z, 14);
    });
    if (S.j === 2) {
      for (const n of g.npcs) if (n.id === 'p_song' || n.id === 'p_kim') (n as any).fleeing = true;
      G.say("I'm getting out of here!", 'Song Chi-Yul', 3);
    }
    g.banner('THE STATUES AWAKEN', 'Survive!', '#ffa850', 2.4);
    g.shake = 0.6;
    bus.emit('sfx', 'roar', 0);
  } else if (S.stage === 'guardians') {
    const alive = g.enemies.filter((e) => e.flag === 'guard' && !e.dead).length;
    if ((alive === 0 && S.t > 3) || S.t > S.gt) {
      S.stage = 'announce';
      S.t = 0;
      setTablet(COMMANDS[S.j].txt);
    }
  }
}
function startAwakeningCine(g: Game) {
  const z = g.zone;
  useHud.setState({ timer: null });
  g.P.hp = 1;
  g.P.ps.hurt = 1;
  killParty(g, ['p_song', 'p_kim', 'p_a', 'p_b', 'p_c']);
  z.godLight.color.set(0xff5030);
  g.enemies.slice().forEach((e) => removeEnemy(g, e));
  g.cineSeq(
    [
      {
        dur: 3.4,
        from: [0, 3, -80],
        to: [0, 6, -90],
        look: [0, 6, -98],
        speaker: 'Statue of God',
        text: '...',
        sfx: 'judge',
        shake: 0.8,
      },
      {
        dur: 3.0,
        from: [3, 1.2, -76],
        to: [1, 1, -76],
        look: [0, 1, -74],
        speaker: 'Sung Jin-Woo',
        text: "Everyone... is gone. I... I'm not going to die here.",
        cb: () => {
          g.P.hp = 1;
        },
      },
      {
        dur: 3.2,
        from: [0, 3, -70],
        to: [0, 4, -70],
        look: [0, 1, -76],
        speaker: 'SYSTEM',
        text: '[ You have fulfilled the requirements to become a Player. ]',
        cb: () => {
          useFade.setState({ v: 0.85 });
          bus.emit('sfx', 'system');
        },
      },
      {
        dur: 2.6,
        from: [0, 3, -70],
        look: [0, 1, -76],
        speaker: 'SYSTEM',
        text: '[ Do you accept? ]',
        cb: () => bus.emit('sfx', 'system'),
      },
    ],
    () => {
      st().setPanel('accept');
      input.unlock();
    }
  );
}
function finishAwakening() {
  const g = G;
  st().setPanel('none');
  st().setScreen('playing');
  st().setFlag('awakened');
  st().setFlag('doubleDone');
  st().setTitle('Player');
  setChapter(3);
  useFade.setState({ v: 0 });
  g.P.hp = g.derived.maxHp;
  bus.emit('sfx', 'levelup');
  st().notify({ kind: 'levelup', title: 'THE SYSTEM HAS AWAKENED', text: 'You are now a Player.' });
  st().addScore(1500);
  g.transition(() => {
    g.loadZone('seoul', { awake: true });
    setTimeout(() => {
      g.banner('A NEW DAY', 'You awaken in the hospital.', '#9ad8ff', 3);
      system('[Player Sung Jin-Woo]\nOpen Status (Tab) and allocate your stat points.', 6);
      setTimeout(() => {
        st().setPanel('status');
        input.unlock();
      }, 2500);
    }, 600);
  });
}

// ======================================================================= VENOM CAVE
function caveEnter(g: Game) {
  const z = g.zone;
  const S = (g.state.cave = { boss: null as Enemy | null, intro: false, done: false });
  for (const sp of z.spawns || []) g.spawn(sp[0], sp[1], sp[2]);
  g.interacts.push({
    id: 'exit',
    x: z.anchors.exit[0],
    z: z.anchors.exit[1],
    r: 3.5,
    label: () => (!S.intro || S.done ? '[E] Leave the cave' : null),
    act: () => g.travel('seoul', { from: 'venom' }),
  });
  g.banner('INSTANT DUNGEON', "Venom Cave: Kasaka's lair", '#6dff7a', 3);
  system('[Instant Dungeon: Venom Cave. Rank C. Boss: Kasaka.]', 4);
}
function caveUpdate(g: Game) {
  const S = g.state.cave;
  if (!S || g.cine) return;
  if (!S.intro && g.P.pos.z > 88) {
    S.intro = true;
    g.enemies.filter((e) => !e.dead).forEach((e) => ((e as any).aggro = false));
    g.cineSeq(
      [
        {
          dur: 3,
          from: [0, 5, 92],
          to: [0, 3.5, 100],
          look: [0, 1, 114],
          speaker: 'Sung Jin-Woo',
          text: 'This pool... something big is down there.',
          sfx: 'stinger',
        },
        {
          dur: 3,
          from: [-10, 3, 100],
          to: [-8, 4, 104],
          look: [0, 1.5, 114],
          lookTo: [0, 3, 116],
          speaker: 'SYSTEM',
          text: '[Warning: Boss Monster - Kasaka (C-Rank)]',
          shake: 0.4,
          cb: () => {
            S.boss = g.spawn('kasaka', 0, 118, { rise: true, aggro: true });
            bus.emit('sfx', 'roar', 1);
            g.shake = 0.8;
            g.fx.burst(0, 1, 118, 50, { speed: 8, up: 4, life: 1.2, c0: 0xffffff, c1: 0x4aff6a });
          },
        },
      ],
      () => {
        import('./audio').then((m) => m.audio.setMode('boss'));
      }
    );
  }
}

// ======================================================================= JOB CHANGE (Igris) + RAID
const RING = (r: number, a: number) => [Math.cos(a) * r, Math.sin(a) * r] as [number, number];
function jobEnter(g: Game) {
  const z = g.zone;
  const S = (g.state.job = { wave: 0, state: 'intro', t: 3, igris: null as Enemy | null, started: false });
  g.interacts.push({
    id: 'exit',
    x: z.anchors.exit[0],
    z: z.anchors.exit[1],
    r: 3.5,
    label: () => (S.state === 'intro' || S.state === 'done' ? '[E] Leave the dungeon' : null),
    act: () => g.travel('seoul', { from: 'job' }),
  });
  g.cineSeq(
    [
      {
        dur: 3.4,
        from: [0, 30, 60],
        to: [0, 14, 44],
        look: [0, 4, -10],
        speaker: 'SYSTEM',
        text: '[Job Change Quest: Survive the knights. Defeat the Red Knight.]',
        sfx: 'stinger',
      },
      {
        dur: 2.4,
        from: [30, 5, 30],
        to: [20, 4, 24],
        look: [0, 2, 0],
        speaker: 'Sung Jin-Woo',
        text: 'An endless battlefield... fine. Bring them on.',
      },
    ],
    () => {
      S.state = 'waves';
      S.t = 1;
    }
  );
  g.banner('JOB CHANGE DUNGEON', 'Colosseum of the fallen knights', '#ff3a4a', 3);
}
const JOB_WAVES = [3, 4, 5];
function spawnWave(g: Game, n: number, key = 'knight', extra: any = {}) {
  for (let i = 0; i < n; i++) {
    const [x, zz] = RING(rnd(24, 34), (i / n) * 6.283 + Math.random() * 0.5);
    setTimeout(() => {
      if (G === g && g.zone.id !== 'seoul') g.spawn(key, x, zz, { rise: true, aggro: true, ...extra });
    }, i * 300);
  }
}
function jobUpdate(g: Game, dt: number) {
  const S = g.state.job;
  if (!S || g.cine) return;
  const alive = g.enemies.filter((e) => !e.dead).length;
  if (S.state === 'waves') {
    S.t -= dt;
    if (S.t <= 0 && alive === 0) {
      if (S.wave >= JOB_WAVES.length) {
        S.state = 'igris';
        igrisIntro(g);
        return;
      }
      spawnWave(g, JOB_WAVES[S.wave], 'knight', { hpMul: 1 + S.wave * 0.15 });
      S.wave++;
      S.t = 3;
      g.banner(
        `WAVE ${S.wave}/${JOB_WAVES.length}`,
        S.wave === 3 ? 'Elite knights approach!' : 'Armored knights rise from the ground!',
        '#ff6a4a',
        2.4
      );
      bus.emit('sfx', 'warn');
    }
  }
}
function igrisIntro(g: Game) {
  const S = g.state.job;
  g.cineSeq(
    [
      {
        dur: 3,
        from: [0, 7, 22],
        to: [0, 5, 14],
        look: [0, 3, -26],
        speaker: 'SYSTEM',
        text: '[Warning! A powerful presence approaches.]',
        shake: 0.5,
        sfx: 'stinger',
      },
      {
        dur: 3.4,
        from: [5, 3, -14],
        to: [3, 3.4, -20],
        look: [0, 3, -27],
        lookTo: [0, 3.6, -27],
        speaker: 'Igris',
        text: '...',
        cb: () => {
          S.igris = g.spawn('igris', 0, -27, { rise: true, aggro: true });
          bus.emit('sfx', 'roar', 1);
          g.shake = 1;
          g.fx.shock(0, 0, -27, 0xff2030, 16, 1.2);
        },
      },
      {
        dur: 2.6,
        from: [-4, 2.4, -17],
        to: [-3, 3, -19],
        look: [0, 3.2, -27],
        speaker: 'IGRIS \u2014 THE RED KNIGHT',
        text: 'The crimson blade awakens. Kneel, or fall.',
      },
    ],
    () => {
      import('./audio').then((m) => m.audio.setMode('boss'));
      S.state = 'boss';
    }
  );
}
function raidEnter(g: Game) {
  const z = g.zone;
  const S = (g.state.raid = { wave: 0, t: 3, best: 0 });
  g.interacts.push({
    id: 'exit',
    x: z.anchors.exit[0],
    z: z.anchors.exit[1],
    r: 3.5,
    label: () => '[E] Leave the Raid Gate',
    act: () => {
      st().submitScore('Raid wave ' + S.wave);
      g.travel('seoul', { from: 'raid' });
    },
  });
  g.banner('C-RANK RAID GATE', 'Endless waves. Extract shadows. Leave anytime at the south exit.', '#b26bff', 3.5);
}
function raidUpdate(g: Game, dt: number) {
  const S = g.state.raid;
  if (!S || g.cine) return;
  const alive = g.enemies.filter((e) => !e.dead).length;
  S.t -= dt;
  if (alive === 0 && S.t <= 0) {
    S.wave++;
    S.t = 4;
    const n = Math.min(14, 3 + S.wave);
    const lvl = sv().level;
    const pool = ['goblin', 'lizard', 'centipede', 'knight'];
    const maxK = Math.min(pool.length, 1 + Math.floor(S.wave / 2));
    for (let i = 0; i < n; i++) {
      const key = pool[Math.floor(Math.random() * maxK)];
      const [x, zz] = RING(rnd(22, 34), Math.random() * 6.28);
      setTimeout(() => {
        if (G === g && g.zone.id === 'raid')
          g.spawn(key, x, zz, {
            rise: true,
            aggro: true,
            hpMul: 1 + S.wave * 0.08 + lvl * 0.02,
            atkMul: 1 + S.wave * 0.03,
          });
      }, i * 220);
    }
    if (S.wave > 1) {
      st().addScore(250 * S.wave);
      st().addGold(40 * S.wave);
    }
    g.banner(`RAID WAVE ${S.wave}`, `${n} monsters`, '#b26bff', 2.2);
  }
  useHud.setState({ timer: `RAID WAVE ${S.wave}  \u2022  Enemies: ${alive}` });
}

// ======================================================================= hooks
export function onKill(g: Game, e: Enemy) {
  const k = e.def.key;
  if (k === 'kasaka') {
    const S = g.state.cave;
    if (S) {
      S.done = true;
    }
    st().setFlag('venomDone');
    st().equip('venom_fang');
    system("[Kasaka defeated.]\nNew skill unlocked: Violent Slash [F]. Kasaka's Venom Fang equipped.", 7);
    g.banner('NEW SKILL', 'VIOLENT SLASH [F]', '#b26bff', 3.5);
    setTimeout(() => {
      if (g.zone.id === 'venom')
        g.addGate('exit', 0, 100, 'seoul', { name: 'Exit Portal', exit: true, id: 'cave_exit' });
      import('./audio').then((m) => m.audio.setMode('cave'));
    }, 2000);
  } else if (k === 'igris') {
    st().setFlag('necro');
    e.corpse = true;
    st().equip('knight_killer');
    const S = g.state.job;
    if (S) S.state = 'extract';
    import('./audio').then((m) => m.audio.setMode('arena'));
    system(
      '[Job Change complete: NECROMANCER]\nYou may now Extract Shadows. Approach the fallen knight and press [E].',
      9
    );
    g.banner(
      'NECROMANCER',
      "Shadow Extraction, Summoning, Exchange, Ruler's Authority & Domain unlocked",
      '#b26bff',
      5
    );
  }
}
export function onExtract(g: Game, key: string) {
  if (key === 'igris') {
    const S = g.state.job;
    if (S) S.state = 'done';
    setTimeout(() => {
      if (g.zone.id === 'job') g.addGate('exit', 0, 30, 'seoul', { name: 'Exit Portal', exit: true, id: 'job_exit' });
    }, 3500);
    setTimeout(
      () =>
        system('[Igris has joined your shadow army.]\nPress C to summon / cycle commands. Keys 1-5 set commands.', 7),
      5500
    );
  }
  st()
    .persist('auto')
    .catch(() => {});
}
export function onPhase(_g: Game, _e: Enemy, _ph: number) {
  /* hook */
}
export function canKneel(g: Game) {
  const S = g.state.temple;
  if (g.zone.id !== 'double' || !S || ['corridor', 'cine', 'awakening'].includes(S.stage)) return false;
  const a = g.zone.anchors.altar;
  return Math.hypot(g.P.pos.x - a[0], g.P.pos.z - a[1]) < 6.5;
}
export function update(g: Game, dt: number) {
  if (!G) return;
  const id = g.zone.id;
  if (id === 'seoul') seoulUpdate(g, dt);
  else if (id === 'double') templeUpdate(g, dt);
  else if (id === 'venom') caveUpdate(g);
  else if (id === 'job') jobUpdate(g, dt);
  else if (id === 'raid') raidUpdate(g, dt);
  else if (id === 'penalty') penaltyUpdate(g, dt);
  dailyTick(g, dt);
  if (id !== 'double' && id !== 'penalty' && id !== 'raid') {
    const dl = sv().dailyLeft;
    const q = sv().quests.q_daily;
    const t =
      q?.state === 'active' && dl > 0
        ? `DAILY QUEST  ${Math.floor(dl / 60)}:${String(dl % 60).padStart(2, '0')}`
        : null;
    if (useHud.getState().timer !== t) useHud.setState({ timer: t });
  }
  if (g.state.pendingNextDaily && id === 'seoul') {
    g.state.pendingNextDaily = false;
    if (g.state.seoul) g.state.seoul.nextDaily = 30;
  }
}
