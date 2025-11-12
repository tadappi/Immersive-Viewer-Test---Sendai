/*
 * Marzipano hotspot zoom + unified icon size (stable)
 */
'use strict';

(function() {
  var Marzipano = window.Marzipano;
  var screenfull = window.screenfull;
  var data = window.APP_DATA;

  var panoElement = document.querySelector('#pano');
  var autorotateToggleElement = document.querySelector('#autorotateToggle');
  var sceneListToggleElement = document.querySelector('#sceneListToggle');
  var sceneListElement = document.querySelector('#sceneList');

  // === 統一サイズ設定 ===
  var HOTSPOT_SIZE = 50; // ピクセル指定（ピン画像の実寸）
  var LABEL_OFFSET = 12; // ラベルの左右オフセット

  // === ビューア生成 ===
  var viewer = new Marzipano.Viewer(panoElement, {
    controls: { mouseViewMode: data.settings.mouseViewMode }
  });

  // === シーン構築 ===
  var scenes = data.scenes.map(function(data) {
    var source = Marzipano.ImageUrlSource.fromString(
      "tiles/" + data.id + "/{z}/{f}/{y}/{x}.jpg",
      { cubeMapPreviewUrl: "tiles/" + data.id + "/preview.jpg" }
    );
    var geometry = new Marzipano.CubeGeometry(data.levels);
    var limiter = Marzipano.RectilinearView.limit.traditional(
      data.faceSize, 100*Math.PI/180, 120*Math.PI/180
    );
    var view = new Marzipano.RectilinearView(data.initialViewParameters, limiter);
    var scene = viewer.createScene({ source, geometry, view, pinFirstLevel: true });

    // === infoHotspot ===
    data.infoHotspots.forEach(function(hotspot) {
      var wrapper = document.createElement('div');
      wrapper.classList.add('hotspot', 'info-hotspot', 'info-hotspot--hover');

      // ピンアイコン（統一サイズ）
      var icon = document.createElement('img');
      icon.src = 'img/info.png';
      icon.classList.add('info-hotspot-icon');
      icon.style.width = HOTSPOT_SIZE + 'px';
      icon.style.height = HOTSPOT_SIZE + 'px';
      icon.style.borderRadius = '50%';
      wrapper.appendChild(icon);

      // ラベル
      var label = document.createElement('div');
      label.classList.add('info-hotspot-label');
      label.innerHTML = hotspot.title;
      label.style.left = (HOTSPOT_SIZE + LABEL_OFFSET) + 'px';
      wrapper.appendChild(label);

      // リンク抽出
      var linkHref = null;
      try {
        var tmp = document.createElement('div');
        tmp.innerHTML = hotspot.text || '';
        var a = tmp.querySelector('a[href]');
        if (a) linkHref = a.href;
      } catch(e){}

      // === クリックイベント ===
      wrapper.addEventListener('click', function() {
        if (!linkHref) return;
        stopAutorotate();

        var before = view.parameters();
        var target = { yaw: hotspot.yaw, pitch: hotspot.pitch, fov: Math.PI / 6 };
        var newWin = null;

        // ズームイン開始
        animateView(view, before, target, 1000);

        // Safari/Chrome対応 — 遅延付き空タブ生成
        setTimeout(function() {
          try {
            newWin = window.open('', '_blank');
          } catch(e) { console.warn('Popup blocked:', e); }
        }, 900);

        // 1.5秒後にURLセット → 戻す
        setTimeout(function() {
          if (newWin) newWin.location.href = linkHref;
          else window.open(linkHref, '_blank');

          animateView(view, view.parameters(), before, 1000, startAutorotate);
        }, 1500);
      });

      scene.hotspotContainer().createHotspot(wrapper, { yaw: hotspot.yaw, pitch: hotspot.pitch });
    });

    return { data, scene, view };
  });

  // === アニメーション ===
  function easeInOutSine(t){ return 0.5 - 0.5 * Math.cos(Math.PI * t); }
  function lerp(a,b,t){ return a + (b - a) * t; }
  function animateView(view, from, to, duration, done){
    var start = performance.now();
    function step(now){
      var t = Math.min(1, (now - start) / duration);
      var k = easeInOutSine(t);
      view.setParameters({
        yaw: lerp(from.yaw,to.yaw,k),
        pitch: lerp(from.pitch,to.pitch,k),
        fov: lerp(from.fov,to.fov,k)
      });
      if (t < 1) requestAnimationFrame(step);
      else if (done) done();
    }
    requestAnimationFrame(step);
  }

  // === 自動回転 ===
  var autorotate = Marzipano.autorotate({ yawSpeed: 0.03, targetPitch: 0, targetFov: Math.PI/2 });
  if (data.settings.autorotateEnabled) autorotateToggleElement.classList.add('enabled');

  autorotateToggleElement.addEventListener('click', function(){
    if (autorotateToggleElement.classList.contains('enabled')){
      autorotateToggleElement.classList.remove('enabled');
      stopAutorotate();
    } else {
      autorotateToggleElement.classList.add('enabled');
      startAutorotate();
    }
  });

  function startAutorotate(){
    viewer.startMovement(autorotate);
    viewer.setIdleMovement(3000, autorotate);
  }
  function stopAutorotate(){
    viewer.stopMovement();
    viewer.setIdleMovement(Infinity);
  }

  sceneListToggleElement.addEventListener('click', function(){
    sceneListElement.classList.toggle('enabled');
    sceneListToggleElement.classList.toggle('enabled');
  });

  // === 初期表示 ===
  scenes[0].scene.switchTo();
  startAutorotate();

})();
