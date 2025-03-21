// このファイルでは表示するインターフェース関連の各種ユーティリティを実装している

/**
 * 新しい `div` 要素を作成する
 *
 * これは `elem` 要素のラッパーである
 * * 第1引数 (オプション): オプション値のオブジェクト
 *     * `id`: `id` 属性を指定する
 *     * `class`: `class` 属性に指定するクラス値の文字列リストを指定する
 *     * `children`: 内部に含める要素などのノードのリスト
 * * 戻り値: 生成した `div` 要素
 */
export const div = (options = {}) => elem("div", options);

/**
 * 新しい HTML の要素を作成する
 *
 * * 第1引数: 要素名
 * * 第2引数 (オプション): オプション値のオブジェクト
 *     * `id`: `id` 属性を指定する
 *     * `class`: `class` 属性に指定するクラス値の文字列リストを指定する
 *     * `attributes`: 属性値のデータをオブジェクト形式で指定する
 *     * `children`: 内部に含める要素などのノードのリスト
 * * 戻り値: 生成した HTML 要素
 */
export const elem = (tagName, options = {}) => {
	// 要素を作成
	const element = document.createElement(tagName);
	const {
		id,
		class: classList,
		attributes,
		children
	} = options;

	// id と class を設定
	if (id != undefined) {
		element.setAttribute("id", id);
	}
	for (const cls of classList ?? []) {
		element.classList.toggle(cls, true);
	}

	// 属性を設定
	for (const [key, value] of Object.entries(attributes ?? {})) {
		element.setAttribute(key, value);
	}

	// 子ノードを追加
	if (children != undefined) {
		element.append(...children);
	}
	return element;
};

/** SVG の名前空間 */
const svgNS = "http://www.w3.org/2000/svg";

/**
 * 新しい SVG の要素を作成する
 *
 * * 第1引数: 要素名
 * * 第2引数 (オプション): オプション値のオブジェクト
 *     * `attributes`: 属性値のデータをオブジェクト形式で指定する
 *     * `children`: 内部に含める要素などのノードのリスト
 * * 戻り値: 生成した SVG 要素
 */
export const svgElem = (tagName, options = {}) => {
	// 要素を作成
	const element = document.createElementNS(svgNS, tagName);
	const {
		attributes,
		children
	} = options;

	// 属性を設定
	for (const [key, value] of Object.entries(attributes ?? {})) {
		element.setAttribute(key, value);
	}

	// 子ノードを追加
	if (children != null) element.append(...children);
	return element;
};