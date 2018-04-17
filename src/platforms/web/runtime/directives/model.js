/**
 * Not type checking this file because flow doesn't like attaching
 * properties to Elements.
 */

import { isTextInputType } from 'web/util/element'
import { looseEqual, looseIndexOf } from 'shared/util'
import { warn, isAndroid, isIE9, isIE, isEdge } from 'core/util/index'

/* istanbul ignore if */
if (isIE9) {
  // http://www.matts411.com/post/internet-explorer-9-oninput/
  /**
   * 笔记：
   *  链接无法找到了。
   *  兼容 IE9，查阅资料发现 IE9 支持 input 事件，但 退格键/删除键/剪切/撤销等 无法触发 input
   */
  document.addEventListener('selectionchange', () => {
    const el = document.activeElement
    if (el && el.vmodel) {
      trigger(el, 'input')
    }
  })
}

export default {
  // 笔记：v-model是內建指令，在 inserted 钩子触发
  inserted (el, binding, vnode) {
    if (vnode.tag === 'select') {
      // 笔记: 处理 select 的绑定，并且缓存 option 的值到 _vOptions（用于排查同步异常？）
      setSelected(el, binding, vnode.context)
      el._vOptions = [].map.call(el.options, getValue)
    } else if (vnode.tag === 'textarea' || isTextInputType(el.type)) {
      // 笔记: textarea 和 input 的绑定
      el._vModifiers = binding.modifiers
      // 笔记：不存在 lazy 修饰符时
      if (!binding.modifiers.lazy) {
        // Safari < 10.2 & UIWebView doesn't fire compositionend when
        // switching focus before confirming composition choice
        // this also fixes the issue where some browsers e.g. iOS Chrome
        // fires "change" instead of "input" on autocomplete.
        /**
         * 翻译：
         *  Safari < 10.2 & UIWebView 在切换焦点时，不能触发 compositionend 事件
         *  这同样修复了在 iOS Chrome 在自动填充时触发 "change" 而不是 "input" 的问题
         *
         * 笔记：
         *  由于上述原因，监听 change 事件代替 compositionend 事件
         */
        el.addEventListener('change', onCompositionEnd)
        if (!isAndroid) {
          /**
           * 笔记：
           *  compositionstart 在中文输入和语音输入操作之前触发
           *  compositionend 在中文输入和语音输入操作之后触发
           *  在 iOS 中，中文输入拼音时常被截断，输出类似 `c'w` 的拼音，所以需要监听上述两个事件
           */
          el.addEventListener('compositionstart', onCompositionStart)
          el.addEventListener('compositionend', onCompositionEnd)
        }
        /* istanbul ignore if */
        if (isIE9) {
          // 笔记：IE9 兼容，因为 selectionchange 事件绑定在 document 上，标记 el 委托到 document 即可
          el.vmodel = true
        }
      }
    }
  },

  // 笔记：在 patch 结束触发，只针对 select
  componentUpdated (el, binding, vnode) {
    if (vnode.tag === 'select') {
      setSelected(el, binding, vnode.context)
      // in case the options rendered by v-for have changed,
      // it's possible that the value is out-of-sync with the rendered options.
      // detect such cases and filter out values that no longer has a matching
      // option in the DOM.
      /**
       * 翻译：
       *  如果，以防万一，v-for 渲染的 option 改变了
       *  这可能导致 option 渲染的和这些值不同步
       *  检查这些情况，并且过滤掉不再匹配 DOM 中选项的值
       */
      const prevOptions = el._vOptions
      const curOptions = el._vOptions = [].map.call(el.options, getValue)
      // 笔记：如果存在一个 新 option 值和旧 option 值不一致的时候，意味着 option 除了重排以外的变化
      if (curOptions.some((o, i) => !looseEqual(o, prevOptions[i]))) {
        // trigger change event if
        // no matching option found for at least one value
        // 翻译：如果没有 option 的值被选中的话，触发 change 事件
        // 笔记：
        //  多选时，选中的每个值都不在当前的 option 里
        //  单选时，选中值变化了且选中值不在当前的 option 里
        //  q: 测试发现，手动修改了 v-model 绑定的 data，且 v-for 重新渲染了列表，且选中的值不在新 option 中
        //     会触发 change 事件，但是为什么只有这种情况下需要？
        const needReset = el.multiple
          ? binding.value.some(v => hasNoMatchingOption(v, curOptions))
          : binding.value !== binding.oldValue && hasNoMatchingOption(binding.value, curOptions)
        if (needReset) {
          trigger(el, 'change')
        }
      }
    }
  }
}

