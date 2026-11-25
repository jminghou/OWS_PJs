/**
 * 運限宮位方向。與 tests/test_fortune_palace_direction.py 讀同一份上游向量，
 * 並比對同一組合成輸入的 decade / small / year 完整編碼。
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { DecadeData, FlowRaw } from "../src/flow/data";
import {
  buildDecadePalaceMapping,
  calculateDecadeChartEncoding,
  calculatePalaceInDecade,
  calculateSmallLimitEncoding,
  calculateYearFlowEncoding,
} from "../src/flow/encoder";
import { sha256Of } from "../src/util/canonical";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "../../..");
const VECTORS = join(HERE, "fixtures/fortune_direction_test_vectors.json");
const PARITY = join(HERE, "fixtures/fortune_encoding_parity_input.json");

const PALACE_NAMES = ["命宮", "兄弟", "夫妻", "子女", "財帛", "疾厄", "遷移", "交友", "官祿", "田宅", "福德", "父母"];
const PALACE_CODES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "A", "B", "C"];
const NAME_TO_CODE: Record<string, string> = Object.fromEntries(PALACE_NAMES.map((n, i) => [n, PALACE_CODES[i]]));
const CODE_TO_NAME: Record<string, string> = Object.fromEntries(PALACE_CODES.map((c, i) => [c, PALACE_NAMES[i]]));

interface VectorFile {
  vectors: Array<{
    id: string;
    input: { yin_yang: string; gender: string; natal_palace_branches: Record<string, string> };
    decades: Array<{
      decade_order: number;
      decade_ming_branch: string;
      palace_branches: Record<string, string>;
      natal_to_decade_code: Record<string, string>;
    }>;
    flow_star_palace: Record<string, Record<string, string>>;
  }>;
}

function decadeData(vector: VectorFile["vectors"][number]): DecadeData {
  const branchToName: Record<string, string> = {};
  for (const [name, branch] of Object.entries(vector.input.natal_palace_branches)) branchToName[branch] = name;
  const data = {} as DecadeData;
  for (const decade of vector.decades) {
    const name = branchToName[decade.decade_ming_branch];
    data[name] = {
      大限順序: String(decade.decade_order),
      大限名稱: "",
      大限歲數: "",
      大限西元區間: "",
      宮位: decade.decade_ming_branch,
      年干: "",
      地支: decade.decade_ming_branch,
      大限星曜: {},
    };
  }
  return data;
}

function branchesFromMapping(mapping: Record<string, string>, natal: Record<string, string>): Record<string, string> {
  const got: Record<string, string> = {};
  for (const [name, branch] of Object.entries(natal)) {
    got[CODE_TO_NAME[mapping[NAME_TO_CODE[name]]]] = branch;
  }
  return got;
}

describe("運限宮位方向向量", () => {
  const doc = JSON.parse(readFileSync(VECTORS, "utf-8")) as VectorFile;

  it("8 張合成盤的宮位映射、宮支、流曜宮位全部相符", () => {
    expect(doc.vectors).toHaveLength(8);
    expect(doc.vectors.filter((v) => v.input.yin_yang === "陽")).toHaveLength(4);
    expect(doc.vectors.filter((v) => v.input.yin_yang === "陰")).toHaveLength(4);
    expect(doc.vectors.filter((v) => v.input.gender === "男")).toHaveLength(8);

    let mappings = 0;
    let branches = 0;
    let stars = 0;
    for (const vector of doc.vectors) {
      const data = decadeData(vector);
      for (const decade of vector.decades) {
        const got = buildDecadePalaceMapping(data, decade.decade_order);
        expect(got, `${vector.id} decade ${decade.decade_order}`).toEqual(decade.natal_to_decade_code);
        mappings += 1;
        expect(
          branchesFromMapping(got, vector.input.natal_palace_branches),
          `${vector.id} decade ${decade.decade_order} branches`,
        ).toEqual(decade.palace_branches);
        branches += 1;
      }
      for (const [start, byStar] of Object.entries(vector.flow_star_palace)) {
        for (const [star, code] of Object.entries(byStar)) {
          expect(calculatePalaceInDecade(star, start), `${vector.id} ${start}->${star}`).toBe(code);
          stars += 1;
        }
      }
    }
    expect([mappings, branches, stars]).toEqual([96, 96, 1152]);
  });

  it("負數地支差歸一到 0..11：申到亥是田宅 A", () => {
    expect(calculatePalaceInDecade("亥", "申")).toBe("A");
  });
});

describe("Python 與 TS 運限編碼一致", () => {
  it("decade_chart_encoding / small_limit_encoding / year_flow_encoding 全等", () => {
    const payload = JSON.parse(readFileSync(PARITY, "utf-8"));
    const raw = execFileSync("python3", ["tests/test_fortune_palace_direction.py", "--dump-parity"], {
      cwd: REPO,
      encoding: "utf-8",
      maxBuffer: 64 * 1024 * 1024,
    });
    const py = JSON.parse(raw) as {
      decade_chart_encoding: unknown[];
      small_limit_encoding: unknown[];
      year_flow_encoding: unknown[];
    };
    const flow = {
      大限資料: payload.大限資料,
      大限四化: {},
      小限資料: payload.小限資料,
      流年資料: payload.流年資料,
    } as FlowRaw;
    const ts = {
      decade_chart_encoding: calculateDecadeChartEncoding(payload.natal_encoded_array, flow),
      small_limit_encoding: calculateSmallLimitEncoding(payload.natal_encoded_array, flow),
      year_flow_encoding: calculateYearFlowEncoding(payload.natal_encoded_array, flow),
    };
    expect(ts.decade_chart_encoding).toEqual(py.decade_chart_encoding);
    expect(ts.small_limit_encoding).toEqual(py.small_limit_encoding);
    expect(ts.year_flow_encoding).toEqual(py.year_flow_encoding);
    expect(ts.decade_chart_encoding).toHaveLength(12);
    expect(ts.small_limit_encoding).toHaveLength(120);
    expect(ts.year_flow_encoding).toHaveLength(120);
    expect(sha256Of(ts.decade_chart_encoding)).toBe(sha256Of(py.decade_chart_encoding));
    expect(sha256Of(ts.small_limit_encoding)).toBe(sha256Of(py.small_limit_encoding));
    expect(sha256Of(ts.year_flow_encoding)).toBe(sha256Of(py.year_flow_encoding));
  });
});
