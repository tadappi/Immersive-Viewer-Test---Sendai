/*
 * Marzipano hotspot zoom + balanced tab timing (Safari/Chrome)
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

  var viewer = new Marzipano.Viewer(panoElement, {
    controls: { mouseViewMode: data.settings.mouseViewMode }
  });

  // ===== シーン作成 =====
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

      // ピンアイコン
      var icon = document.createElement('img');
      icon.src = 'img/info.png';
      icon.classList.add('info-hotspot-icon');
      wrapper.appendChild(icon);

      // ラベル
      var label = document.createElement('div');
      label.classList.add('info-hotspot-label');
      label.innerHTML = hotspot.title;
      wrapper.appendChild(label);

      // リンク抽出
      var linkHref = null;
      try {
        var tmp = document.createElement('div');
        tmp.innerHTML = hotspot.text || '';
        var a = tmp.querySelector('a[href]');
        if (a) linkHref = a.href;
      } catch(e){}

      // === Safari/Chrome両対応：フォーカス制御安定版 ===
      wrapper.addEventListener('click', function() {
        if (!linkHref) return;
        stopAutorotate();

        var before = view.parameters();
        var target = { yaw: hotspot.yaw, pitch: hotspot.pitch, fov: Math.PI / 6 };
        var newWin = null;

        // 1️⃣ ズーム開始
        animateView(view, before, target, 1000);

        // 2️⃣ 0.9秒後に空タブを開く（Safariポップアップ許可内）
        setTimeout(function() {
          try {
            newWin = window.open('', '_blank');
          } catch(e) {
            console.warn('Popup blocked:', e);
          }
        }, 900);

        // 3️⃣ 1.5秒後にリンク読込 → 戻る
        setTimeout(function() {
          if (newWin) {
            newWin.location.href = linkHref;
          } else {
            window.open(linkHref, '_blank'); // fallback
          }

          // 元の位置へ戻す（演出的に自然）
          animateView(view, view.parameters(), before, 1000, function() {
            startAutorotate();
          });
        }, 1500);
      });

      scene.hotspotContainer().createHotspot(wrapper, { yaw: hotspot.yaw, pitch: hotspot.pitch });
    });

    return { data, scene, view };
  });

  // ===== アニメーション関数 =====
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

  // ===== 自動回転 =====
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

  // ===== 初期表示 =====
  scenes[0].scene.switchTo();
  startAutorotate();
})();
