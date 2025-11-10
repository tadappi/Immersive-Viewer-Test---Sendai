'use strict';

(function() {
  var Marzipano = window.Marzipano;
  var bowser = window.bowser;
  var screenfull = window.screenfull;
  var data = window.APP_DATA;

  var panoElement = document.querySelector('#pano');
  var sceneNameElement = document.querySelector('#titleBar .sceneName');
  var sceneListElement = document.querySelector('#sceneList');
  var sceneElements = document.querySelectorAll('#sceneList .scene');
  var sceneListToggleElement = document.querySelector('#sceneListToggle');
  var autorotateToggleElement = document.querySelector('#autorotateToggle');
  var fullscreenToggleElement = document.querySelector('#fullscreenToggle');

  if (window.matchMedia) {
    var setMode = function() {
      if (mql.matches) {
        document.body.classList.remove('desktop');
        document.body.classList.add('mobile');
      } else {
        document.body.classList.remove('mobile');
        document.body.classList.add('desktop');
      }
    };
    var mql = matchMedia("(max-width: 500px), (max-height: 500px)");
    setMode();
    mql.addListener(setMode);
  } else {
    document.body.classList.add('desktop');
  }

  document.body.classList.add('no-touch');
  window.addEventListener('touchstart', function() {
    document.body.classList.remove('no-touch');
    document.body.classList.add('touch');
  });

  if (bowser.msie && parseFloat(bowser.version) < 11) {
    document.body.classList.add('tooltip-fallback');
  }

  var viewerOpts = {
    controls: {
      mouseViewMode: data.settings.mouseViewMode
    }
  };

  var viewer = new Marzipano.Viewer(panoElement, viewerOpts);

  var scenes = data.scenes.map(function(data) {
    var urlPrefix = "tiles";
    var source = Marzipano.ImageUrlSource.fromString(
      urlPrefix + "/" + data.id + "/{z}/{f}/{y}/{x}.jpg",
      { cubeMapPreviewUrl: urlPrefix + "/" + data.id + "/preview.jpg" });
    var geometry = new Marzipano.CubeGeometry(data.levels);
    var limiter = Marzipano.RectilinearView.limit.traditional(data.faceSize, 100*Math.PI/180, 120*Math.PI/180);
    var view = new Marzipano.RectilinearView(data.initialViewParameters, limiter);

    var scene = viewer.createScene({
      source: source,
      geometry: geometry,
      view: view,
      pinFirstLevel: true
    });

    // infoHotspotを生成
    data.infoHotspots.forEach(function(hotspot) {
      var element = createInfoHotspotElement(hotspot, view);
      scene.hotspotContainer().createHotspot(element, { yaw: hotspot.yaw, pitch: hotspot.pitch });
    });

    return { data: data, scene: scene, view: view };
  });

  // 自動回転設定
  var autorotate = Marzipano.autorotate({
    yawSpeed: 0.03,
    targetPitch: 0,
    targetFov: Math.PI/2
  });
  if (data.settings.autorotateEnabled) {
    autorotateToggleElement.classList.add('enabled');
  }

  autorotateToggleElement.addEventListener('click', toggleAutorotate);

  if (screenfull.enabled && data.settings.fullscreenButton) {
    document.body.classList.add('fullscreen-enabled');
    fullscreenToggleElement.addEventListener('click', function() {
      screenfull.toggle();
    });
  }

  sceneListToggleElement.addEventListener('click', toggleSceneList);
  if (!document.body.classList.contains('mobile')) showSceneList();

  scenes.forEach(function(scene) {
    var el = document.querySelector('#sceneList .scene[data-id="' + scene.data.id + '"]');
    el.addEventListener('click', function() {
      switchScene(scene);
      if (document.body.classList.contains('mobile')) hideSceneList();
    });
  });

  function sanitize(s) {
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;');
  }

  function switchScene(scene) {
    stopAutorotate();
    scene.view.setParameters(scene.data.initialViewParameters);
    scene.scene.switchTo();
    startAutorotate();
    updateSceneName(scene);
    updateSceneList(scene);
  }

  function updateSceneName(scene) {
    sceneNameElement.innerHTML = sanitize(scene.data.name);
  }

  function updateSceneList(scene) {
    for (var i = 0; i < sceneElements.length; i++) {
      var el = sceneElements[i];
      if (el.getAttribute('data-id') === scene.data.id) {
        el.classList.add('current');
      } else {
        el.classList.remove('current');
      }
    }
  }

  function showSceneList() {
    sceneListElement.classList.add('enabled');
    sceneListToggleElement.classList.add('enabled');
  }

  function hideSceneList() {
    sceneListElement.classList.remove('enabled');
    sceneListToggleElement.classList.remove('enabled');
  }

  function toggleSceneList() {
    sceneListElement.classList.toggle('enabled');
    sceneListToggleElement.classList.toggle('enabled');
  }

  function startAutorotate() {
    if (!autorotateToggleElement.classList.contains('enabled')) return;
    viewer.startMovement(autorotate);
    viewer.setIdleMovement(3000, autorotate);
  }

  function stopAutorotate() {
    viewer.stopMovement();
    viewer.setIdleMovement(Infinity);
  }

  function toggleAutorotate() {
    if (autorotateToggleElement.classList.contains('enabled')) {
      autorotateToggleElement.classList.remove('enabled');
      stopAutorotate();
    } else {
      autorotateToggleElement.classList.add('enabled');
      startAutorotate();
    }
  }

  // ✅ 修正部分：infoHotspotクリックでズーム＋リンク表示
  function createInfoHotspotElement(hotspot, view) {
    var wrapper = document.createElement('div');
    wrapper.classList.add('hotspot', 'info-hotspot');

    var icon = document.createElement('img');
    icon.src = 'img/info.png';
    icon.classList.add('info-hotspot-icon');
    wrapper.appendChild(icon);

    var tooltip = document.createElement('div');
    tooltip.classList.add('hotspot-tooltip');
    tooltip.innerHTML = hotspot.title;
    wrapper.appendChild(tooltip);

    wrapper.addEventListener('click', function() {
      stopAutorotate();

      // 寄る動作（1秒でズーム）
      view.lookTo({ yaw: hotspot.yaw, pitch: hotspot.pitch, fov: Math.PI/6 }, { duration: 1000 });

      setTimeout(function() {
        openMediaModal(hotspot.title);
      }, 1000);
    });

    return wrapper;
  }

  // ✅ モーダル作成関数（画像・動画両対応）
  function openMediaModal(title) {
    const mapping = {
      "仙台駅": "sendaieki.jpg",
      "サンモール1番街": "sunmool.jpg",
      "五橋中学校": "itutu.jpg",
      "仙台市立片平丁小学校": "katahira.jpg",
      "仙台城跡": "jyousi.jpg",
      "コスモス大手町保育園": "cosmos.jpg",
      "大町西公園駅": "omachi nishi koen.mp4",
      "西公園": "Nishi park.mp4",
      "仙台市立立町小学校": "tachimachisho.jpg",
      "東北公済病院": "kyosaibyoin.jpg"
    };

    const file = mapping[title.replace(/<[^>]+>/g, '')];
    if (!file) return;

    const ext = file.split('.').pop().toLowerCase();
    const modal = document.createElement('div');
    modal.classList.add('media-modal');
    modal.innerHTML = `
      <div class="media-content">
        ${ext === 'mp4'
          ? `<video src="${file}" controls autoplay></video>`
          : `<img src="${file}" alt="${title}">`}
        <span class="close-btn">×</span>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('.close-btn').addEventListener('click', () => modal.remove());
  }

  switchScene(scenes[0]);
})();
