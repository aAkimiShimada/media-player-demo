// このファイルでは表示するインターフェースを実装している
import { enableMSE, enableEME, enableAutoResolution, resolutions } from "./consts.js";
import { videoSizeMessenger } from "./misc.js";
import { resolutionSelectionMessenger, playerStateMessenger } from "./mse.js";
import { div, elem, svgElem } from "./interface_utils.js";
import { createMessenger } from "./utils.js";
/** 見た目のカラーとして設定可能な値 */
const appearances = ["auto", "light", "dark"];
/** アピアランスの変更を監視するメッセンジャー */
const appearanceMessenger = createMessenger("auto");

/** レイアウトとして設定可能な値 */
const layouts = ["horizontal", "vertical"];
/** レイアウトの変更を監視するメッセンジャー */
const layoutMessenger = createMessenger("vertical");

/** インターフェースを構築する */
export const setupInterface = () => {
	// `body` 要素を取得する
	const body = document.querySelector("body");
	// コントローラを挿入する
	body.append(createController());
	// `body` のクラスを設定する
	setBodyClass(body);

	// 設定を適用する
	appearanceMessenger.notify();
	layoutMessenger.notify();
};

/** `body` の `class` に指定する内容を構成する */
const setBodyClass = body => {
	// アピアランスの変更を監視
	appearanceMessenger.setReceiver(appearance => {
		for (const targetAppearance of appearances) {
			body.classList.toggle(`appearance-${targetAppearance}`, appearance === targetAppearance);
		}
	});
	// レイアウトの変更を監視
	layoutMessenger.setReceiver(layout => {
		for (const targetLayout of layouts) {
			body.classList.toggle(`${targetLayout}-layout`, layout === targetLayout);
		}
	});
};

/** コントローラ全体を作成する */
const createController = () => {
	return div({
		id: "controller",
		children: [...createCSSVarsDefs(), createControllerItems(), createControllerFooter()]
	});
};

/** CSS 変数を定義するスタイルを作成する */
const createCSSVarsDefs = () => {
	// 2つの `style` 要素を生成する
	const style1 = elem("style", {
		children: [`
			body {
			 /* 動画プレーヤーの横幅,縦幅を設定する CSS 変数 */
			 --player-width: 600px;
			 --player-height: 500px;
			 /* コントローラの横幅,縦幅を設定する CSS 変数 */
			 --controller-width: 500px;
			 --controller-height: 400px;
			}
		`.replace(/^\t+/g, "").trim()]
	});
	const style2 = elem("style");

	/** 2つ目のスタイルシートの内容を更新する */
	const updateStyle = () => {
		const videoSize = videoSizeMessenger.get();
		style2.textContent = `
			body {
			 /* 動画の解像度 */
			 --width: ${videoSize.width};
			 --height: ${videoSize.height};
			}
		`.replace(/^\t+/g, "").trim();
	};

	// 動画のサイズが変更された時に更新を受け取る
	videoSizeMessenger.setReceiver(updateStyle);

	// 初期値として設定する
	updateStyle();
	return [style1, style2];
};

/** コントローラのリスト項目表示部分を作成する */
const createControllerItems = () => {
	return div({
		id: "controller-items",
		children: [createTagsItem(), createResolutionSelectorItem(), ...createPlayerStateItems()].filter(item => item != null)
	});
};

/** 各種設定の有効/無効をタグの有無として表現するリスト項目を用意する */
const createTagsItem = () => {
	const tags = [];
	if (enableMSE) {
		tags.push(div({
			class: ["tag", "mse"]
		}));
	}
	if (enableMSE && enableAutoResolution) {
		tags.push(div({
			class: ["tag", "auto-res"]
		}));
	}
	if (enableEME) {
		tags.push(div({
			class: ["tag", "eme"]
		}));
	}
	return div({
		class: ["item"],
		children: [div({
			class: ["key"],
			children: ["有効な機能"]
		}), div({
			class: ["value", "tags"],
			children: tags
		})]
	});
};

