/* @flow */

import { emptyNode } from 'core/vdom/patch'
import { resolveAsset, handleError } from 'core/util/index'
import { mergeVNodeHook } from 'core/vdom/helpers/index'

/**
 * 笔记：
 *  指令其实是变相的生命周期钩子
 *  q: 每次 vnode 进行 patch 时，指令都会重新装载，这个不需要考虑效率吗？(事件机制也是一样)
 */
export default {
  create: updateDirectives,
  update: updateDirectives,
  destroy: function unbindDirectives (vnode: VNodeWithData) {
    updateDirectives(vnode, emptyNode)
  }
}

function updateDirectives (oldVnode: VNodeWithData, vnode: VNodeWithData) {
  if (oldVnode.data.directives || vnode.data.directives) {
    _update(oldVnode, vnode)
  }
}

function _update (oldVnode, vnode) {
  const isCreate = oldVnode === emptyNode
  const isDestroy = vnode === emptyNode
  const oldDirs = normalizeDirectives(oldVnode.data.directives, oldVnode.context)
  const newDirs = normalizeDirectives(vnode.data.directives, vnode.context)

  const dirsWithInsert = []
  const dirsWithPostpatch = []

  let key, oldDir, dir
  for (key in newDirs) {
    oldDir = oldDirs[key]
    dir = newDirs[key]
    if (!oldDir) {
      // new directive, bind
      // 笔记：
      //  老指令中已经存在该指令
      //    1. 新指令，调用 bind 钩子
      //    2. 存在inserted 钩子，推入 insert 队列
      callHook(dir, 'bind', vnode, oldVnode)
      if (dir.def && dir.def.inserted) {
        dirsWithInsert.push(dir)
      }
    } else {
      // existing directive, update
      // 笔记：
      //  老指令中已经存在该指令
      //    1. 记录上一次指令 value
      //    2. 调用 update 钩子
      //    3. 存在 componentUpdated 钩子，推入 postpatch 队列
      dir.oldValue = oldDir.value
      callHook(dir, 'update', vnode, oldVnode)
      if (dir.def && dir.def.componentUpdated) {
        dirsWithPostpatch.push(dir)
      }
    }
  }

  if (dirsWithInsert.length) {
    const callInsert = () => {
      for (let i = 0; i < dirsWithInsert.length; i++) {
        callHook(dirsWithInsert[i], 'inserted', vnode, oldVnode)
      }
    }
    if (isCreate) {
      // 笔记：在创建组件时，将指令的 insert 钩子合并到 vnode 的 insert 钩子上
      mergeVNodeHook(vnode.data.hook || (vnode.data.hook = {}), 'insert', callInsert)
    } else {
      // 笔记：在更新和销毁时直接调用 insert 钩子
      callInsert()
    }
  }

  if (dirsWithPostpatch.length) {
    // 笔记：在创建组件时，将指令的 componentUpdated 钩子合并到 vnode 的 postpatch 钩子上
    mergeVNodeHook(vnode.data.hook || (vnode.data.hook = {}), 'postpatch', () => {
      for (let i = 0; i < dirsWithPostpatch.length; i++) {
        callHook(dirsWithPostpatch[i], 'componentUpdated', vnode, oldVnode)
      }
    })
  }

  if (!isCreate) {
    // 笔记：
    //  不在创建的时候，检查旧指令集，如果在新指令中不存在，则调用 unbind 钩子
    //  q: 这些方法都是考虑了 patch 操作会动态变化指令？没能想到能动态变化指令的场景。或许跟原地复用有关？
    for (key in oldDirs) {
      if (!newDirs[key]) {
        // no longer present, unbind
        callHook(oldDirs[key], 'unbind', oldVnode, oldVnode, isDestroy)
      }
    }
  }
}

const emptyModifiers = Object.create(null)

/**
 * 笔记：标准化指令对象
 */
function normalizeDirectives (
  dirs: ?Array<VNodeDirective>,
  vm: Component
): { [key: string]: VNodeDirective } {
  const res = Object.create(null)
  if (!dirs) {
    return res
  }
  let i, dir
  for (i = 0; i < dirs.length; i++) {
    dir = dirs[i]
    if (!dir.modifiers) {
      dir.modifiers = emptyModifiers
    }
    // 笔记：
    //  q: 为什么要用 rawName 做 key？
    //  a: 因为 name + modify 唯一标识一个指令，modify 不一样，指令的就不一样
    //     指令收到的参数实际上就是 dir 的内容
    res[getRawDirName(dir)] = dir
    // 笔记：挂载对应指令的钩子函数
    dir.def = resolveAsset(vm.$options, 'directives', dir.name, true)
  }
  return res
}

// 笔记：指令原始文本（形如：click.native.prevent）
function getRawDirName (dir: VNodeDirective): string {
  return dir.rawName || `${dir.name}.${Object.keys(dir.modifiers || {}).join('.')}`
}

// 笔记：调用钩子
function callHook (dir, hook, vnode, oldVnode, isDestroy) {
  const fn = dir.def && dir.def[hook]
  if (fn) {
    try {
      fn(vnode.elm, dir, vnode, oldVnode, isDestroy)
    } catch (e) {
      handleError(e, vnode.context, `directive ${dir.name} ${hook} hook`)
    }
  }
}
