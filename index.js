/*
 * Marzipano hotspot → internal modal viewer (iframe)
 * - hotspot ズレゼロ
 * - 動画/画像/外部URLを内部ウインドウで半画面表示
 * - 寄り → モーダル開く → 閉じると戻る & 自動回転再開
 */
'use strict';

(function () {
  var Marzipano = window.Marzipano;
  var data = window.APP_DATA;

  var panoElement = document.querySelector('#pano');
  var autorotateToggleElement = document.querySelector('#autorotateToggle');
  var sceneListToggleElement = document.querySelector('#sceneListToggle');
  var sceneListElement = document.querySelector('#sceneList');

  // === モーダル要素を index.html に後付け ===
  var modalOverlay = document.createElement('div');
  modalOverlay.id = 'modalOverlay';

  modalOverlay.innerHTML = `
    <div id="modalBox">
      <button id="modalClose">×</button>
      <iframe id="modalFrame"></iframe>
    </div>
  `;
  document.body.appendChild(modalOverlay);

  var modalBox = document.getElementById("modalBox");
  var modalFrame = document.getElementById("modalFrame");
  var modalClose = document.getElementById("modalClose");

  // === ホットスポットのサイズ設定 ===
  var HOTSPOT_SIZE = 60;  // px
  var LABEL_GAP = -20;

  // === Viewer ===
  var viewer = new Marzipano.Viewer(panoElement, {
    controls: { mouseViewMode: data.settings.mouseViewMode }
  });

  // === Scenes ===
  var scenes = data.scenes.map(function (sceneData) {

    var source = Marzipano.ImageUrlSource.fromString(
      "tiles/" + sceneData.id + "/{z}/{f}/{y}/{x}.jpg",
      { cubeMapPreviewUrl: "tiles/" + sceneData.id + "/preview.jpg" }
    );

    var geometry = new Marzipano.CubeGeometry(sceneData.levels);
    var limiter = Marzipano.RectilinearView.limit.traditional(
      sceneData.faceSize, 100 * Math.PI / 180, 120 * Math.PI / 180
    );

    var view = new Marzipano.RectilinearView(sceneData.initialViewParameters, limiter);
    var scene = viewer.createScene({ source, geometry, view, pinFirstLevel: true });

    // === infoHotspots ===
    sceneData.infoHotspots.forEach(function (hs) {

      // --- root: Marzipano の transform 用 ---
      var root = document.createElement('div');

      // --- anchor：下中央固定（ズレ防止）---
      var anchor = document.createElement('div');
      anchor.style.position = 'absolute';
      anchor.style.left = '0';
      anchor.style.top = '0';
      anchor.style.transform = 'translate(-50%, -100%)';
      anchor.style.zIndex = '10';

      // --- 半透明の背景丸 ---
      var bg = document.createElement('div');
      bg.style.width = HOTSPOT_SIZE + 'px';
      bg.style.height = HOTSPOT_SIZE + 'px';
      bg.style.borderRadius = '50%';
      bg.style.background = 'rgba(0,0,0,0.30)';
      bg.style.display = 'flex';
      bg.style.alignItems = 'center';
      bg.style.justifyContent = 'center';
      bg.style.pointerEvents = 'none';

      // --- ピン画像 ---
      var img = document.createElement('img');
      img.src = 'img/info.png';
      img.style.width = '90%';
      img.style.height = '90%';
      img.style.objectFit = 'contain';
      img.style.pointerEvents = 'none';

      bg.appendChild(img);
      anchor.appendChild(bg);
      root.appendChild(anchor);

      // --- ラベル ---
      var label = document.createElement('div');
      label.innerHTML = hs.title || "";
      label.style.position = 'absolute';
      label.style.left = (HOTSPOT_SIZE + LABEL_GAP) + 'px';
      label.style.top = '0';
      label.style.transform = 'translateY(-100%) translateX(-10px)';
      label.style.whiteSpace = 'nowrap';
      label.style.color = '#fff';
      label.style.background = 'rgba(0,0,0,0.6)';
      label.style.padding = '6px 10px';
      label.style.borderRadius = '6px';
      label.style.fontSize = '15px';
      label.style.opacity = '0';
      label.style.pointerEvents = 'none';
      label.style.transition = 'all 0.25s ease';
      label.style.zIndex = '9';

      root.appendChild(label);

      root.addEventListener('mouseenter', () => {
        label.style.opacity = '1';
        label.style.transform = 'translateY(-100%) translateX(0)';
      });

      root.addEventListener('mouseleave', () => {
        label.style.opacity = '0';
        label.style.transform = 'translateY(-100%) translateX(-10px)';
      });

      // --- クリック：内部モーダルで表示 ---
      var linkHref = null;
      try {
        var tmp = document.createElement("div");
        tmp.innerHTML = hs.text || "";
        var a = tmp.querySelector("a[href]");
        if (a) linkHref = a.href;
      } catch (e) {}

      root.addEventListener('click', function () {
        if (!linkHref) return;

        stopAutorotate();

        var before = view.parameters();
        var target = { yaw: hs.yaw, pitch: hs.pitch, fov: Math.PI / 6 };

        // ① ズーム寄り
        animateView(view, before, target, 1000, function () {

          // ② モーダル表示
          modalFrame.src = linkHref;
          modalOverlay.classList.add('show');

        });

        // × を押したときの処理
        modalClose.onclick = function () {
          modalOverlay.classList.remove('show');
          modalFrame.src = "about:blank";

          // ③ 元に戻る
          animateView(view, view.parameters(), before, 800, function () {
            startAutorotate();
          });
        };
      });

      scene.hotspotContainer().createHotspot(root, { yaw: hs.yaw, pitch: hs.pitch });
    });

    return { data: sceneData, scene, view };
  });

  // === Animation ===
  function easeInOutSine(t) { return 0.5 - 0.5 * Math.cos(Math.PI * t); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function animateView(view, from, to, duration, done) {
    var start = performance.now();
    function step(now) {
      var t = Math.min(1, (now - start) / duration);
      var k = easeInOutSine(t);
      view.setParameters({
        yaw: lerp(from.yaw, to.yaw, k),
        pitch: lerp(from.pitch, to.pitch, k),
        fov: lerp(from.fov, to.fov, k)
      });
      if (t < 1) requestAnimationFrame(step);
      else if (done) done();
    }
    requestAnimationFrame(step);
  }

  // === Autorotate ===
  var autorotate = Marzipano.autorotate({
    yawSpeed: 0.03,
    targetPitch: 0,
    targetFov: Math.PI / 2
  });

  if (data.settings.autorotateEnabled)
    autorotateToggleElement.classList.add('enabled');

  autorotateToggleElement.addEventListener('click', function () {
    if (autorotateToggleElement.classList.contains('enabled')) {
      autorotateToggleElement.classList.remove('enabled');
      stopAutorotate();
    } else {
      autorotateToggleElement.classList.add('enabled');
      startAutorotate();
    }
  });

  function startAutorotate() {
    viewer.startMovement(autorotate);
    viewer.setIdleMovement(3000, autorotate);
  }

  function stopAutorotate() {
    viewer.stopMovement();
    viewer.setIdleMovement(Infinity);
  }

  // Scene list toggle
  sceneListToggleElement.addEventListener('click', function () {
    sceneListElement.classList.toggle('enabled');
    sceneListToggleElement.classList.toggle('enabled');
  });

  // 初期
  scenes[0].scene.switchTo();
  startAutorotate();

})();