/** 解像度のオン/オフを切り替えるセレクタのリスト項目を用意する */
const createResolutionSelectorItem = () => {
	// MSE が無効な場合はこのメニューは表示しない
	if (!enableMSE) return null;

	// 解像度の選択オプション
	const resOptions = resolutions.map(res => {
		return elem("option", {
			attributes: {
				value: res
			},
			children: [res]
		});
	});

	// 表示する全ての解像度選択オプション
	const displayedOptions = !enableAutoResolution ? resOptions : [
	// 自動オプション
	elem("option", {
		attributes: {
			value: "auto"
		},
		children: ["自動"]
	}), elem("hr"),
	// 手動オプションのグループ
	elem("optgroup", {
		attributes: {
			label: "手動"
		},
		children: resOptions
	})];

	// `select` 要素を構成する
	const select = elem("select", {
		class: ["value"],
		attributes: {
			"name": "resolution-selector"
		},
		children: displayedOptions
	});

	/** `select` 要素で現在選択されている値をバリデーションして取り出す */
	const getValue = () => {
		// `string` 型の生の値
		const rawValue = select.value;
		// 自動の場合
		if (rawValue === "auto" && enableAutoResolution) return "auto";
		// 手動の場合
		if (resolutions.includes(rawValue)) return rawValue;
		// 不適切な値の場合はデフォルト値をセットする
		const value = enableAutoResolution ? "auto" : resolutions[0];
		select.value = value;
		return value;
	};

	// 解像度を変更した時にイベントを受け取る
	select.addEventListener("change", () => {
		resolutionSelectionMessenger.send(getValue());
	});

	// item を構成して返す
	return div({
		class: ["item"],
		children: [div({
			class: ["key"],
			children: ["読み込む解像度を選択"]
		}), select]
	});
};

/** プレーヤーの情報を示すリスト項目を用意する */
const createPlayerStateItems = () => {
	// MSE が無効な場合はこのメニューは表示しない
	if (!enableMSE) return [];

	/** 値を表示するラベルを作成する */
	const createValue = () => div({
		class: ["value"],
		children: ["N/A"]
	});

	/** リストの項目を作成する */
	const createItem = (key, value) => div({
		class: ["item"],
		children: [div({
			class: ["key"],
			children: [key]
		}), value]
	});

	// 全てのフィールドに対応する DOM を生成する
	const videoSize = createValue();
	const currentTime = createValue();
	const lastLoadedSegmentIndex = createValue();
	const nextLoadingSegmentIndex = createValue();
	const resolution = createValue();
	const isOffline = createValue();

	// 変更されたら受け取り、変更を反映させる
	videoSizeMessenger.setReceiver(size => {
		videoSize.textContent = `${size.width}×${size.height}`;
	});
	playerStateMessenger.setReceiver(playerState => {
		currentTime.textContent = playerState.currentTime.toFixed(3);
		currentTime.classList.toggle("mono", true);
		lastLoadedSegmentIndex.textContent = playerState.lastLoadedSegmentIndex.toString();
		lastLoadedSegmentIndex.classList.toggle("mono", true);
		nextLoadingSegmentIndex.textContent = playerState.nextLoadingSegmentIndex.toString();
		nextLoadingSegmentIndex.classList.toggle("mono", true);
		resolution.textContent = playerState.resolution ?? "N/A";
		isOffline.textContent = playerState.isOffline ? "Yes" : "No";
	});

	// item を生成して返す
	return [createItem("再生中の解像度", videoSize), createItem("再生位置", currentTime), createItem("最後に読み込んだセグメント", lastLoadedSegmentIndex), createItem("次に読み込むセグメント", nextLoadingSegmentIndex), createItem("セグメントの解像度", resolution), createItem("オフライン状態", isOffline)];
};

