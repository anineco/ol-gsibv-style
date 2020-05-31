import 'ol/ol.css';
import View from 'ol/View';
import {fromLonLat} from 'ol/proj';
import Map from 'ol/Map';
import ScaleLine from 'ol/control/ScaleLine';
import {apply} from 'ol-mapbox-style';
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

apply(map, 'https://raw.githubusercontent.com/gsi-cyberjapan/gsivectortile-mapbox-gl-js/master/std.json');
