/* @flow */

import { makeMap } from 'shared/util'

// these are reserved for web because they are directly compiled away
// during template compilation
// 翻译：这些都是 web 保留字，因为在模板编译时会直接编译
export const isReservedAttr = makeMap('style,class')

// attributes that should be using props for binding
// 翻译：需要使用 props 绑定的特性
const acceptValue = makeMap('input,textarea,option,select,progress')

/**
 * 笔记：
 *  1. input（type不能是button）,textarea,option,select,progress 标签的特性 value，
 *  2. option 标签的特性 selected
 *  3. input 标签的特性 checked
 *  4. video 标签的特性 muted
 *
 *  q: 应该是为了处理双向绑定的？
 *  a: 用在模板生成的 render 函数中，
 */
export const mustUseProp = (tag: string, type: ?string, attr: string): boolean => {
  return (
    (attr === 'value' && acceptValue(tag)) && type !== 'button' ||
    (attr === 'selected' && tag === 'option') ||
    (attr === 'checked' && tag === 'input') ||
    (attr === 'muted' && tag === 'video')
  )
}

// 笔记：是否枚举型特性，必须明确声明 true 和 false，与布尔型特性相对
export const isEnumeratedAttr = makeMap('contenteditable,draggable,spellcheck')

// 笔记：是否布尔型特性，此类特性不需要值，存在就是 true，不存在则是 false
export const isBooleanAttr = makeMap(
  'allowfullscreen,async,autofocus,autoplay,checked,compact,controls,declare,' +
  'default,defaultchecked,defaultmuted,defaultselected,defer,disabled,' +
  'enabled,formnovalidate,hidden,indeterminate,inert,ismap,itemscope,loop,multiple,' +
  'muted,nohref,noresize,noshade,novalidate,nowrap,open,pauseonexit,readonly,' +
  'required,reversed,scoped,seamless,selected,sortable,translate,' +
  'truespeed,typemustmatch,visible'
)

export const xlinkNS = 'http://www.w3.org/1999/xlink'

// 笔记：形如 xlink:attr
export const isXlink = (name: string): boolean => {
  return name.charAt(5) === ':' && name.slice(0, 5) === 'xlink'
}

// 笔记：形如 xlink:attr，获取 attr
export const getXlinkProp = (name: string): string => {
  return isXlink(name) ? name.slice(6, name.length) : ''
}

// 笔记：是否特性值等同 false
export const isFalsyAttrValue = (val: any): boolean => {
  return val == null || val === false
}
