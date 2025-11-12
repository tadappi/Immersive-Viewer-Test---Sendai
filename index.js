/*
 * Marzipano hotspot: pin anchored to bottom-center (no drift) + unified size + balanced tab timing
 */
'use strict';

(function() {
  var Marzipano = window.Marzipano;
  var data = window.APP_DATA;

  var panoElement = document.querySelector('#pano');
  var autorotateToggleElement = document.querySelector('#autorotateToggle');
  var sceneListToggleElement = document.querySelector('#sceneListToggle');
  var sceneListElement = document.querySelector('#sceneList');

  // ====== 一元サイズ設定 ======
  // ピン画像(※info.png)の見た目サイズ。ここだけ変えればOK
  var HOTSPOT_SIZE = 60;     // px
  var LABEL_GAP    = 0;     // ピン右側のラベルまでの隙間(px)

  // ====== Viewer ======
  var viewer = new Marzipano.Viewer(panoElement, {
    controls: { mouseViewMode: data.settings.mouseViewMode }
  });

  // ====== Scenes ======
  var scenes = data.scenes.map(function(sceneData) {
    var source = Marzipano.ImageUrlSource.fromString(
      "tiles/" + sceneData.id + "/{z}/{f}/{y}/{x}.jpg",
      { cubeMapPreviewUrl: "tiles/" + sceneData.id + "/preview.jpg" }
    );
    var geometry = new Marzipano.CubeGeometry(sceneData.levels);
    var limiter  = Marzipano.RectilinearView.limit.traditional(
      sceneData.faceSize, 100*Math.PI/180, 120*Math.PI/180
    );
    var view  = new Marzipano.RectilinearView(sceneData.initialViewParameters, limiter);
    var scene = viewer.createScene({ source, geometry, view, pinFirstLevel: true });

    // ----- infoHotspots -----
    sceneData.infoHotspots.forEach(function(hs) {
      // ルート（Marzipanoがスクリーン座標を当てる要素）
      var root = document.createElement('div');
      // 独自クラス（既存CSSの副作用を避ける）
      root.classList.add('iv-hotspot-root');

      // ☆アンカー要素：ここで「下中央」を基準に固定（ズレ防止の肝）
      var anchor = document.createElement('div');
      anchor.classList.add('iv-pin-anchor');
      // 重要：アンカーは self transform。ライブラリの transform と干渉しない
      anchor.style.position = 'absolute';
      anchor.style.left = '0';
      anchor.style.top  = '0';
      anchor.style.transform = 'translate(-50%, -100%)'; // 下中央を基準点に
      anchor.style.zIndex = '10';

      // 半透明の丸い下地（好みで）
      var bg = document.createElement('div');
      bg.style.width = HOTSPOT_SIZE + 'px';
      bg.style.height = HOTSPOT_SIZE + 'px';
      bg.style.borderRadius = '50%';
      bg.style.background = 'rgba(0,0,0,0.30)';
      bg.style.display = 'flex';
      bg.style.alignItems = 'center';
      bg.style.justifyContent = 'center';
      bg.style.backdropFilter = 'saturate(120%)'; // 任意
      // クリックをルートへバブリングさせる
      bg.style.pointerEvents = 'none';

      // ピン画像
      var img = document.createElement('img');
      img.src = 'img/info.png';
      img.alt = '';
      img.style.width  = '90%';
      img.style.height = '90%';
      img.style.objectFit = 'contain';
      img.style.pointerEvents = 'none';

      bg.appendChild(img);
      anchor.appendChild(bg);
      root.appendChild(anchor);

      // ラベル（横展開）
      var label = document.createElement('div');
      label.classList.add('iv-label');
      label.innerHTML = hs.title || '';
      // ラベルの見た目をJSで完結
      label.style.position = 'absolute';
      label.style.left = (HOTSPOT_SIZE + LABEL_GAP) + 'px';
      label.style.top  = '0';
      label.style.transform = 'translateY(-100%)'; // ピンの“頭”と揃える（好みで -50% にしてもOK）
      label.style.whiteSpace = 'nowrap';
      label.style.color = '#fff';
      label.style.background = 'rgba(0,0,0,0.6)';
      label.style.padding = '6px 10px';
      label.style.borderRadius = '6px';
      label.style.fontSize = '15px';
      label.style.opacity = '0';
      label.style.transition = 'all .25s ease';
      label.style.pointerEvents = 'none';
      label.style.zIndex = '9';

      root.appendChild(label);

      // ホバーでラベル表示（タッチはクリックで代替）
      root.addEventListener('mouseenter', function(){ label.style.opacity = '1'; label.style.transform = 'translateY(-100%) translateX(0)'; });
      root.addEventListener('mouseleave', function(){ label.style.opacity = '0'; label.style.transform = 'translateY(-100%) translateX(-8px)'; });

      // ----- クリック：寄る → 空タブ → URL投入 → 戻る -----
      // hs.text 内の最初の <a href> を抽出（内部/外部どちらでもOK）
      var linkHref = null;
      try {
        var tmp = document.createElement('div');
        tmp.innerHTML = hs.text || '';
        var a = tmp.querySelector('a[href]');
        if (a) linkHref = a.href;
      } catch(e) {}

      root.addEventListener('click', function(ev) {
        ev.stopPropagation();
        if (!linkHref) return;
        stopAutorotate();

        var before = view.parameters();
        var target = { yaw: hs.yaw, pitch: hs.pitch, fov: Math.PI/6 };
        var newWin = null;

        // ズームイン
        animateView(view, before, target, 1000);

        // Safari/Chrome：ユーザー操作から1秒以内に空タブ
        setTimeout(function(){
          try { newWin = window.open('', '_blank'); } catch(e) {}
        }, 900);

        // URL投入 → 戻る
        setTimeout(function(){
          if (newWin) newWin.location.href = linkHref;
          else window.open(linkHref, '_blank');

          animateView(view, view.parameters(), before, 1000, startAutorotate);
        }, 1500);
      }, { passive: true });

      // ホットスポット設置（Marzipano が root の位置を管理）
      scene.hotspotContainer().createHotspot(root, { yaw: hs.yaw, pitch: hs.pitch });
    });

    return { data: sceneData, scene, view };
  });

  // ====== アニメーション ======
  function easeInOutSine(t){ return 0.5 - 0.5 * Math.cos(Math.PI * t); }
  function lerp(a,b,t){ return a + (b - a) * t; }
  function animateView(view, from, to, duration, done){
    var start = performance.now();
    function step(now){
      var t = Math.min(1, (now - start)/duration);
      var k = easeInOutSine(t);
      view.setParameters({
        yaw:   lerp(from.yaw,   to.yaw,   k),
        pitch: lerp(from.pitch, to.pitch, k),
        fov:   lerp(from.fov,   to.fov,   k)
      });
      if (t < 1) requestAnimationFrame(step);
      else if (done) done();
    }
    requestAnimationFrame(step);
  }

  // ====== Autorotate ======
  var autorotate = Marzipano.autorotate({ yawSpeed: 0.03, targetPitch: 0, targetFov: Math.PI/2 });
  if (data.settings.autorotateEnabled) autorotateToggleElement.classList.add('enabled');

  autorotateToggleElement.addEventListener('click', function(){
    if (autorotateToggleElement.classList.contains('enabled')){
      autorotateToggleElement.classList.remove('enabled'); stopAutorotate();
    } else {
      autorotateToggleElement.classList.add('enabled'); startAutorotate();
    }
  });

  function startAutorotate(){ viewer.startMovement(autorotate); viewer.setIdleMovement(3000, autorotate); }
  function stopAutorotate(){ viewer.stopMovement(); viewer.setIdleMovement(Infinity); }

  sceneListToggleElement.addEventListener('click', function(){
    sceneListElement.classList.toggle('enabled');
    sceneListToggleElement.classList.toggle('enabled');
  });

  // 初期
  scenes[0].scene.switchTo();
  startAutorotate();

})();
