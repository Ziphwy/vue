/* @flow */

import type Watcher from './watcher'
import { remove } from '../util/index'

// 笔记：依赖计数器
let uid = 0

/**
 * A dep is an observable that can have multiple
 * directives subscribing to it.
 *
 * 翻译：“依赖（dep）” 是一个有多个指令订阅的可观察对象
 *
 * 笔记：
 *  在 vue 订阅者模式中，
 *  1. 每一个被观察者对象/数组是一种依赖，代表着被观察对象/数组的增删变更
 *  2. 被观察对象的每一个可转换 getter/setter 的属性是一种依赖，代表着属性值变更
 *
 *  当数据变化，代表这种变化的依赖（dep）就会通知所有订阅者（watcher）重新计算，并重新收集依赖（dep）
 */
export default class Dep {
  static target: ?Watcher;
  id: number;

  // 笔记：订阅者列表
  subs: Array<Watcher>;

  constructor () {
    this.id = uid++
    this.subs = []
  }

  // 笔记：添加订阅者到订阅者列表
  addSub (sub: Watcher) {
    this.subs.push(sub)
  }

  // 笔记：从当前依赖的订阅者列表中移除指定的订阅者
  removeSub (sub: Watcher) {
    remove(this.subs, sub)
  }

  // 笔记：为当前计算的订阅者（watcher）添加依赖，先进入临时依赖数组
  depend () {
    if (Dep.target) {
      Dep.target.addDep(this)
    }
  }

  // 笔记：通知订阅者（watcher），即遍历订阅者（watcher）调用 update 方法
  notify () {
    // stabilize the subscriber list first
    // 翻译：防止遍历过程中订阅者列表被修改，先复制
    const subs = this.subs.slice()
    for (let i = 0, l = subs.length; i < l; i++) {
      subs[i].update()
    }
  }
}

// the current target watcher being evaluated.
// this is globally unique because there could be only one
// watcher being evaluated at any time.
/**
 * 翻译：
 *  当前目标订阅者（watcher）
 *  挂载在 Dep 对象的静态属性
 *  这个全局唯一，因为在每一时刻，只能有一个订阅者（watcher）在计算
 *
 * 笔记：
 *  watcher 计算栈
 *  在收集 watcher A 的依赖的时候，遇到需要计算 watcher B
 *  此时先需要保留 watcherA，先收集 watcherB，
 *  watcherB 收集完后，弹出 watcherA 继续收集
 *
 *  具体实现在 ./watcher.js
 */
Dep.target = null
const targetStack = []

export function pushTarget (_target: Watcher) {
  if (Dep.target) targetStack.push(Dep.target)
  Dep.target = _target
}

export function popTarget () {
  Dep.target = targetStack.pop()
}
