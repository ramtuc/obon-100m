/* data/events.js — 「会社まであと100m」本編イベント
 * Writer-1 専用 / data-schema.md §3 準拠(フラット配列 + kind)
 * file:// で動かすため import / export / fetch は使わない。代入1本だけ。
 *
 * 内訳: kind:"fixed" 12本 / kind:"pool" 73本 / kind:"filler" 20本  計105本
 * fixed は fixed-events.md §2 の配置表どおり(mental 合計ちょうど -36.0 / 3行は at:50 と at:1 のみ)
 *   誘惑3点 = at:70(軽 +2/+20s) / at:40(本命 +3/+40s) / at:10(重 +5/+60s)
 * pool の zone: far25 / mid25 / near23(各ゾーンの抽選回数 29/31/29 に対応)
 * mental は spec.md §4.1 のガイド配分:
 *   filler -0.5 / pool通常 -0.5〜-1 / pool強いネタ 10本 -2〜-2.5 / pool回復 5本 +2〜+3
 */
window.GAME_EVENTS = [

  /* ======================================================================
   * kind:"fixed" — 残りm数で必ず発火する節目(12本 / 3行まで使えるのはここだけ)
   * ==================================================================== */
  /* at:100 は「0歩目」= 本編開幕演出。最初の[進む]の前に1回だけ再生される
   * (fixed-events.md §1 / §5 タイトルロゴはこの直後) */
  { id: 'ev-fix-100', kind: 'fixed', at: 100, zone: 'far', mental: -1, fx: 'slow', tag: 'mind', tags: ['mind'],
    text: ['会社まで、あと100m。', 'まだ何も始まっていない。'] },

  { id: 'ev-fix-90', kind: 'fixed', at: 90, zone: 'far', mental: -1, tag: 'mind', tags: ['mind'],
    text: ['10m進んだ。', '90m残っている。'] },

  { id: 'ev-fix-80', kind: 'fixed', at: 80, zone: 'far', mental: -1.5, tag: 'mind', tags: ['mind'],
    text: ['5分の1が終わった。', '分数にすると、少しだけ多く聞こえる。'] },

  /* 周回するほど、会社側がこちらの行動を知っているように見える通知。 */
  { id: 'ev-fix-75', kind: 'fixed', at: 75, zone: 'far', mental: -3, fx: 'notify', tag: 'phone', tags: ['phone', 'horror'],
    text: '社内アプリから通知が来た。',
    variants: [
      ['社内アプリから通知。', '「到着予定時刻を更新しました」', '予定を入力した覚えはない。'],
      ['社内アプリから通知。', '「昨日と同じ速度です」', '昨日は休みだった。'],
      ['社内アプリから通知。', '「今回は、引き返さないでください」', '画面を閉じても、振動だけが続いた。']
    ] },

  /* 誘惑①(軽) — [立ち止まる] の意味を教えるチュートリアル。受け:+2/+20秒 断り:-1 */
  { id: 'ev-fix-70', kind: 'fixed', at: 70, zone: 'far', mental: -2, fx: 'dim', tag: 'scene', tags: ['scene'],
    text: ['バス停のベンチが空いている。', '乗る予定はない。座る理由にはなる。'],
    choices: [
      { label: '座る', reply: '30秒だけ座った。立つとき、少し重かった。', mental: 2, sec: 20 },
      { label: '座らない', reply: '通り過ぎたら、急にどうでもよくなった。', mental: 0 }
    ] },

  { id: 'ev-fix-60', kind: 'fixed', at: 60, zone: 'mid', mental: -2.5, tag: 'scene', tags: ['scene'],
    text: ['向かいの窓に、もう電気がついている。', '誰かはもう始めている。'] },

  /* 山場A: 折り返し(3行) */
  { id: 'ev-fix-50', kind: 'fixed', at: 50, zone: 'mid', mental: -4, fx: 'pulse', tag: 'mind', tags: ['mind'],
    text: ['半分。', '引き返しても、進んでも、同じ距離。', '来た道のほうが、少しだけ涼しい。'],
    choices: [
      { label: '休む理由を探す', reply: '母の体調。電車の遅延。自分ではない何か。送信欄に並べて、全部消した。', mental: 3, compliance: -10, sec: 45, sound: 'chat', flag: 'excuse_drafted' },
      { label: '何も考えず進む', reply: '考えないようにするには、考えないことを考え続ける必要があった。', mental: -3, compliance: 12, sec: 4, fx: 'dim', sound: 'pulse', flag: 'numbed_out' },
      { label: '車道を横切る', className: 'g-choice--forbidden', reply: '信号までは遠い。会社は、すぐ向こうにある。', mental: -10, compliance: -30, sec: 2, fx: 'shake', ending: 'ending-accident-road' }
    ] },

  /* 誘惑②(中) — 本命。受け:+3/+40秒 断り:-1 */
  { id: 'ev-fix-40', kind: 'fixed', at: 40, zone: 'mid', mental: -2, fx: 'dim', tag: 'scene', tags: ['scene'],
    text: ['自販機。', '買う理由はない。立ち止まる理由にはなる。'],
    choices: [
      { label: '買う', reply: '一口で半分減った。残りは、席で温くなる。', mental: 3, compliance: -4, sec: 40 },
      { label: '買わない', reply: '買う金はある。飲む時間がない。', mental: 0, compliance: 5 }
    ] },

  { id: 'ev-fix-30', kind: 'fixed', at: 30, zone: 'near', mental: -2.5, tag: 'scene', tags: ['scene'],
    text: ['喫煙所の灰皿の数まで見える。', '3つだった。'] },

  /* 50mの選択が、忘れた頃に現実側から返ってくる。 */
  { id: 'ev-consequence-excuse', kind: 'fixed', at: 25, zone: 'near', requires: 'excuse_drafted', mental: -6, fx: 'glitch', sound: 'chat', tag: 'horror', tags: ['phone', 'horror'],
    text: ['母からメッセージ。', '「体調は大丈夫。会社にはそう伝えておいたよ」', '送っていない文章が、送信済みになっている。'],
    choices: [
      { label: '履歴を消す', reply: '消えたのは履歴だけだった。母の既読は残った。', mental: -2, sec: 12, fx: 'glitch' },
      { label: 'スマホを伏せる', reply: 'ポケットの中で、自分の声が欠勤理由を読み上げた。', mental: -4, sec: 3, sound: 'pulse' }
    ] },

  { id: 'ev-consequence-numb', kind: 'fixed', at: 25, zone: 'near', requires: 'numbed_out', mental: -5, fx: 'pulse', tag: 'horror', tags: ['mind', 'horror'],
    text: ['足音が一人分多い。', '止まると止まる。振り返ると、自分だけがまだ歩いている。'],
    choices: [
      { label: '歩幅を合わせる', reply: '後ろの足音は消えた。今度は、自分の足音が聞こえない。', mental: -3, sec: 8, sound: 'pulse' },
      { label: '走る', reply: '会社のドアも、同じ速さで遠ざかった。', mental: -5, sec: 18, fx: 'shake' }
    ] },

  /* 山場B: 距離が消える */
  { id: 'ev-fix-20', kind: 'fixed', at: 20, zone: 'near', mental: -3.5, fx: 'shake', sound: 'pulse', tag: 'scene', tags: ['scene'],
    text: ['エントランスの床の目地が数えられる。', '距離が、歩数に変わった。', '息を吸う場所が、わからない。'],
    choices: [
      { label: '四秒吸って、七秒止める', reply: '七秒目で、心臓だけが先に会社へ入った。', mental: 4, compliance: -5, sec: 35, sound: 'pulse' },
      { label: '平気な顔を作る', reply: '顔は作れた。中に入る人がいなかった。', mental: -4, compliance: 9, sec: 3, fx: 'glitch', sound: 'pulse' },
      { label: '目を閉じたまま走る', className: 'g-choice--forbidden', reply: '入口まで、まっすぐのはずだった。', mental: -12, compliance: 15, sec: 5, fx: 'shake', ending: 'ending-accident-glass' }
    ] },

  /* 誘惑③(重) — 最後の猶予。受け:+5/+60秒 断り:-2 */
  { id: 'ev-fix-10', kind: 'fixed', at: 10, zone: 'near', mental: -3, fx: 'slow', tag: 'mind', tags: ['mind'],
    text: ['ロゴの下を通る。', '毎朝、この下を通っている。'],
    choices: [
      { label: 'ここで止まる', reply: '1分立っていた。まだ引き返せる場所だった。', mental: 5, compliance: -6, sec: 60 },
      { label: '止まらない', reply: '止まったら、もう動けない気がした。', mental: 0, compliance: 10 }
    ] },

  { id: 'ev-fix-5', kind: 'fixed', at: 5, zone: 'near', mental: -3, fx: 'dim', tag: 'scene', tags: ['scene'],
    text: ['センサーの反応範囲は、たしかこの辺から。'] },

  /* 山場C: 最終(3行) */
  { id: 'ev-fix-1', kind: 'fixed', at: 1, zone: 'near', mental: -5, fx: 'slow', tag: 'mind', tags: ['mind'],
    text: ['あと1m。', 'ここから先は、今日だ。', 'ドアが、先に開いた。'] },

  /* ======================================================================
   * kind:"pool" — 1プレイ1回だけ出る主力(72本)
   * ==================================================================== */

  /* ---------- people : 同僚・すれ違い(15本) ---------- */
  { id: 'ev-ppl-01', tag: 'people', tags: ['people'], zone: 'near', mental: -1, weight: 15,
    text: ['前を歩いているのが同僚の後頭部だと気づく。', '追い抜けば会話が始まる。歩幅を落とす。'] },

  { id: 'ev-ppl-02', tag: 'people', tags: ['people'], zone: 'near', mental: -0.5, weight: 12,
    text: '自動ドアの前で、部長と同時になった。',
    choices: [
      { label: 'お先にどうぞ', reply: '「いえいえ」が返ってきた。膠着。', mental: -3, sec: 12 },
      { label: '先に入る', reply: '背中に視線を感じながら歩く。', mental: -2, sec: 4 },
      { label: '靴紐を直す', reply: '結び直す紐が、スリッポンにはない。', mental: -1, sec: 8 }
    ] },

  { id: 'ev-ppl-03', tag: 'people', tags: ['people'], zone: 'mid', mental: -0.5, weight: 12,
    text: ['営業の人が今日も「おはようございます！」と言った。', '誰にでも言う。今日も元気だ。'] },

  { id: 'ev-ppl-04', tag: 'people', tags: ['people'], zone: 'far', mental: -0.5, weight: 12,
    text: ['向かいのビルから出てきた人が、駅へ走っていく。', 'あっち側に行きたい。'] },

  { id: 'ev-ppl-05', tag: 'people', tags: ['people'], zone: 'mid', mental: -0.5, weight: 14,
    text: ['経理の人と目が合った。会釈が3m早すぎた。', '残り3mを、無言で詰める。'] },

  { id: 'ev-ppl-06', tag: 'people', tags: ['people'], zone: 'mid', mental: -0.5, weight: 10,
    text: ['隣の課の新人が、まだ楽しそうに出社している。', '「あと半年」と思ってしまった。'] },

  { id: 'ev-ppl-07', tag: 'people', tags: ['people'], zone: 'mid', mental: -0.5, weight: 10,
    text: ['交差点で他社のスーツが3人合流した。', '全員が同じ方向へ歩き出す。'] },

  { id: 'ev-ppl-08', tag: 'people', tags: ['people'], zone: 'near', mental: -0.5, weight: 14,
    text: ['後ろから「おはよう」。', '振り返るまでの0.5秒で、声の主を当てる。'],
    choices: [
      { label: 'おはようございます', reply: '声が裏返った。', mental: -3, sec: 8 },
      { label: '会釈だけ', reply: '向こうも会釈だけだった。', mental: -1, sec: 3 },
      { label: '聞こえなかった', reply: '3歩あとで、もう一度呼ばれた。', mental: -2, sec: 6 }
    ] },

  { id: 'ev-ppl-09', tag: 'people', tags: ['people'], zone: 'near', mental: -0.5, weight: 10,
    text: ['喫煙所の前を通る。', 'あそこにいる人だけ、始業時刻から外れて見える。'] },

  { id: 'ev-ppl-10', tag: 'people', tags: ['people'], zone: 'mid', mental: -0.5, weight: 12,
    text: ['同期が向こうから歩いてくる。', 'まだ気づかれていない。'],
    choices: [
      { label: '手を上げる', reply: '角度が中途半端で、途中で下ろした。', mental: -2, sec: 5 },
      { label: '道を渡る', reply: '信号は赤だった。立ち止まる。', mental: -1, sec: 20 },
      { label: 'そのまま歩く', reply: 'すれ違いざま、同時に会釈した。', mental: -1, sec: 3 }
    ] },

  { id: 'ev-ppl-11', tag: 'people', tags: ['people'], zone: 'mid', mental: 2, weight: 6,
    text: ['すれ違った同僚の顔が、自分よりだいぶ死んでいた。', '歩幅が少しだけ戻った。'] },

  { id: 'ev-ppl-12', tag: 'people', tags: ['people'], zone: 'far', mental: -0.5, weight: 10,
    text: ['保育園の前で、登園を全力で拒否している子がいる。', '言語化できているだけ立派だ。'] },

  { id: 'ev-ppl-13', tag: 'people', tags: ['people'], zone: 'far', mental: -0.5, weight: 10,
    text: ['散歩中の犬とすれ違う。', '犬のほうが目的を持って歩いている。'] },

  { id: 'ev-ppl-14', tag: 'people', tags: ['people'], zone: 'near', mental: -0.5, weight: 10,
    text: ['警備員に会釈する。', 'この人だけは毎朝ちゃんと笑う。'] },

  { id: 'ev-ppl-15', tag: 'people', tags: ['people'], zone: 'mid', mental: -0.5, weight: 10,
    text: ['前の人が急に立ち止まった。ぶつかりかけた。', '謝ったのはこっちだった。'] },

  /* ---------- phone : 通知・チャット(14本) ---------- */
  { id: 'ev-phn-01', tag: 'phone', tags: ['phone'], zone: 'far', mental: -0.5, weight: 14, fx: 'notify',
    text: ['ポケットが震えた。', '見なくてもわかる。部署のグループだ。'] },

  { id: 'ev-phn-02', tag: 'phone', tags: ['phone'], zone: 'mid', mental: -2.5, weight: 16, fx: 'notify',
    text: ['未読が31になった。', 'さっきは27だった。'] },

  { id: 'ev-phn-03', tag: 'phone', tags: ['phone'], zone: 'mid', mental: -1, weight: 14, fx: 'notify',
    text: '「朝イチでちょっと相談したいことが」',
    choices: [
      { label: '既読をつける', reply: '「…」が出た。今、打っている。', mental: -3, sec: 10 },
      { label: '通知だけ読む', reply: '続きが1行、通知欄に切れて残った。', mental: -2, sec: 4 },
      { label: '画面を伏せる', reply: '伏せても、震えは伝わる。', mental: -1, sec: 3 }
    ] },

  { id: 'ev-phn-04', tag: 'phone', tags: ['phone'], zone: 'far', mental: -0.5, weight: 12,
    text: ['昨夜23時のメール。', '今、気づいたことにする。'] },

  { id: 'ev-phn-05', tag: 'phone', tags: ['phone'], zone: 'near', mental: -0.5, weight: 14, fx: 'notify',
    text: ['カレンダーの通知。9:30 定例。', 'あと少し歩けば、間に合ってしまう。'] },

  { id: 'ev-phn-06', tag: 'phone', tags: ['phone'], zone: 'far', mental: -0.5, weight: 10,
    text: ['スマホを開いた。', '開いた理由を忘れて、閉じた。'] },

  { id: 'ev-phn-07', tag: 'phone', tags: ['phone'], zone: 'mid', mental: -0.5, weight: 12,
    text: ['「@here」で始まっている。', '全員宛だから自分宛ではない。そう思うことにする。'] },

  { id: 'ev-phn-08', tag: 'phone', tags: ['phone'], zone: 'far', mental: -0.5, weight: 12,
    text: ['天気アプリ。最高気温38度。', '時刻は8時46分。'] },

  { id: 'ev-phn-09', tag: 'phone', tags: ['phone'], zone: 'mid', mental: -0.5, weight: 12,
    text: ['上司の返信がスタンプ一つ。', '意味を10秒考えて、答えが出なかった。'] },

  { id: 'ev-phn-10', tag: 'phone', tags: ['phone'], zone: 'far', mental: -0.5, weight: 8,
    text: ['歩数計が「昨日より活動的です」と褒めてきた。', '昨日は寝ていた。'] },

  { id: 'ev-phn-11', tag: 'phone', tags: ['phone'], zone: 'mid', mental: -2, weight: 14,
    text: ['社内通知「夏季休暇取得状況のご確認」。', 'もう終わったものを、確認させないでほしい。'] },

  { id: 'ev-phn-12', tag: 'phone', tags: ['phone'], zone: 'far', mental: -0.5, weight: 10,
    text: ['充電18%。', '今日を持たせる算段のほうを、先に立てている。'] },

  { id: 'ev-phn-13', tag: 'phone', tags: ['phone'], zone: 'near', mental: -0.5, weight: 10,
    text: ['母から「お盆はよかったね」。', '返信を後回しにする。'] },

  { id: 'ev-phn-14', tag: 'phone', tags: ['phone'], zone: 'far', mental: -0.5, weight: 10, fx: 'alarm',
    text: ['止め忘れたアラームが鳴り出した。', '道の真ん中で、家の音がする。'] },

  /* ---------- body : 暑さ・汗・眠気(14本) ---------- */
  { id: 'ev-bdy-01', tag: 'body', tags: ['body'], zone: 'mid', mental: -1, weight: 14,
    text: ['シャツが、もう体の形になっている。', '着く前に一度、乾かしたい。'] },

  { id: 'ev-bdy-02', tag: 'body', tags: ['body'], zone: 'far', mental: -0.5, weight: 12,
    text: 'アスファルトの照り返しが、足首から上がってくる。' },

  { id: 'ev-bdy-03', tag: 'body', tags: ['body'], zone: 'mid', mental: -0.5, weight: 14,
    text: ['まばたきが長い。', '3回に1回、意識が飛んでいる。'] },

  { id: 'ev-bdy-04', tag: 'body', tags: ['body'], zone: 'mid', mental: -0.5, weight: 12,
    text: '汗が眉を越えて目に入った。しみる。',
    choices: [
      { label: '立ち止まって拭く', reply: '拭いた先から、また出てきた。', mental: -1, sec: 15 },
      { label: '手の甲で拭う', reply: '手の甲も濡れていた。', mental: -1, sec: 3 },
      { label: '目をつぶって歩く', reply: '3歩でやめた。', mental: -2, sec: 5 }
    ] },

  { id: 'ev-bdy-05', tag: 'body', tags: ['body'], zone: 'far', mental: -0.5, weight: 12,
    text: ['首の後ろに日光が当たり続けている。', '太陽は真面目だ。'] },

  { id: 'ev-bdy-06', tag: 'body', tags: ['body'], zone: 'mid', mental: -0.5, weight: 10,
    text: ['寝落ちのせいで首が回らない。', '左半分の世界だけ見て歩く。'] },

  { id: 'ev-bdy-07', tag: 'body', tags: ['body'], zone: 'mid', mental: -0.5, weight: 12,
    text: '靴の中で、指の間が濡れている。' },

  { id: 'ev-bdy-08', tag: 'body', tags: ['body'], zone: 'near', mental: -0.5, weight: 10,
    text: ['肩紐が同じ場所に食い込む。', '掛け替えても、5歩で同じになる。'] },

  { id: 'ev-bdy-09', tag: 'body', tags: ['body'], zone: 'near', mental: -2, weight: 14,
    text: ['心臓の音が耳の内側で鳴っている。', 'まだ100mも歩いていない。'] },

  { id: 'ev-bdy-10', tag: 'body', tags: ['body'], zone: 'far', mental: -0.5, weight: 10,
    text: ['あくびを噛み殺した。', '誰も見ていないのに噛み殺した。'] },

  { id: 'ev-bdy-11', tag: 'body', tags: ['body'], zone: 'near', mental: 2, weight: 6,
    text: ['風が抜けた。汗が引く。', '外にいる理由が、一瞬だけできた。'] },

  { id: 'ev-bdy-12', tag: 'body', tags: ['body'], zone: 'mid', mental: -0.5, weight: 12, fx: 'dim',
    text: ['汗が背中を一本だけ流れた。', '経路が全部わかる。'] },

  { id: 'ev-bdy-13', tag: 'body', tags: ['body'], zone: 'near', mental: -0.5, weight: 10,
    text: ['胃が重い。', '何も食べていないのに重い。'] },

  { id: 'ev-bdy-14', tag: 'body', tags: ['body'], zone: 'near', mental: -0.5, weight: 12,
    text: ['足が「進む」以外のことをしない。', 'もう任せてある。'] },

  /* ---------- mind : 内省(14本) ---------- */
  { id: 'ev-mnd-01', tag: 'mind', tags: ['mind'], zone: 'far', mental: -0.5, weight: 14, fx: 'dim',
    text: ['「今日を乗り切れば」と考える。', '今年これで何回目かは、数えない。'] },

  { id: 'ev-mnd-02', tag: 'mind', tags: ['mind'], zone: 'mid', mental: -2, weight: 14,
    text: ['有給の残日数を思い出した。', '使う予定は一つもない。'] },

  { id: 'ev-mnd-03', tag: 'mind', tags: ['mind'], zone: 'mid', mental: -2.5, weight: 12, fx: 'slow',
    text: ['定年まで、あと何回この道を歩くのか。', '割り算を始めて、やめた。'] },

  { id: 'ev-mnd-04', tag: 'mind', tags: ['mind'], zone: 'far', mental: -2.5, weight: 12, fx: 'slow',
    text: ['「行きたくない」と「行かないわけにはいかない」。', 'その間に、道が100mある。'] },

  { id: 'ev-mnd-05', tag: 'mind', tags: ['mind'], zone: 'mid', mental: -0.5, weight: 12,
    text: ['転職サイトのタブを3週間開いている。', '開いているだけ。'] },

  { id: 'ev-mnd-06', tag: 'mind', tags: ['mind'], zone: 'near', mental: -2, weight: 12,
    text: 'ここで倒れたら、今日いちばん丁寧に扱ってもらえる。' },

  { id: 'ev-mnd-07', tag: 'mind', tags: ['mind'], zone: 'far', mental: -0.5, weight: 12, fx: 'dim',
    text: ['お盆の記憶がもう遠い。', '実家の畳の匂いだけ残っている。'] },

  { id: 'ev-mnd-08', tag: 'mind', tags: ['mind'], zone: 'far', mental: -0.5, weight: 10,
    text: ['昼に何を食べるか真剣に考える。', '今日はじめて、前を向いた。'] },

  { id: 'ev-mnd-09', tag: 'mind', tags: ['mind'], zone: 'near', mental: -2.5, weight: 12, fx: 'slow',
    text: ['自分がいなくても仕事は回る。', '回るのに、行かなければならない。'] },

  { id: 'ev-mnd-10', tag: 'mind', tags: ['mind'], zone: 'mid', mental: -2, weight: 12,
    text: ['5年前の自分に今の話をしたら、普通に受け入れる。', 'それが一番こたえる。'] },

  { id: 'ev-mnd-11', tag: 'mind', tags: ['mind'], zone: 'near', mental: 2, weight: 6,
    text: ['イヤホンから好きな曲のイントロ。', '残りが、少しだけ短くなった。'] },

  { id: 'ev-mnd-12', tag: 'mind', tags: ['mind'], zone: 'far', mental: -0.5, weight: 12,
    text: '休む理由を3つ考えた。',
    choices: [
      { label: '体調不良', reply: '嘘が下手なのは、自分がよく知っている。', mental: -2, sec: 6 },
      { label: '家庭の事情', reply: '事情のある家庭が、うちにはない。', mental: -2, sec: 6 },
      { label: '全部却下', reply: '自分で却下した。手際がいい。', mental: -1, sec: 4 }
    ] },

  { id: 'ev-mnd-13', tag: 'mind', tags: ['mind'], zone: 'near', mental: -0.5, weight: 10,
    text: ['入口をゴールと呼ぶかスタートと呼ぶかで揉めている。', '自分の中で。'] },

  { id: 'ev-mnd-14', tag: 'mind', tags: ['mind'], zone: 'near', mental: -1, weight: 12,
    text: ['今日やることを頭の中で並べた。', '並べただけで一日ぶん疲れた。'] },

  /* ---------- scene : 景色・信号・自販機(15本) ---------- */
  { id: 'ev-scn-01', tag: 'scene', tags: ['scene'], zone: 'far', mental: -0.5, weight: 12,
    text: ['信号が青になった。', '渡らなくていいのに、体が渡ろうとする。'] },

  /* 旧 ev-fix-70。fixed-events.md §6-5 により pool へ移設(zone:far / weight:12) */
  { id: 'ev-scn-16', tag: 'scene', tags: ['scene'], zone: 'far', mental: -0.5, weight: 12,
    text: ['歩道のタイルの色が変わった。', '所有者が変わったのがわかる。'] },

  /* 旧 ev-fix-40。fixed-events.md §6-5 により pool へ移設(zone:mid / weight:12)
   * ※もとの自販機イベント ev-scn-02 は ev-fix-40 の誘惑②とネタが重複するため削除した */
  { id: 'ev-scn-17', tag: 'scene', tags: ['scene'], zone: 'mid', mental: -0.5, weight: 12,
    text: ['遠くでドアが開いて、閉じた。', '人が1人、吸い込まれた。'] },

  { id: 'ev-scn-03', tag: 'scene', tags: ['scene'], zone: 'mid', mental: -0.5, weight: 12,
    text: ['ビルのガラスに、思っていたより猫背の人がいた。', '自分だった。'] },

  { id: 'ev-scn-04', tag: 'scene', tags: ['scene'], zone: 'near', mental: -0.5, weight: 10,
    text: '点字ブロックの継ぎ目を、いつのまにか数えている。' },

  { id: 'ev-scn-05', tag: 'scene', tags: ['scene'], zone: 'far', mental: -0.5, weight: 12,
    text: ['コンビニの自動ドアが開いて、冷気が漏れた。', '誘われている。'],
    choices: [
      { label: '入る', reply: '5分いた。何も買わなかった。', mental: -1, sec: 300 },
      { label: '前で立ち止まる', reply: 'ドアが2回開いて、2回閉じた。', mental: -1, sec: 20 },
      { label: '通り過ぎる', reply: '冷気は、すぐ後ろで途切れた。', mental: -1, sec: 2 }
    ] },

  { id: 'ev-scn-06', tag: 'scene', tags: ['scene'], zone: 'far', mental: -0.5, weight: 8,
    text: 'マンホールの上だけ、少し熱い気がする。' },

  { id: 'ev-scn-07', tag: 'scene', tags: ['scene'], zone: 'near', mental: -0.5, weight: 10,
    text: ['昨日と同じ場所に、同じ自転車が停まっている。', 'あれは誰の生活なんだろう。'] },

  { id: 'ev-scn-08', tag: 'scene', tags: ['scene'], zone: 'near', mental: -0.5, weight: 12,
    text: ['工事の看板の人形が、律儀に頭を下げ続けている。', 'あれは休憩しない。'] },

  { id: 'ev-scn-09', tag: 'scene', tags: ['scene'], zone: 'near', mental: -2.5, weight: 14,
    text: ['入口が見えた。', '近づいているのに、近づいた気がしない。'] },

  { id: 'ev-scn-10', tag: 'scene', tags: ['scene'], zone: 'near', mental: -0.5, weight: 12,
    text: ['空を見上げた。雲一つない。', '逃げ場としての雨は、今日も来ない。'] },

  { id: 'ev-scn-11', tag: 'scene', tags: ['scene'], zone: 'far', mental: 3, weight: 5,
    text: ['塀の上に猫がいる。目が合う。', '逃げない。'] },

  { id: 'ev-scn-12', tag: 'scene', tags: ['scene'], zone: 'far', mental: 2, weight: 5,
    text: ['蝉が一斉に鳴き止んだ。', '3秒だけ、夏が静かになる。'] },

  { id: 'ev-scn-13', tag: 'scene', tags: ['scene'], zone: 'far', mental: -0.5, weight: 10,
    text: ['街路樹の下に入った。', '日陰は3歩ぶんしかなかった。'] },

  { id: 'ev-scn-14', tag: 'scene', tags: ['scene'], zone: 'near', mental: -0.5, weight: 10,
    text: ['歩道の端に社員証が落ちている。', '拾わずに通り過ぎる自分に気づく。'] },

  { id: 'ev-scn-15', tag: 'scene', tags: ['scene'], zone: 'mid', mental: -1, weight: 12,
    text: ['カーブミラーに、自分と背後の道が一緒に映った。', '戻れる距離が、目盛りみたいに見える。'] },

  /* ======================================================================
   * kind:"filler" — pool が尽きたら再利用される1行(20本)
   * ==================================================================== */
  { id: 'ev-f-01', kind: 'filler', mental: -0.5, weight: 8, tag: 'scene', tags: ['scene'], text: 'アスファルトが白い。' },
  { id: 'ev-f-02', kind: 'filler', mental: -0.5, weight: 8, tag: 'scene', tags: ['scene'], text: '蝉の音が、一段大きくなった。' },
  { id: 'ev-f-03', kind: 'filler', mental: -0.5, weight: 8, tag: 'scene', tags: ['scene'], text: '影が短い。' },
  { id: 'ev-f-04', kind: 'filler', mental: -0.5, weight: 8, tag: 'body', tags: ['body'], text: '風がない。' },
  { id: 'ev-f-05', kind: 'filler', mental: -0.5, weight: 8, tag: 'body', tags: ['body'], text: '足の裏が熱い。' },
  { id: 'ev-f-06', kind: 'filler', mental: -0.5, weight: 6, tag: 'people', tags: ['people'], text: '誰かのイヤホンが漏れている。' },
  { id: 'ev-f-07', kind: 'filler', mental: -0.5, weight: 6, tag: 'scene', tags: ['scene'], text: '遠くで踏切が鳴っている。' },
  { id: 'ev-f-08', kind: 'filler', mental: -0.5, weight: 8, tag: 'body', tags: ['body'], text: '汗を拭く。すぐ出る。' },
  { id: 'ev-f-09', kind: 'filler', mental: -0.5, weight: 6, tag: 'people', tags: ['people'], text: '前の人のスーツも、背中が濡れている。' },
  { id: 'ev-f-10', kind: 'filler', mental: -0.5, weight: 6, tag: 'scene', tags: ['scene'], text: '路肩に空き缶がひとつ。' },
  { id: 'ev-f-11', kind: 'filler', mental: -0.5, weight: 6, tag: 'scene', tags: ['scene'], text: '横断歩道の白線が剥げている。' },
  { id: 'ev-f-12', kind: 'filler', mental: -0.5, weight: 6, tag: 'people', tags: ['people'], text: '信号待ちの列が伸びた。' },
  { id: 'ev-f-13', kind: 'filler', mental: -0.5, weight: 5, tag: 'scene', tags: ['scene'], text: '救急車のサイレンが遠ざかる。' },
  { id: 'ev-f-14', kind: 'filler', mental: -0.5, weight: 6, tag: 'people', tags: ['people'], text: '自転車がすり抜けていった。' },
  { id: 'ev-f-15', kind: 'filler', mental: -0.5, weight: 5, tag: 'scene', tags: ['scene'], text: '街路樹の根が歩道を持ち上げている。' },
  { id: 'ev-f-16', kind: 'filler', mental: -0.5, weight: 8, tag: 'body', tags: ['body'], text: '室外機が熱風を吐いている。' },
  { id: 'ev-f-17', kind: 'filler', mental: -0.5, weight: 5, tag: 'scene', tags: ['scene'], text: '鳩がどかない。' },
  { id: 'ev-f-18', kind: 'filler', mental: -0.5, weight: 5, tag: 'scene', tags: ['scene'], text: 'カラスがゴミ袋をつついている。' },
  { id: 'ev-f-19', kind: 'filler', mental: -0.5, weight: 6, tag: 'scene', tags: ['scene'], text: '蝉の死骸をよけた。' },
  { id: 'ev-f-20', kind: 'filler', mental: -0.5, weight: 6, tag: 'mind', tags: ['mind'], text: '靴音が自分のだと気づく。' }

];
