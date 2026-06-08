import { Fragment, type FC } from "react";
import type { PalaceInfo } from "../core/model";
import type { PalaceLayout, StarIconBox } from "../core/layout";
import type { ZiweiTheme } from "../core/theme";
import { brightnessNameZh, starNameZh } from "../core/registry";
import { isFlowStar } from "../core/constants";
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
  bg,
  ink,
}: {
  box: NonNullable<StarIconBox["badge"]>;
  theme: ZiweiTheme;
  bg?: string;
  ink?: string;
}) {
  const fs = theme.sizes.sihuaTag;
  return (
    <g style={{ pointerEvents: "none" }}>
      <circle cx={box.cx} cy={box.cy} r={box.r} fill={bg ?? theme.colors.sihuaBadgeBg} />
      <text
        x={box.cx}
        y={box.cy + fs * 0.35}
        textAnchor="middle"
        fontSize={fs}
        fontWeight="bold"
        fill={ink ?? theme.colors.sihuaTagInk}
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
      <StarIcon
        code={box.star.code}
        x={box.x}
        y={box.y}
        size={box.size}
        glyphColor={theme.colors.starGlyph}
      />
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
      {layers.sihua && box.flowBadge ? (
        <Badge box={box.flowBadge} theme={theme} bg={theme.colors.flowStar} ink="#ffffff" />
      ) : null}
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
      {layout.flowTag ? (
        <text
          x={layout.flowTag.x}
          y={layout.flowTag.y}
          fontSize={theme.sizes.palaceName}
          fontWeight="bold"
          fill={theme.colors.flowStar}
          fontFamily={theme.fontFamily}
          style={{ pointerEvents: "none" }}
        >
          {layout.flowTag.text}
        </text>
      ) : null}
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

      {/* 小星／流曜文字（流曜以區隔色標記，各自可開關） */}
      {layout.minorText
        ? (() => {
            const sep = theme.layout.minorSeparator;
            const shown = palace.minors.filter((s) =>
              isFlowStar(s.code) ? layers.flowStars : layers.minorStars,
            );
            if (shown.length === 0) return null;
            return (
              <text
                x={layout.minorText!.x}
                y={layout.minorText!.y}
                textAnchor="middle"
                fontSize={theme.sizes.starMinor}
                fontFamily={theme.fontFamily}
                style={{ pointerEvents: "none" }}
              >
                {shown.map((s, i) => {
                  const flow = isFlowStar(s.code);
                  return (
                    <Fragment key={`${s.code}-${i}`}>
                      {i > 0 ? (
                        <tspan fill={theme.colors.starMinor} opacity={0.55}>
                          {sep}
                        </tspan>
                      ) : null}
                      <tspan
                        fill={flow ? theme.colors.flowStar : theme.colors.starMinor}
                        fontWeight={flow ? 600 : undefined}
                      >
                        {starNameZh(s.code)}
                      </tspan>
                    </Fragment>
                  );
                })}
              </text>
            );
          })()
        : null}
    </g>
  );
};
