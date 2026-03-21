// このファイルでは動的に、プログラマブルに正規表現を構成するためのユーティリティ関数を実装している

/**
 * 正規表現を文字列から構築するにあたって使用する文字列タグ
 *
 * 文字列から構築することでより自由度高く正規表現を作成できる。
 *
 * ```javascript
 * const floatPattern = RegExp(r`[\+\-]?[0-9]+\.[0-9]+`);
 * // 上式は下式と同じ
 * const floatPattern = /[\+\-]?[0-9]+\.[0-9]+/;
 * ```
 * */
export const r = String.raw;

/**
 * 正規表現のキャプチャグループを構築する
 *
 * * 第1引数: グループ名
 * * 第2引数: 正規表現
 * * 戻り値: 生成された正規表現パターンの文字列
 */
export const regexGroup = (name: string, pattern: string): string => {
	return `(?<${name}>${pattern})`;
};

/**
 * 正規表現で or のパターンを構築する
 *
 * * 第1引数: or となる正規表現の文字列のリスト
 * * 戻り値: 生成された正規表現パターンの文字列
 */
export const regexOr = (items: string[]): string => {
	return r`(?:` + items.join("|") + r`)`;
};

/**
 * パターンを単純に繋ぎ合わせた正規表現を構築する
 *
 * * 第1引数: 繋ぎ合わせる正規表現の文字列のリスト
 * * 戻り値: 生成された正規表現パターンの文字列
 */
export const regexConcat = (items: string[]): string => {
	return r`(?:` + items.join("") + `)`;
};

/**
 * パスのパターンとして繋ぎ合わせて正規表現を構築する
 *
 * * 第1引数: パス成分となる正規表現の文字列のリスト
 * * 戻り値: 生成された正規表現パターンの文字列
 */
export const regexPathJoin = (items: string[]): string => {
	return r`(?:` + items.join(r`\/`) + `)`;
};