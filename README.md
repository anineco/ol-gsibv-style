# ol-gsibv-style
地理院地図Vector（仮称）をstyle.jsonを用いてOpenLayers v6で表示

## 表示例
- 市街：https://anineco.github.io/ol-gsibv-style?lat=35.681552&lon=139.765249&zoom=16
- 山岳：https://anineco.github.io/ol-gsibv-style?lat=36.627121&lon=137.622669&zoom=15
- 湖沼：https://anineco.github.io/ol-gsibv-style?lat=36.931761&lon=139.229934&zoom=15
- 地図記号や注記をクリックすると、属性一覧をポップアップ表示します。
- 属性一覧で地名のよみがなや、三角点の点名がわかります。

## 既知の問題
- 地図記号や注記がタイル境界でクリッピングされる。

## TODO
- 処理の軽量化。
- 注記の縦書き表示。
- 地図の回転に追従した地図記号や注記の回転。
- 地名の検索。地名データベースの構築。
