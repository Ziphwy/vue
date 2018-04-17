/* @flow */

import { isIE9, isEdge } from 'core/util/env'

import {
  extend,
  isDef,
  isUndef
} from 'shared/util'

import {
  isXlink,
  xlinkNS,
  getXlinkProp,
  isBooleanAttr,
  isEnumeratedAttr,
  isFalsyAttrValue
} from 'web/util/index'

/**
 * 笔记：
 *  在 create 和 update 钩子更新特性，特性有三种：
 *    1. 布尔型：在设置中可直接判断，根据 value 直接设置或者直接移除
 *    2. 枚举型：在
 *  q: 谁的钩子？ vnode 还是 patch ？
 */

function updateAttrs (oldVnode: VNodeWithData, vnode: VNodeWithData) {
  const opts = vnode.componentOptions
  if (isDef(opts) && opts.Ctor.options.inheritAttrs === false) {
    // 笔记：节点存在组件配置，但标志不继承特性，直接返回
    //  q: inheritAttrs 为 false 为什么不 diff ？
    return
  }
  if (isUndef(oldVnode.data.attrs) && isUndef(vnode.data.attrs)) {
    // 笔记：老节点和新节点都不存在 attrs，直接返回
    return
  }
  let key, cur, old
  const elm = vnode.elm
  const oldAttrs = oldVnode.data.attrs || {}
  let attrs: any = vnode.data.attrs || {}
  // clone observed objects, as the user probably wants to mutate it
  // 笔记：如果 attrs 存在 __ob__，因为用户可能需要监听它，进行克隆
  if (isDef(attrs.__ob__)) {
    attrs = vnode.data.attrs = extend({}, attrs)
  }

  for (key in attrs) {
    cur = attrs[key]
    old = oldAttrs[key]
    if (old !== cur) {
      // 笔记：新旧值不一致时，更新该特性
      setAttr(elm, key, cur)
    }
  }
  // #4391: in IE9, setting type can reset value for input[type=radio]
  // #6666: IE/Edge forces progress value down to 1 before setting a max
  /* istanbul ignore if */
  // 翻译：在 IE9，对于 input[type=radio] 设置 type 会重置 value
  // 翻译：在 IE/Edge 设置 progress 为一个最大值之前，会被强制值回到 1
  // 笔记：所以针对上述情况，如果新旧的值不一样，重置为新的值
  if ((isIE9 || isEdge) && attrs.value !== oldAttrs.value) {
    setAttr(elm, 'value', attrs.value)
  }
  // 笔记：最后检查老节点上的特性，如果不存在新节点上，删除该特性
  for (key in oldAttrs) {
    if (isUndef(attrs[key])) {
      if (isXlink(key)) {
        elm.removeAttributeNS(xlinkNS, getXlinkProp(key))
      } else if (!isEnumeratedAttr(key)) {
        // 笔记：除了枚举型特性，直接移除。
        //  q: 为什么枚举型特性不能移除？
        elm.removeAttribute(key)
      }
    }
  }
}

function setAttr (el: Element, key: string, value: any) {
  if (isBooleanAttr(key)) {
    // set attribute for blank value
    // e.g. <option disabled>Select one</option>
    if (isFalsyAttrValue(value)) {
      // 笔记：枚举型如果是 falsy 值，直接移除
      el.removeAttribute(key)
    } else {
      // technically allowfullscreen is a boolean attribute for <iframe>,
      // but Flash expects a value of "true" when used on <embed> tag
      // 翻译：理论上，allowfullscreen 是 iframe 的一个布尔特性，但是在使用 embed 播放 Flash 时，需要显式的 true
      value = key === 'allowfullscreen' && el.tagName === 'EMBED'
        ? 'true'
        : key
      el.setAttribute(key, value)
    }
  } else if (isEnumeratedAttr(key)) {
    // 笔记：枚举型特性，枚举值只有 true 和 false
    el.setAttribute(key, isFalsyAttrValue(value) || value === 'false' ? 'false' : 'true')
  } else if (isXlink(key)) {
    // 笔记：处理 xlink 特性
    if (isFalsyAttrValue(value)) {
      el.removeAttributeNS(xlinkNS, getXlinkProp(key))
    } else {
      el.setAttributeNS(xlinkNS, key, value)
    }
  } else {
    // 笔记：处理一般特性
    if (isFalsyAttrValue(value)) {
      el.removeAttribute(key)
    } else {
      el.setAttribute(key, value)
    }
  }
}

export default {
  create: updateAttrs,
  update: updateAttrs
}
