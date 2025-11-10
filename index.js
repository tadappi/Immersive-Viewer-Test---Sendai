'use strict';

(function() {
  var Marzipano = window.Marzipano;
  var data = window.APP_DATA;

  var panoElement = document.querySelector('#pano');
  var viewer = new Marzipano.Viewer(panoElement);

  var scenes = data.scenes.map(function(data) {
    var source = Marzipano.ImageUrlSource.fromString(
      "tiles/" + data.id + "/{z}/{f}/{y}/{x}.jpg"
    );
    var geometry = new Marzipano.CubeGeometry(data.levels);
    var view = new Marzipano.RectilinearView(data.initialViewParameters);
    var scene = viewer.createScene({
      source: source,
      geometry: geometry,
      view: view,
    });

    // infoHotspot復元＋クリック拡張
    data.infoHotspots.forEach(function(hotspot) {
      var wrapper = document.createElement('div');
      wrapper.classList.add('hotspot', 'info-hotspot');

      // headerブロック
      var header = document.createElement('div');
      header.classList.add('info-hotspot-header');

      var iconWrapper = document.createElement('div');
      iconWrapper.classList.add('info-hotspot-icon-wrapper');
      var icon = document.createElement('img');
      icon.src = 'img/info.gif';  // ← 実ファイルが.gifならここ変更
      icon.classList.add('info-hotspot-icon');
      iconWrapper.appendChild(icon);

      var titleWrapper = document.createElement('div');
      titleWrapper.classList.add('info-hotspot-title-wrapper');
      var title = document.createElement('div');
      title.classList.add('info-hotspot-title');
      title.innerHTML = hotspot.title;
      titleWrapper.appendChild(title);

      header.appendChild(iconWrapper);
      header.appendChild(titleWrapper);
      wrapper.appendChild(header);

      // 寄り＋リンクイベント追加
      wrapper.addEventListener('click', function() {
        view.lookTo({ yaw: hotspot.yaw, pitch: hotspot.pitch, fov: Math.PI / 6 }, { duration: 1000 });
        setTimeout(function() {
          openMediaModal(hotspot.title);
        }, 1000);
      });

      scene.hotspotContainer().createHotspot(wrapper, {
        yaw: hotspot.yaw,
        pitch: hotspot.pitch
      });
    });

    return { scene, view };
  });

  // 画像・動画対応モーダル
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

  scenes[0].scene.switchTo();
})();
