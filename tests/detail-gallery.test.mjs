import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDom } from './helpers/dom.mjs';
import { initDetailGalleries } from '../src/scripts/detailGallery.ts';

function setup(t) {
  const window = createDom(t, `<section class="detail-gallery">
    <button data-gallery-open="foto:1"><span>Apri foto</span></button>
    <button data-gallery-open="inesistente">Non disponibile</button>
    <dialog class="gallery-lightbox" id="foto:1" tabindex="-1"><div data-gallery-viewer>
      <button data-gallery-action="in">+</button><button data-gallery-action="out">−</button>
      <button data-gallery-action="reset">Adatta</button><button data-gallery-action="fullscreen">Schermo intero</button>
      <button data-gallery-action="close">Chiudi</button><output data-gallery-zoom>100%</output>
      <div data-gallery-stage><div data-gallery-canvas><img alt="Foto" /></div></div><p data-gallery-status></p>
    </div></dialog><dialog class="gallery-lightbox" id="incompleto"></dialog>
  </section><section class="detail-gallery"><button data-gallery-open="foto:1">Altra galleria</button></section>`);
  const dialog = window.document.querySelector('dialog');
  // jsdom non implementa i metodi nativi dei dialog: verifichiamo le chiamate dello script.
  dialog.showModal = t.mock.fn(() => { dialog.open = true; });
  dialog.close = t.mock.fn(() => { dialog.open = false; dialog.dispatchEvent(new window.Event('close')); });
  const focus = t.mock.method(dialog, 'focus');
  initDetailGalleries();
  return { window, dialog, focus };
}

test('il click su un elemento del pulsante apre la foto e sposta il focus', (t) => {
  const { window, dialog, focus } = setup(t);
  window.document.querySelector('button span').click();
  assert.equal(dialog.showModal.mock.callCount(), 1);
  assert.deepEqual(focus.mock.calls[0].arguments, [{ preventScroll: true }]);
  assert.equal(window.document.activeElement, dialog);
});

test('zoom con pulsanti, tastiera, rotella e doppio click resta fra 100% e 400%', (t) => {
  const { window, dialog } = setup(t);
  const stage = dialog.querySelector('[data-gallery-stage]');
  const zoom = () => dialog.querySelector('output').value;
  const action = name => dialog.querySelector(`[data-gallery-action="${name}"]`).click();
  const key = key => dialog.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true }));
  stage.dispatchEvent(new window.WheelEvent('wheel', { deltaY: -1 }));
  window.document.querySelector('button span').click();
  assert.equal(zoom(), '100%');
  action('in'); assert.equal(zoom(), '150%');
  action('out'); assert.equal(zoom(), '100%');
  key('+'); key('='); key('-'); assert.equal(zoom(), '150%');
  key('0'); key('ArrowLeft'); assert.equal(zoom(), '100%');
  stage.dispatchEvent(new window.MouseEvent('dblclick')); assert.equal(zoom(), '200%');
  stage.dispatchEvent(new window.MouseEvent('dblclick')); assert.equal(zoom(), '100%');
  for (let i = 0; i < 20; i++) stage.dispatchEvent(new window.WheelEvent('wheel', { deltaY: -10, cancelable: true }));
  assert.equal(zoom(), '400%');
  assert.equal(dialog.querySelector('[data-gallery-action="in"]').disabled, true);
  action('reset'); assert.equal(zoom(), '100%');
  stage.dispatchEvent(new window.WheelEvent('wheel', { deltaY: 10 })); assert.equal(zoom(), '100%');
  assert.equal(dialog.querySelector('[data-gallery-action="out"]').disabled, true);
  action('close');
  assert.equal(window.document.documentElement.classList.contains('gallery-is-open'), false);
  assert.equal(window.document.activeElement, window.document.querySelector('button'));
});

