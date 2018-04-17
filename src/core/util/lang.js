/* @flow */

export const emptyObject = Object.freeze({})

/**
 * Check if a string starts with $ or _
 *
 * 翻译：检查是否是 $ 或者 _ 开头的
 * 笔记：vue 使用 $ 和 _ 开头定义隐藏变量和私有变量
 */
export function isReserved (str: string): boolean {
  const c = (str + '').charCodeAt(0)
  return c === 0x24 || c === 0x5F
}

/**
 * Define a property.
 *
 * 定义一个属性（默认是描述符可变，不可枚举，可写）
 */
export function def (obj: Object, key: string, val: any, enumerable?: boolean) {
  Object.defineProperty(obj, key, {
    value: val,
    enumerable: !!enumerable,
    writable: true,
    configurable: true
  })
}

/**
 * Parse simple path.
 *
 * 翻译：解析简单路劲
 *
 * 笔记：
 *  解析形如 a.b.c 的表达式
 *  实际上就是 reduce 操作取得内层值
 */
const bailRE = /[^\w.$]/
export function parsePath (path: string): any {
  if (bailRE.test(path)) {
    return
  }
  const segments = path.split('.')
  return function (obj) {
    for (let i = 0; i < segments.length; i++) {
      if (!obj) return
      obj = obj[segments[i]]
    }
    return obj
  }
}
