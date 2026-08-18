/* Generative music engine - runs 100% locally with Web Audio.
   No API key, no internet. Renders offline and exports WAV. */
const Music = (() => {

  const SCALES = {
    pent:   [0, 3, 5, 7, 10],
    major:  [0, 2, 4, 5, 7, 9, 11],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    harm:   [0, 2, 3, 5, 7, 8, 11]
  };
  const CHORDS = {
    m: [0, 3, 7], maj: [0, 4, 7], m7: [0, 3, 7, 10],
    maj7: [0, 4, 7, 11], sus: [0, 5, 7], add9: [0, 4, 7, 14]
  };
  const GENRES = {
    lofi:    { bpm: [74, 88],   scale: 'dorian', wave: 'triangle', bassWave: 'sine',
               prog: [[0, 'm7'], [5, 'maj7'], [-2, 'maj7'], [7, 'm7']],
               kick: [0, 7, 10], snare: [4, 12], hatStep: 2, swing: 0.14,
               leadDensity: 0.42, pad: 'soft', arp: false },
    chip:    { bpm: [132, 152], scale: 'major', wave: 'square', bassWave: 'square',
               prog: [[0, 'maj'], [9, 'm'], [5, 'maj'], [7, 'maj']],
               kick: [0, 4, 8, 12], snare: [4, 12], hatStep: 1, swing: 0,
               leadDensity: 0.8, pad: 'none', arp: true },
    techno:  { bpm: [122, 132], scale: 'pent', wave: 'sawtooth', bassWave: 'sawtooth',
               prog: [[0, 'm'], [0, 'm'], [-4, 'maj'], [-2, 'maj']],
               kick: [0, 4, 8, 12], snare: [4, 12], hatStep: 1, offHat: true, swing: 0,
               leadDensity: 0.3, pad: 'dark', arp: false },
    ambient: { bpm: [56, 66],   scale: 'major', wave: 'sine', bassWave: 'sine',
               prog: [[0, 'maj7'], [7, 'sus'], [5, 'maj7'], [-2, 'add9']],
               kick: [], snare: [], hatStep: 0, swing: 0,
               leadDensity: 0.16, pad: 'wide', arp: false }
  };

  const midiHz = m => 440 * Math.pow(2, (m - 69) / 12);

  async function render({ genre = 'lofi', scaleName = '', tempo = 0, seconds = 30, seed = 7 }, onProgress) {
    const G = GENRES[genre] || GENRES.lofi;
    const R = makeRng(seed);
    const bpm = tempo > 0 ? tempo : Math.round(G.bpm[0] + R() * (G.bpm[1] - G.bpm[0]));
    const scale = SCALES[scaleName] || SCALES[G.scale];
    const key = 45 + Math.floor(R() * 7);              // A2 .. D#3
    const spb = 60 / bpm, step = spb / 4, barLen = 4 * spb;
    const bars = Math.max(4, Math.round(seconds / barLen));
    const dur = bars * barLen + 2;
    const sr = 44100;

    onProgress && onProgress(10, t('m_scheduling'));
    const ctx = new OfflineAudioContext(2, Math.ceil(dur * sr), sr);

    /* master chain */
    const master = ctx.createGain(); master.gain.value = 0.85;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.18;
    master.connect(comp); comp.connect(ctx.destination);

    /* delay send */
    const delay = ctx.createDelay(2); delay.delayTime.value = step * 3;
    const fb = ctx.createGain(); fb.gain.value = 0.32;
    const dLp = ctx.createBiquadFilter(); dLp.type = 'lowpass'; dLp.frequency.value = 2600;
    const dOut = ctx.createGain(); dOut.gain.value = 0.5;
    delay.connect(dLp); dLp.connect(fb); fb.connect(delay); dLp.connect(dOut); dOut.connect(master);
    const send = ctx.createGain(); send.gain.value = 1; send.connect(delay);

    /* shared noise buffer */
    const noiseBuf = ctx.createBuffer(1, sr, sr);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < sr; i++) nd[i] = Math.random() * 2 - 1;

    function noiseSrc(time, len) {
      const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
      s.start(time); s.stop(time + len + 0.05);
      return s;
    }

    function envGain(time, attack, peak, release) {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, time);
      g.gain.linearRampToValueAtTime(peak, time + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, time + attack + release);
      return g;
    }

    function playOsc({ time, len, freq, type, gain = 0.2, attack = 0.01, filterHz = 0, detune = 0, pan = 0, sendAmt = 0 }) {
      const o = ctx.createOscillator();
      o.type = type; o.frequency.value = freq;
      if (detune) o.detune.value = detune;
      const g = envGain(time, attack, gain, len);
      let node = o; o.connect(g); node = g;
      if (filterHz) {
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterHz; f.Q.value = 0.8;
        node.connect(f); node = f;
      }
      const p = ctx.createStereoPanner(); p.pan.value = pan;
      node.connect(p); p.connect(master);
      if (sendAmt > 0) {
        const sg = ctx.createGain(); sg.gain.value = sendAmt;
        node.connect(sg); sg.connect(send);
      }
      o.start(time); o.stop(time + attack + len + 0.1);
    }

    function kick(time) {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(150, time);
      o.frequency.exponentialRampToValueAtTime(44, time + 0.11);
      const g = envGain(time, 0.002, 0.9, 0.32);
      o.connect(g); g.connect(master);
      o.start(time); o.stop(time + 0.5);
    }
    function snare(time) {
      const n = noiseSrc(time, 0.25);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 0.9;
      const g = envGain(time, 0.002, 0.35, 0.2);
      n.connect(bp); bp.connect(g); g.connect(master);
      playOsc({ time, len: 0.09, freq: 190, type: 'triangle', gain: 0.22, attack: 0.001 });
    }
    function hat(time, open) {
      const n = noiseSrc(time, open ? 0.3 : 0.08);
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7800;
      const g = envGain(time, 0.001, 0.11, open ? 0.22 : 0.045);
      n.connect(hp); hp.connect(g); g.connect(master);
    }

    const chordSemis = q => CHORDS[q] || CHORDS.m;

    /* ---------- schedule ---------- */
    let leadDeg = 4 + Math.floor(R() * 3);
    for (let bar = 0; bar < bars; bar++) {
      const barT = bar * barLen;
      const [rootOff, quality] = G.prog[bar % G.prog.length];
      const root = key + rootOff;
      const chord = chordSemis(quality);

      /* pad */
      if (G.pad !== 'none') {
        chord.forEach((iv, ci) => {
          const wide = G.pad === 'wide';
          playOsc({
            time: barT + 0.01, len: barLen * (wide ? 1.15 : 0.95),
            freq: midiHz(root + 12 + iv), type: G.wave === 'square' ? 'triangle' : G.wave,
            gain: G.pad === 'dark' ? 0.045 : 0.06,
            attack: wide ? barLen * 0.4 : 0.06,
            filterHz: G.pad === 'dark' ? 900 : 2200,
            detune: (ci - 1) * 7,
            pan: (ci - 1) * (wide ? 0.5 : 0.25),
            sendAmt: wide ? 0.5 : 0.2
          });
        });
      }

      /* bass */
      const bassSteps = genre === 'techno' ? [2, 6, 10, 14]
                      : genre === 'chip' ? [0, 2, 4, 6, 8, 10, 12, 14]
                      : genre === 'ambient' ? [0]
                      : [0, 7, 10];
      bassSteps.forEach(s => {
        const bt = barT + s * step + (s % 2 === 1 ? G.swing * step : 0);
        playOsc({
          time: bt, len: genre === 'ambient' ? barLen * 0.9 : step * 1.6,
          freq: midiHz(root - 12), type: G.bassWave,
          gain: 0.22, attack: 0.005, filterHz: 700
        });
      });

      /* drums (16 steps per bar) */
      for (let s = 0; s < 16; s++) {
        const st = barT + s * step + (s % 2 === 1 ? G.swing * step : 0);
        if (G.kick.includes(s)) kick(st);
        if (G.snare.includes(s)) snare(st);
        if (G.hatStep && s % G.hatStep === 0) {
          if (genre === 'lofi' && R() < 0.12) continue;   // human gaps
          hat(st, G.offHat ? s % 4 === 2 : false);
        }
      }

      /* arp (chiptune) */
      if (G.arp) {
        for (let s = 0; s < 16; s++) {
          const iv = chord[s % chord.length] + (s % 8 >= 4 ? 12 : 0);
          playOsc({
            time: barT + s * step, len: step * 0.85,
            freq: midiHz(root + 12 + iv), type: 'square',
            gain: 0.07, attack: 0.002, pan: 0.35, sendAmt: 0.15
          });
        }
      }

      /* lead melody - random walk snapping to chord tones on strong beats */
      for (let s = 0; s < 16; s += 2) {
        if (R() > G.leadDensity) continue;
        if (s % 4 === 0) {
          const target = chord[Math.floor(R() * chord.length)];
          let best = 0, bestDist = 99;
          scale.forEach((sc, di) => {
            const d = Math.abs(((sc % 12) - (target % 12) + 12) % 12);
            if (d < bestDist) { bestDist = d; best = di; }
          });
          leadDeg = best + (leadDeg >= scale.length ? scale.length : 0);
        } else {
          leadDeg += [-2, -1, -1, 0, 1, 1, 2][Math.floor(R() * 7)];
        }
        leadDeg = Math.max(0, Math.min(scale.length * 2 - 1, leadDeg));
        const oct = Math.floor(leadDeg / scale.length);
        const semis = scale[leadDeg % scale.length] + 12 * oct;
        const lt = barT + s * step + (s % 2 === 1 ? G.swing * step : 0);
        const noteLen = step * (2 + Math.floor(R() * 3));
        playOsc({
          time: lt, len: noteLen,
          freq: midiHz(key + 24 + semis),
          type: G.wave, gain: genre === 'chip' ? 0.09 : 0.11,
          attack: genre === 'ambient' ? 0.25 : 0.012,
          filterHz: 3600, pan: -0.15, sendAmt: 0.45
        });
      }
    }

    onProgress && onProgress(45, t('m_rendering'));
    const buffer = await ctx.startRendering();
    onProgress && onProgress(92, t('m_rendering'));
    return { buffer, bpm, key, bars };
  }

  /* ---------- WAV encode ---------- */
  function toWav(buffer) {
    const ch = Math.min(2, buffer.numberOfChannels), len = buffer.length, sr = buffer.sampleRate;
    const bytes = 44 + len * ch * 2;
    const dv = new DataView(new ArrayBuffer(bytes));
    const wstr = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    wstr(0, 'RIFF'); dv.setUint32(4, bytes - 8, true); wstr(8, 'WAVE');
    wstr(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, ch, true);
    dv.setUint32(24, sr, true); dv.setUint32(28, sr * ch * 2, true); dv.setUint16(32, ch * 2, true); dv.setUint16(34, 16, true);
    wstr(36, 'data'); dv.setUint32(40, len * ch * 2, true);
    const L = buffer.getChannelData(0);
    const Rr = ch > 1 ? buffer.getChannelData(1) : L;
    let off = 44;
    for (let i = 0; i < len; i++) {
      dv.setInt16(off, Math.max(-32768, Math.min(32767, L[i] * 32767)), true); off += 2;
      dv.setInt16(off, Math.max(-32768, Math.min(32767, Rr[i] * 32767)), true); off += 2;
    }
    return new Blob([dv], { type: 'audio/wav' });
  }

  function drawWave(canvas, buffer) {
    const ctx2 = canvas.getContext('2d');
    const W = canvas.width = canvas.clientWidth * 2;
    const H = canvas.height = 220;
    ctx2.clearRect(0, 0, W, H);
    const data = buffer.getChannelData(0);
    const cols = 240, chunk = Math.floor(data.length / cols);
    const grad = ctx2.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, '#7c3aed'); grad.addColorStop(1, '#22d3ee');
    ctx2.fillStyle = grad;
    for (let c = 0; c < cols; c++) {
      let max = 0;
      for (let i = c * chunk; i < (c + 1) * chunk; i += 25) max = Math.max(max, Math.abs(data[i] || 0));
      const bh = Math.max(3, max * H * 0.92);
      const x = (c / cols) * W;
      ctx2.fillRect(x, (H - bh) / 2, (W / cols) * 0.6, bh);
    }
  }

  async function create() {
    const btn = $('#btn-music');
    const prog = $('#mus-progress');
    btn.disabled = true;
    const params = {
      genre: $('#mus-genre').value,
      scaleName: $('#mus-scale').value,
      tempo: (v => (v >= 50 ? v : 0))(parseInt($('#mus-tempo').value, 10) || 0),
      seconds: parseInt($('#mus-len').value, 10),
      seed: parseInt($('#mus-seed').value, 10) || 1
    };
    try {
      setProgress(prog, 5, t('m_scheduling'));
      const { buffer, bpm } = await render(params, (p, txt) => setProgress(prog, p, txt));
      const wav = toWav(buffer);

      const box = $('#mus-result');
      box.innerHTML = '';
      const card = document.createElement('div');
      card.className = 'card result-card';
      card.innerHTML = '<h4>' + $('#mus-genre').selectedOptions[0].textContent + ' · ' + bpm + ' BPM · seed ' + params.seed + '</h4>';
      const canvas = document.createElement('canvas');
      canvas.className = 'wavecanvas';
      const audio = document.createElement('audio');
      audio.controls = true;
      audio.src = URL.createObjectURL(wav);
      const row = document.createElement('div');
      row.className = 'btn-row';
      const dl = document.createElement('button');
      dl.className = 'btn accent'; dl.textContent = t('m_download');
      dl.onclick = () => downloadBlob(wav, 'vans-music-' + params.genre + '-' + params.seed + '.wav');
      const again = document.createElement('button');
      again.className = 'btn ghost'; again.textContent = t('m_regen');
      again.onclick = () => { $('#mus-seed').value = randSeed() % 100000; create(); };
      row.append(dl, again);
      card.append(canvas, audio, row);
      box.appendChild(card);
      drawWave(canvas, buffer);
      audio.play().catch(() => {});
      hideProgress(prog);
      toast(t('m_done'));
    } catch (e) {
      hideProgress(prog);
      toast('Audio error: ' + e.message);
    }
    btn.disabled = false;
  }

  function init() {
    $('#btn-music').onclick = create;
    $('#mus-dice').onclick = () => { $('#mus-seed').value = randSeed() % 100000; };
    $('#mus-tempo').addEventListener('input', e => {
      const v = parseInt(e.target.value, 10);
      $('#mus-tempo-val').textContent = v < 50 ? t('auto') : v;
    });
  }

  return { init };
})();
