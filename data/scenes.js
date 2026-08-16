/* data/scenes.js — 「会社まであと100m」OP + エンディング
 * Writer-1 専用 / data-schema.md §2 準拠(フラット配列)
 * file:// で動かすため import / export / fetch は使わない。代入1本だけ。
 *
 * 収録: OP 4シーン(op-night → op-midnight → op-morning → op-commute → walk)
 *       エンディング 7本(spec.md §5 の判定表と id が1対1で対応)
 *
 * 名場面(spec.md §3):
 *   ① 選択肢が全部「寝る」            … op-night   の choice
 *   ② 残り睡眠時間の逆算              … op-midnight の sleepLeft:true(数字は書かない)
 *   ③ 「あと5分」で5分以上進む時計    … op-morning の choice(Option.sec で 51分 / 22分)
 *   ④ 実績「家を出た」                … op-morning の achievement ビート
 */
window.GAME_SCENES = [

  /* ======================================================================
   * OP ① 前夜 — 22:41 / 15秒
   * ==================================================================== */
  {
    id: 'op-night',
    chapter: 'op',
    label: '8月17日(月) 前夜',
    clock: '22:41',
    bg: 'room-night',
    skippable: true,
    estSeconds: 15,
    next: 'op-midnight',
    beats: [
      { type: 'text', text: '布団に入った。', auto: 1200 },
      { type: 'text', text: '明日のことを考えはじめる。', auto: 1500, mental: -2 },
      { type: 'wait', ms: 700 },

      /* 【名場面①】選択肢が全部「寝る」 — 同一ラベルを統合・除外しないこと */
      {
        type: 'choice',
        prompt: 'どうする？',
        options: [
          { label: '寝る', reply: '寝る。', mental: -1 },
          { label: '寝る', reply: '寝る。', mental: -1 },
          { label: '寝る', reply: 'やっぱり寝る。', mental: -2 }
        ]
      },

      { type: 'text', text: '電気を消す。', auto: 1200 },
      { type: 'text', text: '目が冴えた。', fx: 'dim', auto: 1800, mental: -3 },
      { type: 'wait', ms: 600 }
    ]
  },

  /* ======================================================================
   * OP ② 深夜 — 02:50 / 15秒
   * ==================================================================== */
  {
    id: 'op-midnight',
    chapter: 'op',
    label: '8月17日(月) 深夜',
    clock: '02:50',
    bg: 'room-dark',
    skippable: true,
    estSeconds: 15,
    next: 'op-morning',
    beats: [
      { type: 'text', text: '目が覚めた。あるいは、寝ていない。', auto: 1500 },
      { type: 'text', text: '天井の木目は、もう暗記している。', fx: 'dim', auto: 1400 },

      /* 【名場面②】残り睡眠時間の逆算 — 数字はエンジンが自動計算する */
      { type: 'text', text: '今から寝れば、まだ間に合う。', sleepLeft: true, auto: 2000, mental: -2 },

      { type: 'text', text: 'スマホを開く。', auto: 1000 },
      { type: 'clock', to: '03:24', fx: 'glitch', ms: 1400 },
      { type: 'text', text: '同じことを考えている。', sleepLeft: true, auto: 2200, mental: -3 },
      { type: 'text', text: '枕の、まだ冷たい側を探している。', fx: 'dim', auto: 1600 },
      { type: 'wait', ms: 800 }
    ]
  },

  /* ======================================================================
   * OP ③ 朝 — 06:50 / 20秒
   * ==================================================================== */
  {
    id: 'op-morning',
    chapter: 'op',
    label: '8月17日(月) 朝',
    clock: '06:50',
    bg: 'room-morning',
    skippable: true,
    estSeconds: 20,
    next: 'op-commute',
    beats: [
      { type: 'text', text: 'アラーム。', fx: 'alarm', auto: 800 },
      { type: 'text', text: '止めた記憶がないのに、止まっている。', fx: 'alarm', auto: 1200 },
      { type: 'wait', ms: 500 },

      /* 【名場面③】「あと5分」で5分以上進む時計
       * どちらを選んでも時間は飛ぶ。あと5分 → 07:41(51分) / 起きる → 07:12(22分)
       * ※ Option には clock を書けないため、等価な Option.sec で表現している */
      {
        type: 'choice',
        prompt: 'どうする？',
        options: [
          { label: 'あと5分', reply: 'あと5分。', sec: 3060, fx: 'glitch', mental: -4 },
          { label: '起きる', reply: '起きる。体はまだ寝ている。', sec: 1320, fx: 'glitch', mental: -2 }
        ]
      },

      { type: 'text', text: '時計を見る。', auto: 900 },
      { type: 'text', text: 'そんなに経っていないはずだった。', fx: 'glitch', auto: 1700, mental: -3 },
      { type: 'text', text: '顔を洗う。鏡は見ない。', auto: 1300 },
      { type: 'text', text: '鞄。財布。社員証。', auto: 1300 },
      { type: 'text', text: '玄関を開ける。外はもう明るい。', auto: 1600 },

      /* 【名場面④】実績「家を出た」 */
      { type: 'achievement', id: 'ach-left-home' },

      { type: 'wait', ms: 700 }
    ]
  },

  /* ======================================================================
   * OP ④ 通勤 — 08:20 → 08:49 / 15秒
   * ==================================================================== */
  {
    id: 'op-commute',
    chapter: 'op',
    label: '8月17日(月) 通勤',
    clock: '08:20',
    bg: 'street',
    skippable: true,
    estSeconds: 15,
    next: 'walk',
    beats: [
      { type: 'text', text: '電車。ドアの横。誰とも目を合わせない。', auto: 1500 },
      { type: 'text', text: '乗り換え。人の流れに乗るだけでいい。', auto: 1500, mental: -2 },
      { type: 'text', text: '改札を出た。', auto: 1100 },
      { type: 'text', text: '外は、もう暑い。', auto: 1300, mental: -2 },
      { type: 'clock', to: '08:49', ms: 900 },
      { type: 'text', text: 'ここまでは、乗っていれば着いた。', fx: 'slow', auto: 1800 },
      { type: 'wait', ms: 600 },

      /* 本編開始値の正規化。必ず最後のビートに置くこと(spec.md §3.4) */
      { type: 'mental', set: 90 }
    ]
  },

  /* ======================================================================
   * エンディング(spec.md §5 / 判定は上から順)
   * ==================================================================== */

  /* ① 削られずに着いた。何も感じなかったことのほうが怖い */
  {
    id: 'ending-perfect',
    chapter: 'ending',
    bg: 'office-front',
    estSeconds: 25,
    next: null,
    beats: [
      { type: 'text', text: '着いた。', auto: 1300 },
      { type: 'text', text: '息も切れていない。', auto: 1600 },
      { type: 'wait', ms: 900 },
      { type: 'text', text: '削られた実感が、ほとんどない。', auto: 1800 },
      { type: 'text', text: 'たぶん、慣れた。', fx: 'dim', auto: 1800 },
      { type: 'wait', ms: 1000 },
      { type: 'text', text: 'それが、いちばん怖い。', fx: 'slow', auto: null }
    ]
  },

  /* ② 着いた。席に座る。何も起きない */
  {
    id: 'ending-ontime',
    chapter: 'ending',
    bg: 'office-front',
    estSeconds: 25,
    next: null,
    beats: [
      { type: 'text', text: '着いた。', auto: 1300 },
      { type: 'text', text: '自動ドアが、何も聞かずに開く。', auto: 1600 },
      { type: 'text', text: '階数ボタンは、押す前に光っていた。', auto: 1400 },
      { type: 'wait', ms: 700 },
      { type: 'text', text: '席に座る。', auto: 1400 },
      { type: 'text', text: 'パソコンが立ち上がるのを待つ。', auto: 1700 },
      { type: 'text', text: '何も起きない。', fx: 'dim', auto: 1800 },
      { type: 'wait', ms: 900 },
      { type: 'text', text: '1日が始まった。', fx: 'slow', auto: null }
    ]
  },

  /* ③ 着いた。座った。体だけがそこにある */
  {
    id: 'ending-hollow',
    chapter: 'ending',
    bg: 'office-front',
    estSeconds: 25,
    next: null,
    beats: [
      { type: 'text', text: '着いた。', auto: 1300 },
      { type: 'text', text: '着いた、ということにしておく。', fx: 'dim', auto: 1700 },
      { type: 'wait', ms: 900 },
      { type: 'text', text: '座った。', auto: 1300 },
      { type: 'text', text: '体だけが、ちゃんとそこにある。', auto: 1900 },
      { type: 'wait', ms: 1000 },
      { type: 'text', text: '今日ぶんの自分は、道に置いてきた。', fx: 'slow', auto: null }
    ]
  },

  /* ④ 着いた。時計は09:0x。エレベーターが妙に速い */
  {
    id: 'ending-late',
    chapter: 'ending',
    bg: 'office-front',
    estSeconds: 25,
    next: null,
    beats: [
      { type: 'text', text: '着いた。', auto: 1300 },
      { type: 'text', text: '時計を見る。', auto: 1200 },
      { type: 'text', text: '見なければよかった。', fx: 'dim', auto: 1600 },
      { type: 'wait', ms: 800 },
      { type: 'text', text: 'エレベーターが、今日に限って止まらない。', auto: 1900 },
      { type: 'text', text: '8階まで、あっという間だった。', auto: 1700 },
      { type: 'wait', ms: 900 },
      { type: 'text', text: 'こういう日だけ、世界は親切だ。', fx: 'slow', auto: null }
    ]
  },

  /* ⑤ 会社の前で立ち止まる。ビルを見上げたまま動けない */
  {
    id: 'ending-standstill',
    chapter: 'ending',
    bg: 'office-front',
    estSeconds: 25,
    next: null,
    beats: [
      { type: 'text', text: '会社の前で、止まった。', auto: 1300 },
      { type: 'text', text: 'ビルを見上げる。', auto: 1400 },
      { type: 'wait', ms: 1000 },
      { type: 'text', text: '上のほうの窓は、空しか映していない。', auto: 1900 },
      { type: 'text', text: '入口は、すぐそこにある。', auto: 1600 },
      { type: 'wait', ms: 1200 },
      { type: 'text', text: '動けない。', fx: 'slow', auto: null }
    ]
  },

  /* ⑥ 足が勝手に逆を向く。判断ではなく反射 */
  {
    id: 'ending-turnback-auto',
    chapter: 'ending',
    bg: 'street',
    estSeconds: 25,
    next: null,
    beats: [
      { type: 'text', text: '足が、勝手に逆を向いた。', fx: 'shake', auto: 1500 },
      { type: 'text', text: '判断ではない。反射だ。', auto: 1600 },
      { type: 'wait', ms: 900 },
      { type: 'text', text: '来た道を、同じ速さで戻っていく。', auto: 1800 },
      { type: 'text', text: '止める理由が、一つも出てこない。', fx: 'dim', auto: 1800 },
      { type: 'wait', ms: 1000 },
      { type: 'text', text: 'あとのことは、明日の自分が考える。', fx: 'slow', auto: null }
    ]
  },

  /* ⑦ 引き返した。今日は無理だった。それだけ */
  {
    id: 'ending-turnback',
    chapter: 'ending',
    bg: 'street',
    estSeconds: 25,
    next: null,
    beats: [
      { type: 'text', text: '引き返した。', auto: 1300 },
      { type: 'text', text: '駅の方へ歩く。歩幅が急に大きくなった。', auto: 1800 },
      { type: 'wait', ms: 800 },
      { type: 'text', text: '連絡は、電車に乗ってから入れる。', auto: 1700 },
      { type: 'text', text: '文面は、もう何度も書いたことがある。', fx: 'dim', auto: 1800 },
      { type: 'wait', ms: 1000 },
      { type: 'text', text: '今日は無理だった。それだけ。', fx: 'slow', auto: null }
    ]
  },

  /* 従順度が高すぎるまま到着。本人より先に会社員になった。 */
  {
    id: 'ending-compliant', chapter: 'ending', bg: 'office-front', estSeconds: 24, next: null,
    beats: [
      { type: 'text', text: '自動ドアが、顔を見る前に開いた。', auto: 1500 },
      { type: 'text', text: '受付端末には、もう出勤済みと表示されている。', fx: 'notify', auto: 1800 },
      { type: 'wait', ms: 800 },
      { type: 'text', text: '席に座る。手が、今日の予定を入力していく。', auto: 1800 },
      { type: 'text', text: '自分が考えるより、少しだけ速い。', fx: 'dim', auto: 1700 },
      { type: 'wait', ms: 900 },
      { type: 'text', text: '会社は、もう自分を必要としていなかった。', auto: 1700 },
      { type: 'text', text: '自分の形だけが必要だった。', fx: 'slow', auto: null }
    ]
  },

  /* 禁忌選択: 近道。 */
  {
    id: 'ending-accident-road', chapter: 'ending', bg: 'black', estSeconds: 20, next: null,
    beats: [
      { type: 'text', text: '二歩で渡れると思った。', auto: 1300 },
      { type: 'text', text: '一歩目で、通知音が鳴った。', fx: 'notify', auto: 1500 },
      { type: 'wait', ms: 700 },
      { type: 'text', text: '「到着を確認できませんでした」', auto: 1700 },
      { type: 'text', text: '会社まで、あと50m。', fx: 'slow', auto: null }
    ]
  },

  /* 禁忌選択: 目を閉じて走る。 */
  {
    id: 'ending-accident-glass', chapter: 'ending', bg: 'black', estSeconds: 20, next: null,
    beats: [
      { type: 'text', text: '入口まで、まっすぐだった。', auto: 1300 },
      { type: 'text', text: 'ドアが開く音はしなかった。', fx: 'shake', auto: 1500 },
      { type: 'wait', ms: 800 },
      { type: 'text', text: '翌朝、センサーは交換された。', auto: 1800 },
      { type: 'text', text: '勤怠には、欠勤とだけ残った。', fx: 'slow', auto: null }
    ]
  }

];
