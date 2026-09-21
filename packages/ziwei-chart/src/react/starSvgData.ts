/**
 * 圖示向量資料（內嵌）—— 由 scripts/gen-star-svg.mjs 自 assets/{stars,palace}/*.svg 產生。
 * 請勿手改：要更新圖示請改 assets/ 後執行 `npm run gen:stars`。
 * 採內嵌 inner SVG（與 p_e_artist 一致），class 名已加代碼前綴避免全域碰撞；
 * 深色墨已轉 currentColor，由使用端的 color 控制，深色主題才跟得動。
 */
export interface StarSvg { viewBox: string; inner: string; }
export const STAR_SVG_DATA: Record<string, StarSvg> = {
  "AAC": {
    "viewBox": "0 0 289 288.22",
    "inner": "<defs> <style> .AACcls-1 { fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 5px; } </style> </defs> <g id=\"wenchang\"> <circle class=\"AACcls-1\" cx=\"144.5\" cy=\"144.11\" r=\"69.84\"/> <path class=\"AACcls-1\" d=\"M144.5,95.89h0c14.69,0,26.61,11.91,26.61,26.61v43.23c0,14.69-11.91,26.61-26.61,26.61h0c-14.69,0-26.61-11.91-26.61-26.61v-43.23c0-14.69,11.91-26.61,26.61-26.61Z\"/> <path class=\"AACcls-1\" d=\"M117.9,144.11h53.21\"/> </g>"
  },
  "AAR": {
    "viewBox": "0 0 289 288.22",
    "inner": "<defs> <style> .AARcls-1 { fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 5px; } </style> </defs> <g id=\"wenqu\"> <circle class=\"AARcls-1\" cx=\"144.5\" cy=\"144.11\" r=\"69.84\"/> <path class=\"AARcls-1\" d=\"M122.89,117.5h43.23c14.69,0,26.61,11.91,26.61,26.61h0c0,14.69-11.91,26.61-26.61,26.61h-43.23c-14.69,0-26.61-11.91-26.61-26.61h0c0-14.69,11.91-26.61,26.61-26.61Z\"/> <path class=\"AARcls-1\" d=\"M144.5,117.5v53.21\"/> </g>"
  },
  "AWO": {
    "viewBox": "0 0 289 288.22",
    "inner": "<defs> <style> .AWOcls-1 { fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 5px; } </style> </defs> <g id=\"_04-AWO\" data-name=\"04-AWO\"> <path class=\"AWOcls-1\" d=\"M81.32,117.5l63.19-34.92,63.19,34.92M106.26,167.39h76.49\"/> <circle class=\"AWOcls-1\" cx=\"144.5\" cy=\"167.39\" r=\"38.25\"/> </g>"
  },
  "BLE": {
    "viewBox": "0 0 289 288.22",
    "inner": "<defs> <style> .BLEcls-1 { fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 5px; } </style> </defs> <g id=\"_12-BLE\" data-name=\"12-BLE\"> <path class=\"BLEcls-1\" d=\"M102.93,92.98v49.88M186.07,92.98v49.88M76.33,92.98c0,22.17,8.87,33.26,26.61,33.26s26.61-11.09,26.61-33.26M159.47,92.98c0,22.17,8.87,33.26,26.61,33.26s26.61-11.09,26.61-33.26M73,186.1c15.52-12.19,31.59-12.19,48.22,0,16.63,12.19,32.15,12.19,46.56,0,14.41-12.19,30.49-12.19,48.22,0\"/> </g>"
  },
  "BRE": {
    "viewBox": "0 0 289 288.22",
    "inner": "<defs> <style> .BREcls-1 { fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 5px; } </style> </defs> <g id=\"_09-BRE\" data-name=\"09-BRE\"> <path class=\"BREcls-1\" d=\"M92.12,87.78c23.28-31.59,36.58,13.3,34.92,41.57-1.66,46.56,9.98,86.47,46.56,81.48,15.52-1.11,24.39-7.21,26.61-18.29M88.8,132.68c6.65,33.26,68.18,33.26,78.15-1.66\"/> </g>"
  },
  "CAI": {
    "viewBox": "0 0 289 288.22",
    "inner": "<defs> <style> .CAIcls-1 { fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 5px; } </style> </defs> <g id=\"tianyue\"> <circle class=\"CAIcls-1\" cx=\"144.5\" cy=\"144.11\" r=\"69.84\"/> <path class=\"CAIcls-1\" d=\"M144.5,190.67l36.58-29.93v-26.61c0-20.2-16.38-36.58-36.58-36.58s-36.58,16.38-36.58,36.58v26.61l36.58,29.93Z\"/> </g>"
  },
  "CHI": {
    "viewBox": "0 0 289 288.22",
    "inner": "<defs> <style> .CHIcls-1 { fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 5px; } </style> </defs> <g id=\"tuoluo\"> <circle class=\"CHIcls-1\" cx=\"144.5\" cy=\"144.11\" r=\"53.21\"/> <path class=\"CHIcls-1\" d=\"M131.2,157.41l26.61-26.61\"/> </g>"
  },
  "CPA": {
    "viewBox": "0 0 289 288.22",
    "inner": "<defs> <style> .CPAcls-1 { fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 5px; } </style> </defs> <g id=\"tiankui\"> <circle class=\"CPAcls-1\" cx=\"144.5\" cy=\"144.11\" r=\"69.84\"/> <path class=\"CPAcls-1\" d=\"M144.5,97.55l36.58,29.93v26.61c0,20.2-16.38,36.58-36.58,36.58s-36.58-16.38-36.58-36.58v-26.61l36.58-29.93Z\"/> </g>"
  },
  "DIV": {
    "viewBox": "0 0 289 288.22",
    "inner": "<defs> <style> .DIVcls-1 { fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 5px; } </style> </defs> <g id=\"_28-DIV\" data-name=\"28-DIV\"> <circle class=\"DIVcls-1\" cx=\"144.5\" cy=\"144.11\" r=\"69.84\"/> <path class=\"DIVcls-1\" d=\"M144.5,94.22v38.25M124.55,110.85h39.91M144.5,132.47l36.58,34.92-36.58,34.92-36.58-34.92,36.58-34.92Z\"/> </g>"
  },
  "EVO": {
    "viewBox": "0 0 289 288.22",
    "inner": "<defs> <style> .EVOcls-1 { fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 5px; } </style> </defs> <g id=\"dikong\"> <path class=\"EVOcls-1\" d=\"M76.33,75.93l136.35,136.35M76.33,212.29L212.68,75.93M102.93,102.54h83.14v83.14h-83.14v-83.14Z\"/> </g>"
  },
  "F": {
    "viewBox": "0 0 72 72",
    "inner": "<defs> <style> .Fcls-1 { fill: currentColor; } </style> </defs> <path class=\"Fcls-1\" d=\"M36,2.71C17.61,2.71,2.71,17.61,2.71,36s14.91,33.29,33.29,33.29,33.29-14.91,33.29-33.29S54.39,2.71,36,2.71ZM49.15,25.13h-15.97v8.01h14.32v7.41h-14.32v13.77h-8.56V17.67h24.53v7.46Z\"/>"
  },
  "FSP": {
    "viewBox": "0 0 289 288.22",
    "inner": "<defs> <style> .FSPcls-1 { fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 5px; } </style> </defs> <g id=\"huoxing\"> <path class=\"FSPcls-1\" d=\"M144.5,92.56l58.2,103.1h-116.4l58.2-103.1ZM131.2,172.38l21.62-21.62\"/> </g>"
  },
  "GGA": {
    "viewBox": "0 0 289 288.22",
    "inner": "<defs> <style> .GGAcls-1 { fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 5px; } </style> </defs> <g id=\"_11-GGA\" data-name=\"11-GGA\"> <path class=\"GGAcls-1\" d=\"M77.99,80.92v126.37M211.02,80.92v126.37M77.99,104.2l41.57,16.63v46.56l-41.57,16.63M211.02,104.2l-41.57,16.63v46.56l41.57,16.63\"/> </g>"
  },
  "GLA": {
    "viewBox": "0 0 289 288.22",
    "inner": "<defs> <style> .GLAcls-1 { fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 5px; } </style> </defs> <g id=\"lingxing\"> <path class=\"GLAcls-1\" d=\"M86.3,92.56h116.4l-58.2,103.1-58.2-103.1ZM136.19,142.45l21.62-21.62\"/> </g>"
  },
  "H": {
    "viewBox": "0 0 72 72",
    "inner": "<defs> <style> .Hcls-1 { fill: currentColor; } </style> </defs> <path class=\"Hcls-1\" d=\"M7.49,7.49v57.01h57.01V7.49H7.49ZM52.12,54.32h-8.56v-15.22h-15.12v15.22h-8.56V17.67h8.56v13.87h15.12v-13.87h8.56v36.65Z\"/>"
  },
  "HAR": {
    "viewBox": "0 0 289 288.22",
    "inner": "<defs> <style> .HARcls-1 { fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 5px; } </style> </defs> <g id=\"_01-HAR\" data-name=\"01-HAR\"> <path class=\"HARcls-1\" d=\"M82.98,85.91c29.93,38.8,29.93,77.6,0,116.4M206.03,85.91c-29.93,38.8-29.93,77.6,0,116.4M106.26,135.8h76.49M116.23,157.41h56.54c0,15.61-12.66,28.27-28.27,28.27s-28.27-12.66-28.27-28.27Z\"/> </g>"
  },
  "HHO": {
    "viewBox": "0 0 289 288.22",
    "inner": "<defs> <style> .HHOcls-1 { fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 5px; } </style> </defs> <g id=\"_29-HHO\" data-name=\"29-HHO\"> <circle class=\"HHOcls-1\" cx=\"144.5\" cy=\"144.11\" r=\"69.84\"/> <path class=\"HHOcls-1\" d=\"M189.4,104.2c-34.37-18.85-59.31-15.52-74.83,9.98-11.09,16.63-11.09,29.38,0,38.25M156.14,94.22c-8.87,27.71-26.05,50.99-51.55,69.84M117.9,105.86l59.86,18.29M104.59,164.06c4.43-13.3,16.63-14.97,36.58-4.99,19.95,9.98,36.58,10.53,49.88,1.66M124.55,159.07l-8.31,23.28M146.17,167.39l-8.31,23.28M167.78,170.71l-4.99,19.95\"/> </g>"
  },
  "HJO": {
    "viewBox": "0 0 289 288.22",
    "inner": "<defs> <style> .HJOcls-1 { fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 5px; } </style> </defs> <circle class=\"HJOcls-1\" cx=\"144.5\" cy=\"144.11\" r=\"69.84\"/> <path class=\"HJOcls-1\" d=\"M104.59,117.5l39.91,39.91,39.91-39.91v53.21h-79.82v-53.21Z\"/>"
  },
  "HPI": {
    "viewBox": "0 0 289 288.22",
    "inner": "<defs> <style> .HPIcls-1 { fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 5px; } </style> </defs> <g id=\"_07-HPI\" data-name=\"07-HPI\"> <path class=\"HPIcls-1\" d=\"M84.64,105.03l26.61-26.61,33.26,31.59,33.26-31.59,26.61,26.61M144.5,110.02v49.88M102.93,159.91h83.14M74.66,179.86h59.86c0,16.53-13.4,29.93-29.93,29.93s-29.93-13.4-29.93-29.93ZM154.48,179.86h59.86c0,16.53-13.4,29.93-29.93,29.93s-29.93-13.4-29.93-29.93Z\"/> </g>"
  },
  "I": {
    "viewBox": "0 0 72 72",
    "inner": "<defs> <style> .Icls-1 { fill: currentColor; } </style> </defs> <path class=\"Icls-1\" d=\"M36,9.11L3.54,62.89h64.92L36,9.11ZM31.72,57.25V24.48h8.56v32.77h-8.56Z\"/>"
  },
  "INT": {
    "viewBox": "0 0 289 288.22",
    "inner": "<defs> <style> .INTcls-1 { fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 5px; } </style> </defs> <g id=\"jiekong\"> <path class=\"INTcls-1\" d=\"M76.33,75.93l136.35,136.35M76.33,212.29L212.68,75.93M92.95,112.52h103.1M92.95,175.7h103.1\"/> </g>"
  },
  "LHA": {
    "viewBox": "0 0 289 288.22",
    "inner": "<defs> <style> .LHAcls-1 { fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 5px; } </style> </defs> <g id=\"zuofu\"> <circle class=\"LHAcls-1\" cx=\"144.5\" cy=\"144.11\" r=\"69.84\"/> <path class=\"LHAcls-1\" d=\"M106.26,104.2h29.93c22.04,0,39.91,17.87,39.91,39.91s-17.87,39.91-39.91,39.91h-29.93v-79.82ZM106.26,144.11h31.59\"/> </g>"
  },
  "MAE": {
    "viewBox": "0 0 289 288.22",
    "inner": "<defs> <style> .MAEcls-1 { fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 5px; } </style> </defs> <g id=\"dijie\"> <path class=\"MAEcls-1\" d=\"M76.33,75.93l136.35,136.35M76.33,212.29L212.68,75.93M144.5,80.92l63.19,63.19-63.19,63.19-63.19-63.19,63.19-63.19Z\"/> </g>"
  },
  "MAG": {
    "viewBox": "0 0 289 288.22",
    "inner": "<defs> <style> .MAGcls-1 { fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 5px; } </style> </defs> <g id=\"_02-MAG\" data-name=\"02-MAG\"> <rect class=\"MAGcls-1\" x=\"86.3\" y=\"87.57\" width=\"116.4\" height=\"113.07\" rx=\"6\" ry=\"6\"/> <path class=\"MAGcls-1\" d=\"M144.5,109.19v48.22M109.58,185.68l34.92-28.27,34.92,28.27\"/> </g>"
  },
  "MAR": {
    "viewBox": "0 0 289 288.22",
    "inner": "<defs> <style> .MARcls-1 { fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 5px; } </style> </defs> <g id=\"_06-MAR\" data-name=\"06-MAR\"> <path class=\"MARcls-1\" d=\"M86.3,79.26h43.23v83.14h73.16v46.56h-116.4V79.26ZM86.3,208.96l43.23-46.56\"/> </g>"
  },
  "MIN": {
    "viewBox": "0 0 289 288.22",
    "inner": "<defs> <style> .MINcls-1 { fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 5px; } </style> </defs> <g id=\"_03-MIN\" data-name=\"03-MIN\"> <path class=\"MINcls-1\" d=\"M99.61,85.91v116.4M64.69,90.9c0,22.17,11.64,33.26,34.92,33.26s34.92-11.09,34.92-33.26M64.69,197.32c0-22.17,11.64-33.26,34.92-33.26s34.92,11.09,34.92,33.26\"/> <path class=\"MINcls-1\" d=\"M161.13,125.82h44.9c10.1,0,18.29,8.19,18.29,18.29h0c0,10.1-8.19,18.29-18.29,18.29h-44.9c-10.1,0-18.29-8.19-18.29-18.29h0c0-10.1,8.19-18.29,18.29-18.29Z\"/> </g>"
  },
  "MOO": {
    "viewBox": "0 0 289 288.22",
    "inner": "<defs> <style> .MOOcls-1 { fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 5px; } </style> </defs> <g id=\"_14-MOO\" data-name=\"14-MOO\"> <path class=\"MOOcls-1\" d=\"M197.41,84.25c-33.06-19.87-75.97-9.17-95.83,23.89-19.87,33.06-9.17,75.97,23.89,95.83,22.14,13.3,49.81,13.3,71.94,0-68.18-14.97-68.18-104.76,0-119.72Z\"/> </g>"
  },
  "P": {
    "viewBox": "0 0 72 72",
    "inner": "<defs> <style> .Pcls-1 { fill: currentColor; } </style> </defs> <path class=\"Pcls-1\" d=\"M42.66,26.11c-1.32-.82-3-1.23-5.03-1.23h-3.76v10.41h3.76c2.07,0,3.75-.4,5.06-1.2,1.3-.8,1.95-2.14,1.95-4s-.66-3.16-1.98-3.98Z\"/> <path class=\"Pcls-1\" d=\"M36,4.82l-27,15.59v31.18l27,15.59,27-15.59v-31.18l-27-15.59ZM51.82,36.65c-1.22,1.87-2.96,3.31-5.23,4.33-2.27,1.02-4.94,1.53-8.01,1.53h-4.71v11.82h-8.56V17.68h13.27c3.07,0,5.74.51,8.01,1.53,2.27,1.02,4.01,2.46,5.23,4.33s1.83,4.05,1.83,6.56-.61,4.69-1.83,6.56Z\"/>"
  },
  "POL": {
    "viewBox": "0 0 289 288.22",
    "inner": "<defs> <style> .POLcls-1 { fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 5px; } </style> </defs> <g id=\"_05-POL\" data-name=\"05-POL\"> <path class=\"POLcls-1\" d=\"M144.5,74.27v139.68M74.66,144.11h139.68M94.62,94.22l99.77,99.77M94.62,193.99l99.77-99.77\"/> </g>"
  },
  "RHA": {
    "viewBox": "0 0 289 288.22",
    "inner": "<defs> <style> .RHAcls-1 { fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 5px; } </style> </defs> <g id=\"youbi\"> <circle class=\"RHAcls-1\" cx=\"144.5\" cy=\"144.11\" r=\"69.84\"/> <path class=\"RHAcls-1\" d=\"M182.75,104.2h-29.93c-22.04,0-39.91,17.87-39.91,39.91s17.87,39.91,39.91,39.91h29.93v-79.82ZM182.75,144.11h-31.59\"/> </g>"
  },
  "RPH": {
    "viewBox": "0 0 289 288.22",
    "inner": "<defs> <style> .RPHcls-1 { fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 5px; } </style> </defs> <path class=\"RPHcls-1\" d=\"M104.59,114.18l39.91,24.94,39.91-24.94M144.5,139.12v34.92\"/> <circle class=\"RPHcls-1\" cx=\"144.5\" cy=\"144.11\" r=\"69.84\"/>"
  },
  "STO": {
    "viewBox": "0 0 289 288.22",
    "inner": "<defs> <style> .STOcls-1 { fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 5px; } </style> </defs> <g id=\"qingyang\"> <path class=\"STOcls-1\" d=\"M144.5,77.6l38.25,66.51-38.25,66.51-38.25-66.51,38.25-66.51ZM134.53,155.75l19.95-23.28\"/> </g>"
  },
  "SUN": {
    "viewBox": "0 0 289 288.22",
    "inner": "<defs> <style> .SUNcls-1 { fill: none; } .SUNcls-1, .SUNcls-2 { stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 5px; } .SUNcls-2 { fill: currentColor; } </style> </defs> <g id=\"_13-SUN\" data-name=\"13-SUN\"> <circle class=\"SUNcls-1\" cx=\"144.5\" cy=\"144.11\" r=\"69.84\"/> <circle class=\"SUNcls-2\" cx=\"144.5\" cy=\"144.11\" r=\"9.15\"/> </g>"
  },
  "TRE": {
    "viewBox": "0 0 289 288.22",
    "inner": "<defs> <style> .TREcls-1 { fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 5px; } </style> </defs> <g id=\"_10-TRE\" data-name=\"10-TRE\"> <path class=\"TREcls-1\" d=\"M111.25,83.42l81.48,46.56-98.11,54.87h99.77v19.95M132.86,95.06l-9.98,74.83\"/> </g>"
  },
  "VAN": {
    "viewBox": "0 0 289 288.22",
    "inner": "<defs> <style> .VANcls-1 { fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 5px; } </style> </defs> <g id=\"_08-VAN\" data-name=\"08-VAN\"> <path class=\"VANcls-1\" d=\"M101.27,75.93l43.23,31.59,43.23-31.59M144.5,107.53v41.57l-31.59,31.59,31.59,31.59,31.59-31.59-31.59-31.59\"/> <circle class=\"VANcls-1\" cx=\"92.95\" cy=\"127.48\" r=\"18.29\"/> <circle class=\"VANcls-1\" cx=\"196.05\" cy=\"127.48\" r=\"18.29\"/> </g>"
  }
};

