import { i as __toESM } from "../_runtime.mjs";
import { K as require_react, b as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as Volume2, t as VolumeX } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-BPcyWVx7.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var NOTE_NAMES = [
	"C",
	"C#",
	"D",
	"D#",
	"E",
	"F",
	"F#",
	"G",
	"G#",
	"A",
	"A#",
	"B"
];
function midiToFreq(midi) {
	return 440 * 2 ** ((midi - 69) / 12);
}
function freqToMidi(freq) {
	return 69 + 12 * Math.log2(freq / 440);
}
var MIN_FREQ = midiToFreq(48);
var MAX_FREQ = midiToFreq(84);
function freqFromT(t) {
	const clamped = Math.min(1, Math.max(0, t));
	return MIN_FREQ * (MAX_FREQ / MIN_FREQ) ** clamped;
}
var SHARPS = /* @__PURE__ */ new Set([
	1,
	3,
	6,
	8,
	10
]);
function guideLabel(letter, octave) {
	if (letter === "C") return `C${octave}`;
	if (letter === "A" && octave === 4) return "A4";
	return letter;
}
var GUIDES = Array.from({ length: 37 }, (_, index) => {
	const midi = 48 + index;
	const pc = midi % 12;
	const octave = Math.floor(midi / 12) - 1;
	const letter = NOTE_NAMES[pc];
	const natural = !SHARPS.has(pc);
	return {
		midi,
		name: `${letter}${octave}`,
		label: guideLabel(letter, octave),
		t: index / 36,
		natural,
		anchor: letter === "C" || letter === "A" && octave === 4
	};
});
function describePitch(freq) {
	const exact = freqToMidi(freq);
	const midi = Math.round(exact);
	const cents = Math.max(-50, Math.min(50, Math.round((exact - midi) * 100)));
	const pc = (midi % 12 + 12) % 12;
	const octave = Math.floor(midi / 12) - 1;
	const letter = NOTE_NAMES[pc].replace("#", "♯");
	const sign = cents > 0 ? "+" : cents < 0 ? "−" : "";
	return {
		midi,
		name: `${letter}${octave}`,
		centsLabel: `${sign}${Math.abs(cents)}¢`,
		hzLabel: `${Math.round(freq)} Hz`
	};
}
function reverbName(amount) {
	if (amount < .08) return "Dry";
	if (amount < .34) return "Room";
	if (amount < .62) return "Hall";
	return "Vast";
}
var WAVEFORMS = [
	{
		id: "sine",
		label: "Sine"
	},
	{
		id: "triangle",
		label: "Triangle"
	},
	{
		id: "square",
		label: "Square"
	},
	{
		id: "sawtooth",
		label: "Saw"
	}
];
var DEFAULT_REVERB = .42;
var WAVE_GAIN = {
	sine: 1,
	triangle: .86,
	square: .62,
	sawtooth: .56
};
function makeImpulse(ctx) {
	const seconds = 2.15;
	const rate = ctx.sampleRate;
	const length = Math.floor(rate * seconds);
	const impulse = ctx.createBuffer(2, length, rate);
	const taps = [
		.011,
		.019,
		.031,
		.047,
		.067,
		.091
	];
	for (let channel = 0; channel < 2; channel++) {
		const data = impulse.getChannelData(channel);
		for (let i = 0; i < length; i++) {
			const n = i / length;
			data[i] = (Math.random() * 2 - 1) * (1 - n) ** 3.1;
		}
		for (let tap = 0; tap < taps.length; tap++) {
			const idx = Math.floor(taps[tap] * rate);
			if (idx < length) {
				const sign = channel === 0 === (tap % 2 === 0) ? 1 : -1;
				data[idx] += sign * (.65 - tap * .07);
			}
		}
		let peak = 0;
		for (let i = 0; i < length; i++) peak = Math.max(peak, Math.abs(data[i]));
		const scale = peak > 0 ? .85 / peak : 1;
		for (let i = 0; i < length; i++) data[i] *= scale;
	}
	return impulse;
}
function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));
}
/**
* Continuous theremin voice.
* Pitch glides, a still hand blooms into vibrato, and louder notes open the filter.
*/
var ThereminEngine = class {
	ctx = null;
	osc = null;
	osc2 = null;
	voice = null;
	filter = null;
	lfoGain = null;
	dry = null;
	wet = null;
	preDelay = null;
	mute = null;
	analyser = null;
	wave = new Uint8Array(/* @__PURE__ */ new ArrayBuffer(1024));
	waveform = "sine";
	reverb = DEFAULT_REVERB;
	muted = false;
	disposed = false;
	sounding = false;
	start() {
		if (this.disposed) return;
		if (!this.ctx) this.build();
		if (this.ctx && this.ctx.state !== "running") this.ctx.resume();
	}
	build() {
		const Ctx = window.AudioContext || window.webkitAudioContext;
		if (!Ctx) return;
		const ctx = new Ctx({ latencyHint: "interactive" });
		this.ctx = ctx;
		const osc = ctx.createOscillator();
		const osc2 = ctx.createOscillator();
		osc.type = this.waveform;
		osc2.type = this.waveform;
		osc.frequency.value = 440;
		osc2.frequency.value = 440;
		osc2.detune.value = 7;
		const lfo = ctx.createOscillator();
		lfo.type = "sine";
		lfo.frequency.value = 5.15;
		const lfoGain = ctx.createGain();
		lfoGain.gain.value = 0;
		lfo.connect(lfoGain);
		lfoGain.connect(osc.detune);
		lfoGain.connect(osc2.detune);
		const body = ctx.createGain();
		body.gain.value = .24;
		const mix = ctx.createGain();
		osc.connect(mix);
		osc2.connect(body);
		body.connect(mix);
		const voice = ctx.createGain();
		voice.gain.value = 0;
		const filter = ctx.createBiquadFilter();
		filter.type = "lowpass";
		filter.frequency.value = 1800;
		filter.Q.value = .55;
		const hip = ctx.createBiquadFilter();
		hip.type = "highpass";
		hip.frequency.value = 70;
		hip.Q.value = .7;
		const dry = ctx.createGain();
		const wet = ctx.createGain();
		const preDelay = ctx.createDelay(.08);
		preDelay.delayTime.value = .02;
		const convolver = ctx.createConvolver();
		convolver.buffer = makeImpulse(ctx);
		const wetFilter = ctx.createBiquadFilter();
		wetFilter.type = "lowpass";
		wetFilter.frequency.value = 4800;
		const sum = ctx.createGain();
		const comp = ctx.createDynamicsCompressor();
		comp.threshold.value = -18;
		comp.knee.value = 16;
		comp.ratio.value = 3;
		comp.attack.value = .006;
		comp.release.value = .16;
		const tap = ctx.createGain();
		const mute = ctx.createGain();
		mute.gain.value = this.muted ? 0 : 1;
		const analyser = ctx.createAnalyser();
		analyser.fftSize = 1024;
		analyser.smoothingTimeConstant = .72;
		mix.connect(voice);
		voice.connect(filter);
		filter.connect(hip);
		hip.connect(dry);
		hip.connect(preDelay);
		preDelay.connect(convolver);
		convolver.connect(wetFilter);
		wetFilter.connect(wet);
		dry.connect(sum);
		wet.connect(sum);
		sum.connect(comp);
		comp.connect(tap);
		tap.connect(mute);
		tap.connect(analyser);
		mute.connect(ctx.destination);
		osc.start();
		osc2.start();
		lfo.start();
		this.osc = osc;
		this.osc2 = osc2;
		this.voice = voice;
		this.filter = filter;
		this.lfoGain = lfoGain;
		this.dry = dry;
		this.wet = wet;
		this.preDelay = preDelay;
		this.mute = mute;
		this.analyser = analyser;
		this.applyReverb(this.reverb);
	}
	setWaveform(type) {
		this.waveform = type;
		if (this.osc) this.osc.type = type;
		if (this.osc2) this.osc2.type = type;
	}
	setReverb(amount) {
		this.reverb = clamp(amount, 0, 1);
		this.applyReverb(this.reverb);
	}
	applyReverb(amount) {
		if (!this.ctx || !this.dry || !this.wet || !this.preDelay) return;
		const now = this.ctx.currentTime;
		this.dry.gain.setTargetAtTime(1 - amount * .38, now, .04);
		this.wet.gain.setTargetAtTime(amount * .82, now, .04);
		this.preDelay.delayTime.setTargetAtTime(.01 + amount * .028, now, .05);
	}
	setMuted(muted) {
		this.muted = muted;
		if (!this.ctx || !this.mute) return;
		const now = this.ctx.currentTime;
		this.mute.gain.cancelScheduledValues(now);
		this.mute.gain.setTargetAtTime(muted ? 0 : 1, now, .012);
	}
	play(freq, level, motion) {
		if (!this.ctx || !this.voice || !this.osc || !this.osc2 || !this.filter || !this.lfoGain) return;
		if (!Number.isFinite(freq)) return;
		const now = this.ctx.currentTime;
		const safe = clamp(freq, MIN_FREQ, MAX_FREQ);
		const amp = clamp(level, 0, 1) ** 1.75 * .34 * WAVE_GAIN[this.waveform];
		this.voice.gain.cancelScheduledValues(now);
		this.voice.gain.setTargetAtTime(amp, now, .028);
		this.osc.frequency.cancelScheduledValues(now);
		this.osc.frequency.setTargetAtTime(safe, now, .04);
		this.osc2.frequency.cancelScheduledValues(now);
		this.osc2.frequency.setTargetAtTime(safe, now, .055);
		const cutoff = clamp(safe * (2.3 + clamp(level, 0, 1) * 6.2), 420, 9200);
		this.filter.frequency.cancelScheduledValues(now);
		this.filter.frequency.setTargetAtTime(cutoff, now, .07);
		const vibrato = 8.5 * (1 - clamp(motion, 0, 1));
		this.lfoGain.gain.cancelScheduledValues(now);
		this.lfoGain.gain.setTargetAtTime(vibrato, now, .12);
		this.sounding = amp > .001;
	}
	silence() {
		if (!this.ctx || !this.voice || !this.lfoGain) return;
		const now = this.ctx.currentTime;
		this.voice.gain.cancelScheduledValues(now);
		this.voice.gain.setTargetAtTime(0, now, .045);
		this.lfoGain.gain.setTargetAtTime(0, now, .08);
		this.sounding = false;
	}
	drawWave(ctx, width, height, color) {
		ctx.clearRect(0, 0, width, height);
		ctx.beginPath();
		ctx.lineWidth = 1.5;
		ctx.strokeStyle = color;
		ctx.lineJoin = "round";
		ctx.lineCap = "round";
		if (!this.analyser || !this.sounding) {
			ctx.moveTo(0, height / 2);
			ctx.lineTo(width, height / 2);
			ctx.stroke();
			return;
		}
		this.analyser.getByteTimeDomainData(this.wave);
		const step = Math.max(1, Math.floor(this.wave.length / Math.max(1, width)));
		for (let x = 0; x < width; x++) {
			const index = Math.min(this.wave.length - 1, x * step);
			const sample = this.wave[index] / 128 - 1;
			const y = height / 2 + sample * height * .4;
			if (x === 0) ctx.moveTo(x, y);
			else ctx.lineTo(x, y);
		}
		ctx.stroke();
	}
	dispose() {
		this.disposed = true;
		try {
			this.osc?.stop();
		} catch {}
		try {
			this.osc2?.stop();
		} catch {}
		this.ctx?.close();
		this.ctx = null;
	}
};
function cssRgb(color) {
	const probe = document.createElement("span");
	probe.style.color = color;
	document.body.appendChild(probe);
	const computed = getComputedStyle(probe).color;
	probe.remove();
	const parts = computed.match(/[\d.]+/g);
	if (!parts || parts.length < 3) return [
		243,
		234,
		220
	];
	return [
		Number(parts[0]),
		Number(parts[1]),
		Number(parts[2])
	];
}
function readFieldColors() {
	const style = getComputedStyle(document.documentElement);
	const pick = (name) => style.getPropertyValue(name).trim();
	const loud = pick("--color-field-loud");
	const amber = pick("--color-primary");
	if (!loud || !amber) return null;
	return {
		loud: cssRgb(loud),
		field: cssRgb(pick("--color-field") || loud),
		quiet: cssRgb(pick("--color-field-quiet") || loud),
		cream: cssRgb(pick("--color-fg") || amber),
		amber: cssRgb(amber)
	};
}
function rgba(rgb, alpha) {
	return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}
