/**
 * Virtual DOM patching algorithm based on Snabbdom by
 * Simon Friis Vindum (@paldepind)
 * Licensed under the MIT License
 * https://github.com/paldepind/snabbdom/blob/master/LICENSE
 *
 * modified by Evan You (@yyx990803)
 *
 * Not type-checking this because this file is perf-critical and the cost
 * of making flow understand it is not worth it.
 */

import VNode from './vnode'
import config from '../config'
import { SSR_ATTR } from 'shared/constants'
import { registerRef } from './modules/ref'
import { activeInstance } from '../instance/lifecycle'
import { isTextInputType } from 'web/util/element'

import {
  warn,
  isDef,
  isUndef,
  isTrue,
  makeMap,
  isRegExp,
  isPrimitive
} from '../util/index'

// 笔记：导出空节点，应该是作为单例
export const emptyNode = new VNode('', {}, [])

/**
 * 笔记：
 *  patch 操作的钩子，分别是：
 *  1. 新建 vnode
 *  2. 激活 vnode
 *  3. 更新 vnode
 *  4. 移除 vnode
 *  5. 销毁 vnode
 */
const hooks = ['create', 'activate', 'update', 'remove', 'destroy']

/**
 * 笔记：
 *  判断两个 vnode 是否相同
 *
 *  两者的 key 相等，且满足下面任一条件
 *    1. tag 类型一致，都是/不是注释节点，data 都不为空，如果是 input 类型要求type相同
 *    2. a 是异步占位符，两者是同一异步工厂函数，b 的异步工厂 error 未定义
 */
function sameVnode (a, b) {
  return (
    a.key === b.key && (
      (
        a.tag === b.tag &&
        a.isComment === b.isComment &&
        isDef(a.data) === isDef(b.data) &&
        sameInputType(a, b)
      ) || (
        isTrue(a.isAsyncPlaceholder) &&
        a.asyncFactory === b.asyncFactory &&
        isUndef(b.asyncFactory.error)
      )
    )
  )
}

/**
 * 笔记：
 *  如果是 input，判断 type 类型是否一致
 *  因为 type 属性不一样，input 节点的类型是不一致的
 *  该函数作为通用函数，对非 input 节点直接返回 true
 *
 *  1. 如果 a 节点不是 input 节点，无需判断，返回 true
 *  2. a 节点是 input 节点
 *    2.1 两个节点的 data.attrs.type 相同
 *    2.2 a 的 type 和 b 的 type 都是合法的
 *
 */
function sameInputType (a, b) {
  if (a.tag !== 'input') return true
  let i
  const typeA = isDef(i = a.data) && isDef(i = i.attrs) && i.type
  const typeB = isDef(i = b.data) && isDef(i = i.attrs) && i.type
  return typeA === typeB || isTextInputType(typeA) && isTextInputType(typeB)
}

/**
 * 笔记：
 *  创建一个 hashmap，便于找到新 vnode 原来的位置，即在旧 vnode 中位置
 *
 *  q: children 是什么类型？
 *  a: 指的是当前节点的 vnode 子节点
 *
 *  q: beginIdx 和 endIdx是什么?
 *  a: 当前旧节点的左右指针
 */
function createKeyToOldIdx (children, beginIdx, endIdx) {
  let i, key
  const map = {}
  for (i = beginIdx; i <= endIdx; ++i) {
    key = children[i].key
    if (isDef(key)) map[key] = i
  }
  return map
}

/**
 * 笔记：
 *  创建补丁函数
 *  q: backend 看起来像是服务端渲染使用的？
 *  a: backend 是各平台实现的底层 api，为了解耦虚拟 DOM 和 平台（ node/weex/browser ）差异
 */
