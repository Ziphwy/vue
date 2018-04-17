/* @flow */

import type Watcher from './watcher'
import config from '../config'
import { callHook, activateChildComponent } from '../instance/lifecycle'

import {
  warn,
  nextTick,
  devtools
} from '../util/index'

export const MAX_UPDATE_COUNT = 100

// 笔记：watcher 队列
const queue: Array<Watcher> = []
const activatedChildren: Array<Component> = []

let has: { [key: number]: ?true } = {}
let circular: { [key: number]: number } = {}
let waiting = false
let flushing = false

// 笔记：当前正在处理的 watcher
let index = 0

/**
 * Reset the scheduler's state.
 *
 * 翻译：重置调度器状态
 */
function resetSchedulerState () {
  index = queue.length = activatedChildren.length = 0
  has = {}
  if (process.env.NODE_ENV !== 'production') {
    circular = {}
  }
  waiting = flushing = false
}

/**
 * Flush both queues and run the watchers.
 *
 * 翻译：清空队列并取出并且执行 watchers 的任务
 */
function flushSchedulerQueue () {
  flushing = true
  let watcher, id

  // Sort queue before flush.
  // This ensures that:
  // 1. Components are updated from parent to child. (because parent is always
  //    created before the child)
  // 2. A component's user watchers are run before its render watcher (because
  //    user watchers are created before the render watcher)
  // 3. If a component is destroyed during a parent component's watcher run,
  //    its watchers can be skipped.
  /**
   * 翻译：
   *  在 flush 之前对队列排序
   *  这是为了确保：
   *  1. 组件更新顺序从父级到子级（因为父级一般先于子级创建）
   *  2. 组件的用户自定义 watchers 在 render watchers 前运行（因为用户自定义 watchers 先于 render watchers 创建）
   *  3. 如果一个组件在父组件的 watcher 运行时被销毁，它的 watchers 可以被跳过
   *
   * 笔记：
   *  根据 watcher 的 id 排序，父组件的 watcher id 比较小
   */
  queue.sort((a, b) => a.id - b.id)

  // do not cache length because more watchers might be pushed
  // as we run existing watchers
  // 翻译：不要缓存 length ，因为我们运行已经存在的 watchers 时，更多 watchers 可能在被推入
  // 笔记：watcher 队列的执行并不封闭，随时接受新增的 watcher 进入队列
  for (index = 0; index < queue.length; index++) {
    watcher = queue[index]
    id = watcher.id
    has[id] = null
    watcher.run()
    // in dev build, check and stop circular updates.
    // 翻译：在开发模式下，检查并停止循环更新
    if (process.env.NODE_ENV !== 'production' && has[id] != null) {
      circular[id] = (circular[id] || 0) + 1
      if (circular[id] > MAX_UPDATE_COUNT) {
        warn(
          'You may have an infinite update loop ' + (
            watcher.user
              ? `in watcher with expression "${watcher.expression}"`
              : `in a component render function.`
          ),
          watcher.vm
        )
        break
      }
    }
  }

  // keep copies of post queues before resetting state
  // 翻译：在重置状态之前保存处理过的队列副本
  const activatedQueue = activatedChildren.slice()
  const updatedQueue = queue.slice()

  resetSchedulerState()

  // call component updated and activated hooks
  // 翻译：调用组件 activated 和 updated 钩子
  // 笔记：
  //  在 watcher 队列执行完后，再逆序调用 updated 钩子，保证父组件的 updated 事件在子组件 updated 后触发
  //  q: activated 因为是 push 进来，所以顺序是子组件到父组件？
  callActivatedHooks(activatedQueue)
  callUpdatedHooks(updatedQueue)

  // devtool hook
  /* istanbul ignore if */
  if (devtools && config.devtools) {
    devtools.emit('flush')
  }
}

/**
 * 笔记：
 *  读取队列中 watcher 所在的实例，逆序调用组件的 updated 钩子
 */
function callUpdatedHooks (queue) {
  let i = queue.length
  while (i--) {
    const watcher = queue[i]
    const vm = watcher.vm
    if (vm._watcher === watcher && vm._isMounted) {
      callHook(vm, 'updated')
    }
  }
}

/**
 * Queue a kept-alive component that was activated during patch.
 * The queue will be processed after the entire tree has been patched.
 *
 * 翻译：
 *  把在 patch 时活动的 kept-alive 组件推入队列
 *  这个队列将在整颗树 patch 完成后被处理
 * 笔记：
 *  q: keep-alive 的更新操作是怎样的？
 */
export function queueActivatedComponent (vm: Component) {
  // setting _inactive to false here so that a render function can
  // rely on checking whether it's in an inactive tree (e.g. router-view)
  // 翻译：设置 _inactive 标记为 false，这样 render 函数可以依赖于检查它是否在一个不活动的 tree
  vm._inactive = false
  activatedChildren.push(vm)
}

function callActivatedHooks (queue) {
  for (let i = 0; i < queue.length; i++) {
    queue[i]._inactive = true
    activateChildComponent(queue[i], true /* true */)
  }
}

/**
 * Push a watcher into the watcher queue.
 * Jobs with duplicate IDs will be skipped unless it's
 * pushed when the queue is being flushed.
 *
 * 翻译：
 *  往队列推入一个 watcher
 *  除非在队列 flush 时推入，重复 ID 的任务会被跳过，
 */
export function queueWatcher (watcher: Watcher) {
  const id = watcher.id
  if (has[id] == null) {
    has[id] = true
    if (!flushing) {
      // 笔记：
      queue.push(watcher)
    } else {
      // if already flushing, splice the watcher based on its id
      // if already past its id, it will be run next immediately.
      /**
       * 翻译：
       *  如果已经在 flush 处理中，根据 这个 watcher 的 id，插入到相应的位置
       *  如果已经过了，将会在插到下一个号立刻执行
       *
       * 笔记：
       *  因为 watcher 是按 id 由小到大地排队执行的，所以检查新增 watcher 的 id 是否有过号
       *
       *  虽然 watcher 是进入调度队列异步更新的，但更新的过程中，有可能触发新的依赖变更
       *  这时候需要推入新的 watcher，新的 watcher 应该在本轮任务中进行更新
       */
      let i = queue.length - 1
      while (i > index && queue[i].id > watcher.id) {
        i--
      }
      queue.splice(i + 1, 0, watcher)
    }
    // queue the flush
    // 笔记：如果不在等待中，异步执行 flush 任务
    if (!waiting) {
      waiting = true
      nextTick(flushSchedulerQueue)
    }
  }
}
