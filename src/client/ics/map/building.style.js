goog.provide('ics.map.building.STYLE');
goog.provide('ics.map.building.style');

goog.require('ics.map.cluster.style');
goog.require('ics.map.complex');
goog.require('ics.map.floor');
goog.require('ics.map.geom');
goog.require('ics.map.marker.style');
goog.require('ics.map.range');
goog.require('ics.map.store');
goog.require('ics.map.style');
goog.require('ol.Feature');
goog.require('ol.style.Circle');
goog.require('ol.style.Fill');
goog.require('ol.style.Stroke');
goog.require('ol.style.Style');
goog.require('ol.style.Text');


/**
 * @type {Object.<string, ol.style.Style|Array.<ol.style.Style>>}
 * @protected
 * @const
 */
ics.map.building.style.LABEL_CACHE = {};


/**
 * Styles corresponding different resolutions.
 * @type {Object.<number, ol.style.Style|Array.<ol.style.Style>>}
 * @protected
 * @const
 */
ics.map.building.style.WHITE_TO_GREY_CACHE = {};


/**
 * @type {ol.style.Fill}
 * @protected
 * @const
 */
ics.map.building.style.FILL = new ol.style.Fill({
  color: '#ffffff'
});


/**
 * @type {ol.style.Stroke}
 * @protected
 * @const
 */
ics.map.building.style.STROKE = new ol.style.Stroke({
  color: '#002776',
  width: 1
});


/**
 * @type {ol.style.Style}
 * @protected
 * @const
 */
ics.map.building.STYLE = new ol.style.Style({
  fill: ics.map.building.style.FILL,
  stroke: ics.map.building.style.STROKE
});


/**
 * @type {ol.style.Style}
 * @const
 */
ics.map.building.style.NO_GEOMETRY = new ol.style.Style({
  fill: ics.map.style.NO_GEOMETRY_FILL,
  stroke: ics.map.building.style.STROKE
});


/**
 * @type {number}
 */
ics.map.building.style.FONT_SIZE = 13;


/**
 * @type {number}
 */
ics.map.building.style.BIG_FONT_SIZE = 15;


/**
 * @param {ics.map.style.MarkersAwareOptions} options
 * @param {ol.Feature|ol.render.Feature} feature
 * @param {number} resolution
 * @return {ol.style.Style|Array.<ol.style.Style>}
 */
ics.map.building.style.function =
    function(options, feature, resolution) {
  goog.asserts.assertInstanceof(feature, ol.Feature);
  var resColor = ics.map.style.RESOLUTION_COLOR.find(
      function(obj, i, arr) {
        return resolution > obj.resolution || i === (arr.length - 1);
      });

  var markerSource = options.markerSource;
  var markers = markerSource.getFeatures();
  var marked = markers.indexOf(feature) >= 0;
  if (marked) {
    if (!ics.map.range.contains(
        ics.map.cluster.BUILDING_RESOLUTION, resolution)) {
      var result;
      if (ics.map.building.hasInnerGeometry(feature)) {
        if (ics.map.marker.style.WHITE_TO_GREY_CACHE[resColor.resolution]) {
          result =
              ics.map.marker.style.WHITE_TO_GREY_CACHE[resColor.resolution];
        } else {
          result = new ol.style.Style({
            fill: new ol.style.Fill({
              color: resColor.color
            }),
            stroke: ics.map.marker.style.BUILDING_STROKE
          });
          ics.map.marker.style.WHITE_TO_GREY_CACHE[resColor.resolution] =
              result;
        }
      } else {
        result = ics.map.marker.style.NO_GEOMETRY_BUILDING;
      }
    } else {
      result = ics.map.building.STYLE;
    }
  } else {
    if (ics.map.building.hasInnerGeometry(feature)) {
      if (ics.map.building.style.WHITE_TO_GREY_CACHE[resColor.resolution]) {
        result =
            ics.map.building.style.WHITE_TO_GREY_CACHE[resColor.resolution];
      } else {
        result = new ol.style.Style({
          fill: new ol.style.Fill({
            color: resColor.color
          }),
          stroke: ics.map.building.style.STROKE
        });
        ics.map.building.style.WHITE_TO_GREY_CACHE[resColor.resolution] =
            result;
      }
    } else {
      result = ics.map.building.style.NO_GEOMETRY;
    }
  }
  var map = options.map;
  goog.asserts.assertInstanceof(map, ol.Map);
  var activeBuilding = ics.map.getVars(map).activeBuilding;
  var isActive = activeBuilding &&
      activeBuilding === ics.map.building.getLocationCode(feature);
  if (isActive &&
      ics.map.range.contains(ics.map.floor.RESOLUTION, resolution)) {
    var selectedFill = new ol.style.Fill({
      color: result.getFill().getColor()
    });
    var selectedStroke = new ol.style.Stroke({
      color: result.getStroke().getColor(),
      width: 2 * result.getStroke().getWidth()
    });
    result = new ol.style.Style({
      fill: selectedFill,
      stroke: selectedStroke
    });
  }
  return result;
};


