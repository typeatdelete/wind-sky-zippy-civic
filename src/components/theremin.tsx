import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Volume2, VolumeX } from "lucide-react";
import {
  DEFAULT_REVERB,
  GUIDES,
  WAVEFORMS,
  describePitch,
  freqFromT,
  reverbName,
  type Waveform,
} from "@/lib/pitch";
import { ThereminEngine } from "@/lib/theremin-audio";
import { drawField, readFieldColors, type FieldColors } from "@/lib/draw-field";

type PointerState = {
  x: number;
  y: number;
  inside: boolean;
  pointerType: string;
};

const NATURALS = GUIDES.filter((guide) => guide.natural);

function resizeCanvas(canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width: rect.width, height: rect.height };
}

function WaveIcon({ type }: { type: Waveform }) {
  const d =
    type === "sine"
      ? "M2 12 Q 7 2 12 12 T 22 12 T 30 12"
      : type === "triangle"
        ? "M2 17 L8 5 L16 19 L24 7 L30 17"
        : type === "square"
          ? "M3 16 H9 V6 H16 V18 H23 V6 H29"
          : "M3 17 L11 5 V17 L19 5 V17 L27 5 V17";
  return (
    <svg viewBox="0 0 32 22" className="h-4 w-7" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function Theremin() {
  const engineRef = useRef<ThereminEngine | null>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waveCanvasRef = useRef<HTMLCanvasElement>(null);
  const tickRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<PointerState>({ x: 0.5, y: 0.55, inside: false, pointerType: "mouse" });
  const trailRef = useRef<{ x: number; y: number }[]>([]);
  const motionRef = useRef(0);
  const lastXRef = useRef(0.5);
  const unlockedRef = useRef(false);
  const mutedRef = useRef(false);
  const soundingRef = useRef(false);
  const noteRef = useRef("—");
  const detailRef = useRef("");
  const detailAtRef = useRef(0);
  const colorsRef = useRef<FieldColors | null>(null);
  const activePointerRef = useRef<number | null>(null);

  const [wave, setWave] = useState<Waveform>("sine");
  const [reverb, setReverb] = useState(DEFAULT_REVERB);
  const [muted, setMuted] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [inside, setInside] = useState(false);
  const [note, setNote] = useState("—");
  const [detail, setDetail] = useState("Move in the field");
  const [activeMidi, setActiveMidi] = useState<number | null>(null);

  useEffect(() => {
    const engine = new ThereminEngine();
    engineRef.current = engine;
    let frame = 0;

    const loop = (time: number) => {
      frame = requestAnimationFrame(loop);
      const canvas = canvasRef.current;
      const field = fieldRef.current;
      if (!canvas || !field) return;
      if (!colorsRef.current) colorsRef.current = readFieldColors();
      const colors = colorsRef.current;
      const pointer = pointerRef.current;
      motionRef.current *= 0.9;

      if (pointer.inside && unlockedRef.current) {
        engine.play(freqFromT(pointer.x), 1 - pointer.y, motionRef.current);
        soundingRef.current = true;
      } else if (soundingRef.current) {
        engine.silence();
        soundingRef.current = false;
      }

      const sized = resizeCanvas(canvas);
      if (sized && colors) {
        const trail = trailRef.current;
        if (pointer.inside) {
          const last = trail[trail.length - 1];
          if (!last || Math.hypot(last.x - pointer.x, last.y - pointer.y) > 0.006) {
            trail.push({ x: pointer.x, y: pointer.y });
            if (trail.length > 18) trail.shift();
          }
        } else if (trail.length) {
          trail.shift();
        }
        drawField(sized.ctx, sized.width, sized.height, colors, {
          x: pointer.x,
          y: pointer.y,
          inside: pointer.inside,
          muted: mutedRef.current,
          activeMidi: pointer.inside ? activeMidiFrom(pointer.x) : null,
          trail,
        });
      }

      if (tickRef.current) {
        tickRef.current.style.top = `${pointer.y * 100}%`;
        tickRef.current.style.opacity = pointer.inside ? "1" : "0";
      }

      const waveCanvas = waveCanvasRef.current;
      if (waveCanvas && colors) {
        const waveSize = resizeCanvas(waveCanvas);
        if (waveSize) {
          engine.drawWave(
            waveSize.ctx,
            waveSize.width,
            waveSize.height,
            pointer.inside && !mutedRef.current ? "rgb(227, 155, 62)" : "rgb(156, 144, 128)",
          );
        }
      }

      if (!pointer.inside) {
        if (noteRef.current !== "—") {
          noteRef.current = "—";
          detailRef.current = "";
          setNote("—");
          setDetail(unlockedRef.current ? "Outside the field" : "Move in the field");
          setActiveMidi(null);
        }
        return;
      }

      const pitch = describePitch(freqFromT(pointer.x));
      if (pitch.name !== noteRef.current) {
        noteRef.current = pitch.name;
        setNote(pitch.name);
        setActiveMidi(pitch.midi);
      }
      const nextDetail = `${pitch.centsLabel} · ${pitch.hzLabel}`;
      if (nextDetail !== detailRef.current && time - detailAtRef.current > 40) {
        detailRef.current = nextDetail;
        detailAtRef.current = time;
        setDetail(nextDetail);
      }
    };

    frame = requestAnimationFrame(loop);

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "m" && event.key !== "M") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      event.preventDefault();
      setMuted((current) => !current);
    };
    window.addEventListener("keydown", onKey);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKey);
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setWaveform(wave);
  }, [wave]);

  useEffect(() => {
    engineRef.current?.setReverb(reverb);
  }, [reverb]);

  useEffect(() => {
    mutedRef.current = muted;
    engineRef.current?.setMuted(muted);
  }, [muted]);

  function unlock() {
    engineRef.current?.start();
    if (!unlockedRef.current) {
      unlockedRef.current = true;
      setUnlocked(true);
    }
  }

  function updatePointer(event: ReactPointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    const inside = x >= 0 && x <= 1 && y >= 0 && y <= 1;
    const nextX = Math.min(1, Math.max(0, x));
    const nextY = Math.min(1, Math.max(0, y));
    if (inside) {
      motionRef.current = Math.min(1, motionRef.current * 0.45 + Math.abs(nextX - lastXRef.current) * 28);
      lastXRef.current = nextX;
    }
    pointerRef.current = {
      x: nextX,
      y: nextY,
      inside,
      pointerType: event.pointerType,
    };
    setInside((current) => (current === inside ? current : inside));
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* synthetic or already-released pointers */
    }
    activePointerRef.current = event.pointerId;
    unlock();
    updatePointer(event);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (activePointerRef.current !== null && event.pointerId !== activePointerRef.current) return;
    updatePointer(event);
  }

  function endPointer(event: ReactPointerEvent<HTMLDivElement>) {
    const hover = event.pointerType === "mouse" && isInside(event);
    if (hover) updatePointer(event);
    pointerRef.current.inside = hover;
    setInside(hover);
    if (activePointerRef.current === event.pointerId) activePointerRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function onPointerLeave(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && activePointerRef.current === null) {
      pointerRef.current.inside = false;
      setInside(false);
    }
  }

  const status = muted ? "Muted" : !unlocked ? "Sound starts on touch" : inside ? "Playing" : "Silent";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-4 px-4 py-4 text-fg sm:gap-5 sm:px-6 sm:py-6">
      <header className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_18rem] sm:items-end">
        <div className="max-w-md">
          <h1 className="font-display text-4xl italic leading-none text-balance text-fg sm:text-5xl">Aether</h1>
          <p className="mt-2 text-sm text-pretty text-muted sm:text-base">
            Move across for pitch. Up is louder, down is quieter.
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted">{status}</p>
          <p className="font-display text-5xl italic leading-none text-fg tabular-nums sm:text-6xl" aria-live="polite">
            {note}
          </p>
          <p className="mt-1 h-5 text-sm text-muted tabular-nums">{detail}</p>
          <div className="mt-2 h-8 overflow-hidden rounded-lg border border-border bg-field">
            <canvas ref={waveCanvasRef} className="h-full w-full" aria-hidden="true" />
          </div>
        </div>
      </header>

      <section className="flex min-h-0 flex-1 gap-3">
        <div className="flex w-11 shrink-0 flex-col">
          <span className="sr-only">Volume. Top is loud, bottom is quiet.</span>
          <div aria-hidden="true" className="flex min-h-0 flex-1 flex-col items-center">
            <span className="text-xs text-primary">Loud</span>
            <div className="relative my-2 w-px flex-1 bg-border">
              <div
                ref={tickRef}
                className="absolute left-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary opacity-0"
              />
            </div>
            <span className="text-xs text-muted">Quiet</span>
          </div>
          <div className="mt-2 h-5 shrink-0" aria-hidden="true" />
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div
            ref={fieldRef}
            className={
              "relative min-h-60 flex-1 cursor-crosshair touch-none overflow-hidden rounded-2xl border bg-field select-none " +
              (inside && !muted ? "border-primary" : "border-border")
            }
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endPointer}
            onPointerCancel={endPointer}
            onPointerLeave={onPointerLeave}
            onContextMenu={(event) => event.preventDefault()}
          >
            <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
            {!unlocked && (
              <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-3">
                <p className="hint-pulse rounded-full border border-border bg-bg/85 px-3 py-1.5 text-sm text-fg">
                  Touch or click to hear it
                </p>
              </div>
            )}
          </div>
          <div className="relative mt-2 h-5" aria-hidden="true">
            {NATURALS.map((guide) => {
              const edge = guide.t === 0 ? "start" : guide.t === 1 ? "end" : undefined;
              const hot = activeMidi === guide.midi;
              const visible = guide.anchor ? "" : "hidden md:block ";
              const tone = hot || guide.name === "A4" ? "text-primary" : guide.anchor ? "text-fg" : "text-faint";
              return (
                <span
                  key={guide.midi}
                  data-edge={edge}
                  className={`pitch-label absolute top-0 text-xs tabular-nums ${visible}${tone}`}
                  style={{ ["--t" as string]: String(guide.t) }}
                >
                  {guide.label}
                </span>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid gap-4 border-t border-border pt-4 md:grid-cols-[minmax(0,1.4fr)_minmax(12rem,0.8fr)_auto] md:items-center">
        <div
          role="radiogroup"
          aria-label="Waveform"
          className="grid grid-cols-4 gap-1 rounded-xl border border-border bg-surface p-1"
          onKeyDown={(event) => {
            const ids = WAVEFORMS.map((item) => item.id);
            const index = ids.indexOf(wave);
            let next: Waveform | null = null;
            if (event.key === "ArrowRight" || event.key === "ArrowDown") {
              next = ids[(index + 1) % ids.length];
            } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
              next = ids[(index - 1 + ids.length) % ids.length];
            }
            if (!next) return;
            event.preventDefault();
            setWave(next);
            event.currentTarget.querySelector<HTMLButtonElement>(`[data-wave="${next}"]`)?.focus();
          }}
        >
          {WAVEFORMS.map((item) => {
            const selected = wave === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={`${item.label === "Saw" ? "Sawtooth" : item.label} wave`}
                data-wave={item.id}
                tabIndex={selected ? 0 : -1}
                onClick={() => {
                  unlock();
                  setWave(item.id);
                }}
                className={
                  "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-xs transition-colors duration-150 " +
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary " +
                  (selected ? "bg-primary text-bg" : "text-muted hover:text-fg")
                }
              >
                <WaveIcon type={item.id} />
                {item.label}
              </button>
            );
          })}
        </div>

        <label className="flex min-w-0 flex-col gap-1">
          <span className="flex items-baseline justify-between text-xs text-muted">
            <span>Reverb</span>
            <span className="text-fg tabular-nums">{reverbName(reverb)}</span>
          </span>
          <input
            className="reverb-slider"
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(reverb * 100)}
            aria-valuetext={reverbName(reverb)}
            onChange={(event) => {
              unlock();
              setReverb(Number(event.target.value) / 100);
            }}
          />
        </label>

        <button
          type="button"
          aria-pressed={muted}
          onClick={() => {
            unlock();
            setMuted((current) => !current);
          }}
          className={
            "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm " +
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary " +
            (muted
              ? "border-primary bg-primary text-bg"
              : "border-border bg-surface text-fg hover:border-primary")
          }
        >
          {muted ? <VolumeX className="size-4" aria-hidden="true" /> : <Volume2 className="size-4" aria-hidden="true" />}
          {muted ? "Unmute" : "Mute"}
          <span className="hidden text-xs opacity-70 sm:inline">M</span>
        </button>
      </section>
    </main>
  );
}

function activeMidiFrom(t: number) {
  return describePitch(freqFromT(t)).midi;
}

function isInside(event: ReactPointerEvent<HTMLDivElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width;
  const y = (event.clientY - rect.top) / rect.height;
  return x >= 0 && x <= 1 && y >= 0 && y <= 1;
}
