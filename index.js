/*
 * Marzipano custom — hotspot zoom + hover tooltip + link open
 */
'use strict';

(function () {
  var Marzipano = window.Marzipano;
  var bowser = window.bowser;
  var screenfull = window.screenfull;
  var data = window.APP_DATA;

  // --- DOM要素 ---
  var panoElement = document.querySelector('#pano');
  var sceneNameElement = document.querySelector('#titleBar .sceneName');
  var sceneListElement = document.querySelector('#sceneList');
  var sceneElements = document.querySelectorAll('#sceneList .scene');
  var sceneListToggleElement = document.querySelector('#sceneListToggle');
  var autorotateToggleElement = document.querySelector('#autorotateToggle');
  var fullscreenToggleElement = document.querySelector('#fullscreenToggle');

  // --- モード判定 ---
  if (window.matchMedia) {
    var setMode = function () {
      if (mql.matches) { document.body.classList.remove('desktop'); document.body.classList.add('mobile'); }
      else { document.body.classList.remove('mobile'); document.body.classList.add('desktop'); }
    };
    var mql = matchMedia('(max-width: 500px), (max-height: 500px)');
    setMode(); mql.addListener(setMode);
  } else { document.body.classList.add('desktop'); }

  // --- タッチ検出 ---
  document.body.classList.add('no-touch');
  window.addEventListener('touchstart', function () {
    document.body.classList.remove('no-touch'); document.body.classList.add('touch');
  });

  // --- IE旧版 ---
  if (bowser.msie && parseFloat(bowser.version) < 11) {
    document.body.classList.add('tooltip-fallback');
  }

  // --- Viewer ---
  var viewerOpts = { controls: { mouseViewMode: data.settings.mouseViewMode } };
  var viewer = new Marzipano.Viewer(panoElement, viewerOpts);

  // --- シーン作成 ---
  var scenes = data.scenes.map(function (data) {
    var urlPrefix = 'tiles';
    var source = Marzipano.ImageUrlSource.fromString(
      urlPrefix + '/' + data.id + '/{z}/{f}/{y}/{x}.jpg',
      { cubeMapPreviewUrl: urlPrefix + '/' + data.id + '/preview.jpg' }
    );
    var geometry = new Marzipano.CubeGeometry(data.levels);
    var limiter = Marzipano.RectilinearView.limit.traditional(
      data.faceSize, 100*Math.PI/180, 120*Math.PI/180
    );
    var view = new Marzipano.RectilinearView(data.initialViewParameters, limiter);

    var scene = viewer.createScene({ source: source, geometry: geometry, view: view, pinFirstLevel: true });

    // 情報ホットスポット
    data.infoHotspots.forEach(function (hotspot) {
      var el = createInfoHotspotWithTooltip(hotspot, view);
      scene.hotspotContainer().createHotspot(el, { yaw: hotspot.yaw, pitch: hotspot.pitch });
    });

    return { data: data, scene: scene, view: view };
  });

  // --- オートローテーション ---
  var autorotate = Marzipano.autorotate({ yawSpeed: 0.03, targetPitch: 0, targetFov: Math.PI/2 });
  if (data.settings.autorotateEnabled) autorotateToggleElement.classList.add('enabled');
  autorotateToggleElement.addEventListener('click', toggleAutorotate);
  function startAutorotate(){
    if (!autorotateToggleElement.classList.contains('enabled')) return;
    viewer.startMovement(autorotate); viewer.setIdleMovement(3000, autorotate);
  }
  function stopAutorotate(){ viewer.stopMovement(); viewer.setIdleMovement(Infinity); }
  function toggleAutorotate(){
    if (autorotateToggleElement.classList.contains('enabled')){
      autorotateToggleElement.classList.remove('enabled'); stopAutorotate();
    } else {
      autorotateToggleElement.classList.add('enabled'); startAutorotate();
    }
  }

  // --- シーンリスト切り替え ---
  sceneListToggleElement.addEventListener('click', function(){
    sceneListElement.classList.toggle('enabled');
    sceneListToggleElement.classList.toggle('enabled');
  });

  // --- 手作りアニメータ（寄り） ---
  function easeInOutSine(t){ return 0.5 - 0.5 * Math.cos(Math.PI * t); }
  function lerp(a,b,t){ return a + (b - a) * t; }
  function animateParams(view, from, to, duration, done){
    var start = performance.now();
    function tick(now){
      var t = Math.min(1, (now - start) / duration);
      var k = easeInOutSine(t);
      view.setParameters({ yaw: lerp(from.yaw,to.yaw,k), pitch: lerp(from.pitch,to.pitch,k), fov: lerp(from.fov,to.fov,k) });
      if (t < 1) requestAnimationFrame(tick);
      else if (done) done();
    }
    requestAnimationFrame(tick);
  }

  // =====================================================
  // Info Hotspot: アイコン + ホバー横展開 + クリック寄り
  // =====================================================
  function createInfoHotspotWithTooltip(hotspot, view){
    var wrapper = document.createElement('div');
    wrapper.classList.add('hotspot','info-hotspot','info-hotspot--icononly');

    // アイコン画像
    var icon = document.createElement('img');
    icon.src = 'img/info.gif'; // ← 実ファイルに合わせて
    icon.classList.add('info-hotspot-icononly-img');
    wrapper.appendChild(icon);

    // ホバー時に横展開タイトル
    var tooltip = document.createElement('div');
    tooltip.classList.add('info-hotspot-tooltip');
    tooltip.innerHTML = hotspot.title;
    wrapper.appendChild(tooltip);

    // リンク先をテキスト内から抽出
    var linkHref = null;
    try {
      var tmp = document.createElement('div');
      tmp.innerHTML = hotspot.text || '';
      var a = tmp.querySelector('a[href]');
      if (a) linkHref = a.href;
    } catch(e){}

    // クリックでズーム→リンク→戻る
    wrapper.addEventListener('click', function(ev){
      ev.preventDefault();
      ev.stopPropagation();
      if (!linkHref) return;

      var before = view.parameters();
      var target = { yaw: hotspot.yaw, pitch: hotspot.pitch, fov: Math.min(before.fov * 0.6, 0.35) };
      stopAutorotate();

      animateParams(view, before, target, 1100, function(){
        window.open(linkHref, '_blank');
        animateParams(view, view.parameters(), before, 1000, function(){
          setTimeout(startAutorotate, 400);
        });
      });
    });

    return wrapper;
  }

  // --- イベント停止 ---
  function stopTouchAndScrollEventPropagation(element){
    ['touchstart','touchmove','touchend','touchcancel','wheel','mousewheel'].forEach(function(ev){
      element.addEventListener(ev, function(e){ e.stopPropagation(); });
    });
  }

  // --- 最初のシーン ---
  scenes[0].scene.switchTo();
})();















