import type { FC } from "react";
import type { PalaceInfo } from "../core/model";
import type { PalaceLayout, StarIconBox } from "../core/layout";
import type { ZiweiTheme } from "../core/theme";
import { brightnessNameZh } from "../core/registry";
import { StarIcon } from "./StarIcon";
import type { LayerFlags } from "./types";

interface PalaceProps {
  palace: PalaceInfo;
  layout: PalaceLayout;
  theme: ZiweiTheme;
  layers: LayerFlags;
  cnName: string;
  enName: string;
  branchLabel: string;
  isAxis: boolean;
  inSanfang: boolean;
  onClick: (code: string) => void;
}

function Badge({
  box,
  theme,
}: {
  box: NonNullable<StarIconBox["badge"]>;
  theme: ZiweiTheme;
}) {
  const fs = theme.sizes.sihuaTag;
  return (
    <g style={{ pointerEvents: "none" }}>
      <circle cx={box.cx} cy={box.cy} r={box.r} fill={theme.colors.sihuaBadgeBg} />
      <text
        x={box.cx}
        y={box.cy + fs * 0.35}
        textAnchor="middle"
        fontSize={fs}
        fontWeight="bold"
        fill={theme.colors.sihuaTagInk}
        fontFamily={theme.fontFamily}
      >
        {box.label}
      </text>
    </g>
  );
}

function IconWithExtras({
  box,
  theme,
  layers,
}: {
  box: StarIconBox;
  theme: ZiweiTheme;
  layers: LayerFlags;
}) {
  const bright = layers.brightness ? brightnessNameZh(box.star.brightness) : "";
  return (
    <g style={{ pointerEvents: "none" }}>
      <StarIcon code={box.star.code} x={box.x} y={box.y} size={box.size} />
      {bright ? (
        <text
          x={box.x + box.size / 2}
          y={box.y + box.size - 1}
          textAnchor="middle"
          fontSize={theme.sizes.brightness}
          fill={theme.colors.branchInk}
          fontFamily={theme.fontFamily}
        >
          {bright}
        </text>
      ) : null}
      {layers.sihua && box.badge ? <Badge box={box.badge} theme={theme} /> : null}
    </g>
  );
}

/** 單一宮位（含主軸／三方四正高亮、點擊互動）。 */
export const Palace: FC<PalaceProps> = ({
  palace,
  layout,
  theme,
  layers,
  cnName,
  enName,
  branchLabel,
  isAxis,
  inSanfang,
  onClick,
}) => {
  const { cell } = layout;
  const highlightFill = isAxis
    ? theme.colors.axisHighlight
    : inSanfang
      ? "rgba(200, 155, 60, 0.04)"
      : "transparent";

  return (
    <g
      className={`zw-palace zw-palace-${palace.code}`}
      onClick={() => onClick(palace.code)}
      style={{ cursor: "pointer" }}
    >
      {/* 高亮 / 點擊命中區（整格） */}
      <rect
        x={cell.x}
        y={cell.y}
        width={cell.w}
        height={cell.h}
        fill={highlightFill}
        style={{ transition: "fill 180ms ease" }}
      />

      {/* header */}
      <text
        x={layout.name.x}
        y={layout.name.y}
        fontSize={theme.sizes.palaceName}
        fontWeight="bold"
        fill={isAxis ? theme.colors.palaceLink : theme.colors.palaceName}
        fontFamily={theme.fontFamily}
        style={{ pointerEvents: "none" }}
      >
        {cnName}
      </text>
      {layers.palaceNameEn && enName ? (
        <text
          x={layout.nameEn.x}
          y={layout.nameEn.y}
          fontSize={theme.sizes.palaceNameEn}
          fill={theme.colors.palaceNameEn}
          fontFamily={theme.fontFamily}
          style={{ pointerEvents: "none" }}
        >
          {enName}
        </text>
      ) : null}
      <text
        x={layout.branch.x}
        y={layout.branch.y}
        textAnchor="end"
        fontSize={theme.sizes.branch}
        fill={theme.colors.branchInk}
        fontFamily={theme.fontBranch}
        style={{ pointerEvents: "none" }}
      >
        {branchLabel}
      </text>
      <line
        x1={layout.underline.x1}
        y1={layout.underline.y1}
        x2={layout.underline.x2}
        y2={layout.underline.y2}
        stroke={theme.colors.gridStroke}
        strokeWidth={theme.layout.gridWidth}
        style={{ pointerEvents: "none" }}
      />

      {/* 主星 */}
      {layout.majorIcons.map((box, i) => (
        <IconWithExtras key={`m-${i}`} box={box} theme={theme} layers={layers} />
      ))}
      {/* 副星 */}
      {layout.subIcons.map((box, i) => (
        <IconWithExtras key={`s-${i}`} box={box} theme={theme} layers={layers} />
      ))}

      {/* 小星文字 */}
      {layers.minorStars && layout.minorText ? (
        <text
          x={layout.minorText.x}
          y={layout.minorText.y}
          textAnchor="middle"
          fontSize={theme.sizes.starMinor}
          fill={theme.colors.starMinor}
          fontFamily={theme.fontFamily}
          style={{ pointerEvents: "none" }}
        >
          {layout.minorText.text}
        </text>
      ) : null}
    </g>
  );
};
