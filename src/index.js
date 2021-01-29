//
// ol-gsibv-style
//
import 'ol/ol.css';
import 'ol-layerswitcher/src/ol-layerswitcher.css';
import 'ol-popup/src/ol-popup.css';
import './index.css';
import Map from 'ol/Map';
import View from 'ol/View';
import {fromLonLat} from 'ol/proj';
import {defaults} from 'ol/control';
import VectorTileLayer from 'ol/layer/VectorTile';
import VectorTile from 'ol/source/VectorTile';
import MVT from 'ol/format/MVT';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import LayerGroup from 'ol/layer/Group';
import Fill from 'ol/style/Fill';
import Stroke from 'ol/style/Stroke';
import Icon from 'ol/style/Icon';
import Text from 'ol/style/Text';
import Style from 'ol/style/Style';
import {asArray} from 'ol/color';
import LayerSwitcher from 'ol-layerswitcher';
import Popup from 'ol-popup';

const param = {
  lon: 139.435076, lat: 36.354746, zoom: 15,
  url: 'https://anineco.org/200411/routemap.geojson'
};
location.search.slice(1).split('&').forEach(function (ma) {
  const s = ma.split('=');
  if (s[0] === 'url') {
    param[s[0]] = decodeURIComponent(s[1]);
  } else if (s[0] in param) {
    param[s[0]] = Number(s[1]);
  }
});

function identifier(e, feature) {
  if (Array.isArray(e) && e.length == 2 && e[0] == 'get') {
    e = e[1];
  }
  return (e == '$type') ? feature.getGeometry().getType() : feature.get(e);
}

function evaluate(e, feature) {
  if (e == null || !Array.isArray(e)) {
    return true;
  }
  while (e.length <= 2 && (e[0] == 'all' || e[0] == 'any')) {
    if (e.length == 1) {
      return true;
    }
    e = e[1];
  }
  let v;
  switch (e[0]) {
    case 'has': return e[1] in feature.getProperties();
    case '!has': return !(e[1] in feature.getProperties());
    case '==': return identifier(e[1], feature) == e[2];
    case '!=': v = identifier(e[1], feature); return v != null && v != e[2]; // return false if key is not in 'feature'
    case '>=': v = identifier(e[1], feature); return v != null && v >= e[2];
    case '<=': v = identifier(e[1], feature); return v != null && v <= e[2];
    case '>': v = identifier(e[1], feature); return v != null && v > e[2];
    case '<': v = identifier(e[1], feature); return v != null && v < e[2];
    case 'in': v = identifier(e[1], feature); return v != null && e.slice(2).some(x => v == x);
    case 'all': return e.slice(1).every(x => evaluate(x, feature));
    case 'any': return e.slice(1).some(x => evaluate(x, feature));
    default:
  }
  throw new Error(`operator "${e[0]}" is not supported`);
}

function interpolate(x, x0, y0, x1, y1) {
  return y0 + (y1 - y0) * ((x - x0) / (x1 - x0));
}

function stops(e, zoom) {
  if (e.stops) {
    e = e.stops;
    if (zoom < e[0][0]) {
      return e[0][1];
    }
    for (let i = 0; i < e.length - 1; i++) {
      if (zoom >= e[i][0] && zoom < e[i+1][0]) {
        return interpolate(zoom, e[i][0], e[i][1], e[i+1][0], e[i+1][1]);
      }
    }
    return e[e.length-1];
  }
  if (Array.isArray(e) && e[0] == 'interpolate') {
    // assume 'linear' and 'zoom'
    // e[1] = ['linear']
    // e[2] = ['zoom']
    if (zoom < e[3]) {
      return e[4];
    }
    for (let i = 3; i < e.length - 2; i += 2) {
      if (zoom >= e[i] && zoom < e[i+2]) {
        return interpolate(zoom, e[i], e[i+1], e[i+2], e[i+3]);
      }
    }
    return e[e.length-1];
  }
  return e;
}

