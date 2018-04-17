/* @flow */
/* globals MessageChannel */

import { handleError } from './error'

// can we use __proto__?
export const hasProto = '__proto__' in {}

// Browser environment sniffing
export const inBrowser = typeof window !== 'undefined'
export const UA = inBrowser && window.navigator.userAgent.toLowerCase()
export const isIE = UA && /msie|trident/.test(UA)
export const isIE9 = UA && UA.indexOf('msie 9.0') > 0
export const isEdge = UA && UA.indexOf('edge/') > 0
export const isAndroid = UA && UA.indexOf('android') > 0
export const isIOS = UA && /iphone|ipad|ipod|ios/.test(UA)
export const isChrome = UA && /chrome\/\d+/.test(UA) && !isEdge

// Firefox has a "watch" function on Object.prototype...
export const nativeWatch = ({}).watch

export let supportsPassive = false
if (inBrowser) {
  try {
    const opts = {}
    Object.defineProperty(opts, 'passive', ({
      get () {
        /* istanbul ignore next */
        supportsPassive = true
      }
    }: Object)) // https://github.com/facebook/flow/issues/285
    window.addEventListener('test-passive', null, opts)
  } catch (e) {}
}

// this needs to be lazy-evaled because vue may be required before
// vue-server-renderer can set VUE_ENV
// 翻译：这需要延迟执行，因为在 vue-server-renderer 可以设置 VUE_ENV 之前，可能需要 vue
let _isServer
export const isServerRendering = () => {
  if (_isServer === undefined) {
    /* istanbul ignore if */
    if (!inBrowser && typeof global !== 'undefined') {
      // detect presence of vue-server-renderer and avoid
      // Webpack shimming the process
      // 翻译：检查 vue-server-renderer 的存在，避免 webpack 对 process 进行 shim
      _isServer = global['process'].env.VUE_ENV === 'server'
    } else {
      _isServer = false
    }
  }
  return _isServer
}

// detect devtools
export const devtools = inBrowser && window.__VUE_DEVTOOLS_GLOBAL_HOOK__

/* istanbul ignore next */
export function isNative (Ctor: any): boolean {
  return typeof Ctor === 'function' && /native code/.test(Ctor.toString())
}

export const hasSymbol =
  typeof Symbol !== 'undefined' && isNative(Symbol) &&
  typeof Reflect !== 'undefined' && isNative(Reflect.ownKeys)

/**
 * Defer a task to execute it asynchronously.
 *
 * 翻译：
 *  延迟并异步执行一个任务
 */
export const nextTick = (function () {
  const callbacks = []
  let pending = false
  let timerFunc

  /**
   * 笔记:
   *  异步队列调度
   *  真正执行时，复制异步队列，顺序执行，同时清空异步队列，等待新任务添加
   */
  function nextTickHandler () {
    pending = false
    const copies = callbacks.slice(0)
    callbacks.length = 0
    for (let i = 0; i < copies.length; i++) {
      copies[i]()
    }
  }

  // An asynchronous deferring mechanism.
  // In pre 2.4, we used to use microtasks (Promise/MutationObserver)
  // but microtasks actually has too high a priority and fires in between
  // supposedly sequential events (e.g. #4521, #6690) or even between
  // bubbling of the same event (#6566). Technically setImmediate should be
  // the ideal choice, but it's not available everywhere; and the only polyfill
  // that consistently queues the callback after all DOM events triggered in the
  // same loop is by using MessageChannel.
  /**
   * 翻译：
   *  一个异步延迟机制
   *  在 2.4 版本以前，我们使用微任务（microtasks）(Promise/MutationObserver)
   *  但是微任务实际上有过高的优先级，并且存在所谓的连续事件，或者甚至在同一个事件冒泡中触发
   *  技术上 setImmediate 应该是最理想的选择，但是并不是在任何环境下都支持
   *  而唯一在所有 DOM 事件触发在同一个循环中，始终坚持队列回调的 polyfill 只有使用 MessageChannel
   */
  /* istanbul ignore if */
  if (typeof setImmediate !== 'undefined' && isNative(setImmediate)) {
    // 笔记：优先使用 setImmediate
    timerFunc = () => {
      setImmediate(nextTickHandler)
    }
  } else if (typeof MessageChannel !== 'undefined' && (
    isNative(MessageChannel) ||
    // PhantomJS
    MessageChannel.toString() === '[object MessageChannelConstructor]'
  )) {
    // 笔记：降级使用 MessageChannel
    const channel = new MessageChannel()
    const port = channel.port2
    channel.port1.onmessage = nextTickHandler
    timerFunc = () => {
      port.postMessage(1)
    }
  } else
  /* istanbul ignore next */
  if (typeof Promise !== 'undefined' && isNative(Promise)) {
    // use microtask in non-DOM environments, e.g. Weex
    // 翻译: 在没有 DOM 的环境里，使用微任务（Promise）
    const p = Promise.resolve()
    timerFunc = () => {
      p.then(nextTickHandler)
    }
  } else {
    // fallback to setTimeout
    // 笔记：都没有的情况下，降级使用 setTimeout
    timerFunc = () => {
      setTimeout(nextTickHandler, 0)
    }
  }

  /**
   * 笔记：
   *  暴露给外部的接口，添加任务进异步队列
   *  如果异步任务队列未执行，同时执行任务
   */
  return function queueNextTick (cb?: Function, ctx?: Object) {
    let _resolve
    // 笔记：包装需要异步执行的函数
    callbacks.push(() => {
      if (cb) {
        try {
          cb.call(ctx)
        } catch (e) {
          handleError(e, ctx, 'nextTick')
        }
      } else if (_resolve) {
        // 笔记：当 _resolve 存在是，需要使用
        _resolve(ctx)
      }
    })

    // 笔记：异步任务队列只启动一次
    if (!pending) {
      pending = true
      timerFunc()
    }
    // $flow-disable-line
    if (!cb && typeof Promise !== 'undefined') {
      return new Promise((resolve, reject) => {
        _resolve = resolve
      })
    }
  }
})()

/**
 * 笔记：
 *  Set 的 polyfill
 */
let _Set
/* istanbul ignore if */ // $flow-disable-line
if (typeof Set !== 'undefined' && isNative(Set)) {
  // use native Set when available.
  _Set = Set
} else {
  // a non-standard Set polyfill that only works with primitive keys.
  _Set = class Set implements ISet {
    set: Object;
    constructor () {
      this.set = Object.create(null)
    }
    has (key: string | number) {
      return this.set[key] === true
    }
    add (key: string | number) {
      this.set[key] = true
    }
    clear () {
      this.set = Object.create(null)
    }
  }
}

interface ISet {
  has(key: string | number): boolean;
  add(key: string | number): mixed;
  clear(): void;
}

export { _Set }
export type { ISet }
