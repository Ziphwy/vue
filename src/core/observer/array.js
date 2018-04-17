/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 *
 * 翻译：在这个文件没有启用类型检查，因为 flow 对数组原型上动态访问方法支持度不足
 */

import { def } from '../util/index'

const arrayProto = Array.prototype
export const arrayMethods = Object.create(arrayProto)

/**
 * Intercept mutating methods and emit events
 *
 * 翻译：拦截变异方法并且发射事件
 * 笔记：
 *  使用数组原型创建了一个对象，添加变异方法
 *  用于替换被观察数组的原型，这样就不需要往每一个被观察的数组重写方法
 */
;[
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]
.forEach(function (method) {
  // cache original method
  const original = arrayProto[method]
  def(arrayMethods, method, function mutator (...args) {
    const result = original.apply(this, args)
    const ob = this.__ob__
    let inserted
    switch (method) {
      case 'push':
      case 'unshift':
        inserted = args
        break
      case 'splice':
        inserted = args.slice(2)
        break
    }
    if (inserted) ob.observeArray(inserted)
    // notify change
    // 翻译：通知订阅者
    ob.dep.notify()
    return result
  })
})