/** 宮位圖示：全寬 {宮位碼}.svg（本命用）、半寬 h{宮位碼}.svg（流盤層用）。 */
export const PALACE_SVG_DATA: Record<string, StarSvg> = {
  "1": {
    "viewBox": "0 0 260 80",
    "inner": "<title>命宮</title> <g id=\"palace-ming\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"4.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" transform=\"translate(130 40)\"><path d=\"M-116 0 H-35 M-24 0 L0 -27 L24 0 L0 27 Z M35 0 H116\"/></g>"
  },
  "2": {
    "viewBox": "0 0 260 80",
    "inner": "<title>兄弟宮</title> <g id=\"palace-siblings\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"4.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" transform=\"translate(130 40)\"><path d=\"M-100 23 V-23 H-25 V23 M25 23 V-23 H100 V23 M-25 0 H25\"/></g>"
  },
  "3": {
    "viewBox": "0 0 260 80",
    "inner": "<title>夫妻宮</title> <g id=\"palace-spouse\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"4.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" transform=\"translate(130 40)\"><path d=\"M-79 -24 L-107 0 L-79 24 M79 -24 L107 0 L79 24 M-76 0 H76\"/></g>"
  },
  "4": {
    "viewBox": "0 0 260 80",
    "inner": "<title>子女宮</title> <g id=\"palace-children\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"4.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" transform=\"translate(130 40)\"><path d=\"M-88 -25 H88 M0 -25 V5 M-88 24 V5 H88 V24\"/></g>"
  },
  "5": {
    "viewBox": "0 0 260 80",
    "inner": "<title>財帛宮</title> <g id=\"palace-wealth\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"4.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" transform=\"translate(130 40)\"><circle r=\"30\"/><rect x=\"-9\" y=\"-9\" width=\"18\" height=\"18\" rx=\"0.5\"/><path d=\"M-106 0 H-44 M44 0 H106\"/></g>"
  },
  "6": {
    "viewBox": "0 0 260 80",
    "inner": "<title>疾厄宮</title> <g id=\"palace-health\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"4.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" transform=\"translate(130 40)\"><path d=\"M-122 0 H-52 L-25 -27 L20 25 L49 0 H122\"/></g>"
  },
  "7": {
    "viewBox": "0 0 260 80",
    "inner": "<title>遷移宮</title> <g id=\"palace-travel\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"4.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" transform=\"translate(130 40)\"><path d=\"M-110 -20 V20 M-91 0 H99 M79 -18 L99 0 L79 18\"/></g>"
  },
  "8": {
    "viewBox": "0 0 260 80",
    "inner": "<title>交友宮</title> <g id=\"palace-friends\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"4.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" transform=\"translate(130 40)\"><path d=\"M-122 -17 H122 M-86 -8 V18 H-32 V-8 M32 -8 V18 H86 V-8\"/></g>"
  },
  "9": {
    "viewBox": "0 0 260 80",
    "inner": "<title>官祿宮</title> <g id=\"palace-career\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"4.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" transform=\"translate(130 40)\"><path d=\"M-108 23 V0 H-35 V-19 H35 V0 H108 V23 Z\"/></g>"
  },
  "A": {
    "viewBox": "0 0 260 80",
    "inner": "<title>田宅宮</title> <g id=\"palace-property\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"4.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" transform=\"translate(130 40)\"><path d=\"M-86 27 V-3 L0 -29 L86 -3 V27 Z\"/></g>"
  },
  "B": {
    "viewBox": "0 0 260 80",
    "inner": "<title>福德宮</title> <g id=\"palace-fortune\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"4.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" transform=\"translate(130 40)\"><path d=\"M-122 0 H-64 M-48 -12 C-37 28 37 28 48 -12 M64 0 H122\"/></g>"
  },
  "C": {
    "viewBox": "0 0 260 80",
    "inner": "<title>父母宮</title> <g id=\"palace-parents\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"4.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" transform=\"translate(130 40)\"><path d=\"M-96 -25 V25 M96 -25 V25 M-96 -1 H-44 L-31 21 H31 L44 -1 H96\"/></g>"
  },
  "h1": {
    "viewBox": "0 0 128 68",
    "inner": "<title>命宮</title> <g id=\"palace-ming\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"4.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" transform=\"translate(64 34)\"><path d=\"M-57.75 0 H-32 M-21 0 L0 -27.75 L21 0 L0 27.75 Z M32 0 H57.75\"/></g>"
  },
  "h2": {
    "viewBox": "0 0 128 68",
    "inner": "<title>兄弟宮</title> <g id=\"palace-siblings\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"4.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" transform=\"translate(64 34)\"><path d=\"M-57.75 27.75 V-27.75 H-15 V27.75 M15 27.75 V-27.75 H57.75 V27.75 M-15 0 H15\"/></g>"
  },
  "h3": {
    "viewBox": "0 0 128 68",
    "inner": "<title>夫妻宮</title> <g id=\"palace-spouse\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"4.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" transform=\"translate(64 34)\"><path d=\"M-33 -27.75 L-57.75 0 L-33 27.75 M33 -27.75 L57.75 0 L33 27.75 M-31 0 H31\"/></g>"
  },
  "h4": {
    "viewBox": "0 0 128 68",
    "inner": "<title>子女宮</title> <g id=\"palace-children\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"4.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" transform=\"translate(64 34)\"><path d=\"M-57.75 -27.75 H57.75 M0 -27.75 V8 M-57.75 27.75 V8 H57.75 V27.75\"/></g>"
  },
  "h5": {
    "viewBox": "0 0 128 68",
    "inner": "<title>財帛宮</title> <g id=\"palace-wealth\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"4.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" transform=\"translate(64 34)\"><circle r=\"27.75\"/><rect x=\"-8\" y=\"-8\" width=\"16\" height=\"16\" rx=\"0.5\"/><path d=\"M-57.75 0 H-40 M40 0 H57.75\"/></g>"
  },
  "h6": {
    "viewBox": "0 0 128 68",
    "inner": "<title>疾厄宮</title> <g id=\"palace-health\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"4.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" transform=\"translate(64 34)\"><path d=\"M-57.75 0 H-34 L-13 -27.75 L13 27.75 L34 0 H57.75\"/></g>"
  },
  "h7": {
    "viewBox": "0 0 128 68",
    "inner": "<title>遷移宮</title> <g id=\"palace-travel\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"4.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" transform=\"translate(64 34)\"><path d=\"M-57.75 -27.75 V27.75 M-43 0 H57.75 M30 -27.75 L57.75 0 L30 27.75\"/></g>"
  },
  "h8": {
    "viewBox": "0 0 128 68",
    "inner": "<title>交友宮</title> <g id=\"palace-friends\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"4.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" transform=\"translate(64 34)\"><path d=\"M-57.75 -27.75 H57.75 M-43 -13 V27.75 H-12 V-13 M12 -13 V27.75 H43 V-13\"/></g>"
  },
  "h9": {
    "viewBox": "0 0 128 68",
    "inner": "<title>官祿宮</title> <g id=\"palace-career\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"4.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" transform=\"translate(64 34)\"><path d=\"M-57.75 27.75 V0 H-20 V-27.75 H20 V0 H57.75 V27.75 Z\"/></g>"
  },
  "hA": {
    "viewBox": "0 0 128 68",
    "inner": "<title>田宅宮</title> <g id=\"palace-property\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"4.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" transform=\"translate(64 34)\"><path d=\"M-57.75 27.75 V-2 L0 -27.75 L57.75 -2 V27.75 Z\"/></g>"
  },
  "hB": {
    "viewBox": "0 0 128 68",
    "inner": "<title>福德宮</title> <g id=\"palace-fortune\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"4.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" transform=\"translate(64 34)\"><path d=\"M-57.75 -12 H-40 M-28 -27.75 C-28 46.25 28 46.25 28 -27.75 M40 -12 H57.75\"/></g>"
  },
  "hC": {
    "viewBox": "0 0 128 68",
    "inner": "<title>父母宮</title> <g id=\"palace-parents\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"4.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" transform=\"translate(64 34)\"><path d=\"M-57.75 -27.75 V27.75 M57.75 -27.75 V27.75 M-57.75 -2 H-33 L-21 22 H21 L33 -2 H57.75\"/></g>"
  }
};

export function hasStarSvg(code: string): boolean {
  return code in STAR_SVG_DATA;
}

export function palaceSvg(code: string, half = false): StarSvg | undefined {
  return PALACE_SVG_DATA[(half ? "h" : "") + code];
}
