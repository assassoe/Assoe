import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import { JSDOM } from 'jsdom';

test('la configurazione si apre solo dal menu, mostra l’avviso e conserva la bozza quando viene chiusa', async (t) => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'assoe-special-editor-'));
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  const requireStudio = createRequire(path.join(root, 'studio/package.json'));
  const moduleUrl = (name) => pathToFileURL(requireStudio.resolve(name)).href;
  const React = await import(moduleUrl('react'));
  const { createRoot } = await import(moduleUrl('react-dom/client'));
  const { act, createElement: h } = React;
  let renderRoot;
  const dom = new JSDOM('<!doctype html><div id="root"></div>');
  const previous = new Map(['window', 'document', 'navigator', 'IS_REACT_ACT_ENVIRONMENT'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true })) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  t.after(async () => {
    if (renderRoot) await act(() => renderRoot.unmount());
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
    dom.window.close();
  });
  // Gli adattatori simulano solo il contesto Sanity e i contenitori UI. Stato e componenti del progetto sono reali.
  fs.writeFileSync(path.join(fixture, 'sanity.mjs'), `
    export let documentId = 'drafts.iniziativa';
    export function setDocumentId(id) { documentId = id; }
    export function useFormValue() { return documentId; }
    export function useProjectId() { return 'test'; }
    export function useDataset() { return 'production'; }
  `);
  fs.writeFileSync(path.join(fixture, 'ui.mjs'), `
    import {createElement as h} from ${JSON.stringify(moduleUrl('react'))};
    export const Box = ({children}) => h('div', null, children);
    export const Card = Box; export const Stack = Box;
    export const Text = ({children}) => h('p', null, children);
    export const Button = ({text, onClick}) => h('button', {onClick}, text);
    export const Dialog = ({header, children, footer, onClose}) => h('section', {role:'dialog', 'aria-label':header},
      h('button', {onClick:onClose}, 'Chiudi finestra'), children, footer);
  `);
  const source = fs.readFileSync(path.join(root, 'studio/schemaTypes/InitiativeSpecialSectionsEditor.tsx'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const imports = {
    'sanity': pathToFileURL(path.join(fixture, 'sanity.mjs')).href,
    '@sanity/ui': pathToFileURL(path.join(fixture, 'ui.mjs')).href,
    '../structure/initiativeSpecialSectionsState': pathToFileURL(path.join(root, 'studio/structure/initiativeSpecialSectionsState.ts')).href,
    'react': moduleUrl('react'), 'react/jsx-runtime': moduleUrl('react/jsx-runtime'),
  };
  fs.writeFileSync(path.join(fixture, 'editor.mjs'), compiled.replace(/from (["'])([^"']+)\1/g, (_match, _quote, specifier) => `from ${JSON.stringify(imports[specifier] ?? specifier)}`));
  const { InitiativeSpecialSectionsAction: action, InitiativeSpecialSectionsField: Field } = await import(pathToFileURL(path.join(fixture, 'editor.mjs')).href);
  const context = await import(pathToFileURL(path.join(fixture, 'sanity.mjs')).href);
  const container = dom.window.document.getElementById('root');
  renderRoot = createRoot(container);
  const content = [{ _key: 'institutional', _type: 'initiativeTextSection', title: 'Comunicazione' }];
  let value;
  let nativeRenders = 0;
  const props = {
    inputId: 'special-sections',
    renderDefault: () => {
      nativeRenders++;
      return h('button', { onClick: () => { value = content; render(); } }, 'Simula modifica nativa');
    },
  };
  function render() { renderRoot.render(h(Field, { ...props, value })); }
  await act(render);
  assert.equal(container.textContent, '');
  assert.equal(nativeRenders, 0);
  const menu = action({ id: 'iniziativa', initialValueResolved: true });
  assert.deepEqual(menu.group, ['paneActions']);
  assert.equal(action({ id: 'iniziativa', initialValueResolved: false }).disabled, true);
  await act(menu.onHandle);
  assert.ok(container.querySelector('[role="dialog"]'));
  assert.match(container.textContent, /MI RACCOMANDO: NON USARE QUESTA SEZIONE/);
  assert.match(container.textContent, /L’utilizzo è affidato a Danilo/);
  assert.equal(value, undefined);
  await act(() => [...container.querySelectorAll('button')].find((button) => button.textContent === 'Simula modifica nativa').click());
  assert.equal(value, content);
  await act(() => [...container.querySelectorAll('button')].find((button) => button.textContent === 'Chiudi configurazione').click());
  assert.equal(container.querySelector('[role="dialog"]'), null);
  assert.match(container.textContent, /configurazione istituzionale gestita da Danilo/);
  assert.equal(value, content);
  await act(menu.onHandle);
  assert.ok(container.querySelector('[role="dialog"]'));
  await act(() => { context.setDocumentId('drafts.altra'); render(); });
  assert.equal(container.querySelector('[role="dialog"]'), null);
  await act(() => { context.setDocumentId('drafts.iniziativa'); render(); });
  assert.equal(container.querySelector('[role="dialog"]'), null);
});
