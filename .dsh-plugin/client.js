window.__ModuleLoader__.load({
	id: "model-rheostat-plugin",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		"use strict";

		/**
		 * model-rheostat-plugin — 浏览器半边。
		 *
		 * 在 composer 工具行右下角（`conversation.input.right`，紧挨模型选择器的左侧）
		 * 放一个「滑动变阻器」控件，把当前会话的推理强度（reasoning effort）做成可拖的
		 * 档位滑杆。
		 *
		 * 数据全部走官方那一份会话级模型目录，不做任何自己的状态副本：
		 *   - ctx.modelDirectories.directoryFor(sessionId) → 会话目录（懒解析、随会话释放）
		 *   - 目录 store 快照 → { current, pending, status, groups, ... }
		 *   - 目录 select({ provider, model, reasoningEffort }) → 提交选择
		 * 因为和 composer 的模型菜单共用同一个 ModelDirectory 实例，任一边的改动另一边
		 * 立刻可见（官方 /model 弹窗同理）。
		 *
		 * 强度档位完全来自适配器公布的元数据（groups[].models[].reasoning.efforts），
		 * 不编造档位；模型没有推理元数据或只有一个档位时整个控件不渲染，
		 * 与官方「适配器没有推理元数据时不显示 Effort 行」的约定一致。
		 */

		var React = require("react");

		/* ------------------------------------------------------------------ *
		 * 官方品牌标（DeepSeek 鲸鱼）
		 *
		 * 路径数据取自 DSH 自带的官方品牌包 @deepseek-ai/dsh-client-ui-primitives
		 * 导出的 FISH_LOGO_PATH / FISH_LOGO_VIEWBOX —— 这正是官方
		 * dsh-client-ui-brand-official 渲染侧栏品牌标所用的同一份几何。
		 *
		 * 内联而不用 require("@deepseek-ai/dsh-client-ui-primitives")：那会给本插件
		 * 增加一条 dsh.client.external 依赖边。下面两行由
		 * .dsh-tools/extract-fish-logo.mjs 从 app.asar 原样注入，请勿手改。
		 * ------------------------------------------------------------------ */

		/** Slider-thumb logo width in px; height follows the official viewBox ratio. */
		var FISH_LOGO_SIZE = 12;
		var FISH_LOGO_VIEWBOX = { width: 23.16, height: 17.04 };
		var FISH_LOGO_PATH = "M22.9168 1.43018C22.6713 1.31018 22.5658 1.53918 22.4223 1.65519C22.3733 1.69269 22.3318 1.74169 22.2903 1.78669C21.9317 2.1697 21.5127 2.42121 20.9657 2.39121C20.1657 2.34621 19.4827 2.59771 18.8787 3.20973C18.7502 2.45521 18.3236 2.0047 17.6746 1.71569C17.3351 1.56568 16.9916 1.41518 16.7536 1.08867C16.5876 0.856163 16.5421 0.597155 16.4591 0.341647C16.4061 0.187643 16.3536 0.0301382 16.1761 0.00363739C15.9836 -0.0263635 15.9081 0.135141 15.8326 0.270145C15.5306 0.822162 15.4136 1.43018 15.4251 2.0462C15.4516 3.43174 16.0366 4.53527 17.1991 5.3203C17.3311 5.4103 17.3651 5.5003 17.3236 5.63181C17.2441 5.90231 17.1501 6.16482 17.0671 6.43533C17.0141 6.60784 16.9351 6.64584 16.7501 6.57033C16.1121 6.30383 15.5611 5.90931 15.074 5.4328C14.2475 4.63328 13.5 3.75075 12.568 3.05973C12.349 2.89822 12.13 2.74822 11.9034 2.60522C10.9524 1.68169 12.028 0.923165 12.277 0.833162C12.5375 0.739159 12.3675 0.41615 11.5259 0.42015C10.6844 0.42365 9.91439 0.705658 8.93286 1.08117C8.78935 1.13767 8.63835 1.17867 8.48384 1.21267C7.59332 1.04367 6.66829 1.00617 5.70226 1.11517C3.88321 1.31768 2.43016 2.1777 1.36213 3.64575C0.0790928 5.4103 -0.222916 7.41536 0.146595 9.50642C0.535106 11.7105 1.66014 13.535 3.38869 14.9616C5.18125 16.4406 7.24581 17.1657 9.60138 17.0266C11.0319 16.9441 12.6245 16.7526 14.421 15.2321C14.874 15.4576 15.3496 15.5476 16.1381 15.6151C16.7456 15.6716 17.3306 15.5851 17.7836 15.4911C18.4931 15.3411 18.4441 14.6841 18.1876 14.5636C16.1081 13.595 16.5646 13.9891 16.1496 13.67C17.2061 12.42 18.8202 10.1979 19.3182 7.17235C19.3672 6.83834 19.4297 6.36783 19.4222 6.09732C19.4182 5.93231 19.4562 5.86831 19.6447 5.84931C20.1657 5.78931 20.6712 5.64681 21.1357 5.3913C22.4833 4.65528 23.0268 3.44624 23.1548 1.9972C23.1738 1.77569 23.1508 1.54668 22.9168 1.43018ZM11.1749 14.4736C9.15936 12.889 8.18184 12.3675 7.77832 12.39C7.40081 12.4125 7.46881 12.8445 7.55182 13.126C7.63882 13.404 7.75182 13.5955 7.91033 13.8396C8.01983 14.0011 8.09533 14.2411 7.80083 14.4216C7.15181 14.8231 6.02327 14.2866 5.97027 14.2601C4.65673 13.4865 3.5587 12.4655 2.78467 11.069C2.03715 9.72493 1.60314 8.28289 1.53164 6.74384C1.51264 6.37233 1.62214 6.24082 1.99215 6.17332C2.47916 6.08332 2.98118 6.06432 3.46769 6.13582C5.52476 6.43633 7.27581 7.35586 8.74385 8.8129C9.58188 9.64243 10.2159 10.634 10.8689 11.6025C11.5634 12.631 12.3105 13.611 13.262 14.4146C13.598 14.6961 13.866 14.9101 14.1225 15.0681C13.349 15.1546 12.058 15.1731 11.1749 14.4746L11.1749 14.4736ZM12.141 8.25988C12.141 8.09488 12.273 7.96338 12.439 7.96338C12.4765 7.96338 12.5105 7.97088 12.541 7.98188C12.5825 7.99688 12.6205 8.01938 12.6505 8.05338C12.7035 8.10588 12.7335 8.18088 12.7335 8.25988C12.7335 8.42489 12.6015 8.55639 12.4355 8.55639C12.2695 8.55639 12.141 8.42489 12.141 8.25988ZM15.1415 9.79893C14.949 9.87793 14.7565 9.94544 14.5715 9.95294C14.2845 9.96794 13.9715 9.85143 13.8015 9.70893C13.5375 9.48742 13.3485 9.36342 13.2695 8.97691C13.2355 8.8119 13.2545 8.55639 13.2845 8.40989C13.3525 8.09438 13.277 7.89187 13.0545 7.70787C12.8735 7.55786 12.643 7.51636 12.39 7.51636C12.2955 7.51636 12.209 7.47486 12.1445 7.44136C12.039 7.38886 11.9519 7.25735 12.035 7.09585C12.0615 7.04335 12.19 6.91584 12.22 6.89334C12.5635 6.69784 12.9595 6.76184 13.326 6.90834C13.6655 7.04735 13.9225 7.30236 14.292 7.66287C14.6695 8.09838 14.7375 8.21838 14.9525 8.54539C15.1225 8.8009 15.277 9.06341 15.3831 9.36392C15.4471 9.55142 15.3641 9.70493 15.1415 9.79893Z";

		/* ------------------------------------------------------------------ *
		 * 样式
		 * ------------------------------------------------------------------ */

		var STYLE_MARKER = "style[data-model-rheostat-style]";
		var STYLE_PLUGIN = "model-rheostat-plugin";
		var THUMB_INSET = 14; // 滑杆两端留白 = 滑钮直径，保证刻度与滑钮中心重合

		var CSS = `
[data-mrh] { display:flex; align-items:center; gap:6px; height:28px; min-width:0; }
[data-mrh-label] { display:var(--dsh-composer-model-text-display,inline); font-size:11px; line-height:16px; color:var(--dsw-alias-label-tertiary,#999); white-space:nowrap; flex:none; }
[data-mrh-dial] { position:relative; flex:none; width:76px; height:20px; }
[data-mrh-rail] { position:absolute; left:7px; right:7px; top:50%; height:8px; margin-top:-4px; border-radius:4px;
  background-color:var(--dsw-alias-border-l1,#d3d8e0);
  background-image:repeating-linear-gradient(90deg, rgba(127,127,127,.20) 0 1px, rgba(0,0,0,0) 1px 6px);
  box-shadow:inset 0 1px 2px rgba(0,0,0,.20); pointer-events:none; }
[data-mrh-fill] { position:absolute; left:7px; top:50%; height:8px; margin-top:-4px; border-radius:4px; pointer-events:none;
  background-image:linear-gradient(90deg, var(--dsw-alias-state-business-primary,#2b57c4), var(--dsw-alias-brand-primary,#416fe6));
  box-shadow:0 0 7px -1px var(--dsw-alias-brand-primary,#416fe6);
  transition:width .12s ease; }
[data-mrh-ticks] { position:absolute; left:7px; right:7px; top:0; bottom:0; pointer-events:none; }
[data-mrh-tick] { position:absolute; top:50%; width:3px; height:3px; margin-top:-1.5px; border-radius:50%;
  background:var(--dsw-alias-label-tertiary,#9aa2ad); opacity:.65; transform:translateX(-50%); }
[data-mrh-tick][data-mrh-tick-on] { background:var(--dsw-alias-label-primary,#111); opacity:1; }
[data-mrh-range] { -webkit-appearance:none; appearance:none; position:absolute; inset:0; width:100%; height:100%;
  margin:0; padding:0; background:transparent; cursor:pointer; outline:none; }
[data-mrh-range]:disabled { cursor:default; opacity:.45; }
[data-mrh-range]::-webkit-slider-runnable-track { height:8px; background:transparent; border:none; }
/* 原生滑钮只留 14px 的命中区：14px 决定滑钮中心的两端行程各内缩 7px，与轨道内缩一致。
   视觉滑钮改由 [data-mrh-thumb] 画在同一个中心点上，这样才能把官方鲸鱼标放进滑钮。 */
[data-mrh-range]::-webkit-slider-thumb { -webkit-appearance:none; appearance:none; width:14px; height:14px; margin-top:-3px;
  background:transparent; border:0; box-shadow:none; }
[data-mrh-thumb] { position:absolute; top:50%; width:16px; height:16px; margin-top:-8px; box-sizing:border-box;
  display:grid; place-items:center; pointer-events:none; border-radius:50%;
  background:var(--dsw-alias-bg-layer-1,#fff); border:1px solid var(--dsw-alias-brand-primary,#416fe6);
  color:var(--dsw-alias-brand-primary,#416fe6); box-shadow:0 1px 3px rgba(0,0,0,.30);
  transition:transform .12s ease, box-shadow .12s ease; }
[data-mrh-thumb] svg { display:block; }
[data-mrh-range]:hover ~ [data-mrh-thumb] { transform:scale(1.10); }
[data-mrh-range]:active ~ [data-mrh-thumb] { transform:scale(1.18); }
[data-mrh-range]:focus-visible ~ [data-mrh-thumb] { box-shadow:0 1px 3px rgba(0,0,0,.30), 0 0 0 3px var(--dsw-focus-ring-color, rgba(65,111,230,.40)); }
[data-mrh-range]:disabled ~ [data-mrh-thumb] { opacity:.45; }
[data-mrh-dial][data-mrh-busy] [data-mrh-thumb] { animation:mrh-pulse 1s ease-in-out infinite; }
@keyframes mrh-pulse { 0%,100% { box-shadow:0 1px 3px rgba(0,0,0,.35), 0 0 0 0 var(--dsw-focus-ring-color, rgba(65,111,230,.45)); }
  50% { box-shadow:0 1px 3px rgba(0,0,0,.35), 0 0 0 4px rgba(65,111,230,0); } }
[data-mrh-value] { font-size:11px; line-height:16px; min-width:24px; color:var(--dsw-alias-label-caption, var(--dsw-alias-label-tertiary,#999)); white-space:nowrap; flex:none; }
[data-mrh-error] { flex:none; width:6px; height:6px; border-radius:50%; background:var(--dsw-alias-state-error-primary,#d94c4c); }
`;

		function ensureStyle() {
			if (typeof document === "undefined") return null;
			if (document.querySelector(STYLE_MARKER) !== null) return null;
			var element = document.createElement("style");
			element.setAttribute("data-model-rheostat-style", "");
			element.setAttribute("data-plugin", STYLE_PLUGIN);
			element.textContent = CSS;
			document.head.append(element);
			return element;
		}

		/* ------------------------------------------------------------------ *
		 * 目录读取
		 * ------------------------------------------------------------------ */

		/** 每个会话目录只需拉一次目录（inject 会在每次渲染时被调用）。 */
		var loadedDirectories = new WeakSet();

		function ensureLoaded(directory) {
			if (directory === null || directory === undefined) return;
			if (loadedDirectories.has(directory)) return;
			loadedDirectories.add(directory);
			try {
				var pending = directory.load();
				if (pending && typeof pending.catch === "function") pending.catch(function () {});
			} catch (error) {
				/* 目录加载失败由 store 自己发布状态，这里不阻断渲染 */
			}
		}

		/**
		 * 在当前目录快照里找到某个 provider/model 的推理元数据。
		 * @returns reasoning 对象 `{ defaultEffort, efforts: [{ id, name, description }] }`，找不到为 null。
		 */
		function reasoningFor(state, selection) {
			if (!state || !selection || !Array.isArray(state.groups)) return null;
			for (var g = 0; g < state.groups.length; g++) {
				var group = state.groups[g];
				if (!group || group.id !== selection.provider) continue;
				var models = Array.isArray(group.models) ? group.models : [];
				for (var m = 0; m < models.length; m++) {
					var model = models[m];
					if (!model || model.id !== selection.model) continue;
					var reasoning = model.reasoning;
					if (!reasoning || !Array.isArray(reasoning.efforts) || reasoning.efforts.length === 0) return null;
					return reasoning;
				}
			}
			return null;
		}

		function indexOfEffort(efforts, id) {
			if (id === undefined || id === null) return -1;
			for (var i = 0; i < efforts.length; i++) {
				if (efforts[i] && efforts[i].id === id) return i;
			}
			return -1;
		}

		/* ------------------------------------------------------------------ *
		 * 组件
		 * ------------------------------------------------------------------ */

		function RheostatControl(props) {
			var store = props.store;

			var subscribe = React.useCallback(function (notify) {
				if (!store) return function () {};
				return store.subscribe(notify);
			}, [store]);

			var readSnapshot = React.useCallback(function () {
				return store ? store.getSnapshot() : null;
			}, [store]);

			var state = React.useSyncExternalStore(subscribe, readSnapshot);

			var errorPair = React.useState(null);
			var error = errorPair[0];
			var setError = errorPair[1];
			var queueRef = React.useRef(null);
			var runningRef = React.useRef(false);

			var select = props.select;
			var available = props.available;

			/**
			 * 提交一个强度档位。拖动过程中可能连发多次 onChange，这里做「最新值优先」的
			 * 串行队列：正在飞行的 RPC 完成后只认最后一个待发目标，不会把中间档位全打出去。
			 */
			var commit = React.useCallback(function (effortId, selection) {
				if (!selection) return;
				queueRef.current = { effortId: effortId, provider: selection.provider, model: selection.model };
				if (runningRef.current) return;
				runningRef.current = true;
				setError(null);
				var drain = function () {
					var next = queueRef.current;
					queueRef.current = null;
					if (next === null) {
						runningRef.current = false;
						return;
					}
					var pending;
					try {
						pending = select({ provider: next.provider, model: next.model, reasoningEffort: next.effortId });
					} catch (thrown) {
						pending = Promise.reject(thrown);
					}
					Promise.resolve(pending).then(function (result) {
						if (result && result.ok === false) {
							var failure = result.error || {};
							setError(failure.message ? (failure.code ? failure.code + ": " + failure.message : failure.message) : "切换模型强度失败");
							queueRef.current = null;
							runningRef.current = false;
							return;
						}
						drain();
					}, function (thrown) {
						setError(String((thrown && thrown.message) || thrown));
						queueRef.current = null;
						runningRef.current = false;
					});
				};
				drain();
			}, [select]);

			var current = state ? state.current : null;
			var pending = state ? state.pending : null;
			var status = state ? state.status : "loading";
			var reasoning = reasoningFor(state, current);

			// 不可用 / 还没解析出模型 / 适配器没公布推理元数据 / 只有一个档位 —— 不渲染。
			if (available !== true || current === null || reasoning === null || reasoning.efforts.length < 2) return null;

			var efforts = reasoning.efforts;
			var activeId = current.reasoningEffort;
			if (pending && pending.provider === current.provider && pending.model === current.model && pending.reasoningEffort !== undefined) {
				activeId = pending.reasoningEffort;
			}
			var index = indexOfEffort(efforts, activeId);
			if (index < 0) index = indexOfEffort(efforts, reasoning.defaultEffort);
			if (index < 0) index = 0;

			var level = efforts[index];
			var ratio = index / (efforts.length - 1);

			var ticks = [];
			for (var t = 0; t < efforts.length; t++) {
				ticks.push(React.createElement("span", {
					key: "tick-" + efforts[t].id,
					"data-mrh-tick": "",
					"data-mrh-tick-on": t <= index ? "" : undefined,
					style: { left: (t / (efforts.length - 1)) * 100 + "%" }
				}));
			}

			var children = [
				React.createElement("span", { key: "label", "data-mrh-label": "" }, "强度"),
				React.createElement("div", {
					key: "dial",
					"data-mrh-dial": "",
					"data-mrh-busy": status === "selecting" ? "" : undefined
				},
					React.createElement("div", { key: "rail", "data-mrh-rail": "" }),
					ratio > 0 ? React.createElement("div", {
						key: "fill",
						"data-mrh-fill": "",
						style: { width: "calc((100% - " + THUMB_INSET + "px) * " + ratio + ")" }
					}) : null,
					React.createElement("div", { key: "ticks", "data-mrh-ticks": "" }, ticks),
					React.createElement("input", {
						key: "range",
						type: "range",
						min: 0,
						max: efforts.length - 1,
						step: 1,
						value: index,
						disabled: status === "loading",
						"data-mrh-range": "",
						"aria-label": "模型强度",
						"aria-valuetext": level ? level.name : String(index),
						title: level ? (level.name + (level.description ? " — " + level.description : "")) : "",
						onChange: function (event) {
							var next = efforts[Number(event.target.value)];
							if (next) commit(next.id, current);
						}
					}),
					// 视觉滑钮：官方鲸鱼标。中心点与原生 14px 滑钮完全重合，
					// 所以左缘 = 中心 - 8px = calc((100% - 14px) * ratio - 1px)。
					React.createElement("div", {
						key: "thumb",
						"data-mrh-thumb": "",
						style: { left: "calc((100% - " + THUMB_INSET + "px) * " + ratio + " - 1px)" }
					}, React.createElement("svg", {
						viewBox: "0 0 " + FISH_LOGO_VIEWBOX.width + " " + FISH_LOGO_VIEWBOX.height,
						width: FISH_LOGO_SIZE,
						height: FISH_LOGO_SIZE * FISH_LOGO_VIEWBOX.height / FISH_LOGO_VIEWBOX.width,
						"aria-hidden": "true",
						focusable: "false"
					}, React.createElement("path", { d: FISH_LOGO_PATH, fill: "currentColor" })))
				),
				React.createElement("span", { key: "value", "data-mrh-value": "" }, level ? level.name : "")
			];

			if (error !== null) {
				children.push(React.createElement("span", {
					key: "error",
					"data-mrh-error": "",
					title: error,
					"aria-label": "模型强度切换失败：" + error
				}));
			}

			return React.createElement("div", { "data-mrh": "" }, children);
		}

		/* ------------------------------------------------------------------ *
		 * 注入到槽位
		 * ------------------------------------------------------------------ */

		var UNAVAILABLE = {
			ok: false,
			error: { code: "model-rheostat/unavailable", message: "当前会话不可调整模型强度" }
		};

		/**
		 * 槽位注入：把会话目录暴露成组件 props。
		 *
		 * 与官方 ModelSelect 同位注入同一份目录（同一个 ModelDirectory 实例），因此
		 * 变阻器与模型菜单永远显示同一组强度档位。
		 */
		function injectProps(ctx, sessionId) {
			var fallback = {
				available: false,
				store: null,
				select: function () { return Promise.resolve(UNAVAILABLE); }
			};
			if (sessionId === undefined || sessionId === null) return fallback;

			var models = ctx.modelDirectories;
			if (models === undefined || models === null || typeof models.directoryFor !== "function") return fallback;

			// 已寻址的 subagent 会话不公开模型选择入口（与官方一致）。
			var available = true;
			try {
				var sessions = ctx.sessions;
				if (sessions && typeof sessions.subagentAddress === "function" && sessions.subagentAddress(sessionId) !== undefined) {
					available = false;
				}
			} catch (error) {
				/* subagentAddress 不可用时按普通会话处理 */
			}

			var directory;
			try {
				directory = models.directoryFor(sessionId);
			} catch (error) {
				// 会话尚未解析出 binding/scope——正常现象（会话刚建、正在销毁），静默不渲染。
				return fallback;
			}
			if (directory === undefined || directory === null) return fallback;

			if (available) ensureLoaded(directory);
			var resolved = directory;

			return {
				available: available,
				store: resolved.store,
				select: function (selection) {
					if (!available) return Promise.resolve(UNAVAILABLE);
					return resolved.select(selection);
				}
			};
		}

		/* ------------------------------------------------------------------ *
		 * 槽位适配层（本地补丁，非作者原代码）
		 *
		 * 实测：本 build 的列表槽位不把 register({ inject }) 的返回值透传给组件——
		 * 在同一插槽内用哨兵 prop 验证过，注入值在任何实例（composer 内 14 键实例、
		 * 其余 32 个 7 键实例）都没有到达组件。于是 RheostatControl 永远拿到
		 * store === undefined，按自身门槛安静地 return null（无报错、无 DOM）。
		 *
		 * 这里改走插槽的标准 props：用 props.sessionId 自取会话目录，目录未就绪时
		 * 做有界重试；档位读取、提交队列等其余逻辑一律保持原作者实现。
		 * ------------------------------------------------------------------ */

		var capturedCtx = null;

		function RheostatSlot(props) {
			var models;
			try {
				/* Reading a required service off an inactive context throws. */
				models = capturedCtx ? capturedCtx.modelDirectories : undefined;
			} catch (error) {
				models = undefined;
			}
			var sessionId = props ? props.sessionId : undefined;
			var directory = null;
			try {
				if (sessionId !== undefined && sessionId !== null && models && typeof models.directoryFor === "function") {
					directory = models.directoryFor(sessionId) || null;
				}
			} catch (error) {
				directory = null;
			}

			var tick = React.useState(0);
			var bump = tick[1];
			React.useEffect(function () {
				if (directory !== null) return undefined;
				var tries = 0;
				var timer = setInterval(function () {
					tries += 1;
					if (tries > 20) { clearInterval(timer); return; }
					bump(function (value) { return value + 1; });
				}, 300);
				return function () { clearInterval(timer); };
			}, [directory]);

			var available = true;
			try {
				var sessions = capturedCtx ? capturedCtx.sessions : undefined;
				if (sessions && typeof sessions.subagentAddress === "function" && sessions.subagentAddress(sessionId) !== undefined) {
					available = false;
				}
			} catch (error) {
				/* 按普通会话处理 */
			}

			return React.createElement(RheostatControl, {
				available: available,
				store: directory ? directory.store : null,
				select: function (selection) {
					if (!available || !directory) return Promise.resolve(UNAVAILABLE);
					return directory.select(selection);
				}
			});
		}

		/* ------------------------------------------------------------------ *
		 * 插件
		 * ------------------------------------------------------------------ */

		function apply(ctx) {
			capturedCtx = ctx;
			var styleElement = ensureStyle();
			if (styleElement !== null) {
				ctx.effect(function () {
					return function () { styleElement.remove(); };
				}, "model-rheostat: styles");
			}

			try {
				ctx.slots.inject("conversation.input.right", function () {
					try {
						return ctx.slots.register({
							name: "conversation.input.right",
							id: "model-rheostat",
							order: 10,
							label: function () { return "模型强度"; },
							inject: function (sessionId) { return injectProps(ctx, sessionId); }
						}, RheostatSlot);
					} catch (error) {
						console.warn("[model-rheostat] conversation.input.right 注册失败：", error);
						return undefined;
					}
				});
			} catch (error) {
				console.warn("[model-rheostat] conversation.input.right 注入失败：", error);
			}
		}

		exports.name = "model-rheostat";
		exports.inject = ["slots", "modelDirectories", "sessions"];
		exports.apply = apply;

		return module.exports;
	}
});
