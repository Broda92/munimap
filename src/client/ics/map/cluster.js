goog.provide('ics.map.cluster');
goog.provide('ics.map.cluster.style');

goog.require('goog.array');
goog.require('goog.object');
goog.require('ics.map.marker.style');
goog.require('ics.map.range');
goog.require('ol.Feature');


/**
 * @type {ics.map.Range}
 * @const
 */
ics.map.cluster.ROOM_RESOLUTION =
    ics.map.range.createResolution(1.19, Number.POSITIVE_INFINITY);


/**
 * @type {ics.map.Range}
 * @const
 */
ics.map.cluster.BUILDING_RESOLUTION =
    ics.map.range.createResolution(2.39, Number.POSITIVE_INFINITY);


/**
 * @type {string}
 * @const
 */
ics.map.cluster.LAYER_ID = 'markercluster';


/**
 * @enum {ics.map.Range}
 * @const
 * @protected
 */
ics.map.cluster.Resolutions = {
  MARKERS_ONLY: ics.map.range.createResolution(0, 2.39),
  MARKERS_AND_UNITS: ics.map.range.createResolution(2.39, 9),
  MARKERS_AND_FACULTIES:
      ics.map.range.createResolution(9, Number.POSITIVE_INFINITY)
};


/**
 * @param {ol.Map} map
 * @param {number|ics.map.Range} resolution
 * @return {Array<ol.Feature>}
 * @protected
 */
ics.map.cluster.getClusteredFeatures = function(map, resolution) {
  var range = goog.isNumber(resolution) ?
      ics.map.cluster.getResolutionRange(resolution) : resolution;
  var ranges = ics.map.cluster.Resolutions;
  var result;
  var markers = ics.map.marker.getFeatures(map).concat();
  var bldgs = ics.map.building.STORE.getFeatures();
  switch (range) {
    case ranges.MARKERS_ONLY:
      result = markers;
      break;
    case ranges.MARKERS_AND_UNITS:
      result = markers.concat(ics.map.building.filterHeadquaters(bldgs));
      break;
    case ranges.MARKERS_AND_FACULTIES:
      result = markers.concat(
          ics.map.building.filterFacultyHeadquaters(bldgs)
          );
      break;
  }
  result = result || [];
  goog.array.removeDuplicates(result);
  return result;
};


/**
 * @param {number} resolution
 * @return {ics.map.Range}
 * @protected
 */
ics.map.cluster.getResolutionRange = function(resolution) {
  return goog.object.findValue(ics.map.cluster.Resolutions, function(range) {
    return ics.map.range.contains(range, resolution);
  });
};


/**
 * @param {ol.Feature} feature
 * @return {boolean}
 */
ics.map.cluster.isCluster = function(feature) {
  var clusteredFeatures = feature.get('features');
  return goog.isArray(clusteredFeatures) &&
      clusteredFeatures.every(function(f) {
        return f instanceof ol.Feature;
      });
};


/**
 * @param {ol.Feature} feature
 * @return {Array.<ol.Feature>}
 */
ics.map.cluster.getFeatures = function(feature) {
  return ics.map.cluster.isCluster(feature) ?
      /** @type {Array.<ol.Feature>} */(feature.get('features')) : [];
};


/**
 * @param {ol.Map} map
 * @return {ol.layer.Vector}
 */
ics.map.cluster.getLayer = function(map) {
  var layers = map.getLayers().getArray();
  var result = layers.find(ics.map.cluster.isLayer);
  goog.asserts.assertInstanceof(result, ol.layer.Vector);
  return result;
};


/**
 * @param {ol.layer.Base} layer
 * @return {boolean}
 */
ics.map.cluster.isLayer = function(layer) {
  return layer.get('id') === ics.map.cluster.LAYER_ID;
};


/**
 * @param {ol.Map} map
 * @return {ol.source.Vector}
 */
