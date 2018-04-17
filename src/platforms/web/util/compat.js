/* @flow */

import { inBrowser } from 'core/util/index'

// check whether current browser encodes a char inside attribute values
// 翻译：检查当前浏览器是否对特性值字符编码
function shouldDecode (content: string, encoded: string): boolean {
  const div = document.createElement('div')
  div.innerHTML = `<div a="${content}"/>`
  return div.innerHTML.indexOf(encoded) > 0
}

// #3663
// IE encodes newlines inside attribute values while other browsers don't
// 翻译：IE 在特性值中的换行编码成 `&#10;`
export const shouldDecodeNewlines = inBrowser ? shouldDecode('\n', '&#10;') : false