function setSelected (el, binding, vm) {
  actuallySetSelected(el, binding, vm)
  /* istanbul ignore if */
  // 笔记：q: 为什么 ie 和 edge 需要异步再调用呢？
  if (isIE || isEdge) {
    setTimeout(() => {
      actuallySetSelected(el, binding, vm)
    }, 0)
  }
}

function actuallySetSelected (el, binding, vm) {
  const value = binding.value
  const isMultiple = el.multiple
  // 笔记：多选时，value 应该是个数组
  if (isMultiple && !Array.isArray(value)) {
    process.env.NODE_ENV !== 'production' && warn(
      `<select multiple v-model="${binding.expression}"> ` +
      `expects an Array value for its binding, but got ${
        Object.prototype.toString.call(value).slice(8, -1)
      }`,
      vm
    )
    return
  }
  let selected, option
  for (let i = 0, l = el.options.length; i < l; i++) {
    option = el.options[i]
    if (isMultiple) {
      // 笔记：
      //  多选时，如果 option 值在选中值数组中，修正 option.selected 为 true，否则为 false
      selected = looseIndexOf(value, getValue(option)) > -1
      if (option.selected !== selected) {
        option.selected = selected
      }
    } else {
      // 笔记：
      //  单选时，如果 option 值等于当前值，修正 select.selectedIndex 为当前索引
      //  一旦存在选中，则返回
      if (looseEqual(getValue(option), value)) {
        if (el.selectedIndex !== i) {
          el.selectedIndex = i
        }
        return
      }
    }
  }
  // 笔记：
  //  单选时，如果上述逻辑走完没有发现一个被选中，重置 selectedIndex = -1
  if (!isMultiple) {
    el.selectedIndex = -1
  }
}

// 笔记：不存在匹配的 option 值（select 标签专用）
function hasNoMatchingOption (value, options) {
  return options.every(o => !looseEqual(o, value))
}

// 笔记：返回缓存的 value
function getValue (option) {
  return '_value' in option
    ? option._value
    : option.value
}

function onCompositionStart (e) {
  // 笔记：防止无缘无故触发 input 事件，在元素上标记 composing
  e.target.composing = true
}

function onCompositionEnd (e) {
  // prevent triggering an input event for no reason
  // 翻译：防止无缘无故触发 input 事件，接上
  if (!e.target.composing) return
  e.target.composing = false
  trigger(e.target, 'input')
}

/**
 * 笔记：
 *  模拟事件触发
 *    0. <Element>.addEventListener(type, () => {})
 *    1. <Event> = document.createEvent() 创建一个自定义的事件对象，
 *    2. <Event>.initEvent(type) 初始化这个事件的类型属性
 *    3. <Element>.dispatchEvent(<Event>) 在某个元素上分发/触发自定义的事件
 *
 *  之前我以为自定义事件指的只是“监听自定义事件”
 *  实际上自定义事件是包含了两步：
 *    监听自定义事件
 *    触发自定义事件
 *  內建事件有内部实现，如点击，拖动，但自定义事件需要开发者自行定义和触发
 *
 *  <Element>.addEventListener 可以监听內建事件和自定义事件
 *  <Element>.dispatchEvent 可以触发內建事件和自定义事件
 *  这是一对事件系统的接口（类似 nodejs 的 on 和 emit）
 *
 *  dispatchEvent 的事件需要用 document.createEvent 去创建，initEvent 去初始化（面向对象的思想）
 */
function trigger (el, type) {
  const e = document.createEvent('HTMLEvents')
  e.initEvent(type, true, true)
  el.dispatchEvent(e)
}

/**
 * 笔记：
 *  q: 没有监听input？应该有一处监听 input 修改数据的地方吧？
 *  a: input 在编译模板的时候注入到
 *     data.on {
 *      input() { 修改数据 }
 *     }
 */