test('trascina la foto ingrandita con il mouse e lascia al browser le gesture touch', (t) => {
  const { window, dialog } = setup(t);
  const stage = dialog.querySelector('[data-gallery-stage]');
  const pointer = (type, values = {}) => {
    const event = new window.Event(type, { cancelable: true });
    Object.assign(event, { pointerType: 'mouse', button: 0, pointerId: 1, clientX: 100, clientY: 100, ...values });
    stage.dispatchEvent(event); return event;
  };
  pointer('pointermove'); pointer('pointerdown');
  window.document.querySelector('button span').click();
  dialog.querySelector('[data-gallery-action="in"]').click();
  assert.equal(pointer('pointerdown', { pointerType: 'touch' }).defaultPrevented, false);
  assert.equal(pointer('pointerdown', { button: 2 }).defaultPrevented, false);
  pointer('pointerdown'); pointer('pointermove', { clientX: 50, clientY: 30 });
  assert.equal(stage.scrollLeft, 50); assert.equal(stage.scrollTop, 70);
  pointer('pointerup'); pointer('pointermove', { clientX: 0 });
  assert.equal(stage.scrollLeft, 50);
  pointer('pointerdown'); pointer('pointercancel'); pointer('pointermove', { clientX: 0 });
  assert.equal(stage.scrollLeft, 50);
});

test('inizializzazione ripetuta non duplica le aperture e ignora dialog incompleti', (t) => {
  const { window, dialog } = setup(t);
  initDetailGalleries();
  window.document.querySelector('button span').click();
  assert.equal(dialog.showModal.mock.callCount(), 1);
  const text = dialog.querySelector('button').firstChild;
  text.dispatchEvent(new window.Event('click', { bubbles: true }));
});

test('fullscreen nascosto senza supporto e richiesta rifiutata senza perdere la foto', async (t) => {
  const { dialog } = setup(t);
  const button = dialog.querySelector('[data-gallery-action="fullscreen"]');
  assert.equal(button.hidden, true);
  button.hidden = false;
  button.click();
  await new Promise(resolve => setImmediate(resolve));
  assert.match(dialog.querySelector('[data-gallery-status]').textContent, /non disponibile/);
});

test('entra ed esce dal fullscreen sul contenitore della foto e gestisce gli errori in chiusura', async (t) => {
  const { window, dialog } = setup(t);
  const viewer = dialog.querySelector('[data-gallery-viewer]');
  let current = null;
  Object.defineProperty(window.document, 'fullscreenElement', { configurable: true, get: () => current });
  viewer.requestFullscreen = t.mock.fn(async () => { current = viewer; });
  window.document.exitFullscreen = t.mock.fn(async () => { current = null; });
  const button = dialog.querySelector('[data-gallery-action="fullscreen"]');
  button.hidden = false;
  button.click(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(current, viewer);
  viewer.dispatchEvent(new window.Event('fullscreenchange'));
  assert.equal(button.textContent, 'Esci da schermo intero');
  button.click(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(current, null);
  viewer.dispatchEvent(new window.Event('fullscreenchange'));
  assert.equal(button.textContent, 'Schermo intero');
  button.click(); await new Promise(resolve => setImmediate(resolve));
  window.document.exitFullscreen = async () => { throw new Error('negato'); };
  dialog.dispatchEvent(new window.Event('close'));
  await new Promise(resolve => setImmediate(resolve));
});

test('il click sullo sfondo chiude la foto, quello sull’immagine la mantiene aperta', (t) => {
  const { window, dialog } = setup(t);
  window.document.querySelector('img').click();
  assert.equal(dialog.close.mock.callCount(), 0);
  dialog.click();
  assert.equal(dialog.close.mock.callCount(), 1);
});

test('ignora destinazioni mancanti e non apre dialog appartenenti ad altre gallerie', (t) => {
  const { window, dialog } = setup(t);
  window.document.querySelector('[data-gallery-open="inesistente"]').click();
  window.document.querySelectorAll('section')[1].querySelector('button').click();
  window.document.querySelector('section').click();
  assert.equal(dialog.showModal.mock.callCount(), 0);
});

test('ignora eventi provenienti da nodi di testo', (t) => {
  const { window, dialog } = setup(t);
  const text = window.document.querySelector('button span').firstChild;
  text.dispatchEvent(new window.Event('click', { bubbles: true }));
  assert.equal(dialog.showModal.mock.callCount(), 0);
});
