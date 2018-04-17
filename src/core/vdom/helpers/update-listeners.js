/* @flow */

import { warn } from 'core/util/index'
import { cached, isUndef } from 'shared/util'

const normalizeEvent = cached((name: string): {
  name: string,
  once: boolean,
  capture: boolean,
  passive: boolean
} => {
  // 笔记： passive 修饰符 &
  const passive = name.charAt(0) === '&'
  name = passive ? name.slice(1) : name

  // 笔记：once 修饰符 ~，存在 `~!` 修饰符，所以先解析 once
  const once = name.charAt(0) === '~' // Prefixed last, checked first
  name = once ? name.slice(1) : name

  // 笔记：capture 修饰符 !
  const capture = name.charAt(0) === '!'
  name = capture ? name.slice(1) : name

  return {
    name,
    once,
    capture,
    passive
  }
})

export function createFnInvoker (fns: Function | Array<Function>): Function {
  function invoker () {
    const fns = invoker.fns
    if (Array.isArray(fns)) {
      // 笔记：克隆函数数组防止更改
      const cloned = fns.slice()
      for (let i = 0; i < cloned.length; i++) {
        cloned[i].apply(null, arguments)
      }
    } else {
      // return handler return value for single handlers
      // 翻译： 在单个 handler 时返回结果值
      return fns.apply(null, arguments)
    }
  }
  invoker.fns = fns
  return invoker
}

export function updateListeners (
  on: Object,
  oldOn: Object,
  add: Function,
  remove: Function,
  vm: Component
) {
  let name, cur, old, event
  for (name in on) {
    cur = on[name]
    old = oldOn[name]
    event = normalizeEvent(name)
    if (isUndef(cur)) {
      process.env.NODE_ENV !== 'production' && warn(
        `Invalid handler for event "${event.name}": got ` + String(cur),
        vm
      )
    } else if (isUndef(old)) {
      // 笔记：老节点上不存在该事件，说明是第一次添加该事件
      if (isUndef(cur.fns)) {
        // 笔记：新节点该事件不存在 fns 属性，说明新事件未通过 invoker 封装，所以创建并替换
        cur = on[name] = createFnInvoker(cur)
      }
      add(event.name, cur, event.once, event.capture, event.passive)
    } else if (cur !== old) {
      // 笔记：
      //  新节点和老节点上存在该事件，但不是同一个 invoker（事实上，每次更新 vnode 的 on 都是未经封装的函数）
      //  此时复用老节点该事件的 invoker，更新老 invoker 的函数池
      old.fns = cur
      on[name] = old
    }
  }
  for (name in oldOn) {
    // 笔记：在老事件集中存在，新事件集中不存在，说明事件被移除了
    if (isUndef(on[name])) {
      event = normalizeEvent(name)
      remove(event.name, oldOn[name], event.capture)
    }
  }
}