ics.map.cluster.getStore = function(map) {
  var layer = ics.map.cluster.getLayer(map);
  var result = layer.getSource();
  return result;
};


/**
 * @param {ol.Map} map
 * @return {ol.source.Vector}
 */
ics.map.cluster.getSource = function(map) {
  var clusterStore = ics.map.cluster.getStore(map);
  goog.asserts.assertInstanceof(clusterStore, ol.source.Cluster);
  return clusterStore.getSource();
};


/**
 * @param {ol.Map} map
 * @return {Array.<ol.Feature>}
 * @protected
 */
ics.map.cluster.getSourceFeatures = function(map) {
  var source = ics.map.cluster.getSource(map);
  return source.getFeatures();
};


/**
 * @param {ol.Map} map
 * @param {ol.Feature} cluster
 * @return {boolean}
 */
ics.map.cluster.containsMarker = function(map, cluster) {
  var markers = ics.map.marker.getFeatures(map);
  var clusteredFeatures = cluster.get('features');
  return clusteredFeatures.some(function(feat) {
    return goog.array.contains(markers, feat);
  });
};


/**
 * @param {ol.render.Event} evt
 */
ics.map.cluster.handleMapPrecomposeEvt = function(evt) {
  var map = /**@type {ol.Map}*/(evt.target);
  var mapVars = ics.map.getVars(map);
  var viewState = evt.frameState.viewState;

  var oldRes = mapVars.currentResolution;
  var res = viewState.resolution;

  var oldRange = ics.map.cluster.getResolutionRange(oldRes);
  var range = ics.map.cluster.getResolutionRange(res);

  if (range !== oldRange) {
    ics.map.cluster.updateClusteredFeatures(map, res);
  }

  mapVars.currentResolution = res;
};


/**
 * @param {ol.Map} map
 * @param {number} resolution
 */
ics.map.cluster.updateClusteredFeatures = function(map, resolution) {
  var oldFeatures = ics.map.cluster.getSourceFeatures(map);
  var features = ics.map.cluster.getClusteredFeatures(map, resolution);
  var allFeatures = oldFeatures.concat(features);
  goog.array.removeDuplicates(allFeatures);

  var bucket = goog.array.bucket(allFeatures, function(feature) {
    if (oldFeatures.indexOf(feature) >= 0 &&
        features.indexOf(feature) < 0) {
      return 'remove';
    } else if (oldFeatures.indexOf(feature) < 0 &&
        features.indexOf(feature) >= 0) {
      return 'add';
    } else {
      return undefined;
    }
  });

  var featuresToRemove = bucket['remove'] || [];
  var featuresToAdd = bucket['add'] || [];

  var source = ics.map.cluster.getSource(map);
  featuresToRemove.forEach(function(feature) {
    source.removeFeature(feature);
  });
  source.addFeatures(featuresToAdd);
};


/**
 * @type {number}
 * @protected
 * @const
 */
ics.map.cluster.style.RADIUS = 12;


/**
 * @type {ol.style.Style}
 * @protected
 * @const
 */
ics.map.cluster.style.MULTIPLE = new ol.style.Style({
  image: new ol.style.Circle({
    radius: ics.map.cluster.style.RADIUS,
    fill: ics.map.style.TEXT_FILL,
    stroke: new ol.style.Stroke({
      color: '#ffffff',
      width: 2
    })
  })
});


/**
 * @type {ol.style.Style}
 * @protected
 * @const
 */
ics.map.cluster.style.MULTIPLE_MARKED = new ol.style.Style({
  image: new ol.style.Circle({
    radius: ics.map.cluster.style.RADIUS,
    fill: ics.map.marker.style.FILL,
    stroke: new ol.style.Stroke({
      color: '#ffffff',
      width: 3
    })
  })
});


/**
 * @param {ics.map.marker.style.labelFunction.Options} options
 * @param {ol.Feature|ol.render.Feature} feature
 * @param {number} resolution
 * @return {ol.style.Style|Array.<ol.style.Style>}
 */
