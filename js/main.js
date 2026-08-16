/* ===========================================================================
 * main.js — 「会社まであと100m」ゲーム本体
 * 担当: Frontend-1 (t-5507518e)
 *
 * 準拠: .ai-team/artifacts/spec.md / data-schema.md / css-classes.md
 *
 * engine.js = データの再生装置。main.js = このゲームのルール。
 *   - 本編の歩行ループと抽選 (data-schema.md §3.4 / spec.md §4.4)
 *   - エンディング分岐 (spec.md §5)
 *   - 実績のトリガ評価 (data-schema.md §4)
 *   - タイトル / 設定 / リザルト画面 (データ不要・Frontend 実装)
 *
 * data/*.js への参照は §1 の DATA だけ。スキーマが動いたらここだけ直す。
 * =========================================================================*/
(function (global) {
  'use strict';

  var doc = global.document;
  var E = global.Engine;
  if (!E) {
    if (global.console) global.console.error('[main] js/engine.js が読み込まれていません');
    return;
  }

  var CONFIG = E.CONFIG;
  var state = E.state;
  var Save = E.Save;
  var Sound = E.Sound;

  var view = null;
  var engine = null;
  var bgmHandle = null;

  var OP_FIRST = 'op-night';

  /* =======================================================================
   * 1. データ参照はここだけ (data/*.js / window.GAME_*)
   * ===================================================================== */
  var DATA = {
    _cache: {},

    /** 本編イベント (data-schema.md §3) */
    events: function () {
      if (!this._cache.events) {
        var raw = global.GAME_EVENTS;
        if (!Array.isArray(raw) || !raw.length) {
          E.warn('data/events.js が読めません。仮イベントで続行します');
          raw = PLACEHOLDER_EVENTS;
        }
        this._cache.events = raw.map(DATA.normalizeEvent).filter(Boolean);
      }
      return this._cache.events;
    },
    normalizeEvent: function (raw, i) {
      if (!raw) return null;
      if (typeof raw === 'string') raw = { text: raw };
      var kind = raw.kind || 'pool';
      if (kind !== 'pool' && kind !== 'fixed' && kind !== 'filler') {
        E.warn('未知の kind: ' + kind);
        kind = 'pool';
      }
      return {
        id: raw.id || ('ev-auto-' + i),
        text: E.toLines(raw.text),
        mental: typeof raw.mental === 'number' ? raw.mental : -1,
        tags: E.toTags(raw.tags || raw.tag),
        kind: kind,
        zone: raw.zone || 'any',
        at: typeof raw.at === 'number' ? raw.at : null,
        weight: typeof raw.weight === 'number' && raw.weight > 0 ? raw.weight : 10,
        sec: typeof raw.sec === 'number' ? raw.sec : 0,
        fx: raw.fx || 'none',
        sound: raw.sound || null,
        variants: Array.isArray(raw.variants) ? raw.variants.map(E.toLines) : null,
        achievement: raw.achievement || null,
        choices: Array.isArray(raw.choices) ? raw.choices : null,
        requires: raw.requires || null
      };
    },

    /** OP / エンディングのシーン (data-schema.md §2) */
    scenes: function () {
      var raw = global.GAME_SCENES;
      if (!Array.isArray(raw) || !raw.length) {
        E.warn('data/scenes.js が読めません。仮シーンで続行します');
        return [];
      }
      return raw.filter(function (s) {
        if (s && s.id) return true;
        E.warn('id の無いシーンがあります');
        return false;
      });
    },

    /** 実績 (data-schema.md §4)。data があればそれが唯一の正 */
    achievementList: function () {
      if (!this._cache.achList) {
        var raw = global.GAME_ACHIEVEMENTS;
        if (!Array.isArray(raw) || !raw.length) {
          E.warn('data/achievements.js が読めません。仮の実績定義で続行します');
          raw = FALLBACK_ACHIEVEMENTS;
        }
        var map = {};
        raw.forEach(function (a, i) {
          var n = DATA.normalizeAchievement(a, i);
          if (n) map[n.id] = n;
        });
        this._cache.achList = Object.keys(map).map(function (k) { return map[k]; });
        this._cache.achMap = map;
      }
      return this._cache.achList;
    },
    achievements: function () { this.achievementList(); return this._cache.achMap; },
    normalizeAchievement: function (raw, i) {
      if (!raw || !raw.id) { E.warn('id の無い実績があります'); return null; }
      return {
        id: raw.id,
        name: raw.name || raw.id,
        desc: raw.desc || '',
        hidden: !!raw.hidden,
        trigger: raw.trigger || { kind: 'manual' }
      };
    },

    /**
     * UI 文言 (data/ui.js)。画面に出る文字列はすべてここ経由で取る。
     * 欠けていても落ちないよう FALLBACK_UI を下敷きにする。
     */
    ui: function () {
      if (!this._cache.ui) {
        var raw = global.GAME_UI;
        if (!raw || typeof raw !== 'object') {
          E.warn('data/ui.js が読めません。仮の文言で続行します');
          raw = {};
        }
        this._cache.ui = mergeDeep(clone(FALLBACK_UI), raw);
      }
      return this._cache.ui;
    },

    /** [立ち止まる] の専用テキスト (data/ui.js system.stopLines) */
    stopLines: function () {
      var list = this.ui().system.stopLines;
      return (Array.isArray(list) && list.length) ? list : FALLBACK_UI.system.stopLines;
    }
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function mergeDeep(base, add) {
    if (!add || typeof add !== 'object') return base;
    Object.keys(add).forEach(function (k) {
      var v = add[k];
      if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
        mergeDeep(base[k], v);
      } else if (v !== undefined && v !== null) {
        base[k] = v;
      }
    });
    return base;
  }

  /* =======================================================================
   * 2. 実績
   * ===================================================================== */
  function achieve(id) {
    if (!id) return false;
    if (state.unlocked.indexOf(id) >= 0) return false;
    var def = DATA.achievements()[id];
    if (!def) {
      E.warn('data/achievements.js に無い実績 id: ' + id);
      def = { id: id, name: id, desc: '' };
    }
    state.unlocked.push(id);
    Save.push('achievements', id);
    view.toast({ label: DATA.ui().achievements.toastLabel, name: def.name, desc: def.desc });
    Sound.achievement();
    return true;
  }

  function compare(a, op, b) {
    switch (op) {
      case '>=': return a >= b;
      case '<=': return a <= b;
      case '==': return a == b;   /* skippedOP に true と 1 の両方が来るので緩い等価 */
      case '>': return a > b;
      case '<': return a < b;
      default: E.warn('未知の op: ' + op); return false;
    }
  }

  /**
   * stat トリガが参照できる値。
   * data-schema.md §4 の state.stats に加えて、data/achievements.js が実際に
   * 使っている remaining / mental / endingsCount も引けるようにしてある。
   * ※スキーマ外の拡張。Designer-1 に確認依頼中(handoff 参照)。
   */
  function statContext() {
    return Object.assign({}, state.stats, {
      remaining: state.remaining,
      mental: state.mental,
      compliance: state.compliance,
      endingsCount: (Save.get('endings') || []).length,
      achievementsCount: (Save.get('achievements') || []).length,
      plays: Save.get('plays') || 0,
      clockSec: state.clockSec,
      endingId: state.endingId || null
    });
  }

  function evalTrigger(t, ctx) {
    if (!t) return false;
    switch (t.kind) {
      case 'manual': return false;
      case 'stat':
        if (!(t.key in ctx)) { E.warn('未知の stat key: ' + t.key); return false; }
        return compare(ctx[t.key], t.op, t.value);
      case 'ending':
        return !!ctx.endingId && ctx.endingId === t.id;
      /* 以下は data-schema.md には無いが data/achievements.js が使っている */
      case 'all': return (t.of || []).every(function (x) { return evalTrigger(x, ctx); });
      case 'any': return (t.of || []).some(function (x) { return evalTrigger(x, ctx); });
      default: E.warn('未知の trigger.kind: ' + t.kind); return false;
    }
  }

  /** 自動トリガは毎ステップ評価する (data-schema.md §4) */
  function evalAchievements() {
    var ctx = statContext();
    DATA.achievementList().forEach(function (a) {
      if (state.unlocked.indexOf(a.id) >= 0) return;
      if (evalTrigger(a.trigger, ctx)) achieve(a.id);
    });
  }

  /* =======================================================================
   * 3. HUD
   * ===================================================================== */
  function updateHud() {
    view.setClock(state.clockSec);
    view.setDistance(state.remaining);
    view.setMental(state.mental, 0);
    var elapsed = state.clockSec - E.parseClock(CONFIG.walkStartClock);
    state.stats.elapsedSec = Math.max(0, elapsed);
    state.stats.seenCount = state.seen.length;
    var app = doc.getElementById('app');
    if (app) {
      app.classList.toggle('g-app--low', state.mental <= 35);
      app.classList.toggle('g-app--critical', state.mental <= 15);
    }
    if (bgmHandle && !bgmHandle.stopped && bgmHandle.setTension) {
      bgmHandle.setTension(1 - state.mental / CONFIG.mentalMax);
    }
  }

  /* =======================================================================
   * 4. 本編 — 歩行ループ (mode:'walk')
   * ===================================================================== */
  var walk = {
    token: 0,
    queue: [],
    busy: false,
    finished: false,
    lastAction: null,
    recentTags: [],
    lastEventId: null,
    resolve: null
  };

  function zoneOf(remaining) {
    if (remaining >= 68) return 'far';
    if (remaining >= 34) return 'mid';
    return 'near';
  }

  function tagKey(ev) { return ev.tags.slice().sort().join('|'); }

  function weightedPick(list) {
    if (!list.length) return null;
    var total = 0, i;
    for (i = 0; i < list.length; i++) total += list[i].weight;
    var r = Math.random() * total;
    for (i = 0; i < list.length; i++) {
      r -= list[i].weight;
      if (r <= 0) return list[i];
    }
    return list[list.length - 1];
  }

  /** 抽選 (data-schema.md §3.4)。取れなければ null を返し、落とさない */
  function drawEvent(remaining) {
    var all = DATA.events();
    var used = state.seen;

    /* 1. 節目は必ず出す */
    var fixed = all.filter(function (e) {
      return e.kind === 'fixed' && e.at === remaining && used.indexOf(e.id) < 0 &&
        (!e.requires || state.flags[e.requires]);
    });
    if (fixed.length) return fixed[0];

    /* 2. pool から未使用・zone 適合・requires 充足を重み付き抽選 */
    var zone = zoneOf(remaining);
    var pool = all.filter(function (e) {
      if (e.kind !== 'pool') return false;
      if (used.indexOf(e.id) >= 0) return false;
      if (e.zone !== 'any' && e.zone !== zone) return false;
      if (e.requires && !state.flags[e.requires]) return false;
      return true;
    });
    if (pool.length) {
      var recent = walk.recentTags.slice(-3);
      var fresh = pool.filter(function (e) { return recent.indexOf(tagKey(e)) < 0; });
      return weightedPick(fresh.length ? fresh : pool);
    }

    /* 3. 尽きたら filler(再利用可・直前と同じものは避ける) */
    var filler = all.filter(function (e) {
      return e.kind === 'filler' && e.id !== walk.lastEventId;
    });
    if (filler.length) return weightedPick(filler);

    /* 4. 何も無ければ本文なしで進む */
    return null;
  }

  function markSeen(ev) {
    if (state.seen.indexOf(ev.id) < 0) state.seen.push(ev.id);
    walk.lastEventId = ev.id;
    walk.recentTags.push(tagKey(ev));
    if (walk.recentTags.length > 8) walk.recentTags.shift();
    state.stats.seenCount = state.seen.length;
  }

  /** イベント1本の再生。選択肢があれば入力を待つ (spec.md §4.4 の 3〜4) */
  function presentEvent(ev) {
    if (ev.sec) engine.advanceClock(ev.sec);
    if (typeof ev.mental === 'number') engine.addMental(ev.mental);
    if (ev.achievement) achieve(ev.achievement);
    if (ev.sound) Sound.call(ev.sound);
    markSeen(ev);
    updateHud();

    var eventText = ev.text;
    if (ev.variants && ev.variants.length) {
      var playIndex = Math.max(0, (Save.get('plays') || 1) - 1);
      eventText = ev.variants[playIndex % ev.variants.length];
    }
    return view.paragraph(eventText, {}).then(function (p) {
      if (!engine.alive(walk.token)) return false;
      if (ev.fx && ev.fx !== 'none') view.applyFx(ev.fx);
      if (!ev.choices || !ev.choices.length) return true;

      walk.queue.length = 0;           /* 選択中は歩行の入力を持ち越さない */
      return view.hold(320).then(function () {
        if (!engine.alive(walk.token)) return false;
        return view.pick(ev.choices, { stagger: true });
      }).then(function (opt) {
        if (!opt || !engine.alive(walk.token)) return false;
        renderWalkButtons();           /* reply 中も [進む] を押せるようにする */
        var o = Object.assign({}, opt);
        if (o.auto == null) o.auto = 1400;
        return engine.applyOption(o, walk.token).then(function (ok) {
          if (ok !== false && o.ending) {
            goEnding(o.ending);
            return false;
          }
          return ok;
        });
      });
    });
  }

  /** 1歩進む (spec.md §4.4) */
  function stepForward() {
    state.remaining = Math.max(0, state.remaining - 1);
    engine.advanceClock(CONFIG.walkSec);
    state.stats.stepCount += 1;
    Sound.step();
    updateHud();
    renderWalkButtons();   /* 残り1mで [進む]→[入る] に変わる */
    view.clearBody();

    var ev = drawEvent(state.remaining);
    var seq = ev ? presentEvent(ev) : view.hold(CONFIG.walkTail);

    return seq.then(function () {
      if (!engine.alive(walk.token)) return false;
      updateHud();
      evalAchievements();
      var ending = decideEnding();
      if (ending) { goEnding(ending); return false; }
      return view.hold(CONFIG.walkTail);
    });
  }

  /** 立ち止まる (spec.md §4.3) */
  function standStill() {
    var heal = walk.lastAction === 'stop' ? CONFIG.stopHealRepeat : CONFIG.stopHeal;
    state.stats.stopCount += 1;
    engine.advanceClock(CONFIG.stopSec);
    engine.addMental(heal);
    updateHud();
    view.clearBody();

    var lines = DATA.stopLines();
    var line = lines[(state.stats.stopCount - 1) % lines.length];
    return view.paragraph(line, { className: 'g-text--dim' }).then(function () {
      if (!engine.alive(walk.token)) return false;
      evalAchievements();
      var ending = decideEnding();
      if (ending) { goEnding(ending); return false; }
      return view.hold(CONFIG.walkTail);
    });
  }

  /** 引き返す。確認は画面内の選択肢で出す(alert/confirm 禁止) */
  function turnBack() {
    var ui = DATA.ui().system;
    state.stats.backAttempts += 1;
    walk.queue.length = 0;
    view.clearBody();
    return view.paragraph([ui.backPrompt], { className: 'g-text--dim' }).then(function () {
      if (!engine.alive(walk.token)) return false;
      return view.pick([
        { label: ui.backCancel, id: 'no' },
        { label: ui.walkBack, id: 'yes', className: 'g-choice--dim' }
      ], { stagger: true });
    }).then(function (opt) {
      if (!opt || !engine.alive(walk.token)) return false;
      if (opt.id === 'yes') { goEnding('ending-turnback'); return false; }
      renderWalkButtons();
      view.clearBody();
      return true;
    });
  }

  /**
   * エンディング判定。上から順に最初に真になったもの。
   * balance-report.md(t-fb9e87b4)で条件を全面差し替え済み。
   * ending-turnback だけはボタン確定なのでこの関数を通さない(最優先)。
   */
  function decideEnding() {
    var late = state.clockSec >= E.parseClock(CONFIG.startWorkClock);
    var st = state.stats;
    if (state.remaining === 0) {
      if (state.compliance >= 85) return 'ending-compliant';
      if (!late && state.mental >= 17 && st.stopCount === 0 && st.backAttempts === 0) return 'ending-perfect';
      if (late) return 'ending-late';                    // 遅刻はメンタルより優先
      if (state.mental >= 5) return 'ending-ontime';     // 標準
      return 'ending-hollow';
    }
    if (state.mental <= 0) {
      /* 距離ではなく引き返そうとしたかで分ける */
      return st.backAttempts === 0 ? 'ending-standstill' : 'ending-turnback-auto';
    }
    return null;
  }

  function goEnding(id) {
    if (walk.finished) return;
    walk.finished = true;
    walk.queue.length = 0;
    state.endingId = id;
    Save.push('endings', id);
    evalAchievements();
    view.clearButtons();
    view.showHud(false);
    if (walk.resolve) { walk.resolve(true); walk.resolve = null; }
    engine.goto(engine.has(id) ? id : 'ending-ontime');
  }

  /** 歩行の操作ボタン。押しても消えない(連打できること / spec.md §2.2) */
  function renderWalkButtons() {
    var ui = DATA.ui().system;
    /* 最後の1mだけ [進む] が [入る] になる (data/ui.js walkForwardLast) */
    var forward = state.remaining === 1 ? ui.walkForwardLast : ui.walkForward;
    view.buttons([
      { label: forward, className: 'g-choice--primary g-choice--center', onClick: function () { queueAction('go'); } },
      { label: ui.walkStop, className: 'g-choice--quiet', onClick: function () { queueAction('stop'); } },
      { label: ui.walkBack, className: 'g-choice--quiet g-choice--dim', onClick: function () { queueAction('back'); } }
    ]);
  }

  /** 入力は捨てない。演出中でも受け付けて、演出を打ち切って次へ */
  function queueAction(action) {
    if (walk.finished || !engine.alive(walk.token)) return;
    Sound.unlock();
    view.cutAll();
    if (action !== 'go') walk.queue.length = 0;
    walk.queue.push(action);
    pumpWalk();
  }

  function pumpWalk() {
    if (walk.busy) return;
    walk.busy = true;
    function loop() {
      if (walk.finished || !engine.alive(walk.token) || !walk.queue.length) {
        walk.busy = false;
        return Promise.resolve();
      }
      var action = walk.queue.shift();
      var run = action === 'go' ? stepForward()
        : action === 'stop' ? standStill()
          : turnBack();
      return run.then(function () {
        walk.lastAction = action;
        return loop();
      }).catch(function (e) {
        if (global.console) global.console.error('[main]', e);
        walk.busy = false;
      });
    }
    loop();
  }

  /** mode:'walk' 本体 */
  function walkMode(scene, eng, token) {
    walk.token = token;
    walk.queue = [];
    walk.busy = false;
    walk.finished = false;
    walk.lastAction = null;
    walk.recentTags = [];
    walk.lastEventId = null;

    toggleSkipUI(false);
    view.showHud(true);
    view.clearBody();
    updateHud();
    renderWalkButtons();

    /* fixed の at:100 は歩き出す前の1本として出す */
    var opening = DATA.events().filter(function (e) {
      return e.kind === 'fixed' && e.at === state.remaining && state.seen.indexOf(e.id) < 0;
    })[0];
    if (opening) presentEvent(opening);

    return new Promise(function (resolve) { walk.resolve = resolve; });
  }

  /* =======================================================================
   * 5. タイトル / 設定 / リザルト (データ不要・Frontend 実装)
   * ===================================================================== */
  function titleMode(scene, eng) {
    var ui = DATA.ui();
    view.showHud(false);
    toggleSkipUI(false);
    var total = DATA.achievementList().length;
    var got = (Save.get('achievements') || []).length;
    view.block('g-title', [
      { className: 'g-title__main', text: ui.title.main },
      { className: 'g-title__sub', text: ui.title.sub },
      { className: 'g-title__sub g-text--small', text: got + ' ' + ui.achievements.countSep + ' ' + total + '　' + ui.achievements.countNote }
    ]);
    var items = [
      { label: ui.title.start, className: 'g-choice--primary g-choice--center', onClick: function () { startGame(false); } }
    ];
    if (Save.get('skipOP')) {
      items.push({ label: ui.title.watchOp, className: 'g-choice--center', onClick: function () { startGame(true); } });
    }
    items.push({ label: ui.title.settings, className: 'g-choice--quiet g-choice--center', onClick: function () { eng.goto('settings'); } });
    view.buttons(items, { stagger: true });
    return Promise.resolve(true);
  }

  function startGame(forceOP) {
    Sound.unlock();
    if (!Save.get('soundChosen')) {
      Save.set('muted', false);
      Sound.setMuted(false);
      syncSoundUI();
    }
    E.resetState();
    state.endingId = null;
    Save.set('plays', (Save.get('plays') || 0) + 1);
    updateHud();
    if (!forceOP && Save.get('skipOP')) { skipOpening(); return; }
    engine.goto(engine.has(OP_FIRST) ? OP_FIRST : 'walk');
  }

  /** OP スキップ時の状態引き渡し (spec.md §7.2) */
  function skipOpening() {
    state.mental = CONFIG.mentalStart;
    state.clockSec = E.parseClock(CONFIG.walkStartClock);
    state.remaining = CONFIG.totalDistance;
    state.stats.skippedOP = true;
    updateHud();
    evalAchievements();      /* skippedOP の stat トリガをここで拾う */
    engine.goto('walk');
  }

  function settingsMode(scene, eng) {
    var ui = DATA.ui();
    var s = ui.settings;
    view.showHud(false);
    toggleSkipUI(false);
    var confirming = false;

    function render() {
      view.block('g-title', [
        { className: 'g-title__sub', text: s.heading },
        { className: 'g-title__sub g-text--small', text: confirming ? s.clearPrompt : '' }
      ]);
      if (confirming) {
        /* 確認は画面内の選択肢で1段だけ (spec.md §7.4 / alert・confirm 禁止) */
        view.buttons([
          { label: s.clearYes, className: 'g-choice--dim', onClick: function () {
            Save.reset();
            state.unlocked = [];
            syncSkipCheck();
            syncSoundUI();
            confirming = false;
            render();
            view.toast({ label: s.clear, name: s.clearDone });
          } },
          { label: s.clearNo, className: 'g-choice--quiet', onClick: function () { confirming = false; render(); } }
        ], { stagger: true });
        return;
      }
      var volumeWrap = doc.createElement('label');
      volumeWrap.className = 'g-volume';
      var volumeHead = doc.createElement('span');
      volumeHead.className = 'g-volume__head';
      var volumeName = doc.createElement('span');
      volumeName.textContent = s.bgmVolume || 'BGM音量';
      var volumeValue = doc.createElement('span');
      var volume = Math.round((Save.get('bgmVolume') == null ? 0.7 : Save.get('bgmVolume')) * 100);
      volumeValue.textContent = volume + '%';
      volumeHead.appendChild(volumeName); volumeHead.appendChild(volumeValue);
      var volumeInput = doc.createElement('input');
      volumeInput.className = 'g-volume__input';
      volumeInput.type = 'range'; volumeInput.min = '0'; volumeInput.max = '100'; volumeInput.step = '5'; volumeInput.value = String(volume);
      volumeInput.addEventListener('input', function () {
        var ratio = Number(volumeInput.value) / 100;
        Save.set('bgmVolume', ratio);
        volumeValue.textContent = volumeInput.value + '%';
        if (bgmHandle && !bgmHandle.stopped && bgmHandle.setVolume) {
          bgmHandle.setVolume(bgmBaseVolume(engine.current) * ratio);
        }
      });
      volumeWrap.appendChild(volumeHead); volumeWrap.appendChild(volumeInput);
      view.el.body.appendChild(volumeWrap);
      view.buttons([
        { label: mark(Save.get('skipOP')) + ' ' + s.skipOp, onClick: function () {
          Save.set('skipOP', !Save.get('skipOP'));
          syncSkipCheck();
          render();
        } },
        { label: mark(!Save.get('muted')) + ' ' + s.sound, onClick: function () {
          setMuted(!Save.get('muted'));
          render();
        } },
        { label: s.clear, className: 'g-choice--quiet g-choice--dim', onClick: function () { confirming = true; render(); } },
        { label: s.back, className: 'g-choice--quiet', onClick: function () { eng.goto('title'); } }
      ]);
    }
    function mark(on) { return on ? '☑' : '☐'; }
    render();
    return Promise.resolve(true);
  }

  /** リザルト (spec.md §5 末尾 / css-classes.md §19〜§22) */
  function resultMode(scene, eng) {
    view.showHud(false);
    toggleSkipUI(false);

    var ui = DATA.ui();
    var defs = DATA.achievementList();
    var saved = Save.get('achievements') || [];
    var thisRun = state.unlocked;

    view.renderResult({
      label: ui.result.label,
      secToday: ui.result.secToday,
      secAch: ui.result.secAch,
      countNote: ui.achievements.countNote,
      countSep: ui.achievements.countSep,
      ending: ui.result.endingName[state.endingId] || '—',
      /* 5行固定。key は data/ui.js が state / stats の実フィールド名で指定してくる */
      rows: (ui.result.stats || []).map(function (row) {
        return { key: row.name, val: statValue(row.key), unit: row.unit, text: isTextStat(row.key) };
      }),
      got: saved.length,
      total: defs.length,
      achievements: defs.map(function (a) {
        var got = saved.indexOf(a.id) >= 0;
        /* 未取得でも名前は出す(伏せ字は使わない / Manager 裁定)。
           hidden かつ未取得だけ存在ごと消す */
        var st = !got ? (a.hidden ? 'hidden' : 'locked')
          : (thisRun.indexOf(a.id) >= 0 ? 'new' : 'got');
        return { name: a.name, desc: a.desc, state: st };
      }),
      actions: [
        { label: ui.settings.again, className: 'g-choice--primary g-choice--center', onClick: function () { eng.goto('title'); } },
        { label: ui.title.settings, className: 'g-choice--quiet g-choice--center', onClick: function () { eng.goto('settings'); } }
      ],
      check: {
        label: ui.system.skipCheck,
        checked: !!Save.get('skipOP'),
        onChange: function (on) { Save.set('skipOP', on); syncSkipCheck(); }
      }
    });
    return Promise.resolve(true);
  }

  function isTextStat(key) { return key === 'late'; }

  /** リザルト1行分の値。key は data/ui.js の result.stats[].key */
  function statValue(key) {
    var ui = DATA.ui().result;
    var arrived = state.remaining === 0;
    switch (key) {
      case 'clockSec': return arrived ? E.formatClock(state.clockSec) : ui.notArrived;
      case 'late': return (arrived && state.clockSec >= E.parseClock(CONFIG.startWorkClock)) ? ui.yes : ui.no;
      case 'mental': return String(Math.ceil(state.mental));
      case 'mentalMin': return String(Math.ceil(state.stats.mentalMin));
      case 'remaining': return String(state.remaining);
      default:
        if (key in state.stats) return String(state.stats[key]);
        E.warn('リザルトの未知の key: ' + key);
        return '—';
    }
  }

  /* =======================================================================
   * 6. システムUI (スキップ / チェック / 音)
   * ===================================================================== */
  function toggleSkipUI(on) {
    var skip = doc.getElementById('skip');
    var check = doc.getElementById('skipAlways');
    if (skip) skip.classList.toggle('g-skip--hidden', !on);
    if (check) check.classList.toggle('g-hidden', !on);
  }

  function syncSkipCheck() {
    var input = doc.getElementById('skipAlwaysInput');
    if (input) input.checked = !!Save.get('skipOP');
  }

  function setMuted(muted) {
    Save.set('muted', !!muted);
    Save.set('soundChosen', true);
    Sound.setMuted(!!muted);
    if (!muted && engine && engine.current) syncBgm(engine.current);
    syncSoundUI();
  }

  function syncSoundUI() {
    var btn = doc.getElementById('sound');
    var muted = Save.get('muted');
    var ui = DATA.ui().system;
    if (btn) {
      btn.classList.toggle('g-sound--on', !muted);
      btn.setAttribute('aria-pressed', muted ? 'false' : 'true');
      btn.setAttribute('aria-label', muted ? ui.soundOn : ui.soundOff);
    }
  }

  function setText(id, text) {
    var el = doc.getElementById(id);
    if (el && text) el.textContent = text;
  }

  /* =======================================================================
   * 7. 仮データ (data/*.js が来るまでの繋ぎ / 来たら id 単位で上書きされる)
   * ===================================================================== */
  /* data/ui.js が無いときの下敷き。キー構成は data/ui.js と同じ */
  var FALLBACK_UI = {
    title: { main: '会社まであと100m', sub: '', start: 'はじめる', watchOp: 'OPを見る', settings: '設定' },
    result: {
      label: '記録', secToday: '今日', secAch: '実績',
      stats: [
        { key: 'clockSec', name: '到着時刻', unit: '' },
        { key: 'late', name: '遅刻', unit: '' },
        { key: 'mental', name: '到着時メンタル', unit: '' },
        { key: 'stopCount', name: '立ち止まり', unit: '回' },
        { key: 'backAttempts', name: '引き返し', unit: '回' }
      ],
      yes: 'あり', no: 'なし', notArrived: '——',
      endingLabel: '結末',
      endingName: {
        'ending-perfect': '無傷で到着', 'ending-ontime': '定刻に到着', 'ending-hollow': '空っぽで到着',
        'ending-late': '遅れて到着', 'ending-standstill': '会社の前で停止',
        'ending-turnback-auto': '反射で離脱', 'ending-turnback': '自主的に離脱'
      },
      endingNote: {}
    },
    achievements: { countSep: '/', countNote: '解除', newBadge: '今回', toastLabel: '実績解除' },
    settings: {
      heading: '設定', skipOp: 'OPをスキップする', sound: '音を鳴らす',
      clear: '記録を消す', clearPrompt: '記録を消しますか。', clearYes: '消す', clearNo: 'やめる',
      clearDone: '消えた。', back: '戻る', again: 'もう一度'
    },
    system: {
      skip: 'スキップ ≫', skipCheck: '次回から常にスキップ',
      soundOn: '音を鳴らす', soundOff: '音を消す', tapHint: 'タップで送る',
      walkForward: '進む', walkForwardLast: '入る', walkStop: '立ち止まる', walkBack: '引き返す',
      stopLines: ['立ち止まった。'],
      backPrompt: 'もう一度押すと、引き返す。', backCancel: 'やめる'
    }
  };

  var PLACEHOLDER_EVENTS = [
    { id: 'ph-1', text: '前を歩く人の歩幅が、こちらより少しだけ広い。', mental: -1, tag: 'colleague' },
    { id: 'ph-2', text: 'ポケットの中でスマホが一度だけ震えた。', mental: -2, tag: 'chat' },
    { id: 'ph-3', text: '背中を汗が一本、落ちていく。', mental: -1, tag: 'body' },
    { id: 'ph-4', kind: 'filler', text: 'アスファルトが白い。', mental: -0.5 },
    { id: 'ph-5', kind: 'filler', text: '蝉が鳴いている。', mental: -0.5 }
  ];

  var FALLBACK_ACHIEVEMENTS = [
    { id: 'left-home', name: '家を出た', desc: '最大の難関を突破した。' },
    { id: 'arrive', name: '会社に着いた', desc: 'あと100mを踏破した。', trigger: { kind: 'ending', id: 'ending-ontime' } },
    { id: 'statue', name: '立ち止まりの達人', desc: '5回以上立ち止まった。', trigger: { kind: 'stat', key: 'stopCount', op: '>=', value: 5 } },
    { id: 'hollow', name: '空っぽで着席', desc: 'メンタル10以下で到着した。', hidden: true, trigger: { kind: 'stat', key: 'mentalMin', op: '<=', value: 10 } },
    { id: 'skipper', name: '見なかったことにした', desc: 'OPを飛ばした。', hidden: true, trigger: { kind: 'stat', key: 'skippedOP', op: '==', value: true } },
    { id: 'almost', name: 'あと1m', desc: '会社の前で立ち止まった。', hidden: true, trigger: { kind: 'ending', id: 'ending-standstill' } }
  ];

  /* タイトル・設定・リザルト・本編は Frontend 実装のシーン(データ不要) */
  var SYSTEM_SCENES = [
    { id: 'title', mode: 'title', bg: 'black' },
    { id: 'settings', mode: 'settings', bg: 'black' },
    { id: 'result', mode: 'result', bg: 'black', layer: 'result' },
    { id: 'walk', mode: 'walk', bg: 'street', chapter: 'main' }
  ];

  /* 仮シーン。data/scenes.js があればそちらだけを使う(こちらは読み込まない)。
     本文は Writer-1 の担当なので、ここは骨格が通るための最小限。 */
  var FALLBACK_STORY_SCENES = [
    {
      id: 'op-night', chapter: 'op', label: '8月16日(日) 前夜', clock: '22:41',
      bg: 'room-night', skippable: true, estSeconds: 15,
      beats: [
        { type: 'text', text: '（仮）布団に入った。', auto: 900 },
        { type: 'text', text: '明日は仕事だ。それだけは、さっきから知っている。', auto: 1200 },
        {
          type: 'choice', prompt: '22:41。どうする？',
          options: [
            { label: '寝る', reply: '寝る。' },
            { label: '寝る', reply: '寝る。' },
            { label: '寝る', reply: 'やっぱり寝る。' }
          ]
        },
        { type: 'text', text: '目が冴えてきた。', auto: 1000 }
      ],
      next: 'op-midnight'
    },
    {
      id: 'op-midnight', chapter: 'op', clock: '02:50',
      bg: 'room-dark', skippable: true, estSeconds: 15,
      beats: [
        { type: 'text', text: '（仮）目が覚めた。あるいは、まだ寝ていない。', auto: 1100 },
        { type: 'text', text: '今から寝れば、まだ間に合う。', sleepLeft: true, auto: 1600 },
        { type: 'clock', to: '03:24', ms: 1200 },
        { type: 'text', text: '同じことを、もう一度考えている。', sleepLeft: true, auto: 1600 }
      ],
      next: 'op-morning'
    },
    {
      id: 'op-morning', chapter: 'op', label: '月曜日', clock: '06:50',
      bg: 'room-morning', skippable: true, estSeconds: 20,
      beats: [
        { type: 'text', text: 'アラーム。', fx: 'alarm', auto: 900 },
        {
          type: 'choice',
          options: [
            { label: 'あと5分', reply: '目を閉じる。', to: null, flag: 'snoozed' },
            { label: '起きる', reply: '起きられない。' }
          ]
        },
        { type: 'clock', to: '07:41', label: 'あと5分', fx: 'glitch', ms: 1500 },
        { type: 'text', text: '（仮）顔を洗う。鞄を持つ。', auto: 1000 },
        { type: 'achievement', id: 'left-home' }
      ],
      next: 'op-commute'
    },
    {
      id: 'op-commute', chapter: 'op', clock: '08:20',
      bg: 'street', skippable: true, estSeconds: 15,
      beats: [
        { type: 'text', text: '（仮）電車に乗る。乗り換える。改札を出る。', auto: 1200 },
        { type: 'clock', to: '08:49', ms: 800 },
        { type: 'mental', set: 90 }
      ],
      next: 'walk'
    },

    endingScene('ending-perfect', '削られなかった', ['（仮）何も感じないまま、着いてしまった。', 'そのことのほうが、少し怖い。']),
    endingScene('ending-ontime', '始業前', ['（仮）着いた。席に座る。', '何も起きない。1日が始まる。']),
    endingScene('ending-hollow', '空っぽ', ['（仮）着いた。座った。', '体だけが、そこにある。']),
    endingScene('ending-late', '09:0x', ['（仮）エレベーターが、妙に速い。']),
    endingScene('ending-standstill', '立ち止まり', ['（仮）会社の前で足が止まった。', 'ビルを見上げたまま、動けない。']),
    endingScene('ending-turnback-auto', '反射', ['（仮）足が勝手に逆を向いた。', '判断ではなかった。']),
    endingScene('ending-turnback', '今日は無理だった', ['（仮）引き返した。それだけのことだ。'])
  ];

  function endingScene(id, name, lines) {
    return {
      id: id, chapter: 'ending', bg: 'black', estSeconds: 25,
      beats: [
        { type: 'wait', ms: 900 },
        { type: 'text', text: lines, auto: null }
      ],
      next: null,
      endingName: name
    };
  }

  /* =======================================================================
   * 8. 起動
   * ===================================================================== */
  function onSceneEnter(scene) {
    toggleSkipUI(scene.chapter === 'op' && scene.skippable !== false);
    if (scene.id !== 'walk') view.showHud(false);
    /* 送り方が分からず止まる事故を防ぐため、最初の1シーンだけヒントを出す */
    showTapHint(!hintShown && (scene.chapter === 'op' || scene.chapter === 'ending'));
    syncBgm(scene);
  }

  function syncBgm(scene) {
    var shouldPlay = scene && (scene.chapter === 'op' || scene.id === 'walk' || scene.id === 'settings' || scene.chapter === 'ending');
    if (!shouldPlay) {
      if (bgmHandle && !bgmHandle.stopped) bgmHandle.stop(1.4);
      bgmHandle = null;
      return;
    }
    if (!bgmHandle || bgmHandle.stopped) {
      bgmHandle = Sound.drone({
        volume: bgmBaseVolume(scene) * (Save.get('bgmVolume') == null ? 0.7 : Save.get('bgmVolume')),
        tension: 1 - state.mental / CONFIG.mentalMax
      });
    }
  }

  function bgmBaseVolume(scene) {
    if (scene && scene.chapter === 'op') return 0.085;
    if (scene && scene.id === 'settings') return 0.1;
    return 0.12;
  }

  /** エンディングの締め(結末名+備考) → リザルトへ */
  function onSceneEnd(scene) {
    if (scene.chapter !== 'ending') return true;
    var ui = DATA.ui().result;
    var id = state.endingId || scene.id;
    view.block('g-ending', [
      { className: 'g-ending__label', text: ui.endingLabel },
      { className: 'g-ending__name', text: ui.endingName[id] || '' },
      { className: 'g-ending__note', text: ui.endingNote[id] || '' }
    ]);
    return view.hold(900)
      .then(function () { return view.waitForTap(); })
      .then(function () { return engine.goto('result'); });
  }

  var hintShown = false;
  function showTapHint(on) {
    var el = doc.getElementById('tapHint');
    if (!el) return;
    if (on) {
      el.textContent = DATA.ui().system.tapHint;
      el.classList.remove('g-hidden');
      hintShown = true;
    } else {
      el.classList.add('g-hidden');
    }
  }

  function boot() {
    Save.load();

    view = new E.View({
      app: doc.getElementById('app'),
      bg: doc.getElementById('bg'),
      scene: doc.getElementById('scene'),
      sceneResult: doc.getElementById('sceneResult'),
      resultEnding: doc.getElementById('resultEnding'),
      resultLabel: doc.getElementById('resultLabel'),
      resultSecToday: doc.getElementById('resultSecToday'),
      resultSecAch: doc.getElementById('resultSecAch'),
      resultStats: doc.getElementById('resultStats'),
      resultActions: doc.getElementById('resultActions'),
      achGot: doc.getElementById('achGot'),
      achTotal: doc.getElementById('achTotal'),
      achSep: doc.getElementById('achSep'),
      achNote: doc.getElementById('achNote'),
      achFill: doc.getElementById('achFill'),
      achList: doc.getElementById('achList'),
      body: doc.getElementById('sceneBody'),
      choices: doc.getElementById('choices'),
      hud: doc.getElementById('hud'),
      clock: doc.getElementById('clock'),
      dist: doc.getElementById('dist'),
      mental: doc.getElementById('mental'),
      mentalFill: doc.getElementById('mentalFill'),
      mentalVal: doc.getElementById('mentalVal'),
      blackout: doc.getElementById('blackout'),
      blackoutNote: doc.getElementById('blackoutNote'),
      flash: doc.getElementById('flash'),
      alarm: doc.getElementById('alarm'),
      alarmTime: doc.getElementById('alarmTime'),
      alarmLabel: doc.getElementById('alarmLabel'),
      toasts: doc.getElementById('toasts')
    });

    engine = new E.SceneEngine({
      view: view,
      state: state,
      hooks: {
        achievement: achieve,
        sceneEnter: onSceneEnter,
        sceneEnd: onSceneEnd
      }
    });

    engine.load(SYSTEM_SCENES);
    var storyScenes = DATA.scenes();
    engine.load(storyScenes.length ? storyScenes : FALLBACK_STORY_SCENES);
    engine.registerMode('title', titleMode);
    engine.registerMode('settings', settingsMode);
    engine.registerMode('result', resultMode);
    engine.registerMode('walk', walkMode);

    /* 画面上の固定文言は data/ui.js から入れる */
    var uiText = DATA.ui();
    setText('skipAlwaysLabel', uiText.system.skipCheck);
    setText('skip', uiText.system.skip);
    view.onCut = function () { showTapHint(false); };

    /* OP スキップ (spec.md §7.2) */
    var skipBtn = doc.getElementById('skip');
    if (skipBtn) {
      skipBtn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        Sound.unlock();
        Sound.stopAlarm();
        skipOpening();
      });
    }
    var check = doc.getElementById('skipAlwaysInput');
    if (check) {
      check.addEventListener('change', function () {
        Save.set('skipOP', !!check.checked);   /* チェックした瞬間に保存 */
      });
    }
    syncSkipCheck();

    var soundBtn = doc.getElementById('sound');
    if (soundBtn) {
      soundBtn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        Sound.unlock();
        setMuted(!Save.get('muted'));
      });
    }
    Sound.setMuted(Save.get('muted') !== false);
    syncSoundUI();

    E.resetState();
    updateHud();
    engine.goto('title');

    /* QA-1 / デバッグ用の窓口 */
    global.Game = {
      CONFIG: CONFIG, state: state, engine: engine, view: view, save: Save, data: DATA,
      achieve: achieve, drawEvent: drawEvent, decideEnding: decideEnding,
      goto: function (id) { return engine.goto(id); },
      step: function (n) {
        for (var i = 0; i < (n || 1); i++) queueAction('go');
      },
      clearSave: function () { Save.reset(); syncSkipCheck(); syncSoundUI(); }
    };
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();

})(window);
