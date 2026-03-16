'use client';

import { RefObject } from 'react';
import Button from './Button';

interface MarkdownToolbarProps {
  textareaRef: RefObject<HTMLTextAreaElement>;
  content: string;
  onContentChange: (content: string) => void;
}

export default function MarkdownToolbar({ textareaRef, content, onContentChange }: MarkdownToolbarProps) {
  const insertText = (
    insertSyntax: string,
    selectText?: string,
    selectStart?: number,
    selectLength?: number
  ) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const cursorPos = textarea.selectionStart;
      const textBefore = content.substring(0, cursorPos);
      const textAfter = content.substring(cursorPos);
      const newValue = textBefore + insertSyntax + textAfter;

      onContentChange(newValue);

      setTimeout(() => {
        textarea.focus();
        if (selectText && selectStart !== undefined) {
          const newCursorPos = cursorPos + selectStart;
          const endPos = selectLength ? newCursorPos + selectLength : newCursorPos + selectText.length;
          textarea.setSelectionRange(newCursorPos, endPos);
        } else if (selectStart !== undefined) {
          const newCursorPos = cursorPos + selectStart;
          textarea.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    }
  };

  const toolbarButtons = [
    // 第一排按鈕
    {
      label: 'H1',
      action: () => insertText('# 大標題 H1', '大標題 H1', 2, 5),
    },
    {
      label: 'H2',
      action: () => insertText('## 中標題 H2', '中標題 H2', 3, 5),
    },
    {
      label: 'H3',
      action: () => insertText('### 小標題 H3', '小標題 H3', 4, 5),
    },
    {
      label: 'H4',
      action: () => insertText('#### 副標題 H4', '副標題 H4', 5, 5),
    },
    {
      label: 'H5',
      action: () => insertText('##### 子標題 H5', '子標題 H5', 6, 5),
    },
    {
      label: '斜體',
      action: () => insertText('*斜體字*', '斜體字', 1, 3),
    },
    {
      label: '粗體',
      action: () => insertText('**粗體字**', '粗體字', 2, 3),
    },
    {
      label: '粗斜',
      action: () => insertText('***粗斜體***', '粗斜體', 3, 3),
    },
    {
      label: '引文',
      action: () => insertText('> 第一層引文\n>> 第二層引文\n>>> 第三層引文', '第一層引文', 2, 5),
    },
    {
      label: '連結',
      action: () => insertText('[連結名稱](https://example.com "游標顯示文字")', '連結名稱', 1, 4),
    },
    {
      label: '網址',
      action: () => insertText('<https://example.com>', 'https://example.com', 1, 19),
    },
  ];

  const secondRowButtons = [
    {
      label: '核選方塊',
      action: () => insertText('- [ ] 未完成項目\n- [x] 已完成項目', '未完成項目', 6, 5),
    },
    {
      label: '置中圖片',
      action: () => insertText('\n<div align="center">\n![圖片描述](圖片路徑)\n</div>\n', '圖片描述', 23, 4),
    },
    {
      label: 'CSS置中',
      action: () => insertText('\n<img src="圖片路徑" alt="圖片描述" style="display: block; margin: 0 auto;" />\n', '圖片路徑', 11, 4),
    },
    {
      label: '上下標',
      action: () => insertText('^上標^ 正常 ~下標~'),
    },
    {
      label: '螢光標記',
      action: () => insertText('<mark>螢光標記</mark>', '螢光標記', 6, 4),
    },
    {
      label: '插入線',
      action: () => insertText('<ins>插入線</ins>', '插入線', 5, 3),
    },
    {
      label: '刪除線',
      action: () => insertText('~~刪除線~~', '刪除線', 2, 3),
    },
    {
      label: '分隔線',
      action: () => insertText('\n---\n', undefined, 5),
    },
    {
      label: '程式碼',
      action: () => insertText('\n```javascript\n// 程式碼內容\nconsole.log("Hello World!");\n```\n', '// 程式碼內容', 16, 7),
    },
  ];

  return (
    <div className="mb-4 p-2 border border-gray-200 rounded-lg bg-gray-50">
      <div className="space-y-2">
        <div className="flex items-center space-x-2 flex-wrap">
          <span className="text-xs text-gray-600 font-medium">Markdown 語法</span>
          {toolbarButtons.map((button, index) => (
            <Button
              key={index}
              type="button"
              variant="outline"
              size="sm"
              onClick={button.action}
              className="h-6 px-4 text-xs text-gray-400 hover:bg-blue-50 hover:text-blue-600 active:bg-blue-100 active:text-blue-700"
            >
              {button.label}
            </Button>
          ))}
        </div>
        <div className="flex items-center space-x-2 flex-wrap">
          {secondRowButtons.map((button, index) => (
            <Button
              key={index}
              type="button"
              variant="outline"
              size="sm"
              onClick={button.action}
              className="h-6 px-4 text-xs text-gray-400 hover:bg-blue-50 hover:text-blue-600 active:bg-blue-100 active:text-blue-700"
            >
              {button.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
