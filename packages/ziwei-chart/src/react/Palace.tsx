import { Fragment, type CSSProperties, type FC } from "react";
import type { PalaceInfo } from "../core/model";
import type { BadgeBox, HeadItem, PalaceLayout, StarIconBox } from "../core/layout";
import type { ZiweiTheme } from "../core/theme";
import { brightnessNameZh, starNameZh } from "../core/registry";
import { StarIcon } from "./StarIcon";
import { PALACE_SVG_DATA, STAR_SVG_DATA } from "./starSvgData";
import type { LayerFlags } from "./types";

interface PalaceProps {
  palace: PalaceInfo;
  layout: PalaceLayout;
  theme: ZiweiTheme;
  layers: LayerFlags;
  branchLabel: string;
  /** 宮干（宮格左下角）；無宮干時為空字串。 */
  stemLabel?: string;
  isAxis: boolean;
  inSanfang: boolean;
  onClick: (code: string) => void;
}

function Badge({ box, theme }: { box: BadgeBox; theme: ZiweiTheme }) {
  // 四化徽章用圖示（assets/stars 的 F/P/H/I）：祿圓、權六角、科方、忌三角，
  // 形狀本身就在表意。圖內底色已轉 currentColor、白字保留 ⇒ color 給底色即可。
  const glyph = STAR_SVG_DATA[box.label];
  if (glyph) {
    return (
      <svg
        x={box.x}
        y={box.y}
        width={box.size}
        height={box.size}
        viewBox={glyph.viewBox}
        preserveAspectRatio="xMidYMid meet"
        color={box.ink}
        style={{ pointerEvents: "none" }}
        dangerouslySetInnerHTML={{ __html: glyph.inner }}
      />
    );
  }
  const r = box.size / 2;
  const fs = theme.sizes.sihuaTag;
  return (
    <g style={{ pointerEvents: "none" }}>
      <circle cx={box.x + r} cy={box.y + r} r={r} fill={box.ink} />
      <text
        x={box.x + r}
        y={box.y + r + fs * 0.35}
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
      <StarIcon
        code={box.star.code}
        x={box.x}
        y={box.y}
        size={box.size}
        strokeScale={box.strokeScale}
        glyphColor={box.ink || theme.colors.starGlyph}
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
      {layers.sihua
        ? box.badges.map((b, i) => <Badge key={i} box={b} theme={theme} />)
        : null}
    </g>
  );
}

function Head({ item, theme }: { item: HeadItem; theme: ZiweiTheme }) {
  if (item.type === "icon") {
    const d = PALACE_SVG_DATA[item.key];
    if (!d) return null;
    return (
      <svg
        x={item.x}
        y={item.y}
        width={item.w}
        height={item.h}
        viewBox={d.viewBox}
        preserveAspectRatio="xMidYMid meet"
        color={item.ink}
        style={{ pointerEvents: "none", "--zw-sw": item.strokeScale } as CSSProperties}
        dangerouslySetInnerHTML={{ __html: d.inner }}
      />
    );
  }
  return (
    <text
      x={item.x}
      y={item.y}
      fontSize={item.fontSize}
      fontWeight={item.role === "en" ? undefined : item.role === "layer" ? 600 : "bold"}
      fill={item.ink}
      fontFamily={theme.fontFamily}
      style={{ pointerEvents: "none" }}
    >
      {item.text}
    </text>
  );
}

/** 單一宮位（含主軸／三方四正高亮、點擊互動）。 */
export const Palace: FC<PalaceProps> = ({
  palace,
  layout,
  theme,
  layers,
  branchLabel,
  stemLabel = "",
  isAxis,
  inSanfang,
  onClick,
}) => {
  const { cell } = layout;
  const highlightFill = isAxis
    ? theme.colors.axisHighlight
    : inSanfang
      ? theme.colors.sanfangHighlight
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

      {/* 表頭：宮位圖示（疊盤時本命＋各層半寬圖示並排）或文字宮名 */}
      {layout.head.map((item, i) => (
        <Head key={i} item={item} theme={theme} />
      ))}
      {/* 身宮＝本命圖示外一圈同粗細外框 */}
      {layout.bodyFrame ? (
        <rect
          x={layout.bodyFrame.x}
          y={layout.bodyFrame.y}
          width={layout.bodyFrame.w}
          height={layout.bodyFrame.h}
          rx={1.5}
          fill="none"
          stroke={layout.bodyFrame.ink}
          strokeWidth={layout.bodyFrame.strokeWidth}
          strokeLinejoin="round"
          style={{ pointerEvents: "none" }}
        />
      ) : null}
      {stemLabel ? (
        <text
          x={layout.stem.x}
          y={layout.stem.y}
          fontSize={theme.sizes.branch}
          fill={theme.colors.branchInk}
          fontFamily={theme.fontBranch}
          style={{ pointerEvents: "none" }}
        >
          {stemLabel}
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
      {/* 表頭底線：宮位圖示左右本就帶橫線，那條線是重複的 ⇒ 預設關 */}
      {theme.layout.palaceHeaderLine ? (
        <line
          x1={layout.underline.x1}
          y1={layout.underline.y1}
          x2={layout.underline.x2}
          y2={layout.underline.y2}
          stroke={theme.colors.gridStroke}
          strokeWidth={theme.layout.gridWidth}
          style={{ pointerEvents: "none" }}
        />
      ) : null}

      {/* 主星 */}
      {layout.majorIcons.map((box, i) => (
        <IconWithExtras key={`m-${i}`} box={box} theme={theme} layers={layers} />
      ))}
      {/* 副星＋流曜 */}
      {layout.subIcons.map((box, i) => (
        <IconWithExtras key={`s-${i}`} box={box} theme={theme} layers={layers} />
      ))}
      {layout.overflow ? (
        <text
          x={layout.overflow.x}
          y={layout.overflow.y}
          textAnchor="middle"
          fontSize={theme.sizes.starMinor}
          fontWeight="bold"
          fill={theme.colors.starMinor}
          opacity={0.7}
          fontFamily={theme.fontFamily}
          style={{ pointerEvents: "none" }}
        >
          {layout.overflow.text}
        </text>
      ) : null}

      {/* 小星文字（書籍命盤不列，預設關） */}
      {layout.minorText && layers.minorStars && palace.minors.length ? (
        <text
          x={layout.minorText.x}
          y={layout.minorText.y}
          textAnchor="middle"
          fontSize={theme.sizes.starMinor}
          fill={theme.colors.starMinor}
          fontFamily={theme.fontFamily}
          style={{ pointerEvents: "none" }}
        >
          {palace.minors.map((s, i) => (
            <Fragment key={`${s.code}-${i}`}>
              {i > 0 ? <tspan opacity={0.55}>{theme.layout.minorSeparator}</tspan> : null}
              <tspan>{starNameZh(s.code)}</tspan>
            </Fragment>
          ))}
        </text>
      ) : null}
    </g>
  );
};
