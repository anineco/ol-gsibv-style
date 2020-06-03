import 'ol/ol.css';
import View from 'ol/View';
import {fromLonLat} from 'ol/proj';
import Map from 'ol/Map';
import ScaleLine from 'ol/control/ScaleLine';
import VectorTileLayer from 'ol/layer/VectorTile';
import VectorTile from 'ol/source/VectorTile';
import MVT from 'ol/format/MVT';
import stylefunction from 'ol-mapbox-style/dist/stylefunction';
// IE11
import 'babel-polyfill';
import "es6-promise/auto";
import "fetch-polyfill";

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

const view = new View({
  center: fromLonLat([param.lon,param.lat]),
  maxZoom: 17,
  minZoom: 5,
  zoom: param.zoom
});

const map = new Map({
  target: 'map',
  view: view
});

const layer = new VectorTileLayer({
  declutter: true, // mandatory to avoid text clipping at tile edge
  visible: false
});

map.addLayer(layer);

const source = new VectorTile({
  attributions: "<a href='https://maps.gsi.go.jp/vector/' target='_blank'>地理院地図Vector（仮称）</a>",
  format: new MVT(),
  url: 'https://cyberjapandata.gsi.go.jp/xyz/experimental_bvmap/{z}/{x}/{y}.pbf'
});
layer.setSource(source);

let glStyle;
const glImage = new Image();
glImage.crossOrigin = 'anonymous';
let glSprite;

const sprite_base = 'https://gsi-cyberjapan.github.io/gsivectortile-mapbox-gl-js/sprite/std';

Promise.all([
  fetch('https://raw.githubusercontent.com/gsi-cyberjapan/gsivectortile-mapbox-gl-js/master/std.json')
    .then(response => response.json())
    .then(result => glStyle = result),
  fetch(sprite_base + '.json')
    .then(response => response.json())
    .then(result => glSprite = result),
  fetch(sprite_base + '.png')
    .then(response => response.blob())
    .then(result => glImage.src = URL.createObjectURL(result))
]).then(() => {
  const style = stylefunction(layer, glStyle, 'gsibv-vectortile-source-1-4-16', undefined, glSprite, glImage.src, undefined);
  layer.setStyle(style);
  layer.setVisible(true);
});
