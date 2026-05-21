/**
 * 輸出 JSON-LD 結構化資料的 <script>。
 * 接受單一物件或物件陣列（多筆 schema 一次輸出）。Server Component，可直接用於 SSR。
 */
interface JsonLdProps {
  data: object | object[];
}

export default function JsonLd({ data }: JsonLdProps) {
  const items = Array.isArray(data) ? data : [data];
  return (
    <>
      {items.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
    </>
  );
}
