/*
 * Marzipano simple zoom + auto return + autorotate resume + auto start
 */
'use strict';

(function() {
  var Marzipano = window.Marzipano;
  var bowser = window.bowser;
  var screenfull = window.screenfull;
  var data = window.APP_DATA;

  // --- 基本DOM ---
  var panoElement = document.querySelector('#pano');
  var sceneNameElement = document.querySelector('#titleBar .sceneName');
  var sceneListElement = document.querySelector('#sceneList');
  var sceneElements = document.querySelectorAll('#sceneList .scene');
  var sceneListToggleElement = document.querySelector('#sceneListToggle');
  var autorotateToggleElement = document.querySelector('#autorotateToggle');
  var fullscreenToggleElement = document.querySelector('#fullscreenToggle');

  // --- Viewer ---
  var viewer = new Marzipano.Viewer(panoElement, {
    controls: { mouseViewMode: data.settings.mouseViewMode }
  });

  // --- シーン作成 ---
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

    // --- infoHotspot（クリックで寄る→戻る→自動回転再開） ---
    data.infoHotspots.forEach(function(hotspot) {
      var wrapper = document.createElement('div');
      wrapper.classList.add('hotspot', 'info-hotspot');

      var header = document.createElement('div');
      header.classList.add('info-hotspot-header');

      var iconWrapper = document.createElement('div');
      iconWrapper.classList.add('info-hotspot-icon-wrapper');
      var icon = document.createElement('img');
      icon.src = 'img/info.png';
      icon.classList.add('info-hotspot-icon');
      iconWrapper.appendChild(icon);

      header.appendChild(iconWrapper);
      wrapper.appendChild(header);

      // ✅ クリック動作
      wrapper.addEventListener('click', function() {
        var yaw = hotspot.yaw;
        var pitch = hotspot.pitch;
        var before = view.parameters(); // 現在の視点
        var target = { yaw: yaw, pitch: pitch, fov: Math.PI / 6 }; // 寄り先（fov小）

        stopAutorotate(); // 一時停止

        // 寄る
        animateView(view, before, target, 1000, function() {
          // 1.5秒静止してから戻る
          setTimeout(function() {
            animateView(view, view.parameters(), before, 1000, function() {
              startAutorotate(); // 自動回転再開
            });
          }, 1500);
        });
      });

      scene.hotspotContainer().createHotspot(wrapper, { yaw: hotspot.yaw, pitch: hotspot.pitch });
    });

    return { data, scene, view };
  });

  // --- アニメーション関数 ---
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

  // --- autorotate ---
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

  // --- SceneListボタン ---
  sceneListToggleElement.addEventListener('click', function(){
    sceneListElement.classList.toggle('enabled');
    sceneListToggleElement.classList.toggle('enabled');
  });

  // --- 初期表示 ---
  scenes[0].scene.switchTo();

  // ✅ 読み込み直後に自動回転スタート
  startAutorotate();
})();
