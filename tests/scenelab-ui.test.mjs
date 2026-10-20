/** Actual SceneLab app/model tests. DOM, canvas, stage, and encoder are doubles.
 * No browser, rendering, codec, or real media-file correctness is claimed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Blob } from 'node:buffer';
import vm from 'node:vm';

let base, appSource;
for (const relative of ['../dist/scenelab/', '../']) {
  try {
    const candidate = new URL(relative, import.meta.url);
    appSource = await readFile(new URL('src/app.js', candidate), 'utf8');
    base = candidate;
    break;
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
assert.ok(base, 'Find SceneLab source in the collection or standalone archive.');
const [modelSource, template] = await Promise.all([
  readFile(new URL('src/model.js', base), 'utf8'),
  readFile(new URL('src/template.html', base), 'utf8'),
]);
const plain = value => JSON.parse(JSON.stringify(value));
const noop = () => {};

function harness({ stageThrows = false, firstStartThrows = false, sourceWidth = 1280, sourceHeight = 720 } = {}) {
  const downloads = [], canvases = [], recorders = [], errors = [], urls = new Map(), ids = new Map();
  const frames = [];
  const storage = new Map();
  let document;
  class Element {
    constructor(tag = 'div') {
      this.tagName = tag.toUpperCase(); this.children = []; this.dataset = {};
      this.attributes = new Map(); this.events = new Map(); this.style = {};
      this.disabled = false; this.hidden = false; this.open = false; this.checked = false;
      this.value = ''; this._text = ''; this._classes = new Set();
      this.classList = {
        add: (...names) => names.forEach(name => this._classes.add(name)),
        remove: (...names) => names.forEach(name => this._classes.delete(name)),
        contains: name => this._classes.has(name),
        toggle: (name, force = !this._classes.has(name)) => {
          if (force) this._classes.add(name); else this._classes.delete(name);
          return force;
        },
      };
    }
    set className(value) { this._classes = new Set(String(value).split(/\s+/).filter(Boolean)); }
    get className() { return [...this._classes].join(' '); }
    set textContent(value) { this.replaceChildren(); this._text = String(value); }
    get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
    setAttribute(name, value) {
      this.attributes.set(name, String(value));
      if (name === 'id') this.id = String(value);
      if (name === 'class') this.className = value;
      if (name === 'value') this.value = String(value);
      if (['hidden', 'disabled', 'checked', 'open'].includes(name)) this[name] = true;
      if (name.startsWith('data-')) this.dataset[name.slice(5)] = String(value);
    }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    appendChild(child) { child.remove(); this.children.push(child); child.parentNode = this; return child; }
    append(...children) { children.forEach(child => this.appendChild(child)); }
    replaceChildren(...children) {
      this.children.forEach(child => { child.parentNode = null; });
      this.children = []; this._text = ''; this.append(...children);
    }
    remove() {
      if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this);
      this.parentNode = null;
    }
    addEventListener(type, handler) {
      if (!this.events.has(type)) this.events.set(type, []);
      this.events.get(type).push(handler);
    }
    emit(type, event = {}) {
      const payload = { type, target: this, preventDefault: noop, ...event };
      return Promise.all((this.events.get(type) || []).map(handler => handler.call(this, payload)));
    }
    click() {
      if (this.disabled) return Promise.resolve();
      for (let parent = this.parentNode; parent; parent = parent.parentNode)
        if (parent.tagName === 'FIELDSET' && parent.disabled) return Promise.resolve();
      if (this.tagName === 'A' && this.download) downloads.push({ name: this.download, href: this.href, blob: urls.get(this.href) });
      return this.emit('click');
    }
    matchesSimple(selector) {
      if (selector.startsWith('.')) return this.classList.contains(selector.slice(1));
      if (selector.startsWith('#')) return this.id === selector.slice(1);
      const attribute = selector.match(/^\[([^\]]+)\]$/);
      if (attribute) return this.attributes.has(attribute[1]);
      return this.tagName === selector.toUpperCase();
    }
    matches(selector) {
      const pieces = selector.trim().split(/\s+/);
      if (!this.matchesSimple(pieces.pop())) return false;
      let parent = this.parentNode;
      while (pieces.length) {
        const need = pieces.pop();
        while (parent && !parent.matchesSimple(need)) parent = parent.parentNode;
        if (!parent) return false;
        parent = parent.parentNode;
      }
      return true;
    }
    querySelectorAll(selector) {
      const alternatives = selector.split(',');
      return this.children.flatMap(child => [
        ...(alternatives.some(part => child.matches(part)) ? [child] : []),
        ...child.querySelectorAll(selector),
      ]);
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    showModal() { this.open = true; }
    close() { this.open = false; }
    setPointerCapture() {}
  }
  class Canvas extends Element {
    constructor() {
      super('canvas'); this.width = 300; this.height = 150; this.draws = [];
      this.context = new Proxy({
        drawImage: (...args) => this.draws.push(args),
        measureText: text => ({ width: String(text).length * 8 }),
      }, { get: (target, key) => key in target ? target[key] : noop });
      canvases.push(this);
    }
    getContext(kind) { assert.equal(kind, '2d'); return this.context; }
    toDataURL(mime) { return `data:${mime};base64,dGVzdA==`; }
    captureStream(rate) {
      const track = { stopped: false, stop() { this.stopped = true; } };
      return { rate, track, getTracks: () => [track] };
    }
  }
  const make = tag => tag.toLowerCase() === 'canvas' ? new Canvas() : new Element(tag);
  document = new Element('document');
  const stack = [document], voidTags = new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
  for (const token of template.match(/<[^>]+>|[^<]+/g) || []) {
    if (/^<!|^<\?/.test(token)) continue;
    if (!token.startsWith('<')) { stack.at(-1)._text += token; continue; }
    const close = token.match(/^<\/([\w:-]+)/);
    if (close) {
      const index = stack.findLastIndex(element => element.tagName === close[1].toUpperCase());
      if (index > 0) stack.length = index;
      continue;
    }
    const open = token.match(/^<([\w:-]+)([\s\S]*?)\/?\s*>$/);
    if (!open) continue;
    const element = make(open[1]);
    for (const match of open[2].matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))
      element.setAttribute(match[1], match[2] ?? match[3] ?? match[4] ?? '');
    stack.at(-1).appendChild(element);
    if (element.id) { assert.equal(ids.has(element.id), false, `Duplicate id ${element.id}`); ids.set(element.id, element); }
    if (!voidTags.has(open[1].toLowerCase()) && !/\/\s*>$/.test(token)) stack.push(element);
  }
  document.body = document.querySelector('body');
  document.getElementById = id => ids.get(id) || null;
  document.createElement = make;
  document.hidden = false;
  const sourceCanvas = new Canvas(); sourceCanvas.width = sourceWidth; sourceCanvas.height = sourceHeight;
  const stage = {
    renderer: { domElement: sourceCanvas }, renderCount: 0,
    apply(state) { this.state = plain(state); }, update(time) { this.time = time; },
    render() { this.renderCount++; }, resize: noop, setMotion: noop,
    capture: () => 'data:image/png;base64,dGVzdA==',
  };
  class Recorder {
    static isTypeSupported(type) { return type.startsWith('video/webm'); }
    constructor(stream, options) {
      this.stream = stream; this.options = options; this.state = 'inactive'; this.stopCalls = 0;
      this.number = recorders.length; recorders.push(this);
    }
    start() {
      if (firstStartThrows && this.number === 0) { this.pendingStop = true; throw new Error('encoder start failed'); }
      this.state = 'recording';
    }
    stop() { this.state = 'inactive'; this.stopCalls++; this.pendingStop = true; }
    data(text = 'encoded chunk') { this.ondataavailable?.({ data: new Blob([text], { type: this.options.mimeType }) }); }
    error() { this.onerror?.(new Error('encoder failed')); }
    finish() { this.pendingStop = false; this.onstop?.(); }
  }
  let urlCounter = 0;
  const context = vm.createContext({
    document, Blob, HTMLCanvasElement: Canvas, MediaRecorder: Recorder,
    SceneLabWorld: { createStage(container) {
      if (stageThrows) throw new Error('synthetic renderer creation failure');
      container.appendChild(sourceCanvas); return stage;
    } },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)) },
    URL: { createObjectURL(blob) { const url = `blob:test-${++urlCounter}`; urls.set(url, blob); return url; }, revokeObjectURL: noop },
    performance: { now: () => 0 },
    requestAnimationFrame: callback => { frames.push(callback); return frames.length; },
    setTimeout: () => 1, clearTimeout: noop,
    ResizeObserver: class { constructor(callback) { this.callback = callback; } observe() { this.callback(); } },
    matchMedia: () => ({ matches: false }),
    console: { log: noop, warn: noop, error: (...args) => errors.push(args) },
  });
  vm.runInContext(modelSource, context, { filename: 'scenelab/src/model.js' });
  vm.runInContext(appSource, context, { filename: 'scenelab/src/app.js' });
  return { context, document, stage, sourceCanvas, canvases, recorders, downloads, errors,
    el(id) { const element = ids.get(id); assert.ok(element, `Missing #${id}`); return element; },
    project: () => plain(context.SceneLab.getProject()),
  };
}

test('real controls generate, add, select, save, and load a three-shot project', async () => {
  const h = harness();
  assert.deepEqual(h.errors, []);
  assert.equal(h.el('loading').hidden, true);
  assert.equal(h.project().shots.length, 3);
  h.el('idea').value = 'Түндегі жұмбақ хат'; await h.el('idea').emit('input');
  await h.el('generate-plan').click();
  assert.equal(h.project().shots.length, 3);
  assert.equal(h.project().shots[0].settings.mode, 'cool');
  await h.el('add-shot').click();
  assert.equal(h.project().shots.length, 4);
  await h.el('shots').children[2].querySelector('button').click();
  assert.equal(h.el('shot-label').textContent, '03');
  assert.equal(h.project().state.focal, h.project().shots[2].settings.focal);
  await h.el('save-project').click();
  const file = h.downloads.find(item => item.name === 'SceneLab_project.json');
  assert.ok(file?.blob);
  const json = await file.blob.text();
  const expected = JSON.parse(json);
  h.el('azimuth').value = '-80'; await h.el('azimuth').emit('input');
  assert.notEqual(h.project().state.azimuth, expected.state.azimuth);
  h.el('project-file').files = [{ size: Buffer.byteLength(json), text: async () => json }];
  await h.el('project-file').emit('change');
  assert.deepEqual(h.project(), expected);
  assert.match(h.el('status').textContent, /Жоба ашылды/);
});

test('stopping a recording keeps new starts blocked until the asynchronous onstop completes', async () => {
  const h = harness();
  assert.equal(h.el('record').disabled, false);
  await h.el('record').click();
  const recorder = h.recorders[0];
  assert.equal(recorder.state, 'recording');
  await h.el('play').click();
  assert.equal(recorder.stopCalls, 1);
  assert.equal(h.el('record').disabled, true);
  assert.equal(h.el('play').disabled, true);
  assert.equal(h.el('add-shot').disabled, true);
  await h.el('record').emit('click'); // Exercise the app guard even beyond disabled DOM behavior.
  assert.equal(h.recorders.length, 1);
  assert.match(h.el('status').textContent, /Алдыңғы бейне/);
  recorder.data(); recorder.finish();
  assert.equal(recorder.stream.track.stopped, true);
  assert.equal(h.el('record').disabled, false);
  assert.equal(h.el('play').disabled, false);
  assert.equal(h.downloads.filter(item => item.name.endsWith('.webm')).length, 1);
  await h.el('record').click();
  assert.equal(h.recorders.length, 2);
});

test('a late onstop from a failed start cannot clear a newer recording job', async () => {
  const h = harness({ firstStartThrows: true });
  await h.el('record').click();
  const old = h.recorders[0];
  assert.equal(h.el('record').disabled, false);
  await h.el('record').click();
  const current = h.recorders[1];
  assert.equal(current.state, 'recording');
  old.data('partial data from failed start'); old.finish();
  assert.equal(h.downloads.filter(item => item.name.endsWith('.webm')).length, 0);
  await h.el('play').click();
  assert.equal(current.stopCalls, 1, 'The active job must still be owned and stopped by the app.');
  assert.equal(h.el('record').disabled, true, 'The current job must retain its finalization lock.');
  current.data(); current.finish();
  assert.equal(h.el('record').disabled, false);
  assert.equal(h.downloads.filter(item => item.name.endsWith('.webm')).length, 1);
});

test('encoder errors with partial chunks never download a successful WebM after onstop', async () => {
  const h = harness();
  await h.el('record').click();
  const recorder = h.recorders[0];
  recorder.data('partial first chunk');
  recorder.error();
  assert.equal(recorder.stopCalls, 1);
  assert.equal(h.el('record').disabled, true);
  recorder.data('partial final chunk');
  recorder.finish();
  assert.equal(h.downloads.filter(item => item.name.endsWith('.webm')).length, 0);
  assert.match(h.el('status').textContent, /жазу орындалмады/);
  assert.doesNotMatch(h.el('status').textContent, /бейнесі дайын|жүктеуді ұсынды/);
  assert.equal(h.el('record').disabled, false);
  assert.equal(recorder.stream.track.stopped, true);
});

for (const [width, height, expected] of [[1280, 720, [0,10,320,180]], [600,800,[85,0,150,200]]]) {
  test(`actual thumbnails letterbox a ${width}x${height} source without stretching`, () => {
    const h = harness({ sourceWidth: width, sourceHeight: height });
    assert.deepEqual(h.errors, []);
    const thumbnails = h.canvases.filter(canvas => canvas.width === 320 && canvas.height === 200);
    assert.equal(thumbnails.length, 3);
    for (const thumbnail of thumbnails) {
      const draw = thumbnail.draws.find(args => args[0] === h.sourceCanvas);
      assert.ok(draw);
      assert.deepEqual(draw.slice(1), expected);
      assert.ok(Math.abs(draw[3] / draw[4] - width / height) < 1e-9);
    }
  });
}

test('renderer creation failure exposes the loader, disables unusable controls, and leaves help usable', async () => {
  const h = harness({ stageThrows: true });
  assert.equal(h.errors.length, 1);
  assert.equal(h.context.SceneLab, undefined);
  assert.equal(h.el('loading').hidden, false);
  assert.match(h.el('loading').textContent, /ашу мүмкін болмады/);
  for (const control of h.document.querySelectorAll('button,input,select,textarea')) {
    if (['help-button', 'close-help'].includes(control.id)) assert.equal(control.disabled, false);
    else assert.equal(control.disabled, true, `Dead control #${control.id || control.tagName} must be disabled.`);
  }
  await h.el('help-button').click(); assert.equal(h.el('help').open, true);
  await h.el('close-help').click(); assert.equal(h.el('help').open, false);
});
