/* @flow */

import * as nodeOps from 'web/runtime/node-ops'
import { createPatchFunction } from 'core/vdom/patch'
import baseModules from 'core/vdom/modules/index'
import platformModules from 'web/runtime/modules/index'

// the directive module should be applied last, after all
// built-in modules have been applied.
// 翻译：指令模块需要在所有内置块调用后调用
// 笔记：
//  baseModules 仅包含指令（directive）和引用（ref）
//  platformModules 包括所有的节点属性、原生事件等
const modules = platformModules.concat(baseModules)

// 笔记：真实 DOM 操作、和指令
export const patch: Function = createPatchFunction({ nodeOps, modules })