function expression(e, feature) {
  if (!Array.isArray(e) || typeof e[0] == 'number') {
    return e;
  }
  switch (e[0]) {
    case 'literal': return e[1];
    case 'get': return feature.get(e[1]);
    case 'has': return e[1] in feature.getProperties();
//  case 'to-number': return Number(expression(e[1], feature));
//  case 'to-string': return String(expression(e[1], feature));
//  case 'round': return Math.round(expression(e[1], feature));
//  case '!': return !(expression(e[1], feature));
//  case 'in': return e[2].indexOf(expression(e[1], feature));
    case '==': return expression(e[1], feature) == expression(e[2], feature);
//  case '*': return expression(e[1], feature) * expression(e[2], feature);
//  case '+': return expression(e[1], feature) + expression(e[2], feature);
//  case '/': return expression(e[1], feature) / expression(e[2], feature);
    case 'case':
      for (let i = 1; i < e.length - 2; i += 2) {
        if (expression(e[i], feature)) {
          return expression(e[i+1], feature);
        }
      }
      return expression(e[e.length-1], feature);
    case 'any': return e.slice(1).some(v => expression(v, feature));
    default:
      throw new Error(`operator "${e[0]}" is not supported`);
  }
  return e;
}

let glStyle;
const glGroup = {};

const glImage = new Image();
glImage.crossOrigin = 'anonymous';
let glSprite;

const std = new TileLayer({
  source: new XYZ({
    url: 'https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png',
    attributions: '<a href="https://maps.gsi.go.jp/development/ichiran.html">地理院タイル</a>'
  }),
  title: 'ラスタ',
  type: 'base',
  visible: false
});

const view = new View({
  center: fromLonLat([param.lon, param.lat]),
  maxZoom: 17,
  minZoom: 5,
  zoom: param.zoom
});

const empty = {};
const anchors = {
  LT: 'top-left',    CT: 'top',    RT: 'top-right',
  LC: 'left',        CC: 'center', RC: 'right',
  LB: 'bottom-left', CB: 'bottom', RB: 'bottom-right'
};
const offsets = {
  LT: [0.5, 0.5], CT: [0, 0.5], RT: [-0.5, 0.5],
  LC: [0.5, 0  ], CC: [0, 0  ], RC: [-0.5, 0  ],
  LB: [0.5,-0.5], CB: [0,-0.5], RB: [-0.5,-0.5]
};

const hatch_cache = {};

function hatch(type, color, bgColor) {
  const id = type + ':' + color + ':' + bgColor; // color, bgColor are assumed to be string
  if (id in hatch_cache) {
    return hatch_cache[id];
  }
  const c = asArray(color).slice(); // the return value of 'asArray' should not be modified
  c[3] = parseInt(c[3] * 255);
  const b = asArray(bgColor).slice();
  b[3] = parseInt(b[3] * 255);
  const size = (type == 'minus') ? 12 : 4;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(size, size);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    data[i + 0] = b[0];
    data[i + 1] = b[1];
    data[i + 2] = b[2];
    data[i + 3] = b[3];
  }
  switch (type) {
    case 'cross':
    case 'ltrb':
    case 'rtlb':
      if (type != 'rtlb') {
        for (let y = 0; y < size; y++) {
          const x = y;
          const idx = (y * size + x) * 4;
          data[idx + 0] = c[0];
          data[idx + 1] = c[1];
          data[idx + 2] = c[2];
          data[idx + 3] = c[3];
        }
      }
      if (type != 'ltrb') {
        for (let y = 0; y < size; y++) {
          const x = (size - 1) - y;
          const idx = (y * size + x) * 4;
          data[idx + 0] = c[0];
          data[idx + 1] = c[1];
          data[idx + 2] = c[2];
          data[idx + 3] = c[3];
        }
      }
      break;
    case 'minus':
      for (let x = 1; x < size; x++) {
        const y = 3;
        const idx = (y * size + x) * 4;
        data[idx + 0] = c[0];
        data[idx + 1] = c[1];
        data[idx + 2] = c[2];
        data[idx + 3] = c[3];
      }
      for (let x = 0; x < size - 1; x++) {
        const y = 9;
        const idx = (y * size + x) * 4;
        data[idx + 0] = c[0];
        data[idx + 1] = c[1];
        data[idx + 2] = c[2];
        data[idx + 3] = c[3];
      }
      break;
    case 'dot':
      const x = 1;
      const y = 2;
      const idx = (y * size + x) * 4;
      data[idx + 0] = c[0];
      data[idx + 1] = c[1];
      data[idx + 2] = c[2];
      data[idx + 3] = c[3];
      break;
    default:
      throw new Error(`fill-type "${type}" is not supported`);
  }
  ctx.putImageData(imageData, 0, 0);
  return hatch_cache[id] = ctx.createPattern(canvas, 'repeat');
}