function mix(a, b, t) {
	return [
		Math.round(a[0] + (b[0] - a[0]) * t),
		Math.round(a[1] + (b[1] - a[1]) * t),
		Math.round(a[2] + (b[2] - a[2]) * t)
	];
}
function drawField(ctx, width, height, colors, state) {
	ctx.clearRect(0, 0, width, height);
	const background = ctx.createLinearGradient(0, 0, 0, height);
	background.addColorStop(0, rgba(colors.loud, 1));
	background.addColorStop(.42, rgba(colors.field, 1));
	background.addColorStop(1, rgba(colors.quiet, 1));
	ctx.fillStyle = background;
	ctx.fillRect(0, 0, width, height);
	const x0 = 12 / 36 * width;
	const x1 = 24 / 36 * width;
	ctx.fillStyle = rgba(colors.cream, .035);
	ctx.fillRect(x0, 0, x1 - x0, height);
	ctx.lineWidth = 1;
	ctx.strokeStyle = rgba(colors.cream, .08);
	for (const fraction of [1 / 3, 2 / 3]) {
		const y = Math.round(fraction * height) + .5;
		ctx.beginPath();
		ctx.moveTo(0, y);
		ctx.lineTo(width, y);
		ctx.stroke();
	}
	for (const guide of GUIDES) {
		const x = Math.round(guide.t * width) + .5;
		const hot = state.inside && state.activeMidi === guide.midi;
		ctx.strokeStyle = hot ? rgba(colors.amber, .95) : guide.anchor ? rgba(colors.cream, .34) : guide.natural ? rgba(colors.cream, .16) : rgba(colors.cream, .05);
		ctx.lineWidth = hot ? 2 : 1;
		if (hot) {
			ctx.shadowColor = rgba(colors.amber, .8);
			ctx.shadowBlur = 14;
		}
		ctx.beginPath();
		ctx.moveTo(x, 0);
		ctx.lineTo(x, height);
		ctx.stroke();
		ctx.shadowBlur = 0;
	}
	const vignette = ctx.createRadialGradient(width / 2, height * .45, Math.min(width, height) * .2, width / 2, height * .5, Math.max(width, height) * .72);
	vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
	vignette.addColorStop(1, "rgba(0, 0, 0, 0.38)");
	ctx.fillStyle = vignette;
	ctx.fillRect(0, 0, width, height);
	if (!state.inside) return;
	const px = Math.min(1, Math.max(0, state.x)) * width;
	const py = Math.min(1, Math.max(0, state.y)) * height;
	for (let i = 0; i < state.trail.length; i++) {
		const point = state.trail[i];
		const age = (i + 1) / state.trail.length;
		ctx.fillStyle = rgba(colors.amber, age * .18);
		ctx.beginPath();
		ctx.arc(point.x * width, point.y * height, 3 + age * 8, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.strokeStyle = rgba(colors.amber, state.muted ? .28 : .4);
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(px, 0);
	ctx.lineTo(px, height);
	ctx.moveTo(0, py);
	ctx.lineTo(width, py);
	ctx.stroke();
	if (state.muted) {
		ctx.strokeStyle = rgba(colors.cream, .9);
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		ctx.arc(px, py, 9, 0, Math.PI * 2);
		ctx.stroke();
		return;
	}
	const glow = ctx.createRadialGradient(px, py, 0, px, py, 42);
	glow.addColorStop(0, rgba(mix(colors.cream, colors.amber, .25), .95));
	glow.addColorStop(.2, rgba(colors.amber, .72));
	glow.addColorStop(1, rgba(colors.amber, 0));
	ctx.fillStyle = glow;
	ctx.beginPath();
	ctx.arc(px, py, 42, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = rgba(colors.cream, 1);
	ctx.beginPath();
	ctx.arc(px, py, 3.2, 0, Math.PI * 2);
	ctx.fill();
}
var NATURALS = GUIDES.filter((guide) => guide.natural);
function resizeCanvas(canvas) {
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
	return {
		ctx,
		width: rect.width,
		height: rect.height
	};
}
function WaveIcon({ type }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
		viewBox: "0 0 32 22",
		className: "h-4 w-7",
		"aria-hidden": "true",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
			d: type === "sine" ? "M2 12 Q 7 2 12 12 T 22 12 T 30 12" : type === "triangle" ? "M2 17 L8 5 L16 19 L24 7 L30 17" : type === "square" ? "M3 16 H9 V6 H16 V18 H23 V6 H29" : "M3 17 L11 5 V17 L19 5 V17 L27 5 V17",
			fill: "none",
			stroke: "currentColor",
			strokeWidth: "1.6",
			strokeLinejoin: "round",
			strokeLinecap: "round"
		})
	});
}
function Theremin() {
	const engineRef = (0, import_react.useRef)(null);
	const fieldRef = (0, import_react.useRef)(null);
	const canvasRef = (0, import_react.useRef)(null);
	const waveCanvasRef = (0, import_react.useRef)(null);
	const tickRef = (0, import_react.useRef)(null);
	const pointerRef = (0, import_react.useRef)({
		x: .5,
		y: .55,
		inside: false,
		pointerType: "mouse"
	});
	const trailRef = (0, import_react.useRef)([]);
	const motionRef = (0, import_react.useRef)(0);
	const lastXRef = (0, import_react.useRef)(.5);
	const unlockedRef = (0, import_react.useRef)(false);
	const mutedRef = (0, import_react.useRef)(false);
	const soundingRef = (0, import_react.useRef)(false);
	const noteRef = (0, import_react.useRef)("—");
	const detailRef = (0, import_react.useRef)("");
	const detailAtRef = (0, import_react.useRef)(0);
	const colorsRef = (0, import_react.useRef)(null);
	const activePointerRef = (0, import_react.useRef)(null);
	const [wave, setWave] = (0, import_react.useState)("sine");
	const [reverb, setReverb] = (0, import_react.useState)(DEFAULT_REVERB);
	const [muted, setMuted] = (0, import_react.useState)(false);
	const [unlocked, setUnlocked] = (0, import_react.useState)(false);
	const [inside, setInside] = (0, import_react.useState)(false);
	const [note, setNote] = (0, import_react.useState)("—");
	const [detail, setDetail] = (0, import_react.useState)("Move in the field");
	const [activeMidi, setActiveMidi] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		const engine = new ThereminEngine();
		engineRef.current = engine;
		let frame = 0;
		const loop = (time) => {
			frame = requestAnimationFrame(loop);
			const canvas = canvasRef.current;
			const field = fieldRef.current;
			if (!canvas || !field) return;
			if (!colorsRef.current) colorsRef.current = readFieldColors();
			const colors = colorsRef.current;
			const pointer = pointerRef.current;
			motionRef.current *= .9;
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
					if (!last || Math.hypot(last.x - pointer.x, last.y - pointer.y) > .006) {
						trail.push({
							x: pointer.x,
							y: pointer.y
						});
						if (trail.length > 18) trail.shift();
					}
				} else if (trail.length) trail.shift();
				drawField(sized.ctx, sized.width, sized.height, colors, {
					x: pointer.x,
					y: pointer.y,
					inside: pointer.inside,
					muted: mutedRef.current,
					activeMidi: pointer.inside ? activeMidiFrom(pointer.x) : null,
					trail
				});
			}
			if (tickRef.current) {
				tickRef.current.style.top = `${pointer.y * 100}%`;
				tickRef.current.style.opacity = pointer.inside ? "1" : "0";
			}
			const waveCanvas = waveCanvasRef.current;
			if (waveCanvas && colors) {
				const waveSize = resizeCanvas(waveCanvas);
				if (waveSize) engine.drawWave(waveSize.ctx, waveSize.width, waveSize.height, pointer.inside && !mutedRef.current ? "rgb(227, 155, 62)" : "rgb(156, 144, 128)");
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
		const onKey = (event) => {
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
	(0, import_react.useEffect)(() => {
		engineRef.current?.setWaveform(wave);
	}, [wave]);
	(0, import_react.useEffect)(() => {
		engineRef.current?.setReverb(reverb);
	}, [reverb]);
	(0, import_react.useEffect)(() => {
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
	function updatePointer(event) {
		const rect = event.currentTarget.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) return;
		const x = (event.clientX - rect.left) / rect.width;
		const y = (event.clientY - rect.top) / rect.height;
		const inside = x >= 0 && x <= 1 && y >= 0 && y <= 1;
		const nextX = Math.min(1, Math.max(0, x));
		const nextY = Math.min(1, Math.max(0, y));
		if (inside) {
			motionRef.current = Math.min(1, motionRef.current * .45 + Math.abs(nextX - lastXRef.current) * 28);
			lastXRef.current = nextX;
		}
		pointerRef.current = {
			x: nextX,
			y: nextY,
			inside,
			pointerType: event.pointerType
		};
		setInside((current) => current === inside ? current : inside);
	}
	function onPointerDown(event) {
		event.currentTarget.setPointerCapture(event.pointerId);
		activePointerRef.current = event.pointerId;
		unlock();
		updatePointer(event);
	}
	function onPointerMove(event) {
		if (activePointerRef.current !== null && event.pointerId !== activePointerRef.current) return;
		updatePointer(event);
	}
	function endPointer(event) {
		const hover = event.pointerType === "mouse" && isInside(event);
		if (hover) updatePointer(event);
		pointerRef.current.inside = hover;
		setInside(hover);
		if (activePointerRef.current === event.pointerId) activePointerRef.current = null;
		if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
	}
	function onPointerLeave(event) {
		if (event.pointerType === "mouse" && activePointerRef.current === null) {
			pointerRef.current.inside = false;
			setInside(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-4 px-4 py-4 text-fg sm:gap-5 sm:px-6 sm:py-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "grid gap-4 sm:grid-cols-[minmax(0,1fr)_18rem] sm:items-end",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "max-w-md",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "font-display text-4xl italic leading-none text-balance text-fg sm:text-5xl",
						children: "Aether"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-sm text-pretty text-muted sm:text-base",
						children: "Move across for pitch. Up is louder, down is quieter."
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-w-0",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-muted",
							children: muted ? "Muted" : !unlocked ? "Sound starts on touch" : inside ? "Playing" : "Silent"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-display text-5xl italic leading-none text-fg tabular-nums sm:text-6xl",
							"aria-live": "polite",
							children: note
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 h-5 text-sm text-muted tabular-nums",
							children: detail
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-2 h-8 overflow-hidden rounded-lg border border-border bg-field",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
								ref: waveCanvasRef,
								className: "h-full w-full",
								"aria-hidden": "true"
							})
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "flex min-h-0 flex-1 gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex w-11 shrink-0 flex-col",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "sr-only",
							children: "Volume. Top is loud, bottom is quiet."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							"aria-hidden": "true",
							className: "flex min-h-0 flex-1 flex-col items-center",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-xs text-primary",
									children: "Loud"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "relative my-2 w-px flex-1 bg-border",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										ref: tickRef,
										className: "absolute left-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary opacity-0"
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-xs text-muted",
									children: "Quiet"
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-2 h-5 shrink-0",
							"aria-hidden": "true"
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex min-h-0 min-w-0 flex-1 flex-col",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						ref: fieldRef,
						className: "relative min-h-60 flex-1 cursor-crosshair touch-none overflow-hidden rounded-2xl border bg-field select-none " + (inside && !muted ? "border-primary" : "border-border"),
						onPointerDown,
						onPointerMove,
						onPointerUp: endPointer,
						onPointerCancel: endPointer,
						onPointerLeave,
						onContextMenu: (event) => event.preventDefault(),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
							ref: canvasRef,
							className: "absolute inset-0 h-full w-full",
							"aria-hidden": "true"
						}), !unlocked && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "pointer-events-none absolute inset-x-0 top-3 flex justify-center px-3",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "hint-pulse rounded-full border border-border bg-bg/85 px-3 py-1.5 text-sm text-fg",
								children: "Touch or click to hear it"
							})
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "relative mt-2 h-5",
						"aria-hidden": "true",
						children: NATURALS.map((guide) => {
							const edge = guide.t === 0 ? "start" : guide.t === 1 ? "end" : void 0;
							const hot = activeMidi === guide.midi;
							const visible = guide.anchor ? "" : "hidden md:block ";
							const tone = hot || guide.name === "A4" ? "text-primary" : guide.anchor ? "text-fg" : "text-faint";
							return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								"data-edge": edge,
								className: `pitch-label absolute top-0 text-xs tabular-nums ${visible}${tone}`,
								style: { ["--t"]: String(guide.t) },
								children: guide.label
							}, guide.midi);
						})
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "grid gap-4 border-t border-border pt-4 md:grid-cols-[minmax(0,1.4fr)_minmax(12rem,0.8fr)_auto] md:items-center",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						role: "radiogroup",
						"aria-label": "Waveform",
						className: "grid grid-cols-4 gap-1 rounded-xl border border-border bg-surface p-1",
						onKeyDown: (event) => {
							const ids = WAVEFORMS.map((item) => item.id);
							const index = ids.indexOf(wave);
							let next = null;
							if (event.key === "ArrowRight" || event.key === "ArrowDown") next = ids[(index + 1) % ids.length];
							else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = ids[(index - 1 + ids.length) % ids.length];
							if (!next) return;
							event.preventDefault();
							setWave(next);
							event.currentTarget.querySelector(`[data-wave="${next}"]`)?.focus();
						},
						children: WAVEFORMS.map((item) => {
							const selected = wave === item.id;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								role: "radio",
								"aria-checked": selected,
								"aria-label": `${item.label === "Saw" ? "Sawtooth" : item.label} wave`,
								"data-wave": item.id,
								tabIndex: selected ? 0 : -1,
								onClick: () => {
									unlock();
									setWave(item.id);
								},
								className: "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-xs transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary " + (selected ? "bg-primary text-bg" : "text-muted hover:text-fg"),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(WaveIcon, { type: item.id }), item.label]
							}, item.id);
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "flex min-w-0 flex-col gap-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "flex items-baseline justify-between text-xs text-muted",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Reverb" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-fg tabular-nums",
								children: reverbName(reverb)
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							className: "reverb-slider",
							type: "range",
							min: 0,
							max: 100,
							step: 1,
							value: Math.round(reverb * 100),
							"aria-valuetext": reverbName(reverb),
							onChange: (event) => {
								unlock();
								setReverb(Number(event.target.value) / 100);
							}
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						"aria-pressed": muted,
						onClick: () => {
							unlock();
							setMuted((current) => !current);
						},
						className: "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary " + (muted ? "border-primary bg-primary text-bg" : "border-border bg-surface text-fg hover:border-primary"),
						children: [
							muted ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(VolumeX, {
								className: "size-4",
								"aria-hidden": "true"
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Volume2, {
								className: "size-4",
								"aria-hidden": "true"
							}),
							muted ? "Unmute" : "Mute",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "hidden text-xs opacity-70 sm:inline",
								children: "M"
							})
						]
					})
				]
			})
		]
	});
}
function activeMidiFrom(t) {
	return describePitch(freqFromT(t)).midi;
}
function isInside(event) {
	const rect = event.currentTarget.getBoundingClientRect();
	const x = (event.clientX - rect.left) / rect.width;
	const y = (event.clientY - rect.top) / rect.height;
	return x >= 0 && x <= 1 && y >= 0 && y <= 1;
}
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Theremin, {});
}
//#endregion
export { Home as component };
