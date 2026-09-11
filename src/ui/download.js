/**
 * File downloads and local persistence.
 *
 * Everything stays on the machine. There is no upload and no analytics in this
 * tool, which is the point of it being a static page: a feasibility study is
 * commercially sensitive long before it is planning-ready.
 */

const STORE_KEY = 'massing-study:state:v1';

/** Hand the browser a file. The object URL is released on the next frame. */
export function downloadText(filename, text, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  requestAnimationFrame(() => URL.revokeObjectURL(url));
}

/** Export the canvas as a PNG at its current backing-store resolution. */
export function downloadCanvas(canvas, filename) {
  return new Promise((resolve) => {
    if (!canvas.toBlob) {
      downloadText(filename.replace(/\.png$/, '.txt'), 'This browser cannot export a PNG.');
      resolve(false);
      return;
    }
    canvas.toBlob((blob) => {
      if (!blob) { resolve(false); return; }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
      requestAnimationFrame(() => URL.revokeObjectURL(url));
      resolve(true);
    }, 'image/png');
  });
}

/** Ask for a file the user picks. Resolves to null if they cancel. */
export function pickTextFile(accept = '.json,application/json') {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (!file) { resolve(null); return; }
      const reader = new FileReader();
      reader.addEventListener('load', () => resolve(String(reader.result)));
      reader.addEventListener('error', () => resolve(null));
      reader.readAsText(file);
    });
    input.click();
  });
}

/**
 * Remember the last scheme. Wrapped because storage throws outright in a
 * private window and in an iframe with third-party storage blocked; losing the
 * last session is not worth a broken page.
 */
export function saveLocal(state) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function loadLocal() {
  try {
    const text = localStorage.getItem(STORE_KEY);
    if (!text) return null;
    const data = JSON.parse(text);
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

export function clearLocal() {
  try {
    localStorage.removeItem(STORE_KEY);
    return true;
  } catch {
    return false;
  }
}
