/* @flow */

import {
  warn,
  once,
  isDef,
  isUndef,
  isTrue,
  isObject,
  hasSymbol
} from 'core/util/index'

import { createEmptyVNode } from 'core/vdom/vnode'

/**
 * 笔记：标准化，确保是构造器
 */
function ensureCtor (comp: any, base) {
  if (
    comp.__esModule ||
    (hasSymbol && comp[Symbol.toStringTag] === 'Module')
  ) {
    comp = comp.default
  }
  return isObject(comp)
    ? base.extend(comp)
    : comp
}

/**
 * 笔记：
 *  创建一个异步组件占位节点
 *  主要属性是：asyncFactory，asyncMeta
 */
export function createAsyncPlaceholder (
  factory: Function,
  data: ?VNodeData,
  context: Component,
  children: ?Array<VNode>,
  tag: ?string
): VNode {
  const node = createEmptyVNode()
  node.asyncFactory = factory
  node.asyncMeta = { data, context, children, tag }
  return node
}

/**
 * 笔记：resolve 一个异步组件
 */
export function resolveAsyncComponent (
  factory: Function,
  baseCtor: Class<Component>,
  context: Component
): Class<Component> | void {
  // 笔记：存在组件加载失败，且存在 error 组件（异步组件高级属性），返回 error 组件
  if (isTrue(factory.error) && isDef(factory.errorComp)) {
    return factory.errorComp
  }

  // 笔记：如果组件已经 resolve，返回该异步组件
  if (isDef(factory.resolved)) {
    return factory.resolved
  }

  // 笔记：如果组件加载中，且存在 loading 组件（异步组件高级属性），返回 loading 组件
  if (isTrue(factory.loading) && isDef(factory.loadingComp)) {
    return factory.loadingComp
  }

  /**
   * 笔记：
   *  如果组件 contexts 有定义，则推入context
   *  q: 为什么 context 是数组？
   *  a: 因为某个异步组件在多个组件上下文中使用，resolve 后需要手动触发 watcher 更新
   */
  if (isDef(factory.contexts)) {
    // already pending
    factory.contexts.push(context)
  } else {
    const contexts = factory.contexts = [context]
    let sync = true

    // 笔记：强制 render
    const forceRender = () => {
      for (let i = 0, l = contexts.length; i < l; i++) {
        contexts[i].$forceUpdate()
      }
    }

    const resolve = once((res: Object | Class<Component>) => {
      // cache resolved
      factory.resolved = ensureCtor(res, baseCtor)
      // invoke callbacks only if this is not a synchronous resolve
      // (async resolves are shimmed as synchronous during SSR)
      // 翻译：仅在非同步 resolve 情况下调用回调函数（异步 resolve 在服务端渲染会处理为同步）
      // 笔记：
      //  如果工厂函数是同步调用了 resolve, 回调函数立刻触发，此时 sync = true，
      //  如果是异步，先执行完本次函数，在本次函数结束前位置 sync 会先设置为 false
      if (!sync) {
        forceRender()
      }
    })

    const reject = once(reason => {
      process.env.NODE_ENV !== 'production' && warn(
        `Failed to resolve async component: ${String(factory)}` +
        (reason ? `\nReason: ${reason}` : '')
      )
      // 笔记：在 Promise 结果是 reject 时，如果存在异步组件，设置 factory.error 为 true 后强制刷新
      //  q: 为什么不是 reject 都应该把 error 设为 true ？
      if (isDef(factory.errorComp)) {
        factory.error = true
        forceRender()
      }
    })

    // 笔记：resolve 和 reject 的 once 包裹保证了工厂函数的多种 api 形式不重复触发

    // 笔记：调用异步工厂函数（工厂函数需实现在成功时调用resolve，在失败时调用 reject ）
    const res = factory(resolve, reject)

    if (isObject(res)) {
      if (typeof res.then === 'function') {
        // 笔记：如果工厂函数返回值是 Promise，且仍没有 resolved 异步组件，添加到 Promise 链
        if (isUndef(factory.resolved)) {
          res.then(resolve, reject)
        }
      } else if (isDef(res.component) && typeof res.component.then === 'function') {
        // 笔记：返回的是高级异步组件
        //  按照约定，工厂函数是同步的，返回 res 的结构: { component, loading, error, delay, timeout}
        res.component.then(resolve, reject)

        if (isDef(res.error)) {
          // 笔记：缓存 error 组件构造器的引用
          factory.errorComp = ensureCtor(res.error, baseCtor)
        }

        if (isDef(res.loading)) {
          // 笔记：缓存 loading 组件构造器的引用
          factory.loadingComp = ensureCtor(res.loading, baseCtor)
          if (res.delay === 0) {
            // 笔记：不进行延迟展示，不需要强制 render，只要在最后返回 loading 的构造器即可
            factory.loading = true
          } else {
            // 笔记：用 setTimeout 进行延迟展示，即先展示 loading 组件
            setTimeout(() => {
              if (isUndef(factory.resolved) && isUndef(factory.error)) {
                // 笔记：等待一段时间，仍在 pending，强制 render
                factory.loading = true
                forceRender()
              }
            }, res.delay || 200)
          }
        }

        if (isDef(res.timeout)) {
          setTimeout(() => {
            // 笔记：在超时时间后，如果仍未 resolved，直接调用 reject
            //  q: 这个情况下，resolve 如果后面又被调用，突然强制刷新页面，不会很奇怪吗？
            if (isUndef(factory.resolved)) {
              reject(
                process.env.NODE_ENV !== 'production'
                  ? `timeout (${res.timeout}ms)`
                  : null
              )
            }
          }, res.timeout)
        }
      }
    }

    sync = false

    // return in case resolved synchronously
    // 翻译：如果是同步情况下返回加载完成的异步组件
    return factory.loading
      ? factory.loadingComp
      : factory.resolved
  }
}
