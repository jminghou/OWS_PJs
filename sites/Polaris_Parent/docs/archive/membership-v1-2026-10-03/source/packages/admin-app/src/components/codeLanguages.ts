/**
 * 程式碼區塊的語法上色：只註冊文章裡實際會出現的語言。
 *
 * 之前用 lowlight 的 `common`（highlight.js 的 37 種常用語言）一次全載，是後台編輯器
 * 最大的單一依賴之一；三個站台的文章幾乎不貼程式碼，沒必要背這包。
 * 之後要補語言：在 highlight.js/lib/languages/ 找到檔名，加一行 import、
 * 一行 register、CODE_LANGUAGES 加一個選項即可。未註冊的語言會以純文字顯示，不會壞。
 */
/// <reference path="../highlight-languages.d.ts" />
import { createLowlight } from 'lowlight';
import bash from 'highlight.js/lib/languages/bash';
import css from 'highlight.js/lib/languages/css';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import python from 'highlight.js/lib/languages/python';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml'; // highlight.js 的 HTML 就是 xml

export const lowlight = createLowlight();
lowlight.register({ javascript, typescript, python, bash, json, css, xml });
lowlight.registerAlias({ javascript: ['js'], typescript: ['ts'], bash: ['sh', 'shell'], xml: ['html'] });

/** 程式碼區塊語言下拉選單。value 必須是上面已註冊的名稱（或別名），'' 代表自動偵測。 */
export const CODE_LANGUAGES = [
  { value: '', label: 'Auto' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'bash', label: 'Bash' },
  { value: 'json', label: 'JSON' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
];
