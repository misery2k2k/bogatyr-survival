// Генератор «мягких» звуков: raw-assets/sfx-src/*.ogg → raw-assets/sfx-soft/*.wav
// Сэмплы чистим фильтром НЧ (убираем резкий верх), нормализуем и плавно гасим хвост,
// взмахи/свист/огонь/колокольчики синтезируем. Нужен браузер (OfflineAudioContext):
//   npm i --no-save puppeteer-core && node tools/make-soft-sfx.mjs
// Путь к Edge/Chrome можно задать переменной BROWSER.
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const root = path.resolve(import.meta.dirname, '..');
const SRC = path.join(root, 'raw-assets', 'sfx-src');
const OUT = path.join(root, 'raw-assets', 'sfx-soft');
const BROWSER = process.env.BROWSER ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

/**
 * Рецепты. mix — слои сэмплов: [файл, громкость, скорость]. lp — срез фильтра НЧ, dur — максимум длины,
 * peak — итоговый пик. synth — имя синтезатора из браузерной части.
 */
const RECIPES = {
  hit1: { mix: [['qubodupPunch01.ogg', 1, 1.05]], lp: 6000, dur: 0.26, peak: 0.6 },
  hit2: { mix: [['qubodupPunch04.ogg', 1, 1.1]], lp: 6000, dur: 0.26, peak: 0.6 },
  hit3: { mix: [['qubodupPunch05.ogg', 1, 1]], lp: 6000, dur: 0.26, peak: 0.6 },
  hit4: { mix: [['bfh1_wood_hit_03.ogg', 1, 0.95]], lp: 6000, dur: 0.2, peak: 0.55 },
  crit: { mix: [['qubodupPunch03.ogg', 1, 1], ['qubodupPunch01.ogg', 0.7, 0.9]], lp: 5000, dur: 0.42, peak: 0.85 },
  hurt: { mix: [['qubodupImpactMeat02.ogg', 1, 0.85], ['qubodupPunch02.ogg', 0.6, 1]], lp: 3500, dur: 0.32, peak: 0.6 },
  block: { mix: [['bfh1_wood_hit_01.ogg', 1, 1], ['bfh1_metal_hit_05.ogg', 0.3, 1]], lp: 3000, dur: 0.25, peak: 0.6 },
  levelup: { mix: [['jingles_SAX02.ogg', 1, 1]], lp: 6000, dur: 2.5, peak: 0.7 },
  death: { mix: [['jingles_SAX07.ogg', 1, 1]], lp: 6000, dur: 2.5, peak: 0.7 },
  pie: { mix: [['jingles_SAX08.ogg', 1, 1]], lp: 6000, dur: 1.5, peak: 0.6 },
  roar: { mix: [['qubodupPunch03.ogg', 1, 0.6], ['qubodupPunch02.ogg', 0.8, 0.5]], lp: 900, dur: 0.9, peak: 0.9 },
  swing: { synth: 'whoosh', args: { f0: 450, f1: 1500, f2: 650, len: 0.24 }, lp: 3000, peak: 0.5 },
  spear: { synth: 'whoosh', args: { f0: 800, f1: 2000, f2: 1100, len: 0.17 }, lp: 3400, peak: 0.45 },
  flail: { synth: 'whoosh', args: { f0: 260, f1: 900, f2: 380, len: 0.42 }, lp: 2200, peak: 0.55 },
  helix: { synth: 'whoosh2', args: { f0: 400, f1: 1400, f2: 600, len: 0.2 }, lp: 2800, peak: 0.55 },
  whistle: { synth: 'whistle', args: {}, lp: 4500, peak: 0.4 },
  fire: { synth: 'fire', args: { len: 0.45 }, lp: 1400, peak: 0.55 },
  // колокольчики душ — пентатоника, по нарастающей серии убийств
  ...Object.fromEntries(
    [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51].map((f, i) => [`soul${i}`, { synth: 'bell', args: { f }, lp: 6000, peak: 0.35 }]),
  ),
};

fs.mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: BROWSER, headless: true });
const page = await browser.newPage();
await page.setContent('<html></html>');
const sources = {};
for (const r of Object.values(RECIPES)) for (const [f] of r.mix ?? []) sources[f] ??= fs.readFileSync(path.join(SRC, f)).toString('base64');

