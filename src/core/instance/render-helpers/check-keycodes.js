/* @flow */

import config from 'core/config'
import { hyphenate } from 'shared/util'

/**
 * Runtime helper for checking keyCodes from config.
 * exposed as Vue.prototype._k
 * passing in eventKeyName as last argument separately for backwards compat
 *
 * 翻译：
 *  检查 config.keyCodes 的运行时工具
 *  暴露为 Vue.prototype._k
 *  最后一个参数传事件名，为了向后兼容
 *
 * 笔记：
 *  eventKeyCode 是否存在于 config.keyCodes[key] 中，不存在返回 true
 *  因为模板生成的 render 函数：
 *  ```
 *  if (!('button'in $event) && _k($event.keyCode, "enter", 13, $event.key))
 *    return null;
 *  m($event)
 *  ```
 */
export function checkKeyCodes (
  eventKeyCode: number,
  key: string,
  builtInAlias?: number | Array<number>,
  eventKeyName?: string
): ?boolean {
  const keyCodes = config.keyCodes[key] || builtInAlias
  if (keyCodes) {
    if (Array.isArray(keyCodes)) {
      return keyCodes.indexOf(eventKeyCode) === -1
    } else {
      return keyCodes !== eventKeyCode
    }
  } else if (eventKeyName) {
    return hyphenate(eventKeyName) !== key
  }
}