function gsibvSetStyleOpts(opts, item, feature, zoom) {
  const info = item.info ?? empty;
  const draw = item.draw ?? empty;
  let e;
  switch (item.type) {
    case 'fill':
      const color = draw['fill-color'] ?? '#000000';
      if (draw['fill-visible']) {
        if ((e = draw['fill-style']) && e != 'fill') {
          const bgColor = draw['fill-hatch-bgcolor'] ?? '#ffffff';
          opts.fill = new Fill({
            color: hatch(e, color, bgColor)
          });
        } else {
          opts.fill = new Fill({
            color: color
          });
        }
      }
      if (draw['outline-visible']) {
        const width = draw['outline-width'] ?? 1;
        const lineDash = (e = draw['outline-dasharray']) ? e.map(v => v * width) : null;
        opts.stroke = new Stroke({
          color: draw['outline-color'] ?? '#000000',
          lineDash: lineDash,
          width: width
        });
      }
      break;
    case 'line':
      if (draw['line-visible']) {
        const width = stops(draw['line-width'], zoom) ?? 1;
        e = draw['line-dasharray'];
        // change line-cap to 'butt' for outline and dash with narrow gap
        const lineCap = (e && e[1] < 3 || draw['line-role'] == 'outline') ? 'butt' : (draw['line-cap'] ?? 'butt');
        const lineDash = e ? e.map(v => v * width) : null;
        opts.stroke = new Stroke({
          color: draw['line-color'] ?? '#000000',
          lineCap: lineCap,
          lineJoin: draw['line-join'] ?? 'miter',
          miterLimit: draw['line-miter-limit'] ?? 2,
          lineDash: lineDash,
          width: width
        });
      }
      break;
    case 'symbol':
      if (draw['icon-visible'] && (e = draw['icon-image'])) {
        const icon = glSprite[e] || e.startsWith('滝') && glSprite['滝']; // HACK: sprite for '滝（領域）-20' is missing
        if (icon) {
          opts.image = new Icon({
//          can't assign to readonly property
//          anchor: draw['icon-anchor'] ?? 'center',
            crossOrigin: 'anonymous',
            img: glImage,
            imgSize: [glImage.width, glImage.height],
            offset: [icon.x, icon.y],
            size: [icon.width, icon.height],
            scale: stops(draw['icon-size'], zoom) ?? 1,
            rotateWithView: !(draw['icon-rotation-alignment'] == 'map')
          });
        } else {
          throw new Error(`missing "${e}" in sprite image`);
        }
      }
      if (draw['text-visible']) {
        let text = (e = info['text-field']) && feature.get(expression(e, feature));
        if (e = info['text-field-round']) {
          if (e == 10) {
            const s = String(Math.round(text * 10));
            text = s.slice(0, -1) + '.' + s.slice(-1);
          } else if (e == 1) {
            text = Math.round(text);
          }
        }
        const textSize = Math.round(stops(draw['text-size'], zoom) ?? 16);

        let vertical = false;
        if (e = draw['text-vertical']) {
          if (e != 'auto') {
            vertical = e;
          } else if (e = info['text-vertical-field']) {
            vertical = feature.get(e) == 2; // vertical writing
          }
        }

        let anchor = 'center';
        if (e = draw['text-anchor']) {
          if (e != 'auto') {
            anchor = e;
          } else if (e = info['text-anchor-field']) {
            anchor = anchors[feature.get(e) ?? 'CC'];
          }
        }
        const i = anchor.indexOf('-');
        const textAlign = i < 0 ? anchor : anchor.substring(i + 1);
        const textBaseline = i < 0 ? 'middle' : anchor.substring(0, i);

        let offset = [0, 0];
        if (e = draw['text-offset']) {
          if (e == 'auto') {
            offset = offsets[feature.get('dspPos') ?? 'CC']; // FIXME: is this OK?
          } else if (Array.isArray(e) && typeof e[0] == 'string') {
            offset = expression(e, feature);
          } else {
            offset = e;
          }
        }

        let rotation = 0;
        if (e = draw['text-rotate']) {
          if (e != 'auto') {
            rotation = e;
          } else if (e = info['text-rotate-field']) {
            rotation = feature.get(e) ?? 0;
          }
          if (vertical) {   // TODO: vertical writing
            if (Math.abs(rotation - 90) < 5 || Math.abs(rotation - 270) < 5) {
              rotation = 0;
            } else if (rotation > 90 && rotation < 270) {
              rotation -= 180;
            }
          }
          if (rotation > 180) {
            rotation -= 360;
          }
          rotation = -rotation;
        }

        opts.text = new Text({
          font: '16px "Noto Sans JP"', // TODO: use pbf font
          maxAngle: (draw['text-max-angle'] ?? 45) * Math.PI / 180,
          offsetX: offset[0] * textSize,
          offsetY: offset[1] * textSize,
          placement: draw['symbol-placement'] ?? 'point',
          scale: textSize / 16,
          rotateWithView: !(draw['text-rotation-alignment'] == 'map'),
          rotation: rotation * Math.PI / 180,
          text: String(text),
          textAlign: textAlign,
          textBaseline: textBaseline,
          fill: new Fill({
            color: draw['text-color'] ?? '#000000'
          }),
          stroke: new Stroke({
            color: draw['text-halo-color'] ?? 'rgba(0,0,0,0)',
            width: draw['text-halo-width'] ?? 0
          }),
          padding: new Array(4).fill(draw['text-padding'] ?? 2)
        });
      }
      break;
    default:
      throw new Error(`item type "${item.type}" is not known`);
  }
}

