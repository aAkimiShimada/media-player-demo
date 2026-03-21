// このファイルでは各種ユーティリティ関数を用意している

import { disableParallel } from "~/consts";

/** 配列に対して非同期関数を使って処理を行う */
export const forEach: ForEach = async (input, fn) => {
	// 型パラメータを取り出す
	type U = PickFromPromise<
		ReturnType<typeof fn>
	>;

	// 直列に実行する場合
	if (disableParallel) {
		const result: U[] = [];
		for (const item of input) {
			result.push(await fn(item));
		}
		return result;
	}

	// 並列に実行する場合
	else {
		return await Promise.all(
			input.map(fn)
		);
	}
};

/** `forEach` 関数の型 */
type ForEach = (
	<T, U>(
		array: Array<T>,
		fn: (input: T) => Promise<U>
	) => Promise<U[]>
);

/** `Promise<T>` の形式の型から型パラメータ `T` を取り出すユーティリティ型 */
type PickFromPromise<T> = (
	T extends Promise<any> ?
	Parameters<NonNullable<Parameters<T["then"]>[0]>>[0] :
	never
);