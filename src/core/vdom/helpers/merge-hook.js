/* @flow */

import { createFnInvoker } from './update-listeners'
import { remove, isDef, isUndef, isTrue } from 'shared/util'

// 笔记：合并 vnode 的钩子
export function mergeVNodeHook (def: Object, hookKey: string, hook: Function) {
  let invoker
  const oldHook = def[hookKey]

  function wrappedHook () {
    hook.apply(this, arguments)
    // important: remove merged hook to ensure it's called only once
    // and prevent memory leak
    // 翻译：请注意：移除合并钩子确保它只被调用一次和防止内存泄露
    // 笔记：
    //  q: 为什么要确保钩子只调用一次？
    //  a: 估计是一个 vnode 的生命周期内每个钩子只应该触发一次
    //  q: 这意味着 update 这种钩子是 patch 的钩子？
    remove(invoker.fns, wrappedHook)
  }

  if (isUndef(oldHook)) {
    // no existing hook
    // 笔记：不存在老钩子，创建一个新 invoker
    invoker = createFnInvoker([wrappedHook])
  } else {
    /* istanbul ignore if */
    // 笔记：已经存在一个老的合并钩子
    if (isDef(oldHook.fns) && isTrue(oldHook.merged)) {
      // already a merged invoker
      // 笔记：如果老钩子是一个 merged invoker，复用老 invoker，往函数池推入新钩子
      invoker = oldHook
      invoker.fns.push(wrappedHook)
    } else {
      // existing plain hook
      // 笔记：如果老钩子是一个原生函数，创建一个新的 invoker
      //  q: 为什么无法保证 oldHook 是一个 invoker？
      invoker = createFnInvoker([oldHook, wrappedHook])
    }
  }
  // 笔记：
  //  q: 为什么要给 invoker 添加 merged 特殊化？
  //  a: 标记是否被合并，用于判断是否只有默认钩子，
  //  `  如果是合并钩子，目前发现在组件根节点被替换时，需要更新组件在父组件上的占位节点，
  //     此时默认钩子不应该再次被调用，所以在函数池中逐个执行
  invoker.merged = true
  def[hookKey] = invoker
}