function gsibvSearchItem(styles, item, feature, zoom) {
  const source_layer = feature.get('layer');
  if ('source-layer' in item && item['source-layer'] != source_layer) {
    return false;
  }
  if (!evaluate(item.filter, feature)) {
    return false;
  }
  for (let id of item.group) {
    let line_role = null;
    const group = glGroup[id];
    if (!group) {
      continue;
    }
    if ('zoom' in group && !group.zoom.some(z => z == zoom)) {
      continue;
    }
    if ('filter' in group) {
      for (let e of group.filter) {
        if (Array.isArray(e) && e.length == 3 && e[1] == 'line-role' && e[2] == 'outline') {
          line_role = (e[0] == '=='); // 'line-role' == 'outline'
        }
      }
    }
    if (!evaluate(group['additional-filter'], feature)) {
      continue;
    }
    for (let layer of item.list) {
      if ('source-layer' in layer && layer['source-layer'] != source_layer) {
        continue;
      }
      if ('minzoom' in layer && zoom < layer.minzoom || 'maxzoom' in layer && zoom > layer.maxzoom) {
        continue;
      }
      if (!evaluate(layer.filter, feature)) {
        continue;
      }
      for (let x of layer.list) {
        if ('source-layer' in x && x['source-layer'] != source_layer) {
          continue;
        }
        if ('minzoom' in x && zoom < x.minzoom || 'maxzoom' in x && zoom > x.maxzoom) {
          continue;
        }
        if (!evaluate(x.filter, feature)) {
          continue;
        }
        if (line_role != null && line_role != (x.draw['line-role'] == 'outline')) {
          continue;
        }
        const opts = {};
        gsibvSetStyleOpts(opts, x, feature, zoom);
        opts.zIndex = item.zIndex ?? (opts.text ? 999 : undefined); // FIXME:
        styles.push(new Style(opts));
      }
    }
  }
  return styles.length > 0;
}

