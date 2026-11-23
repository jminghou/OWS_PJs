from pathlib import Path
root = Path('D:/P_Polaris_Parent/1_run/PolarisUI/frontend/src')
api = root / 'lib/api.ts'
text = api.read_text(encoding='utf-8')
assert 'export async function uploadReportArtifact' not in text
text = text.replace('export interface ReportRequest {', 'export interface ReportRequest {\n  artifact_revision: number;')
text += '''

export async function uploadReportArtifact(r: ReportRequest, file: File): Promise<void> {
  if (!file.name.toLowerCase().endsWith('.pdf') || file.size > 100 * 1024 * 1024) {
    throw new Error('請選擇 100 MB 以內的 PDF');
  }
  const body = new FormData();
  body.append('file', file);
  body.append('expected_revision', String(r.artifact_revision));
  body.append('source_updated_at', r.updated_at);
  const response = await apiFetch(`${API_BASE}/report-requests/${encodeURIComponent(r.request_no)}/artifact`, { method: 'POST', body });
  if (!response.ok) throw new Error(formatApiError('登錄成品失敗', response.status, await response.text()));
}
'''
page = root / 'app/orders/page.tsx'
ui = page.read_text(encoding='utf-8')
ui = ui.replace('  assignReportRequest,', '  uploadReportArtifact,\n  assignReportRequest,', 1)
ui = ui.replace('完成後到官網後台「報告交付」上傳 PDF，再回來標記完成。（PDF 自動回傳官網是下一階段）',
                '標記完成後登錄最終 PDF，官網管理者再查詢並核對交付。')
ui = ui.replace('製作完成後請到官網後台「報告交付」上傳 PDF，再回來標記完成。',
                '標記完成後登錄最終 PDF，再由官網後台核對並交付。')
anchor = '          {r.language !== "zh-TW" && ('
assert anchor in ui
ui = ui.replace(anchor, '''          {r.status === 'completed' && r.can_edit && <label className="rounded-sm2 border border-line p-3 text-sm">
            <span>登錄最終 PDF（已登錄 {r.artifact_revision} 版）</span>
            <input type="file" accept="application/pdf,.pdf" disabled={busy} className="mt-2 w-full text-xs"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) void run(() => uploadReportArtifact(r, file), '成品已登錄，請由官網後台核對並交付');
              }} />
            <p className="mt-2 text-xs text-muted">請確認為此訂單與語言的最終成品；登錄後尚未開放會員下載。</p>
          </label>}

''' + anchor, 1)
api.write_text(text, encoding='utf-8')
page.write_text(ui, encoding='utf-8')
print('Installed production PDF registration UI')
