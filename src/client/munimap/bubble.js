goog.provide('munimap.bubble');


/**
 * @type {ol.Overlay}
 */
munimap.bubble.OVERLAY = new ol.Overlay({
  id: 'genericPopup',
  floor: 'none'
});


/**
 * @param {ol.Map} map
 * @param {munimap.Range} hideResolution
 * @param {string} detail
 * @param {number} offsetX
 * @param {number} offsetY
 * @param {Array<number>} center
 * @param {boolean} autoPan
 * @param {string} floor
 *
 * @return {ol.Overlay}
 */
munimap.bubble.create = function(map, hideResolution, detail, offsetX, offsetY,
  center, autoPan, floor) {
  var munimapEl = map.getTargetElement();
  var popupEl = goog.dom.createDom('div', 'ol-popup munimap-info' +
    ' munimap-info-bubble');
  var contentEl = goog.dom.createDom('div', 'munimap-content');
  var closeButtonEl = goog.dom.createDom('div', 'munimap-close-button');
  goog.dom.appendChild(popupEl, closeButtonEl);
  goog.dom.appendChild(popupEl, contentEl);
  goog.dom.appendChild(munimapEl, popupEl);
  contentEl.innerHTML = detail;

  var popupSize = goog.style.getSize(popupEl);
  var x = -munimap.info.POPUP_TALE_INDENT + offsetX;
  var y = -(popupSize.height + munimap.info.POPUP_TALE_HEIGHT + offsetY);

  var popup = new ol.Overlay({
    id: 'genericPopup',
    element: popupEl
  });
  munimap.bubble.OVERLAY = popup;
  munimap.bubble.OVERLAY.floor = floor;
  munimap.bubble.OVERLAY.setPosition(center);
  munimap.bubble.OVERLAY.setOffset([x, y]);

  if (autoPan) {
    var currentRes = map.getView().getResolution() || 1;
    var constrainedResolution = map.getView().constrainResolution(currentRes,
      -2, -1) || 1;
    munimap.map.zoomToPoint(map, center, constrainedResolution);
  }

  var closePopup = function() {
    map.un('moveend', checkResolution);
    map.removeOverlay(munimap.bubble.OVERLAY);
    return false;
  };

  // check if marker is visible after the zoom ends
  var ghostZoom = map.getView().getZoom();
  var checkResolution = function() {
    if (ghostZoom != map.getView().getZoom()) {
      ghostZoom = map.getView().getZoom();
      var resolution = map.getView().getResolution();
      if (resolution) {
        var isVisible = munimap.range.contains(
          hideResolution, resolution);
        if (!isVisible) {
          closePopup();
        }
      }
    }
  };

  closeButtonEl.onclick = closePopup;
  map.on('moveend', checkResolution);
  map.addOverlay(munimap.bubble.OVERLAY);
  return munimap.bubble.OVERLAY;
};


/**
 * @param {ol.Feature} feature
 * @param {ol.Map} map
 * @param {string} detail
 * @param {number=} opt_offsetX
 * @param {number=} opt_offsetY
 * @param {munimap.Range=} opt_hideResolution
 * @param {boolean=} opt_autoPan
 */
munimap.bubble.show = function(feature, map, detail, opt_offsetX, opt_offsetY,
  opt_hideResolution, opt_autoPan) {
  var offsetX = opt_offsetX || 0;
  var offsetY = opt_offsetY || 0;
  var hideResolution = opt_hideResolution || munimap.marker.RESOLUTION;
  var autoPan = opt_autoPan || false;

  var geometry = feature.getGeometry();
  var floor = feature.get('polohKod') ? feature.get('polohKod').slice(0, 8) :
    'noChange';
  var center = ol.extent.getCenter(geometry.getExtent());
  if (!geometry.intersectsCoordinate(center) && geometry
    instanceof ol.geom.MultiPolygon || geometry instanceof ol.geom.Polygon) {
    center = munimap.geom.getBetterInteriorPoint(geometry);
    center = center.getCoordinates();
  }
  map.removeOverlay(munimap.bubble.OVERLAY);
  munimap.bubble.create(map, hideResolution, detail, offsetX, offsetY,
    center, autoPan, floor);
};