ics.map.cluster.style.function = function(options, feature, resolution) {
  goog.asserts.assertInstanceof(feature, ol.Feature);
  var features = ics.map.cluster.getFeatures(feature);
  var result;
  if (features.length > 1) {
    result = [];
    var circleStyle;
    var labelStyle = ics.map.cluster.style.multipleLabelFunction(
        options, feature, resolution);
    if (goog.isDefAndNotNull(labelStyle)) {
      result.push(labelStyle);
    }
    if (ics.map.cluster.containsMarker(options.map, feature)) {
      var markers = options.markerSource.getFeatures();
      var markedFeatures = features.filter(function(feat) {
        return goog.array.contains(markers, feat);
      });
      circleStyle = new ol.style.Style({
        geometry: ics.map.geom.getGeometryCenterOfFeatures(markedFeatures),
        image: new ol.style.Circle({
          radius: ics.map.cluster.style.RADIUS,
          fill: ics.map.marker.style.FILL,
          stroke: new ol.style.Stroke({
            color: '#ffffff',
            width: 3
          })
        }),
        zIndex: 7
      });
    } else {
      circleStyle = ics.map.cluster.style.MULTIPLE;
    }
    result.push(circleStyle);
  } else {
    result =
        ics.map.marker.style.labelFunction(options, feature, resolution);
  }
  return result;
};


/**
 * @param {ics.map.marker.style.labelFunction.Options} options
 * @param {ol.Feature|ol.render.Feature} feature
 * @param {number} resolution
 * @return {ol.style.Style}
 * @protected
 */
ics.map.cluster.style.multipleLabelFunction =
    function(options, feature, resolution) {
  goog.asserts.assertInstanceof(feature, ol.Feature);
  var map = options.map;
  var containsMarker = ics.map.cluster.containsMarker(map, feature);
  var markedFeatures;
  if (containsMarker) {
    var markers = options.markerSource.getFeatures();
    var features = ics.map.cluster.getFeatures(feature);
    markedFeatures = features.filter(function(feat) {
      return goog.array.contains(markers, feat);
    });
  }

  var title;
  if (goog.isDef(options.markerLabel)) {
    title = options.markerLabel(feature, resolution);
  }
  if (!goog.isDefAndNotNull(title)) {
    if (containsMarker) {
      var titleParts = [];
      if (ics.map.building.isBuilding(markedFeatures[0])) {
        var allUnits = ics.map.unit.getUnitsOfFeatures(markedFeatures || []);
        titleParts = ics.map.unit.getTitleParts(allUnits);
      } else {
        markedFeatures.forEach(function(room) {
          var roomTitle = ics.map.style.getDefaultLabel(room, resolution);
          if (goog.isDefAndNotNull(roomTitle)) {
            titleParts.push(roomTitle);
          }
        });
      }
      title = titleParts.join('\n');
    } else {
      title = ics.map.style.getDefaultLabel(feature, resolution);
    }
  }

  if (title) {
    var fontSize = 13;
    var offsetY = ics.map.style.getLabelHeight(title, fontSize) / 2 +
        ics.map.cluster.style.RADIUS + 2;
    var fill = containsMarker ?
        ics.map.marker.style.TEXT_FILL :
        ics.map.style.TEXT_FILL;
    var geometry = containsMarker ?
        ics.map.geom.getGeometryCenterOfFeatures(markedFeatures || []) :
        ics.map.geom.CENTER_GEOMETRY_FUNCTION;
    var textStyle = new ol.style.Style({
      geometry: geometry,
      text: new ol.style.Text({
        font: 'bold ' + fontSize + 'px arial',
        fill: fill,
        offsetY: offsetY,
        stroke: ics.map.style.TEXT_STROKE,
        text: title
      }),
      zIndex: containsMarker ? 7 : 4
    });
    return textStyle;
  } else {
    return null;
  }
};
