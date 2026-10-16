/**
 * model-rheostat-plugin — Host 半边。
 *
 * 模型强度滑动变阻器是一个纯浏览器侧控件：它通过客户端的 modelDirectories
 * 服务读取当前会话的模型目录并提交新的推理强度，Host 不需要任何额外行为。
 *
 * 之所以仍然需要一个（空的）Host 插件体：profile 的 bundle 层是组合出来的，
 * 只有出现在 Loader 条目里的包才会被 dsh-client-modules 扫描 dsh.client 声明。
 * 这个空 apply 就是让本包出现在组合里，别无他用。
 */
function apply() {}

export { apply }
