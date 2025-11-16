/*
 * Marzipano hotspot → 内部モーダル(video) 再生版
 * - ピン位置ズレなし（アンカー方式）
 * - クリックで寄ってからモーダルを開き、閉じると戻る＆オートローテート再開
 */

'use strict';

(function() {
  var Marzipano = window.Marzipano;
  var data = window.APP_DATA;

  // DOM
  var panoElement            = document.getElementById('pano');
  var autorotateToggleElement = document.getElementById('autorotateToggle');
  var sceneListToggleElement  = document.getElementById('sceneListToggle');
  var sceneListElement        = document.getElementById('sceneList');

  // モーダル要素（index.htmlに書いたものを取得）
  var modalOverlay = document.getElementById('modalOverlay');
  var modalBox     = document.getElementById('modalBox');
  var modalClose   = document.getElementById('modalClose');
  var modalVideo   = document.getElementById('modalVideo');

  // ピンのサイズ
  var HOTSPOT_SIZE = 60;   // px
  var LABEL_GAP    = -20;  // ピンの右からラベルまでの距離

  // ===== Viewer =====
  var viewer = new Marzipano.Viewer(panoElement, {
    controls: { mouseViewMode: data.settings.mouseViewMode }
  });

  // ===== Scenes =====
  var scenes = data.scenes.map(function(sceneData) {
    var source = Marzipano.ImageUrlSource.fromString(
      "tiles/" + sceneData.id + "/{z}/{f}/{y}/{x}.jpg",
      { cubeMapPreviewUrl: "tiles/" + sceneData.id + "/preview.jpg" }
    );

    var geometry = new Marzipano.CubeGeometry(sceneData.levels);

    var limiter = Marzipano.RectilinearView.limit.traditional(
      sceneData.faceSize,
      100 * Math.PI / 180,
      120 * Math.PI / 180
    );

    var view = new Marzipano.RectilinearView(sceneData.initialViewParameters, limiter);

    var scene = viewer.createScene({
      source: source,
      geometry: geometry,
      view: view,
      pinFirstLevel: true
    });

    // ----- infoHotspots -----
    sceneData.infoHotspots.forEach(function(hs) {
      // ルート
      var root = document.createElement('div');

      // アンカー（下中央を基準にする）
      var anchor = document.createElement('div');
      anchor.className = 'iv-pin-anchor';
      anchor.style.position  = 'absolute';
      anchor.style.left      = '0';
      anchor.style.top       = '0';
      anchor.style.transform = 'translate(-50%, -100%)';
      anchor.style.zIndex    = '10';

      // 半透明丸
      var bg = document.createElement('div');
      bg.style.width        = HOTSPOT_SIZE + 'px';
      bg.style.height       = HOTSPOT_SIZE + 'px';
      bg.style.borderRadius = '50%';
      bg.style.background   = 'rgba(0,0,0,0.3)';
      bg.style.display      = 'flex';
      bg.style.alignItems   = 'center';
      bg.style.justifyContent = 'center';
      bg.style.pointerEvents  = 'none';

      // ピン画像
      var img = document.createElement('img');
      img.src = 'img/info.png';
      img.alt = '';
      img.style.width       = '90%';
      img.style.height      = '90%';
      img.style.objectFit   = 'contain';
      img.style.pointerEvents = 'none';

      bg.appendChild(img);
      anchor.appendChild(bg);
      root.appendChild(anchor);

      // ラベル
      var label = document.createElement('div');
      label.className = 'iv-label';
      label.textContent = hs.title || '';
      label.style.position   = 'absolute';
      label.style.left       = (HOTSPOT_SIZE + LABEL_GAP) + 'px';
      label.style.top        = '0';
      label.style.transform  = 'translateY(-100%) translateX(-10px)';
      label.style.whiteSpace = 'nowrap';
      label.style.color      = '#fff';
      label.style.background = 'rgba(0,0,0,0.6)';
      label.style.padding    = '6px 10px';
      label.style.borderRadius = '6px';
      label.style.fontSize   = '15px';
      label.style.zIndex     = '9';

      root.appendChild(label);

      root.addEventListener('mouseenter', function() {
        label.style.opacity    = '1';
        label.style.transform  = 'translateY(-100%) translateX(0)';
      });
      root.addEventListener('mouseleave', function() {
        label.style.opacity    = '0';
        label.style.transform  = 'translateY(-100%) translateX(-10px)';
      });

      // hs.text 内の <a href="...">（mp4 の URL）を拾う
      var linkHref = null;
      try {
        var tmp = document.createElement('div');
        tmp.innerHTML = hs.text || '';
        var a = tmp.querySelector('a[href]');
        if (a) {
          // data.js の中身そのまま（相対パス or 絶対URL）
          linkHref = a.getAttribute('href');
        }
      } catch (e) {}

      // クリックで寄ってからモーダル表示
      root.addEventListener('click', function(ev) {
        ev.stopPropagation();
        if (!linkHref) return;

        stopAutorotate();

        var before = view.parameters();
        var target = {
          yaw:   hs.yaw,
          pitch: hs.pitch,
          fov:   Math.PI / 6
        };

        // まず寄る
        animateView(view, before, target, 1000, function() {
          // モーダルを開いて video 再生
          modalOverlay.classList.add('show');
          modalVideo.src = linkHref;
          modalVideo.currentTime = 0;
          var p = modalVideo.play();
          if (p && p.catch) {
            p.catch(function(){});
          }
          // 元のカメラ位置を覚えておく
          modalVideo._beforeView = before;
        });
      });

      scene.hotspotContainer().createHotspot(root, {
        yaw: hs.yaw,
        pitch: hs.pitch
      });
    });

    return {
      data: sceneData,
      scene: scene,
      view: view
    };
  });

  // ===== アニメーション補助 =====
  function easeInOutSine(t) {
    return 0.5 - 0.5 * Math.cos(Math.PI * t);
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function animateView(view, from, to, duration, done) {
    var start = performance.now();

    function step(now) {
      var t = Math.min(1, (now - start) / duration);
      var k = easeInOutSine(t);
      view.setParameters({
        yaw:   lerp(from.yaw,   to.yaw,   k),
        pitch: lerp(from.pitch, to.pitch, k),
        fov:   lerp(from.fov,   to.fov,   k)
      });
      if (t < 1) {
        requestAnimationFrame(step);
      } else if (done) {
        done();
      }
    }

    requestAnimationFrame(step);
  }

  // ===== オートローテート =====
  var autorotate = Marzipano.autorotate({
    yawSpeed:    0.03,
    targetPitch: 0,
    targetFov:   Math.PI / 2
  });

  function startAutorotate() {
    viewer.startMovement(autorotate);
    viewer.setIdleMovement(3000, autorotate);
  }

  function stopAutorotate() {
    viewer.stopMovement();
    viewer.setIdleMovement(Infinity);
  }

  if (data.settings.autorotateEnabled) {
    autorotateToggleElement.classList.add('enabled');
    startAutorotate();
  }

  autorotateToggleElement.addEventListener('click', function() {
    if (autorotateToggleElement.classList.contains('enabled')) {
      autorotateToggleElement.classList.remove('enabled');
      stopAutorotate();
    } else {
      autorotateToggleElement.classList.add('enabled');
      startAutorotate();
    }
  });

  // シーンリスト（1シーンなら見た目変わらず）
  sceneListToggleElement.addEventListener('click', function() {
    sceneListElement.classList.toggle('enabled');
    sceneListToggleElement.classList.toggle('enabled');
  });

  // ===== モーダルを閉じる処理 =====
  function closeModal() {
    if (!modalOverlay.classList.contains('show')) return;

    modalOverlay.classList.remove('show');

    try {
      modalVideo.pause();
    } catch (e) {}
    modalVideo.src = '';

    var before = modalVideo._beforeView;
    if (before && scenes.length > 0) {
      // 今回はシーン1個想定
      var s = scenes[0];
      animateView(s.view, s.view.parameters(), before, 800, function() {
        if (autorotateToggleElement.classList.contains('enabled')) {
          startAutorotate();
        }
      });
    } else {
      if (autorotateToggleElement.classList.contains('enabled')) {
        startAutorotate();
      }
    }
  }

  modalClose.addEventListener('click', closeModal);

  // 黒背景部分クリックで閉じる（枠外クリック）
  modalOverlay.addEventListener('click', function(ev) {
    if (ev.target === modalOverlay) {
      closeModal();
    }
  });

  // ===== 初期シーン表示 =====
  if (scenes.length > 0) {
    scenes[0].scene.switchTo();
  }

})();

