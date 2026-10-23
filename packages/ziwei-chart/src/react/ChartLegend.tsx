import type { FC } from "react";
import type { ChartData } from "../core/model";
import type { ZiweiTheme } from "../core/theme";
import { FOURTEEN_MAIN_STAR_CODES, SIHUA_BADGE_ICON, SUB_STAR_CODES } from "../core/constants";
import { SIHUA_NAME_ZH, starNameZh } from "../core/registry";
import { STAR_SVG_DATA } from "./starSvgData";

interface ChartLegendProps {
  data: ChartData;
  theme: ZiweiTheme;
}

const SIHUA_ORDER = ["FO", "PW", "HO", "BI"] as const;

/**
 * 命盤下方的圖例對照表（圖示 → 星名），對應 p_e_artist composer._compose_legend：
 * 分區（主星／輔星／四化）列出本盤出現且有圖檔的星曜，依十二宮順序去重。
 * 以 HTML 呈現而非畫進 SVG：命盤縮到手機寬時，SVG 內的 11px 字會小到讀不了。
 */
export const ChartLegend: FC<ChartLegendProps> = ({ data, theme }) => {
  const seen = new Set<string>();
  const mains: string[] = [];
  const subs: string[] = [];
  const sihuaSeen = new Set<string>();
  for (const palace of Object.values(data.palaces)) {
    for (const st of palace.stars) {
      if (st.sihua) sihuaSeen.add(st.sihua);
      if (seen.has(st.code) || !STAR_SVG_DATA[st.code]) continue;
      seen.add(st.code);
      if (FOURTEEN_MAIN_STAR_CODES.has(st.code)) mains.push(st.code);
      else if (SUB_STAR_CODES.has(st.code)) subs.push(st.code);
    }
  }

  const sections: Array<{ title: string; items: Array<{ icon: string; name: string }> }> = [];
  if (mains.length) {
    sections.push({ title: "主星", items: mains.map((c) => ({ icon: c, name: starNameZh(c) })) });
  }
  if (subs.length) {
    sections.push({ title: "輔星", items: subs.map((c) => ({ icon: c, name: starNameZh(c) })) });
  }
  const sihua = SIHUA_ORDER.filter((c) => sihuaSeen.has(c));
  if (sihua.length) {
    sections.push({
      title: "四化",
      items: sihua.map((c) => ({ icon: SIHUA_BADGE_ICON[c], name: SIHUA_NAME_ZH[c] })),
    });
  }
  if (!sections.length) return null;

  return (
    <div
      aria-label="圖例"
      style={{
        marginTop: 10,
        padding: "10px 14px 0",
        borderTop: `0.5px solid ${theme.colors.gridStroke}`,
        fontFamily: theme.fontFamily,
        color: theme.colors.palaceName,
      }}
    >
      {sections.map((sec) => (
        <section key={sec.title} style={{ marginBottom: 10 }}>
          <h4 style={{ margin: "0 0 4px", fontSize: 12, fontWeight: 700 }}>{sec.title}</h4>
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "grid",
              // 寬版 4 欄（同書籍圖例），窄版自動減欄
              gridTemplateColumns: "repeat(auto-fill, minmax(max(104px, 22%), 1fr))",
              columnGap: 8,
            }}
          >
            {sec.items.map(({ icon, name }) => {
              const d = STAR_SVG_DATA[icon];
              return (
                <li
                  key={icon}
                  style={{ display: "flex", alignItems: "center", gap: 8, height: 30, fontSize: 12 }}
                >
                  {d ? (
                    <svg
                      width={22}
                      height={22}
                      viewBox={d.viewBox}
                      color={theme.colors.starGlyph}
                      aria-hidden="true"
                      style={{ flexShrink: 0 }}
                      dangerouslySetInnerHTML={{ __html: d.inner }}
                    />
                  ) : null}
                  <span>{name}</span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
};
