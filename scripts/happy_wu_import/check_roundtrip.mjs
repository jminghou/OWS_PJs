import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { Editor } from '@tiptap/core';
import { createArticleBaseExtensions } from '../../packages/admin-app/src/components/articleExtensions.ts';

const dom = new JSDOM('<html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Node = dom.window.Node;
globalThis.getComputedStyle = dom.window.getComputedStyle;

const plan = JSON.parse(readFileSync('docs/happy-wu-import/generated/import-plan.json', 'utf8'));
const stats = { documents: 0, tableDocuments: 0, tables: 0, cells: 0 };
function structure(html) {
  const el = document.createElement('div');
  el.innerHTML = html;
  const tags = ['table', 'tr', 'td', 'th', 'h2', 'h3', 'blockquote', 'ul', 'ol', 'li'];
  // ProseMirror merges adjacent bold marks. Compare marked text, not tag count.
  const marks = [];
  const walker = document.createTreeWalker(el, window.NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const flags = `${Number(!!node.parentElement.closest('strong,b'))}${Number(!!node.parentElement.closest('em,i'))}`;
    for (const char of node.textContent.replace(/\s+/g, '')) marks.push(char + flags);
  }
  return {
    text: el.textContent.replace(/\s+/g, ''),
    counts: tags.map(tag => [tag, el.querySelectorAll(tag).length]),
    marks,
    starts: Array.from(el.querySelectorAll('ol')).map(e => e.getAttribute('start') || '1'),
  };
}
for (const ep of plan.episodes) {
  for (const doc of ep.documents.filter(d => ['blog', 'newsletter'].includes(d.platform))) {
    const editor = new Editor({ element: document.createElement('div'), extensions: createArticleBaseExtensions(), content: doc.body });
    const before = structure(doc.body);
    // Open, save, reopen and save again; compare semantic content and structure.
    editor.commands.setContent(editor.getHTML());
    assert.deepEqual(structure(editor.getHTML()), before, `${ep.episode_key}/${doc.platform}`);
    stats.documents++;
    const tableCount = before.counts.find(([tag]) => tag === 'table')[1];
    stats.tableDocuments += Number(tableCount > 0);
    stats.tables += tableCount;
    stats.cells += before.counts.filter(([tag]) => ['td','th'].includes(tag)).reduce((n,[,c]) => n+c,0);
    editor.destroy();
  }
}
writeFileSync('docs/happy-wu-import/generated/roundtrip-results.json', JSON.stringify(stats, null, 2));
console.log(stats);