/**
 * @param {ics.map.marker.style.labelFunction.Options} options
 * @param {ol.Feature|ol.render.Feature} feature
 * @param {number} resolution
 * @return {ol.style.Style|Array.<ol.style.Style>}
 */
ics.map.building.style.labelFunction =
    function(options, feature, resolution) {
  goog.asserts.assertInstanceof(feature, ol.Feature);
  var markerSource = options.markerSource;
  var markers = markerSource.getFeatures();
  var marked = markers.indexOf(feature) >= 0;
  var isActive = ics.map.building.isActive(feature, options.map);

  var result = null;
  if (!marked && resolution < ics.map.complex.RESOLUTION.max &&
      (!isActive || (isActive &&
          !ics.map.range.contains(ics.map.floor.RESOLUTION, resolution)))) {
    var geometryFunction = goog.partial(
        ics.map.geom.INTERSECT_CENTER_GEOMETRY_FUNCTION, options.map);
    var units = ics.map.building.getUnits(feature);
    var opts = {
      fill: ics.map.style.TEXT_FILL,
      fontSize: ics.map.building.style.FONT_SIZE,
      geometry: geometryFunction
    };
    if (!ics.map.range.contains(ics.map.floor.RESOLUTION, resolution)) {
      if (units.length > 0) {
        if (resolution < ics.map.cluster.BUILDING_RESOLUTION.min) {
          var title;
          var complex = ics.map.building.getComplex(feature);
          if (ics.map.range.contains(ics.map.complex.RESOLUTION, resolution) &&
              goog.isDefAndNotNull(complex) &&
              ics.map.complex.getBuildingCount(complex) > 1) {
            title = ics.map.unit.getTitleParts(units).join('\n');
          } else {
            title = ics.map.building.getLabel(feature, resolution);
          }
          if (goog.isDef(title)) {
            opts.title = title;
            result = ics.map.style.getLabelWithPin(opts);
          }
        }
      } else if (resolution < ics.map.complex.RESOLUTION.min) {
        result = ics.map.building.style.defaultLabelFunction(
            options.map, feature, resolution);
      }
    } else {
      var uid = ics.map.store.getUid(feature);
      if (uid) {
        goog.asserts.assertString(uid);
        if (ics.map.building.style.LABEL_CACHE[uid]) {
          return ics.map.building.style.LABEL_CACHE[uid];
        }
      }
      var title = ics.map.building.getLabel(feature, resolution);
      if (goog.isDef(title)) {
        if (units.length > 0) {
          opts.title = title;
          result = ics.map.style.getLabelWithPin(opts);
        } else {
          result = new ol.style.Style({
            geometry: geometryFunction,
            text: new ol.style.Text({
              font: 'bold ' + ics.map.building.style.BIG_FONT_SIZE + 'px arial',
              fill: ics.map.style.TEXT_FILL,
              stroke: ics.map.style.TEXT_STROKE,
              text: title
            }),
            zIndex: 4
          });
        }
      }
      if (uid) {
        goog.asserts.assertString(uid);
        ics.map.building.style.LABEL_CACHE[uid] = result;
      }
    }
  }
  return result;
};


/**
 * @param {ol.Map} map
 * @param {ol.Feature|ol.render.Feature} feature
 * @param {number} resolution
 * @return {ol.style.Style|Array<ol.style.Style>}
 * @protected
 */
ics.map.building.style.defaultLabelFunction =
    function(map, feature, resolution) {
  var uid = ics.map.store.getUid(feature);
  if (uid) {
    goog.asserts.assertString(uid);
    if (ics.map.style.LABEL_CACHE[uid]) {
      return ics.map.style.LABEL_CACHE[uid];
    }
  }

  var title = ics.map.style.getDefaultLabel(feature, resolution);
  var textStyle = new ol.style.Style({
    geometry: goog.partial(
        ics.map.geom.INTERSECT_CENTER_GEOMETRY_FUNCTION, map),
    text: new ol.style.Text({
      font: 'bold ' + ics.map.building.style.FONT_SIZE + 'px arial',
      fill: ics.map.style.TEXT_FILL,
      stroke: ics.map.style.TEXT_STROKE,
      text: title
    }),
    zIndex: 4
  });

  if (uid) {
    goog.asserts.assertString(uid);
    ics.map.style.LABEL_CACHE[uid] = textStyle;
  }
  return textStyle;
};
