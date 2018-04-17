/* @flow */

import { remove } from 'shared/util'

export default {
  create (_: any, vnode: VNodeWithData) {
    // 笔记：注册引用
    registerRef(vnode)
  },
  update (oldVnode: VNodeWithData, vnode: VNodeWithData) {
    // 笔记：如果新旧 ref 引用不一致，先删除原引用，重新注册
    if (oldVnode.data.ref !== vnode.data.ref) {
      registerRef(oldVnode, true)
      registerRef(vnode)
    }
  },
  destroy (vnode: VNodeWithData) {
    // 笔记：删除引用
    registerRef(vnode, true)
  }
}

export function registerRef (vnode: VNodeWithData, isRemoval: ?boolean) {
  const key = vnode.data.ref
  if (!key) return

  const vm = vnode.context
  // 笔记：
  //  1. 如果是普通节点，componentInstance 不存在，可以取得该节点真实 DOM
  //  2. 如果是组件节点，则返回组件实例（componentInstance）
  const ref = vnode.componentInstance || vnode.elm
  const refs = vm.$refs
  if (isRemoval) {
    if (Array.isArray(refs[key])) {
      // 笔记：如果是数组，逐个移除 DOM 引用
      remove(refs[key], ref)
    } else if (refs[key] === ref) {
      // 笔记：如果当前引用一致，直接重置为 undefined
      refs[key] = undefined
    }
  } else {
    // 笔记：
    //  q: refInFor 是什么？在 for 列表中的 ref ？
    //  a: 在 v-for 上 ref 标签，需要返回一个 DOM 列表，编译器会给每个 v-for 生成的节点标记 refInFor
    //
    //  每个 v-for 生成的节点都会触发注册，所以将 DOM 引用逐个添加进 vm.$refs = []
    if (vnode.data.refInFor) {
      if (!Array.isArray(refs[key])) {
        refs[key] = [ref]
      } else if (refs[key].indexOf(ref) < 0) {
        // $flow-disable-line
        refs[key].push(ref)
      }
    } else {
      refs[key] = ref
    }
  }
}