function gsibvSearchStyle(styles, item, feature, zoom) {
  if (item.type == 'item') {
    return gsibvSearchItem(styles, item, feature, zoom); 
  } // else 'directory'
  return item.list.some(list => gsibvSearchStyle(styles, list, feature, zoom));
}

function gsibvStyleFunction(feature, resolution) {
  const zoom = Math.floor(view.getZoomForResolution(resolution)) - 1; // zoom of MVT layer differs -1 from ol zoom
  const styles = [];
  glStyle.list.some(item => gsibvSearchStyle(styles, item, feature, zoom));
  return styles;
}

const gsibv = new VectorTileLayer({
  source: new VectorTile({
    format: new MVT(),
    url: 'https://cyberjapandata.gsi.go.jp/xyz/experimental_bvmap/{z}/{x}/{y}.pbf',
    attributions: "<a href='https://maps.gsi.go.jp/vector/' target='_blank'>地理院地図Vector（仮称）</a>"
  }),
  maxZoom: 17,
  minZoom: 4,
  style: gsibvStyleFunction,
  declutter: true, // mandatory to avoid text clipping at tile edge
  title: 'ベクタ',
  type: 'base'
});

const bases = new LayerGroup({
  layers: [std, gsibv],
  title: '地図の種類'
});

const map = new Map({
  target: 'map',
  view: view,
  controls: defaults()
});
map.addControl(new LayerSwitcher());

const popup = new Popup();
map.addOverlay(popup);

const sprite_base = 'https://gsi-cyberjapan.github.io/gsivectortile-mapbox-gl-js/sprite/std';

Promise.all([
  fetch('https://maps.gsi.go.jp/vector/data/std.json')
    .then(response => response.json())
    .then(result => glStyle = result),
  fetch(sprite_base + '.json')
    .then(response => response.json())
    .then(result => glSprite = result),
  fetch(sprite_base + '.png')
    .then(response => response.blob())
    .then(result => glImage.src = URL.createObjectURL(result))
]).then(() => {
  for (let group of glStyle.group) {
    glGroup[group.id] = group;
  }
  map.addLayer(bases);
});

function getHtml(feature) {
  const p = feature.getProperties();
  return '<h2>属性一覧</h2><table><tbody><tr><td>'
    + Object.keys(p).map(i => i + '</td><td>' + p[i]).join('</td></tr><tr><td>')
    + '</td></tr></tbody></table>';
}

map.on('click', function (evt) {
  map.forEachFeatureAtPixel(
    evt.pixel,
    function (feature, layer) {
      const geometry = feature.getGeometry();
      if (geometry.getType() !== 'Point') {
        return false;
      }
      popup.show(geometry.getFlatCoordinates(), getHtml(feature));
      return true;
    }
  );
});

map.on('pointermove', function (evt) {
  if (evt.dragging) { return; }
  const found = map.forEachFeatureAtPixel(
    map.getEventPixel(evt.originalEvent),
      function (feature, layer) {
        return feature.getGeometry().getType() === 'Point';
      }
    );
    map.getTargetElement().style.cursor = found ? 'pointer' : '';
});