const result = await page.evaluate(async (RECIPES, sources) => {
  const SR = 32000;
  const decoded = {};
  for (const [name, b64] of Object.entries(sources)) {
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    decoded[name] = await new OfflineAudioContext(1, SR, SR).decodeAudioData(bin.buffer);
  }
  const noiseBuf = (ctx, len, brown = false) => {
    const b = ctx.createBuffer(1, Math.ceil(len * ctx.sampleRate), ctx.sampleRate);
    const d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      } else d[i] = w;
    }
    return b;
  };
  const synths = {
    whoosh(ctx, out, { f0, f1, f2, len }, t0 = 0) {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf(ctx, len + 0.05);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 1.4;
      bp.frequency.setValueAtTime(f0, t0);
      bp.frequency.exponentialRampToValueAtTime(f1, t0 + len * 0.45);
      bp.frequency.exponentialRampToValueAtTime(f2, t0 + len);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(1, t0 + len * 0.35);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
      src.connect(bp).connect(g).connect(out);
      src.start(t0);
      return len + 0.02;
    },
    whoosh2(ctx, out, a) {
      synths.whoosh(ctx, out, a, 0);
      return synths.whoosh(ctx, out, { ...a, f0: a.f0 * 1.1, f1: a.f1 * 1.15 }, a.len * 0.85) + a.len * 0.85;
    },
    whistle(ctx, out) {
      // два коротких посвиста с глиссандо и трелью
      for (const [t0, fa, fb] of [[0, 1500, 2300], [0.16, 1700, 2600]]) {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(fa, t0);
        o.frequency.exponentialRampToValueAtTime(fb, t0 + 0.12);
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 28;
        const lg = ctx.createGain();
        lg.gain.value = 70;
        lfo.connect(lg).connect(o.frequency);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.8, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.15);
        o.connect(g).connect(out);
        o.start(t0);
        lfo.start(t0);
        o.stop(t0 + 0.16);
        lfo.stop(t0 + 0.16);
      }
      synths.whoosh(ctx, out, { f0: 700, f1: 1600, f2: 900, len: 0.3 }, 0);
      return 0.34;
    },
    fire(ctx, out, { len }) {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf(ctx, len + 0.05, true);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(400, 0);
      lp.frequency.linearRampToValueAtTime(1100, len * 0.4);
      lp.frequency.linearRampToValueAtTime(500, len);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, 0);
      g.gain.exponentialRampToValueAtTime(1, 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, len);
      src.connect(lp).connect(g).connect(out);
      src.start(0);
      // треск
      const cr = ctx.createBuffer(1, Math.ceil(len * ctx.sampleRate), ctx.sampleRate);
      const d = cr.getChannelData(0);
      for (let k = 0; k < 14; k++) {
        const at = Math.floor(Math.random() * d.length * 0.8);
        for (let i = 0; i < 60; i++) d[at + i] += (Math.random() * 2 - 1) * Math.exp(-i / 12) * 0.5;
      }
      const cs = ctx.createBufferSource();
      cs.buffer = cr;
      cs.connect(out);
      cs.start(0);
      return len;
    },
    bell(ctx, out, { f }) {
      for (const [mul, amp, dec] of [[1, 1, 0.35], [2, 0.28, 0.18], [3, 0.08, 0.1]]) {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = f * mul;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, 0);
        g.gain.exponentialRampToValueAtTime(amp, 0.006);
        g.gain.exponentialRampToValueAtTime(0.0001, dec);
        o.connect(g).connect(out);
        o.start(0);
        o.stop(dec + 0.01);
      }
      return 0.36;
    },
  };

  const wav = (data, sr) => {
    const buf = new ArrayBuffer(44 + data.length * 2);
    const v = new DataView(buf);
    const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    str(0, 'RIFF');
    v.setUint32(4, 36 + data.length * 2, true);
    str(8, 'WAVE');
    str(12, 'fmt ');
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);
    v.setUint16(22, 1, true);
    v.setUint32(24, sr, true);
    v.setUint32(28, sr * 2, true);
    v.setUint16(32, 2, true);
    v.setUint16(34, 16, true);
    str(36, 'data');
    v.setUint32(40, data.length * 2, true);
    for (let i = 0; i < data.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, data[i])) * 32767, true);
    let s = '';
    const u = new Uint8Array(buf);
    for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
    return btoa(s);
  };

  const out = {};
  for (const [name, r] of Object.entries(RECIPES)) {
    const maxLen = r.dur ?? 3;
    const ctx = new OfflineAudioContext(1, Math.ceil(SR * maxLen), SR);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = r.lp;
    lp.Q.value = 0.5;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 45;
    lp.connect(hp).connect(ctx.destination);
    let len = 0;
    if (r.synth) {
      len = synths[r.synth](ctx, lp, r.args);
    } else {
      for (const [f, vol, rate] of r.mix) {
        const s = ctx.createBufferSource();
        s.buffer = decoded[f];
        s.playbackRate.value = rate;
        const g = ctx.createGain();
        g.gain.value = vol;
        s.connect(g).connect(lp);
        s.start(0);
        len = Math.max(len, decoded[f].duration / rate);
      }
    }
    const rendered = await ctx.startRendering();
    let d = rendered.getChannelData(0).slice(0, Math.ceil(SR * Math.min(maxLen, len + 0.02)));
    // обрезаем тишину в конце, гасим хвост, нормализуем пик
    let end = d.length;
    let peak = 0;
    for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
    while (end > 0 && Math.abs(d[end - 1]) < peak * 0.003) end--;
    d = d.slice(0, Math.max(end, 64));
    const fade = Math.min(d.length, Math.round(SR * 0.04));
    for (let i = 0; i < fade; i++) d[d.length - 1 - i] *= i / fade;
    const k = peak > 0 ? r.peak / peak : 1;
    for (let i = 0; i < d.length; i++) d[i] *= k;
    out[name] = { wav: wav(d, SR), dur: d.length / SR };
  }
  return out;
}, RECIPES, sources);

for (const [name, { wav, dur }] of Object.entries(result)) {
  fs.writeFileSync(path.join(OUT, `${name}.wav`), Buffer.from(wav, 'base64'));
  console.log(`${name.padEnd(10)} ${dur.toFixed(2)} s`);
}
await browser.close();
