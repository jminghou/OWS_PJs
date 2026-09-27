/**
 * 第 0 週煙測畫面：證明三件事在手機上成立
 *   1. @ows/ziwei-engine 在 Hermes 上離線算出 chart_json（零網路）
 *   2. @ows/ziwei-chart/core 的版面數學（GridLayout）可直接重用
 *   3. react-native-svg 能把十二宮方圖畫出來
 * 正式的互動命盤（點宮位、三方四正、圖層）之後在 src/ 下做，這個檔只留骨架。
 */
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Svg, { G, Line, Rect, Text as SvgText } from "react-native-svg";
import { calculateChart } from "@ows/ziwei-engine";
import {
  DEFAULT_THEME, GridLayout, PALACE_CODES_12, palaceNameZh, parseChart, starNameZh,
  BRANCH_NAME_ZH, STEM_NAME_ZH, SIHUA_LABEL,
} from "@ows/ziwei-chart/core";

const SAMPLE = { year: 1980, month: 11, day: 17, hour: 10, minute: 0, gender: "男" as const, name: "測試" };

export default function App() {
  const { width } = useWindowDimensions();
  const [hour, setHour] = useState(SAMPLE.hour);

  const { result, chart, ms } = useMemo(() => {
    const t0 = Date.now();
    const r = calculateChart({ ...SAMPLE, hour }, { includeFlow: false });
    return { result: r, chart: parseChart(r.chart_json as any), ms: Date.now() - t0 };
  }, [hour]);

  const grid = useMemo(() => new GridLayout(DEFAULT_THEME), []);
  const scale = (width - 24) / grid.canvasW;
  const font = 13 / scale;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.title}>紫微斗數 · 離線排盤煙測</Text>
        <Text style={styles.meta}>
          {SAMPLE.year}/{SAMPLE.month}/{SAMPLE.day} {String(hour).padStart(2, "0")}:00 {SAMPLE.gender}
          命盤 ID {result.chart.chart_id}　算盤 {ms} ms
        </Text>
        <Text style={styles.meta}>
          {result.chart.曆法數據.農曆出生日期}　{result.chart.曆法數據.出生時辰}
          {result.chart.命盤數據.五行局}　命主{result.chart.命盤數據.命主}　身主{result.chart.命盤數據.身主}
        </Text>

        <Svg width={grid.canvasW * scale} height={grid.canvasH * scale} viewBox={`0 0 ${grid.canvasW} ${grid.canvasH}`}>
          <Rect x={0} y={0} width={grid.canvasW} height={grid.canvasH} fill="#fffdf8" />
          {PALACE_CODES_12.map((code) => {
            const p = chart.palaces[code];
            if (!p) return null;
            const cell = grid.branchToCell(p.branch);
            const isBody = chart.bodyPalace === code;
            const isMing = code === "1";
            return (
              <G key={code}>
                <Rect
                  x={cell.x} y={cell.y} width={cell.w} height={cell.h}
                  fill={isMing ? "#f3e8ff" : "#ffffff"} stroke="#8b5cf6" strokeWidth={isBody ? 4 : 1.5}
                />
                <SvgText x={cell.x + 8} y={cell.y + font + 6} fontSize={font} fontWeight="bold" fill="#4c1d95">
                  {palaceNameZh(code)}{isBody ? "·身" : ""}
                </SvgText>
                <Line x1={cell.x + 6} y1={cell.y + font + 12} x2={cell.x + cell.w - 6} y2={cell.y + font + 12} stroke="#ddd6fe" strokeWidth={1} />
                {p.majors.map((s, i) => (
                  <SvgText key={s.code} x={cell.x + 10 + i * (font * 2.4)} y={cell.y + font * 2 + 20} fontSize={font} fill="#111827">
                    {starNameZh(s.code)}{s.sihua ? SIHUA_LABEL[s.sihua] ?? "" : ""}
                  </SvgText>
                ))}
                {p.subs.map((s, i) => (
                  <SvgText key={s.code} x={cell.x + 10 + i * (font * 2.2)} y={cell.y + font * 3.2 + 22} fontSize={font * 0.85} fill="#6b7280">
                    {starNameZh(s.code)}
                  </SvgText>
                ))}
                <SvgText x={cell.x + 8} y={cell.y + cell.h - 8} fontSize={font * 0.9} fill="#9ca3af">
                  {p.stem ? STEM_NAME_ZH[p.stem] ?? "" : ""}{BRANCH_NAME_ZH[p.branch] ?? ""}
                </SvgText>
              </G>
            );
          })}
          {(() => {
            const c = grid.centerRect();
            return (
              <G>
                <Rect x={c.x} y={c.y} width={c.w} height={c.h} fill="#faf5ff" stroke="#8b5cf6" strokeWidth={1.5} />
                <SvgText x={c.x + c.w / 2} y={c.y + c.h / 2 - font} fontSize={font * 1.3} textAnchor="middle" fill="#4c1d95">
                  {result.chart.基本資料.命盤主}
                </SvgText>
                <SvgText x={c.x + c.w / 2} y={c.y + c.h / 2 + font * 0.8} fontSize={font} textAnchor="middle" fill="#6b7280">
                  {result.chart.曆法數據.生年干支}年 {result.chart.命盤數據.陰陽}
                </SvgText>
              </G>
            );
          })()}
        </Svg>

        <View style={styles.row}>
          {[0, 2, 10, 14, 23].map((h) => (
            <Pressable key={h} onPress={() => setHour(h)} style={[styles.btn, h === hour && styles.btnOn]}>
              <Text style={[styles.btnText, h === hour && styles.btnTextOn]}>{h}:00</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.hint}>切換時辰 → 引擎在裝置上重算，命宮跟著移動。</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fffdf8" },
  body: { padding: 12, alignItems: "center", gap: 8 },
  title: { fontSize: 18, fontWeight: "700", color: "#4c1d95" },
  meta: { fontSize: 12, color: "#6b7280", textAlign: "center" },
  row: { flexDirection: "row", gap: 8, marginTop: 8 },
  btn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: "#8b5cf6" },
  btnOn: { backgroundColor: "#8b5cf6" },
  btnText: { color: "#4c1d95", fontSize: 12 },
  btnTextOn: { color: "#fff" },
  hint: { fontSize: 11, color: "#9ca3af", marginTop: 4 },
});
