// このファイルではターミナルへの出力メッセージを用意する関数 `printLn` を用意する

import process from "node:process";

/**
 * 標準出力に出力する
 *
 * 出力には遅延がある可能性もあるので、戻り値には出力が既に終わっているか否かを示す `isFlushed` と、出力が終了したら解決される `promise` を含むオブジェクトが返される。
 */
export const printLn = (text: string): PrintLnOutput => {
	// 標準出力が無効になっている場合にエラーを返す
	if (!process.stdout.writable) {
		throw new Error("標準出力に出力できません");
	}

	// 出力し切った後に解決される Promise を生成する
	let resolve: ((result: Error | null) => void);
	const promise = new Promise<Error | null>(r => resolve = r);

	// 実際に出力を行い、その時点でバッファが解消されたかどうかブール値を返す
	const isFlushed = process.stdout.write(
		`${text}\n`,
		(error) => resolve(error ?? null)
	);

	// 既にバッファが解消されていたら Promise を解決する
	if (isFlushed) resolve(null);

	return { isFlushed, promise };
};

interface PrintLnOutput {
	isFlushed: boolean;
	promise: Promise<Error | null>;
}

/** 標準出力の出力先がターミナルかどうかを判別する */
export const isTTY = (): boolean => (
	process.stdout.isTTY === true
);

/** カラー出力を行う関数を集めたモジュール */
export namespace color {
	/**
	 * 出力先の状況に合わせてテキストを装飾して出力を行う
	 *
	 * 出力先がファイルになっている場合は装飾を行わない
	 */
	const decorate =
	(begin: string, text: string, end: string) => (
		isTTY() ? `${begin}${text}${end}` : text
	);

	export const dim = (text: string) => decorate(`\x1b[2m`, text, `\x1b[0m`);
	export const red = (text: string) => decorate(`\x1b[31m`, text, `\x1b[0m`);
	export const green = (text: string) => decorate(`\x1b[32m`, text, `\x1b[0m`);
	export const cyan = (text: string) => decorate(`\x1b[36m`, text, `\x1b[0m`);
	export const cyanBold = (text: string) => decorate(`\x1b[36m\x1b[1m`, text, `\x1b[0m`);
}