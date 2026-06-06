import { useMemo, useState } from "react";
import { DEFAULT_LAYERS, type LayerFlags } from "./types";

/** 管理主軸宮與圖層開關狀態（支援受控 axisPalace）。 */
export function useChartState(opts: {
  defaultAxisPalace?: string;
  axisPalace?: string;
  layers?: Partial<LayerFlags>;
  onPalaceClick?: (code: string) => void;
}) {
  const [internalAxis, setInternalAxis] = useState(opts.defaultAxisPalace ?? "1");
  const axisPalace = opts.axisPalace ?? internalAxis;

  const [overrides, setOverrides] = useState<Partial<LayerFlags>>(opts.layers ?? {});
  const layers: LayerFlags = useMemo(
    () => ({ ...DEFAULT_LAYERS, ...opts.layers, ...overrides }),
    [opts.layers, overrides],
  );

  function selectPalace(code: string) {
    if (opts.axisPalace === undefined) setInternalAxis(code);
    opts.onPalaceClick?.(code);
  }

  function toggleLayer(key: keyof LayerFlags) {
    setOverrides((prev) => ({ ...prev, [key]: !layers[key] }));
  }

  return { axisPalace, selectPalace, layers, toggleLayer };
}
