import { useEffect, useRef } from 'react';
import { SPECTRUM } from './sequence';
import { sfx } from './sfx';

/*
 * SNaP studios (Shreekanth, Neha and Poojith): the studio card after PRESS ANY KEY.
 * Black; a thin spectrum line draws across, the SNaP mark rises in, a deep hit lands at 1.5 s
 * with STUDIOS beneath it, then everything fades to black at 3.5 s and the intro begins at 4 s.
 */
export function StudioSplash({ onDone }: { onDone: () => void }) {
  const done = useRef(onDone); done.current = onDone;
  useEffect(() => {
    const hit = setTimeout(() => sfx.studioHit(), 1500);
    const end = setTimeout(() => done.current(), 4000);
    return () => { clearTimeout(hit); clearTimeout(end); };
  }, []);
  return (
    <div className="studio" aria-label="SNaP studios">
      <div className="studio-mark" aria-hidden>
        <span>S</span><span>N</span><span className="a">a</span><span>P</span>
      </div>
      <div className="studio-line" aria-hidden>{SPECTRUM.map((b) => <i key={b.letter} style={{ background: b.color }} />)}</div>
      <div className="studio-name">STUDIOS</div>
    </div>
  );
}
