function preparePhoto(dialog: HTMLDialogElement) {
  const viewer = dialog.querySelector<HTMLElement>('[data-gallery-viewer]');
  const stage = dialog.querySelector<HTMLElement>('[data-gallery-stage]');
  const canvas = dialog.querySelector<HTMLElement>('[data-gallery-canvas]');
  const output = dialog.querySelector<HTMLOutputElement>('[data-gallery-zoom]');
  if (!viewer || !stage || !canvas || !output) return;

  let zoom = 1;
  let opener: HTMLElement | undefined;
  let drag: { x: number; y: number; left: number; top: number } | undefined;
  const zoomIn = dialog.querySelector<HTMLButtonElement>('[data-gallery-action="in"]')!;
  const zoomOut = dialog.querySelector<HTMLButtonElement>('[data-gallery-action="out"]')!;
  const fullscreen = dialog.querySelector<HTMLButtonElement>('[data-gallery-action="fullscreen"]')!;
  fullscreen.hidden = typeof viewer.requestFullscreen !== 'function';
  viewer.addEventListener('fullscreenchange', () => {
    const active = document.fullscreenElement === viewer;
    fullscreen.textContent = active ? 'Esci da schermo intero' : 'Schermo intero';
    fullscreen.setAttribute('aria-pressed', String(active));
  });
  const image = canvas.querySelector('img');
  if (image) image.draggable = false;

  const setZoom = (value: number) => {
    const next = Math.max(1, Math.min(4, value));
    const ratio = next / zoom;
    const left = (stage.scrollLeft + stage.clientWidth / 2) * ratio - stage.clientWidth / 2;
    const top = (stage.scrollTop + stage.clientHeight / 2) * ratio - stage.clientHeight / 2;
    zoom = next;
    canvas.style.setProperty('--gallery-zoom', String(zoom));
    stage.dataset.zoomed = String(zoom > 1);
    stage.scrollLeft = Math.max(0, left);
    stage.scrollTop = Math.max(0, top);
    output.value = `${Math.round(zoom * 100)}%`;
    zoomIn.disabled = zoom === 4;
    zoomOut.disabled = zoom === 1;
  };

  dialog.addEventListener('click', async (event) => {
    if (!(event.target instanceof Element)) return;
    const action = event.target.closest<HTMLElement>('[data-gallery-action]')?.dataset.galleryAction;
    if (action === 'in') setZoom(zoom + .5);
    if (action === 'out') setZoom(zoom - .5);
    if (action === 'reset') setZoom(1);
    if (action === 'close' || event.target === dialog) dialog.close();
    if (action === 'fullscreen') {
      try {
        if (document.fullscreenElement === viewer) await document.exitFullscreen();
        else await viewer.requestFullscreen();
      } catch {
        dialog.querySelector('[data-gallery-status]')!.textContent = 'Schermo intero non disponibile. Puoi usare lo zoom o aprire l’originale.';
      }
    }
  });
  stage.addEventListener('wheel', (event) => {
    if (!dialog.open) return;
    event.preventDefault();
    setZoom(zoom + (event.deltaY < 0 ? .25 : -.25));
  }, { passive: false });
  stage.addEventListener('dblclick', () => setZoom(zoom === 1 ? 2 : 1));
  dialog.addEventListener('keydown', (event) => {
    if (['+', '=', '-', '0'].includes(event.key)) {
      event.preventDefault();
      setZoom(event.key === '0' ? 1 : zoom + (event.key === '-' ? -.5 : .5));
    }
  });
  stage.addEventListener('pointerdown', (event) => {
    // Il touch mantiene scorrimento e pinch nativi del browser.
    if (event.pointerType === 'touch' || event.button !== 0 || zoom === 1) return;
    event.preventDefault();
    drag = { x: event.clientX, y: event.clientY, left: stage.scrollLeft, top: stage.scrollTop };
    stage.setPointerCapture?.(event.pointerId);
  });
  stage.addEventListener('pointermove', (event) => {
    if (!drag) return;
    stage.scrollLeft = drag.left + drag.x - event.clientX;
    stage.scrollTop = drag.top + drag.y - event.clientY;
  });
  const stopDrag = () => { drag = undefined; };
  stage.addEventListener('pointerup', stopDrag);
  stage.addEventListener('pointercancel', stopDrag);
  dialog.addEventListener('close', () => {
    if (document.fullscreenElement === viewer) void document.exitFullscreen().catch(() => {});
    if (!document.querySelector('.gallery-lightbox[open]')) document.documentElement.classList.remove('gallery-is-open');
    setZoom(1);
    stopDrag();
    opener?.focus({ preventScroll: true });
  });

  return (button: HTMLElement) => {
    opener = button;
    setZoom(1);
    dialog.showModal();
    document.documentElement.classList.add('gallery-is-open');
    dialog.focus({ preventScroll: true });
  };
}

export function initDetailGalleries() {
  document.querySelectorAll<HTMLElement>('.detail-gallery').forEach((gallery) => {
    if (gallery.dataset.galleryInitialized) return;
    gallery.dataset.galleryInitialized = 'true';
    const photos = new Map<string, ReturnType<typeof preparePhoto>>();
    gallery.querySelectorAll<HTMLDialogElement>('dialog.gallery-lightbox').forEach((dialog) => photos.set(dialog.id, preparePhoto(dialog)));
    gallery.addEventListener('click', (event) => {
      if (!(event.target instanceof Element)) return;
      const opener = event.target.closest<HTMLElement>('[data-gallery-open]');
      const open = opener && photos.get(opener.dataset.galleryOpen!);
      if (open) {
        event.preventDefault();
        open(opener);
      }
    });
  });
}
