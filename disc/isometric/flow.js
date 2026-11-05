/* SPDX-License-Identifier: AGPL-3.0-or-later */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.IsoFlow = factory();
})(globalThis, function () {
  'use strict';
  const STEPS = 8;
  const MAX_DELAY = 4;
  const PALETTE = Object.freeze([null, 60, 64, 67]);
  const PORTS = Object.freeze(Object.fromEntries(Object.entries({
    source:['out'], copy:['out','copy'], delay:['out'], router:['straight','side'], keys:[], bell:[], bin:[]
  }).map(([node, ports]) => [node, Object.freeze(ports)])));
  const PROCESSORS = ['copy', 'delay', 'router'];
  const destinations = ['keys', 'bell', 'bin'];
  const outputs = Object.keys(PORTS).flatMap(node => PORTS[node].map(port => node + ':' + port));
  const wrap = (n, length = STEPS) => ((n % length) + length) % length;
  const within = (n, lo, hi) => Number.isInteger(n) && n >= lo && n <= hi;
  const owner = port => port.split(':')[0];
  const primary = node => node + ':' + PORTS[node][0];
  function requireThat(condition, message) {
    if (!condition) throw new Error(message);
  }

  function verifyLinks(links) {
    requireThat(links && typeof links === 'object' && !Array.isArray(links), 'Повреждена схема соединений.');
    const occupied = new Set();
    for (const [port, node] of Object.entries(links)) {
      requireThat(outputs.includes(port) && typeof node === 'string' && Object.hasOwn(PORTS, node) && node !== 'source', 'Соедините выход детали с входом другой детали.');
      if (!PROCESSORS.includes(node)) continue;
      requireThat(!occupied.has(node), 'Этот вход уже занят. Сначала отсоедините провод.');
      occupied.add(node);
    }
    const visiting = new Set(), done = new Set();
    function visit(node) {
      if (done.has(node)) return;
      requireThat(!visiting.has(node), 'Такая разводка замкнула бы путь на себя.');
      visiting.add(node);
      for (const port of PORTS[node]) {
        const next = links[node + ':' + port];
        if (next) visit(next);
      }
      visiting.delete(node);
      done.add(node);
    }
    Object.keys(PORTS).forEach(visit);
  }
  function restoreRoutes(raw) {
    if (Object.hasOwn(raw, 'routes')) {
      requireThat(Array.isArray(raw.routes) && raw.routes.length === STEPS &&
        Array.from(raw.routes).every(v => typeof v === 'boolean'), 'Повреждены восемь направлений развилки.');
      return Object.freeze([...raw.routes]);
    }
    // v1 saves stored two rotating perforated discs and a clutch. Recover the
    // direction each incoming box would have taken at each of the eight steps.
    requireThat(typeof raw.clutch === 'boolean' && Array.isArray(raw.discs) &&
      raw.discs.length === 2 && Array.from(raw.discs).every(n => within(n, 0, STEPS - 1)), 'Повреждены настройки развилки.');
    const holes = [[0, 2, 4, 6], [0, 1, 4, 5]];
    return Object.freeze(Array.from({length:STEPS}, (_, step) =>
      !raw.clutch || holes.every((slots, i) => slots.includes(wrap(step - raw.discs[i])))));
  }
  function restore(raw) {
    const source = raw?.source;
    requireThat(source && Array.isArray(source.notes) && source.notes.length === STEPS &&
      Array.from(source.notes).every(n => n === null || within(n, 0, 127)) &&
      within(source.phase, 0, STEPS - 1) && Number.isFinite(source.level) && within(source.level * 4, 0, 8), 'Повреждена шестерня с нотами.');
    requireThat(within(raw.delay, 0, MAX_DELAY), 'Повреждены настройки накопителя.');
    verifyLinks(raw.links);
    return Object.freeze({
      source:Object.freeze({notes:Object.freeze([...source.notes]), phase:source.phase, level:source.level}),
      delay:raw.delay, routes:restoreRoutes(raw),
      links:Object.freeze({...raw.links})
    });
  }
  function initial() {
    return restore({
      links:{'source:out':'copy','copy:out':'keys','copy:copy':'delay','delay:out':'router','router:straight':'bell','router:side':'bin'},
      source:{notes:[60,null,64,null,67,null,64,null],phase:0,level:1}, delay:2,
      routes:[true,false,false,false,true,false,false,false]
    });
  }

  // Removing a module preserves the path through its primary outlet. Its branch
  // becomes free. Inserting it elsewhere is a single validated graph edit.
  function bypass(links, node) {
    requireThat(PROCESSORS.includes(node), 'Эту деталь нельзя вставить между двумя другими.');
    const input = Object.keys(links).find(port => links[port] === node);
    const next = links[primary(node)];
    for (const port of PORTS[node]) delete links[node + ':' + port];
    if (input) {
      if (next) links[input] = next;
      else delete links[input];
    }
  }
  function apply(state, action) {
    const next = {...state}, source = {...state.source};
    const {type, from, to, node, index, delta = 1} = action;
    switch (type) {
      case 'connect':
      case 'disconnect':
      case 'bypass':
      case 'insert': {
        const links = {...state.links};
        if (type === 'bypass') bypass(links, node);
        else {
          requireThat(outputs.includes(from), 'Выберите выход детали.');
          if (type === 'connect') links[from] = to;
          if (type === 'disconnect') delete links[from];
          if (type === 'insert') {
            requireThat(links[from] && owner(from) !== node && links[from] !== node, 'Выберите провод между другими деталями.');
            bypass(links, node);
            const previous = links[from];
            links[from] = node;
            links[primary(node)] = previous;
          }
        }
        verifyLinks(links);
        if (Object.keys(links).length === Object.keys(state.links).length && Object.entries(links).every(([p,n]) => state.links[p] === n)) return state;
        next.links = links;
        break;
      }
      case 'phase':
        requireThat(Number.isInteger(delta), 'Фаза задаётся в восьмых.');
        source.phase = wrap(source.phase + delta);
        next.source = source;
        break;
      case 'level':
        requireThat(Number.isFinite(delta), 'Некорректная громкость.');
        source.level = Math.max(0, Math.min(2, Math.round((source.level + delta) * 4) / 4));
        next.source = source;
        break;
      case 'delay':
        requireThat(Number.isInteger(delta), 'Задержка задаётся в восьмых.');
        next.delay = Math.max(0, Math.min(MAX_DELAY, state.delay + delta));
        break;
      case 'route':
        requireThat(within(index, 0, STEPS - 1), 'Выберите один из восьми шагов развилки.');
        next.routes = [...state.routes];
        next.routes[index] = Object.hasOwn(action, 'value') ? action.value : !state.routes[index];
        break;
      case 'note':
        requireThat(within(index, 0, STEPS - 1) && Number.isInteger(delta), 'Выберите штифт шестерни.');
        source.notes = [...source.notes];
        source.notes[index] = Object.hasOwn(action, 'value') ? action.value :
          PALETTE[wrap(PALETTE.indexOf(source.notes[index]) + delta, PALETTE.length)];
        next.source = source;
        break;
      default: throw new Error('Неизвестная операция с линией.');
    }
    const valid = restore(next);
    return JSON.stringify(valid) === JSON.stringify(state) ? state : valid;
  }

  // Just one bounded delay and an acyclic graph. To seek or query a Strudel arc
  // in any order, only the last four arrivals and the explicit handover matter.
  function tick(rev, at) {
    requireThat(Number.isSafeInteger(at), 'Ожидался целый шаг.');
    const {state, begin, carry} = rev;
    const activity = Object.fromEntries(Object.keys(PORTS).map(n => [n, []]));
    const frame = {step:wrap(at), tick:at, straight:state.routes[wrap(at)], edges:[], pockets:[],
      activity, hits:Object.fromEntries(destinations.map(n => [n, activity[n]]))};
    if (at < begin) return frame;
    let waiting = carry.filter(box => box.due >= Math.max(begin, at - MAX_DELAY));

    function run(now) {
      const capture = now === at;
      function send(from, packet) {
        const to = state.links[from];
        if (!to) return;
        const box = {...packet, path:packet.path + '/' + from};
        if (capture) frame.edges.push({...box, from, to});
        visit(to, box);
      }
      function visit(n, box) {
        if (capture) activity[n].push(box);
        if (n === 'source') send('source:out', box);
        if (n === 'copy') {
          send('copy:out', box);
          send('copy:copy', box);
        }
        if (n === 'router') send(state.routes[wrap(now)] ? 'router:straight' : 'router:side', box);
        if (n === 'delay') {
          if (state.delay === 0) send('delay:out', box);
          else waiting.push({...box, entered:now, due:now + state.delay});
        }
      }

      const releasing = waiting.filter(box => box.due === now);
      waiting = waiting.filter(box => box.due > now);
      for (const box of releasing) send('delay:out', box);
      const pin = wrap(now - state.source.phase), pitch = state.source.notes[pin];
      if (pitch !== null) visit('source', {pin, pitch, gain:state.source.level, length:pin % 4 === 0 ? .92 : .72, origin:now, path:''});
    }
    for (let now = Math.max(begin, at - MAX_DELAY); now <= at; now++) run(now);
    frame.pockets = waiting;
    return frame;
  }
  function revision(state, begin = 0, previous = null) {
    requireThat(Number.isSafeInteger(begin) && begin >= 0, 'Повреждена позиция транспорта.');
    const carry = previous?.begin === begin ? previous.carry : previous ? tick(previous, begin - 1).pockets : [];
    return Object.freeze({state, begin, carry:Object.freeze(carry.map(box => Object.freeze({...box})))});
  }

  return Object.freeze({STEPS, MAX_DELAY, PALETTE, PORTS, initial, restore, apply, revision, tick});
});
