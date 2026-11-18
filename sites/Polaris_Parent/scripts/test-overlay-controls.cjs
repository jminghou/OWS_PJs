// Interaction regression tests against the actual shared component, without a DOM.
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '../../..');
const source = path.join(root, 'packages/ziwei-chart/src/react/OverlayControls.tsx');
const result = esbuild.buildSync({ entryPoints: [source], bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react', 'react/jsx-runtime'] });
let slots = [], cursor = 0;
const compiled = new Module(source, module);
compiled.filename = source;
compiled.paths = module.paths;
const realRequire = compiled.require.bind(compiled);
compiled.require = (name) => name === 'react' ? {
  ...require('react'), useId: () => 'test', useState(initial) {
    const i = cursor++;
    if (!(i in slots)) slots[i] = initial;
    return [slots[i], (next) => { slots[i] = next; }];
  },
} : realRequire(name);
compiled._compile(result.outputFiles[0].text, source);
const { OverlayControls } = compiled.exports;
const years = Array.from({ length: 24 }, (_, i) => ({ year: 2017 + i, age: i + 1 }));
const flow = { years, smallLimits: years, decades: [
  { order: 1, ageRange: '5-14', yearRange: '2021-2030' },
  { order: 2, ageRange: '15-24', yearRange: '2031-2040' },
] };
let state = { decade: false, small: true, year: true, targetYear: 2030 };
const theme = { colors: { palaceName: '#222', bg: '#fff', gridStroke: '#ccc', layerDecade: 'green', layerSmall: 'purple', layerYear: 'blue' } };
function render() {
  cursor = 0;
  return OverlayControls({ flow, state, year: state.targetYear, theme, resolved: null, onChange: (s) => { state = s; } });
}
function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap((n) => nodes(n, predicate));
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)];
}
function text(n) { return n == null || typeof n === 'boolean' ? '' : Array.isArray(n) ? n.map(text).join('') : typeof n === 'object' ? text(n.props?.children) : String(n); }
function button(label) { const b = nodes(render(), (n) => n.type === 'button' && text(n) === label)[0]; assert.ok(b, label); return b; }
function click(label) { const b = button(label); assert.ok(!b.props.disabled, label); b.props.onClick(); }
click('＋1 年');
assert.equal(state.targetYear, 2031);
assert.equal(nodes(render(), (n) => n.props?.className === 'zw-picker').length, 0);
nodes(render(), (n) => n.props?.className === 'zw-current')[0].props.onClick();
assert.equal(nodes(render(), (n) => n.type === 'select' && n.props['aria-label'] === '選擇大限區間')[0].props.value, 'decade-2');
assert.equal(nodes(render(), (n) => n.props?.className === 'zw-years')[0].props.children.length, 10);
click('−10 年'); assert.equal(state.targetYear, 2021);
click('＋10 年'); assert.equal(state.targetYear, 2031);
nodes(render(), (n) => n.type === 'select' && n.props['aria-label'] === '選擇大限區間')[0].props.onChange({ target: { value: 'decade-1' } });
assert.equal(state.targetYear, 2021);
click('本命'); assert.equal(state.targetYear, 2021); assert.equal(state.small, false); assert.equal(state.year, false);
click('小限'); assert.equal(state.small, true); assert.equal(state.targetYear, 2021);
let selector = nodes(render(), (n) => n.type === 'select' && n.props['aria-label'] === '跳轉輸入方式')[0];
selector.props.onChange({ target: { value: 'age' } });
nodes(render(), (n) => n.type === 'input')[0].props.onChange({ target: { value: '15' } });
assert.equal(button('前往').props.disabled, false);
nodes(render(), (n) => n.type === 'form')[0].props.onSubmit({ preventDefault() {} });
assert.equal(state.targetYear, 2031);
assert.equal(nodes(render(), (n) => n.props?.className === 'zw-picker').length, 0);
nodes(render(), (n) => n.props?.className === 'zw-current')[0].props.onClick();
nodes(render(), (n) => n.type === 'input')[0].props.onChange({ target: { value: '9999' } });
assert.equal(button('前往').props.disabled, true);
nodes(render(), (n) => n.type === 'input')[0].props.onChange({ target: { value: '2038' } });
nodes(render(), (n) => n.type === 'form')[0].props.onSubmit({ preventDefault() {} });
assert.equal(state.targetYear, 2038);
state.targetYear = 2017;
assert.equal(button('−1 年').props.disabled, true);
assert.ok(text(render()).includes('起運前'));
state.targetYear = 2040;
assert.equal(button('＋1 年').props.disabled, true);
flow.years = [];
assert.ok(text(render()).includes('2040'));
flow.smallLimits = [];
assert.ok(text(render()).includes('目前沒有可選的年份資料'));
console.log('PASS: cross-decade navigation, ten-year grid, +/-10, layer independence, age jump, invalid input, range boundaries, pre-decade years, small-only and empty data');