/** ボタンのアイコンを構成する DOM */
const icons = (() => {
	/**
	 * アピアランス表示用の SVG アイコンを作成する
	 *
	 * 内部の `path` 要素の `d` 属性だけ引数として与えれば生成できる
	 */
	const makeAppearanceIcon = d => svgElem("svg", {
		attributes: {
			"viewBox": "0 0 24 24"
		},
		children: [svgElem("path", {
			attributes: {
				"class": "fill",
				"d": d
			}
		})]
	});

	/**
	 * レイアウト表示用の SVG アイコンを作成する
	 *
	 * 内部の `path` 要素の `d` 属性だけ引数として与えれば生成できる
	 */
	const makeLayoutIcon = d => svgElem("svg", {
		attributes: {
			"viewBox": "0 0 24 24"
		},
		children: [svgElem("path", {
			attributes: {
				"class": "stroke",
				"fill": "none",
				"stroke-width": "1.5",
				"stroke-linecap": "round",
				"stroke-linejoin": "round",
				"d": d
			}
		})]
	});
	return {
		auto: makeAppearanceIcon("M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2S2 6.477 2 12s4.477 10 10 10Zm0-2V4a8 8 0 1 1 0 16Z"),
		light: makeAppearanceIcon("M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5s5-2.24 5-5s-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58a.996.996 0 0 0-1.41 0a.996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37a.996.996 0 0 0-1.41 0a.996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0a.996.996 0 0 0 0-1.41l-1.06-1.06zm1.06-10.96a.996.996 0 0 0 0-1.41a.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36a.996.996 0 0 0 0-1.41a.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"),
		dark: makeAppearanceIcon("M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26a5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"),
		vertical: makeLayoutIcon("M 7.25 3.75 a 3.5 3.5 0 0 0 -3.5 3.5 v 9.5 a 3.5 3.5 0 0 0 3.5 3.5 h 9.5 a 3.5 3.5 0 0 0 3.5 -3.5 v -9.5 a 3.5 3.5 0 0 0 -3.5 -3.5 z M 3.75 12 h 16.5"),
		horizontal: makeLayoutIcon("M 3.75 7.25 a 3.5 3.5 0 0 1 3.5 -3.5 h 9.5 a 3.5 3.5 0 0 1 3.5 3.5 v 9.5 a 3.5 3.5 0 0 1 -3.5 3.5 h -9.5 a 3.5 3.5 0 0 1 -3.5 -3.5 z M 12 3.75 v 16.5")
	};
})();

/** コントローラのフッター部分を作成する */
const createControllerFooter = () => {
	return div({
		id: "controller-footer",
		children: [
		// アピアランス
		createButtonGroup([["auto", "システムの設定に合わせて自動的にライト/ダークを選択します。"], ["light", "ライトモードで表示します。"], ["dark", "ダークモードで表示します。"]], appearanceMessenger),
		// レイアウト
		createButtonGroup([["vertical", "コントローラを動画の下側に表示するようにします。"], ["horizontal", "コントローラを動画の右側に表示するようにします。"]], layoutMessenger)]
	});
};

/**
 * 設定ボタンのグループを作成する
 * * 第1引数: 値と説明ラベルのタプルで構成される配列
 * * 第2引数: メッセンジャーオブジェクト
 * * 戻り値: グループを構成する `div` 要素
 * */
const createButtonGroup = (info, messenger) => {
	return div({
		class: ["button-group"],
		children: info.map(([value, description]) => {
			// 内部に SVG アイコンを含めて作成する
			const button = elem("button", {
				attributes: {
					title: description
				},
				children: [icons[value]]
			});

			// 状態変更を監視し、変化があったらスタイルを更新する
			messenger.setReceiver(newValue => {
				button.classList.toggle("selected", value === newValue);
			});

			// クリックアクションを用意
			button.addEventListener("click", () => {
				messenger.send(value);
			});
			return button;
		})
	});
};