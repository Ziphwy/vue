/* @flow */

import { isDef, isObject } from 'shared/util'

// 笔记：根据 vnode 生成 class
export function genClassForVnode (vnode: VNode): string {
  let data = vnode.data
  let parentNode = vnode
  let childNode = vnode

  /**
   * 笔记：
   *  如果节点是占位节点：
   *  按照虚拟 DOM 的构造，需要往下找对应子组件的根节点 合并根节点的class
   *  如：
   *    -- parent.vue
   *    <div>
   *      <test class="a"></test>
   *    </div>
   *
   *    -- test.vue
   *    <div class="b"></div>;
   *
   *  渲染结果：
   *    <div>
   *      <div class="a b"></div>
   *    </div>
   */
  while (isDef(childNode.componentInstance)) {
    childNode = childNode.componentInstance._vnode
    if (childNode.data) {
      data = mergeClassData(childNode.data, data)
    }
  }

  /**
   * 笔记：
   *  如果某组件根节点：
   *  按照虚拟 DOM 的构造，需要往上找父组件里占位节点，合并占位节点的class
   *  如：
   *    -- parent.vue
   *    <div>
   *      <test class="a"></test>
   *    </div>
   *
   *    -- test.vue
   *    <div class="b"></div>;
   *
   *  渲染结果：
   *    <div>
   *      <div class="a b"></div>
   *    </div>
   */
  while (isDef(parentNode = parentNode.parent)) {
    if (parentNode.data) {
      data = mergeClassData(data, parentNode.data)
    }
  }

  // 笔记：占位节点的 class 和 组件根节点的 class 是一致的
  return renderClass(data.staticClass, data.class)
}

// 笔记：合并 class
function mergeClassData (child: VNodeData, parent: VNodeData): {
  staticClass: string,
  class: any
} {
  return {
    staticClass: concat(child.staticClass, parent.staticClass),
    class: isDef(child.class)
      ? [child.class, parent.class]
      : parent.class
  }
}

/**
 * 笔记：
 *  下面几个函数主要为了将 class 格式化为空格连接
 */

export function renderClass (
  staticClass: ?string,
  dynamicClass: any
): string {
  if (isDef(staticClass) || isDef(dynamicClass)) {
    return concat(staticClass, stringifyClass(dynamicClass))
  }
  /* istanbul ignore next */
  return ''
}

export function concat (a: ?string, b: ?string): string {
  return a
    ? b
      ? (a + ' ' + b)
      : a
    : (b || '')
}

export function stringifyClass (value: any): string {
  if (Array.isArray(value)) {
    return stringifyArray(value)
  }
  if (isObject(value)) {
    return stringifyObject(value)
  }
  if (typeof value === 'string') {
    return value
  }
  /* istanbul ignore next */
  return ''
}

function stringifyArray (value: Array<any>): string {
  let res = ''
  let stringified
  for (let i = 0, l = value.length; i < l; i++) {
    if (isDef(stringified = stringifyClass(value[i])) && stringified !== '') {
      if (res) res += ' '
      res += stringified
    }
  }
  return res
}

function stringifyObject (value: Object): string {
  let res = ''
  for (const key in value) {
    if (value[key]) {
      if (res) res += ' '
      res += key
    }
  }
  return res
}