export function createPatchFunction (backend) {
  let i, j
  const cbs = {}

  // 笔记：
  //  q: modules 和 nodeOps 是什么？
  //  a: nodeOps 是各平台实现的底层 DOM 接口
  const { modules, nodeOps } = backend

  // 笔记：初始化钩子函数集合
  for (i = 0; i < hooks.length; ++i) {
    cbs[hooks[i]] = []
    for (j = 0; j < modules.length; ++j) {
      if (isDef(modules[j][hooks[i]])) {
        cbs[hooks[i]].push(modules[j][hooks[i]])
      }
    }
  }

  // 笔记：为真实 DOM 节点创建一个同类型的空数据 vnode
  function emptyNodeAt (elm) {
    return new VNode(nodeOps.tagName(elm).toLowerCase(), {}, [], undefined, elm)
  }

  /**
   * 笔记：
   *  用于移除真实子节点，创建一个函数,
   *  每次调用该函数，会监听器计数减一,
   *  主要如 transition 动画，不能直接移除 DOM ，需要动画过渡完成再移除
   */
  function createRmCb (childElm, listeners) {
    function remove () {
      if (--remove.listeners === 0) {
        removeNode(childElm)
      }
    }
    remove.listeners = listeners
    return remove
  }

  // 笔记：移除一个真实节点
  function removeNode (el) {
    const parent = nodeOps.parentNode(el)
    /**
     * element may have already been removed due to v-html / v-text
     *
     * 翻译：
     *  元素有可能已经被移除，因为 v-html 和 v-text 指令
     *
     * 笔记：
     *  q: 为什么？指令响应？
     */
    if (isDef(parent)) {
      nodeOps.removeChild(parent, el)
    }
  }

  /**
   * 笔记：
   *  递归创建虚拟 DOM 的真实节点
   *
   *  q: inPre 是做什么的？
   */
  let inPre = 0
  function createElm (vnode, insertedVnodeQueue, parentElm, refElm, nested) {
    vnode.isRootInsert = !nested // for transition enter check
    // 笔记：尝试根据 vnode 创建组件
    if (createComponent(vnode, insertedVnodeQueue, parentElm, refElm)) {
      return
    }

    const data = vnode.data
    const children = vnode.children
    const tag = vnode.tag

    // 笔记：普通节点
    if (isDef(tag)) {
      // 笔记：未知标签警告
      if (process.env.NODE_ENV !== 'production') {
        if (data && data.pre) {
          inPre++
        }
        if (
          !inPre &&
          !vnode.ns &&
          !(
            config.ignoredElements.length &&
            config.ignoredElements.some(ignore => {
              return isRegExp(ignore)
                ? ignore.test(tag)
                : ignore === tag
            })
          ) &&
          config.isUnknownElement(tag)
        ) {
          warn(
            'Unknown custom element: <' + tag + '> - did you ' +
            'register the component correctly? For recursive components, ' +
            'make sure to provide the "name" option.',
            vnode.context
          )
        }
      }
      // 笔记：创建真实节点，并设置 scopeId
      vnode.elm = vnode.ns
        ? nodeOps.createElementNS(vnode.ns, tag)
        : nodeOps.createElement(tag, vnode)
      setScope(vnode)

      /* istanbul ignore if */
      if (__WEEX__) {
        // in Weex, the default insertion order is parent-first.
        // List items can be optimized to use children-first insertion
        // with append="tree".
        // 翻译：在 weex 中，默认的插入顺序是父优先，列表条目可以使用 append="tree" 优化为子优先
        const appendAsTree = isDef(data) && isTrue(data.appendAsTree)
        if (!appendAsTree) {
          if (isDef(data)) {
            invokeCreateHooks(vnode, insertedVnodeQueue)
          }
          insert(parentElm, vnode.elm, refElm)
        }
        createChildren(vnode, children, insertedVnodeQueue)
        if (appendAsTree) {
          if (isDef(data)) {
            invokeCreateHooks(vnode, insertedVnodeQueue)
          }
          insert(parentElm, vnode.elm, refElm)
        }
      } else {
        // 笔记：创建子元素真实节点
        createChildren(vnode, children, insertedVnodeQueue)

        // 笔记：调用 create 钩子，并插入当前真实节点到父节点
        if (isDef(data)) {
          invokeCreateHooks(vnode, insertedVnodeQueue)
        }
        insert(parentElm, vnode.elm, refElm)
      }

      if (process.env.NODE_ENV !== 'production' && data && data.pre) {
        inPre--
      }
    } else if (isTrue(vnode.isComment)) {
      // 笔记：注释节点
      vnode.elm = nodeOps.createComment(vnode.text)
      insert(parentElm, vnode.elm, refElm)
    } else {
      // 笔记：其余的任务是文本节点
      vnode.elm = nodeOps.createTextNode(vnode.text)
      insert(parentElm, vnode.elm, refElm)
    }
  }

  /**
   * 笔记：
   *  创建组件
   *  调用 vnode 的 init 钩子，初始化组件实例
   */
  function createComponent (vnode, insertedVnodeQueue, parentElm, refElm) {
    let i = vnode.data
    if (isDef(i)) {
      const isReactivated = isDef(vnode.componentInstance) && i.keepAlive
      if (isDef(i = i.hook) && isDef(i = i.init)) {
        i(vnode, false /* hydrating */, parentElm, refElm)
      }
      /**
       * after calling the init hook, if the vnode is a child component
       * it should've created a child instance and mounted it. the child
       * component also has set the placeholder vnode's elm.
       * in that case we can just return the element and be done.
       *
       * 翻译：
       *  在调用 init 钩子后，如果 vnode 是一个子组件，它必须创建一个子实例并且挂载
       *  子组件也需要在 vnode 设置占位节点，即 parent 属性
       *  在这种场景下，我们仅返回元素和完成操作
       * 笔记：
       *  q: 不理解为什么，init 钩子干什么？
       *  a: 此处 init 钩子是 vnode 的钩子，主要功能是为 vnode 创建一个组件实例并挂载，
       *     在挂载的过程中，会触发节点的实例创建，以及 render 函数，使得树深度生成
       */
      if (isDef(vnode.componentInstance)) {
        // 笔记：如果实例存在，进行初始化
        initComponent(vnode, insertedVnodeQueue)
        if (isTrue(isReactivated)) {
          // 笔记：如果是 keptAlive 的节点，重新激活它
          reactivateComponent(vnode, insertedVnodeQueue, parentElm, refElm)
        }
        return true
      }
    }
  }

  /**
   * 笔记：
   *  初始化组件
   */
  function initComponent (vnode, insertedVnodeQueue) {
    // 笔记：
    //  q: 为什么要存在 pendingInsert 里？
    //  a: 因为 insertedVnodeQueue 是 patch 函数的局部变量，每个 patch 函数递归调用
    //     需要先记录到 pendingInsert，再收集到上一级的 insertedVnodeQueue
    if (isDef(vnode.data.pendingInsert)) {
      insertedVnodeQueue.push.apply(insertedVnodeQueue, vnode.data.pendingInsert)
      vnode.data.pendingInsert = null
    }
    // 笔记：在占位节点上记录真实节点
    vnode.elm = vnode.componentInstance.$el
    if (isPatchable(vnode)) {
      // 笔记：如果是可 patch 的节点，调用 create 钩子
      invokeCreateHooks(vnode, insertedVnodeQueue)
      setScope(vnode)
    } else {
      // empty component root.
      // skip all element-related modules except for ref (#3455)
      // 翻译：如果是注释节点或者文本节点，跳过元素相关的模块（属性，样式等更新），仅注册 refs
      registerRef(vnode)
      // make sure to invoke the insert hook
      // 翻译：确保调用 insert 钩子
      // 笔记：组件的占位节点可能是空节点？
      insertedVnodeQueue.push(vnode)
    }
  }

  function reactivateComponent (vnode, insertedVnodeQueue, parentElm, refElm) {
    let i
    // hack for #4339: a reactivated component with inner transition
    // does not trigger because the inner node's created hooks are not called
    // again. It's not ideal to involve module-specific logic in here but
    // there doesn't seem to be a better way to do it.
    /**
     * 翻译：
     *  hack 解决 #4339
     *  一个重新激活的组件，内部的 transition 不会触发，因为内部节点的 created 钩子不会再次被调用
     *  在这里调用模块具体的逻辑不太合理，但是似乎没有什么更好的方法实现
     * 笔记：
     *  q: 需要梳理
     */
    let innerNode = vnode
    while (innerNode.componentInstance) {
      innerNode = innerNode.componentInstance._vnode
      if (isDef(i = innerNode.data) && isDef(i = i.transition)) {
        for (i = 0; i < cbs.activate.length; ++i) {
          cbs.activate[i](emptyNode, innerNode)
        }
        insertedVnodeQueue.push(innerNode)
        break
      }
    }
    // unlike a newly created component,
    // a reactivated keep-alive component doesn't insert itself
    // 翻译：不同于一个新创建的组件，一个重新激活的组件不会自行插入的
    // 笔记：新建组件在哪里自行插入？
    insert(parentElm, vnode.elm, refElm)
  }

  /**
   * 笔记：
   *  插入节点
   *    如果 ref 不存在，在父节点上插入
   *    如果 ref 存在，保证 ref 是 parent 的一个子节点（异常处理），在 ref 前面插入
   */
  function insert (parent, elm, ref) {
    if (isDef(parent)) {
      if (isDef(ref)) {
        if (ref.parentNode === parent) {
          nodeOps.insertBefore(parent, elm, ref)
        }
      } else {
        nodeOps.appendChild(parent, elm)
      }
    }
  }

  /**
   * 笔记：
   *  生成子元素真实节点或者内容文本
   *    如果 children 是数组，遍历生成子节点
   *    如果 children 不存在, 而 vnode 的 text 是基本类型，说明子节点是 <文本节点>，
   *    直接在当前真实节点上插入该文本节点
   */
  function createChildren (vnode, children, insertedVnodeQueue) {
    if (Array.isArray(children)) {
      for (let i = 0; i < children.length; ++i) {
        // 笔记：此时没有相对节点
        createElm(children[i], insertedVnodeQueue, vnode.elm, null, true)
      }
    } else if (isPrimitive(vnode.text)) {
      nodeOps.appendChild(vnode.elm, nodeOps.createTextNode(vnode.text))
    }
  }

  /**
   * 笔记：
   *  判断 vnode 是否可 patch
   *  如果是组件，找到组件的根节点 vnode
   *
   *  q: 为什么判断 tag 即可？tag 不存在意味着是不可修复？
   */
  function isPatchable (vnode) {
    while (vnode.componentInstance) {
      vnode = vnode.componentInstance._vnode
    }
    return isDef(vnode.tag)
  }

  /**
   * 笔记：
   *  1. 调用 patch 默认 create 钩子和平台差异化的 create 钩子
   *  2. 调用组件 vnode 上的 create 钩子（包含对应组件上的钩子）
   *  3. 如果组件上存在 insert 钩子，放入队列，等待插入文档流时再调用
   */
  function invokeCreateHooks (vnode, insertedVnodeQueue) {
    for (let i = 0; i < cbs.create.length; ++i) {
      cbs.create[i](emptyNode, vnode)
    }
    i = vnode.data.hook // Reuse variable
    if (isDef(i)) {
      if (isDef(i.create)) i.create(emptyNode, vnode)
      if (isDef(i.insert)) insertedVnodeQueue.push(vnode)
    }
  }

  // set scope id attribute for scoped CSS.
  // this is implemented as a special case to avoid the overhead
  // of going through the normal attribute patching process.
  // 翻译：
  //  为 scoped CSS 设置 scope id 特性。这是一个特殊的实现，
  //  避免经历普通特性 patch 处理的开销
  // 笔记：
  //  scope id 属性可以直接赋值到真实节点上，没必要进行 patch 操作
  function setScope (vnode) {
    let i
    if (isDef(i = vnode.functionalScopeId)) {
      nodeOps.setAttribute(vnode.elm, i, '')
    } else {
      // 笔记：找到所有组件占位节点上的 _scopeId 并设置到当前 vnode 的真实节点上
      let ancestor = vnode
      while (ancestor) {
        if (isDef(i = ancestor.context) && isDef(i = i.$options._scopeId)) {
          nodeOps.setAttribute(vnode.elm, i, '')
        }
        ancestor = ancestor.parent
      }
    }
    // for slot content they should also get the scopeId from the host instance.
    // 翻译：对于 slot 的内容，需要取得他们宿主实例的 scopeId
    if (isDef(i = activeInstance) &&
      i !== vnode.context &&
      i !== vnode.functionalContext &&
      isDef(i = i.$options._scopeId)
    ) {
      nodeOps.setAttribute(vnode.elm, i, '')
    }
  }

  /**
   * 笔记：根据位置和索引插入多个节点
   */
  function addVnodes (parentElm, refElm, vnodes, startIdx, endIdx, insertedVnodeQueue) {
    for (; startIdx <= endIdx; ++startIdx) {
      createElm(vnodes[startIdx], insertedVnodeQueue, parentElm, refElm)
    }
  }

  /**
   * 笔记：
   *  递归调用 vnode 和 patch 的 destory 钩子
   *  即组件的 destory 钩子
   */
  function invokeDestroyHook (vnode) {
    let i, j
    const data = vnode.data
    // 笔记：先调用 vnode 的 destory 钩子，再调用 patch 的 destory 钩子
    if (isDef(data)) {
      if (isDef(i = data.hook) && isDef(i = i.destroy)) i(vnode)
      for (i = 0; i < cbs.destroy.length; ++i) cbs.destroy[i](vnode)
    }
    // 笔记：递归调用子节点的 destory 钩子
    if (isDef(i = vnode.children)) {
      for (j = 0; j < vnode.children.length; ++j) {
        invokeDestroyHook(vnode.children[j])
      }
    }
  }

  /**
   * 笔记：
   *  根据父元素和索引移除多个子元素，并调用 remove，destory 钩子
   */
  function removeVnodes (parentElm, vnodes, startIdx, endIdx) {
    for (; startIdx <= endIdx; ++startIdx) {
      const ch = vnodes[startIdx]
      if (isDef(ch)) {
        if (isDef(ch.tag)) {
          removeAndInvokeRemoveHook(ch)
          invokeDestroyHook(ch)
        } else { // Text node
          removeNode(ch.elm)
        }
      }
    }
  }

  /**
   * 笔记：
   *  移除 vnode 节点，并调用 remove 钩子
   */
  function removeAndInvokeRemoveHook (vnode, rm) {
    if (isDef(rm) || isDef(vnode.data)) {
      let i
      const listeners = cbs.remove.length + 1
      if (isDef(rm)) {
        // we have a recursively passed down rm callback
        // increase the listeners count
        // 翻译：递归会传递一个 rm 的回调函数，
        rm.listeners += listeners
      } else {
        // directly removing
        // 笔记：
        //  通过统计每层 remove 钩子数量（listeners），将回调传递给 remove 钩子，并由他们自行定义调用时机
        //  这种做法感觉有点奇怪，因为如果有一个 remove 钩子不调用 rm，意味着这个节点最终无法被卸载
        rm = createRmCb(vnode.elm, listeners)
      }
      // recursively invoke hooks on child component root node
      // 翻译：递归调用子组件根节点上的钩子
      if (isDef(i = vnode.componentInstance) && isDef(i = i._vnode) && isDef(i.data)) {
        removeAndInvokeRemoveHook(i, rm)
      }
      // 笔记：调用 patch 的 remove 钩子，每次 remove 钩子需要实现 rm()
      for (i = 0; i < cbs.remove.length; ++i) {
        cbs.remove[i](vnode, rm)
      }
      // 笔记：调用 vnode 的 remove 钩子
      if (isDef(i = vnode.data.hook) && isDef(i = i.remove)) {
        i(vnode, rm)
      } else {
        // 笔记：如果没有钩子，调用删除节点函数
        rm()
      }
    } else {
      removeNode(vnode.elm)
    }
  }

  /**
   * 笔记：
   *  diff 核心算法，更新子节点
   *
   */
  function updateChildren (parentElm, oldCh, newCh, insertedVnodeQueue, removeOnly) {
    /**
     * 笔记：
     *  oldStartIdx 和 oldEndIdx 是旧子节点集合的左右指针
     *  oldStartVnode 和 oldEndVnode 是旧子节点的左右节点
     */
    let oldStartIdx = 0
    let oldEndIdx = oldCh.length - 1
    let oldStartVnode = oldCh[0]
    let oldEndVnode = oldCh[oldEndIdx]

    /**
     * 笔记：
     *  newStartIdx 和 newStartVnode 是旧子节点的左右指针
     *  newStartVnode 和 newEndVnode 是旧子节点的左右节点
     */
    let newStartIdx = 0
    let newEndIdx = newCh.length - 1
    let newStartVnode = newCh[0]
    let newEndVnode = newCh[newEndIdx]

    let oldKeyToIdx, idxInOld, vnodeToMove, refElm

    // removeOnly is a special flag used only by <transition-group>
    // to ensure removed elements stay in correct relative positions
    // during leaving transitions
    /**
     * 翻译：
     *  removeOnly 是一个特殊表示，仅用于 <transition-group>
     *  确保被移除的元素在离开过渡时，留在正确的相对位置
     */
    const canMove = !removeOnly

    /**
     * 笔记：
     *  两对左右指针会不断相向自增，当新旧左右指针其中一个相遇，则结束循环
     *  每次循环都处理了新节点一端是从何而来，所以左右指针的两边是已完成新旧同步的真实情况
     *
     *  这段循环操作实际上要做的是判断位置是否发生变化：
     *    1. 判断节点是否还在原来的位置上
     *    2. 判断节点是否被移动
     *    3. 判断节点是否是以前不存在，新增加的
     *
     *  明显地，上述处理没有处理删除，删除意味着：老节点中存在，新节点中没有
     *  这就导致了，旧节点中的某个节点找不到对应的新节点，指针一直不动
     *  新节点指针会更早结束
     *
     *  q: 特殊之处在于，操作是两端同时进行，为什么？
     */
    while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
      if (isUndef(oldStartVnode)) {
        // 笔记：旧节点中找不到左节点，因为新节点
        oldStartVnode = oldCh[++oldStartIdx] // Vnode has been moved left
      } else if (isUndef(oldEndVnode)) {
        // 笔记：旧节点中找不到右节点，为什么？
        oldEndVnode = oldCh[--oldEndIdx]
      } else if (sameVnode(oldStartVnode, newStartVnode)) {
        /**
         * 笔记：
         *  旧左节点 * 新左结点 = 是同一个节点，说明节点位置没变化，递归更新真实节点，新旧左指针右移
         * 意味着：
         *  观察新旧节点的左边，如果是一样的，那节点还在原来的位置上，所以直接更新旧 DOM，往右观察下一个新节点
         */
        patchVnode(oldStartVnode, newStartVnode, insertedVnodeQueue)
        oldStartVnode = oldCh[++oldStartIdx]
        newStartVnode = newCh[++newStartIdx]
      } else if (sameVnode(oldEndVnode, newEndVnode)) {
        /**
         * 笔记：
         *  旧右节点 * 新右节点 = 是同一个节点，说明节点位置没变化，递归更新真实节点，新旧左指针左移
         * 意味着：
         *  观察新旧节点的右边，如果是一样的，那节点还在原来的位置上，所以直接更新旧 DOM，往左观察下一个新节点
         */
        patchVnode(oldEndVnode, newEndVnode, insertedVnodeQueue)
        oldEndVnode = oldCh[--oldEndIdx]
        newEndVnode = newCh[--newEndIdx]
      } else if (sameVnode(oldStartVnode, newEndVnode)) { // Vnode moved right
        /**
         * 笔记：
         *  旧左节点 * 新右节点 = 是同一个节点，说明节点位置被右移，递归更新真实节点
         *  如果可以立刻移动，将旧左节点（真实节点）移动到旧右节点的后面，
         *  旧左指针右移，新右指针左移
         *
         * 意味着：
         *  观察旧节点左边，如果和新节点的右边一样，说明更新完后，
         *  还需要把左边的那个旧 DOM 移动到右边，往左观察下一个新节点
         */
        patchVnode(oldStartVnode, newEndVnode, insertedVnodeQueue)
        canMove && nodeOps.insertBefore(parentElm, oldStartVnode.elm, nodeOps.nextSibling(oldEndVnode.elm))
        oldStartVnode = oldCh[++oldStartIdx]
        newEndVnode = newCh[--newEndIdx]
      } else if (sameVnode(oldEndVnode, newStartVnode)) { // Vnode moved left
        /**
         * 笔记：
         *  旧右节点 * 新左节点 = 是同一个节点，说明节点位置被左移，递归更新真实节点
         *  如果可以立刻移动，将旧右节点（真实节点）移动到旧左节点的前面
         *  旧右指针左移，新左指针右移
         *
         * 意味着：
         *  观察旧节点右边，如果和新节点的左边一样，说明更新完后，
         *  还需要把右边的那个旧 DOM 移动到左边，往右观察下一个新节点
         */
        patchVnode(oldEndVnode, newStartVnode, insertedVnodeQueue)
        canMove && nodeOps.insertBefore(parentElm, oldEndVnode.elm, oldStartVnode.elm)
        oldEndVnode = oldCh[--oldEndIdx]
        newStartVnode = newCh[++newStartIdx]
      } else {
        /**
         * 笔记：
         *  如果没有从两端找到新节点是如何来的，那么给中间的旧节点编号，
         *  在旧节点中，
         *  如果找到和新节点左边一样的节点位置（即原来的位置），更新它们的真实节点
         *  然后将真实节点移动到左边，并且将旧节点中的引用清除，因为已经找到了变化，无需等待比较；
         *  否则，说明这个节点是新增的，创建并插入到左边
         *
         *  在这种情况下，只是找到了新节点左边是怎么来的，其他三个和它没有任何联系，也没有处理，
         *  所以只需要新左指针往右移动，其他三个还需要在下次配对
         */
        if (isUndef(oldKeyToIdx)) oldKeyToIdx = createKeyToOldIdx(oldCh, oldStartIdx, oldEndIdx)

        // 笔记：找到 新左节点 是否在旧节点中
        idxInOld = isDef(newStartVnode.key)
          ? oldKeyToIdx[newStartVnode.key]
          : findIdxInOld(newStartVnode, oldCh, oldStartIdx, oldEndIdx)

        if (isUndef(idxInOld)) { // New element
          // 笔记：如果不存在，说明该节点是新增节点，插入到旧左节点前面
          createElm(newStartVnode, insertedVnodeQueue, parentElm, oldStartVnode.elm)
        } else {
          // 笔记：如果存在，说明该节点只是被移动，对比是否同一个节点
          vnodeToMove = oldCh[idxInOld]
          /* istanbul ignore if */
          if (process.env.NODE_ENV !== 'production' && !vnodeToMove) {
            warn(
              'It seems there are duplicate keys that is causing an update error. ' +
              'Make sure each v-for item has a unique key.'
            )
          }
          if (sameVnode(vnodeToMove, newStartVnode)) {
            // 笔记：
            //  如果是同一个节点，递归更新真实节点，并且将旧节点（真实节点）插入到旧左节点前面
            //  清除旧节点中该节点的引用
            //  如果通过 findIdxInOld 出来的，必定进入这里
            patchVnode(vnodeToMove, newStartVnode, insertedVnodeQueue)
            oldCh[idxInOld] = undefined
            canMove && nodeOps.insertBefore(parentElm, vnodeToMove.elm, oldStartVnode.elm)
          } else {
            // same key but different element. treat as new element
            // 翻译：key 相同但是节点不一样，重新创建节点（无视了子节点），插入到旧左节点前面
            createElm(newStartVnode, insertedVnodeQueue, parentElm, oldStartVnode.elm)
          }
        }
        // 笔记：因为只找到新左节点来历（新增或者是移动来的），所以新左指针右移
        newStartVnode = newCh[++newStartIdx]
      }
    }

    if (oldStartIdx > oldEndIdx) {
      // 笔记：
      //  如果出现了旧指针先结束了，那么新节点中没有遍历到的肯定都是新增节点（考虑一下原来一个节点都没有的情况）
      //  判断剩下的新节点右边的是否有节点（其实就是循环里最后一个更新的右节点），设置为相对参数
      refElm = isUndef(newCh[newEndIdx + 1]) ? null : newCh[newEndIdx + 1].elm
      addVnodes(parentElm, refElm, newCh, newStartIdx, newEndIdx, insertedVnodeQueue)
    } else if (newStartIdx > newEndIdx) {
      // 笔记：如果旧左右指针被停住，该区间的节点都应该被删除（中间某些节点在循环可能会被置为 undefined）
      removeVnodes(parentElm, oldCh, oldStartIdx, oldEndIdx)
    }
  }

  // 笔记：逐个节点判断，找到新 vnode 原来的位置，即在旧 vnode 中位置
  function findIdxInOld (node, oldCh, start, end) {
    for (let i = start; i < end; i++) {
      const c = oldCh[i]
      if (isDef(c) && sameVnode(node, c)) return i
    }
  }

  /**
   * 笔记：
   *  核心方法，根据节点的类型，调用 modules 加载的钩子修补节点
   */
  function patchVnode (oldVnode, vnode, insertedVnodeQueue, removeOnly) {
    // 笔记：如果引用一致，不需要修补
    if (oldVnode === vnode) {
      return
    }

    // 笔记：新 vnode 取得上一次的真实节点，准备修补
    const elm = vnode.elm = oldVnode.elm

    // 笔记：判断异步组件占位节点的情况
    if (isTrue(oldVnode.isAsyncPlaceholder)) {
      if (isDef(vnode.asyncFactory.resolved)) {
        // 笔记：如果异步 resolve 了，进行混合
        hydrate(oldVnode.elm, vnode, insertedVnodeQueue)
      } else {
        // 笔记：否者新节点仍然作为异步组件占位节点
        vnode.isAsyncPlaceholder = true
      }
      return
    }

    // reuse element for static trees.
    // note we only do this if the vnode is cloned -
    // if the new node is not cloned it means the render functions have been
    // reset by the hot-reload-api and we need to do a proper re-render.
    /**
     * 翻译：
     *  静态树的重用元素
     *  注意我们仅需要在 vnode 是克隆的情况下
     *  如果新 vnode 不是克隆出来的，意味着 render 函数被热更新重置，我们需要做适当的重渲染
     *
     * 笔记：
     *  如果新旧 vnode 均存在 isStatic 标记，key 也是一致的，新节点是克隆节点或者 v-once 节点
     *  可直接使用旧 DOM 和 旧实例
     */
    if (isTrue(vnode.isStatic) &&
      isTrue(oldVnode.isStatic) &&
      vnode.key === oldVnode.key &&
      (isTrue(vnode.isCloned) || isTrue(vnode.isOnce))
    ) {
      vnode.componentInstance = oldVnode.componentInstance
      return
    }

    let i
    const data = vnode.data
    // 笔记：调用 vnode 的 prepatch 钩子，目前主要为了触发子组件的更新
    if (isDef(data) && isDef(i = data.hook) && isDef(i = i.prepatch)) {
      i(oldVnode, vnode)
    }

    // 笔记：记录新旧的子节点，调用 patch 和 vnode 的 update 钩子（更新各种属性、监听器等）
    const oldCh = oldVnode.children
    const ch = vnode.children
    if (isDef(data) && isPatchable(vnode)) {
      for (i = 0; i < cbs.update.length; ++i) cbs.update[i](oldVnode, vnode)
      if (isDef(i = data.hook) && isDef(i = i.update)) i(oldVnode, vnode)
    }

    if (isUndef(vnode.text)) {
      // 笔记：非文本文本节点
      if (isDef(oldCh) && isDef(ch)) {
        // 笔记：新旧子节点存在，更新子节点
        if (oldCh !== ch) updateChildren(elm, oldCh, ch, insertedVnodeQueue, removeOnly)
      } else if (isDef(ch)) {
        // 笔记：只存在新子节点，说明是新增的，如果老节点是文本节点，清空文本
        if (isDef(oldVnode.text)) nodeOps.setTextContent(elm, '')
        // 笔记：并在当前节点下创建所有子节点
        addVnodes(elm, null, ch, 0, ch.length - 1, insertedVnodeQueue)
      } else if (isDef(oldCh)) {
        // 笔记：如果只存在老节点，删除所有老节点
        removeVnodes(elm, oldCh, 0, oldCh.length - 1)
      } else if (isDef(oldVnode.text)) {
        // 笔记：都不存在，而老节点是文本节点，只要清空文本
        nodeOps.setTextContent(elm, '')
      }
    } else if (oldVnode.text !== vnode.text) {
      // 笔记：文本节点但文本不一致，直接更新文本即可
      nodeOps.setTextContent(elm, vnode.text)
    }

    // 笔记：调用 vnode 的 postpatch 钩子（主要是组件更新后通知）
    if (isDef(data)) {
      if (isDef(i = data.hook) && isDef(i = i.postpatch)) i(oldVnode, vnode)
    }
  }

  /**
   * 笔记：
   *  调用 insert 钩子
   *  如果是组件根节点的钩子，在初始化时，先放入队列，
   *  insert 和 updated 钩子一样，需要从子组件一层层往上触发
   */
  function invokeInsertHook (vnode, queue, initial) {
    // delay insert hooks for component root nodes, invoke them after the
    // element is really inserted
    // 翻译：延迟组件根节点的插入钩子，在节点真正插入到 DOM 时再去调用
    // 笔记：
    //  因为父组件而挂载的子组件，需要等待父组件挂载再调用 insert 钩子
    //  每个 patch 方法都有自己局部的 insertedVnodeQueue
    //  所以先记录存在 insert 钩子 的 vnode 到组件占位节点的 data.pendingInsert
    if (isTrue(initial) && isDef(vnode.parent)) {
      vnode.parent.data.pendingInsert = queue
    } else {
      for (let i = 0; i < queue.length; ++i) {
        queue[i].data.hook.insert(queue[i])
      }
    }
  }

  let bailed = false
  // list of modules that can skip create hook during hydration because they
  // are already rendered on the client or has no need for initialization
  // 翻译：列举的模块在混合过程中，可以跳过 create 钩子，因为他们已经在客户端被渲染好，或者不需要被初始化
  const isRenderedModule = makeMap('attrs,style,class,staticClass,staticStyle,key')

  // Note: this is a browser-only function so we can assume elms are DOM nodes.
  // 翻译：注意：这是仅浏览器可用的函数，我们需要假设元素都是 DOM 节点
  function hydrate (elm, vnode, insertedVnodeQueue) {
    // 笔记：如果是注释节点，并且存在异步工厂，设置当前节点为异步站为节点
    if (isTrue(vnode.isComment) && isDef(vnode.asyncFactory)) {
      vnode.elm = elm
      vnode.isAsyncPlaceholder = true
      return true
    }
    if (process.env.NODE_ENV !== 'production') {
      if (!assertNodeMatch(elm, vnode)) {
        return false
      }
    }
    vnode.elm = elm
    const { tag, data, children } = vnode
    if (isDef(data)) {
      // 笔记：调用 init 钩子，如果是组件，就是初始化实例
      if (isDef(i = data.hook) && isDef(i = i.init)) i(vnode, true /* hydrating */)
      if (isDef(i = vnode.componentInstance)) {
        // child component. it should have hydrated its own tree.
        // 如果是组件，需要重新初始化一下组件
        initComponent(vnode, insertedVnodeQueue)
        return true
      }
    }
    if (isDef(tag)) {
      if (isDef(children)) {
        // empty element, allow client to pick up and populate children
        if (!elm.hasChildNodes()) {
          createChildren(vnode, children, insertedVnodeQueue)
        } else {
          // v-html and domProps: innerHTML
          if (isDef(i = data) && isDef(i = i.domProps) && isDef(i = i.innerHTML)) {
            if (i !== elm.innerHTML) {
              /* istanbul ignore if */
              if (process.env.NODE_ENV !== 'production' &&
                typeof console !== 'undefined' &&
                !bailed
              ) {
                bailed = true
                console.warn('Parent: ', elm)
                console.warn('server innerHTML: ', i)
                console.warn('client innerHTML: ', elm.innerHTML)
              }
              return false
            }
          } else {
            // iterate and compare children lists
            let childrenMatch = true
            let childNode = elm.firstChild
            for (let i = 0; i < children.length; i++) {
              if (!childNode || !hydrate(childNode, children[i], insertedVnodeQueue)) {
                childrenMatch = false
                break
              }
              childNode = childNode.nextSibling
            }
            // if childNode is not null, it means the actual childNodes list is
            // longer than the virtual children list.
            if (!childrenMatch || childNode) {
              /* istanbul ignore if */
              if (process.env.NODE_ENV !== 'production' &&
                typeof console !== 'undefined' &&
                !bailed
              ) {
                bailed = true
                console.warn('Parent: ', elm)
                console.warn('Mismatching childNodes vs. VNodes: ', elm.childNodes, children)
              }
              return false
            }
          }
        }
      }
      if (isDef(data)) {
        for (const key in data) {
          if (!isRenderedModule(key)) {
            invokeCreateHooks(vnode, insertedVnodeQueue)
            break
          }
        }
      }
    } else if (elm.data !== vnode.text) {
      elm.data = vnode.text
    }
    return true
  }

  /**
   * 笔记：
   *  断言
   */
  function assertNodeMatch (node, vnode) {
    if (isDef(vnode.tag)) {
      return (
        vnode.tag.indexOf('vue-component') === 0 ||
        vnode.tag.toLowerCase() === (node.tagName && node.tagName.toLowerCase())
      )
    } else {
      return node.nodeType === (vnode.isComment ? 8 : 3)
    }
  }

  /**
   * 笔记：入口方法
   */
  return function patch (oldVnode, vnode, hydrating, removeOnly, parentElm, refElm) {
    // 笔记：如果新节点不存在，老节点存在，认为是销毁，只调用钩子函数
    if (isUndef(vnode)) {
      if (isDef(oldVnode)) invokeDestroyHook(oldVnode)
      return
    }

    let isInitialPatch = false

    // 笔记：用于收集存在 insert 钩子的 vnode，在本次 patch 真正插入文档流时再触发
    const insertedVnodeQueue = []

    if (isUndef(oldVnode)) {
      // empty mount (likely as component), create new root element
      // 翻译：空挂载（比如组件），创建一个根元素
      isInitialPatch = true
      createElm(vnode, insertedVnodeQueue, parentElm, refElm)
    } else {
      const isRealElement = isDef(oldVnode.nodeType)
      if (!isRealElement && sameVnode(oldVnode, vnode)) {
        // 笔记：
        //  如果 oldVnode 不是真实节点，且是同类节点，直接进入 patch 操作
        //  因为只有同类节点有 patch 的意义，节点类型不一样，重新生成子树
        // patch existing root node
        patchVnode(oldVnode, vnode, insertedVnodeQueue, removeOnly)
      } else {
        if (isRealElement) {
          // mounting to a real element
          // check if this is server-rendered content and if we can perform
          // a successful hydration.
          // 笔记：挂载到一个真实元素，检查是否是服务端渲染内容，是否能进行成功的混合
          if (oldVnode.nodeType === 1 && oldVnode.hasAttribute(SSR_ATTR)) {
            oldVnode.removeAttribute(SSR_ATTR)
            hydrating = true
          }
          // 笔记：如果需要混合，进行混合，并调用 vnode 的 insert 钩子
          if (isTrue(hydrating)) {
            if (hydrate(oldVnode, vnode, insertedVnodeQueue)) {
              invokeInsertHook(vnode, insertedVnodeQueue, true)
              return oldVnode
            } else if (process.env.NODE_ENV !== 'production') {
              warn(
                'The client-side rendered virtual DOM tree is not matching ' +
                'server-rendered content. This is likely caused by incorrect ' +
                'HTML markup, for example nesting block-level elements inside ' +
                '<p>, or missing <tbody>. Bailing hydration and performing ' +
                'full client-side render.'
              )
            }
          }
          // either not server-rendered, or hydration failed.
          // create an empty node and replace it
          // 翻译：如果不是服务端渲染或者混合失败，创建一个同类空节点并替换
          oldVnode = emptyNodeAt(oldVnode)
        }
        // replacing existing element
        const oldElm = oldVnode.elm
        const parentElm = nodeOps.parentNode(oldElm)
        createElm(
          vnode,
          insertedVnodeQueue,
          // extremely rare edge case: do not insert if old element is in a
          // leaving transition. Only happens when combining transition +
          // keep-alive + HOCs. (#4590)
          // 翻译：
          //  非常稀少的边际情况：如果旧节点在一个 leaving 的 transition 中的话不应该插入
          //  只出现在 transition 和 keep-alive 和高阶组件一起用的情况
          oldElm._leaveCb ? null : parentElm,
          nodeOps.nextSibling(oldElm)
        )

        if (isDef(vnode.parent)) {
          // component root element replaced.
          // update parent placeholder node element, recursively
          // 翻译：组件根节点被替换，递归更新组件占位节点元素
          // 笔记:
          //  发生在组件的根节点被不同类型的节点替换掉，如 v-if
          //  需要更新父组件的 directives 和 refs，因为这两个工具都是针对真实节点的
          let ancestor = vnode.parent
          const patchable = isPatchable(vnode)
          while (ancestor) {
            // 笔记：对组件占位节点调用 destroy 钩子，主要是卸载组件 ref 和 directive
            for (let i = 0; i < cbs.destroy.length; ++i) {
              cbs.destroy[i](ancestor)
            }
            // 笔记：对组件占位节点调用 create 钩子，主要是组件 ref 和 directive
            ancestor.elm = vnode.elm
            if (patchable) {
              for (let i = 0; i < cbs.create.length; ++i) {
                cbs.create[i](emptyNode, ancestor)
              }
              // #6513
              // invoke insert hooks that may have been merged by create hooks.
              // e.g. for directives that uses the "inserted" hook.
              // 翻译：调用那些可能在 create 钩子被合并的 insert 钩子。例如：指令的 inserted 钩子
              const insert = ancestor.data.hook.insert
              if (insert.merged) {
                // start at index 1 to avoid re-invoking component mounted hook
                // 翻译：从第二个钩子开始，避免重新触发组件的 mounted 钩子
                // 笔记：
                //  q: 为什么存在误触发 mounted 钩子？
                //  a: 因为默认的钩子中带有 mounted 钩子，此处不使用 invoker 逐个调用钩子
                for (let i = 1; i < insert.fns.length; i++) {
                  insert.fns[i]()
                }
              }
            } else {
              // 笔记：更新为文本节点或注释节点的话，只卸载引用即可
              registerRef(ancestor)
            }
            ancestor = ancestor.parent
          }
        }

        if (isDef(parentElm)) {
          // 笔记：存在父元素的话，使用父元素引用移除旧真实节点
          removeVnodes(parentElm, [oldVnode], 0, 0)
        } else if (isDef(oldVnode.tag)) {
          // 笔记：不存在父元素，但 tag 存在，直接调用 destroy 钩子
          invokeDestroyHook(oldVnode)
        }
      }
    }

    // 笔记：patch 完成后，调用 insert 钩子，返回最新的真实 DOM
    invokeInsertHook(vnode, insertedVnodeQueue, isInitialPatch)
    return vnode.elm
  }
}
