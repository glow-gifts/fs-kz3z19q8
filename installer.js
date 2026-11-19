/* ファスティング ステップ配信 かんたん登録（エルメの画面で動く） */
(function () {
  var BASE = 'https://glow-gifts.github.io/fs-kz3z19q8/';
  if (document.getElementById('fsx-panel')) return;

  if (location.host !== 'step.lme.jp') {
    alert('エルメ（step.lme.jp）にログインした画面で、このボタンを押してください。');
    return;
  }
  var FORM = (window.__FS_FORM || '').trim();
  if (!/^https:\/\/(docs\.google\.com\/forms\/|forms\.gle\/)/.test(FORM)) {
    alert('GoogleフォームのURLが入っていません。もう一度、設定ページでボタンを作り直してください。');
    return;
  }
  var tokenEl = document.querySelector('meta[name=csrf-token]');
  var botEl = document.getElementById('botIdCheck');
  if (!tokenEl || !botEl || !botEl.value) {
    alert('エルメの「ステップ配信」の画面を開いてから、もう一度押してください。');
    return;
  }
  var TK = tokenEl.content, BOT = botEl.value;
  var H = { 'X-CSRF-TOKEN': TK, 'X-Requested-With': 'XMLHttpRequest' };
  var accountName = '';
  var accEl = document.querySelector('.h__dropdown-title-bot-name, .h__qr-account-name');
  if (accEl) accountName = accEl.textContent.trim();
  var DONE_KEY = 'fsx_done_' + BOT;
  var done = {};
  try { done = JSON.parse(localStorage.getItem(DONE_KEY) || '{}'); } catch (e) {}

  // ---------- 画面 ----------
  var css = '#fsx-panel{position:fixed;inset:0;z-index:2147483647;background:rgba(40,30,40,.55);display:flex;align-items:center;justify-content:center;font-family:"Hiragino Sans","Noto Sans JP",sans-serif}' +
    '#fsx-box{background:#fff;border-radius:18px;width:min(520px,92vw);padding:28px 26px;box-shadow:0 20px 60px rgba(0,0,0,.25);color:#3a2e35}' +
    '#fsx-box h2{margin:0 0 6px;font-size:20px}#fsx-box p{margin:8px 0;font-size:14px;line-height:1.7}' +
    '#fsx-box .acc{background:#fff4f7;border-radius:10px;padding:10px 12px;font-size:14px;margin:12px 0;word-break:break-all}' +
    '#fsx-box button{border:0;border-radius:999px;padding:12px 22px;font-size:15px;font-weight:700;cursor:pointer}' +
    '#fsx-go{background:#e75a87;color:#fff}#fsx-go:disabled{opacity:.5;cursor:default}#fsx-x{background:#eee;color:#555;margin-left:8px}' +
    '#fsx-bar{height:12px;background:#f3e6ec;border-radius:99px;overflow:hidden;margin:14px 0 6px}#fsx-bar i{display:block;height:100%;width:0;background:#e75a87;transition:width .2s}' +
    '#fsx-log{font-size:13px;color:#6b5a63;min-height:20px}#fsx-err{color:#c0392b;font-size:13px;white-space:pre-wrap}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  var panel = document.createElement('div'); panel.id = 'fsx-panel';
  panel.innerHTML = '<div id="fsx-box"><h2>ファスティングのステップ配信を登録します</h2>' +
    '<p>この下のLINEアカウントに、ステップ配信を13本まとめて作ります。終わるまで5〜10分くらいかかるので、この画面は閉じずに待っていてください。</p>' +
    '<div class="acc">登録先：<b id="fsx-acc"></b><br>アンケートURL：<span id="fsx-form"></span></div>' +
    '<p id="fsx-note"></p>' +
    '<div id="fsx-bar"><i></i></div><div id="fsx-log">「登録をはじめる」を押してください</div><div id="fsx-err"></div>' +
    '<div style="margin-top:16px"><button id="fsx-go">登録をはじめる</button><button id="fsx-x">閉じる</button></div></div>';
  document.body.appendChild(panel);
  document.getElementById('fsx-acc').textContent = accountName || '（アカウント名を読み取れませんでした。右上のアカウントを確認してね）';
  document.getElementById('fsx-form').textContent = FORM;
  var nDone = Object.keys(done).length;
  if (nDone) document.getElementById('fsx-note').textContent = 'このアカウントには、もう ' + nDone + ' 本登録済みです。残りだけ作ります。';
  var bar = panel.querySelector('#fsx-bar i'), log = document.getElementById('fsx-log'), errEl = document.getElementById('fsx-err');
  var go = document.getElementById('fsx-go'), closeBtn = document.getElementById('fsx-x');
  var running = false;
  closeBtn.onclick = function () {
    if (running && !window.confirm('登録の途中です。本当に閉じますか？')) return;
    panel.remove(); st.remove();
  };

  // ---------- エルメへの登録 ----------
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function post(u, params) {
    var b = new URLSearchParams(Object.assign({ _token: TK }, params));
    var r = await fetch(u, { method: 'POST', headers: Object.assign({}, H, { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' }), body: b });
    return r.json();
  }
  async function createScenario(name) {
    var r = await post('/basic/scenario/store-scenario/store', { name: name, select_folder_create: '0', botIdCurrent: BOT });
    if (!r.success) throw new Error('ステップ配信を作れませんでした：' + JSON.stringify(r).slice(0, 200));
    return r.scenarioId;
  }
  async function listSteps(sid) {
    var j = await fetch('/ajax/get-list-step-message-v3?scenario_id=' + sid + '&filter_manager_id=&page=1&per_page=100', { headers: H }).then(function (r) { return r.json(); });
    return j.step_message.data;
  }
  async function addStep(sid, idx, s) {
    var start = s.time === 'start';
    var t = start ? '0:00' : s.time.replace(/^0/, '');
    var r = await post('/ajax/scenario/save-scenario-step', { filter_manager_id: '', scenario_id: sid, id: '', index: idx, delay_type: start ? 1 : 0, start_day: s.day, start_time: t, start_minute: 0, start_second: 0, name: '' });
    if (!r.success) throw new Error('配信タイミングを作れませんでした：' + JSON.stringify(r).slice(0, 200));
  }
  var IMG = null;
  async function addMsg(gid, m) {
    var fd = new FormData();
    var base = { message_button: {}, message_media: {}, message_stamp: {}, message_location: {}, message_text: { content: '', urls: [], number_action_url_redirect: 1, use_preview_url: 1, is_shorten_url: 1 }, message_introduction: {}, template_group_id: String(gid), template_child_id: '', tmp_name: '', action_type: 'scenario', broadcastId: '', scheduleSendId: '', conversationId: '', content: '', address: '', latitude: '', longitude: '' };
    var data;
    if (m.type === 'text') {
      var text = m.text.split('【Googleフォーム】').join(FORM).split('【グーグルフォーム】').join(FORM);
      data = Object.assign({}, base, { type: 'text', message_text: Object.assign({}, base.message_text, { content: text }) });
      fd.append('data', JSON.stringify(data)); fd.append('file_media', '');
    } else {
      data = Object.assign({}, base, { type: 'media', message_media: { type_media: 'image', file_media: {}, img_path: URL.createObjectURL(IMG), thumbnail_path: '', type_size: 'large', is_setting_image_map: 0, is_original_aspect_ratio: 1, is_setting_img_map_manually: 1, image_map: { template_id: '', img_width: '', img_height: '', img_alt: '', img_map_type: '' }, imageMapItems: [], text_video: '', action_id_video: '' } });
      fd.append('data', JSON.stringify(data)); fd.append('file_media', IMG, IMG.name);
    }
    [['thumbnail_media', ''], ['action_type', 'scenario'], ['templateName', ''], ['folderId', '0'], ['template_group_scenario', ''], ['is_new', '1'], ['is_clone', ''], ['_token', TK]].forEach(function (kv) { fd.append(kv[0], kv[1]); });
    var r = await fetch('/ajax/template-v2/save-template', { method: 'POST', headers: H, body: fd }).then(function (r) { return r.json(); });
    if (!r.success) throw new Error('メッセージを保存できませんでした：' + JSON.stringify(r).slice(0, 200));
  }

  go.onclick = async function () {
    go.disabled = true; running = true; errEl.textContent = '';
    var current = null;
    try {
      log.textContent = '配信文を読み込み中…';
      var DATA = await fetch(BASE + 'data.json?v=' + Date.now()).then(function (r) { return r.json(); });
      var blob = await fetch(BASE + 'm.jpg').then(function (r) { return r.blob(); });
      IMG = new File([blob], 'magohayasashiiwa.jpg', { type: 'image/jpeg' });
      var total = 0, count = 0;
      DATA.forEach(function (sc) { if (!done[sc.name]) sc.steps.forEach(function (s) { total += s.msgs.length; }); });
      if (!total) { log.textContent = '13本とも登録済みです 🎉'; bar.style.width = '100%'; running = false; return; }
      for (var i = 0; i < DATA.length; i++) {
        var sc = DATA[i];
        if (done[sc.name]) continue;
        log.textContent = '（' + (i + 1) + '/13）「' + sc.name + '」を作成中…';
        var sid = await createScenario(sc.name);
        current = { name: sc.name, id: sid };
        for (var k = 0; k < sc.steps.length; k++) { await addStep(sid, k, sc.steps[k]); await sleep(80); }
        var list = await listSteps(sid);
        if (list.length !== sc.steps.length) throw new Error('配信タイミングの数が合いません（' + list.length + '/' + sc.steps.length + '）');
        for (var s = 0; s < list.length; s++) {
          var want = sc.steps[s], got = list[s];
          if (Number(got.delay_type) !== (want.time === 'start' ? 1 : 0) || Number(got.start_day) !== want.day) throw new Error('配信タイミングの順番が合いません（' + (s + 1) + '番目）');
          for (var m = 0; m < want.msgs.length; m++) {
            await addMsg(got.id, want.msgs[m]);
            count++; bar.style.width = Math.round(count / total * 100) + '%';
            log.textContent = '（' + (i + 1) + '/13）「' + sc.name + '」 ' + count + ' / ' + total + ' 通';
            await sleep(80);
          }
        }
        done[sc.name] = sid; current = null;
        try { localStorage.setItem(DONE_KEY, JSON.stringify(done)); } catch (e) {}
      }
      bar.style.width = '100%';
      log.innerHTML = '';
      log.textContent = 'ぜんぶ完了しました 🎉 「ステップ配信」の一覧に「クロードコード_」で始まるものが13本あります。';
      go.style.display = 'none'; closeBtn.textContent = '閉じて一覧を見る';
      closeBtn.onclick = function () { location.href = '/basic/scenario'; };
    } catch (e) {
      var msg = '止まってしまいました：' + (e && e.message ? e.message : e);
      if (current) msg += '\n\n途中まで作った「' + current.name + '」は、ステップ配信の一覧から削除してください。そのあと、もう一度ボタンを押すと続きから作ります（できあがった分は作り直しません）。';
      else msg += '\n\nもう一度ボタンを押すと、続きから作ります。';
      errEl.textContent = msg; log.textContent = '';
      go.disabled = false; go.textContent = 'もう一度ためす';
    }
    running = false;
  };
})();
