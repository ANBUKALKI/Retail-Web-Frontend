import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

/**
 * Three ways to scan: the camera, a USB/Bluetooth scanner (acts like a keyboard and presses Enter),
 * or pasting the code text. All of them call onScan(text).
 */
export default function Scanner({ onScan }) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [manual, setManual] = useState('');
  const scanner = useRef(null);
  const last = useRef({ text: '', at: 0 });
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  async function start() {
    setError('');
    try {
      const h = new Html5Qrcode('qr-reader');
      scanner.current = h;
      await h.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (text) => {
          const now = Date.now();
          // The camera reads the same label many times per second; ignore repeats for a moment.
          if (text === last.current.text && now - last.current.at < 2500) return;
          last.current = { text, at: now };
          onScanRef.current(text);
        },
        () => {}
      );
      setRunning(true);
    } catch (e) {
      scanner.current = null;
      setError('Could not open the camera. Allow camera access (the site must use HTTPS or localhost), or use the box below.');
    }
  }

  async function stop() {
    const h = scanner.current;
    scanner.current = null;
    if (h) {
      try {
        await h.stop();
        h.clear();
      } catch {
        /* already stopped */
      }
    }
    setRunning(false);
  }

  useEffect(
    () => () => {
      stop();
    },
    []
  );

  function submitManual(e) {
    e.preventDefault();
    const text = manual.trim();
    if (!text) return;
    setManual('');
    onScanRef.current(text);
  }

  return (
    <div className="scanner">
      <div id="qr-reader" className={running ? 'qr-reader' : 'qr-reader qr-reader-off'} />
      <div className="row">
        {running ? (
          <button className="btn" onClick={stop}>
            Stop camera
          </button>
        ) : (
          <button className="btn btn-primary" onClick={start}>
            Start camera
          </button>
        )}
      </div>
      {error && <p className="error">{error}</p>}
      <form onSubmit={submitManual} className="row">
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="USB scanner or paste QR text, then Enter"
          autoComplete="off"
        />
        <button className="btn" type="submit">
          Add
        </button>
      </form>
    </div>
  );
}
